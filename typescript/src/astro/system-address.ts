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
 * These functions are pure bit arithmetic over {@link RegionOrigin} values that
 * the caller supplies; resolving a region name to an origin lives in
 * `./named-regions`. All packing uses `BigInt`, since fields reach bit 55 and JS
 * number bitwise operators truncate to 32 bits.
 *
 * @packageDocumentation
 */

import { lettersToBoxelCode, type SystemNameParts } from './system-name.js';
import type { RegionOrigin } from './named-regions.js';
export { SECTOR_INTERNAL_SIZE } from './named-regions.js';
import type { SectorCoords } from './sector-name.js';

/**
 * Return the boxel edge for a size class in internal units (32 units per ly).
 *
 * @param sizeClass - An integer from 0 through 7.
 * @returns The boxel edge in internal units (320 through 40960).
 * @throws {RangeError} If `sizeClass` is outside 0–7.
 */
export function boxelInternalSize(sizeClass: number): number {
    if (!Number.isInteger(sizeClass) || sizeClass < 0 || sizeClass > 7) {
        throw new RangeError(`Invalid size class: ${sizeClass}`);
    }
    return 320 << sizeClass;
}

/** A system address decoded into its geometric components. */
export interface DecodedAddress {
    /** Size class 0–7 (mass code `a`–`h`). */
    sizeClass: number;
    /** The sector's position on the galaxy grid. */
    sectorCoords: SectorCoords;
    /** The boxel's base-26 index within the sector (the "boxel code"). */
    boxelCode: number;
    /** The system sequence number (`N2`). */
    sequence: number;
    /** The boxel's absolute position on the per-size-class boxel grid. */
    absoluteBoxel: { x: number; y: number; z: number };
}

/**
 * Absolute boxel indices of a name's boxel code, relative to the galaxy origin.
 *
 * This is the inverse of the decode split: it turns the base-26 boxel code back
 * into a grid position by adding the region origin (snapped down to the boxel
 * grid). It throws rather than emit a wrong address when the region origin is
 * unknown, when N1 overflows the code, when the boxel code falls outside the
 * region, or when the resulting sector cannot be represented by the address bits.
 *
 * @param sizeClass - Size class 0–7.
 * @param boxelCode - The base-26 boxel code ({@link lettersToBoxelCode}).
 * @param origin - The resolved region origin (internal units).
 * @throws {Error} If the region origin is unknown.
 * @throws {RangeError} If the code or the resulting sector is out of range.
 */
