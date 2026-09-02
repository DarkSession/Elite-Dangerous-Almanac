/**
 * **Heat** — what a build runs at, and whether firing everything cooks it.
 *
 * A ship's heat is a balance. The power plant turns the draw of everything it feeds
 * into waste heat, thrusters and the frame shift drive add their own, and weapons add
 * theirs while they fire; the hull sheds heat as it gets hotter. Where the two meet is
 * the **heat level** — `1` is where the hull's dissipation maxes out, and the gauge in
 * the cockpit reads `100%` at heat level `1.5`, which is where things start to burn:
 *
 * ```text
 * thermal load = powered draw × plant heat efficiency + thrusters + FSD + weapons
 * dissipation  = heatDissipation × clamp(heatLevel, 0, 1)²
 * settles at     heatLevel = √(thermal load / heatDissipation)
 * ```
 *
 * Two consequences follow, and they are what the numbers mean:
 * a build whose thermal load stays under the hull's `heatDissipation` **always settles**
 * below heat level `1` and never overheats, however long it holds the trigger; and one
 * whose load goes over it **never settles** — heat climbs until the ship cooks, and the
 * only question is how long that takes. `heatCapacity` decides that timing and nothing
 * else: it is thermal inertia, not a budget.
 *
 * This module is data-free — hand {@link heatMetrics} a hull's two heat stats, the
 * plant's efficiency and the build's draw. {@link BuildMetrics.heatMetricsResult} (in
 * `./build-metrics`) reads all of that off a build, post-engineering, for you.
 *
 * Two heat sources stand outside the scenarios reported here, both of them momentary
 * rather than sustained, and they are not interchangeable with the figures above:
 *
 * - A **shield cell bank** states {@link OutfittingModule.shieldBankHeat} per
 *   *activation*, not per second. Divide it by the bank's
 *   {@link OutfittingModule.shieldBankSpinUp} to get a load these functions accept, add
 *   that to the build's own load, and run it for the spin-up's duration — which is what
 *   an outfitting screen means by a cell bank's heat spike.
 * - A **heat sink** removes heat rather than making it, and every load here is
 *   non-negative, so it cannot be expressed as one. Nothing in this module models a
 *   sink; the level a sink drops the ship to is the starting level of whatever comes
 *   after it.
 *
 * @remarks
 * Reference implementation: EDSY, `edsy.js` (`getEquilibriumHeatLevel`,
 * `getTimeUntilHeatLevel`, `getHeatLevelAtTime`, `getEffectiveWeaponThermalLoad`,
 * `updateUIStatsThm`), which cites the Frontier-forum research thread
 * [Research: detailed heat mechanics](https://forums.frontier.co.uk/threads/research-detailed-heat-mechanics.286628/)
 * the model was reverse-engineered in. Frontier publishes no heat formula and shows a
 * player no dissipation figure, so both the model and the per-hull `heatDissipation` it
 * reads are community measurements of the game rather than stats the game states — see
 * [data/ships/SOURCES.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 * The algorithm is ported as fact, not code; credit and licence terms are in
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { heatMetrics } from '@elite-dangerous-almanac/core/ships/heat';
 *
 * const heat = heatMetrics({
 *   heatCapacity: 334,        // Anaconda
 *   heatDissipation: 67.15,
 *   heatEfficiency: 0.4,      // 6A power plant
 *   retractedPowerDraw: 18.2,
 *   deployedPowerDraw: 24.6,
 * });
 * heat.idle.gauge;            // -> 0.22  (the cockpit gauge reads 22%)
 * heat.idle.overheats;        // -> false
 * ```
 *
 * @packageDocumentation
 */

import { requireFiniteNonNegative } from './internal/range-guards.js';

/**
 * The heat level the cockpit gauge shows as `100%` — where a ship starts to cook.
 *
 * @remarks
 * Heat level `1` is where the hull's dissipation stops rising, and the gauge reads
 * two thirds there. Everything in {@link HeatState} is reported both ways:
 * {@link HeatState.heatLevel} in model units and {@link HeatState.gauge} as the
 * fraction the game displays.
 */
