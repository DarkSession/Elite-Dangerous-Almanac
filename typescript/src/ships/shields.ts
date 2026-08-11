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
 * `./resistances`.
 *
 * This module is data-free. {@link ShipLoadout.shieldMetrics} (in `./ship-loadout`)
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
    stackShieldResistance,
    systemsResistance,
    type DamageResistances,
    type DamageTypeValues,
} from './resistances.js';

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
 */
export interface ShieldGeneratorParams {
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
    /** Kinetic resistance, as a fraction. Defaults to `0`. */
    readonly kineticResistance?: number;
    /** Thermal resistance, as a fraction. Defaults to `0`. */
    readonly thermalResistance?: number;
    /** Explosive resistance, as a fraction. Defaults to `0`. */
    readonly explosiveResistance?: number;
    /** Caustic resistance, as a fraction. Defaults to `0`. */
    readonly causticResistance?: number;
}

/** One fitted, powered shield booster's contribution. */
export interface ShieldBoosterParams {
    /** Strength bonus, as a fraction (`0.2` = +20%). Defaults to `0`. */
    readonly shieldBoost?: number;
    /** Kinetic resistance, as a fraction. Defaults to `0`. */
    readonly kineticResistance?: number;
    /** Thermal resistance, as a fraction. Defaults to `0`. */
    readonly thermalResistance?: number;
    /** Explosive resistance, as a fraction. Defaults to `0`. */
    readonly explosiveResistance?: number;
    /** Caustic resistance, as a fraction. Defaults to `0`. */
    readonly causticResistance?: number;
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
     * a flat top-up, and it is added even when the boosters are the only other source.
     */
    readonly reinforcement?: number;
    /**
     * Pips to the systems capacitor, `0`–`4`, folded into the reported resistances.
     * Defaults to `0` — the bare shield, as an outfitting screen shows it.
     */
    readonly systemsPips?: number;
}

/** A build's shield strength, where it comes from, and what it resists. */
export interface ShieldMetrics {
    /** Total shield strength, in megajoules. `0` when no generator is fitted. */
    readonly strength: number;
    /** The generator's own contribution, in megajoules. */
    readonly generator: number;
    /** What the boosters add on top of the generator, in megajoules. */
    readonly boosters: number;
    /** What Guardian shield reinforcement packages add, in megajoules. */
    readonly reinforcement: number;
    /** The generator's strength multiplier at this hull mass. */
    readonly massCurveMultiplier: number;
    /** The boosters' combined multiplier, `1` with none fitted (`1.6` = +60%). */
    readonly boostMultiplier: number;
    /**
     * Effective resistances, generator and boosters stacked with diminishing returns,
     * and the SYS pips folded in.
     */
    readonly resistances: DamageResistances;
    /**
     * Effective hit points against each damage type, in megajoules —
     * `strength / (1 − resistance)`, the raw damage of that type the shield can soak.
     * `Infinity` where a resistance reaches 100%.
     */
    readonly effectiveHitPoints: DamageTypeValues;
    /** The extra resistance the SYS pips contribute, as a fraction. */
    readonly systemsResistance: number;
}

/**
 * A shield generator's strength multiplier at a given hull mass.
 *
 * @param hullMass - The **hull's** mass, in tonnes (not the loaded ship's).
 * @param generator - The generator's mass/multiplier curve, post-engineering.
 * @returns The multiplier to apply to the hull's base shield strength: `minMultiplier`
 * for a hull sitting exactly on `maxMass`, no more than `maxMultiplier` for a
 * featherweight one, and **`0` past `maxMass`** — a generator cannot raise a shield
 * around a hull heavier than it is rated for. Also `0` for a generator whose record is
 * missing part of its curve.
 * @remarks
 * The curve is a power law fitted through the generator's three declared points:
 * normalise the mass into `[0, 1]` between `maxMass` and `minMass`, raise it to the
 * exponent that makes the curve pass through `(optMass, optMultiplier)`, then
 * interpolate between `minMultiplier` and `maxMultiplier`.
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
 */