export function boxelCodeToAbsoluteBoxel(
    sizeClass: number,
    boxelCode: number,
    origin: RegionOrigin,
): { x: number; y: number; z: number } {
    const boxelSize = boxelInternalSize(sizeClass);

    if (origin.x0 < 0 || origin.y0 < 0 || origin.z0 < 0) {
        throw new Error(`Unknown sector: ${origin.name}`);
    }
    if (!Number.isInteger(boxelCode) || boxelCode < 0 || boxelCode > 0x1fffff) {
        throw new RangeError(`System index N1 out of range in ${origin.name}`);
    }

    const bx = boxelCode & 0x7f;
    const by = (boxelCode >> 7) & 0x7f;
    const bz = (boxelCode >> 14) & 0x7f;

    // Boxel codes count from the region origin snapped DOWN to the boxel grid,
    // so a region whose origin is not boxel-aligned reaches one boxel further than
    // size/boxelSize — the bound must include the origin's offset within its boxel.
    if (
        bx * boxelSize >= (origin.x0 % boxelSize) + origin.sizeX ||
        by * boxelSize >= (origin.y0 % boxelSize) + origin.sizeY ||
        bz * boxelSize >= (origin.z0 % boxelSize) + origin.sizeZ
    ) {
        throw new RangeError(`Boxel code out of range for size class ${sizeClass} in ${origin.name}`);
    }

    const x = bx + Math.floor(origin.x0 / boxelSize);
    const y = by + Math.floor(origin.y0 / boxelSize);
    const z = bz + Math.floor(origin.z0 / boxelSize);

    // The address has 7 sector bits for x/z but only 6 for y; a parseable name can
    // still resolve outside that space, and packing it would corrupt other fields.
    if (x >= 1 << (14 - sizeClass) || y >= 1 << (13 - sizeClass) || z >= 1 << (14 - sizeClass)) {
        throw new RangeError(`Sector position of ${origin.name} does not fit a system address`);
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
 */
export function absoluteBoxelToBoxelCode(
    sizeClass: number,
    absoluteBoxel: { x: number; y: number; z: number },
    origin: RegionOrigin,
): number | null {
    const boxelSize = boxelInternalSize(sizeClass);
    if (
        origin.x0 < 0 || origin.y0 < 0 || origin.z0 < 0 ||
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
    if (
        bx * boxelSize >= (origin.x0 % boxelSize) + origin.sizeX ||
        by * boxelSize >= (origin.y0 % boxelSize) + origin.sizeY ||
        bz * boxelSize >= (origin.z0 % boxelSize) + origin.sizeZ
    ) {
        return null;
    }
    return bx | (by << 7) | (bz << 14);
}

/** Reject addresses outside the unsigned 64-bit range before decoding. */
function assertAddressRange(id64: bigint): void {
    if (id64 < 0n || id64 >= 1n << 64n) {
        throw new RangeError(`System address out of range (expected unsigned 64-bit): ${id64}`);
    }
}

/**
 * Decode a system address into its geometric components.
 *
 * @param id64 - The 64-bit system address.
 * @returns The decoded size class, sector, boxel code, sequence and absolute boxel.
 * @throws {RangeError} If `id64` is negative or does not fit in 64 bits.
 */
export function decodeSystemAddress(id64: bigint): DecodedAddress {
    assertAddressRange(id64);
    const addr = id64;
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
        sectorCoords: { x: x2, y: y2, z: z2 },
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
 * @param id64 - The 64-bit modulated system address.
 * @returns The decoded components (same shape as {@link decodeSystemAddress}).
 * @throws {RangeError} If `id64` is negative or does not fit in 64 bits.
 */
export function decodeModSystemAddress(id64: bigint): DecodedAddress {
    assertAddressRange(id64);
    const addr = id64;
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
        sectorCoords: { x: x2, y: y2, z: z2 },
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
 * @param parts - The parsed system-name parts.
 * @param origin - The region origin (from `./named-regions`).
 * @returns The 64-bit system address.
 * @throws {RangeError} If the sequence does not fit its size-class-dependent field.
 */
export function encodeSystemAddress(parts: SystemNameParts, origin: RegionOrigin): bigint {
    const sc = parts.massCode;
    const boxelCode = lettersToBoxelCode(parts.l1, parts.l2, parts.l3, parts.n1);
    const { x, y, z } = boxelCodeToAbsoluteBoxel(sc, boxelCode, origin);

    // The sequence spans bits [44 - 3·sc, 55); the 9 bits above it are the body ID.
    const seqWidth = 11 + sc * 3;
    if (!Number.isInteger(parts.n2) || parts.n2 < 0 || parts.n2 >= 2 ** seqWidth) {
        throw new RangeError(`Sequence ${parts.n2} does not fit in ${seqWidth} bits`);
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
 * @param parts - The parsed system-name parts.
 * @param origin - The region origin (from `./named-regions`).
 * @returns The 64-bit modulated system address.
 * @throws {RangeError} If the sequence does not fit the 15-bit modulated field.
 */
export function encodeModSystemAddress(parts: SystemNameParts, origin: RegionOrigin): bigint {
    const sc = parts.massCode;
    const bps = 7 - sc;
    const boxelMask = 0x7f >> sc;
    const boxelCode = lettersToBoxelCode(parts.l1, parts.l2, parts.l3, parts.n1);
    const { x, y, z } = boxelCodeToAbsoluteBoxel(sc, boxelCode, origin);

    if (!Number.isInteger(parts.n2) || parts.n2 < 0 || parts.n2 > 0x7fff) {
        throw new RangeError(`Sequence ${parts.n2} does not fit in the 15-bit modulated field`);
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
