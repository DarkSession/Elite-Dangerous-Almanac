/**
 * Origins of Elite Dangerous **named regions** and the fallback that synthesises
 * an origin for any procedural sector.
 *
 * Encoding a system name to an `id64` needs its region's origin (in internal
 * units, 32 per light-year, measured from the galaxy corner). Hand-authored
 * regions — nebula/cluster sectors such as `Col 285 Sector` or
 * `Cepheus Dark Region B` — have catalogued origins that are *not* aligned to the
 * boxel grid, so they are looked up from data. Any other region is a plain
 * procedural sector whose origin is simply its grid position times the sector
 * size.
 *
 * The catalogue derives from the EDTS/community procedural-naming research and is
 * cross-checked against EDSM/Spansh; see `data/astro/SOURCES.md` for provenance.
 *
 * The catalogue is loaded once from shared JSON (`data/astro/`); the lookup map is
 * an immutable module constant.
 *
 * @packageDocumentation
 */

import { sectorCoordsFromName } from './sector-name.js';
import originsData from '../../../data/astro/named-region-origins.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * A region's origin and extent, in internal units (32 per light-year, measured
 * from the galaxy corner).
 */
export interface RegionOrigin {
    /** The region name, as catalogued. */
    readonly name: string;
    /** Origin X in internal units. */
    readonly x0: number;
    /** Origin Y in internal units. */
    readonly y0: number;
    /** Origin Z in internal units. */
    readonly z0: number;
    /** Extent along X in internal units. */
    readonly sizeX: number;
    /** Extent along Y in internal units. */
    readonly sizeY: number;
    /** Extent along Z in internal units. */
    readonly sizeZ: number;
}

/** Internal units per procedural-sector edge (1280 ly × 32 units/ly). */
export const SECTOR_INTERNAL_SIZE = 40960;

const CATALOGUE: ReadonlyMap<string, RegionOrigin> = new Map(
    deepFreeze(originsData as readonly RegionOrigin[]).map((r) => [r.name.toLowerCase(), r]),
);

/**
 * Look up a hand-authored named region's catalogued origin.
 *
 * @param name - A named region in any casing.
 * @returns Its canonical origin record, or `null` when it is not catalogued.
 */
export function getNamedRegionOrigin(name: string): RegionOrigin | null {
    return CATALOGUE.get(name.toLowerCase()) ?? null;
}

/**
 * Resolve a region name to its origin.
 *
 * Hand-authored regions come from the catalogue; any other name is treated as a
 * procedural sector and its origin synthesised from the sector grid. Returns
 * `null` only when the name is neither catalogued nor a valid procedural sector.
 *
 * @param name - A region (sector) name in any casing.
 * @returns The region origin, or `null` if the name cannot be resolved.
 */
export function resolveRegionOrigin(name: string): RegionOrigin | null {
    const namedOrigin = getNamedRegionOrigin(name);
    if (namedOrigin) return namedOrigin;

    const coords = sectorCoordsFromName(name);
    if (!coords) return null;

    return {
        name,
        x0: coords.x * SECTOR_INTERNAL_SIZE,
        y0: coords.y * SECTOR_INTERNAL_SIZE,
        z0: coords.z * SECTOR_INTERNAL_SIZE,
        sizeX: SECTOR_INTERNAL_SIZE,
        sizeY: SECTOR_INTERNAL_SIZE,
        sizeZ: SECTOR_INTERNAL_SIZE,
    };
}
