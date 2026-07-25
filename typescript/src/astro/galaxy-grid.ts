/**
 * Turning a **galactic position** into a place on the procedural naming grid.
 *
 * `./sector-name` maps a *sector index* to a name, and `./system-address` works in
 * *internal units* (32 per light-year, measured from the galaxy's corner). Neither
 * speaks the units a consumer actually holds: light-years with Sol at the origin,
 * as reported by the player journal, EDSM and Spansh. This module is the bridge —
 * it converts {@link GalacticCoords} to the {@link SectorCoords} those functions
 * want, so `sectorNameFromCoords` can be driven from real data.
 *
 * The three coordinate conventions on the public surface, in one place:
 *
 * | Convention | Unit | Origin | Where |
 * | --- | --- | --- | --- |
 * | {@link GalacticCoords} | light-years | Sol | journal, EDSM, Spansh, this module's input |
 * | {@link SectorCoords} | 1280 ly sector cubes (0–127) | galaxy corner | `sectorNameFromCoords` |
 * | internal units | 1/32 light-year | galaxy corner | `RegionOrigin`, boxel maths |
 *
 * @packageDocumentation
 */

import type { GalacticCoords } from './coords.js';
import { sectorNameFromCoords, type SectorCoords } from './sector-name.js';

/**
 * The galaxy's origin corner in galactic light-years — the point sector index
 * `0/0/0` starts at.
 *
 * @remarks
 * Sector and boxel positions are measured from this corner, which is why an
 * `id64`'s grid position has to be offset by it to become a position relative to
 * Sol. The same triple is published as `REGION_MAP_X0` / `_Y0` / `_Z0` by
 * `./galactic-region-lookup` (where it arrives with the region-cell data); it is
 * repeated here as a plain constant so converting a coordinate never pulls in the
 * region grid. A test asserts the two agree.
 */
export const GALAXY_ORIGIN: Readonly<GalacticCoords> = Object.freeze({
    x: -49985,
    y: -40985,
    z: -24105,
});

/** Edge length of one procedural sector cube, in light-years. */
export const SECTOR_EDGE_LY = 1280;

/**
 * The sector cube a galactic position falls in.
 *
 * @param coords - Galactic position in **light-years, Sol at the origin** (a journal
 * `StarPos`, an EDSM/Spansh coordinate, a `StarSystem.coords`).
 * @returns The integer {@link SectorCoords} of the 1280 ly sector cube containing
 * that point, ready for {@link sectorNameFromCoords}.
 * @throws {RangeError} If the position lies outside the 128×128×128 sector grid
 * (i.e. outside the addressable galaxy). The message names the offending position.
 * @example
 * ```ts
 * // Synuefe EN-H d11-96 sits at (751, -179, -91) per EDSM
 * sectorCoordsFromGalacticCoords({ x: 751, y: -179, z: -91 }); // -> { x: 39, y: 31, z: 18 }
 * ```
 */
export function sectorCoordsFromGalacticCoords(coords: GalacticCoords): SectorCoords {
    const sector = {
        x: Math.floor((coords.x - GALAXY_ORIGIN.x) / SECTOR_EDGE_LY),
        y: Math.floor((coords.y - GALAXY_ORIGIN.y) / SECTOR_EDGE_LY),
        z: Math.floor((coords.z - GALAXY_ORIGIN.z) / SECTOR_EDGE_LY),
    };
    for (const v of [sector.x, sector.y, sector.z]) {
        if (!Number.isInteger(v) || v < 0 || v > 127) {
            throw new RangeError(
                `Galactic position outside the sector grid: ${JSON.stringify(coords)}`,
            );
        }
    }
    return sector;
}

/**
 * The procedural sector name for a galactic position.
 *
 * The one-call form of {@link sectorCoordsFromGalacticCoords} followed by
 * {@link sectorNameFromCoords} — "which sector is this point in?".
 *
 * @param coords - Galactic position in **light-years, Sol at the origin**.
 * @returns The canonically-cased procedural sector name (e.g. `Synuefe`,
 * `Blae Eock`).
 * @throws {RangeError} If the position lies outside the sector grid, or the grid
 * slot has no procedurally assigned name.
 * @remarks
 * This is always the *procedural* sector. A system inside a hand-authored region
 * (Pleiades, Coalsack, …) is named after that region instead — resolve those with
 * `handAuthoredRegionForCoords` from `./hand-authored-regions`.
 * @example
 * ```ts
 * sectorNameFromGalacticCoords({ x: 751, y: -179, z: -91 }); // -> 'Synuefe'
 * ```
 */
export function sectorNameFromGalacticCoords(coords: GalacticCoords): string {
    return sectorNameFromCoords(sectorCoordsFromGalacticCoords(coords));
}
