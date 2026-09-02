/**
 * The Elite Dangerous **system address** (`id64`) — the 64-bit integer that
 * uniquely identifies a system and encodes its procedural origin.
 *
 * The address packs, from the low bit up: the size class (3 bits), then the
 * boxel's absolute grid position split per axis into a sector coordinate and a
 * within-sector offset, and finally the sequence number. Field widths shift with
 * the size class, which is why every accessor is parameterised by it. A second,
 * "modulated" layout ({@link encodeModSystemAddress}) is used by some tools and
 * regroups the same information.
 *
 * These functions are pure bit arithmetic over {@link NamingRegionOrigin} values that
 * the caller supplies; resolving a region name to an origin lives in
 * `./naming-region-origins`. All packing uses `BigInt`, since fields reach bit 55 and JS
 * number bitwise operators truncate to 32 bits.
 *
 * @packageDocumentation
 */

import type { SystemNameParts } from './system-name.js';
import type { NamingRegionOrigin } from './naming-region-origins.js';
import { packBoxelCode } from './internal/system-name-code.js';
import type { SectorGridPosition } from './sector-name.js';
import { toSystemAddress, type SystemAddressInput } from './system-address-input.js';
import { truncate } from '../internal/argument-guards.js';

export type { SystemAddressInput } from './system-address-input.js';

/** The edge of one procedural sector in internal units (1280 ly × 32 units/ly). */
export const SECTOR_INTERNAL_SIZE = 40960;

/**
 * Return the boxel edge for a size class in internal units (32 units per ly).
 *
 * @param sizeClass - An integer from 0 through 7.
 * @returns The boxel edge in internal units (320 through 40960). Divide by 32 for
 * light-years, or use `boxelEdgeLy` from `./mass-code`.
 * @throws {RangeError} If `sizeClass` is outside 0–7.
 * @example
 * ```ts
 * import { boxelInternalSize } from '@elite-dangerous-almanac/core/astro/system-address';
 *
 * boxelInternalSize(3);      // -> 2560 internal units
 * boxelInternalSize(3) / 32; // -> 80 ly, the edge of a d-class boxel
 * ```
 */
export function boxelInternalSize(sizeClass: number): number {
    if (!Number.isInteger(sizeClass) || sizeClass < 0 || sizeClass > 7) {
        throw new RangeError(`Invalid size class: ${truncate(sizeClass)}`);
    }
    return SECTOR_INTERNAL_SIZE >> (7 - sizeClass);
}

/**
 * A boxel's position on the per-size-class boxel grid, counted from the galaxy corner.
 *
 * @remarks
 * These are grid indices, not light-years: one step is one boxel edge, which depends on
 * the size class ({@link boxelEdgeLy} from `./mass-code` converts).
 *
 * @example
 * ```ts
 * import { decodeSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';
 * import type { AbsoluteBoxel } from '@elite-dangerous-almanac/core/astro/system-address';
 *
 * const boxel: AbsoluteBoxel = decodeSystemAddress(3309179996515n).absoluteBoxel;
 * ```
 */
export interface AbsoluteBoxel {
    /** Boxel index along the galactic X axis. */
    readonly x: number;
    /** Boxel index along the galactic Y axis. */
    readonly y: number;
    /** Boxel index along the galactic Z axis. */
    readonly z: number;
}

/** A system address decoded into its geometric components. */
export interface DecodedAddress {
    /** Size class 0–7 (mass code `a`–`h`). */
    readonly sizeClass: number;
    /** The sector's position on the galaxy grid. */
    readonly sectorGridPosition: SectorGridPosition;
    /** The boxel's base-26 index within the sector (the "boxel code"). */
    readonly boxelCode: number;
    /** The system sequence number (`N2`). */
    readonly sequence: number;
    /** The boxel's absolute position on the per-size-class boxel grid. */
    readonly absoluteBoxel: AbsoluteBoxel;
}