export function shieldMassCurveMultiplier(
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
    // The generator simply will not engage around a hull heavier than its maximum.
    if (hullMass > maxMass) return 0;
    const span = maxMass - minMass;
    if (span <= 0 || maxMultiplier === minMultiplier) return optMultiplier;
    const normalised = Math.max(0, Math.min(1, (maxMass - hullMass) / span));
    const optNormalised = Math.min(1, (maxMass - optMass) / span);
    const exponent =
        Math.log((optMultiplier - minMultiplier) / (maxMultiplier - minMultiplier)) /
        Math.log(optNormalised);
    if (!Number.isFinite(exponent)) return optMultiplier;
    return minMultiplier + Math.pow(normalised, exponent) * (maxMultiplier - minMultiplier);
}

/**
 * A build's shield strength, in megajoules.
 *
 * @param hullMass - The **hull's** mass, in tonnes.
 * @param baseShieldStrength - The hull's base shield strength, in megajoules.
 * @param generator - The fitted generator, post-engineering.
 * @param boostMultiplier - The boosters' combined multiplier — `1 + Σ shieldBoost`.
 * Defaults to `1` (no boosters).
 * @returns The shield's megajoules, before any Guardian reinforcement addition.
 */
export function shieldStrength(
    hullMass: number,
    baseShieldStrength: number,
    generator: ShieldGeneratorParams,
    boostMultiplier = 1,
): number {
    return baseShieldStrength * shieldMassCurveMultiplier(hullMass, generator) * boostMultiplier;
}

/** Sum a resistance field across the boosters, skipping the ones that do not carry it. */
const boosterResistances = (
    boosters: readonly ShieldBoosterParams[],
    field: keyof ShieldBoosterParams,
): number[] => boosters.map((booster) => booster[field] ?? 0);

/**
 * Everything an outfitting screen shows about a build's shields: strength, where it
 * comes from, and the effective resistances.
 *
 * @param input - The hull's mass and base shield strength, the fitted generator, and
 * any powered boosters, Guardian reinforcement and SYS pips.
 * @returns The {@link ShieldMetrics}. With no generator fitted every figure is `0`
 * and the resistances are the SYS pips alone — a hull with no shields still gets no
 * benefit from them, but the numbers stay well-defined.
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
    const pips = input.systemsPips ?? 0;
    const sysResistance = systemsResistance(pips);
    const generator = input.generator ?? null;

    if (!generator) {
        const none = { kinetic: 0, thermal: 0, explosive: 0, caustic: 0 } as const;
        return {
            strength: 0,
            generator: 0,
            boosters: 0,
            reinforcement: 0,
            massCurveMultiplier: 0,
            boostMultiplier: 1,
            resistances: { ...none },
            effectiveHitPoints: { ...none },
            systemsResistance: sysResistance,
        };
    }

    const massCurveMultiplier = shieldMassCurveMultiplier(input.hullMass, generator);
    const boostMultiplier =
        1 + boosters.reduce((sum, booster) => sum + (booster.shieldBoost ?? 0), 0);
    const generatorStrength = input.baseShieldStrength * massCurveMultiplier;
    const boostersStrength = generatorStrength * (boostMultiplier - 1);
    const strength = generatorStrength + boostersStrength + reinforcement;

    // The SYS pips multiply with the stacked shield resistance rather than adding to it.
    const withPips = (resistance: number): number => 1 - (1 - resistance) * (1 - sysResistance);
    const resistances: DamageResistances = {
        kinetic: withPips(
            stackShieldResistance(
                generator.kineticResistance ?? 0,
                boosterResistances(boosters, 'kineticResistance'),
            ),
        ),
        thermal: withPips(
            stackShieldResistance(
                generator.thermalResistance ?? 0,
                boosterResistances(boosters, 'thermalResistance'),
            ),
        ),
        explosive: withPips(
            stackShieldResistance(
                generator.explosiveResistance ?? 0,
                boosterResistances(boosters, 'explosiveResistance'),
            ),
        ),
        caustic: withPips(
            stackShieldResistance(
                generator.causticResistance ?? 0,
                boosterResistances(boosters, 'causticResistance'),
            ),
        ),
    };

    const effective = (resistance: number): number =>
        resistance >= 1 ? Infinity : strength / (1 - resistance);

    return {
        strength,
        generator: generatorStrength,
        boosters: boostersStrength,
        reinforcement,
        massCurveMultiplier,
        boostMultiplier,
        resistances,
        effectiveHitPoints: {
            kinetic: effective(resistances.kinetic),
            thermal: effective(resistances.thermal),
            explosive: effective(resistances.explosive),
            caustic: effective(resistances.caustic),
        },
        systemsResistance: sysResistance,
    };
}
