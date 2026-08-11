/**
 * Origins of Elite Dangerous **naming regions** and the fallback that synthesises
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
 * The catalogue derives from the EDTS reference implementation and community procedural-naming
 * research, cross-checked against EDSM/Spansh; see [`data/astro/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md) for
 * provenance.
 *
 * The catalogue is loaded once from shared JSON ([`data/astro/`](https://github.com/DarkSession/Elite-Dangerous-Almanac/tree/main/data/astro)); the lookup map is
 * an immutable module constant.
 *
 * @packageDocumentation
 */

import { sectorGridPositionFromName, sectorNameFromGridPosition } from './sector-name.js';
import { SECTOR_INTERNAL_SIZE } from './system-address.js';
import originsData from '../../../data/astro/named-region-origins.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { normalizeKey } from '../internal/registry-index.js';

export { SECTOR_INTERNAL_SIZE } from './system-address.js';

/**
 * A region's origin and extent, in internal units (32 per light-year, measured
 * from the galaxy corner).
 *
 * @example
 * ```ts
 * import type { NamingRegionOrigin } from '@elite-dangerous-almanac/core/astro/naming-region-origins';
 *
 * const origin: NamingRegionOrigin = {
 *   name: 'Example Sector',
 *   x0: 0, y0: 0, z0: 0,
 *   sizeX: 40960, sizeY: 40960, sizeZ: 40960,
 * };
 * ```
 */
export interface NamingRegionOrigin {
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

const CATALOGUE: ReadonlyMap<string, NamingRegionOrigin> = new Map(
    deepFreeze(originsData as readonly NamingRegionOrigin[]).map((r) => [r.name.toLowerCase(), r]),
);

/**
 * Look up a hand-authored named region's catalogued origin.
 *
 * @param name - A named region in any casing, with optional surrounding whitespace.
 * @returns Its canonical origin record, or `null` when it is not catalogued.
 * @example
 * ```ts
 * import { getHandAuthoredRegionOrigin } from '@elite-dangerous-almanac/core/astro/naming-region-origins';
 *
 * getHandAuthoredRegionOrigin('  PLEIADES SECTOR ')?.name; // -> 'Pleiades Sector'
 * getHandAuthoredRegionOrigin('Synuefe');                  // -> null
 * ```
 */
export function getHandAuthoredRegionOrigin(name: string): NamingRegionOrigin | null {
    return CATALOGUE.get(normalizeKey(name)) ?? null;
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
 * @example
 * ```ts
 * import { resolveNamingRegionOrigin } from '@elite-dangerous-almanac/core/astro/naming-region-origins';
 *
 * resolveNamingRegionOrigin('Pleiades Sector'); // catalogued, hand-authored origin
 * resolveNamingRegionOrigin('Synuefe');         // origin derived from its grid position
 * resolveNamingRegionOrigin('not a region');    // -> null
 * ```
 */
export function resolveNamingRegionOrigin(name: string): NamingRegionOrigin | null {
    const namedOrigin = getHandAuthoredRegionOrigin(name);
    if (namedOrigin) return namedOrigin;

    const position = sectorGridPositionFromName(name);
    if (!position) return null;

    return {
        name: sectorNameFromGridPosition(position),
        x0: position.sectorX * SECTOR_INTERNAL_SIZE,
        y0: position.sectorY * SECTOR_INTERNAL_SIZE,
        z0: position.sectorZ * SECTOR_INTERNAL_SIZE,
        sizeX: SECTOR_INTERNAL_SIZE,
        sizeY: SECTOR_INTERNAL_SIZE,
        sizeZ: SECTOR_INTERNAL_SIZE,
    };
}
