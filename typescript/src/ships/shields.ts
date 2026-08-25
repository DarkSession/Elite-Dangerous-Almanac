/**
 * **Shields** — strength in megajoules and the resistances that decide what that
 * strength is worth against each damage type.
 *
 * A generator's strength multiplier is read off a curve against the ship's **hull
 * mass** — the bare hull, *not* the loaded ship, so fitting more modules never weakens
 * your shields. The curve runs through three points the generator declares (`minMass`
 * → `maxMultiplier`, `optMass` → `optMultiplier`, `maxMass` → `minMultiplier`); past
 * `maxMass` the generator will not raise a shield at all.
 *
 * ```text
 * strength = baseShieldStrength × massCurve(hullMass) × (1 + Σ booster boosts)
 *          + Σ Guardian shield reinforcement
 * ```
 *
 * Resistances stack separately, with their own diminishing returns — see
 * `./resistances`. Everything here is **pip-free**: the SYS capacitor's own resistance,
 * and the effective figures it buys, live in `./shield-capacitor`.
 *
 * This module is data-free. {@link BuildMetrics.shieldMetrics} (in `./build-metrics`)
 * pulls the generator, boosters and reinforcement packages out of a build,
 * post-engineering, and calls {@link shieldMetrics} for you.
 *
 * @remarks
 * Reference implementation: EDCD/Coriolis, `src/app/shipyard/Calculations.js`
 * (`shieldStrength`, `shieldMetrics`), commit
 * `68c042ca6e3db62372cbbb2077cf972345511712`. The algorithm is ported as fact, not code;
 * credit and licence terms are in [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { shieldMetrics } from '@elite-dangerous-almanac/core/ships/shields';
 *
 * shieldMetrics({
 *   hullMass: 400,             // Anaconda
 *   baseShieldStrength: 350,
 *   generator: {               // 6A shield generator
 *     minMass: 270, optMass: 540, maxMass: 1350,
 *     minMultiplier: 0.7, optMultiplier: 1.2, maxMultiplier: 1.7,
 *     kineticResistance: 0.4, thermalResistance: -0.2, explosiveResistance: 0.5,
 *   },
 * }).strength; // -> the shield's megajoules, before boosters
 * ```
 *
 * @packageDocumentation
 */

import {
    effectiveHitPoints,
    mapDamageTypes,
    stackShieldResistance,
    type DamageResistances,
    type DamageResistanceParams,
    type DamageType,
    type DamageTypeValues,
} from './resistances.js';
import { massCurveMultiplier, type MassCurveLabels } from './internal/mass-curve.js';

/**
 * The shield generator constants a strength calculation needs — all post-engineering.
 *
 * @remarks
 * An {@link OutfittingModule} record satisfies this as-is, so a catalogue entry can be
 * passed straight in — the six curve fields and the resistances are exactly what a
 * generator's record carries. `optMultiplier` is what a Reinforced/Thermic blueprint
 * moves. Every field is optional because the type accepts those records; a generator
 * **missing** any of the six curve fields cannot be placed on the curve at all, and
 * raises no shield ({@link shieldMassCurveMultiplier} returns `0`).
 *
 * A generator that carries all six is held to the curve's shape: every value finite and
 * non-negative, masses strictly ordered `minMass < optMass < maxMass` (or all equal, for
 * a constant curve), multipliers strictly ordered
 * `minMultiplier < optMultiplier < maxMultiplier` (or all equal), and equal multipliers
 * wherever the masses are all equal. Anything else is a `RangeError` rather than a
 * plausible-looking number.
 */
export interface ShieldGeneratorParams extends DamageResistanceParams {
    /** Hull mass at which the generator performs at `maxMultiplier`, in tonnes. */
    readonly minMass?: number;
    /** Hull mass at which the generator performs to spec, in tonnes. */
    readonly optMass?: number;
    /** Hull mass beyond which the generator cannot raise a shield, in tonnes. */
    readonly maxMass?: number;
    /** Minimum strength multiplier, reached at `maxMass` (the heaviest hull). */
    readonly minMultiplier?: number;
    /** Strength multiplier at `optMass`. */
    readonly optMultiplier?: number;
    /** Maximum strength multiplier, reached at `minMass` (the lightest hull). */
    readonly maxMultiplier?: number;
}

/** One fitted, powered shield booster's contribution. */
export interface ShieldBoosterParams extends DamageResistanceParams {
    /** Strength bonus, as a fraction (`0.2` = +20%). Defaults to `0`. */
    readonly shieldBoost?: number;
}

