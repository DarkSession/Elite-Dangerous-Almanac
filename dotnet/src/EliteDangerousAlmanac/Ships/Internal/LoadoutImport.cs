using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The figures a capture states for the ship as a whole.</summary>
/// <remarks>
/// These are the source's own account and are trusted over anything computed from the
/// modules, so long as the import did not change the module list under them.
/// </remarks>
internal sealed record ImportedTopFigures
{
    /// <summary>The commander's name for the ship.</summary>
    internal string? ShipName { get; init; }

    /// <summary>The ship's registered identifier.</summary>
    internal string? ShipIdent { get; init; }

    /// <summary>The hull price, in credits.</summary>
    internal double? HullValue { get; init; }

    /// <summary>The fitted modules' price, in credits.</summary>
    internal double? ModulesValue { get; init; }

    /// <summary>The rebuy cost, in credits.</summary>
    internal double? Rebuy { get; init; }

    /// <summary>The mass with no fuel and no cargo aboard, in tonnes.</summary>
    internal double? UnladenMass { get; init; }

    /// <summary>The cargo the ship can hold, in tonnes.</summary>
    internal double? CargoCapacity { get; init; }

    /// <summary>The main tank and the reserve, in tonnes.</summary>
    internal LoadoutFuelCapacity? FuelCapacity { get; init; }
}

/// <summary>The durable state one capture produces, detached from the capture itself.</summary>
/// <param name="ShipSymbol">The hull symbol the capture names.</param>
/// <param name="Modules">The fitted modules, in the source's own order and spelling.</param>
/// <param name="ModuleStats">
/// The resolved article for each mount whose capture describes a fixed one, keyed by the
/// build's own mount spelling. A mount absent from it takes its stats from the catalogue.
/// </param>
/// <param name="PrimitiveModifiers">
/// The complete recipe-side modifier inputs for each mount whose fixed article accepts an
/// experimental effect after purchase, keyed the same way.
/// </param>
/// <param name="Top">The figures the source states for the ship as a whole.</param>
/// <param name="SourcePurchase">The price record the source states, when it states one.</param>
/// <param name="Outcomes">What the import changed, and what reading it took.</param>
internal sealed record ImportedLoadoutState(
    string ShipSymbol,
    IReadOnlyList<LoadoutModule> Modules,
    IReadOnlyDictionary<string, OutfittingModule> ModuleStats,
    IReadOnlyDictionary<string, IReadOnlyList<EngineeringModifier>> PrimitiveModifiers,
    ImportedTopFigures Top,
    SourcePurchaseRecord? SourcePurchase,
    IReadOnlyList<LoadoutImportOutcome> Outcomes);

/// <summary>Reads a captured journal loadout into the state a build takes ownership of.</summary>
/// <remarks>
/// The capture is the only account of the ship there is, so it is kept wherever it can be.
/// Where it cannot, this decides between the hull's own stock article and an empty mount, and
/// says which it chose.
/// </remarks>
internal static class LoadoutImport
{
    /// <summary>The catalogued fixed article a fitted module describes, however it says so.</summary>
    /// <remarks>
    /// A capture that spells out its modifiers is identified by that signature. One that states
    /// a bare identity and no modifiers is identified by the identity, but only where no
    /// ordinary roll could have written it: the article is final, or the module's own
    /// engineering menu does not offer the blueprint it is named for. Everything that asks
    /// whether a mount holds an article asks this, so the answer cannot differ between the
    /// import that resolved one and the editor that later reads it back.
    /// </remarks>
    internal static PreEngineeredVariant? PreEngineeredVariantFor(LoadoutModule module) =>
        PreEngineeredStats.Identify(module)
        ?? (module.Engineering is ModuleEngineering engineering
            ? LoadoutEngineering.UnrollableFixedArticle(module.Item, engineering)
            : null);

