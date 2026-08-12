/**
 * Parsing and formatting of Elite Dangerous procedural system names.
 *
 * A procedural system name has the shape `Region LL-L m[N1-]N2`, e.g.
 * `Synuefe EN-H d11-96` or `Blae Eock KC-C d0`. Its parts are:
 *
 * - **Region** — the sector name (procedural, e.g. `Synuefe`, or hand-authored,
 *   e.g. `Pleiades Sector`).
 * - **L1 L2 L3** — three letters (`EN-H`) giving the boxel's position within the
 *   sector, together with **N1**.
 * - **Mass code** — the size class `a`–`h`.
 * - **N1 / N2** — the boxel's high index and the system's sequence number. When
 *   N1 is zero the game omits it (and its hyphen), so `…d0`, not `…d0-0`.
 *
 * This module only handles the *textual* form. The bit-packed `id64`
 * (system address) lives in `./system-address`.
 *
 * @packageDocumentation
 */

import { canonicalizeSectorName, sectorGridPositionFromName } from './sector-name.js';
import { getHandAuthoredRegionOrigin } from './naming-region-origins.js';
import { assertBoxelCode, packBoxelCode } from './internal/system-name-code.js';

/**
 * The parsed parts of a procedural system name. Letters and mass code are stored
 * as zero-based indices, not characters, so they can feed the address encoder
 * directly.
 */
export interface SystemNameParts {
    /** The region (sector) name, as written — casing is fixed up on canonicalize. */
    readonly regionName: string;
    /** First boxel letter, 0–25 (`A`–`Z`). */
    readonly l1: number;
    /** Second boxel letter, 0–25. */
    readonly l2: number;
    /** Third boxel letter, 0–25. */
    readonly l3: number;
    /** Mass code as a 0–7 size class (`a`–`h`). */
    readonly massCode: number;
    /** High boxel index (the `N1` before the hyphen); 0 when the name omits it. */
    readonly n1: number;
    /** System sequence number (`N2`). */
    readonly n2: number;
}

const CODE_A_UPPER = 'A'.charCodeAt(0);
const CODE_A_LOWER = 'a'.charCodeAt(0);

/**
 * Pack a boxel's `(l1, l2, l3, n1)` letter code into the single base-26 index the
 * address format uses (the **boxel code**).
 *
 * @param l1 - First letter as a zero-based index, `0`–`25` (`A`–`Z`).
 * @param l2 - Second letter as a zero-based index, `0`–`25`.
 * @param l3 - Third letter as a zero-based index, `0`–`25`.
 * @param n1 - The boxel number that follows the letters (`d11-96` → `11`), a
 *   non-negative integer small enough that the packed code stays exact.
 * @returns The packed base-26 boxel code.
 * @throws {RangeError} If any letter is not an integer in 0–25, or `n1` is negative,
 * fractional, or large enough that the packed code would be rounded. Such a field
 * packs as a different boxel than the one asked for rather than failing.
 * @example
 * ```ts
 * import { lettersToBoxelCode } from '@elite-dangerous-almanac/core/astro/system-name';
 *
 * lettersToBoxelCode(4, 13, 7, 11); // the 'EN-H …11' boxel of a d-class sector
 * ```
 */
export function lettersToBoxelCode(l1: number, l2: number, l3: number, n1: number): number {
    return packBoxelCode(l1, l2, l3, n1);
}

/**
 * A boxel's letter code unpacked — the `EN-H …11` half of a procedural name.
 *
 * @remarks
 * The same four fields {@link SystemNameParts} carries, without the region name, mass
 * code and sequence that complete a name.
 *
 * @example
 * ```ts
 * import { boxelCodeToLetters } from '@elite-dangerous-almanac/core/astro/system-name';
 * import type { BoxelLetters } from '@elite-dangerous-almanac/core/astro/system-name';
 *
 * const code: BoxelLetters = boxelCodeToLetters(198_410);
 * // -> { l1: 4, l2: 13, l3: 7, n1: 11 }, the 'EN-H …11' boxel
 * ```
 */