/** Everything {@link shieldMetrics} needs about a build. */
export interface ShieldInput {
    /**
     * The **hull's** mass, in tonnes — `Ship.hullMass`, not the build's unladen mass.
     * Shields scale with the hull alone, so fitted modules and cargo do not weaken them.
     */
    readonly hullMass: number;
    /** The hull's base shield strength, in megajoules (`Ship.baseShieldStrength`). */
    readonly baseShieldStrength: number;
    /** The fitted shield generator, or `null`/absent when the build has none. */
    readonly generator?: ShieldGeneratorParams | null;
    /** Each fitted, powered shield booster. Defaults to none. */
    readonly boosters?: readonly ShieldBoosterParams[];
    /**
     * Megajoules added flat by Guardian shield reinforcement packages
     * (`OutfittingModule.shieldAddition`), summed. Defaults to `0`.
     *
     * @remarks
     * This addition is not multiplied by the generator's curve or the boosters — it is
     * a flat top-up, and it stands alone when the generator's curve contributes nothing,
     * as it does for a hull past the generator's maximum mass. With **no** generator
     * fitted it is dropped entirely, and the reported
     * {@link ShieldMetrics.reinforcement} is `0`.
     */
    readonly reinforcement?: number;
}

/**
 * A build's shield strength, where it comes from, and what it resists.
 *
 * @remarks
 * Frozen — nested records and lists included — so a result can be held, cached and
 * shared without a defensive copy. Derive a changed figure with a spread rather than
 * by assigning into one.
 */
export interface ShieldMetrics {
    /** Total shield strength, in megajoules. `0` when no generator is fitted. */
    readonly strength: number;
    /** The generator's own contribution, in megajoules. */
    readonly generator: number;
    /** What the boosters add on top of the generator, in megajoules. */
    readonly boosters: number;
    /**
     * What Guardian shield reinforcement packages add, in megajoules. `0` with no
     * generator, whatever `reinforcement` was passed — a package has no shield to
     * reinforce.
     */
    readonly reinforcement: number;
    /** The generator's strength multiplier at this hull mass. `0` with no generator. */
    readonly massCurveMultiplier: number;
    /**
     * The boosters' combined multiplier, `1` with none fitted (`1.6` = +60%). `1` with
     * no generator, whatever boosters are fitted — there is nothing for them to multiply.
     */
    readonly boostMultiplier: number;
    /**
     * Effective resistances, generator and boosters stacked with diminishing returns.
     * The SYS pips are **not** in these — they belong to the capacitor, and
     * {@link shieldCapacitorMetrics} folds them in. `0` for every damage type when no
     * generator is fitted.
     *
     * @remarks
     * Fractions rather than percentages, and **unrounded**: the stacking is
     * floating-point arithmetic, so a nominal −20% reads as `-0.19999999999999996`
     * rather than `-0.2`. Round where the figure is displayed, not before it is
     * composed further — {@link ShieldMetrics.effectiveHitPoints} is derived from
     * exactly these values.
     */
    readonly resistances: DamageResistances;
    /**
     * Effective hit points against each damage type, in megajoules —
     * `strength / (1 − resistance)`, the raw damage of that type the shield can soak.
     * `Infinity` where a resistance reaches 100%.
     */
    readonly effectiveHitPoints: DamageTypeValues;
}

/**
 * How a mass-curve failure names the parameter that carried the curve. The scope is the
 * public function the consumer actually called, so a curve rejected inside
 * {@link shieldMetrics} reports `shieldMetrics`, never a helper.
 */
const curveLabels = (scope: string): MassCurveLabels => ({
    scope,
    mass: 'hullMass',
    curve: 'generator',
});

/**
 * The generator's multiplier, reporting a failure as the public function the consumer
 * called. A record missing part of its curve is not a failure — see
 * {@link shieldMassCurveMultiplier}.
 */
function generatorCurveMultiplier(
    scope: string,
    hullMass: number,
    generator: ShieldGeneratorParams,
): number {
    const { minMass, optMass, maxMass, minMultiplier, optMultiplier, maxMultiplier } = generator;
    if (
        minMass === undefined ||
        optMass === undefined ||
        maxMass === undefined ||
        minMultiplier === undefined ||
        optMultiplier === undefined ||
        maxMultiplier === undefined
    ) {
        // Not a generator the catalogue can place on a curve — it raises no shield
        // rather than a fabricated one.
        return 0;
    }
    // A hull heavier than the generator's maximum is handled by the shared curve, which
    // answers `0` there: the generator simply will not engage.
    return massCurveMultiplier(curveLabels(scope), hullMass, {
        minMass,
        optMass,
        maxMass,
        minMultiplier,
        optMultiplier,
        maxMultiplier,
    });
}

