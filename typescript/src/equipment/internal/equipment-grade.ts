/** The shared grade-argument guard for the personal-equipment lookups. @internal */

import type { EquipmentGrade } from '../suits.js';

/**
 * Require an integer Pioneer Supplies grade.
 *
 * Suits and handheld weapons share one grade scale, so they share one guard and one
 * message. A grade outside it is well-formed but unsupported, which is a `RangeError`
 * rather than a miss — the grade names a rung of the upgrade ladder, not a record to
 * find, so there is no "no such thing" answer for `6` to mean.
 *
 * @param grade - The grade as received.
 * @param functionName - The public function to name in the message.
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 * @internal
 */
export function assertEquipmentGrade(
    grade: number,
    functionName: string,
): asserts grade is EquipmentGrade {
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`${functionName}: grade must be an integer in [1, 5]`);
    }
}
