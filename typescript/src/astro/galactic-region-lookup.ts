/**
 * Resolve a coordinate or system address to its Elite Dangerous **galactic codex
 * region**.
 *
 * The region a system belongs to is fixed by its position on a flat ≈49.35 ly
 * (`4096 / 83` ly) grid over the galactic plane. Each region's cells are stored as
 * run-length geometry in `data/astro/galactic-region-cells.json` (kept separate
 * from the lightweight metadata so metadata-only consumers never bundle it); this
 * module rebuilds a per-row lookup index from them. The per-region metadata objects
 * live in `./galactic-region`.
 *
 * Two lookups are provided, matching the two things the game calls "the region":
 * - {@link findRegionAt} — the region at a set of coordinates (what the codex
 *   records a discovery against, and what is shown when jumping *into* a system).
 * - {@link findRegionForBoxel} — the region of a system's boxel `0/0/0` corner
 *   (what the journal and the codex main page display for the system).
 *
 * These can differ near a region border; see the upstream discussion linked in the
 * data file's attribution.
 *
 * Algorithm ported from klightspeed's EliteDangerousRegionMap (`RegionMap.js`),
 * MIT © Ben Peddell. See `data/astro/galactic-region-cells.json` for attribution.
 *
 * @packageDocumentation
 */

import { getGalacticRegion, type GalacticRegion, type PlanePoint } from './galactic-region.js';
import { decodeSystemAddress } from './system-address.js';
import { boxelEdgeLy } from './mass-code.js';
import cellData from '../../../data/astro/galactic-region-cells.json' with { type: 'json' };

const { projection, regions } = cellData as {
    projection: {
        x0: number;
        y0: number;
        z0: number;
        scaleNumerator: number;
        scaleDenominator: number;
        lyPerCell: number;
        gridWidth: number;
        gridHeight: number;
    };
    regions: readonly {
        id: number;
        // Run-length cell geometry: rows from `minPz` upward (min Z first); each
        // row is a list of [pxStart, runLength] runs.
        cells: { minPz: number; rows: readonly (readonly number[])[][] };
    }[];
};

/**
 * Lookup index rebuilt once from the per-region cell geometry: grid row (pz) ->
 * that row's runs as [pxStart, pxEnd, regionId]. The grid partitions cells with no
 * overlap, so at most one run matches any cell.
 */
const ROW_INDEX: ReadonlyMap<number, readonly [number, number, number][]> = (() => {
    const index = new Map<number, [number, number, number][]>();
    for (const region of regions) {
        const { minPz, rows } = region.cells;
        rows.forEach((runs, i) => {
            const pz = minPz + i;
            let row = index.get(pz);
            if (!row) {
                row = [];
                index.set(pz, row);
            }
            for (const run of runs) {
                const px = run[0] ?? 0;
                const len = run[1] ?? 0;
                row.push([px, px + len, region.id]);
            }
        });
    }
    return index;
})();

/** Galactic X coordinate of the region grid's origin corner, in light-years. */
export const REGION_MAP_X0 = projection.x0;
/** Galactic Y coordinate of the galaxy origin corner, in light-years (for boxel decode). */
export const REGION_MAP_Y0 = projection.y0;
/** Galactic Z coordinate of the region grid's origin corner, in light-years. */
export const REGION_MAP_Z0 = projection.z0;
/** Edge length of one region-grid cell, in light-years (`4096 / 83` ≈ 49.3494). */
export const REGION_MAP_LY_PER_CELL = projection.lyPerCell;

/** The outcome of a region lookup: the resolved region, or `null` when outside the map. */
export type RegionLookup = GalacticRegion | null;

/**
 * A system's boxel `0/0/0` corner (galactic coordinates, in light-years) and the
 * region it falls in.
 */
export interface BoxelRegion {
    /** Galactic X of the boxel corner, in light-years. */
    x: number;
    /** Galactic Y of the boxel corner, in light-years. */
    y: number;
    /** Galactic Z of the boxel corner, in light-years. */
    z: number;
    /** The region at the boxel corner, or `null` if it lies outside the mapped grid. */
    region: RegionLookup;
}

/** Region id at grid cell (px, pz), or `0` when the cell is outside every region. */
function regionIdAtCell(px: number, pz: number): number {
    if (px < 0 || pz < 0 || px >= projection.gridWidth || pz >= projection.gridHeight) {
        return 0;
    }
    const row = ROW_INDEX.get(pz);
    if (!row) return 0;

    for (const [pxStart, pxEnd, id] of row) {
        if (px >= pxStart && px < pxEnd) return id;
    }
    return 0;
}

/**
 * Find the galactic region at a point on the galactic plane.
 *
 * This is the region the game records a codex discovery against, and the region
 * name shown when jumping *into* a system.
 *
 * @param point - Galactic position, in light-years. Only {@link PlanePoint.x} and
 * {@link PlanePoint.z} are read, so a full {@link GalacticCoords} (e.g. a
 * `StarSystem.coords`) can be passed straight through — the vertical `y` is ignored
 * because the region map is a flat X/Z projection.
 * @returns The {@link GalacticRegion} containing the point, or `null` if the point
 * lies outside the mapped region grid.
 * @example
 * ```ts
 * findRegionAt({ x: 0, z: 0 })?.name;      // -> 'Inner Orion Spur' (near Sol)
 * findRegionAt({ x: 0, z: 25900 })?.name;  // -> 'Galactic Centre'
 * ```
 */
export function findRegionAt(point: PlanePoint): RegionLookup {
    const px = Math.floor(((point.x - projection.x0) * projection.scaleNumerator) / projection.scaleDenominator);
    const pz = Math.floor(((point.z - projection.z0) * projection.scaleNumerator) / projection.scaleDenominator);
    return getGalacticRegion(regionIdAtCell(px, pz));
}

/**
 * Find the galactic region of a system's boxel, from its system address (`id64`).
 *
 * This is the region written to the player journal and shown on the codex main
 * page for the system. It is resolved from the `0/0/0` corner of the system's
 * boxel, which can differ from {@link findRegionAt} of the system's exact
 * coordinates near a region border.
 *
 * @param id64 - The 64-bit system address.
 * @returns The boxel corner coordinates and the region there.
 * @example
 * ```ts
 * findRegionForBoxel(5306097239922n).region?.name;
 * ```
 */
export function findRegionForBoxel(id64: bigint): BoxelRegion {
    const { sizeClass, absoluteBoxel } = decodeSystemAddress(id64);
    const edge = boxelEdgeLy(sizeClass);
    const x = absoluteBoxel.x * edge + projection.x0;
    const y = absoluteBoxel.y * edge + projection.y0;
    const z = absoluteBoxel.z * edge + projection.z0;
    return { x, y, z, region: findRegionAt({ x, z }) };
}
