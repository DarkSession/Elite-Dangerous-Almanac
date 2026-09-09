using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>
/// Reads a fitted build into the inputs the data-free build calculations take.
/// </summary>
/// <remarks>
/// Everything here resolves a module's effective stat: the journal modifier the build carries
/// for it where engineering has moved it, and the catalogue's base value otherwise.
/// </remarks>
internal static partial class LoadoutMetrics
{
    /// <summary>Symbol prefixes that identify a module group, lower-cased.</summary>
    /// <remarks>
    /// Classifying by symbol is the weaker way to do this. A core module is first identified
    /// from the mount it sits in, and then from its catalogue record's own mount. A prefix is
    /// the fallback for a hand-built module mounted outside a known hull layout. An optional
    /// family has nothing better to read: a shield generator, a booster or a reinforcement
    /// package fits any mount of its kind that is large enough, so it fills no one mount and its
    /// record names none.
    /// </remarks>
    private static readonly string[] PowerPlantPrefixes = ["int_powerplant", "int_guardianpowerplant"];

    private static readonly string[] ThrusterPrefixes = ["int_engine", "int_mkiiagileboost_engine"];

    private static readonly string[] FrameShiftDrivePrefixes = ["int_hyperdrive"];

    private static readonly string[] PowerDistributorPrefixes =
        ["int_powerdistributor", "int_guardianpowerdistributor"];

    private static readonly string[] ShieldGeneratorPrefixes = ["int_shieldgenerator"];

    private static readonly string[] ShieldCellBankPrefixes = ["int_shieldcellbank"];

    private static readonly string[] ShieldBoosterPrefixes = ["hpt_shieldbooster"];

    private static readonly string[] ShieldReinforcementPrefixes =
        ["int_guardianshieldreinforcement"];

    private static readonly string[] HullReinforcementPrefixes =
    [
        "int_hullreinforcement",
        "int_guardianhullreinforcement",
        "int_metaalloyhullreinforcement",
    ];

    private static readonly string[] ModuleReinforcementPrefixes =
        ["int_modulereinforcement", "int_guardianmodulereinforcement"];

    /// <summary>The labels a firing-rate movement is written under.</summary>
    private static readonly string[] FiringRateLabels =
        ["RateOfFire", "BurstRateOfFire", "BurstSize", "BurstInterval", "RoundsPerShot", "Rounds"];

    /// <summary>The stats a weapon calculation reads straight off the fitted module.</summary>
    private static readonly ModuleStat[] WeaponStatFields =
    [
        ModuleStat.Damage, ModuleStat.RoundsPerShot, ModuleStat.RateOfFire, ModuleStat.BurstInterval,
        ModuleStat.BurstRounds, ModuleStat.BurstRateOfFire, ModuleStat.ChargeTime,
        ModuleStat.ClipSize, ModuleStat.AmmoMaximum, ModuleStat.ReloadTime,
        ModuleStat.DistributorDraw, ModuleStat.ThermalLoad, ModuleStat.PowerDraw,
        ModuleStat.MaximumRange, ModuleStat.FalloffRange, ModuleStat.ArmourPiercing,
    ];

    /// <summary>The speed and rotation refinements a thruster's own curve carries.</summary>
    private static readonly ModuleStat[] ThrusterCurveFields =
    [
        ModuleStat.MinSpeedMultiplier, ModuleStat.OptSpeedMultiplier, ModuleStat.MaxSpeedMultiplier,
        ModuleStat.MinRotationMultiplier, ModuleStat.OptRotationMultiplier,
        ModuleStat.MaxRotationMultiplier,
    ];

    /// <summary>Whether the plant keeps a module running, stowed and with the hardpoints out.</summary>
    private readonly struct RunningStates(bool retracted, bool deployed)
    {
        internal bool Retracted { get; } = retracted;

        internal bool Deployed { get; } = deployed;
    }

