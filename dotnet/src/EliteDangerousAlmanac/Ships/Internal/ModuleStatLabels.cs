using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>
/// The bridge between journal modifier labels and the module stats that hold their base
/// values, including the unit and the algebra each label uses.
/// </summary>
/// <remarks>
/// <para>
/// The mapping is not one to one in either direction by design. A module carries one optimal
/// mass, and which label names it depends on the module's kind, so several labels share
/// <see cref="ModuleStat.OptMass"/>.
/// </para>
/// <para>
/// It is its own type so that code needing only the mapping does not pull in the blueprint
/// and experimental-effect catalogues alongside it.
/// </para>
/// </remarks>
internal static class ModuleStatLabels
{
    private const double Percent = 100;

    private static readonly StatLabel[] Labels =
    [
        new("Mass", ModuleStat.Mass),
        new("Integrity", ModuleStat.Integrity),
        new("PowerDraw", ModuleStat.PowerDraw),
        new("BootTime", ModuleStat.BootTime),

        // Core performance.
        new("FSDOptimalMass", ModuleStat.OptMass),
        new("EngineOptimalMass", ModuleStat.OptMass),
        new("EngineMinimumMass", ModuleStat.MinMass),
        new("MaximumMass", ModuleStat.MaxMass),
        new("ShieldGenOptimalMass", ModuleStat.OptMass),
        new("ShieldGenMinimumMass", ModuleStat.MinMass),
        new("ShieldGenMaximumMass", ModuleStat.MaxMass),
        new("EngineOptPerformance", ModuleStat.OptMultiplier) { Scale = Percent },
        new("EngineMinPerformance", ModuleStat.MinMultiplier) { Scale = Percent },
        new("EngineMaxPerformance", ModuleStat.MaxMultiplier) { Scale = Percent },
        new("ShieldGenStrength", ModuleStat.OptMultiplier) { Scale = Percent },
        new("ShieldGenMinStrength", ModuleStat.MinMultiplier) { Scale = Percent },
        new("ShieldGenMaxStrength", ModuleStat.MaxMultiplier) { Scale = Percent },
        new("EngineHeatRate", ModuleStat.EngineHeatRate),
        new("FSDHeatRate", ModuleStat.FsdHeatRate),
        new("MaxFuelPerJump", ModuleStat.MaxFuel),
        new("PowerCapacity", ModuleStat.PowerCapacity),
        new("HeatEfficiency", ModuleStat.HeatEfficiency),
        new("EnginesCapacity", ModuleStat.EnginesCapacity),
        new("EnginesRecharge", ModuleStat.EnginesRecharge),
        new("SystemsCapacity", ModuleStat.SystemsCapacity),
        new("SystemsRecharge", ModuleStat.SystemsRecharge),
        new("WeaponsCapacity", ModuleStat.WeaponsCapacity),
        new("WeaponsRecharge", ModuleStat.WeaponsRecharge),
        new("RefuelRate", ModuleStat.RefuelRate),

        // A journal spells a fuel scoop's rate FuelScoopRate, where the recipe that moves it
        // says RefuelRate. Both resolve, as FalloffRange and DamageFalloffRange do.
        new("FuelScoopRate", ModuleStat.RefuelRate),
        new("FuelCapacity", ModuleStat.FuelCapacity),
        new("CargoCapacity", ModuleStat.CargoCapacity),
        new("CabinCapacity", ModuleStat.CabinCapacity),
        new("RegenRate", ModuleStat.ShieldRegenRate),
        new("BrokenRegenRate", ModuleStat.ShieldBrokenRegenRate),

        // A shield generator's distributor draw is the systems-capacitor cost of one megajoule
        // per second of regeneration, and the journal gives it its own label rather than
        // reusing a weapon's DistributorDraw. Same stat, both spellings.
        new("EnergyPerRegen", ModuleStat.DistributorDraw),

        // Shield cell banks.
        new("ShieldBankReinforcement", ModuleStat.ShieldBankReinforcement),
        new("ShieldBankHeat", ModuleStat.ShieldBankHeat),

        // A cell bank's heat is also the thermal load its record carries, the same figure from
        // the same upstream field, so a recipe that moves one moves both.
        new("ShieldBankHeat", ModuleStat.ThermalLoad),
        new("ShieldBankSpinUp", ModuleStat.ShieldBankSpinUp),
        new("ShieldBankDuration", ModuleStat.ShieldBankDuration),

        // Scanning, and the frame shift drive interdictor.
        new("ScannerRange", ModuleStat.ScannerRange),
        new("SensorTargetScanAngle", ModuleStat.ScanAngle),

        // The utility scanners' scan cone is the same stat under the journal's other name.
        new("MaxAngle", ModuleStat.ScanAngle),
        new("ScannerTimeToScan", ModuleStat.ScanTime),

        // The blueprint recipe says ProbeRadius; a journal writes DSS_PatchRadius for the same
        // stat on the same module. Both resolve.
        new("ProbeRadius", ModuleStat.ProbeRadius),
        new("DSS_PatchRadius", ModuleStat.ProbeRadius),
        new("FSDInterdictorFacingLimit", ModuleStat.InterdictorFacingLimit),
        new("FSDInterdictorRange", ModuleStat.InterdictorRange),

        // Defence.
        new("DefenceModifierShieldMultiplier", ModuleStat.ShieldBoost)
        {
            Scale = Percent,
            MultiplierBase = Percent,
        },

        // On an armour module this scales the bulkhead's own hull boost. A hull reinforcement
        // package carries none, and because this is a percentage of a multiplier that absence
        // is itself a value: no hull boost is a multiplier of one, which is zero percent. The
        // recipe's bonus is therefore the whole result, which is how the game reads it and
        // what a journal reports.
        new("DefenceModifierHealthMultiplier", ModuleStat.HullBoost)
        {
            Scale = Percent,
            MultiplierBase = Percent,
        },
        new("DefenceModifierHealthAddition", ModuleStat.HullReinforcement),
        new("DefenceModifierShieldAddition", ModuleStat.ShieldAddition),
        new("GuardianModuleResistance", null) { CapabilityValue = "Active" },
        new("KineticResistance", ModuleStat.KineticResistance)
        {
            Scale = Percent,
            MultiplierBase = -Percent,
        },

        // The journal spells thermal resistance "Thermic", the one thermal stat that does not
        // read "Thermal".
        new("ThermicResistance", ModuleStat.ThermalResistance)
        {
            Scale = Percent,
            MultiplierBase = -Percent,
        },
        new("ExplosiveResistance", ModuleStat.ExplosiveResistance)
        {
            Scale = Percent,
            MultiplierBase = -Percent,
        },
        new("CausticResistance", ModuleStat.CausticResistance)
        {
            Scale = Percent,
            MultiplierBase = -Percent,
        },
        new("DamageProtection", ModuleStat.ModuleProtection) { Scale = Percent },
        new("ModuleDefenceAbsorption", ModuleStat.ModuleProtection) { Scale = Percent },

        // Weapons.
        new("Damage", ModuleStat.Damage),
        new("Rounds", ModuleStat.RoundsPerShot) { DefaultBase = 1 },
        new("RoundsPerShot", ModuleStat.RoundsPerShot) { DefaultBase = 1 },
        new("RateOfFire", ModuleStat.RateOfFire),
        new("BurstInterval", ModuleStat.BurstInterval),
        new("BurstSize", ModuleStat.BurstRounds) { DefaultBase = 1 },
        new("BurstRateOfFire", ModuleStat.BurstRateOfFire) { DefaultBase = 1 },
        new("AmmoClipSize", ModuleStat.ClipSize),
        new("AmmoMaximum", ModuleStat.AmmoMaximum),
        new("ReloadTime", ModuleStat.ReloadTime),
        new("DistributorDraw", ModuleStat.DistributorDraw),
        new("ThermalLoad", ModuleStat.ThermalLoad),
        new("ArmourPenetration", ModuleStat.ArmourPiercing),

        // Range is a weapon's maximum range and the journal's alternate spelling of a
        // scanner's ScannerRange. A record resolves it to the stat that family carries.
        new("Range", ModuleStat.MaximumRange),
        new("Range", ModuleStat.ScannerRange),
        new("MaximumRange", ModuleStat.MaximumRange),
        new("FalloffRange", ModuleStat.FalloffRange),

        // A journal spells the same stat DamageFalloffRange, where a blueprint recipe says
        // FalloffRange. Both resolve, as ProbeRadius and DSS_PatchRadius do.
        new("DamageFalloffRange", ModuleStat.FalloffRange),
        new("ShotSpeed", ModuleStat.ShotSpeed),

        // Damage-type shares are percentages in a journal and fractions in the catalogue. They
        // live one level below the module record, so a share reader supplies the value the
        // otherwise flat label mapping reads.
        new("$Kinetic;", null)
        {
            Share = distribution => distribution.Kinetic,
            Scale = Percent,
            DefaultBase = 0,
        },
        new("$Thermal;", null)
        {
            Share = distribution => distribution.Thermal,
            Scale = Percent,
            DefaultBase = 0,
        },
        new("$Explosive;", null)
        {
            Share = distribution => distribution.Explosive,
            Scale = Percent,
            DefaultBase = 0,
        },
        new("$Absolute;", null)
        {
            Share = distribution => distribution.Absolute,
            Scale = Percent,
            DefaultBase = 0,
        },

        // A weapon that carries no jitter fires true, and Rapid Fire, its multi-cannon
        // spelling and Inertial Impact all give one, which a journal confirms by reporting an
        // original value of zero for a missile rack whose record holds no such field. An
        // additive leg starts from zero on its own, so the default is what makes the base
        // explicit: a computed modifier then states the original value the game does.
        new("Jitter", ModuleStat.Jitter) { DefaultBase = 0 },
    ];

