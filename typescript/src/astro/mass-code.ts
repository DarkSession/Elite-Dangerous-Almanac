/**
 * Mass-code helpers for Elite Dangerous procedural system names.
 *
 * The lower-case letter after the number-pair in a name (the `d` in
 * `Synuefe EN-H d11-96`) is its **mass code** `a`–`h`. It selects the size of the
 * boxel the system was generated in: an `a` boxel is 10 ly on a side and each
 * subsequent code doubles it, up to `h` at 1280 ly (a whole sector). Internally
 * the same value is the 0–7 **size class** used by the system-address bit layout.
 *
 * @packageDocumentation
 */

import { truncate } from '../internal/argument-guards.js';

/** Number of mass codes (`a`–`h`) / distinct size classes. */
export const MASS_CODE_COUNT = 8;

/** Edge length of an `a`-class boxel, in light-years. */
export const BASE_BOXEL_LY = 10;

const CODE_A = 'a'.charCodeAt(0);

/**
 * Convert a mass-code letter to its 0–7 size class.
 *
 * @param code - A single letter `a`–`h` (case-insensitive).
 * @returns The size class 0–7.
 * @throws {RangeError} If `code` is not a single letter in `a`–`h`.
 * @example
 * ```ts
 * import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
 *
 * massCodeToSizeClass('d'); // -> 3
 * ```
 */
export function massCodeToSizeClass(code: string): number {
    const sizeClass = code.toLowerCase().charCodeAt(0) - CODE_A;
    if (code.length !== 1 || sizeClass < 0 || sizeClass >= MASS_CODE_COUNT) {
        throw new RangeError(`Invalid mass code: ${truncate(JSON.stringify(code))}`);
    }
    return sizeClass;
}

/**
 * Convert a 0–7 size class to its mass-code letter.
 *
 * @param sizeClass - An integer 0–7.
 * @returns The mass-code letter `a`–`h`.
 * @throws {RangeError} If `sizeClass` is outside 0–7.
 * @example
 * ```ts
 * import { sizeClassToMassCode } from '@elite-dangerous-almanac/core/astro/mass-code';
 *
 * sizeClassToMassCode(3); // -> 'd'
 * ```
 */
export function sizeClassToMassCode(sizeClass: number): string {
    if (!Number.isInteger(sizeClass) || sizeClass < 0 || sizeClass >= MASS_CODE_COUNT) {
        throw new RangeError(`Invalid size class: ${truncate(sizeClass)}`);
    }
    return String.fromCharCode(CODE_A + sizeClass);
}

/**
 * Edge length, in light-years, of a boxel of the given size class.
 *
 * @param sizeClass - An integer 0–7 (mass codes `a`–`h`).
 * @returns The boxel edge length in light-years (10, 20, … 1280).
 * @throws {RangeError} If `sizeClass` is not an integer from 0 through 7.
 */
export function boxelEdgeLy(sizeClass: number): number {
    sizeClassToMassCode(sizeClass); // validate the shared 0–7 size-class contract
    return BASE_BOXEL_LY << sizeClass;
}
