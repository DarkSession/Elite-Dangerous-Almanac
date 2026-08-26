/**
 * The range checks a public numeric argument is held to.
 *
 * Both rules are shared rather than restated because a rule written twice is a rule free
 * to drift, and because each message has to name the **public** function the consumer
 * called and the **public** parameter they wrote. The same allocation reaches
 * `systemsResistance` as `pips` and `shieldCapacitorMetrics` as `systemsPips`, and each
 * call is told about the name it used.
 *
 * @internal
 */

/**
 * Require a capacitor-pip allocation in `[0, 4]`.
 *
 * Pips run from `0` to `4` and may be fractional — the game's own curves are continuous —
 * so the rule is simply "a finite number in that range".
 *
 * @param scope - The public function to name, e.g. `'shieldCapacitorMetrics'`.
 * @param name - The public parameter to name, e.g. `'systemsPips'`.
 * @param value - The allocation as received.
 * @returns `value`, for a caller that reads the allocation back.
 * @throws {RangeError} If `value` is not a finite number from `0` through `4`.
 */
export function requirePips(scope: string, name: string, value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 4) {
        throw new RangeError(`${scope}: ${name} must be a finite number from 0 to 4`);
    }
    return value;
}

/**
 * Require a finite, non-negative number.
 *
 * @param scope - The public function to name, e.g. `'mobilityMetrics'`.
 * @param name - The public parameter or field to name.
 * @param value - The value as received.
 * @returns `value`, for a caller that reads the figure back.
 * @throws {RangeError} If `value` is not a finite number of zero or more.
 */
export function requireFiniteNonNegative(scope: string, name: string, value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${scope}: ${name} must be a finite non-negative number`);
    }
    return value;
}