export const OVERHEAT_HEAT_LEVEL = 1.5;

/**
 * How much a weapon's thermal load is multiplied by when the weapons capacitor cannot
 * pay for the shot — five times over on an empty capacitor.
 */
const DRAINED_CAPACITOR_MULTIPLIER = 5;

/** One enabled weapon's contribution to a build's heat. */
export interface HeatWeapon {
    /**
     * Heat per second the weapon generates while firing, in thermal-load units.
     * {@link WeaponMetrics.sustainedHeatPerSecond} is the figure to pass — it folds in
     * the reloads a long engagement spends not firing. Defaults to `0`.
     */
    readonly heatPerSecond?: number;
    /**
     * Weapons-capacitor draw of one discharge, in megajoules
     * ({@link OutfittingModule.distributorDraw}). Defaults to `0`.
     *
     * @remarks
     * Read together with {@link HeatInput.weaponsCapacity} to work out how much the
     * capacitor's state amplifies the weapon's heat: a shot the capacitor cannot cover
     * generates up to five times its thermal load.
     */
    readonly distributorDraw?: number;
}

/** Everything {@link heatMetrics} needs about a build. */
export interface HeatInput {
    /**
     * The hull's heat capacity ({@link Ship.heatCapacity}) — its thermal inertia, in
     * thermal-load units per unit of heat level. It decides how quickly heat moves, and
     * never where it settles.
     */
    readonly heatCapacity: number;
    /**
     * The hull's maximum heat dissipation ({@link Ship.heatDissipation}), in
     * thermal-load units per second — the load the build has to stay under to be safe
     * indefinitely.
     */
    readonly heatDissipation: number;
    /**
     * The fitted power plant's heat efficiency
     * ({@link OutfittingModule.heatEfficiency}), post-engineering. Dimensionless, and
     * lower runs cooler.
     */
    readonly heatEfficiency: number;
    /**
     * Power draw, in megawatts, of the modules the plant actually feeds with the
     * hardpoints **stowed** — the retracted draw with any unpowered priority group
     * already dropped. Defaults to `0`.
     */
    readonly retractedPowerDraw?: number;
    /**
     * The same with the hardpoints **deployed**, in megawatts. Defaults to
     * {@link retractedPowerDraw}.
     */
    readonly deployedPowerDraw?: number;
    /**
     * Waste heat the thrusters make per second at top speed
     * ({@link OutfittingModule.engineHeatRate}), with the hardpoints stowed. Defaults
     * to `0`.
     */
    readonly thrusterHeatRate?: number;
    /**
     * The same with the hardpoints **deployed**. Defaults to {@link thrusterHeatRate}.
     *
     * @remarks
     * The two differ only on a build whose plant cannot feed everything: deploying the
     * hardpoints adds the weapons' draw, which can shed the priority group the thrusters
     * sit in. Thrusters the plant no longer feeds make no heat, so this is `0` there
     * while {@link thrusterHeatRate} is not.
     */
    readonly deployedThrusterHeatRate?: number;
    /**
     * Waste heat the frame shift drive makes per second while charging a jump
     * ({@link OutfittingModule.fsdHeatRate}). Defaults to `0`.
     */
    readonly fsdHeatRate?: number;
    /** Every enabled weapon. Defaults to none. */
    readonly weapons?: readonly HeatWeapon[];
    /**
     * The power distributor's weapons-capacitor capacity, in megajoules
     * ({@link OutfittingModule.weaponsCapacity}), post-engineering. Defaults to `0`,
     * which reads as a capacitor that can cover nothing — every weapon then runs at the
     * drained multiplier in both firing scenarios.
     */
    readonly weaponsCapacity?: number;
}

