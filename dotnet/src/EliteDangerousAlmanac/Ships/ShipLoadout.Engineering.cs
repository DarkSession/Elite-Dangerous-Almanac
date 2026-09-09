using System;
using System.Collections.Generic;
using System.Globalization;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <content>The engineering a build applies to what it holds.</content>
public sealed partial class ShipLoadout
{
    /// <summary>Rolls a recipe onto one fitted module.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <param name="blueprintSymbol">
    /// The recipe's symbol. A module family that renames a shared recipe is resolved, so the
    /// generic spelling and the module's own both answer.
    /// </param>
    /// <param name="options">The grade, the quality roll and any experimental effect.</param>
    /// <returns>This build, so edits chain.</returns>
    /// <remarks>
    /// The fitted module keeps its identity and gains an engineering block stating every stat the
    /// roll moves, in the labels a journal writes. A fixed pre-engineered article is rolled from
    /// the stock module behind it rather than from its own fixed figures, so replacing its
    /// engineering does not fold those figures in a second time.
    /// </remarks>
    /// <exception cref="ArgumentNullException">An argument is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The mount holds no module, the recipe has no such grade, or the quality is not a roll from
    /// zero through one.
    /// </exception>
    /// <exception cref="ArgumentException">
    /// No catalogue carries stats for the fitted module, the module's own menu does not offer the
    /// recipe or the effect, the article is final, the named recipe is a fixed article's identity
    /// rather than a recipe, or the catalogues carry no base stat the roll needs.
    /// </exception>
    public ShipLoadout ApplyBlueprint(
        string slotKey,
        string blueprintSymbol,
        ApplyBlueprintOptions options)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));
        if (blueprintSymbol is null) throw new ArgumentNullException(nameof(blueprintSymbol));
        if (options is null) throw new ArgumentNullException(nameof(options));

        LoadoutModule module = FittedModuleFor(slotKey) ?? throw new ArgumentOutOfRangeException(
            nameof(slotKey), slotKey, Message("The mount \"{0}\" holds no module.", slotKey));
        OutfittingModule fittedStats = StatsFor(module) ?? throw new ArgumentException(
            Message("No catalogue carries stats for the module \"{0}\".", module.Item),
            nameof(slotKey));

        // Resolve before the grade is read, so the features folded are the ones this module
        // rolls rather than another family's.
        string recipe = BlueprintJournal.ResolveForModule(module.Item, blueprintSymbol);
        string named = NamedRecipe(blueprintSymbol, recipe);

        // A festive fixed article reaches this method as a real journal identity that names no
        // craftable recipe. It is fitted as an article, not rolled onto a stock module.
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.VariantsFor(module.Item))
        {
            if (candidate.Acquisition != PreEngineeredAcquisition.EventReward) continue;
            if (!SameSymbol(candidate.BlueprintSymbol, blueprintSymbol)
                && !SameSymbol(candidate.BlueprintSymbol, recipe))
            {
                continue;
            }

            throw new ArgumentException(
                Message(
                    "The identity {0} names a fixed pre-engineered article rather than a "
                    + "craftable recipe. Fit the article instead.",
                    named),
                nameof(blueprintSymbol));
        }

        BlueprintGrade? grade = options.Grade is >= 1 and <= 5
            ? BlueprintCatalogue.FindGrade(recipe, options.Grade)
            : null;
        if (grade is null)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options),
                options.Grade,
                Message("The recipe {0} has no grade {1}.", named, options.Grade));
        }

        ExperimentalEffect? experimental = null;
        if (options.ExperimentalEffectSymbol is string wantedExperimental)
        {
            experimental = ExperimentalEffectCatalogue.Find(wantedExperimental)
                ?? throw new ArgumentOutOfRangeException(
                    nameof(options),
                    wantedExperimental,
                    Message(
                        "No catalogue carries the experimental effect \"{0}\".",
                        wantedExperimental));
        }

        double quality = options.Quality;
        if (double.IsNaN(quality) || double.IsInfinity(quality) || quality < 0 || quality > 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options), quality, "The quality must be a finite number from 0 through 1.");
        }

        if (fittedStats.EngineeringLocked)
        {
            throw new ArgumentException(
                Message(
                    "The module \"{0}\" is a final pre-engineered article and accepts no further "
                    + "engineering.",
                    module.Item),
                nameof(slotKey));
        }

        // The engineering menu is the authority on what a module accepts. A module with no menu
        // may still be a grade-1 Mercenary article carrying a bespoke recipe, which the same
        // check knows about.
        if (!LoadoutEngineering.BlueprintAvailableFor(module.Item, blueprintSymbol))
        {
            throw new ArgumentException(
                UnofferedBlueprintMessage(module.Item, named), nameof(blueprintSymbol));
        }

        if (options.ExperimentalEffectSymbol is string requested
            && !LoadoutEngineering.ExperimentalAvailableFor(module.Item, requested))
        {
            IReadOnlyList<string> offered = EngineeringOptions.ExperimentalsFor(module.Item);
            throw new ArgumentException(
                Message(
                    offered.Count > 0
                        ? "The module \"{0}\" is not offered the experimental effect \"{1}\". It "
                          + "takes {2}."
                        : "The module \"{0}\" is offered no experimental effect, so it does not "
                          + "take \"{1}\".{2}",
                    module.Item,
                    requested,
                    offered.Count > 0 ? string.Join(", ", offered) : string.Empty),
                nameof(options));
        }

        OutfittingModule stats = EngineeringBaseStats(module) ?? fittedStats;
        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(stats);
        (BlueprintGrade canonicalGrade, ExperimentalEffect? canonicalEffect) =
            LoadoutEngineering.PrimitiveInputsFor(stats, grade, experimental);
        List<string> missing = LoadoutEngineering.MissingBaseLabels(
            stats, baseStats, canonicalGrade.Features, canonicalEffect?.Modifiers);
        if (missing.Count > 0)
        {
            throw new ArgumentException(
                Message(
                    "The recipe {0} cannot be computed for the module \"{1}\". The catalogues "
                    + "carry no base stat for {2}.",
                    named,
                    module.Item,
                    string.Join(", ", missing)),
                nameof(blueprintSymbol));
        }

        List<EngineeringModifier> primitives = [
            .. Engineering.ComputeModifiers(baseStats, canonicalGrade, quality, canonicalEffect),
        ];
        List<EngineeringModifier> journal =
            LoadoutEngineering.JournalModifiersFor(stats, primitives);

        // A converting experimental effect supersedes a recipe's own conversion, just as it
        // supersedes the stock split. Both shapes reach the journal the same way, and the shares
        // belong in the calculated block as well as the stated one.
        int stated = journal.Count;
        LoadoutEngineering.AppendDamageShares(
            journal, stats, experimental?.DamageDistribution ?? grade.DamageDistribution);
        for (int index = stated; index < journal.Count; index++) primitives.Add(journal[index]);

        ModuleEngineering engineering = new(blueprintSymbol, options.Grade, quality)
        {
            ExperimentalEffect = options.ExperimentalEffectSymbol,
            Modifiers = journal,
        };
        ReplaceModule(module.Slot, module with { Engineering = engineering }, stats, primitives);
        return this;
    }

    /// <summary>Adds, replaces or removes one fitted module's experimental effect alone.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <param name="experimentalEffectSymbol">
    /// The effect's symbol, or <see langword="null"/> to remove the effect.
    /// </param>
    /// <returns>The outcome. A refusal leaves the build unchanged.</returns>
    /// <remarks>
    /// <para>
    /// Ordinary and Mercenary engineering is recomputed at the recipe, the grade and the quality
    /// the module already states. A fixed reward instead keeps its hand-set modifiers and its
    /// purchase identity while the requested effect composes with them.
    /// </para>
    /// <para>
    /// A Mercenary article is recomputed rather than composed, and that limits what its baked
    /// effect accepts. At the purchase grade there is no recipe to recompute from, because the
    /// bespoke recipe starts at grade 2, so every edit is refused. Above that grade an edit
    /// recomputes normally, to an effect the module's own menu offers alone. Both refusals leave
    /// the baked effect where it is.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    public ExperimentalEffectEdit SetExperimentalEffect(
        string slotKey,
        string? experimentalEffectSymbol)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        string? wanted = experimentalEffectSymbol;
        LoadoutModule? module = FittedModuleFor(slotKey);
        if (module is null)
        {
            return EffectRefused(
                EngineeringEditCode.EmptySlot, new EngineeringEditDetail { Slot = slotKey });
        }

        EngineeringEditDetail fitted = new() { Slot = module.Slot, Symbol = module.Item };
        OutfittingModule? stats = StatsFor(module);
        if (stats is null)
        {
            return EffectRefused(EngineeringEditCode.UnsupportedEngineering, fitted);
        }

        if (module.Engineering is not ModuleEngineering engineering)
        {
            return EffectRefused(EngineeringEditCode.NotEngineered, fitted);
        }

        if (stats.EngineeringLocked)
        {
            return EffectRefused(EngineeringEditCode.FinalArticle, fitted);
        }

        string? previous = engineering.ExperimentalEffect;
        if ((previous is null && wanted is null)
            || (previous is not null && wanted is not null && SameSymbol(previous, wanted)))
        {
            return new ExperimentalEffectEdit(EngineeringEditKind.Unchanged, previous);
        }

        PreEngineeredVariant? variant = LoadoutImport.PreEngineeredVariantFor(module);
        ExperimentalEffect? effect = null;
        if (wanted is not null)
        {
            effect = ExperimentalEffectCatalogue.Find(wanted);
            if (effect is null)
            {
                return EffectRefused(
                    EngineeringEditCode.UnknownExperimentalEffect,
                    fitted with { ExperimentalEffectSymbol = wanted });
            }

            // Restoring a baked effect is allowed only where the fixed-article branch below
            // handles it. A Mercenary article is recomputed through the recipe instead, which
            // re-reads the menu and throws, so an out-of-menu baked effect must be refused here
            // rather than turned into an exception on ordinary captured data.
            bool restoresBakedEffect = variant?.ExperimentalEffectSymbol is string baked
                && variant.Acquisition != PreEngineeredAcquisition.Mercenary
                && SameSymbol(baked, wanted);
            if (!LoadoutEngineering.ExperimentalAvailableFor(module.Item, wanted)
                && !restoresBakedEffect)
            {
                return EffectRefused(
                    EngineeringEditCode.UnsupportedExperimentalEffect,
                    fitted with { ExperimentalEffectSymbol = wanted });
            }
        }

        if (variant is not null && variant.Acquisition != PreEngineeredAcquisition.Mercenary)
        {
            if (ComposeFixedArticle(module, variant, engineering, wanted, effect, engineering.Quality)
                is EngineeringEditCode refusal)
            {
                return EffectRefused(
                    refusal,
                    refusal == EngineeringEditCode.UnresolvedModifiers
                        ? fitted with { UnresolvedLabels = UnresolvedEffectLabels(module, effect) }
                        : fitted);
            }
        }
        else
        {
            if (RecomputeOrdinary(module, stats, engineering, wanted, effect, engineering.Quality)
                is EngineeringEditCode refusal)
            {
                return EffectRefused(refusal, OrdinaryDetail(module, engineering, refusal, effect));
            }
        }

        return new ExperimentalEffectEdit(EngineeringEditKind.Updated, wanted, previous);
    }

    /// <summary>Recomputes one fitted module's stated engineering at the best quality roll.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>The outcome. A refusal leaves the build unchanged.</returns>
    /// <remarks>
    /// <para>
    /// The modifier values an import states stay authoritative until this is called. An ordinary
    /// or a Mercenary recipe is rerolled through the calculator, and a fixed reward rebuilds its
    /// hand-set modifiers and any effect without losing its purchase identity.
    /// </para>
    /// <para>
    /// A block that names a recipe and a grade but states no modifiers at all is rolled here too,
    /// even at the best quality, so a completed roll cannot stay stock. A stated modifier list,
    /// empty or partial, is left alone at the best quality.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    public EngineeringGradeEdit CompleteEngineeringGrade(string slotKey)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        LoadoutModule? module = FittedModuleFor(slotKey);
        if (module is null)
        {
            return GradeRefused(
                EngineeringEditCode.EmptySlot, new EngineeringEditDetail { Slot = slotKey });
        }

        EngineeringEditDetail fitted = new() { Slot = module.Slot, Symbol = module.Item };
        OutfittingModule? stats = StatsFor(module);
        if (stats is null) return GradeRefused(EngineeringEditCode.UnsupportedEngineering, fitted);

        if (module.Engineering is not ModuleEngineering engineering)
        {
            return GradeRefused(EngineeringEditCode.NotEngineered, fitted);
        }

        if (stats.EngineeringLocked) return GradeRefused(EngineeringEditCode.FinalArticle, fitted);

        // A completed roll that states its modifiers is already whole. One that states none has
        // nothing to keep, so it is rolled from the recipe rather than left stock.
        if (engineering.Quality == 1 && engineering.Modifiers is not null)
        {
            return new EngineeringGradeEdit(EngineeringEditKind.Unchanged);
        }

        double previousQuality = engineering.Quality;
        if (double.IsNaN(previousQuality)
            || double.IsInfinity(previousQuality)
            || previousQuality < 0
            || previousQuality > 1)
        {
            return GradeRefused(EngineeringEditCode.InvalidQuality, fitted);
        }

        string? experimental = engineering.ExperimentalEffect;
        ExperimentalEffect? effect =
            experimental is null ? null : ExperimentalEffectCatalogue.Find(experimental);
        if (experimental is not null && effect is null)
        {
            return GradeRefused(
                EngineeringEditCode.UnknownExperimentalEffect,
                fitted with { ExperimentalEffectSymbol = experimental });
        }

        PreEngineeredVariant? variant = LoadoutImport.PreEngineeredVariantFor(module);

        // Mercenary excluded for the reason given on the effect edit: its recompute runs through
        // the recipe, which refuses an out-of-menu effect by throwing.
        bool restoresBakedEffect = experimental is not null
            && variant?.ExperimentalEffectSymbol is string baked
            && variant.Acquisition != PreEngineeredAcquisition.Mercenary
            && SameSymbol(baked, experimental);
        if (experimental is not null
            && !LoadoutEngineering.ExperimentalAvailableFor(module.Item, experimental)
            && !restoresBakedEffect)
        {
            return GradeRefused(
                EngineeringEditCode.UnsupportedExperimentalEffect,
                fitted with { ExperimentalEffectSymbol = experimental });
        }

        if (variant is not null && variant.Acquisition != PreEngineeredAcquisition.Mercenary)
        {
            if (ComposeFixedArticle(module, variant, engineering, experimental, effect, 1)
                is EngineeringEditCode refusal)
            {
                return GradeRefused(
                    refusal,
                    refusal == EngineeringEditCode.UnresolvedModifiers
                        ? fitted with { UnresolvedLabels = UnresolvedEffectLabels(module, effect) }
                        : fitted);
            }
        }
        else
        {
            if (RecomputeOrdinary(module, stats, engineering, experimental, effect, 1)
                is EngineeringEditCode refusal)
            {
                return GradeRefused(refusal, OrdinaryDetail(module, engineering, refusal, effect));
            }
        }

        return new EngineeringGradeEdit(EngineeringEditKind.Updated, previousQuality);
    }

    /// <summary>Fits a catalogued pre-engineered article, replacing whatever the mount holds.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <param name="variant">The article to fit.</param>
    /// <returns>This build, so edits chain.</returns>
    /// <remarks>
    /// The article's fixed stats and its journal engineering block are resolved together. It
    /// carries its grade, the best quality roll, any baked experimental effect and its fixed
    /// modifiers. Because the article names the module it fits as, a decorative identity cannot
    /// reach an unrelated weapon. A Mercenary article publishes no fixed stat block of its own,
    /// so it keeps the stock stats apart from its baked effect, and states that effect's
    /// modifiers and no others. An article that moves no stat states no modifiers at all, rather
    /// than an empty list claiming it changes none.
    /// </remarks>
    /// <exception cref="ArgumentNullException">An argument is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// No catalogued article matches the module, the recipe, the grade, the effect and the route.
    /// </exception>
    /// <exception cref="ArgumentException">
    /// The catalogues carry no base stat one of the article's own modifiers needs.
    /// </exception>
    /// <exception cref="LoadoutEditException">
    /// The article's base module does not fit the mount, or fitting it breaks a module limit.
    /// </exception>
    public ShipLoadout SetPreEngineeredVariant(string slotKey, PreEngineeredVariant variant)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));
        if (variant is null) throw new ArgumentNullException(nameof(variant));

        PreEngineeredVariant? known = null;
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.VariantsFor(variant.Symbol))
        {
            if (SameSymbol(candidate.BlueprintSymbol, variant.BlueprintSymbol)
                && candidate.Grade == variant.Grade
                && candidate.Acquisition == variant.Acquisition
                && SameSymbol(
                    candidate.ExperimentalEffectSymbol ?? string.Empty,
                    variant.ExperimentalEffectSymbol ?? string.Empty))
            {
                known = candidate;
                break;
            }
        }

        if (known is null)
        {
            throw new ArgumentOutOfRangeException(
                nameof(variant),
                variant.BlueprintSymbol,
                Message(
                    "No catalogued article \"{0}\" exists for the module \"{1}\".",
                    variant.BlueprintSymbol,
                    variant.Symbol));
        }

        OutfittingModule stats = PreEngineeredStats.Resolve(known) ?? throw new ArgumentException(
            Message("No catalogue carries stats for the module \"{0}\".", known.Symbol),
            nameof(variant));
        IReadOnlyList<string> unresolved = PreEngineeredStats.UnresolvedLabels(known);
        if (unresolved.Count > 0)
        {
            throw new ArgumentException(
                Message(
                    "The article \"{0}\" cannot be resolved for the module \"{1}\". The "
                    + "catalogues carry no base stat for {2}.",
                    known.BlueprintSymbol,
                    known.Symbol,
                    string.Join(", ", unresolved)),
                nameof(variant));
        }

        SetModule(slotKey, stats);
        LoadoutModule module = FittedModuleFor(slotKey)!;

        // Whatever the article moves is what it publishes. A Mercenary row carries no stat block
        // of its own, but its baked effect still moves stats, and those belong in the block.
        IReadOnlyList<EngineeringModifier> journal = PreEngineeredStats.JournalModifiers(known);
        ModuleEngineering engineering = new(known.BlueprintSymbol, known.Grade, 1)
        {
            ExperimentalEffect = known.ExperimentalEffectSymbol,
            Modifiers = journal.Count > 0 ? journal : null,
        };
        ReplaceModule(
            module.Slot,
            module with { Engineering = engineering },
            stats,
            PreEngineeredStats.Modifiers(known));
        return this;
    }

    /// <summary>Strips the engineering from one fitted module, restoring its base stats.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>This build, so edits chain. An empty or unengineered mount changes nothing.</returns>
    /// <remarks>
    /// Clearing a Mercenary article removes the purchase-exclusive identity with it, so the
    /// module then answers to no catalogued article.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentException">
    /// The fitted article is final and its baked engineering cannot be removed.
    /// </exception>
    public ShipLoadout ClearEngineering(string slotKey)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        LoadoutModule? module = FittedModuleFor(slotKey);
        if (module is null) return this;

        if (StatsFor(module) is { EngineeringLocked: true })
        {
            throw new ArgumentException(
                Message(
                    "The module \"{0}\" is a final pre-engineered article and its engineering "
                    + "cannot be removed.",
                    module.Item),
                nameof(slotKey));
        }

        if (module.Engineering is not null)
        {
            OutfittingModule? bareStats = EngineeringBaseStats(module);
            LoadoutModule bare = new(module.Slot, module.Item)
            {
                On = module.On,
                Priority = module.Priority,
                Health = module.Health,
                Value = module.Value,
            };
            ReplaceModule(module.Slot, bare, bareStats);
        }

        return this;
    }

    /// <summary>Rolls a stated recipe whose source wrote no modifiers it can keep.</summary>
    /// <returns>What the reading did, or <see langword="null"/> when nothing needs reporting.</returns>
    private LoadoutImportOutcome? RollStatedRecipe(LoadoutModule module)
    {
        if (module.Engineering is not ModuleEngineering engineering) return null;

        IReadOnlyList<EngineeringModifier>? stated = engineering.Modifiers;
        OutfittingModule? stats = StatsFor(module);
        if (stated is not null
            && (moduleStats.ContainsKey(module.Slot)
                || stats is null
                || !LoadoutEngineering.StatesInertModifiers(stats, stated)))
        {
            return null;
        }

        if (stated is null && moduleStats.ContainsKey(module.Slot))
        {
            PreEngineeredVariant? article = LoadoutImport.PreEngineeredVariantFor(module);
            if (article?.Acquisition != PreEngineeredAcquisition.Mercenary
                || engineering.Level <= article.Grade)
            {
                return null;
            }
        }

        try
        {
            ApplyBlueprint(
                module.Slot,
                engineering.BlueprintName,
                new ApplyBlueprintOptions(
                    engineering.Level, engineering.Quality, engineering.ExperimentalEffect));
        }
        catch (ArgumentException)
        {
            // Every refusal here is a recipe this module cannot roll: an unknown or an unoffered
            // recipe or effect, a grade or a quality outside the recipe, or a base stat the
            // catalogues do not carry. The block stands as the source stated it and the figures
            // stay stock, which is what the outcome says. Anything else the calculator throws is
            // a defect, and is not laundered into one.
            return new EngineeringUnresolved(
                module.Slot, module.Item, engineering.BlueprintName);
        }

        if (stated is not null)
        {
            return new EngineeringRerolled(module.Slot, module.Item, engineering.BlueprintName);
        }

        // Both readings of a bare identity are legitimate wherever the menu offers the recipe a
        // fixed article also carries. The roll is what nearly every such block is, so it stands,
        // but the choice is reported rather than made in silence.
        return LoadoutEngineering.RolledOverFixedArticle(module.Item, engineering)
            is PreEngineeredVariant passedOver
            ? new EngineeringAmbiguous(
                module.Slot, module.Item, engineering.BlueprintName, passedOver)
            : null;
    }

    /// <summary>The stats a replacement engineering block is folded over.</summary>
    /// <remarks>
    /// A fixed article's effective figures are not a stock module. Rolling from the catalogue
    /// article instead keeps a new recipe from folding over the fixed values a second time, and
    /// keeps clearing the engineering from retaining those values as an unlabelled base.
    /// </remarks>
    private OutfittingModule? EngineeringBaseStats(LoadoutModule module)
    {
        OutfittingModule? fitted = StatsFor(module);
        if (module.Engineering is null || LoadoutImport.PreEngineeredVariantFor(module) is null)
        {
            return fitted;
        }

        OutfittingModule? stock = ModuleCatalogue.FindBySymbol(module.Item);
        if (stock is null) return fitted;
        return fitted is { EngineeringLocked: true } ? stock with { EngineeringLocked = true } : stock;
    }

    /// <summary>Rebuilds a fixed article's own modifiers beside a requested effect.</summary>
    /// <returns>The refusal, or <see langword="null"/> when the build was changed.</returns>
    private EngineeringEditCode? ComposeFixedArticle(
        LoadoutModule module,
        PreEngineeredVariant variant,
        ModuleEngineering engineering,
        string? wanted,
        ExperimentalEffect? effect,
        double quality)
    {
        OutfittingModule? stock = EngineeringBaseStats(module);
        if (stock is null) return EngineeringEditCode.UnsupportedEngineering;

        if (LoadoutEngineering.MissingBaseLabels(
            stock, ModuleStatLabels.BaseStats(stock), [], effect?.Modifiers).Count > 0)
        {
            return EngineeringEditCode.UnresolvedModifiers;
        }

        PreEngineeredVariant bare = variant with { ExperimentalEffectSymbol = null };
        PreEngineeredVariant adjusted =
            wanted is null ? bare : bare with { ExperimentalEffectSymbol = wanted };
        OutfittingModule? resolved = PreEngineeredStats.Resolve(bare);
        if (resolved is null) return EngineeringEditCode.UnsupportedEngineering;

        ModuleEngineering replacement = new(
            engineering.BlueprintName, engineering.Level, quality)
        {
            ExperimentalEffect = wanted,
            Modifiers = PreEngineeredStats.JournalModifiers(adjusted),
        };
        ReplaceModule(
            module.Slot,
            module with { Engineering = replacement },
            resolved,
            PreEngineeredStats.Modifiers(adjusted));
        return null;
    }

    /// <summary>Recomputes an ordinary or a Mercenary recipe beside a requested effect.</summary>
    /// <returns>The refusal, or <see langword="null"/> when the build was changed.</returns>
    private EngineeringEditCode? RecomputeOrdinary(
        LoadoutModule module,
        OutfittingModule stats,
        ModuleEngineering engineering,
        string? wanted,
        ExperimentalEffect? effect,
        double quality)
    {
        string blueprint = engineering.BlueprintName;
        int level = engineering.Level;
        if (level < 1 || level > 5) return EngineeringEditCode.UnsupportedEngineering;

        bool unresolvedEffect = engineering.ExperimentalEffect is not null
            && ExperimentalEffectCatalogue.Find(engineering.ExperimentalEffect) is null;
        ExperimentalEffect? current = engineering.ExperimentalEffect is null
            ? null
            : ExperimentalEffectCatalogue.Find(engineering.ExperimentalEffect);
        OrdinaryEngineeringProof proof = LoadoutEngineering.ProveOrdinaryEngineering(
            module.Item, engineering, current, unresolvedEffect);
        if (proof == OrdinaryEngineeringProof.Unproven
            || (proof == OrdinaryEngineeringProof.Proven
                && !LoadoutEngineering.BlueprintAvailableFor(module.Item, blueprint)))
        {
            return EngineeringEditCode.UnidentifiedPreEngineeredVariant;
        }

        string recipe = BlueprintJournal.ResolveForModule(module.Item, blueprint);
        BlueprintGrade? grade = BlueprintCatalogue.FindGrade(recipe, level);
        if (grade is null
            || !LoadoutEngineering.BlueprintAvailableFor(module.Item, blueprint)
            || double.IsNaN(quality)
            || double.IsInfinity(quality)
            || quality < 0
            || quality > 1)
        {
            return EngineeringEditCode.UnsupportedEngineering;
        }

        OutfittingModule bareStats = EngineeringBaseStats(module) ?? stats;
        (BlueprintGrade canonical, ExperimentalEffect? canonicalEffect) =
            LoadoutEngineering.PrimitiveInputsFor(bareStats, grade, effect);
        if (LoadoutEngineering.MissingBaseLabels(
            bareStats,
            ModuleStatLabels.BaseStats(bareStats),
            canonical.Features,
            canonicalEffect?.Modifiers).Count > 0)
        {
            return EngineeringEditCode.UnresolvedModifiers;
        }

        ApplyBlueprint(module.Slot, blueprint, new ApplyBlueprintOptions(level, quality, wanted));
        return null;
    }

    /// <summary>The labels a fixed article's requested effect states and no catalogue answers.</summary>
    private List<string> UnresolvedEffectLabels(
        LoadoutModule module,
        ExperimentalEffect? effect)
    {
        OutfittingModule? stock = EngineeringBaseStats(module);
        return stock is null
            ? []
            : LoadoutEngineering.MissingBaseLabels(
                stock, ModuleStatLabels.BaseStats(stock), [], effect?.Modifiers);
    }

    /// <summary>What a recompute refusal describes, which the recipe and grade join.</summary>
    private EngineeringEditDetail OrdinaryDetail(
        LoadoutModule module,
        ModuleEngineering engineering,
        EngineeringEditCode code,
        ExperimentalEffect? effect)
    {
        EngineeringEditDetail detail = new() { Slot = module.Slot, Symbol = module.Item };
        return code switch
        {
            EngineeringEditCode.UnidentifiedPreEngineeredVariant =>
                detail with { BlueprintSymbol = engineering.BlueprintName },
            EngineeringEditCode.UnsupportedEngineering => detail with
            {
                BlueprintSymbol = engineering.BlueprintName,
                Grade = engineering.Level,
            },
            EngineeringEditCode.UnresolvedModifiers => detail with
            {
                UnresolvedLabels = UnresolvedRecipeLabels(module, engineering, effect),
            },
            _ => detail,
        };
    }

    /// <summary>The labels a recompute needs a base stat for and the catalogues do not carry.</summary>
    private List<string> UnresolvedRecipeLabels(
        LoadoutModule module,
        ModuleEngineering engineering,
        ExperimentalEffect? effect)
    {
        OutfittingModule? stats = EngineeringBaseStats(module) ?? StatsFor(module);
        string recipe = BlueprintJournal.ResolveForModule(module.Item, engineering.BlueprintName);
        BlueprintGrade? grade = BlueprintCatalogue.FindGrade(recipe, engineering.Level);
        if (stats is null || grade is null) return [];

        (BlueprintGrade canonical, ExperimentalEffect? canonicalEffect) =
            LoadoutEngineering.PrimitiveInputsFor(stats, grade, effect);
        return LoadoutEngineering.MissingBaseLabels(
            stats,
            ModuleStatLabels.BaseStats(stats),
            canonical.Features,
            canonicalEffect?.Modifiers);
    }

    private static ExperimentalEffectEdit EffectRefused(
        EngineeringEditCode code,
        EngineeringEditDetail detail) =>
        new(EngineeringEditKind.Unsupported, Code: code, Detail: detail);

    private static EngineeringGradeEdit GradeRefused(
        EngineeringEditCode code,
        EngineeringEditDetail detail) =>
        new(EngineeringEditKind.Unsupported, Code: code, Detail: detail);

    private static bool SameSymbol(string left, string right) =>
        RegistryIndex.KeyComparer.Equals(left.Trim(), right.Trim());

    /// <summary>Names a recipe, and the module's own spelling of it where the two differ.</summary>
    private static string NamedRecipe(string requested, string resolved) =>
        RegistryIndex.KeyComparer.Equals(requested.Trim(), resolved.Trim())
            ? Message("\"{0}\"", requested)
            : Message("\"{0}\" (\"{1}\" on this module)", requested, resolved);

    private static string UnofferedBlueprintMessage(string item, string named)
    {
        List<KeyValuePair<string, BlueprintRoute>> offered =
            LoadoutEngineering.BlueprintRoutesFor(item);
        if (offered.Count == 0)
        {
            return Message(
                "No registry lists an engineering menu for the module \"{0}\".", item);
        }

        List<string> candidates = new(offered.Count);
        foreach (KeyValuePair<string, BlueprintRoute> entry in offered)
        {
            candidates.Add(Message("{0} ({1})", entry.Key, entry.Value));
        }

        return Message(
            "The module \"{0}\" is not offered the recipe {1}. It takes {2}.",
            item,
            named,
            string.Join(", ", candidates));
    }

    private static string Message(string format, params object?[] values)
    {
        object?[] previewed = new object?[values.Length];
        for (int index = 0; index < values.Length; index++)
        {
            previewed[index] = values[index] is string text
                ? TextPreview.Truncate(text)
                : values[index];
        }

        return string.Format(CultureInfo.InvariantCulture, format, previewed);
    }
}
