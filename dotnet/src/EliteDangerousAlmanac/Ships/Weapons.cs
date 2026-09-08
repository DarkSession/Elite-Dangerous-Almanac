using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The weapon stats a firepower calculation needs, all post-engineering.</summary>
/// <remarks>
/// A weapon carries only the stats that apply to it. A stat this record states as nullable is
/// absent where the weapon does not carry it, and the absence carries meaning: no rate of fire
/// marks a continuous-fire weapon, and no clip size marks one that never stops to reload.
/// </remarks>
public sealed record WeaponStats
{
    /// <summary>The damage per round, or per second on a continuous-fire weapon.</summary>
    public double Damage { get; init; }

    /// <summary>How the damage splits by type. An absent split reads as all absolute.</summary>
    public DamageDistribution? DamageDistribution { get; init; }

    /// <summary>The exact damage amounts, which are authoritative for the split where stated.</summary>
    public DamageComponents? DamageComponents { get; init; }

    /// <summary>The rounds fired per shot.</summary>
    public double RoundsPerShot { get; init; } = 1;

    /// <summary>
    /// The shots per second, burst pattern folded in. An absent rate marks a continuous-fire
    /// weapon, whose per-second stats are used as they stand.
    /// </summary>
    public double? RateOfFire { get; init; }

    /// <summary>
    /// The seconds between shots, and between bursts on a burst-fire weapon. Only the combined
    /// rate of fire reads it: the per-second figures work off the rate of fire itself.
    /// </summary>
    public double? BurstInterval { get; init; }

    /// <summary>The shots in one burst.</summary>
    public double? BurstRounds { get; init; }

    /// <summary>The shots per second within a burst.</summary>
    public double? BurstRateOfFire { get; init; }

    /// <summary>
    /// The seconds spent charging before a shot, on a rail gun. Nothing here folds a charge time
    /// into the rate of fire or the damage per second.
    /// </summary>
    public double? ChargeTime { get; init; }

    /// <summary>The rounds in a clip. An absent size marks a weapon that never stops to reload.</summary>
    public double? ClipSize { get; init; }

    /// <summary>
    /// The reserve rounds behind the clip. An absent figure means nothing limits them.
    /// </summary>
    /// <remarks>
    /// No per-second figure reads it, because a reserve says how long a weapon can keep firing
    /// rather than how hard. It is carried so one record answers an ammunition question too.
    /// </remarks>
    public double? AmmoMaximum { get; init; }

    /// <summary>The seconds one clip takes to reload.</summary>
    public double ReloadTime { get; init; }

    /// <summary>
    /// The weapons-capacitor draw per shot, in megawatts, and per second when continuous.
    /// </summary>
    public double DistributorDraw { get; init; }

    /// <summary>The heat per shot, and per second when continuous.</summary>
    public double ThermalLoad { get; init; }

    /// <summary>The power draw, in megawatts, echoed through to the metrics.</summary>
    public double PowerDraw { get; init; }

    /// <summary>The largest range, in metres. An absent range caps nothing.</summary>
    public double? MaximumRange { get; init; }

    /// <summary>
    /// The range at which damage starts to drop off, in metres. An absent range means full damage
    /// through the largest range, and none beyond it.
    /// </summary>
    public double? FalloffRange { get; init; }

    /// <summary>
    /// The projectile boundary parameters, which are not effective distances. A falloff
    /// calculation ignores them either way.
    /// </summary>
    public ProjectileRangeBoundaries? ProjectileRange { get; init; }

    /// <summary>The armour piercing rating, against a hull's hardness.</summary>
    public double? ArmourPiercing { get; init; }

