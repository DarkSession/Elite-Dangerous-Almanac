using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// Resolves a pre-engineered variant into a fittable module: the base module's registry record
/// with the variant's hand-set stat changes applied.
/// </summary>
/// <remarks>
/// <para>
/// A variant on its own is a pairing rather than a module. It names the base symbol and the
/// engineering baked into it, and building a ship with one needs the resolved article: mass,
/// power draw, integrity and the rest as the variant actually arrives.
/// </para>
/// <para>
/// The outfitting registry carries the mechanical, defence and weapon stats.
/// <see cref="UnresolvedLabels"/> reports any label that cannot be resolved rather than dropping
/// it silently.
/// </para>
/// </remarks>
public static class PreEngineeredStats
{
    /// <summary>The highest grade an engineer rolls.</summary>
    private const int MaxEngineeringGrade = 5;

    /// <summary>The four damage shares a conversion writes.</summary>
    private static readonly string[] DamageShareOrder = ["Kinetic", "Thermal", "Explosive", "Absolute"];

    /// <summary>The primitive fixed modifiers a variant applies to its base module.</summary>
    /// <param name="variant">The variant to read.</param>
    /// <returns>
    /// One modifier per computable label. It is empty when the variant carries neither a stat
    /// block nor a baked effect that moves a stat, and when its symbol is unknown.
    /// </returns>
    /// <remarks>
    /// The variant's baked experimental effect is included. Labels stay in their recipe form, so
    /// a burst-pattern internal is not converted into the rate of fire a journal derives from it;
    /// use <see cref="Resolve"/> when the resolved module stats are wanted.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="variant"/> is <see langword="null"/>.</exception>
    public static IReadOnlyList<EngineeringModifier> Modifiers(PreEngineeredVariant variant)
    {
        if (variant is null) throw new ArgumentNullException(nameof(variant));

        OutfittingModule? module = ModuleCatalogue.FindBySymbol(variant.Symbol);
        return module is null ? [] : Compute(variant, module);
    }

    /// <summary>The labels a variant modifies that cannot be computed for its base module.</summary>
    /// <param name="variant">The variant to read.</param>
    /// <returns>The unresolvable labels, in the variant's own order.</returns>
    /// <remarks>
    /// These are the labels the registry does not model at all, and the known stats whose base
    /// value this particular module leaves out. Reporting them separates "this variant changes
    /// nothing else" from "this catalogue cannot say". Every catalogued variant answers empty.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="variant"/> is <see langword="null"/>.</exception>
    public static IReadOnlyList<string> UnresolvedLabels(PreEngineeredVariant variant)
    {
        if (variant is null) throw new ArgumentNullException(nameof(variant));
        if (variant.Modifiers is null) return [];

        HashSet<string> resolved = new(StringComparer.Ordinal);
        foreach (EngineeringModifier modifier in Modifiers(variant)) resolved.Add(modifier.Label);

        List<string> unresolved = [];
        foreach (PreEngineeredModifier modifier in variant.Modifiers)
        {
            if (!resolved.Contains(modifier.Label)) unresolved.Add(modifier.Label);
        }

        return new ReadOnlyCollection<string>(unresolved);
    }

