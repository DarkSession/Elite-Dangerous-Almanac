/** Unserialized precision carried from modifier arithmetic into journal presentation. @internal */

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