    /// <summary>Reads a weapon's stats off a catalogue or fitted module.</summary>
    /// <param name="module">The module, post-engineering.</param>
    /// <returns>The stats the module carries.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="module"/> is <see langword="null"/>.</exception>
    public static WeaponStats FromModule(OutfittingModule module)
    {
        if (module is null) throw new ArgumentNullException(nameof(module));

        ModuleStats stats = module.Stats;
        return new WeaponStats
        {
            Damage = stats[ModuleStat.Damage] ?? 0,
            DamageDistribution = module.DamageDistribution,
            DamageComponents = module.DamageComponents,
            RoundsPerShot = stats[ModuleStat.RoundsPerShot] ?? 1,
            RateOfFire = stats[ModuleStat.RateOfFire],
            BurstInterval = stats[ModuleStat.BurstInterval],
            BurstRounds = stats[ModuleStat.BurstRounds],
            BurstRateOfFire = stats[ModuleStat.BurstRateOfFire],
            ChargeTime = stats[ModuleStat.ChargeTime],
            ClipSize = stats[ModuleStat.ClipSize],
            AmmoMaximum = stats[ModuleStat.AmmoMaximum],
            ReloadTime = stats[ModuleStat.ReloadTime] ?? 0,
            DistributorDraw = stats[ModuleStat.DistributorDraw] ?? 0,
            ThermalLoad = stats[ModuleStat.ThermalLoad] ?? 0,
            PowerDraw = stats[ModuleStat.PowerDraw] ?? 0,
            MaximumRange = stats[ModuleStat.MaximumRange],
            FalloffRange = stats[ModuleStat.FalloffRange],
            ProjectileRange = module.ProjectileRange,
            ArmourPiercing = stats[ModuleStat.ArmourPiercing],
        };
    }
}

/// <summary>
/// Damage split across the established, unclassified and anti-xeno types, in the same unit as the
/// figure it splits.
/// </summary>
/// <param name="Kinetic">The kinetic share.</param>
/// <param name="Thermal">The thermal share.</param>
/// <param name="Explosive">The explosive share.</param>
/// <param name="Absolute">The absolute share, which no resistance reduces.</param>
/// <param name="AntiXeno">
/// The part effective against Thargoids. It overlays conventional damage rather than partitioning
/// it, so it is not part of the conventional total.
/// </param>
/// <param name="Unclassified">The damage in-game verification does not classify.</param>
public sealed record DamageSplit(
    double Kinetic = 0,
    double Thermal = 0,
    double Explosive = 0,
    double Absolute = 0,
    double AntiXeno = 0,
    double Unclassified = 0);

/// <summary>What one weapon does per second, sustained and unsustained.</summary>
/// <param name="DamagePerShot">The damage of one shot: the damage per round times the rounds.</param>
/// <param name="RateOfFire">
/// The shots per second. It is one on a continuous-fire weapon, whose stats are already per second.
/// </param>
/// <param name="SustainedRateOfFire">
/// The shots per second averaged over reloads. It equals the rate of fire where nothing reloads.
/// </param>
/// <param name="DamagePerSecond">The damage per second while firing, reloads ignored.</param>
/// <param name="SustainedDamagePerSecond">
/// The damage per second averaged over reloads, which is the figure a long fight sees.
/// </param>
/// <param name="EnergyPerSecond">The weapons-capacitor draw per second, reloads ignored.</param>
/// <param name="SustainedEnergyPerSecond">The same averaged over reloads.</param>
/// <param name="HeatPerSecond">The heat per second while firing, reloads ignored.</param>
/// <param name="SustainedHeatPerSecond">The same averaged over reloads.</param>
/// <param name="ThermalLoad">
/// The module's thermal-load stat: per discharge for a discrete weapon, and already per second for
/// a continuous beam or mining laser.
/// </param>
/// <param name="PowerDraw">The power draw, which is what the weapon asks of the plant when deployed.</param>
/// <param name="DamageByType">The damage per second split by damage type.</param>
/// <param name="SustainedDamageByType">The sustained damage per second split by damage type.</param>
/// <param name="Continuous">Whether the weapon fires continuously, as a beam or mining laser does.</param>
public sealed record WeaponMetrics(
    double DamagePerShot,
    double RateOfFire,
    double SustainedRateOfFire,
    double DamagePerSecond,
    double SustainedDamagePerSecond,
    double EnergyPerSecond,
    double SustainedEnergyPerSecond,
    double HeatPerSecond,
    double SustainedHeatPerSecond,
    double ThermalLoad,
    double PowerDraw,
    DamageSplit DamageByType,
    DamageSplit SustainedDamageByType,
    bool Continuous);