/**
 * Absolute boxel indices of a name's boxel code, relative to the galaxy origin.
 *
 * This is the inverse of the decode split: it turns the base-26 boxel code back
 * into a grid position by adding the region origin (snapped down to the boxel
 * grid). It throws rather than emit a wrong address when the origin has a negative
 * coordinate, when N1 overflows the code, when the boxel code falls outside the
 * region, or when the resulting sector cannot be represented by the address bits.
 *
 * @param sizeClass - Size class 0–7 (mass code `a`–`h`).
 * @param boxelCode - The base-26 boxel code ({@link lettersToBoxelCode}).
 * @param origin - The resolved region origin (internal units, 32 per light-year).
 * @returns The boxel's absolute indices on the per-size-class boxel grid, measured
 * from the galaxy corner.
 * @throws {RangeError} If `sizeClass` is outside 0–7, the origin has a negative
 * coordinate, or the code or the resulting sector is out of range.
 */
export function boxelCodeToAbsoluteBoxel(
    sizeClass: number,
    boxelCode: number,
    origin: NamingRegionOrigin,
): AbsoluteBoxel {
    const boxelSize = boxelInternalSize(sizeClass);

    if (origin.x0 < 0 || origin.y0 < 0 || origin.z0 < 0) {
        // An origin from the catalogue never has a negative coordinate, so reaching
        // this means the caller built the origin; the message names the coordinate so
        // they check the origin rather than the region catalogue.
        throw new RangeError(`Region origin "${truncate(origin.name)}" has a negative coordinate`);
    }
    if (!Number.isInteger(boxelCode) || boxelCode < 0 || boxelCode > 0x1fffff) {
        throw new RangeError(`System index N1 out of range in ${truncate(origin.name)}`);
    }

    const bx = boxelCode & 0x7f;
    const by = (boxelCode >> 7) & 0x7f;
    const bz = (boxelCode >> 14) & 0x7f;

    if (!boxelIsWithinRegion(bx, by, bz, boxelSize, origin)) {
        throw new RangeError(
            `Boxel code out of range for size class ${truncate(sizeClass)} in ${truncate(origin.name)}`,
        );
    }

    const x = bx + Math.floor(origin.x0 / boxelSize);
    const y = by + Math.floor(origin.y0 / boxelSize);
    const z = bz + Math.floor(origin.z0 / boxelSize);

    // The address has 7 sector bits for x/z but only 6 for y; a parseable name can
    // still resolve outside that space, and packing it would corrupt other fields.
    if (x >= 1 << (14 - sizeClass) || y >= 1 << (13 - sizeClass) || z >= 1 << (14 - sizeClass)) {
        throw new RangeError(
            `Sector position of ${truncate(origin.name)} does not fit a system address`,
        );
    }

    return { x, y, z };
}

/**
 * Boxel code (base-26 index) of an absolute boxel relative to a region origin,
 * or `null` when the boxel does not sit inside that region.
 *
 * Used by the hand-authored-sector override: the same physical boxel yields a
 * different boxel code under a hand-authored region whose origin differs from
 * the procedural sector's. This is the inverse of {@link boxelCodeToAbsoluteBoxel}.
 *
 * @param sizeClass - Size class 0–7 (mass code `a`–`h`).
 * @param absoluteBoxel - The boxel's absolute grid indices, as
 * {@link decodeSystemAddress} returns in `absoluteBoxel`.
 * @param origin - The region origin to measure against (internal units, 32 per
 * light-year), from `./naming-region-origins`.
 * @returns The base-26 boxel code within that region, or `null` when the boxel lies
 * outside the region or the origin has a negative coordinate.
 * @example
 * ```ts
 * import { resolveNamingRegionOrigin } from '@elite-dangerous-almanac/core/astro/naming-region-origins';
 * import { absoluteBoxelToBoxelCode, decodeSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';
 *
 * declare const id64: bigint;
 *
 * const { sizeClass, absoluteBoxel } = decodeSystemAddress(id64);
 * absoluteBoxelToBoxelCode(sizeClass, absoluteBoxel, resolveNamingRegionOrigin('Pleiades Sector')!);
 * ```
 */
