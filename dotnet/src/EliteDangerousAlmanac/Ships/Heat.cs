using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One enabled weapon's contribution to a build's heat.</summary>
/// <param name="HeatPerSecond">
/// The heat per second the weapon generates while firing, in thermal-load units. A weapon's
/// sustained figure is the one to pass, because it folds in the reloads a long engagement spends
/// not firing.
/// </param>
/// <param name="DistributorDraw">
/// The weapons-capacitor draw of one discharge, in megajoules. Read together with the
/// distributor's capacity, it says how much the capacitor's state amplifies the weapon's heat.
/// </param>
public sealed record HeatWeapon(double HeatPerSecond = 0, double DistributorDraw = 0);

/// <summary>Everything a heat calculation needs about a build.</summary>
/// <param name="HeatCapacity">
/// The hull's heat capacity: its thermal inertia, in thermal-load units per unit of heat level. It
/// decides how quickly heat moves, and never where it settles. It must be above zero.
/// </param>
/// <param name="HeatDissipation">
/// The hull's largest heat dissipation, in thermal-load units per second. This is the load the
/// build has to stay under to be safe indefinitely.
/// </param>
/// <param name="HeatEfficiency">
/// The fitted power plant's heat efficiency, post-engineering. It has no unit, and lower runs
/// cooler.
/// </param>
public sealed record HeatInput(double HeatCapacity, double HeatDissipation, double HeatEfficiency)
{
    /// <summary>
    /// The power draw, in megawatts, of the modules the plant actually feeds with the hardpoints
    /// stowed. Any priority group the plant cannot carry is already dropped from it.
    /// </summary>
    public double RetractedPowerDraw { get; init; }

    /// <summary>The same with the hardpoints deployed. An absent figure is the retracted draw.</summary>
    public double? DeployedPowerDraw { get; init; }

    /// <summary>
    /// The waste heat the thrusters make per second at top speed, with the hardpoints stowed.
    /// </summary>
    public double ThrusterHeatRate { get; init; }

    /// <summary>The same with the hardpoints deployed. An absent figure is the stowed rate.</summary>
    /// <remarks>
    /// The two differ only on a build whose plant cannot feed everything. Deploying the hardpoints
    /// adds the weapons' draw, which can shed the priority group the thrusters sit in, and
    /// thrusters the plant no longer feeds make no heat.
    /// </remarks>
    public double? DeployedThrusterHeatRate { get; init; }

    /// <summary>The waste heat the frame shift drive makes per second while charging a jump.</summary>
    public double FsdHeatRate { get; init; }

    /// <summary>Every enabled weapon.</summary>
    public IReadOnlyList<HeatWeapon>? Weapons { get; init; }

    /// <summary>
    /// The power distributor's weapons-capacitor capacity, in megajoules, post-engineering. No
    /// capacity reads as a capacitor that can cover nothing, so every weapon then runs at the
    /// drained multiplier in both firing scenarios.
    /// </summary>
    public double WeaponsCapacity { get; init; }
}

/// <summary>A build's heat under one set of circumstances.</summary>
/// <param name="ThermalLoad">The thermal load this scenario generates, per second.</param>
/// <param name="HeatLevel">
/// The heat level this load settles at, or infinity when it settles nowhere because the load goes
/// over the hull's dissipation. These are model units, where one is the level at which dissipation
/// stops rising.
/// </param>
/// <param name="Gauge">
/// The same figure as the ship's heat gauge reads it, where one is the whole gauge and the point
/// at which modules start taking heat damage.
/// </param>
/// <param name="Overheats">
/// Whether heat climbs past the whole gauge, which is so exactly when the load goes over the
/// dissipation.
/// </param>
/// <param name="SecondsToOverheat">
/// The seconds from the moment this scenario starts until the gauge is full, or
/// <see langword="null"/> when it never is.
/// </param>
/// <remarks>
/// The seconds are counted from the heat level the build sits at with this scenario's own
/// contribution removed. Where that starting point is itself a load the hull cannot shed, the
/// count starts from heat level one instead, which is where dissipation stops rising.
/// </remarks>
public sealed record HeatState(
    double ThermalLoad,
    double HeatLevel,
    double Gauge,
    bool Overheats,
    double? SecondsToOverheat);