export interface BoxelLetters {
    /** First letter as a zero-based index, `0`–`25`. */
    readonly l1: number;
    /** Second letter as a zero-based index, `0`–`25`. */
    readonly l2: number;
    /** Third letter as a zero-based index, `0`–`25`. */
    readonly l3: number;
    /** The boxel number that follows the letters (`d11-96` → `11`). */
    readonly n1: number;
}

/**
 * Unpack a base-26 boxel code into its `(l1, l2, l3, n1)` letter code — the inverse
 * of {@link lettersToBoxelCode}.
 *
 * @param boxelCode - The packed base-26 boxel code, as `decodeSystemAddress` returns.
 *   Must be a non-negative integer {@link lettersToBoxelCode} could have packed.
 * @returns The three letter indices (`0`–`25` each) and the boxel number `n1`.
 * @throws {RangeError} If `boxelCode` is negative, fractional, or beyond the largest
 * exactly packable code — no such code can be packed, and a negative one would yield
 * letters outside `0`–`25`.
 * @example
 * ```ts
 * import { boxelCodeToLetters, lettersToBoxelCode } from '@elite-dangerous-almanac/core/astro/system-name';
 *
 * boxelCodeToLetters(lettersToBoxelCode(4, 13, 7, 11)); // -> { l1: 4, l2: 13, l3: 7, n1: 11 }
 * ```
 */
export function boxelCodeToLetters(boxelCode: number): BoxelLetters {
    assertBoxelCode(boxelCode);
    return {
        l1: boxelCode % 26,
        l2: Math.trunc(boxelCode / 26) % 26,
        l3: Math.trunc(boxelCode / (26 * 26)) % 26,
        n1: Math.trunc(boxelCode / (26 * 26 * 26)),
    };
}

/**
 * Parse a procedural system name into its parts.
 *
 * The region name may itself contain digits (`Col 285 Sector`), so parsing walks
 * the suffix backwards from the end. Returns `null` for anything that is not a
 * well-formed procedural system name.
 *
 * @remarks
 * Parsing does **not** canonicalize casing: `regionName` is captured verbatim from
 * the input (`parseSystemName('synuefe …').regionName === 'synuefe'`). The letters
 * and mass code become numeric indices, so re-formatting them is always canonical,
 * but the region is not — use {@link canonicalizeSystemName} (or build a
 * {@link ProceduralSystem} via `ProceduralSystem.fromName`) if you need the region re-cased too.
 *
 * @param name - A system name in any casing, e.g. `blae eock kc-c d0`.
 * @returns The parsed parts, or `null` if the name is malformed.
 */
export function parseSystemName(name: string): SystemNameParts | null {
    if (name == null) return null;
    const s = name;
    const lower = s.toLowerCase();
    let i = s.length - 1;

    // The fixed tail " LL-L mN2" is 9 chars, so the whole name needs ≥10 chars
    // (region ≥2), e.g. "Th aa-a a0". Faithful to the EDTS reference bound, which
    // likewise never accepts a 1-char region (none exist in game).
    if (i < 9) return null;
    if (lower[i]! < '0' || lower[i]! > '9') return null;

    while (i > 8 && lower[i]! >= '0' && lower[i]! <= '9') i--;
    const n2 = Number.parseInt(lower.substring(i + 1), 10);
    if (Number.isNaN(n2)) return null;

    let n1 = 0;
    if (lower[i] === '-') {
        i--;
        const vend = i;
        while (i > 8 && lower[i]! >= '0' && lower[i]! <= '9') i--;
        if (i === vend) return null;
        n1 = Number.parseInt(lower.substring(i + 1, vend + 1), 10);
        if (Number.isNaN(n1)) return null;
    }

    if (lower[i]! < 'a' || lower[i]! > 'h') return null; // mass code
    const massCode = lower.charCodeAt(i) - CODE_A_LOWER;
    i--;

    if (lower[i] !== ' ') return null;
    i--;

    if (lower[i]! < 'a' || lower[i]! > 'z') return null; // L3
    const l3 = lower.charCodeAt(i) - CODE_A_LOWER;
    i--;

    if (lower[i] !== '-') return null;
    i--;

    if (lower[i]! < 'a' || lower[i]! > 'z') return null; // L2
    const l2 = lower.charCodeAt(i) - CODE_A_LOWER;
    i--;

    if (lower[i]! < 'a' || lower[i]! > 'z') return null; // L1
    const l1 = lower.charCodeAt(i) - CODE_A_LOWER;
    i--;

    if (lower[i] !== ' ') return null;
    i--;

    return { regionName: s.substring(0, i + 1), l1, l2, l3, massCode, n1, n2 };
}