export function absoluteBoxelToBoxelCode(
    sizeClass: number,
    absoluteBoxel: AbsoluteBoxel,
    origin: NamingRegionOrigin,
): number | null {
    const boxelSize = boxelInternalSize(sizeClass);
    if (
        origin.x0 < 0 ||
        origin.y0 < 0 ||
        origin.z0 < 0 ||
        !Number.isInteger(absoluteBoxel.x) ||
        !Number.isInteger(absoluteBoxel.y) ||
        !Number.isInteger(absoluteBoxel.z)
    ) {
        return null;
    }

    const bx = absoluteBoxel.x - Math.floor(origin.x0 / boxelSize);
    const by = absoluteBoxel.y - Math.floor(origin.y0 / boxelSize);
    const bz = absoluteBoxel.z - Math.floor(origin.z0 / boxelSize);
    if (bx < 0 || bx > 0x7f || by < 0 || by > 0x7f || bz < 0 || bz > 0x7f) return null;
    if (!boxelIsWithinRegion(bx, by, bz, boxelSize, origin)) return null;
    return bx | (by << 7) | (bz << 14);
}

/**
 * Whether a boxel's per-region indices still fall inside that region.
 *
 * Boxel codes count from the region origin snapped DOWN to the boxel grid, so a region
 * whose origin is not boxel-aligned reaches one boxel further than `size / boxelSize` —
 * the bound must include the origin's offset within its own boxel.
 */
function boxelIsWithinRegion(
    bx: number,
    by: number,
    bz: number,
    boxelSize: number,
    origin: NamingRegionOrigin,
): boolean {
    return (
        bx * boxelSize < (origin.x0 % boxelSize) + origin.sizeX &&
        by * boxelSize < (origin.y0 % boxelSize) + origin.sizeY &&
        bz * boxelSize < (origin.z0 % boxelSize) + origin.sizeZ
    );
}

/** Reject addresses outside the unsigned 64-bit range before decoding. */
function assertAddressRange(id64: bigint): void {
    if (id64 < 0n || id64 >= 1n << 64n) {
        throw new RangeError(
            `System address out of range (expected unsigned 64-bit): ${truncate(id64)}`,
        );
    }
}

/**
 * Decode a system address into its geometric components.
 *
 * @param id64 - The 64-bit system address, as a `bigint`, a normally parsed
 * journal `number`, or a decimal `string` (see {@link SystemAddressInput}).
 * @returns The decoded size class, sector, boxel code, sequence and absolute boxel.
 * @throws {TypeError} If `id64` is not a usable address representation (a
 * non-integer, or a `number` so large it has already been rounded).
 * @throws {RangeError} If `id64` is negative or does not fit in 64 bits.
 * @example
 * ```ts
 * import { decodeSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';
 * declare const event: { SystemAddress: number }; // an `FSDJump` line, parsed
 *
 * decodeSystemAddress(3309179996515n);
 * // -> { sizeClass: 3, sectorGridPosition: { sectorX: 39, sectorY: 31, sectorZ: 18 }, … }
 *
 * decodeSystemAddress(event.SystemAddress); // a journal number works too
 * ```
 */
