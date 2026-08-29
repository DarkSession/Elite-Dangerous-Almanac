/**
 * The precision journal figures are written at, and the unserialized precision carried
 * between the arithmetic that produces them and their presentation.
 *
 * A journal `Modifiers` value is a stored float32 serialized to six decimal places, so a
 * figure the game *derives* rather than states — a weapon's rate of fire, which follows
 * the firing cycle — has to be derived the same way wherever this library answers for it.
 * Deriving it once here is what keeps a fitted module's `effectiveStats` and the
 * `Modifiers` block attached beside them from describing two different weapons.
 *
 * @internal
 */

import type { EngineeringModifier } from '../slef.js';

const PRECISE_VALUE: unique symbol = Symbol('precise engineering modifier value');

type PreciseEngineeringModifier = EngineeringModifier & {
    readonly [PRECISE_VALUE]?: number;
};

/** Attach the unrounded stored-float value without changing the public modifier shape. */
export function withPreciseModifierValue(
    modifier: EngineeringModifier,
    value: number,
): EngineeringModifier {
    Object.defineProperty(modifier, PRECISE_VALUE, { value });
    return modifier;
}

/** The stored-float value behind a serialized modifier, falling back to its public value. */
export function preciseModifierValue(modifier: EngineeringModifier): number | undefined {
    return (modifier as PreciseEngineeringModifier)[PRECISE_VALUE] ?? modifier.Value;
}

/**
 * The stored-float value one label carries in a block, or `undefined` when it is absent.
 *
 * A block this library computed carries the float behind each serialized value; one a
 * capture wrote carries only the six decimal places it was written with, and that is what
 * is read back. Either way it is the most precise figure available for the label.
 *
 * So a figure derived from it can land one serialized place apart depending on where the
 * block came from: an article built from its own recipe derives its rate of fire from the
 * stored float, while the same article arriving as a capture that states the rounded burst
 * interval derives it from those six decimals. Both are the best answer available from
 * what the producer wrote.
 */
export function preciseValueFor(
    modifiers: readonly EngineeringModifier[] | undefined,
    label: string,
): number | undefined {
    const wanted = label.toLowerCase();
    const found = modifiers?.find((modifier) => modifier.Label.toLowerCase() === wanted);
    return found === undefined ? undefined : preciseModifierValue(found);
}

/** Serialize a stored float to the six decimal places used by journal modifier values. */
export function round6(value: number): number {
    const rounded = Math.round(value * 1e6) / 1e6;
    return Object.is(rounded, -0) ? 0 : rounded;
}

/** The burst parts a recipe moves, which move the firing cycle with them. */
export const BURST_PATTERN_LABELS = ['BurstSize', 'BurstRateOfFire', 'BurstInterval'] as const;

/**
 * A burst part that cannot describe a cycle falls back to one.
 *
 * A weapon that names no burst fires one round per cycle, and an unspecified
 * within-burst rate is one shot a second — as Coriolis (`getRoF`) and EDSY (`bstrof`)
 * both assume. Applied wherever a cycle is built, so the block a module publishes and
 * the stats it resolves cannot part company over a zero.
 */
export function burstPartOrOne(value: number | undefined): number {
    return value !== undefined && value > 0 ? value : 1;
}

/** Frontier's firing-cycle duration, with a float stored after every operation. */
export function float32FiringCycle(
    interval: number,
    burstRounds: number,
    burstRateOfFire: number,
): number | undefined {
    if (interval <= 0) return undefined;
    const rounds = burstPartOrOne(burstRounds);
    const withinBurst =
        rounds > 1
            ? Math.fround(Math.fround(rounds - 1) / Math.fround(burstPartOrOne(burstRateOfFire)))
            : 0;
    const cycle = Math.fround(withinBurst + Math.fround(interval));
    return cycle > 0 ? cycle : undefined;
}

/** Frontier's firing rate derived from one stored firing cycle. */
export function float32RateOfFire(
    interval: number,
    burstRounds: number,
    burstRateOfFire: number,
): number | undefined {
    const cycle = float32FiringCycle(interval, burstRounds, burstRateOfFire);
    return cycle === undefined
        ? undefined
        : Math.fround(Math.fround(burstPartOrOne(burstRounds)) / cycle);
}

/**
 * The rate of fire a journal reports for a firing cycle: Frontier's stored float,
 * serialized the way a `RateOfFire` modifier is written.
 *
 * The one derivation behind every rate of fire this library answers with — the figure a
 * fitted module resolves, the `RateOfFire` its `Modifiers` block states, and what
 * {@link ships!combinedRateOfFire | combinedRateOfFire} returns — so no two of them can
 * differ in the last place a journal serializes.
 */
export function journalRateOfFire(
    interval: number | undefined,
    burstRounds: number | undefined,
    burstRateOfFire: number | undefined,
): number | undefined {
    if (interval === undefined) return undefined;
    const derived = float32RateOfFire(
        interval,
        burstPartOrOne(burstRounds),
        burstPartOrOne(burstRateOfFire),
    );
    return derived === undefined ? undefined : round6(derived);
}