    /// <summary>Reads one capture into durable state.</summary>
    /// <param name="capture">The captured loadout.</param>
    /// <returns>The state a build takes ownership of.</returns>
    /// <exception cref="ArgumentNullException">
    /// <paramref name="capture"/>, its hull symbol, its module list, one of its modules or one
    /// of their mount keys, identities or modifier labels is <see langword="null"/>.
    /// </exception>
    /// <exception cref="ArgumentException">Two modules name one mount.</exception>
    internal static ImportedLoadoutState Normalize(LoadoutEvent capture)
    {
        if (capture is null) throw new ArgumentNullException(nameof(capture));
        if (capture.Ship is null) throw new ArgumentNullException(nameof(capture), "The hull symbol is absent.");
        if (capture.Modules is null) throw new ArgumentNullException(nameof(capture), "The module list is absent.");

        List<LoadoutModule> modules = ReadModules(capture);
        ImportedTopFigures top = ReadTop(capture);
        List<LoadoutImportOutcome> outcomes = [];
        bool invalidatesAggregates = StockMounts(capture.Ship, modules, outcomes);
        if (invalidatesAggregates)
        {
            top = top with
            {
                ModulesValue = null,
                Rebuy = null,
                UnladenMass = null,
                CargoCapacity = null,
                FuelCapacity = null,
            };
        }

        Dictionary<string, OutfittingModule> moduleStats = new(StringComparer.Ordinal);
        Dictionary<string, IReadOnlyList<EngineeringModifier>> primitives = new(StringComparer.Ordinal);
        foreach (LoadoutModule module in modules) ResolveArticle(module, moduleStats, primitives);

        return new ImportedLoadoutState(
            ShipSymbol: capture.Ship,
            Modules: new ReadOnlyCollection<LoadoutModule>(modules),
            ModuleStats: new ReadOnlyDictionary<string, OutfittingModule>(moduleStats),
            PrimitiveModifiers:
                new ReadOnlyDictionary<string, IReadOnlyList<EngineeringModifier>>(primitives),
            Top: top,
            SourcePurchase: SourcePurchase.FromLoadout(capture),
            Outcomes: new ReadOnlyCollection<LoadoutImportOutcome>(outcomes));
    }

    /// <summary>Reads the module list, refusing an absent field and a repeated mount.</summary>
    private static List<LoadoutModule> ReadModules(LoadoutEvent capture)
    {
        List<LoadoutModule> modules = new(capture.Modules.Count);
        HashSet<string> mounted = new(StringComparer.OrdinalIgnoreCase);
        foreach (LoadoutModule module in capture.Modules)
        {
            if (module is null)
            {
                throw new ArgumentNullException(nameof(capture), "The module list holds an absent module.");
            }

            if (module.Slot is null)
            {
                throw new ArgumentNullException(nameof(capture), "A module states no mount key.");
            }

            if (module.Item is null)
            {
                throw new ArgumentNullException(nameof(capture), "A module states no identity.");
            }

            // The label is the only thing saying which stat moved, and every reader takes it
            // unconditionally, so an entry without one would import and then break the build.
            if (module.Engineering?.Modifiers is IReadOnlyList<EngineeringModifier> stated)
            {
                foreach (EngineeringModifier modifier in stated)
                {
                    if (modifier?.Label is null)
                    {
                        throw new ArgumentNullException(
                            nameof(capture), "A stated modifier names no label.");
                    }
                }
            }

            if (!mounted.Add(module.Slot))
            {
                throw new ArgumentException(
                    $"Two modules name the mount \"{TextPreview.Truncate(module.Slot)}\".",
                    nameof(capture));
            }

            modules.Add(module);
        }

        return modules;
    }

    private static ImportedTopFigures ReadTop(LoadoutEvent capture) => new()
    {
        ShipName = capture.ShipName,
        ShipIdent = capture.ShipIdent,
        HullValue = capture.HullValue,
        ModulesValue = capture.ModulesValue,
        Rebuy = capture.Rebuy,
        UnladenMass = capture.UnladenMass,
        CargoCapacity = capture.CargoCapacity,
        FuelCapacity = capture.FuelCapacity,
    };