/// <summary>
/// A build's heat: what the plant and the hull make of each other, and what the build runs at
/// stowed, flying, jumping and firing.
/// </summary>
/// <param name="HeatEfficiency">The fitted plant's heat efficiency, post-engineering.</param>
/// <param name="HullHeatCapacity">The hull's heat capacity, which is its thermal inertia.</param>
/// <param name="HullHeatDissipation">The hull's largest heat dissipation, per second.</param>
/// <param name="Idle">Hardpoints stowed and throttle closed: what a ship sits at doing nothing.</param>
/// <param name="Thrusters">Stowed and flat out: the idle load plus the thrusters at top speed.</param>
/// <param name="FsdCharging">Charging a jump: the flying load plus the drive's spool-up.</param>
/// <param name="FiringSustained">
/// Hardpoints out and every enabled weapon firing continuously, reloads folded in, with the
/// weapons capacitor keeping up.
/// </param>
/// <param name="FiringDrained">
/// The same with the weapons capacitor drained, which is the alpha-strike case, where each weapon
/// makes five times its thermal load.
/// </param>
public sealed record HeatMetrics(
    double HeatEfficiency,
    double HullHeatCapacity,
    double HullHeatDissipation,
    HeatState Idle,
    HeatState Thrusters,
    HeatState FsdCharging,
    HeatState FiringSustained,
    HeatState FiringDrained);

/// <summary>What a build runs at, and whether firing everything cooks it.</summary>
/// <remarks>
/// <para>
/// A ship's heat is a balance. The power plant turns the draw of everything it feeds into waste
/// heat, the thrusters and the frame shift drive add their own, and the weapons add theirs while
/// they fire. The hull sheds heat as it gets hotter, in proportion to the square of its heat
/// level, and stops shedding any more at heat level one.
/// </para>
/// <para>
/// Two consequences follow, and they are what the figures mean. A build whose thermal load stays
/// under the hull's dissipation always settles below heat level one and never overheats, however
/// long it holds the trigger. One whose load goes over it never settles: heat climbs until the
/// ship cooks, and the only question is how long that takes. The heat capacity decides that
/// timing and nothing else. It is thermal inertia, not a budget.
/// </para>
/// <para>
/// Two heat sources stand outside the scenarios reported here, both momentary rather than
/// sustained. A shield cell bank states its heat per activation rather than per second: divide it
/// by the bank's spin-up to get a load these members accept. A heat sink removes heat rather than
/// making it, and every load here is zero or more, so nothing here models a sink. The level a sink
/// drops the ship to is the starting level of whatever comes after it.
/// </para>
/// <para>
/// Reference implementation: EDSY, <c>edsy.js</c>, which cites the Frontier-forum research thread
/// the model was reverse-engineered in. Frontier publishes no heat formula and shows a player no
/// dissipation figure, so both the model and the per-hull dissipation it reads are community
/// measurements of the game rather than stats the game states. See <c>data/ships/SOURCES.md</c>
/// and <c>ATTRIBUTIONS.md</c>.
/// </para>
/// </remarks>
public static class Heat
{
    /// <summary>The heat level the cockpit gauge shows as a full gauge, where a ship starts to cook.</summary>
    /// <remarks>
    /// Heat level one is where the hull's dissipation stops rising, and the gauge reads two thirds
    /// there.
    /// </remarks>
    public const double OverheatHeatLevel = 1.5;

    /// <summary>
    /// How much a weapon's thermal load is multiplied by when the weapons capacitor cannot pay for
    /// the shot.
    /// </summary>
    private const double DrainedCapacitorMultiplier = 5;

    /// <summary>The heat level a thermal load settles at.</summary>
    /// <param name="dissipation">The hull's largest heat dissipation, per second.</param>
    /// <param name="thermalLoad">The load being shed, per second.</param>
    /// <returns>
    /// The settled heat level, in model units. A load above the dissipation answers a level above
    /// one, which the ship never actually reaches as a resting point: it passes through and keeps
    /// climbing.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An argument is not a finite number of zero or more.
    /// </exception>
    public static double EquilibriumLevel(double dissipation, double thermalLoad)
    {
        RangeGuards.RequireFiniteNonNegative(dissipation, nameof(dissipation));
        RangeGuards.RequireFiniteNonNegative(thermalLoad, nameof(thermalLoad));
        if (dissipation == 0) return thermalLoad == 0 ? 0 : double.PositiveInfinity;
        return Math.Sqrt(thermalLoad / dissipation);
    }