export function decodeSystemAddress(id64: SystemAddressInput): DecodedAddress {
    const addr = toSystemAddress(id64);
    assertAddressRange(addr);
    const sc = Number(addr & 7n);

    const z0 = Number((addr >> 3n) & BigInt(0x3fff >> sc));
    const z1 = Number((addr >> 3n) & BigInt(0x7f >> sc));
    const z2 = Number((addr >> BigInt(10 - sc)) & 0x7fn);
    const y0 = Number((addr >> BigInt(17 - sc)) & BigInt(0x1fff >> sc));
    const y1 = Number((addr >> BigInt(17 - sc)) & BigInt(0x7f >> sc));
    const y2 = Number((addr >> BigInt(24 - sc * 2)) & 0x3fn);
    const x0 = Number((addr >> BigInt(30 - sc * 2)) & BigInt(0x3fff >> sc));
    const x1 = Number((addr >> BigInt(30 - sc * 2)) & BigInt(0x7f >> sc));
    const x2 = Number((addr >> BigInt(37 - sc * 3)) & 0x7fn);
    const seq = Number((addr >> BigInt(44 - sc * 3)) & ((1n << BigInt(11 + sc * 3)) - 1n));

    return {
        sizeClass: sc,
        sectorGridPosition: { sectorX: x2, sectorY: y2, sectorZ: z2 },
        boxelCode: x1 | (y1 << 7) | (z1 << 14),
        sequence: seq,
        absoluteBoxel: { x: x0, y: y0, z: z0 },
    };
}

/**
 * Decode a **modulated** system address into its geometric components.
 *
 * @remarks
 * The modulated form is an alternative bit-layout of the *same* system, used by
 * some community tools and data dumps. If you have a normal `id64` (the usual
 * case — journal, EDSM, EDDN, Spansh all use it), reach for
 * {@link decodeSystemAddress} instead; use this only when a source specifically
 * hands you a modulated address.
 *
 * @param id64 - The 64-bit modulated system address, as a `bigint`, a safe-integer
 * `number`, or a decimal `string` (see {@link SystemAddressInput}). A modulated
 * address packs the sector into the high bits, so it routinely exceeds `2^53`;
 * those values must be supplied as a `bigint` or string because a JS `number` has
 * already lost precision.
 * @returns The decoded components (same shape as {@link decodeSystemAddress}).
 * @throws {TypeError} If `id64` is not a usable address representation.
 * @throws {RangeError} If `id64` is negative or does not fit in 64 bits.
 * @example
 * ```ts
 * import { decodeModSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';
 *
 * declare const modAddressFromSomeTool: bigint;
 *
 * decodeModSystemAddress(modAddressFromSomeTool).sectorGridPosition;
 * // -> { sectorX, sectorY, sectorZ }
 * ```
 */
export function decodeModSystemAddress(id64: SystemAddressInput): DecodedAddress {
    const addr = toSystemAddress(id64);
    assertAddressRange(addr);
    const seq = Number(addr & 0x7fffn);
    const boxelCode = Number((addr >> 16n) & 0x1fffffn);
    const sc = Number((addr >> 37n) & 7n);
    const x2 = Number((addr >> 40n) & 0x7fn);
    const y2 = Number((addr >> 47n) & 0x3fn);
    const z2 = Number((addr >> 53n) & 0x7fn);

    // Rebuild absolute boxel indices: sector coordinate shifted above the
    // within-sector boxel bits, plus the low bits carried in `boxelCode`.
    const bps = 7 - sc;
    const boxelMask = 0x7f >> sc;
    return {
        sizeClass: sc,
        sectorGridPosition: { sectorX: x2, sectorY: y2, sectorZ: z2 },
        boxelCode,
        sequence: seq,
        absoluteBoxel: {
            x: (x2 << bps) | (boxelCode & boxelMask),
            y: (y2 << bps) | ((boxelCode >> 7) & boxelMask),
            z: (z2 << bps) | ((boxelCode >> 14) & boxelMask),
        },
    };
}

/**
 * Encode system-name parts and a resolved region origin into a system address.
 *
 * @param parts - The parsed system-name parts, as {@link parseSystemName} returns
 * (letters and mass code are zero-based numeric indices, not characters).
 * @param origin - The region origin (internal units), from
 * `resolveNamingRegionOrigin` in `./naming-region-origins`.
 * @returns The 64-bit system address.
 * @throws {RangeError} If the mass code is outside 0–7, a letter is outside 0–25, `n1`
 * is not one the boxel packer accepts, the origin has a negative coordinate, the name's
 * boxel code or sector falls outside the address layout, or the sequence does not fit
 * its size-class-dependent field.
 * @example
 * ```ts
 * import { resolveNamingRegionOrigin } from '@elite-dangerous-almanac/core/astro/naming-region-origins';
 * import { encodeSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';
 * import { parseSystemName } from '@elite-dangerous-almanac/core/astro/system-name';
 *
 * const parts = parseSystemName('Synuefe EN-H d11-96')!;
 * encodeSystemAddress(parts, resolveNamingRegionOrigin(parts.regionName)!); // -> 3309179996515n
 * ```
 */
