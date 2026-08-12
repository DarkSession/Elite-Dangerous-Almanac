/** The stride one step of `n1` adds to a boxel code: the three letters below it. */
const N1_STRIDE = 26 * 26 * 26;

/**
 * The largest `n1` whose packed code is exact *for every letter triple* — the letters
 * add up to `N1_STRIDE - 1` on top of it, so that headroom has to be reserved rather
 * than dividing the safe range by the stride alone.
 */
const MAX_N1 = Math.floor((Number.MAX_SAFE_INTEGER - (N1_STRIDE - 1)) / N1_STRIDE);

/** The largest code `packBoxelCode` can return: `MAX_N1` with every letter at 25. */
const MAX_BOXEL_CODE = MAX_N1 * N1_STRIDE + (N1_STRIDE - 1);

/**
 * Pack the four numeric boxel-name fields into their base-26 index.
 *
 * @throws {RangeError} If any letter is not an integer in 0–25, or `n1` is not an
 * integer in 0–`MAX_N1`. An out-of-range letter would carry into the next base-26
 * digit, and an `n1` past `MAX_N1` would pack to a rounded code — both name a
 * different boxel than the caller asked for rather than failing.
 */
export function packBoxelCode(l1: number, l2: number, l3: number, n1: number): number {
    for (const v of [l1, l2, l3]) {
        if (!Number.isInteger(v) || v < 0 || v > 25) {
            throw new RangeError(
                `Boxel letters out of range (expected integer 0–25): ${JSON.stringify({ l1, l2, l3 })}`,
            );
        }
    }
    if (!Number.isInteger(n1) || n1 < 0 || n1 > MAX_N1) {
        throw new RangeError(`Boxel number N1 out of range (expected integer 0–${MAX_N1}): ${n1}`);
    }
    return ((n1 * 26 + l3) * 26 + l2) * 26 + l1;
}

/**
 * Assert a packed base-26 boxel code is one {@link packBoxelCode} could have produced.
 *
 * @throws {RangeError} If `boxelCode` is not an integer in 0–`MAX_BOXEL_CODE`. The
 * upper bound keeps the two exact inverses: a larger code unpacks cleanly enough, but
 * to an `n1` that could never have been packed.
 */
export function assertBoxelCode(boxelCode: number): void {
    if (!Number.isInteger(boxelCode) || boxelCode < 0 || boxelCode > MAX_BOXEL_CODE) {
        throw new RangeError(
            `Boxel code out of range (expected integer 0–${MAX_BOXEL_CODE}): ${boxelCode}`,
        );
    }
}