    /// <summary>
    /// Every entry for a label, in declaration order. Usually one; <c>Range</c> and
    /// <c>ShieldBankHeat</c> have two each, because the modules carrying those stats keep them
    /// in different fields. The first entry answers everything that does not depend on which
    /// module is asked about.
    /// </summary>
    private static readonly Dictionary<string, List<StatLabel>> ByLabel = BuildIndex();

    /// <summary>
    /// Reads a module's stats as base values keyed by journal modifier label, in the journal's
    /// own units.
    /// </summary>
    /// <param name="module">The module to read.</param>
    /// <returns>One entry per label the module carries a base value for.</returns>
    internal static Dictionary<string, double> BaseStats(OutfittingModule module)
    {
        if (module is null) throw new ArgumentNullException(nameof(module));

        // Only a weapon assumes a value for a stat it leaves out.
        bool weapon = module.Stats.Has(ModuleStat.Damage);
        Dictionary<string, double> values = new(StringComparer.Ordinal);
        foreach (StatLabel entry in Labels)
        {
            if (values.ContainsKey(entry.Label)) continue;

            double? value = entry.Share is null
                ? entry.Stat is null ? null : module.Stats[entry.Stat.Value]
                : module.DamageDistribution is null ? null : entry.Share(module.DamageDistribution);
            if (value.HasValue) values[entry.Label] = value.Value * entry.Scale;
            else if (entry.DefaultBase.HasValue && weapon) values[entry.Label] = entry.DefaultBase.Value;
        }

        return values;
    }