/**
 * A shield generator's strength multiplier at a given hull mass.
 *
 * @param hullMass - The **hull's** mass, in tonnes (not the loaded ship's). Finite and
 * non-negative.
 * @param generator - The generator's mass/multiplier curve, post-engineering. Either all
 * six curve fields, or a record the catalogue left incomplete — see the `0` cases below.
 * @returns The multiplier to apply to the hull's base shield strength: `minMultiplier`
 * for a hull sitting exactly on `maxMass`, no more than `maxMultiplier` for a
 * featherweight one, and **`0` past `maxMass`** — a generator cannot raise a shield
 * around a hull heavier than it is rated for. Also `0` for a generator whose record is
 * missing part of its curve.
 * @throws {RangeError} If `hullMass` is not a finite number of zero or more, or if the
 * generator carries all six curve fields and they are not a physical curve: every one
 * has to be finite and non-negative, the masses strictly ordered
 * `minMass < optMass < maxMass` (or all equal, for a constant curve), the multipliers
 * strictly ordered `minMultiplier < optMultiplier < maxMultiplier` (or all equal), and an
 * all-equal mass curve must have equal multipliers. A curve that is merely *absent* still
 * answers `0`: a catalogue record missing any of the six fields is incomplete data, not a
 * non-physical curve, and this is the only mass-curve outcome that is not a number or a
 * throw.
 * @remarks
 * The curve is a power law fitted through the generator's three declared points:
 * normalize the mass into `[0, 1]` between `maxMass` and `minMass`, raise it to the
 * exponent that makes the curve pass through `(optMass, optMultiplier)`, then
 * interpolate between `minMultiplier` and `maxMultiplier`. It is the same curve
 * `thrusterMassCurveMultiplier` reads a thruster's performance off, and the two agree on
 * every input they both accept.
 * @example
 * ```ts
 * import { shieldMassCurveMultiplier } from '@elite-dangerous-almanac/core/ships/shields';
 *
 * // A 6A generator (opt 540 t) on a 400 t Anaconda performs slightly above spec
 * shieldMassCurveMultiplier(400, {
 *   minMass: 270, optMass: 540, maxMass: 1350,
 *   minMultiplier: 0.7, optMultiplier: 1.2, maxMultiplier: 1.7,
 * }); // -> 1.434…
 * ```
 * @example
 * ```ts
 * import { shieldMassCurveMultiplier } from '@elite-dangerous-almanac/core/ships/shields';
 *
 * // A generator whose optimal mass sits on its maximum is not a curve at all
 * try {
 *   shieldMassCurveMultiplier(400, {
 *     minMass: 270, optMass: 1350, maxMass: 1350,
 *     minMultiplier: 0.7, optMultiplier: 1.2, maxMultiplier: 1.7,
 *   });
 * } catch (error) {
 *   (error as Error).message;
 *   // -> 'shieldMassCurveMultiplier: generator: masses must be strictly ordered minMass < optMass < maxMass, or all equal'
 * }
 *
 * // A record the catalogue left incomplete is data that is missing, not data that is wrong
 * shieldMassCurveMultiplier(400, { optMass: 540, optMultiplier: 1.2 }); // -> 0
 * ```
 */
export function shieldMassCurveMultiplier(
    hullMass: number,
    generator: ShieldGeneratorParams,
): number {
    return generatorCurveMultiplier('shieldMassCurveMultiplier', hullMass, generator);
}

/**
 * A build's shield strength, in megajoules.
 *
 * @param hullMass - The **hull's** mass, in tonnes.
 * @param baseShieldStrength - The hull's base shield strength, in megajoules.
 * @param generator - The fitted generator, post-engineering.
 * @param boostMultiplier - The boosters' combined multiplier — `1 + Σ shieldBoost`.
 * Defaults to `1` (no boosters).
 * @returns The shield's megajoules, before any Guardian reinforcement addition. `0` for a
 * hull past the generator's `maxMass`, and `0` for a generator whose record is missing
 * part of its curve — see {@link shieldMassCurveMultiplier}.
 * @throws {RangeError} If `hullMass` is not a finite number of zero or more, or the
 * generator carries a complete but non-physical curve — the contract
 * {@link shieldMassCurveMultiplier} documents, reported as `shieldStrength`.
 */