    private static bool StartsWithAny(string symbol, string[] prefixes)
    {
        foreach (string prefix in prefixes)
        {
            if (symbol.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    private static bool IsCore(LoadoutModule module, CoreSlotType core)
    {
        ParsedSlot? parsed = BuildSlots.ParseName(module.Slot);
        return parsed?.Kind == SlotKind.Core && parsed.Core == core;
    }

    /// <summary>Whether a fitted module is the power plant.</summary>
    private static bool IsPowerPlant(LoadoutModule module, OutfittingModule? stats) =>
        IsCore(module, CoreSlotType.PowerPlant)
        || (stats?.Slot is ModuleSlot mount
            ? mount == ModuleSlot.PowerPlant
            : StartsWithAny(module.Item, PowerPlantPrefixes));

    /// <summary>Whether a fitted module is the thrusters.</summary>
    private static bool IsThruster(LoadoutModule module, OutfittingModule? stats) =>
        IsCore(module, CoreSlotType.Thrusters)
        || (stats?.Slot is ModuleSlot mount
            ? mount == ModuleSlot.Thrusters
            : StartsWithAny(module.Item, ThrusterPrefixes));

    /// <summary>Whether a fitted module is the frame shift drive.</summary>
    private static bool IsFrameShiftDrive(LoadoutModule module, OutfittingModule? stats) =>
        IsCore(module, CoreSlotType.FrameShiftDrive)
        || (stats?.Slot is ModuleSlot mount
            ? mount == ModuleSlot.FrameShiftDrive
            : StartsWithAny(module.Item, FrameShiftDrivePrefixes));

    /// <summary>Whether a fitted module is the power distributor.</summary>
    private static bool IsPowerDistributor(LoadoutModule module, OutfittingModule? stats) =>
        stats?.Slot is ModuleSlot mount
            ? mount == ModuleSlot.PowerDistributor
            : StartsWithAny(module.Item, PowerDistributorPrefixes);

    /// <summary>Whether a fitted module is switched on.</summary>
    private static bool IsEnabled(LoadoutModule module) => module.On != false;

    /// <summary>The outfitting-panel priority group of a fitted module, one through five.</summary>
    private static int PriorityOf(LoadoutModule module) => (module.Priority ?? 0) + 1;

    /// <summary>
    /// A fitted module's effective value for one stat: the build's own journal modifier where it
    /// carries one, else the catalogue's base value.
    /// </summary>
    internal static double? EffectiveStat(
        LoadoutModule module,
        ModuleStat stat,
        OutfittingModule? stats) =>
        StatedModifier(module, stat) ?? stats?.Stats[stat];

    /// <summary>
    /// The build's own journal modifier for one stat, in the catalogue's units.
    /// </summary>
    /// <remarks>
    /// A journal modifier comes back in the journal's units, a resistance as forty rather than
    /// four tenths, so each is scaled into the catalogue's before it is returned. A capability
    /// label shares the modifier collection but never represents a number, even where an
    /// importer writes the panel's displayed figure as one, so it is skipped.
    /// </remarks>
    private static double? StatedModifier(LoadoutModule module, ModuleStat stat)
    {
        foreach (string label in ModuleStatLabels.LabelsForStat(stat))
        {
            if (ModuleStatLabels.CapabilityValueFor(label) is not null) continue;
            if (Slef.FindModifier(module, label) is double stated)
            {
                return stated / ModuleStatLabels.ScaleFor(label);
            }
        }

        return null;
    }

    /// <summary>Whether the build states a capability-granting modifier for a stat's label.</summary>
    private static bool StatesCapability(LoadoutModule module, string label)
    {
        if (module.Engineering?.Modifiers is not IReadOnlyList<EngineeringModifier> modifiers)
        {
            return false;
        }

        foreach (EngineeringModifier modifier in modifiers)
        {
            if (string.Equals(modifier.Label, label, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    /// <summary>A fitted weapon's damage split after an effect or journal modifiers convert it.</summary>
    private static DamageDistribution? EffectiveDamageDistribution(
        LoadoutModule module,
        OutfittingModule stats)
    {
        DamageDistribution? fromEffect = module.Engineering?.ExperimentalEffect is string symbol
            ? ExperimentalEffectCatalogue.Find(symbol)?.DamageDistribution
            : null;
        DamageDistribution? distribution = fromEffect ?? stats.DamageDistribution;
        bool resolved = distribution is not null;

        HashSet<DamageShare> seen = [];
        foreach (EngineeringModifier modifier in module.Engineering?.Modifiers ?? [])
        {
            if (ModuleStatLabels.ShareFor(modifier.Label) is not DamageShare share) continue;
            if (!seen.Add(share)) continue;
            if (modifier.Value is not double value) continue;

            double scaled = value / ModuleStatLabels.ScaleFor(modifier.Label);
            distribution = WithShare(distribution ?? new DamageDistribution(), share, scaled);
            resolved = true;
        }

        return resolved ? distribution : null;
    }

    private static DamageDistribution WithShare(
        DamageDistribution distribution,
        DamageShare share,
        double value) => share switch
        {
            DamageShare.Kinetic => distribution with { Kinetic = value },
            DamageShare.Thermal => distribution with { Thermal = value },
            DamageShare.Explosive => distribution with { Explosive = value },
            _ => distribution with { Absolute = value },
        };

    /// <summary>Whether engineering replaces exact base components with a converted split.</summary>
    private static bool ConvertsDamage(LoadoutModule module)
    {
        if (module.Engineering?.ExperimentalEffect is string symbol
            && ExperimentalEffectCatalogue.Find(symbol)?.DamageDistribution is not null)
        {
            return true;
        }

        foreach (EngineeringModifier modifier in module.Engineering?.Modifiers ?? [])
        {
            if (ModuleStatLabels.ShareFor(modifier.Label) is not null) return true;
        }

        return false;
    }

    /// <summary>
    /// How far engineering has moved one stat, as a ratio of its base value. It is one where
    /// the build carries no modifier for it, or the catalogue has no base to compare with.
    /// </summary>
    private static double ModifierRatio(
        LoadoutModule module,
        OutfittingModule stats,
        ModuleStat stat)
    {
        if (stats.Stats[stat] is not double baseValue || baseValue == 0) return 1;
        return EffectiveStat(module, stat, stats) is double effective ? effective / baseValue : 1;
    }

    /// <summary>A stat the game moves in step with another.</summary>
    /// <remarks>
    /// A thruster's and a shield generator's minimum and maximum mass follow the optimal mass,
    /// and a generator's minimum and maximum strength follow the optimal strength. A blueprint
    /// names the optimal figure alone, so without this an engineered performance curve would be
    /// built from a moved optimum and stock endpoints. An explicit modifier for the stat itself
    /// still wins.
    /// </remarks>
    private static double? RelatedStat(
        LoadoutModule module,
        OutfittingModule stats,
        ModuleStat stat,
        double ratio)
    {
        if (StatedModifier(module, stat) is double stated) return stated;
        return stats.Stats[stat] is double baseValue ? baseValue * ratio : null;
    }

    /// <summary>Whether a record carries the endpoints of a mass curve.</summary>
    private static bool CarriesMassCurve(OutfittingModule stats) =>
        stats.Stats.Has(ModuleStat.MinMass)
        || stats.Stats.Has(ModuleStat.MaxMass)
        || stats.Stats.Has(ModuleStat.MinMultiplier)
        || stats.Stats.Has(ModuleStat.MaxMultiplier);

    /// <summary>The ratio a curve's maximum mass follows.</summary>
    /// <remarks>
    /// A thruster's follows its optimum in both directions. A generator's only rises: lightening
    /// a generator leaves the heaviest hull it can still cover where it was.
    /// </remarks>
    private static double MaxMassRatio(bool thrusters, double ratio) =>
        thrusters ? ratio : Math.Max(1, ratio);

    /// <summary>
    /// A fitted module's catalogue record with every engineered stat folded in: the module as it
    /// actually performs on this build.
    /// </summary>
    internal static OutfittingModule? Effective(LoadoutModule module, OutfittingModule? stats)
    {
        if (stats is null || module.Engineering is null) return stats;

        // Every stat the record carries, plus any the engineering introduces: Double Shot gives
        // a burst size to a weapon whose catalogue record has none.
        HashSet<ModuleStat> fields = [.. stats.Stats.Keys];
        foreach (EngineeringModifier modifier in module.Engineering.Modifiers ?? [])
        {
            if (ModuleStatLabels.StatFor(modifier.Label, stats.Stats) is ModuleStat stat)
            {
                fields.Add(stat);
            }
        }

        ModuleStats merged = stats.Stats;
        foreach (ModuleStat stat in fields)
        {
            if (EffectiveStat(module, stat, stats) is double value) merged = merged.With(stat, value);
        }

        bool guardianZoneResistance = stats.GuardianZoneResistance
            || StatesCapability(module, "GuardianModuleResistance");

        if (CarriesMassCurve(stats))
        {
            // The curve read off the record is the whole moved curve. Which article it belongs
            // to is read off the mount it names rather than off its engineering group: a record
            // assembled without a group is still a curve, and only a thruster names that mount.
            bool thrusters = stats.Slot == ModuleSlot.Thrusters;
            double massRatio = ModifierRatio(module, stats, ModuleStat.OptMass);
            merged = Set(merged, ModuleStat.MinMass,
                RelatedStat(module, stats, ModuleStat.MinMass, massRatio));
            merged = Set(merged, ModuleStat.MaxMass,
                RelatedStat(module, stats, ModuleStat.MaxMass, MaxMassRatio(thrusters, massRatio)));

            double performanceRatio = ModifierRatio(module, stats, ModuleStat.OptMultiplier);
            merged = Set(merged, ModuleStat.MinMultiplier,
                RelatedStat(module, stats, ModuleStat.MinMultiplier, performanceRatio));
            merged = Set(merged, ModuleStat.MaxMultiplier,
                RelatedStat(module, stats, ModuleStat.MaxMultiplier, performanceRatio));

            if (thrusters)
            {
                foreach (ModuleStat stat in ThrusterCurveFields)
                {
                    if (stats.Stats[stat] is double value)
                    {
                        merged = merged.With(stat, value * performanceRatio);
                    }
                }
            }
        }

        DamageDistribution? distribution = EffectiveDamageDistribution(module, stats);
        if (stats.Category == ModuleCategory.Hardpoint) merged = NormalizeWeapon(module, merged);

        DamageComponents? components = stats.DamageComponents;
        if (ConvertsDamage(module))
        {
            // Once engineering converts the components, the fractional split is authoritative.
            components = null;
        }
        else if (components is not null)
        {
            components = DamageComponentScaling.Scale(
                components, stats.Stats[ModuleStat.Damage], merged[ModuleStat.Damage]);
        }

        return stats with
        {
            Stats = merged,
            DamageDistribution = distribution ?? stats.DamageDistribution,
            DamageComponents = components,
            GuardianZoneResistance = guardianZoneResistance,
        };
    }

    private static ModuleStats Set(ModuleStats stats, ModuleStat stat, double? value) =>
        value is double set ? stats.With(stat, set) : stats;

    /// <summary>One fitted module's claim on the power plant.</summary>
    internal static PowerConsumer? PowerConsumerFor(LoadoutModule module, OutfittingModule? stats)
    {
        double? draw = EffectiveStat(module, ModuleStat.PowerDraw, stats);
        if (draw is not double amount || amount == 0) return null;

        // A weapon and most utility fittings only draw while the hardpoints are out; the ones
        // that are always powered — a shield booster, chaff, a heat sink — always draw.
        bool mounted = stats?.Category is ModuleCategory.Hardpoint or ModuleCategory.Utility;
        return new PowerConsumer(amount)
        {
            Priority = PriorityOf(module),
            Enabled = IsEnabled(module),
            DeployedOnly = mounted && stats?.AlwaysPowered != true,
            Label = module.Slot,
            Symbol = module.Item,
        };
    }

    /// <summary>The build's known plant capacity, or nothing where it is absent or switched off.</summary>
    internal static double PowerAvailable(
        IReadOnlyList<LoadoutModule> modules,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = statsFor(module);
            if (!IsPowerPlant(module, stats)) continue;
            if (!IsEnabled(module)) return 0;
            return EffectiveStat(module, ModuleStat.PowerCapacity, stats) ?? 0;
        }

        return 0;
    }

    /// <summary>Whether the plant keeps a module running, stowed and with the hardpoints out.</summary>
    /// <remarks>A module that asks for no power depends on no group and always runs.</remarks>
    private static RunningStates PoweredStates(
        LoadoutModule module,
        OutfittingModule? stats,
        PowerBudget budget)
    {
        double? draw = EffectiveStat(module, ModuleStat.PowerDraw, stats);
        if (draw is not double amount || amount == 0) return new RunningStates(true, true);
        if (budget.Bands.Count == 0) return new RunningStates(true, true);

        int index = Math.Min(budget.Bands.Count, Math.Max(1, PriorityOf(module))) - 1;
        PowerBand band = budget.Bands[index];
        return new RunningStates(band.PoweredRetracted, band.PoweredDeployed);
    }

    /// <summary>What the plant actually feeds: the groups it keeps lit, and nothing below.</summary>
    private static double PoweredDraw(PowerBudget budget, bool retracted)
    {
        double total = 0;
        foreach (PowerBand band in budget.Bands)
        {
            if (retracted ? band.PoweredRetracted : band.PoweredDeployed)
            {
                total += retracted ? band.Retracted : band.Deployed;
            }
        }

        return total;
    }

    /// <summary>The four resistances one fitted module carries, post-engineering.</summary>
    /// <remarks>A resistance the module does not carry reads as neither resistance nor weakness.</remarks>
    private static DamageTypeValues ResistancesOf(LoadoutModule module, OutfittingModule? stats) =>
        new(
            Kinetic: EffectiveStat(module, ModuleStat.KineticResistance, stats) ?? 0,
            Thermal: EffectiveStat(module, ModuleStat.ThermalResistance, stats) ?? 0,
            Explosive: EffectiveStat(module, ModuleStat.ExplosiveResistance, stats) ?? 0,
            Caustic: EffectiveStat(module, ModuleStat.CausticResistance, stats) ?? 0);

    /// <summary>A fitted weapon's stats, post-engineering.</summary>
    /// <remarks>
    /// Several values need more than a per-stat read. The rate of fire is derived from the
    /// firing cycle, so a recipe that changes the burst pattern moves it even where the build
    /// carries no rate modifier. The falloff range is held to the weapon's maximum range. Exact
    /// damage components scale by the effective-to-base damage ratio, so ordinary engineering
    /// keeps their proportions, while a converting effect replaces them with its own split. The
    /// per-round damage is read from the block's derived damage per second only where nothing
    /// else in the block carries it.
    /// </remarks>
    internal static WeaponStats? WeaponStatsFor(LoadoutModule module, OutfittingModule? stats)
    {
        if (stats is null || stats.Category != ModuleCategory.Hardpoint) return null;

        ModuleStats weapon = ModuleStats.Empty;
        foreach (ModuleStat stat in WeaponStatFields)
        {
            if (EffectiveStat(module, stat, stats) is double value) weapon = weapon.With(stat, value);
        }

        weapon = NormalizeWeapon(module, weapon);

        DamageComponents? components = stats.DamageComponents is null || ConvertsDamage(module)
            ? null
            : DamageComponentScaling.Scale(
                stats.DamageComponents, stats.Stats[ModuleStat.Damage], weapon[ModuleStat.Damage]);

        OutfittingModule shaped = stats with
        {
            Stats = weapon,
            DamageDistribution = EffectiveDamageDistribution(module, stats) ?? stats.DamageDistribution,
            DamageComponents = components,
        };
        return WeaponStats.FromModule(shaped);
    }

    /// <summary>The derived rules every post-engineering view of a fitted weapon shares.</summary>
    /// <remarks>
    /// A block can carry the damage only as the derived damage per second, burst engineering can
    /// change the effective firing cycle without stating a new rate, and short-range engineering
    /// can leave the stock falloff beyond the reduced maximum range. Keeping the three
    /// corrections together stops a fitted module and its metrics describing different weapons.
    /// </remarks>
    private static ModuleStats NormalizeWeapon(LoadoutModule module, ModuleStats weapon)
    {
        if (BurstAdjustedRateOfFire(module, weapon) is double rate)
        {
            weapon = weapon.With(ModuleStat.RateOfFire, rate);
        }

        if (ReadsDamageFromPerSecond(module)
            && Slef.FindModifier(module, "DamagePerSecond") is double perSecond)
        {
            double factor = (weapon[ModuleStat.RoundsPerShot] ?? 1) * (weapon[ModuleStat.RateOfFire] ?? 1);
            if (factor > 0) weapon = weapon.With(ModuleStat.Damage, perSecond / factor);
        }

        if (weapon[ModuleStat.MaximumRange] is double maximum
            && weapon[ModuleStat.FalloffRange] is double falloff
            && falloff > maximum)
        {
            weapon = weapon.With(ModuleStat.FalloffRange, maximum);
        }

        return weapon;
    }

    /// <summary>
    /// The rate of fire once an engineered burst pattern is taken into account.
    /// </summary>
    /// <remarks>
    /// An explicit rate modifier is the game's own answer and wins outright. Failing that, where
    /// the build has engineered the burst size, the within-burst rate or the interval, the cycle
    /// is rebuilt from those parts, the way the game's own derivation does it. That is not a
    /// flourish: the same parts produce the rate this module publishes in its modifiers, so
    /// deriving them differently here would resolve a rate the block beside it does not state.
    /// </remarks>
    private static double? BurstAdjustedRateOfFire(LoadoutModule module, ModuleStats weapon)
    {
        if (Slef.FindModifier(module, "RateOfFire") is not null) return null;

        bool touched = false;
        foreach (string label in EngineeringPrecision.BurstPatternLabels)
        {
            if (Slef.FindModifier(module, label) is not null) touched = true;
        }

        if (!touched) return null;

        IReadOnlyList<EngineeringModifier> modifiers = module.Engineering?.Modifiers ?? [];
        double? Stated(string label, ModuleStat stat) =>
            EngineeringPrecision.PreciseValueFor(modifiers, label) ?? weapon[stat];

        return EngineeringPrecision.JournalRateOfFire(
            Stated("BurstInterval", ModuleStat.BurstInterval),
            Stated("BurstSize", ModuleStat.BurstRounds),
            Stated("BurstRateOfFire", ModuleStat.BurstRateOfFire));
    }

    /// <summary>
    /// Whether the damage per second is the only figure in a block that can carry the per-round
    /// damage.
    /// </summary>
    /// <remarks>
    /// It is not, wherever the block states the damage itself: that is the published figure, and
    /// dividing its companion per-second value back out only re-derives it through two more
    /// float steps, landing a little beside it. Nor is it wherever the block states a firing
    /// rate, a burst pattern or a round count instead, because that movement is what the
    /// per-second figure reports and the damage behind it did not move. What is left is a
    /// continuous weapon, whose per-second figure is its damage stat, and a partial capture that
    /// states the per-second figure and nothing that would account for it.
    /// </remarks>
    private static bool ReadsDamageFromPerSecond(LoadoutModule module)
    {
        if (Slef.FindModifier(module, "Damage") is not null) return false;
        foreach (string label in FiringRateLabels)
        {
            if (Slef.FindModifier(module, label) is not null) return false;
        }

        return true;
    }
}
