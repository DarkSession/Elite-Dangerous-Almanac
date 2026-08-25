/**
 * **Damage resistances** — how a build's shield and hull resistances stack, including
 * the diminishing returns the game applies once they get high.
 *
 * A resistance is the fraction of incoming damage removed: `0.4` means 40% of that
 * damage type never lands, and a *negative* value is a weakness (every shield generator
 * is `-0.2` against thermal). Its complement is the **damage multiplier**, `1 −
 * resistance`, which is what stacking actually multiplies.
 *
 * Sources stack multiplicatively on the multiplier — two 20% resisters leave
 * `0.8 × 0.8 = 0.64`, i.e. 36% resisted rather than 40% — and then the game bends the
 * result so that stacking cannot run away:
 *
 * - **Shields.** Once the boosters push the multiplier below 70% of what the generator
 *   alone gives, the remaining gain is halved: the range `[0, max]` is squeezed into
 *   `[max/2, max]`, where `max` is `0.7 ×` the generator's own multiplier.
 * - **Hull.** Once the stack drops the multiplier below the lowest single source's
 *   multiplier (capped at `0.7`), the range `[0, max]` is squeezed into `[0.35, max]`.
 *   If the squeeze would *raise* the multiplier above `0.7`, the plain product stands.
 *
 * This module is data-free — pass fractions in, get fractions out. {@link ShipLoadout}
 * (`./ship-loadout`), `./shields` and `./armour` gather the numbers for you.
 *
 * @remarks
 * Reference implementation: EDCD/Coriolis,
 * `src/app/shipyard/Calculations.js` (`diminishingReturnsShields`,
 * `diminishingReturnsArmour`, `mapIntoDiminishingRange`, `sysResistance`), commit
 * `68c042ca6e3db62372cbbb2077cf972345511712`. The algorithm is ported as fact, not code;
 * credit and licence terms are in [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { stackShieldResistance } from '@elite-dangerous-almanac/core/ships/resistances';
 *
 * // A stock shield generator (40% kinetic) under four 20% resistance-augmented boosters
 * stackShieldResistance(0.4, [0.2, 0.2, 0.2, 0.2]); // -> 0.667…, not 0.4 + 4 × 0.2
 * ```
 *
 * @packageDocumentation
 */

import { requirePips } from './internal/pips.js';

/**
 * One value per damage type — whatever the value happens to be: a resistance, a pool of
 * effective hit points, a share of incoming damage.
 *
 * @remarks
 * Absolute damage is not listed: no resistance reduces it, so there is nothing per-type
 * to say about it. The unit is the one the field that carries this type documents.
 */
export interface DamageTypeValues {
    /** The kinetic figure. */
    readonly kinetic: number;
    /** The thermal figure. */
    readonly thermal: number;
    /** The explosive figure. */
    readonly explosive: number;
    /** The caustic figure. */
    readonly caustic: number;
}

/**
 * The four resistances a build carries, each the **fraction** of that damage type
 * removed: `0.4` is 40% resisted, and a negative value is a weakness. Values run in
 * `(-∞, 1]`.
 */
export type DamageResistances = DamageTypeValues;

/**
 * The four resistances one **fitted module** contributes, each an optional fraction of
 * that damage type removed: `0.4` is 40% resisted, and a negative value is a weakness. A
 * field the record does not carry counts as `0` — no resistance and no weakness.
 *
 * @remarks
 * The four fittings that carry resistances inherit these fields rather than restating
 * them — {@link ShieldGeneratorParams}, {@link ShieldBoosterParams},
 * {@link BulkheadParams} and {@link HullReinforcementParams} — so an
 * {@link OutfittingModule} record, which spells them the same way, satisfies each of
 * them as it comes. A module reinforcement package carries none of these four: what it
 * absorbs is `moduleProtection`, one type-agnostic figure over module damage.
 *
 * This is the *input* shape, one module at a time. {@link DamageResistances} is the
 * *output*: four required figures for a whole stack, keyed by bare damage type.
 */
