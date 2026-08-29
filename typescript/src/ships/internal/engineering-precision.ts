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

/** Frontier's firing-cycle duration, with a float stored after every operation. */
export function float32FiringCycle(
    interval: number,
    burstRounds: number,
    burstRateOfFire: number,
): number | undefined {
    if (interval <= 0) return undefined;
    const withinBurst =
        burstRounds > 1
            ? Math.fround(Math.fround(burstRounds - 1) / Math.fround(burstRateOfFire))
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
    return cycle === undefined ? undefined : Math.fround(Math.fround(burstRounds) / cycle);
}

/**
 * The rate of fire a journal reports for a firing cycle: Frontier's stored float,
 * serialized the way a `RateOfFire` modifier is written.
 *
 * This is the figure to write into a stat that a modifier block also states, so that the
 * two never differ in their last serialized place. Zero and negative burst parts fall
 * back to one, as {@link ships!combinedRateOfFire | combinedRateOfFire} does.
 */
export function journalRateOfFire(
    interval: number | undefined,
    burstRounds: number | undefined,
    burstRateOfFire: number | undefined,
): number | undefined {
    if (interval === undefined) return undefined;
    const rounds = burstRounds !== undefined && burstRounds > 0 ? burstRounds : 1;
    const rate = burstRateOfFire !== undefined && burstRateOfFire > 0 ? burstRateOfFire : 1;
    const derived = float32RateOfFire(interval, rounds, rate);
    return derived === undefined ? undefined : round6(derived);
}