    /// <summary>
    /// Puts the hull's own article in every stocked mount the capture leaves holding nothing
    /// that mount can take, and empties every other mount holding an article no catalogue
    /// resolves.
    /// </summary>
    /// <returns>Whether the changes invalidate the figures the capture states for the ship.</returns>
    private static bool StockMounts(
        string shipSymbol,
        List<LoadoutModule> modules,
        List<LoadoutImportOutcome> outcomes)
    {
        IReadOnlyList<DefaultLoadoutModule> defaults =
            DefaultLoadouts.Find(shipSymbol)?.Modules ?? [];
        IReadOnlyList<BuildSlot>? layout = null;
        bool invalidates = false;

        // The walk runs backwards so a mount can be emptied without moving the mounts still
        // to be judged. The findings are put back into mount order afterwards.
        List<LoadoutImportOutcome> corrections = [];
        for (int index = modules.Count - 1; index >= 0; index--)
        {
            LoadoutModule module = modules[index];

            // Some hull families name their own cargo-hatch symbol for the one article the
            // catalogue carries under the standard hatch, so a symbol lookup alone would
            // normalize the hatch of every Fer-de-Lance and Lynx Highliner capture.
            if (LoadoutState.IsNonOutfittingSlot(module.Slot)
                || LoadoutState.IsBuiltInHullModule(module))
            {
                continue;
            }

            OutfittingModule? stats = ModuleCatalogue.FindBySymbol(module.Item);
            ParsedSlot? parsed = BuildSlots.ParseName(module.Slot);
            StockedMountKind? stocked = parsed is null
                ? null
                : LoadoutSlotRules.StockedMount(parsed.Kind, parsed.Restriction);
            DefaultLoadoutModule? fallback =
                stocked is null ? null : StockArticle(defaults, module.Slot);

            // A stocked mount is the hull's, not the capture's: resolving the symbol only says
            // it names some module, not one this mount can hold. A capture that puts a cargo
            // rack in the armour mount, a size-8 plant in a Sidewinder's size-2 mount, or
            // anything at all in the hatch describes a ship that cannot exist, so the hull's
            // own article goes there. Only a stocked mount is corrected this way: any other
            // mount can legally stand empty, so a bad article there is the caller's to remove.
            bool rejected = fallback is not null
                && (stats is null
                    // Every legitimate hatch left this loop above, and the fit rules refuse
                    // that mount to every article, so they cannot tell the rest apart.
                    || stocked == StockedMountKind.CargoHatch
                    || StockedMountRejects(
                        shipSymbol,
                        layout ??= HullLayout(shipSymbol),
                        module.Slot,
                        stats));
            if (stats is not null && !rejected) continue;

            if (fallback is not null)
            {
                // The article is unknown; how the commander ran it is not. Dropping the
                // enabled flag would switch a disabled module back on and re-band it, moving
                // power and heat silently. The price and the engineering describe the article,
                // so they go.
                modules[index] = new LoadoutModule(module.Slot, fallback.Symbol)
                {
                    On = module.On,
                    Priority = module.Priority,
                    Health = module.Health,
                };
                corrections.Add(new ModuleDefaulted(module.Slot, module.Item, fallback.Symbol));
            }
            else
            {
                modules.RemoveAt(index);
                corrections.Add(new ModuleEmptied(module.Slot, module.Item));
            }

            invalidates = true;
        }

        corrections.Reverse();
        outcomes.AddRange(corrections);
        return FillEmptyStockMounts(defaults, modules, outcomes) || invalidates;
    }

    /// <summary>
    /// Puts the hull's own article in every stocked mount the capture names nothing for.
    /// </summary>
    /// <remarks>
    /// A mount the source named nothing for leaves the same hole as one it named an
    /// unresolvable article for, so both are filled from the hull defaults. Only a stocked core
    /// internal invalidates the capture's figures: the stock bulkhead and hatch weigh and cost
    /// nothing, and the stock approach suite weighs nothing and draws no power. The suite's
    /// price is the one a stocked article carries, and the credit figures stand anyway: at that
    /// price, dropping a commander's whole purchase record would lose far more than the figure
    /// is off by.
    /// </remarks>
    private static bool FillEmptyStockMounts(
        IReadOnlyList<DefaultLoadoutModule> defaults,
        List<LoadoutModule> modules,
        List<LoadoutImportOutcome> outcomes)
    {
        bool invalidates = false;
        foreach (DefaultLoadoutModule fallback in defaults)
        {
            ParsedSlot? parsed = BuildSlots.ParseName(fallback.Slot);
            StockedMountKind? stocked = parsed is null
                ? null
                : LoadoutSlotRules.StockedMount(parsed.Kind, parsed.Restriction);
            if (stocked is null || LoadoutState.MatchingKey(modules, fallback.Slot) is not null)
            {
                continue;
            }

            string slot = LoadoutState.OwnKey(modules, fallback.Slot);
            modules.Add(new LoadoutModule(slot, fallback.Symbol));
            outcomes.Add(new ModuleDefaulted(slot, null, fallback.Symbol));
            if (stocked == StockedMountKind.Core) invalidates = true;
        }

        return invalidates;
    }

    /// <summary>Whether this stocked mount refuses the article the capture put in it.</summary>
    /// <remarks>
    /// An unrecognised hull answers no: without its layout there is nothing to judge against,
    /// and the capture is the only account of the ship there is.
    /// </remarks>
    private static bool StockedMountRejects(
        string shipSymbol,
        IReadOnlyList<BuildSlot> layout,
        string slot,
        OutfittingModule stats)
    {
        foreach (BuildSlot mount in layout)
        {
            if (string.Equals(mount.Key, slot, StringComparison.OrdinalIgnoreCase))
            {
                return LoadoutFitting.Problem(shipSymbol, mount, stats) is not null;
            }
        }

        return false;
    }

    private static IReadOnlyList<BuildSlot> HullLayout(string shipSymbol)
    {
        ShipSlots? layout = ShipCatalogue.FindSlots(shipSymbol);
        return layout is null ? [] : BuildSlots.Enumerate(layout);
    }