/// <summary>The additive firepower totals across several weapons.</summary>
/// <param name="DamagePerSecond">The damage per second while firing, summed across the weapons.</param>
/// <param name="SustainedDamagePerSecond">The same averaged over reloads.</param>
/// <param name="EnergyPerSecond">The weapons-capacitor draw per second, summed across the weapons.</param>
/// <param name="SustainedEnergyPerSecond">The same averaged over reloads.</param>
/// <param name="HeatPerSecond">The heat per second while firing, summed across the weapons.</param>
/// <param name="SustainedHeatPerSecond">The same averaged over reloads.</param>
/// <param name="ThermalLoad">
/// The sum of the modules' thermal-load stats: one discharge from each discrete weapon, plus each
/// continuous weapon's already-per-second figure.
/// </param>
/// <param name="PowerDraw">The deployed power draw, summed across the weapons.</param>
/// <param name="DamageByType">The damage per second split by damage type.</param>
/// <param name="SustainedDamageByType">The sustained damage per second split by damage type.</param>
/// <remarks>
/// The damage per shot, the rate of fire and the continuous-fire state belong to one weapon and so
/// do not appear here. Adding a beam laser's cadence to a multi-cannon's describes neither weapon
/// nor the build.
/// </remarks>
public sealed record WeaponTotals(
    double DamagePerSecond,
    double SustainedDamagePerSecond,
    double EnergyPerSecond,
    double SustainedEnergyPerSecond,
    double HeatPerSecond,
    double SustainedHeatPerSecond,
    double ThermalLoad,
    double PowerDraw,
    DamageSplit DamageByType,
    DamageSplit SustainedDamageByType);

/// <summary>
/// Damage per second, capacitor draw per second, heat per second, and how the damage splits by
/// type.
/// </summary>
/// <remarks>
/// <para>
/// A weapon's catalogue record gives damage per round. Turning that into damage per second means
/// folding in the rounds per shot and the rate of fire, and, for the sustained figures, the clip
/// and the reload, because a weapon that stops to reload is not firing.
/// </para>
/// <para>
/// Beam and mining lasers are continuous. They carry no rate of fire, and their damage, draw and
/// thermal load are already per second, so the per-second figures collapse to the raw stats.
/// </para>
/// <para>
/// Reference implementation: EDCD/Coriolis, <c>src/app/shipyard/Module.js</c>, cross-checked
/// against EDSY. The algorithm is ported as fact rather than as code. See <c>ATTRIBUTIONS.md</c>
/// for credit and licence terms.
/// </para>
/// </remarks>
public static class Weapons
{
    /// <summary>Splits a per-second or per-shot damage figure by damage type.</summary>
    /// <param name="damage">The figure to split.</param>
    /// <param name="distribution">
    /// The weapon's damage distribution. An absent one treats the whole figure as absolute damage,
    /// which no resistance reduces.
    /// </param>
    /// <returns>
    /// The share of the damage in each type. The anti-xeno share overlays conventional damage
    /// rather than partitioning it, and the other shares sum back to the figure.
    /// </returns>
    public static DamageSplit SplitDamage(double damage, DamageDistribution? distribution)
    {
        if (distribution is null) return new DamageSplit(Absolute: damage);

        return new DamageSplit(
            Kinetic: damage * (distribution.Kinetic ?? 0),
            Thermal: damage * (distribution.Thermal ?? 0),
            Explosive: damage * (distribution.Explosive ?? 0),
            Absolute: damage * (distribution.Absolute ?? 0),
            AntiXeno: damage * (distribution.AntiXeno ?? 0),
            Unclassified: damage * (distribution.Unclassified ?? 0));
    }

