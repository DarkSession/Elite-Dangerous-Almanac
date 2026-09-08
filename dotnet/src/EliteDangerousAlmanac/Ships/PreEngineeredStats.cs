using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
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

    private static IReadOnlyList<EngineeringModifier> Compute(
        PreEngineeredVariant variant,
        OutfittingModule module)
    {
        bool carriesABlock = variant.Modifiers is not null && variant.Modifiers.Count > 0;
        if (!carriesABlock && variant.ExperimentalEffectSymbol is null) return [];

        ExperimentalEffect? effect = variant.ExperimentalEffectSymbol is null
            ? null
            : ExperimentalEffectCatalogue.Find(variant.ExperimentalEffectSymbol);
        if (variant.ExperimentalEffectSymbol is not null && effect is null) return [];

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