    /// <summary>A weapon's thermal load once the weapons capacitor's state is folded in.</summary>
    /// <param name="thermalLoad">The weapon's thermal load, in the game's units.</param>
    /// <param name="distributorDraw">The weapons-capacitor draw of one discharge, in megajoules.</param>
    /// <param name="weaponsCapacity">The distributor's weapons-capacitor capacity, in megajoules.</param>
    /// <param name="capacitorLevel">How full the capacitor is, from empty at zero through full at one.</param>
    /// <returns>The effective thermal load, between the stated load and five times it.</returns>
    /// <remarks>
    /// A shot the capacitor cannot pay for in full generates up to five times its listed thermal
    /// load. This is why a build that never overheats in a duel can cook itself in a wing fight,
    /// firing the same guns on an empty capacitor.
    /// </remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An argument is not a finite number of zero or more, or the capacitor level is above one.
    /// </exception>
    public static double EffectiveWeaponThermalLoad(
        double thermalLoad, double distributorDraw, double weaponsCapacity, double capacitorLevel)
    {
        RangeGuards.RequireFiniteNonNegative(thermalLoad, nameof(thermalLoad));
        RangeGuards.RequireFiniteNonNegative(distributorDraw, nameof(distributorDraw));
        RangeGuards.RequireFiniteNonNegative(weaponsCapacity, nameof(weaponsCapacity));
        RangeGuards.RequireFiniteNonNegative(capacitorLevel, nameof(capacitorLevel));
        if (capacitorLevel > 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(capacitorLevel), capacitorLevel, "The value must be at most 1.");
        }

        if (weaponsCapacity == 0)
        {
            // There is no capacitor to draw on, so a weapon that costs anything fires on empty.
            return thermalLoad * (distributorDraw > 0 ? DrainedCapacitorMultiplier : 1);
        }