/**
 * Format parts back into a system name. N1 (and its hyphen) is omitted when zero,
 * matching the in-game rendering.
 *
 * @remarks
 * Letters and mass code are rendered from their numeric indices, so they always
 * come out canonically cased. The `regionName`, however, is emitted **as stored** —
 * `formatSystemName` does not re-case it. Round-tripping a lower-cased name through
 * {@link parseSystemName} → `formatSystemName` therefore keeps the region's original
 * casing (`synuefe EN-H d11-96`); for a fully canonical name use
 * {@link canonicalizeSystemName} or `ProceduralSystem.fromName(...).name`.
 *
 * @param parts - The system-name parts to render.
 * @returns The system name, e.g. `Synuefe EN-H d11-96`.
 */
export function formatSystemName(parts: SystemNameParts): string {
    const l1 = String.fromCharCode(CODE_A_UPPER + parts.l1);
    const l2 = String.fromCharCode(CODE_A_UPPER + parts.l2);
    const l3 = String.fromCharCode(CODE_A_UPPER + parts.l3);
    const mc = String.fromCharCode(CODE_A_LOWER + parts.massCode);
    const n1 = Math.trunc(parts.n1);
    const n2 = Math.trunc(parts.n2);
    const index = n1 !== 0 ? `${n1}-${n2}` : `${n2}`;
    return `${parts.regionName} ${l1}${l2}-${l3} ${mc}${index}`;
}

/**
 * Fix the casing of a system name. Procedural regions are round-tripped through
 * the grid; catalogued hand-authored regions are looked up case-insensitively.
 * Unknown region strings are left untouched so syntactic parsing remains separate
 * from address encodability.
 *
 * @param name - A system name in any casing.
 * @returns The canonically-cased name, or `null` if it is not a system name.
 */
export function canonicalizeSystemName(name: string): string | null {
    const parts = parseSystemName(name);
    if (!parts) return null;
    return formatSystemName({
        ...parts,
        regionName:
            canonicalizeSectorName(parts.regionName) ??
            getHandAuthoredRegionOrigin(parts.regionName)?.name ??
            parts.regionName,
    });
}

/** Options for {@link isProceduralSystemName}. */
export interface IsProceduralSystemNameOptions {
    /**
     * When `true`, also require the region to parse as a procedural sector, so
     * hand-authored region names (e.g. `Pleiades Sector HR-W d1-79`) are rejected.
     * Defaults to `false`.
     */
    readonly strict?: boolean;
}

/**
 * Whether a string is a well-formed procedural system name.
 *
 * @param name - The candidate name.
 * @param options - See {@link IsProceduralSystemNameOptions}.
 * @returns `true` when the name parses as a procedural system name. A hand-named
 * system (`Sol`, `Maia`) is `false`: it is a real system, just not a procedural name.
 * @example
 * ```ts
 * import { isProceduralSystemName } from '@elite-dangerous-almanac/core/astro/system-name';
 *
 * isProceduralSystemName('Blae Eock KC-C d0');                    // -> true
 * isProceduralSystemName('Pleiades Sector HR-W d1-79');           // -> true
 * isProceduralSystemName('Pleiades Sector HR-W d1-79', { strict: true }); // -> false
 * ```
 */
export function isProceduralSystemName(
    name: string,
    options: IsProceduralSystemNameOptions = {},
): boolean {
    const parts = parseSystemName(name?.trim());
    if (!parts) return false;
    return options.strict ? sectorGridPositionFromName(parts.regionName) !== null : true;
}