/** A build's heat under one set of circumstances. */
export interface HeatState {
    /** Thermal load, in thermal-load units per second, that this scenario generates. */
    readonly thermalLoad: number;
    /**
     * The heat level this load settles at, or `Infinity` when it settles nowhere
     * because the load exceeds the hull's dissipation.
     *
     * @remarks
     * Model units, where `1` is the level at which dissipation maxes out and
     * {@link OVERHEAT_HEAT_LEVEL} is the point of overheating. {@link gauge} is the
     * same number as the cockpit shows it.
     */
    readonly heatLevel: number;
    /**
     * {@link heatLevel} as the ship's heat gauge reads it: `1` is `100%`, the point at
     * which modules start taking heat damage. `Infinity` when the heat never settles.
     */
    readonly gauge: number;
    /** Whether heat climbs past `100%` — `true` exactly when the load exceeds dissipation. */
    readonly overheats: boolean;
    /**
     * Seconds from the moment this scenario starts until the gauge reaches `100%`, or
     * `null` when it never does.
     *
     * @remarks
     * Counted from the heat level the build sits at with this scenario's *own*
     * contribution removed — its idle level for {@link HeatMetrics.thrusters}, the
     * deployed-and-flying level for the two firing scenarios, and so on. When that
     * starting point is itself a load the hull cannot shed, the count starts from heat
     * level `1` instead, which is where dissipation stops rising.
     */
    readonly secondsToOverheat: number | null;
}

/**
 * A build's heat: what the plant and the hull make of each other, and what the build
 * runs at stowed, flying, jumping and firing.
 *
 * @remarks
 * Frozen — nested records and lists included — so a result can be held, cached and
 * shared without a defensive copy. Derive a changed figure with a spread rather than
 * by assigning into one.
 */
export interface HeatMetrics {
    /** The fitted plant's heat efficiency, post-engineering. */
    readonly heatEfficiency: number;
    /** The hull's heat capacity — its thermal inertia. */
    readonly hullHeatCapacity: number;
    /** The hull's maximum heat dissipation, in thermal-load units per second. */
    readonly hullHeatDissipation: number;
    /** Hardpoints stowed, throttle closed — the figure a ship sits at doing nothing. */
    readonly idle: HeatState;
    /** Stowed and flat out: {@link idle} plus the thrusters at top speed. */
    readonly thrusters: HeatState;
    /** Charging a jump: {@link thrusters} plus the frame shift drive's spool-up. */
    readonly fsdCharging: HeatState;
    /**
     * Hardpoints out and every enabled weapon firing continuously, reloads folded in,
     * with the weapons capacitor keeping up.
     */
    readonly firingSustained: HeatState;
    /**
     * The same with the weapons capacitor drained — the alpha-strike case, where each
     * weapon makes five times its thermal load.
     */
    readonly firingDrained: HeatState;
}

/**
 * The heat level a thermal load settles at.
 *
 * A hull sheds heat in proportion to the *square* of its heat level, so a load twice as
 * large settles only √2 as hot. Above heat level `1` dissipation stops rising, which is
 * why a load beyond `dissipation` settles nowhere at all.
 *
 * @param dissipation - The hull's maximum heat dissipation, per second.
 * @param thermalLoad - The load being shed, per second.
 * @returns The settled heat level, in model units — `1` is where dissipation maxes out
 * and {@link OVERHEAT_HEAT_LEVEL} is the overheating point. A load above `dissipation`
 * returns a level above `1`, which the ship never actually reaches as a resting point:
 * it passes through it and keeps climbing.
 * @throws {RangeError} If either argument is not a finite non-negative number.
 * @example
 * ```ts
 * import { equilibriumHeatLevel } from '@elite-dangerous-almanac/core/ships/heat';
 *
 * equilibriumHeatLevel(67.15, 16.8); // -> 0.5   an Anaconda idling
 * equilibriumHeatLevel(67.15, 67.15); // -> 1    everything the hull can shed
 * ```
 */
export function equilibriumHeatLevel(dissipation: number, thermalLoad: number): number {
    requireFiniteNonNegative('equilibriumHeatLevel', 'dissipation', dissipation);
    requireFiniteNonNegative('equilibriumHeatLevel', 'thermal load', thermalLoad);
    if (dissipation === 0) return thermalLoad === 0 ? 0 : Infinity;
    return Math.sqrt(thermalLoad / dissipation);
}

