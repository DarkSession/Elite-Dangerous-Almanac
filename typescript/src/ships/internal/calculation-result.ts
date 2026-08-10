/**
 * The one constructor for a complete `CalculationResult`.
 *
 * Its own module because two layers build one: the pure calculations in
 * `../loadout-calculations`, and the `ShipLoadout` facade in `../ship-loadout` — which
 * builds one both when an import stated a figure outright and there was nothing to
 * calculate, and when it merges a half-stated figure with the rest calculated. A copy
 * on each side would let the two shapes drift apart, most easily by no longer sharing
 * the frozen empty-issues tuple.
 *
 * @internal
 */

import type { CalculationResult } from '../loadout-calculations.js';

/** The issues of every complete result, shared so no caller can hand back a mutable one. */
const NO_ISSUES: readonly [] = Object.freeze([]);

/**
 * Wrap an already-known value as a complete {@link CalculationResult}.
 *
 * @remarks
 * `T & {}` keeps `null` and `undefined` out of the parameter: a complete result always
 * carries a value, and an absent one belongs in the incomplete branch with an issue
 * naming what is missing.
 *
 * @param value - The known value.
 * @returns A frozen complete result with no issues.
 */
export function completeResult<T>(value: T & {}): CalculationResult<T> {
    return Object.freeze({ value, complete: true, issues: NO_ISSUES });
}