    /// <summary>The module stat a journal modifier label writes back to.</summary>
    /// <param name="label">The journal modifier label.</param>
    /// <param name="stats">
    /// The stats the label is resolved against, when there are any. A label that maps to two
    /// stats, <c>Range</c> or <c>ShieldBankHeat</c>, answers with whichever of them the module
    /// carries; without a module it answers with the first.
    /// </param>
    /// <returns>
    /// The stat, or <see langword="null"/> when the label names a damage share, grants a
    /// capability, or is unknown.
    /// </returns>
    internal static ModuleStat? StatFor(string label, ModuleStats? stats)
    {
        if (!ByLabel.TryGetValue(label, out List<StatLabel>? entries)) return null;
        if (stats is not null && entries.Count > 1)
        {
            foreach (StatLabel entry in entries)
            {
                if (entry.Stat is not null && stats.Has(entry.Stat.Value)) return entry.Stat;
            }
        }

        return entries[0].Stat;
    }

    /// <summary>The journal value divided by the catalogue value for one label.</summary>
    /// <param name="label">The journal modifier label.</param>
    /// <returns>
    /// One hundred for the stats a journal reports as a percentage while the catalogue stores a
    /// fraction, and one for every other label, an unknown one included.
    /// </returns>
    internal static double ScaleFor(string label) => First(label)?.Scale ?? 1;