/**
 * A weapon's thermal load once the weapons capacitor's state is folded in.
 *
 * A shot the capacitor cannot pay for in full generates up to five times its listed
 * thermal load — which is why a build that never overheats in a duel can cook itself in
 * a wing fight, firing the same guns on an empty capacitor.
 *
 * @param thermalLoad - The weapon's thermal load, in the game's units.
 * @param distributorDraw - Weapons-capacitor draw of one discharge, in megajoules.
 * @param weaponsCapacity - The distributor's weapons-capacitor capacity, in megajoules.
 * @param capacitorLevel - How full the capacitor is, `0` (empty) through `1` (full).
 * @returns The effective thermal load, between `thermalLoad` and five times it.
 * @throws {RangeError} If any argument is not a finite non-negative number, or
 * `capacitorLevel` is above `1`.
 * @example
 * ```ts
 * import { effectiveWeaponThermalLoad } from '@elite-dangerous-almanac/core/ships/heat';
 *
 * effectiveWeaponThermalLoad(2.4, 2.6, 26, 1); // -> 3.36  a full capacitor barely notices
 * effectiveWeaponThermalLoad(2.4, 2.6, 26, 0); // -> 12    an empty one is five times the heat
 * ```
 */
export function effectiveWeaponThermalLoad(
    thermalLoad: number,
    distributorDraw: number,
    weaponsCapacity: number,
    capacitorLevel: number,
): number {
    requireFiniteNonNegative('effectiveWeaponThermalLoad', 'thermal load', thermalLoad);
    requireFiniteNonNegative('effectiveWeaponThermalLoad', 'distributor draw', distributorDraw);
    requireFiniteNonNegative('effectiveWeaponThermalLoad', 'weapons capacity', weaponsCapacity);
    requireFiniteNonNegative('effectiveWeaponThermalLoad', 'capacitor level', capacitorLevel);
    if (capacitorLevel > 1) {
        throw new RangeError('effectiveWeaponThermalLoad: capacitor level must be at most 1');
    }
    if (weaponsCapacity === 0) {
        // No capacitor to draw on: a weapon that costs anything fires on empty.
        return thermalLoad * (distributorDraw > 0 ? DRAINED_CAPACITOR_MULTIPLIER : 1);
    }
    const shortfall = clamp(
        1 - (weaponsCapacity * capacitorLevel - distributorDraw) / weaponsCapacity,
    );
    return thermalLoad * (1 + (DRAINED_CAPACITOR_MULTIPLIER - 1) * shortfall);
}

/**
 * The heat level a build reaches after holding a thermal load for a while.
 *
 * @param params - The hull's two heat stats, the load, and where the ship starts from.
 * @returns The heat level after `seconds`, in the same model units as
 * {@link equilibriumHeatLevel}.
 * @throws {RangeError} If any figure is not a finite non-negative number, or
 * `heatCapacity` is `0`.
 * @example
 * ```ts
 * import { heatLevelAtTime } from '@elite-dangerous-almanac/core/ships/heat';
 *
 * // An Anaconda firing a load its hull cannot shed, from a cold-ish start.
 * heatLevelAtTime({
 *   heatCapacity: 334, heatDissipation: 67.15, thermalLoad: 90, startLevel: 0.5, seconds: 10,
 * }); // -> 1.4355…  ten seconds in, and past heat level 1
 * ```
 */