    /// <summary>Resolves a variant into a module record ready to fit.</summary>
    /// <param name="variant">The variant to resolve.</param>
    /// <returns>
    /// The base module's record with every stat the variant moves, and that the registry carries,
    /// replaced by its engineered value; or <see langword="null"/> when the variant's symbol is
    /// not in the outfitting registry.
    /// </returns>
    /// <remarks>
    /// <para>
    /// The symbol, name, class, rating and price stay the base module's throughout: a
    /// pre-engineered variant is the same article with different numbers, not a different module.
    /// A final variant also carries its engineering lock, so fitting the resolved article keeps
    /// that restriction.
    /// </para>
    /// <para>
    /// Exact damage components scale with an engineered damage value, so their proportions and
    /// the anti-xeno overlay stay coherent with the resolved scalar. A variant with no stat block
    /// resolves to the base record with its baked experimental effect applied, which is the
    /// honest answer: the effect is published, and the grade-1 pre-engineering a Mercenary
    /// article arrives with is not.
    /// </para>
    /// <para>
    /// The rate of fire follows a moved firing cycle even though no recipe names it. An article
    /// whose burst interval, burst size or within-burst rate moves resolves the rate those parts
    /// produce.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="variant"/> is <see langword="null"/>.</exception>
    public static OutfittingModule? Resolve(PreEngineeredVariant variant)
    {
        if (variant is null) throw new ArgumentNullException(nameof(variant));

        OutfittingModule? module = ModuleCatalogue.FindBySymbol(variant.Symbol);
        if (module is null) return null;
        if ((variant.Modifiers is null || variant.Modifiers.Count == 0)
            && !variant.EngineeringLocked
            && variant.ExperimentalEffectSymbol is null)
        {
            return module;
        }

        // Everything the article moves, its baked experimental effect included. A Mercenary row
        // publishes no stat block of its own and arrives entirely by that effect, so reading the
        // block alone would miss what it changes.
        IReadOnlyList<EngineeringModifier> applied = Compute(variant, module);
        ModuleStats stats = module.Stats;
        bool guardianZoneResistance = module.GuardianZoneResistance;
        foreach (EngineeringModifier modifier in applied)
        {
            ModuleStat? stat = ModuleStatLabels.StatFor(modifier.Label, module.Stats);

            // A numeric value returns to the registry's own units, because a journal reports a
            // resistance as a percentage where the registry stores a fraction. A string-valued
            // capability is stored as the flag it grants.
            if (stat is not null && modifier.Value is double value)
            {
                stats = stats.With(stat.Value, value / ModuleStatLabels.ScaleFor(modifier.Label));
            }
            else if (modifier.ValueStr is not null
                && ModuleStatLabels.CapabilityValueFor(modifier.Label) is not null)
            {
                guardianZoneResistance = true;
            }
        }

        DamageDistribution? converted = variant.ExperimentalEffectSymbol is null
            ? null
            : ExperimentalEffectCatalogue.Find(variant.ExperimentalEffectSymbol)?.DamageDistribution;

        stats = WithDerivedRateOfFire(stats, applied);

        return module with
        {
            Stats = stats,
            GuardianZoneResistance = guardianZoneResistance,
            EngineeringLocked = module.EngineeringLocked || variant.EngineeringLocked,
            DamageDistribution = converted ?? module.DamageDistribution,
            DamageComponents = converted is not null
                ? null
                : module.DamageComponents is null
                    ? null
                    : DamageComponentScaling.Scale(
                        module.DamageComponents,
                        module.Stats[ModuleStat.Damage],
                        stats[ModuleStat.Damage]),
        };
    }

    /// <summary>
    /// Derives the rate of fire an article's own modifier block states, for an article whose
    /// burst pattern moved.
    /// </summary>
    /// <remarks>
    /// It is derived here exactly as the block derives it, so the resolved stat and the published
    /// block state one rate of fire rather than two.
    /// </remarks>
    private static ModuleStats WithDerivedRateOfFire(
        ModuleStats stats,
        IReadOnlyList<EngineeringModifier> applied)
    {
        if (!stats.Has(ModuleStat.RateOfFire)) return stats;

        bool movesTheCycle = false;
        foreach (EngineeringModifier modifier in applied)
        {
            if (string.Equals(modifier.Label, "RateOfFire", StringComparison.Ordinal)) return stats;
            foreach (string label in EngineeringPrecision.BurstPatternLabels)
            {
                if (string.Equals(modifier.Label, label, StringComparison.Ordinal)) movesTheCycle = true;
            }
        }

        if (!movesTheCycle) return stats;

        double? rate = EngineeringPrecision.JournalRateOfFire(
            EngineeringPrecision.PreciseValueFor(applied, "BurstInterval") ?? stats[ModuleStat.BurstInterval],
            EngineeringPrecision.PreciseValueFor(applied, "BurstSize") ?? stats[ModuleStat.BurstRounds],
            EngineeringPrecision.PreciseValueFor(applied, "BurstRateOfFire") ?? stats[ModuleStat.BurstRateOfFire]);
        return rate is null ? stats : stats.With(ModuleStat.RateOfFire, rate.Value);
    }


