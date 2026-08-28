/**
 * Shared assertion for the body-calculation suites.
 *
 * @internal
 */

import assert from 'node:assert/strict';

/**
 * Assert a computed quantity matches the shared fixture's expectation.
 *
 * The fixture stores 12 significant figures, so a figure is compared relatively rather
 * than exactly; `null` is compared as itself, since "cannot be computed" is an answer in
 * its own right and must never pass as a near miss for a number.
 *
 * @param actual - What the calculation returned.
 * @param expected - What the fixture pins.
 * @internal
 */
export function assertQuantity(actual: number | null | undefined, expected: number | null): void {
    if (expected === null) {
        assert.equal(actual ?? null, null);
        return;
    }
    assert.equal(typeof actual, 'number', `expected ${expected}, received ${actual}`);
    const tolerance = Math.max(Math.abs(expected) * 1e-9, 1e-9);
    assert.ok(
        Math.abs((actual as number) - expected) <= tolerance,
        `expected ${expected}, received ${actual}`,
    );
}