export function heatLevelAtTime(params: {
    /** The hull's heat capacity. */
    readonly heatCapacity: number;
    /** The hull's maximum heat dissipation, per second. */
    readonly heatDissipation: number;
    /** The thermal load being generated, per second. */
    readonly thermalLoad: number;
    /** The heat level the ship starts at. */
    readonly startLevel: number;
    /** How long the load is held, in seconds. */
    readonly seconds: number;
}): number {
    const { heatCapacity, heatDissipation, thermalLoad, startLevel, seconds } = params;
    validateHeatParams('heatLevelAtTime', heatCapacity, heatDissipation, thermalLoad, startLevel);
    requireFiniteNonNegative('heatLevelAtTime', 'seconds', seconds);
    if (seconds === 0) return startLevel;

    const linearRate = (thermalLoad - heatDissipation) / heatCapacity;
    if (startLevel >= 1) {
        // At and above heat level 1 dissipation is capped, so heat moves at a constant rate.
        if (linearRate >= 0) return startLevel + linearRate * seconds;
        const secondsToOne = (startLevel - 1) / -linearRate;
        if (seconds <= secondsToOne) return startLevel + linearRate * seconds;
        return belowOneLevelAtTime(
            heatCapacity,
            heatDissipation,
            thermalLoad,
            1,
            seconds - secondsToOne,
        );
    }
    if (thermalLoad > heatDissipation) {
        // Climbing towards a level the hull cannot hold: curved up to 1, straight after.
        const secondsToOne = belowOneSecondsToLevel(
            heatCapacity,
            heatDissipation,
            thermalLoad,
            startLevel,
            1,
        );
        if (seconds > secondsToOne) return 1 + linearRate * (seconds - secondsToOne);
    }
    return belowOneLevelAtTime(heatCapacity, heatDissipation, thermalLoad, startLevel, seconds);
}

/**
 * How long a build takes to move from one heat level to another under a given load —
 * heating or cooling.
 *
 * @param params - The hull's two heat stats, the load, and the two heat levels.
 * @returns The seconds it takes, or `Infinity` when the load never carries the ship
 * there: heating towards a level at or beyond where it settles, or cooling towards one
 * below it.
 * @throws {RangeError} If any figure is not a finite non-negative number, or
 * `heatCapacity` is `0`.
 * @example
 * ```ts
 * import { OVERHEAT_HEAT_LEVEL, secondsToHeatLevel } from '@elite-dangerous-almanac/core/ships/heat';
 *
 * secondsToHeatLevel({
 *   heatCapacity: 334, heatDissipation: 67.15, thermalLoad: 90,
 *   startLevel: 0.5, targetLevel: OVERHEAT_HEAT_LEVEL,
 * }); // -> 10.9424…  seconds of firing before the gauge reads 100%
 * ```
 */
export function secondsToHeatLevel(params: {
    /** The hull's heat capacity. */
    readonly heatCapacity: number;
    /** The hull's maximum heat dissipation, per second. */
    readonly heatDissipation: number;
    /** The thermal load being generated, per second. */
    readonly thermalLoad: number;
    /** The heat level the ship starts at. */
    readonly startLevel: number;
    /** The heat level being asked about. */
    readonly targetLevel: number;
}): number {
    const { heatCapacity, heatDissipation, thermalLoad, startLevel, targetLevel } = params;
    validateHeatParams(
        'secondsToHeatLevel',
        heatCapacity,
        heatDissipation,
        thermalLoad,
        startLevel,
    );
    requireFiniteNonNegative('secondsToHeatLevel', 'target level', targetLevel);
    if (targetLevel === startLevel) return 0;

    const linearRate = (thermalLoad - heatDissipation) / heatCapacity;
    if (targetLevel > startLevel) {
        let seconds = 0;
        let level = startLevel;
        if (level < 1) {
            const to = Math.min(targetLevel, 1);
            seconds = belowOneSecondsToLevel(heatCapacity, heatDissipation, thermalLoad, level, to);
            if (!Number.isFinite(seconds) || targetLevel <= 1) return seconds;
            level = 1;
        }
        if (linearRate <= 0) return Infinity;
        return seconds + (targetLevel - level) / linearRate;
    }

    let seconds = 0;
    let level = startLevel;
    if (level > 1) {
        if (linearRate >= 0) return Infinity;
        const to = Math.max(targetLevel, 1);
        seconds = (level - to) / -linearRate;
        if (targetLevel >= 1) return seconds;
        level = 1;
    }
    return (
        seconds +
        belowOneSecondsToLevel(heatCapacity, heatDissipation, thermalLoad, level, targetLevel)
    );
}