export function encodeSystemAddress(parts: SystemNameParts, origin: NamingRegionOrigin): bigint {
    const sc = parts.massCode;
    const boxelCode = packBoxelCode(parts.l1, parts.l2, parts.l3, parts.n1);
    const { x, y, z } = boxelCodeToAbsoluteBoxel(sc, boxelCode, origin);

    // The sequence spans bits [44 - 3·sc, 55); the 9 bits above it are the body ID.
    const seqWidth = 11 + sc * 3;
    if (!Number.isInteger(parts.n2) || parts.n2 < 0 || parts.n2 >= 2 ** seqWidth) {
        throw new RangeError(`Sequence ${truncate(parts.n2)} does not fit in ${seqWidth} bits`);
    }

    return (
        BigInt(sc) |
        (BigInt(z) << 3n) |
        (BigInt(y) << BigInt(17 - sc)) |
        (BigInt(x) << BigInt(30 - sc * 2)) |
        (BigInt(parts.n2) << BigInt(44 - sc * 3))
    );
}

/**
 * Encode system-name parts and a resolved region origin into a **modulated**
 * address.
 *
 * @remarks
 * Prefer {@link encodeSystemAddress} for the normal `id64`; use the modulated
 * form only when a tool you are feeding expects that specific layout.
 *
 * @param parts - The parsed system-name parts, as {@link parseSystemName} returns.
 * @param origin - The region origin (internal units), from `resolveNamingRegionOrigin`.
 * @returns The 64-bit modulated system address. These routinely exceed `2^53`, so
 * keep them as `bigint` (or a decimal string) rather than a JS `number`.
 * @throws {RangeError} If the mass code is outside 0–7, a letter is outside 0–25, `n1`
 * is not one the boxel packer accepts, the origin has a negative coordinate, the name's
 * boxel code or sector falls outside the address layout, or the sequence does not fit
 * the 15-bit modulated field.
 * @example
 * ```ts
 * import { resolveNamingRegionOrigin } from '@elite-dangerous-almanac/core/astro/naming-region-origins';
 * import { encodeModSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';
 * import { parseSystemName } from '@elite-dangerous-almanac/core/astro/system-name';
 *
 * const parts = parseSystemName('Synuefe EN-H d11-96')!;
 * encodeModSystemAddress(parts, resolveNamingRegionOrigin(parts.regionName)!).toString();
 * ```
 */
export function encodeModSystemAddress(parts: SystemNameParts, origin: NamingRegionOrigin): bigint {
    const sc = parts.massCode;
    const bps = 7 - sc;
    const boxelMask = 0x7f >> sc;
    const boxelCode = packBoxelCode(parts.l1, parts.l2, parts.l3, parts.n1);
    const { x, y, z } = boxelCodeToAbsoluteBoxel(sc, boxelCode, origin);

    if (!Number.isInteger(parts.n2) || parts.n2 < 0 || parts.n2 > 0x7fff) {
        throw new RangeError(
            `Sequence ${truncate(parts.n2)} does not fit in the 15-bit modulated field`,
        );
    }

    const packedBoxel = (x & boxelMask) | ((y & boxelMask) << 7) | ((z & boxelMask) << 14);
    return (
        BigInt(parts.n2) |
        (BigInt(packedBoxel) << 16n) |
        (BigInt(sc) << 37n) |
        (BigInt((x >> bps) & 0x7f) << 40n) |
        (BigInt((y >> bps) & 0x3f) << 47n) |
        (BigInt((z >> bps) & 0x7f) << 53n)
    );
}