    private static DefaultLoadoutModule? StockArticle(
        IReadOnlyList<DefaultLoadoutModule> defaults,
        string slot)
    {
        foreach (DefaultLoadoutModule candidate in defaults)
        {
            if (string.Equals(candidate.Slot, slot, StringComparison.OrdinalIgnoreCase))
            {
                return candidate;
            }
        }

        return null;
    }

    /// <summary>
    /// Resolves the fixed article one mount describes, and the recipe inputs behind it.
    /// </summary>
    /// <remarks>
    /// A reward has no distinct module symbol, so it is identified by its hand-set stat
    /// signature and supplies the values the capture omits; stated modifiers stay
    /// authoritative. A capture that omits its modifiers entirely can still be selected by its
    /// full identity; a stated list cannot, because older releases exported ordinary rolls
    /// under the same symbol, blueprint and grade.
    /// </remarks>
    private static void ResolveArticle(
        LoadoutModule module,
        Dictionary<string, OutfittingModule> moduleStats,
        Dictionary<string, IReadOnlyList<EngineeringModifier>> primitives)
    {
        ModuleEngineering? engineering = module.Engineering;
        PreEngineeredVariant? variant = PreEngineeredVariantFor(module);
        OutfittingModule? catalogued = variant is null ? null : PreEngineeredStats.Resolve(variant);
        OutfittingModule? article = catalogued;

        bool retainsBakedEffect = variant?.ExperimentalEffectSymbol is not null
            && engineering?.ExperimentalEffect is not null
            && RegistryIndex.KeyComparer.Equals(
                variant.ExperimentalEffectSymbol.Trim(), engineering.ExperimentalEffect.Trim());

        if (variant is not null
            && catalogued is not null
            && !catalogued.EngineeringLocked
            && !retainsBakedEffect)
        {
            PreEngineeredVariant unbaked = variant with { ExperimentalEffectSymbol = null };
            PreEngineeredVariant current = engineering?.ExperimentalEffect is string applied
                ? unbaked with { ExperimentalEffectSymbol = applied }
                : unbaked;

            // Seed the effect-free fixed article, then keep the complete recipe inputs
            // separately. A journal presentation leaves out recipe-only labels such as the
            // burst interval, while applying the effect to this baseline would make a
            // related-stat ratio count it zero times after the import. Stated entries come
            // first, so their own values stay authoritative.
            article = PreEngineeredStats.Resolve(unbaked);

            List<EngineeringModifier> inputs = [];
            if (engineering?.Modifiers is IReadOnlyList<EngineeringModifier> stated)
            {
                inputs.AddRange(stated);
            }

            inputs.AddRange(PreEngineeredStats.Modifiers(current));
            primitives[module.Slot] = new ReadOnlyCollection<EngineeringModifier>(inputs);
        }

        if (article is not null) moduleStats[module.Slot] = article;

        // A partial block naming no recipe identifies no final article.
        if (article?.EngineeringLocked == true
            || engineering?.BlueprintName is not string blueprint
            || !LoadoutEngineering.IsFinalGuardianWeaponEngineering(module.Item, blueprint))
        {
            return;
        }

        OutfittingModule? guardian = FinalGuardianArticle(module, engineering, blueprint);
        if (guardian is not null)
        {
            moduleStats[module.Slot] = guardian with { EngineeringLocked = true };
        }
    }

    /// <summary>The article a final Guardian weapon's stated recipe describes.</summary>
    private static OutfittingModule? FinalGuardianArticle(
        LoadoutModule module,
        ModuleEngineering engineering,
        string blueprint)
    {
        PreEngineeredVariant? exact = null;
        PreEngineeredVariant? unbaked = null;
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.VariantsFor(module.Item))
        {
            if (!candidate.EngineeringLocked) continue;
            if (candidate.Grade != engineering.Level) continue;
            if (!RegistryIndex.KeyComparer.Equals(candidate.BlueprintSymbol.Trim(), blueprint.Trim()))
            {
                continue;
            }

            if (candidate.ExperimentalEffectSymbol is null) unbaked ??= candidate;
            else if (RegistryIndex.KeyComparer.Equals(
                candidate.ExperimentalEffectSymbol.Trim(),
                engineering.ExperimentalEffect?.Trim()))
            {
                exact ??= candidate;
            }
        }

        if (exact is not null) return PreEngineeredStats.Resolve(exact);
        if (unbaked is not null && engineering.ExperimentalEffect is string applied)
        {
            return PreEngineeredStats.Resolve(
                unbaked with { ExperimentalEffectSymbol = applied });
        }

        return ModuleCatalogue.FindBySymbol(module.Item);
    }
}