/**
 * Everything an outfitting screen shows about a build's heat: what it idles at, what it
 * runs at flying and jumping, and whether firing everything cooks it.
 *
 * @param input - The {@link HeatInput}.
 * @returns The {@link HeatMetrics}.
 * @throws {RangeError} If any figure is not a finite non-negative number, or
 * `heatCapacity` is `0`.
 * @example
 * ```ts
 * import { heatMetrics } from '@elite-dangerous-almanac/core/ships/heat';
 *
 * const heat = heatMetrics({
 *   heatCapacity: 224, heatDissipation: 41.63, heatEfficiency: 0.4, // Fer-de-Lance, 6A plant
 *   retractedPowerDraw: 14.2, deployedPowerDraw: 20.1, thrusterHeatRate: 1.2,
 *   weaponsCapacity: 31, weapons: [{ heatPerSecond: 8.4, distributorDraw: 2.6 }],
 * });
 * heat.firingSustained.overheats;        // -> false: the guns run cool enough to hold
 * heat.firingDrained.secondsToOverheat;  // -> 16.63…  seconds on an empty capacitor
 * ```
 */
export function heatMetrics(input: HeatInput): HeatMetrics {
    const { heatCapacity, heatDissipation, heatEfficiency } = input;
    requireFiniteNonNegative('heatMetrics', 'heat capacity', heatCapacity);
    requireFiniteNonNegative('heatMetrics', 'heat dissipation', heatDissipation);
    if (heatCapacity === 0) throw new RangeError('heatMetrics: heat capacity must be above 0');
    requireFiniteNonNegative('heatMetrics', 'heat efficiency', heatEfficiency);
    const retracted = requireFiniteNonNegative(
        'heatMetrics',
        'retracted power draw',
        input.retractedPowerDraw ?? 0,
    );
    const deployed = requireFiniteNonNegative(
        'heatMetrics',
        'deployed power draw',
        input.deployedPowerDraw ?? retracted,
    );
    const thrusterHeat = requireFiniteNonNegative(
        'heatMetrics',
        'thruster heat rate',
        input.thrusterHeatRate ?? 0,
    );
    const deployedThrusterHeat = requireFiniteNonNegative(
        'heatMetrics',
        'deployed thruster heat rate',
        input.deployedThrusterHeatRate ?? thrusterHeat,
    );
    const fsdHeat = requireFiniteNonNegative(
        'heatMetrics',
        'FSD heat rate',
        input.fsdHeatRate ?? 0,
    );
    const weaponsCapacity = requireFiniteNonNegative(
        'heatMetrics',
        'weapons capacity',
        input.weaponsCapacity ?? 0,
    );

    const idleLoad = retracted * heatEfficiency;
    const deployedLoad = deployed * heatEfficiency;
    const weaponHeat = (capacitorLevel: number): number =>
        (input.weapons ?? []).reduce(
            (total, weapon) =>
                total +
                effectiveWeaponThermalLoad(
                    weapon.heatPerSecond ?? 0,
                    weapon.distributorDraw ?? 0,
                    weaponsCapacity,
                    capacitorLevel,
                ),
            0,
        );
    // Hardpoints are out and the ship is manoeuvring in both firing scenarios, so the
    // thrusters' heat is part of what the guns are added to.
    const firingBase = deployedLoad + deployedThrusterHeat;
    const state = (load: number, base: number): HeatState =>
        heatState(heatCapacity, heatDissipation, load, base);

    return Object.freeze({
        heatEfficiency,
        hullHeatCapacity: heatCapacity,
        hullHeatDissipation: heatDissipation,
        idle: state(idleLoad, 0),
        thrusters: state(idleLoad + thrusterHeat, idleLoad),
        fsdCharging: state(idleLoad + thrusterHeat + fsdHeat, idleLoad + thrusterHeat),
        firingSustained: state(firingBase + weaponHeat(1), firingBase),
        firingDrained: state(firingBase + weaponHeat(0), firingBase),
    });
}