    /// <summary>The multiplier base a label compounds through.</summary>
    /// <param name="label">The journal modifier label.</param>
    /// <returns>
    /// The base the game divides by before compounding, or <see langword="null"/> for the
    /// ordinary stats that scale directly.
    /// </returns>
    /// <remarks>
    /// These stats do not scale like an ordinary number. A bulkhead's eighty percent hull boost
    /// engineered by a thirty-two percent blueprint becomes 137.6 percent, not 105.6, because
    /// the multiplier 1.8 is what gets multiplied by 1.32. A resistance works the same way on
    /// its damage multiplier, so its base is negative.
    /// </remarks>
    internal static double? MultiplierBaseFor(string label) => First(label)?.MultiplierBase;

    /// <summary>The string a capability-granting label writes to a journal modifier.</summary>
    /// <param name="label">The journal modifier label.</param>
    /// <returns>The written string, or <see langword="null"/> for a numeric stat.</returns>
    /// <remarks>
    /// Anti-Guardian Zone Resistance is a flag with no unit and no magnitude, so its displayed
    /// percentage is not treated as arithmetic.
    /// </remarks>
    internal static string? CapabilityValueFor(string label) => First(label)?.CapabilityValue;

    private static StatLabel? First(string label) =>
        ByLabel.TryGetValue(label, out List<StatLabel>? entries) ? entries[0] : null;

    private static Dictionary<string, List<StatLabel>> BuildIndex()
    {
        Dictionary<string, List<StatLabel>> index = new(StringComparer.Ordinal);
        foreach (StatLabel entry in Labels)
        {
            if (!index.TryGetValue(entry.Label, out List<StatLabel>? entries))
            {
                entries = [];
                index[entry.Label] = entries;
            }

            entries.Add(entry);
        }

        return index;
    }

    /// <summary>One journal modifier label and how it relates to the stat behind it.</summary>
    /// <param name="Label">
    /// The modifier label, such as <c>FSDOptimalMass</c>. These are a journal's own spellings,
    /// except for <c>BurstInterval</c>, which blueprint recipes use for the stat a journal
    /// reports as the resulting rate of fire.
    /// </param>
    /// <param name="Stat">
    /// The module stat holding the base value, or <see langword="null"/> where the label names
    /// a damage share or grants a capability instead.
    /// </param>
    private sealed record StatLabel(string Label, ModuleStat? Stat)
    {
        /// <summary>Reads the damage share the label names, for the labels that name one.</summary>
        internal Func<DamageDistribution, double?>? Share { get; init; }

        /// <summary>The journal value divided by the catalogue value.</summary>
        internal double Scale { get; init; } = 1;

        /// <summary>The base a percentage of a multiplier compounds through.</summary>
        internal double? MultiplierBase { get; init; }

        /// <summary>The value the game assumes when a module carries no such stat.</summary>
        /// <remarks>
        /// A weapon with no rounds per shot fires one round, and one with no burst fires a
        /// single shot per burst. A recipe can modify a defaulted stat, so the default belongs
        /// in the base values a recipe folds.
        /// </remarks>
        internal double? DefaultBase { get; init; }

        /// <summary>The string written to a non-numeric modifier that grants a capability.</summary>
        internal string? CapabilityValue { get; init; }
    }
}