export interface DamageResistanceParams {
    /** Kinetic resistance, as a fraction (negative is a weakness). Defaults to `0`. */
    readonly kineticResistance?: number;
    /** Thermal resistance, as a fraction (negative is a weakness). Defaults to `0`. */
    readonly thermalResistance?: number;
    /** Explosive resistance, as a fraction (negative is a weakness). Defaults to `0`. */
    readonly explosiveResistance?: number;
    /** Caustic resistance, as a fraction (negative is a weakness). Defaults to `0`. */
    readonly causticResistance?: number;
}

/**
 * One of the four damage types a {@link DamageTypeValues} carries a figure for.
 *
 * @remarks
 * This is the **defensive** set — what a shield or a hull resists. Absolute damage is
 * absent because nothing resists it. A weapon's *output* is broken down over a different
 * set, {@link DamageDistribution} in `./modules`, which carries `absolute` and `antiXeno`
 * and no `caustic`; the two are not interchangeable.
 */
export type DamageType = keyof DamageTypeValues;

/**
 * Build a {@link DamageTypeValues} by calling `value` once per damage type.
 *
 * @param value - Called with each damage type in turn; returns that type's figure.
 * @returns The four figures in one record.
 * @remarks
 * Every {@link DamageTypeValues} this module, `./shields` and `./armour` return is
 * assembled here, so the four names are written out once rather than at each site that
 * fans out over them.
 * @example
 * ```ts
 * import { mapDamageTypes } from '@elite-dangerous-almanac/core/ships/resistances';
 * import type {
 *     DamageResistances,
 *     DamageTypeValues,
 * } from '@elite-dangerous-almanac/core/ships/resistances';
 *
 * declare const incoming: DamageTypeValues; // the resistible share of incoming damage
 * declare const shields: DamageResistances;
 *
 * // What each type actually lands, the resistances having taken their share.
 * mapDamageTypes((type) => incoming[type] * (1 - shields[type]));
 * ```
 */
export function mapDamageTypes(value: (type: DamageType) => number): DamageTypeValues {
    return {
        kinetic: value('kinetic'),
        thermal: value('thermal'),
        explosive: value('explosive'),
        caustic: value('caustic'),
    };
}

/**
 * How much raw damage of each type a pool of hit points can soak — `total / (1 −
 * resistance)`.
 *
 * @param total - The pool, in whatever unit it is measured: hull points for armour,
 * megajoules for shields.
 * @param resistances - The effective resistances the pool sits behind, already stacked.
 * @returns The effective hit points per damage type, in the same unit as `total`, and
 * `Infinity` at or above 100% — nothing of that type gets through, and a resistance past
 * the documented `(-∞, 1]` range never reports a negative pool.
 * @remarks
 * A *negative* resistance is a weakness and reports **fewer** effective hit points than
 * the pool holds, which is the point: lightweight alloy soaks less kinetic damage than
 * its hull points suggest.
 * @example
 * ```ts
 * import { effectiveHitPoints } from '@elite-dangerous-almanac/core/ships/resistances';
 *
 * // 945 hull points behind lightweight alloy's -20% kinetic
 * effectiveHitPoints(945, { kinetic: -0.2, thermal: 0, explosive: -0.4, caustic: 0 })
 *     .kinetic; // -> 787.5
 * ```
 */
export function effectiveHitPoints(
    total: number,
    resistances: DamageResistances,
): DamageTypeValues {
    return mapDamageTypes((type) => {
        const resistance = resistances[type];
        return resistance >= 1 ? Infinity : total / (1 - resistance);
    });
}

/** The fraction of damage that lands, given a resistance. */
const multiplierOf = (resistance: number): number => 1 - resistance;

/**
 * Squeeze the range `[0, max]` into `[min, max]` for `now` — the game's diminishing
 * curve. `now` above `max` is left alone by the callers, which check first.
 */
const mapIntoDiminishingRange = (min: number, max: number, now: number): number =>
    max === 0 ? min : min + (max - min) * (now / max);

