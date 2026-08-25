/**
 * The range check a capacitor-pip argument is held to.
 *
 * Pips run from `0` to `4` and may be fractional — the game's own curves are continuous —
 * so the rule is simply "a finite number in that range". It is shared rather than restated
 * because a rule written twice is a rule free to drift, and because the message has to name
 * the **public** function the consumer called and the **public** parameter they wrote. The
 * same allocation reaches `systemsResistance` as `pips` and `shieldMetrics` as
 * `systemsPips`, and each call is told about the name it used.
 *
 * @internal
 */

/**
 * Require a capacitor-pip allocation in `[0, 4]`.
 *
 * @param scope - The public function to name, e.g. `'shieldMetrics'`.
 * @param name - The public parameter to name, e.g. `'systemsPips'`.
 * @param value - The allocation as received.
 * @throws {RangeError} If `value` is not a finite number from `0` through `4`.
 */
export function requirePips(scope: string, name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 4) {
        throw new RangeError(`${scope}: ${name} must be a finite number from 0 to 4`);
    }
}