    /// <summary>
    /// The combined rate of fire a weapon's firing cycle implies, which is the journal's own rate
    /// rebuilt from its parts.
    /// </summary>
    /// <param name="weapon">The weapon's stats, post-engineering.</param>
    /// <returns>
    /// The shots per second, or <see langword="null"/> for a continuous-fire weapon, or for a
    /// cycle that does not resolve to a time above zero.
    /// </returns>
    /// <remarks>
    /// <para>
    /// A cycle fires its burst rounds a burst rate apart, then waits out the burst interval before
    /// the next one. A charge time is the delay before a shot lands, and not part of the cadence
    /// Frontier reports.
    /// </para>
    /// <para>
    /// The cycle is rebuilt the way the game builds it, a float stored after every operation and
    /// then written to six decimal places, so the answer is the figure the game reports rather than
    /// one a little beside it. Use it for parts changed by hand: a recipe that gives a weapon a
    /// two-round burst changes the rate of fire without naming it. A weapon read from a build
    /// needs no recomputation, because its rate is already this figure.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static double? CombinedRateOfFire(WeaponStats weapon)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));

        // An unstated burst rate falls back to one shot a second, as both reference
        // implementations do, and as the sustained factor below does, so the two never disagree
        // about the same weapon.
        return EngineeringPrecision.JournalRateOfFire(
            weapon.BurstInterval, weapon.BurstRounds, weapon.BurstRateOfFire);
    }

    /// <summary>
    /// The factor that turns a weapon's while-firing figures into sustained ones: the share of the
    /// time it spends shooting rather than reloading.
    /// </summary>
    /// <param name="weapon">The weapon's stats.</param>
    /// <returns>
    /// A factor above zero and at most one. It is one for anything that never stops to reload, and
    /// less for a weapon whose clip runs dry.
    /// </returns>
    /// <remarks>
    /// A clip's worth of fire takes the rounds after the first burst at the rate of fire, plus the
    /// time to finish the last burst, and then the reload. The sustained rate is the clip divided
    /// by that whole cycle. A part clip is held to whole rounds, rounding up, which only a
    /// hand-built or journal-stated figure can be: an engineered clip is rounded to a whole burst
    /// where the roll is computed.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static double SustainedFireFactor(WeaponStats weapon)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));

        if (weapon.RateOfFire is not double rateOfFire || rateOfFire == 0) return 1;
        if (weapon.ClipSize is not double stated) return 1;

        double clip = Math.Ceiling(stated);
        if (clip <= 0) return 1;

        double burst = weapon.BurstRounds > 0 ? weapon.BurstRounds.Value : 1;
        double burstRate = weapon.BurstRateOfFire > 0 ? weapon.BurstRateOfFire.Value : 1;
        // The time between bursts within the clip, the trailing burst itself, then the reload.
        double cycle = ((clip - burst) / rateOfFire) + ((burst - 1) / burstRate) + weapon.ReloadTime;
        if (cycle <= 0) return 1;

        return Math.Min(1, clip / cycle / rateOfFire);
    }

    /// <summary>The damage per second while the trigger is held, reloads ignored.</summary>
    /// <param name="weapon">The weapon's stats.</param>
    /// <returns>
    /// The damage per second. A continuous-fire weapon reports its damage unchanged, because that
    /// stat is already per second.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static double DamagePerSecond(WeaponStats weapon)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));

        return weapon.Damage * RoundsOf(weapon) * (weapon.RateOfFire ?? 1);
    }

    /// <summary>The damage per second averaged over reloads, which a long engagement sees.</summary>
    /// <param name="weapon">The weapon's stats.</param>
    /// <returns>The sustained damage per second.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static double SustainedDamagePerSecond(WeaponStats weapon) =>
        DamagePerSecond(weapon) * SustainedFireFactor(weapon);

    /// <summary>The weapons-capacitor draw per second, in megawatts.</summary>
    /// <param name="weapon">The weapon's stats.</param>
    /// <returns>
    /// The capacitor draw per second, reloads ignored. For firing endurance, use
    /// <see cref="WeaponsCapacitor.Metrics"/>, which compares the pip-scaled recharge with the
    /// sustained draw rather than this burst rate.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static double EnergyPerSecond(WeaponStats weapon)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));

        return weapon.DistributorDraw * (weapon.RateOfFire ?? 1);
    }

    /// <summary>The heat generated per second.</summary>
    /// <param name="weapon">The weapon's stats.</param>
    /// <returns>The heat per second, reloads ignored.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static double HeatPerSecond(WeaponStats weapon)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));

        return weapon.ThermalLoad * (weapon.RateOfFire ?? 1);
    }

    /// <summary>How much of a weapon's damage still lands at a given range.</summary>
    /// <param name="weapon">The weapon's stats.</param>
    /// <param name="metres">The range to the target, in metres.</param>
    /// <returns>
    /// A factor from zero through one: the whole of it inside the falloff range, tapering to
    /// nothing at the largest range and staying there beyond it. A weapon with no falloff data
    /// reports the whole of it up to its largest range.
    /// </returns>
    /// <remarks>
    /// The projectile boundary parameters are deliberately ignored: this is attenuation, not
    /// projectile reach.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static double DamageFalloff(WeaponStats weapon, double metres)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));

        if (weapon.MaximumRange is double maximum && metres > maximum) return 0;
        if (weapon.FalloffRange is not double falloff
            || weapon.MaximumRange is not double range
            || metres <= falloff)
        {
            return 1;
        }

        double taper = range - falloff;
        if (taper <= 0) return 1;
        return Math.Max(0, 1 - ((metres - falloff) / taper));
    }

    /// <summary>How much of a weapon's damage a hull's hardness lets through.</summary>
    /// <param name="armourPiercing">The weapon's piercing rating.</param>
    /// <param name="hardness">
    /// The target hull's hardness. No hardness disables the scaling, which is what to pass where
    /// the hardness is unknown.
    /// </param>
    /// <returns>
    /// A factor from zero through one: the whole of it where the weapon out-pierces the hull, and
    /// the piercing over the hardness otherwise. No hardness always answers the whole of it,
    /// because it disables the scaling.
    /// </returns>
    /// <remarks>This applies to hull damage alone. Shields do not care.</remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An argument is not a finite number of zero or more.
    /// </exception>
    public static double ArmourPiercingFactor(double armourPiercing, double hardness)
    {
        RangeGuards.RequireFiniteNonNegative(armourPiercing, nameof(armourPiercing));
        RangeGuards.RequireFiniteNonNegative(hardness, nameof(hardness));
        if (hardness == 0) return 1;
        return Math.Min(1, armourPiercing / hardness);
    }

    /// <summary>
    /// Everything an outfitting screen shows about one weapon: the damage per second, the
    /// sustained damage per second, the capacitor and heat cost of firing it, and the damage split
    /// by type.
    /// </summary>
    /// <param name="weapon">The weapon's stats, post-engineering.</param>
    /// <returns>The weapon's metrics.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static WeaponMetrics Metrics(WeaponStats weapon)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));

        bool continuous = weapon.RateOfFire is null;
        double rateOfFire = weapon.RateOfFire ?? 1;
        double factor = SustainedFireFactor(weapon);
        double damagePerSecond = DamagePerSecond(weapon);
        double sustainedDamage = damagePerSecond * factor;
        double energyPerSecond = EnergyPerSecond(weapon);
        double heatPerSecond = HeatPerSecond(weapon);

        return new WeaponMetrics(
            DamagePerShot: weapon.Damage * RoundsOf(weapon),
            RateOfFire: rateOfFire,
            SustainedRateOfFire: rateOfFire * factor,
            DamagePerSecond: damagePerSecond,
            SustainedDamagePerSecond: sustainedDamage,
            EnergyPerSecond: energyPerSecond,
            SustainedEnergyPerSecond: energyPerSecond * factor,
            HeatPerSecond: heatPerSecond,
            SustainedHeatPerSecond: heatPerSecond * factor,
            ThermalLoad: weapon.ThermalLoad,
            PowerDraw: weapon.PowerDraw,
            DamageByType: Split(damagePerSecond, weapon),
            SustainedDamageByType: Split(sustainedDamage, weapon),
            Continuous: continuous);
    }

    /// <summary>Adds several weapons' metrics together, for a build's total firepower.</summary>
    /// <param name="metrics">The per-weapon metrics to sum.</param>
    /// <returns>The additive totals. An empty list answers no firepower at all.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="metrics"/> is <see langword="null"/>.</exception>
    public static WeaponTotals Sum(IReadOnlyList<WeaponMetrics> metrics)
    {
        if (metrics is null) throw new ArgumentNullException(nameof(metrics));

        double damagePerSecond = 0;
        double sustainedDamagePerSecond = 0;
        double energyPerSecond = 0;
        double sustainedEnergyPerSecond = 0;
        double heatPerSecond = 0;
        double sustainedHeatPerSecond = 0;
        double thermalLoad = 0;
        double powerDraw = 0;
        var damageByType = new DamageSplitTotal();
        var sustainedDamageByType = new DamageSplitTotal();

        foreach (WeaponMetrics metric in metrics)
        {
            if (metric is null) throw new ArgumentNullException(nameof(metrics));

            damagePerSecond += metric.DamagePerSecond;
            sustainedDamagePerSecond += metric.SustainedDamagePerSecond;
            energyPerSecond += metric.EnergyPerSecond;
            sustainedEnergyPerSecond += metric.SustainedEnergyPerSecond;
            heatPerSecond += metric.HeatPerSecond;
            sustainedHeatPerSecond += metric.SustainedHeatPerSecond;
            thermalLoad += metric.ThermalLoad;
            powerDraw += metric.PowerDraw;
            damageByType.Add(metric.DamageByType);
            sustainedDamageByType.Add(metric.SustainedDamageByType);
        }

        return new WeaponTotals(
            DamagePerSecond: damagePerSecond,
            SustainedDamagePerSecond: sustainedDamagePerSecond,
            EnergyPerSecond: energyPerSecond,
            SustainedEnergyPerSecond: sustainedEnergyPerSecond,
            HeatPerSecond: heatPerSecond,
            SustainedHeatPerSecond: sustainedHeatPerSecond,
            ThermalLoad: thermalLoad,
            PowerDraw: powerDraw,
            DamageByType: damageByType.Finish(),
            SustainedDamageByType: sustainedDamageByType.Finish());
    }

    /// <summary>The rounds one shot fires, holding an unstated or impossible count to one.</summary>
    private static double RoundsOf(WeaponStats weapon) =>
        weapon.RoundsPerShot > 0 ? weapon.RoundsPerShot : 1;

    /// <summary>The split of one figure, the exact amounts taking precedence over the fractions.</summary>
    private static DamageSplit Split(double damage, WeaponStats weapon) =>
        weapon.DamageComponents is null
            ? SplitDamage(damage, weapon.DamageDistribution)
            : SplitComponents(damage, weapon.DamageComponents);

    /// <summary>The split of one figure over exact damage amounts, scaled to that figure.</summary>
    private static DamageSplit SplitComponents(double damage, DamageComponents components)
    {
        double unclassified = 0;
        foreach (double value in components.Unclassified ?? []) unclassified += value;

        double conventional = (components.Kinetic ?? 0)
            + (components.Thermal ?? 0)
            + (components.Explosive ?? 0)
            + (components.Absolute ?? 0)
            + unclassified;
        if (conventional <= 0) return new DamageSplit(Absolute: damage);

        double scale = damage / conventional;
        return new DamageSplit(
            Kinetic: (components.Kinetic ?? 0) * scale,
            Thermal: (components.Thermal ?? 0) * scale,
            Explosive: (components.Explosive ?? 0) * scale,
            Absolute: (components.Absolute ?? 0) * scale,
            AntiXeno: (components.AntiXeno ?? 0) * scale,
            Unclassified: unclassified * scale);
    }

    /// <summary>A running total of one damage split.</summary>
    private sealed class DamageSplitTotal
    {
        private double kinetic;
        private double thermal;
        private double explosive;
        private double absolute;
        private double antiXeno;
        private double unclassified;

        internal void Add(DamageSplit split)
        {
            kinetic += split.Kinetic;
            thermal += split.Thermal;
            explosive += split.Explosive;
            absolute += split.Absolute;
            antiXeno += split.AntiXeno;
            unclassified += split.Unclassified;
        }

        internal DamageSplit Finish() =>
            new(kinetic, thermal, explosive, absolute, antiXeno, unclassified);
    }
}