/** The damage multiplier left by a shield stack after diminishing returns. */
function shieldMultiplier(generator: number, boosters: readonly number[]): number {
    const generatorMultiplier = multiplierOf(generator);
    const combined = boosters.reduce(
        (product, resistance) => product * multiplierOf(resistance),
        generatorMultiplier,
    );
    // Diminishing returns start once the boosters have taken 30% off the generator's
    // own multiplier; beyond that each further point is worth half as much.
    const threshold = generatorMultiplier * 0.7;
    if (combined >= threshold) return combined;
    return mapIntoDiminishingRange(threshold / 2, threshold, combined);
}

/**
 * A shield stack's effective resistance to one damage type.
 *
 * @param generator - The shield generator's resistance to this damage type, as a
 * fraction (negative for a weakness).
 * @param boosters - Each **powered** shield booster's resistance to the same type, as
 * fractions.
 * @returns The effective resistance, as a fraction — the share of incoming damage of
 * that type the shields remove.
 * @example
 * ```ts
 * import { stackShieldResistance } from '@elite-dangerous-almanac/core/ships/resistances';
 *
 * stackShieldResistance(0.4);                 // -> 0.4   (generator alone)
 * stackShieldResistance(-0.2, [0.1, 0.1]);    // -> a thermal weakness, partly patched
 * ```
 */
export function stackShieldResistance(generator: number, boosters: readonly number[] = []): number {
    return 1 - shieldMultiplier(generator, boosters);
}

/** The damage multiplier left by a hull stack after diminishing returns. */
function armourMultiplier(bulkhead: number, reinforcements: readonly number[]): number {
    const multipliers = [bulkhead, ...reinforcements].map(multiplierOf);
    const combined = multipliers.reduce((product, multiplier) => product * multiplier, 1);
    // The floor is the best single source, and never worse than 70% resisted.
    const threshold = Math.min(0.7, ...multipliers);
    const diminished = mapIntoDiminishingRange(0.35, threshold, combined);
    // Diminishing returns only ever bite; if the squeeze would *improve* a stack that
    // never reached the threshold, the plain product stands.
    return diminished < 0.7 ? diminished : combined;
}

/**
 * A hull stack's effective resistance to one damage type.
 *
 * @param bulkhead - The fitted armour's resistance to this damage type, as a fraction
 * (lightweight alloy is `-0.2` to kinetic — a weakness).
 * @param reinforcements - Each fitted hull reinforcement package's resistance to the
 * same type, as fractions.
 * @returns The effective resistance, as a fraction.
 * @example
 * ```ts
 * import { stackArmourResistance } from '@elite-dangerous-almanac/core/ships/resistances';
 *
 * // Reactive surface composite (+25% kinetic) with three 1.5% hull reinforcements
 * stackArmourResistance(0.25, [0.015, 0.015, 0.015]); // -> 0.28…
 * ```
 */
export function stackArmourResistance(
    bulkhead: number,
    reinforcements: readonly number[] = [],
): number {
    return 1 - armourMultiplier(bulkhead, reinforcements);
}

/**
 * The extra shield resistance pips to SYS buy, on top of the generator and boosters.
 *
 * @param pips - Pips to the systems capacitor, `0`–`4`. Fractional pips are allowed —
 * the game's own curve is continuous.
 * @returns The resistance the pips add, as a fraction: `0` at no pips rising to `0.6`
 * (60%) at four, following `0.6 × (pips / 4) ^ 0.85`.
 * @throws {RangeError} If `pips` is not a finite number in `[0, 4]`.
 * @remarks
 * This applies to **every** damage type including absolute, and multiplies with the
 * shield's own resistance rather than adding to it: incoming damage is scaled by
 * `(1 − shieldResistance) × (1 − sysResistance)`.
 * @example
 * ```ts
 * import { systemsResistance } from '@elite-dangerous-almanac/core/ships/resistances';
 *
 * systemsResistance(0); // -> 0
 * systemsResistance(2); // -> 0.333
 * systemsResistance(4); // -> 0.6
 * ```
 */
export function systemsResistance(pips: number): number {
    requirePips('systemsResistance', 'pips', pips);
    return (Math.pow(pips, 0.85) * 0.6) / Math.pow(4, 0.85);
}