export function shieldStrength(
    hullMass: number,
    baseShieldStrength: number,
    generator: ShieldGeneratorParams,
    boostMultiplier = 1,
): number {
    return (
        baseShieldStrength *
        generatorCurveMultiplier('shieldStrength', hullMass, generator) *
        boostMultiplier
    );
}

/** Each booster's resistance to one damage type, reading an absent field as `0`. */
const boosterResistances = (boosters: readonly ShieldBoosterParams[], type: DamageType): number[] =>
    boosters.map((booster) => booster[`${type}Resistance`] ?? 0);

/**
 * A build's bare shields: strength, where it comes from, and the resistances the
 * generator and boosters stack up between them.
 *
 * These are the **pip-free** figures, the ones an outfitting screen shows. The SYS
 * capacitor is a separate story with its own entry point,
 * {@link shieldCapacitorMetrics}, which takes what this returns and folds a pip
 * allocation into it.
 *
 * @param input - The hull's mass and base shield strength, the fitted generator, and
 * any powered boosters and Guardian reinforcement.
 * @returns The {@link ShieldMetrics}. With no generator fitted there is no shield for
 * a resistance to apply to: every strength figure is `0` — any `reinforcement` passed is
 * dropped, since a Guardian package has no shield to reinforce — and `resistances` and
 * `effectiveHitPoints` are `0` for every damage type.
 * `massCurveMultiplier` is `0` and `boostMultiplier` is `1`,
 * whatever boosters are fitted, since there is no generator strength to multiply.
 * @throws {RangeError} With a generator fitted, if `hullMass` is not a finite number of
 * zero or more, or the generator
 * carries a complete but non-physical curve — the contract
 * {@link shieldMassCurveMultiplier} documents, reported as `shieldMetrics`. A generator
 * whose record is simply *missing* part of its curve is not a failure: `hullMass` is
 * never read, and `massCurveMultiplier` and every strength figure are `0`.
 * @example
 * ```ts
 * import { shieldMetrics } from '@elite-dangerous-almanac/core/ships/shields';
 * import type { ShieldGeneratorParams } from '@elite-dangerous-almanac/core/ships/shields';
 *
 * declare const gen: ShieldGeneratorParams;
 *
 * const shields = shieldMetrics({
 *   hullMass: 400,
 *   baseShieldStrength: 350,
 *   generator: gen,
 *   boosters: [{ shieldBoost: 0.2, kineticResistance: 0 }],
 * });
 * shields.strength;                 // -> MJ
 * shields.resistances.kinetic;      // -> effective kinetic resistance
 * shields.effectiveHitPoints.kinetic; // -> kinetic damage the shield can soak
 * ```
 */
export function shieldMetrics(input: ShieldInput): ShieldMetrics {
    const boosters = input.boosters ?? [];
    const reinforcement = input.reinforcement ?? 0;
    const generator = input.generator ?? null;

    if (!generator) {
        const none = Object.freeze(mapDamageTypes(() => 0));
        return Object.freeze({
            strength: 0,
            generator: 0,
            boosters: 0,
            reinforcement: 0,
            massCurveMultiplier: 0,
            boostMultiplier: 1,
            resistances: none,
            effectiveHitPoints: Object.freeze(effectiveHitPoints(0, none)),
        });
    }

    const massCurveMultiplier = generatorCurveMultiplier(
        'shieldMetrics',
        input.hullMass,
        generator,
    );
    const boostMultiplier =
        1 + boosters.reduce((sum, booster) => sum + (booster.shieldBoost ?? 0), 0);
    const generatorStrength = input.baseShieldStrength * massCurveMultiplier;
    const boostersStrength = generatorStrength * (boostMultiplier - 1);
    const strength = generatorStrength + boostersStrength + reinforcement;

    const resistances: DamageResistances = Object.freeze(
        mapDamageTypes((type) =>
            stackShieldResistance(
                generator[`${type}Resistance`] ?? 0,
                boosterResistances(boosters, type),
            ),
        ),
    );

    return Object.freeze({
        strength,
        generator: generatorStrength,
        boosters: boostersStrength,
        reinforcement,
        massCurveMultiplier,
        boostMultiplier,
        resistances,
        effectiveHitPoints: Object.freeze(effectiveHitPoints(strength, resistances)),
    });
}