        double shortfall = Clamp(
            1 - (((weaponsCapacity * capacitorLevel) - distributorDraw) / weaponsCapacity));
        return thermalLoad * (1 + ((DrainedCapacitorMultiplier - 1) * shortfall));
    }

    /// <summary>The heat level a build reaches after holding a thermal load for a while.</summary>
    /// <param name="heatCapacity">The hull's heat capacity, which must be above zero.</param>
    /// <param name="heatDissipation">The hull's largest heat dissipation, per second.</param>
    /// <param name="thermalLoad">The thermal load being generated, per second.</param>
    /// <param name="startLevel">The heat level the ship starts at.</param>
    /// <param name="seconds">How long the load is held, in seconds.</param>
    /// <returns>The heat level after the time, in model units.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A figure is not a finite number of zero or more, or the heat capacity is zero.
    /// </exception>
    public static double LevelAtTime(
        double heatCapacity,
        double heatDissipation,
        double thermalLoad,
        double startLevel,
        double seconds)
    {
        Validate(heatCapacity, heatDissipation, thermalLoad, startLevel);
        RangeGuards.RequireFiniteNonNegative(seconds, nameof(seconds));
        if (seconds == 0) return startLevel;

        double linearRate = (thermalLoad - heatDissipation) / heatCapacity;
        if (startLevel >= 1)
        {
            // At and above heat level one dissipation is capped, so heat moves at a fixed rate.
            if (linearRate >= 0) return startLevel + (linearRate * seconds);
            double secondsToOne = (startLevel - 1) / -linearRate;
            if (seconds <= secondsToOne) return startLevel + (linearRate * seconds);
            return BelowOneLevelAtTime(
                heatCapacity, heatDissipation, thermalLoad, 1, seconds - secondsToOne);
        }

        if (thermalLoad > heatDissipation)
        {
            // Climbing towards a level the hull cannot hold: curved up to one, straight after.
            double secondsToOne = BelowOneSecondsToLevel(
                heatCapacity, heatDissipation, thermalLoad, startLevel, 1);
            if (seconds > secondsToOne) return 1 + (linearRate * (seconds - secondsToOne));
        }

        return BelowOneLevelAtTime(
            heatCapacity, heatDissipation, thermalLoad, startLevel, seconds);
    }

    /// <summary>
    /// How long a build takes to move from one heat level to another under a given load, heating or
    /// cooling.
    /// </summary>
    /// <param name="heatCapacity">The hull's heat capacity, which must be above zero.</param>
    /// <param name="heatDissipation">The hull's largest heat dissipation, per second.</param>
    /// <param name="thermalLoad">The thermal load being generated, per second.</param>
    /// <param name="startLevel">The heat level the ship starts at.</param>
    /// <param name="targetLevel">The heat level being asked about.</param>
    /// <returns>
    /// The seconds it takes, or infinity when the load never carries the ship there: heating
    /// towards a level at or beyond where it settles, or cooling towards one below it.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A figure is not a finite number of zero or more, or the heat capacity is zero.
    /// </exception>
    public static double SecondsToLevel(
        double heatCapacity,
        double heatDissipation,
        double thermalLoad,
        double startLevel,
        double targetLevel)
    {
        Validate(heatCapacity, heatDissipation, thermalLoad, startLevel);
        RangeGuards.RequireFiniteNonNegative(targetLevel, nameof(targetLevel));
        if (targetLevel == startLevel) return 0;

        double linearRate = (thermalLoad - heatDissipation) / heatCapacity;
        double seconds = 0;
        double level = startLevel;
        if (targetLevel > startLevel)
        {
            if (level < 1)
            {
                double to = Math.Min(targetLevel, 1);
                seconds = BelowOneSecondsToLevel(
                    heatCapacity, heatDissipation, thermalLoad, level, to);
                if (double.IsInfinity(seconds) || double.IsNaN(seconds) || targetLevel <= 1)
                {
                    return seconds;
                }

                level = 1;
            }

            if (linearRate <= 0) return double.PositiveInfinity;
            return seconds + ((targetLevel - level) / linearRate);
        }

        if (level > 1)
        {
            if (linearRate >= 0) return double.PositiveInfinity;
            double to = Math.Max(targetLevel, 1);
            seconds = (level - to) / -linearRate;
            if (targetLevel >= 1) return seconds;
            level = 1;
        }

        return seconds
            + BelowOneSecondsToLevel(heatCapacity, heatDissipation, thermalLoad, level, targetLevel);
    }

    /// <summary>
    /// Everything an outfitting screen shows about a build's heat: what it idles at, what it runs
    /// at flying and jumping, and whether firing everything cooks it.
    /// </summary>
    /// <param name="input">The hull's two heat stats, the plant's efficiency and the build's draw.</param>
    /// <returns>The build's heat metrics.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A figure is not a finite number of zero or more, or the heat capacity is zero.
    /// </exception>
    public static HeatMetrics Metrics(HeatInput input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));

        RangeGuards.RequireFiniteNonNegative(input.HeatCapacity, "input.HeatCapacity");
        RangeGuards.RequireFiniteNonNegative(input.HeatDissipation, "input.HeatDissipation");
        if (input.HeatCapacity == 0)
        {
            throw new ArgumentOutOfRangeException(
                "input.HeatCapacity", input.HeatCapacity, "The value must be above 0.");
        }

        RangeGuards.RequireFiniteNonNegative(input.HeatEfficiency, "input.HeatEfficiency");
        double retracted = RangeGuards.RequireFiniteNonNegative(
            input.RetractedPowerDraw, "input.RetractedPowerDraw");
        double deployed = RangeGuards.RequireFiniteNonNegative(
            input.DeployedPowerDraw ?? retracted, "input.DeployedPowerDraw");
        double thrusterHeat = RangeGuards.RequireFiniteNonNegative(
            input.ThrusterHeatRate, "input.ThrusterHeatRate");
        double deployedThrusterHeat = RangeGuards.RequireFiniteNonNegative(
            input.DeployedThrusterHeatRate ?? thrusterHeat, "input.DeployedThrusterHeatRate");
        double fsdHeat = RangeGuards.RequireFiniteNonNegative(
            input.FsdHeatRate, "input.FsdHeatRate");
        double weaponsCapacity = RangeGuards.RequireFiniteNonNegative(
            input.WeaponsCapacity, "input.WeaponsCapacity");

        double idleLoad = retracted * input.HeatEfficiency;
        double deployedLoad = deployed * input.HeatEfficiency;
        // The hardpoints are out and the ship is manoeuvring in both firing scenarios, so the
        // thrusters' heat is part of what the guns are added to.
        double firingBase = deployedLoad + deployedThrusterHeat;

        double WeaponHeat(double capacitorLevel)
        {
            double total = 0;
            foreach (HeatWeapon weapon in input.Weapons ?? [])
            {
                total += EffectiveWeaponThermalLoad(
                    weapon.HeatPerSecond, weapon.DistributorDraw, weaponsCapacity, capacitorLevel);
            }

            return total;
        }

        HeatState State(double load, double baseLoad) =>
            StateFor(input.HeatCapacity, input.HeatDissipation, load, baseLoad);

        return new HeatMetrics(
            HeatEfficiency: input.HeatEfficiency,
            HullHeatCapacity: input.HeatCapacity,
            HullHeatDissipation: input.HeatDissipation,
            Idle: State(idleLoad, 0),
            Thrusters: State(idleLoad + thrusterHeat, idleLoad),
            FsdCharging: State(idleLoad + thrusterHeat + fsdHeat, idleLoad + thrusterHeat),
            FiringSustained: State(firingBase + WeaponHeat(1), firingBase),
            FiringDrained: State(firingBase + WeaponHeat(0), firingBase));
    }

    /// <summary>One scenario's settled level, and how long it has before the gauge is full.</summary>
    private static HeatState StateFor(
        double heatCapacity, double heatDissipation, double thermalLoad, double baseLoad)
    {
        bool overheats = thermalLoad > heatDissipation;
        double heatLevel = overheats
            ? double.PositiveInfinity
            : EquilibriumLevel(heatDissipation, thermalLoad);
        double baseLevel = baseLoad > heatDissipation
            ? 1
            : EquilibriumLevel(heatDissipation, baseLoad);

        return new HeatState(
            ThermalLoad: thermalLoad,
            HeatLevel: heatLevel,
            Gauge: heatLevel / OverheatHeatLevel,
            Overheats: overheats,
            SecondsToOverheat: overheats
                ? SecondsToLevel(
                    heatCapacity, heatDissipation, thermalLoad, baseLevel, OverheatHeatLevel)
                : null);
    }

    /// <summary>
    /// The heat level after a time, below heat level one, where dissipation still rises with the
    /// square of the level.
    /// </summary>
    private static double BelowOneLevelAtTime(
        double heatCapacity,
        double heatDissipation,
        double thermalLoad,
        double startLevel,
        double seconds)
    {
        double dissipationRate = heatDissipation / heatCapacity;
        if (heatDissipation == 0) return startLevel + ((thermalLoad / heatCapacity) * seconds);
        if (thermalLoad == 0)
        {
            // Cooling with nothing generating: the square law integrates to a plain reciprocal.
            if (startLevel == 0) return 0;
            return 1 / ((1 / startLevel) + (dissipationRate * seconds));
        }

        double loadRate = thermalLoad / heatCapacity;
        double settled = Math.Sqrt(loadRate / dissipationRate);
        double rate = Math.Sqrt(dissipationRate * loadRate);
        if (startLevel == settled) return settled;
        if (startLevel < settled)
        {
            return settled * Math.Tanh((rate * seconds) + Math.Atanh(startLevel / settled));
        }

        // Falling towards the settled level from above it: the same curve, mirrored.
        return settled / Math.Tanh((rate * seconds) + Math.Atanh(settled / startLevel));
    }

    /// <summary>The seconds to move between two heat levels, both at or below one.</summary>
    private static double BelowOneSecondsToLevel(
        double heatCapacity,
        double heatDissipation,
        double thermalLoad,
        double startLevel,
        double targetLevel)
    {
        double dissipationRate = heatDissipation / heatCapacity;
        if (heatDissipation == 0)
        {
            // A hull that sheds nothing only ever heats, and does so at a fixed rate.
            if (targetLevel < startLevel || thermalLoad == 0) return double.PositiveInfinity;
            return (targetLevel - startLevel) * heatCapacity / thermalLoad;
        }

        if (thermalLoad == 0)
        {
            if (targetLevel > startLevel) return double.PositiveInfinity;
            if (targetLevel == 0) return double.PositiveInfinity;
            return ((1 / targetLevel) - (1 / startLevel)) / dissipationRate;
        }

        double loadRate = thermalLoad / heatCapacity;
        double settled = Math.Sqrt(loadRate / dissipationRate);
        double rate = Math.Sqrt(dissipationRate * loadRate);
        bool unreachable = targetLevel > startLevel
            ? targetLevel >= settled
            : targetLevel <= settled;
        if (unreachable) return double.PositiveInfinity;

        double from = startLevel < settled ? startLevel / settled : settled / startLevel;
        double to = startLevel < settled ? targetLevel / settled : settled / targetLevel;
        return (Math.Atanh(to) - Math.Atanh(from)) / rate;
    }

    private static double Clamp(double value) => Math.Min(Math.Max(value, 0), 1);

    private static void Validate(
        double heatCapacity, double heatDissipation, double thermalLoad, double startLevel)
    {
        RangeGuards.RequireFiniteNonNegative(heatCapacity, nameof(heatCapacity));
        RangeGuards.RequireFiniteNonNegative(heatDissipation, nameof(heatDissipation));
        RangeGuards.RequireFiniteNonNegative(thermalLoad, nameof(thermalLoad));
        RangeGuards.RequireFiniteNonNegative(startLevel, nameof(startLevel));
        if (heatCapacity == 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(heatCapacity), heatCapacity, "The value must be above 0.");
        }
    }
}