    /// <summary>The journal-shaped fixed modifiers a variant reports when fitted.</summary>
    /// <param name="variant">The variant to read.</param>
    /// <returns>
    /// The modifiers as a journal writes them, the damage shares a baked conversion adds
    /// included. It is empty when the variant's symbol is unknown.
    /// </returns>
    /// <remarks>
    /// These are the same changes <see cref="Modifiers"/> reports, presented the way a capture
    /// states them: a burst pattern reads as the rate of fire the game derives from it, and a
    /// weapon reports its damage per second.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="variant"/> is <see langword="null"/>.</exception>
    public static IReadOnlyList<EngineeringModifier> JournalModifiers(PreEngineeredVariant variant)
    {
        if (variant is null) throw new ArgumentNullException(nameof(variant));

        return JournalModifiersWith(variant, variant.ExperimentalEffectSymbol, false);
    }

    /// <summary>Identifies the fixed article a captured fitted module describes.</summary>
    /// <param name="module">A module from a journal event or a SLEF export.</param>
    /// <returns>
    /// The one catalogue variant the capture answers to, or <see langword="null"/> when the
    /// evidence names none or names more than one.
    /// </returns>
    /// <remarks>
    /// <para>
    /// A reward article carries hand-set values that an ordinary roll of the named blueprint
    /// does not reproduce, so the reported stats decide rather than the blueprint identity
    /// alone. A captured experimental effect is composed with each candidate before the
    /// comparison, because some fixed articles accept an effect after purchase.
    /// </para>
    /// <para>
    /// A Mercenary article is the exception. Its bespoke blueprint is on sale only after the
    /// article is bought, and its unpublished purchase block cannot identify it, so the module
    /// symbol and the blueprint identify the purchase at grade 1 and at every grade it was
    /// upgraded to since. The fitted grade and effect stay the build's current state, and the
    /// variant carries the original purchase grade, price and baked effect: read the capture for
    /// what is fitted now, and the variant for what was bought.
    /// </para>
    /// <para>
    /// A locked article is also identified by its own symbol, blueprint, grade and effect where
    /// a capture states no modifiers at all: being final, no ordinary roll could have written
    /// that combination. A stated but empty or partial list does not take that shortcut, because
    /// an older export can carry an ordinary roll under the same identity and its values must
    /// not be replaced by reward figures.
    /// </para>
    /// <para>
    /// A journal may leave out a derived modifier, so one predicted value may be absent. Every
    /// stated predicted value must agree to within one part in ten thousand of the stat's
    /// unmodified base, which is wide enough for a producer that stores the multiplier and
    /// re-derives the value, and narrow enough that no other candidate fits. Ambiguous or
    /// incomplete evidence answers nothing rather than guessing.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="module"/> is <see langword="null"/>.</exception>
    public static PreEngineeredVariant? Identify(LoadoutModule module)
    {
        if (module is null) throw new ArgumentNullException(nameof(module));
        if (module.Engineering is not ModuleEngineering engineering) return null;

        OutfittingModule? stock = ModuleCatalogue.FindBySymbol(module.Item);
        if (stock is null) return null;

        IReadOnlyList<PreEngineeredVariant> variants = PreEngineeredCatalogue.VariantsFor(module.Item);
        PreEngineeredVariant? blueprintMatch = OnlyBlueprintMatch(variants, engineering.BlueprintName);

        if (blueprintMatch is not null
            && blueprintMatch.Acquisition == PreEngineeredAcquisition.Mercenary
            && engineering.Level >= blueprintMatch.Grade
            && engineering.Level <= MaxEngineeringGrade)
        {
            return blueprintMatch;
        }

        if (engineering.Modifiers is null) return IdentityOnlyMatch(variants, engineering);
        if (engineering.Modifiers.Count == 0) return null;

        return SignatureMatch(variants, stock, engineering);
    }

    /// <summary>The one variant a captured blueprint name matches, when exactly one does.</summary>
    private static PreEngineeredVariant? OnlyBlueprintMatch(
        IReadOnlyList<PreEngineeredVariant> variants,
        string blueprintName)
    {
        string wanted = blueprintName.Trim();
        PreEngineeredVariant? found = null;
        foreach (PreEngineeredVariant candidate in variants)
        {
            if (!RegistryIndex.KeyComparer.Equals(candidate.BlueprintSymbol, wanted)) continue;
            if (found is not null) return null;
            found = candidate;
        }

        return found;
    }