/** One scenario's settled level, and how long it has before the gauge reads 100%. */
function heatState(
    heatCapacity: number,
    heatDissipation: number,
    thermalLoad: number,
    baseLoad: number,
): HeatState {
    const overheats = thermalLoad > heatDissipation;
    const heatLevel = overheats ? Infinity : equilibriumHeatLevel(heatDissipation, thermalLoad);
    const baseLevel =
        baseLoad > heatDissipation ? 1 : equilibriumHeatLevel(heatDissipation, baseLoad);
    return Object.freeze({
        thermalLoad,
        heatLevel,
        gauge: heatLevel / OVERHEAT_HEAT_LEVEL,
        overheats,
        secondsToOverheat: overheats
            ? secondsToHeatLevel({
                  heatCapacity,
                  heatDissipation,
                  thermalLoad,
                  startLevel: baseLevel,
                  targetLevel: OVERHEAT_HEAT_LEVEL,
              })
            : null,
    });
}

/**
 * The heat level after `seconds`, below heat level `1`, where dissipation still rises
 * with the square of the level. The solution to `dH/dt = (load − dissipation·H²) / capacity`.
 */
function belowOneLevelAtTime(
    heatCapacity: number,
    heatDissipation: number,
    thermalLoad: number,
    startLevel: number,
    seconds: number,
): number {
    const dissipationRate = heatDissipation / heatCapacity;
    if (heatDissipation === 0) return startLevel + (thermalLoad / heatCapacity) * seconds;
    if (thermalLoad === 0) {
        // Cooling with nothing generating: the square law integrates to a plain reciprocal.
        if (startLevel === 0) return 0;
        return 1 / (1 / startLevel + dissipationRate * seconds);
    }
    const loadRate = thermalLoad / heatCapacity;
    const settled = Math.sqrt(loadRate / dissipationRate);
    const rate = Math.sqrt(dissipationRate * loadRate);
    if (startLevel === settled) return settled;
    if (startLevel < settled) {
        return settled * Math.tanh(rate * seconds + Math.atanh(startLevel / settled));
    }
    // Falling towards the settled level from above it — the same curve, mirrored.
    return settled / Math.tanh(rate * seconds + Math.atanh(settled / startLevel));
}

/**
 * Seconds to move between two heat levels, both at or below `1`. `Infinity` when the
 * load settles before it gets there.
 */
function belowOneSecondsToLevel(
    heatCapacity: number,
    heatDissipation: number,
    thermalLoad: number,
    startLevel: number,
    targetLevel: number,
): number {
    const dissipationRate = heatDissipation / heatCapacity;
    if (heatDissipation === 0) {
        // A hull that sheds nothing only ever heats, and does so at a constant rate.
        if (targetLevel < startLevel || thermalLoad === 0) return Infinity;
        return ((targetLevel - startLevel) * heatCapacity) / thermalLoad;
    }
    if (thermalLoad === 0) {
        if (targetLevel > startLevel) return Infinity; // nothing to heat it
        if (targetLevel === 0) return Infinity; // the reciprocal never reaches zero
        return (1 / targetLevel - 1 / startLevel) / dissipationRate;
    }
    const loadRate = thermalLoad / heatCapacity;
    const settled = Math.sqrt(loadRate / dissipationRate);
    const rate = Math.sqrt(dissipationRate * loadRate);
    if (targetLevel > startLevel ? targetLevel >= settled : targetLevel <= settled) return Infinity;
    const from = startLevel < settled ? startLevel / settled : settled / startLevel;
    const to = startLevel < settled ? targetLevel / settled : settled / targetLevel;
    return (Math.atanh(to) - Math.atanh(from)) / rate;
}

function clamp(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

function validateHeatParams(
    caller: string,
    heatCapacity: number,
    heatDissipation: number,
    thermalLoad: number,
    startLevel: number,
): void {
    requireFiniteNonNegative(caller, 'heat capacity', heatCapacity);
    requireFiniteNonNegative(caller, 'heat dissipation', heatDissipation);
    requireFiniteNonNegative(caller, 'thermal load', thermalLoad);
    requireFiniteNonNegative(caller, 'start level', startLevel);
    if (heatCapacity === 0) throw new RangeError(`${caller}: heat capacity must be above 0`);
}
