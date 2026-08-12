/**
 * Pack the four numeric boxel-name fields into their base-26 index.
 *
 * @throws {RangeError} If any letter is not an integer in 0–25, or `n1` is not a
 * non-negative safe integer. Out-of-range fields would otherwise carry into the
 * next base-26 digit and yield a code that is not the caller's boxel.
 */
export function packBoxelCode(l1: number, l2: number, l3: number, n1: number): number {
    for (const v of [l1, l2, l3]) {
        if (!Number.isInteger(v) || v < 0 || v > 25) {
            throw new RangeError(
                `Boxel letters out of range (expected integer 0–25): ${JSON.stringify({ l1, l2, l3 })}`,
            );
        }
    }
    if (!Number.isSafeInteger(n1) || n1 < 0) {
        throw new RangeError(`Boxel number N1 out of range (expected non-negative integer): ${n1}`);
    }
    return ((n1 * 26 + l3) * 26 + l2) * 26 + l1;
}

/**
 * Assert a packed base-26 boxel code is one `packBoxelCode` could have produced.
 *
 * @throws {RangeError} If `boxelCode` is not a non-negative safe integer.
 */
export function assertBoxelCode(boxelCode: number): void {
    if (!Number.isSafeInteger(boxelCode) || boxelCode < 0) {
        throw new RangeError(
            `Boxel code out of range (expected non-negative integer): ${boxelCode}`,
        );
    }
}