    /// <summary>The one locked article a capture stating no modifiers can only mean.</summary>
    private static PreEngineeredVariant? IdentityOnlyMatch(
        IReadOnlyList<PreEngineeredVariant> variants,
        ModuleEngineering engineering)
    {
        string wanted = engineering.BlueprintName.Trim();
        string? experimental = engineering.ExperimentalEffect?.Trim();
        PreEngineeredVariant? found = null;
        foreach (PreEngineeredVariant candidate in variants)
        {
            if (!candidate.EngineeringLocked) continue;
            if (candidate.Grade != engineering.Level) continue;
            if (!RegistryIndex.KeyComparer.Equals(candidate.BlueprintSymbol, wanted)) continue;

            bool effectAgrees = candidate.ExperimentalEffectSymbol is null
                ? experimental is null && engineering.ExperimentalEffectLocalised is null
                : RegistryIndex.KeyComparer.Equals(
                    candidate.ExperimentalEffectSymbol, experimental);
            if (!effectAgrees) continue;
            if (found is not null) return null;
            found = candidate;
        }

        return found;
    }

    /// <summary>The one variant whose predicted stat block the capture reproduces.</summary>
    private static PreEngineeredVariant? SignatureMatch(
        IReadOnlyList<PreEngineeredVariant> variants,
        OutfittingModule stock,
        ModuleEngineering engineering)
    {
        Dictionary<string, EngineeringModifier> actual = new(StringComparer.OrdinalIgnoreCase);
        foreach (EngineeringModifier modifier in engineering.Modifiers!)
        {
            actual[ModifierKey(modifier, stock)] = modifier;
        }

        string capturedBlueprint = engineering.BlueprintName.Trim();
        PreEngineeredVariant? found = null;
        foreach (PreEngineeredVariant candidate in variants)
        {
            if (candidate.Modifiers is null || candidate.Modifiers.Count == 0) continue;
            if (candidate.Grade != engineering.Level) continue;

            // The festive articles share one stat block, so their journal identity is what tells
            // the colours apart. Every other reward still matches by its hand-set signature,
            // because an alias or an incomplete capture makes the blueprint spelling weaker
            // evidence there.
            if (candidate.Acquisition == PreEngineeredAcquisition.EventReward
                && (engineering.ExperimentalEffect is not null
                    || engineering.ExperimentalEffectLocalised is not null
                    || !RegistryIndex.KeyComparer.Equals(candidate.BlueprintSymbol, capturedBlueprint)))
            {
                continue;
            }

            // A capture in the wild uses Frontier's primitive stat labels or its derived
            // outfitting-panel labels. Either complete representation is accepted, and partial
            // evidence from the two is never mixed.
            bool matched =
                MatchesSignature(actual, Predicted(candidate, engineering, false), stock)
                || MatchesSignature(actual, Predicted(candidate, engineering, true), stock);
            if (!matched) continue;
            if (found is not null) return null;
            found = candidate;
        }

        return found;
    }

    private static IReadOnlyList<EngineeringModifier> Predicted(
        PreEngineeredVariant candidate,
        ModuleEngineering engineering,
        bool journalShaped)
    {
        string? experimental = engineering.ExperimentalEffect;
        if (!journalShaped)
        {
            OutfittingModule? module = ModuleCatalogue.FindBySymbol(candidate.Symbol);
            return module is null ? [] : Compute(candidate, module, experimental, true);
        }

        return JournalModifiersWith(candidate, experimental, true);
    }

    /// <summary>The journal-shaped block a variant predicts, with a stated effect composed in.</summary>
    private static List<EngineeringModifier> JournalModifiersWith(
        PreEngineeredVariant variant,
        string? experimental,
        bool overridden)
    {
        OutfittingModule? module = ModuleCatalogue.FindBySymbol(variant.Symbol);
        if (module is null) return [];

        List<EngineeringModifier> modifiers = LoadoutEngineering.JournalModifiersFor(
            module, Compute(variant, module, experimental, overridden));

        string? effectName = overridden ? experimental : variant.ExperimentalEffectSymbol;
        DamageDistribution? converted = effectName is null
            ? null
            : ExperimentalEffectCatalogue.Find(effectName)?.DamageDistribution;
        LoadoutEngineering.AppendDamageShares(modifiers, module, converted);
        return modifiers;
    }

