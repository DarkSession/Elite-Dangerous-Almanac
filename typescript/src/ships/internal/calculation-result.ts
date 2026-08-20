/**
 * The one constructor for a complete `CalculationResult`.
 *
 * Its own module because two layers build one: the per-metric diagnostics in
 * `./loadout-metrics`, and the `ShipLoadout` facade in `../ship-loadout`, whose
 * `standardLoadResult` resolves a load condition the fitted drive may not support. A
 * copy on each side would let the two shapes drift apart, most easily by no longer
 * sharing the frozen empty-issues tuple.
 *
 * @internal
 */

import type { CalculationIssue, CalculationResult } from '../loadout-calculations.js';

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

/** Wrap one or more missing or unavailable dependencies as an incomplete result. */
export function incompleteResult<T>(
    issues: readonly [CalculationIssue, ...CalculationIssue[]],
): CalculationResult<T> {
    return Object.freeze({
        value: null,
        complete: false,
        issues: Object.freeze(
            issues.map((issue) =>
                Object.freeze({
                    ...issue,
                    ...(issue.params ? { params: Object.freeze({ ...issue.params }) } : {}),
                }),
            ),
        ) as readonly [CalculationIssue, ...CalculationIssue[]],
    });
}