    /// <summary>One stable comparison key for the recipe and journal spellings of a stat.</summary>
    private static string ModifierKey(EngineeringModifier modifier, OutfittingModule module)
    {
        ModuleStat? stat = ModuleStatLabels.StatFor(modifier.Label, module.Stats);
        return stat is null ? "label:" + modifier.Label.Trim() : "stat:" + stat.Value;
    }

    /// <summary>Whether a capture holds enough of one predicted representation.</summary>
    private static bool MatchesSignature(
        Dictionary<string, EngineeringModifier> actual,
        IReadOnlyList<EngineeringModifier> expected,
        OutfittingModule module)
    {
        if (expected.Count == 0) return false;

        int matched = 0;
        foreach (EngineeringModifier predicted in expected)
        {
            if (!actual.TryGetValue(ModifierKey(predicted, module), out EngineeringModifier? stated))
            {
                continue;
            }

            if (!SameModifier(stated, predicted)) return false;
            matched++;
        }

        return matched >= Math.Max(1, expected.Count - 1);
    }

    /// <summary>Whether a captured modifier agrees with the value a candidate predicts.</summary>
    private static bool SameModifier(EngineeringModifier actual, EngineeringModifier expected)
    {
        if (expected.Value is double wanted)
        {
            return actual.Value is double stated
                && SameJournalNumber(stated, wanted, expected.OriginalValue ?? wanted);
        }

        // A capability value is localized inconsistently, so its presence is the durable fact
        // and a candidate capability must stay string-valued.
        return expected.ValueStr is not null && actual.ValueStr is not null;
    }

    /// <summary>Numeric equality at the precision the capture's producer wrote.</summary>
    /// <remarks>
    /// Frontier serializes a single-precision float of the modified value itself. A third-party
    /// editor stores the multiplier and re-derives the value from the stock stat, so its error
    /// scales with that unmodified base rather than with the result. One part in ten thousand of
    /// the base leaves that room and still separates a hand-set article from every other
    /// candidate, whose predictions differ by percent. Frontier's own noise floor is kept beside
    /// it, so a stat whose base value is zero still has a tolerance instead of none.
    /// </remarks>
    private static bool SameJournalNumber(double actual, double expected, double baseValue) =>
        Math.Abs(actual - expected)
            <= Math.Max(1e-5, Math.Max(Math.Abs(baseValue) * 1e-4, Math.Abs(expected) * 1e-6));

    private static IReadOnlyList<EngineeringModifier> Compute(
        PreEngineeredVariant variant,
        OutfittingModule module) => Compute(variant, module, null, false);

    /// <summary>
    /// Everything a variant moves, with an experimental effect a capture states composed in
    /// place of the variant's own baked one.
    /// </summary>
    private static IReadOnlyList<EngineeringModifier> Compute(
        PreEngineeredVariant variant,
        OutfittingModule module,
        string? experimental,
        bool overridden)
    {
        string? effectName = overridden ? experimental : variant.ExperimentalEffectSymbol;
        bool carriesABlock = variant.Modifiers is not null && variant.Modifiers.Count > 0;
        if (!carriesABlock && effectName is null) return [];

        ExperimentalEffect? effect = effectName is null
            ? null
            : ExperimentalEffectCatalogue.Find(effectName);
        if (effectName is not null && effect is null) return [];

        return Engineering.ComputeModifiers(
            ModuleStatLabels.BaseStats(module),
            FixedFeatures(variant.Modifiers),
            1,
            effect?.Modifiers);
    }

    /// <summary>Reads each fixed value as both ends of a feature no quality roll moves.</summary>
    private static List<BlueprintFeature> FixedFeatures(
        IReadOnlyList<PreEngineeredModifier>? modifiers)
    {
        if (modifiers is null) return [];

        List<BlueprintFeature> features = new(modifiers.Count);
        foreach (PreEngineeredModifier modifier in modifiers)
        {
            features.Add(new BlueprintFeature(
                modifier.Label, modifier.Method, modifier.Value, modifier.Value));
        }

        return features;
    }
}
