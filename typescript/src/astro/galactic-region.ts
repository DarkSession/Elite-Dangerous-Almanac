/**
 * The 42 **galactic codex regions** of Elite Dangerous, as structured per-region
 * objects.
 *
 * Every star system in the galaxy belongs to exactly one of 42 named regions (plus
 * an implicit "outside the map"). This module exposes each region as a
 * {@link GalacticRegion} object carrying its id, name and pre-computed footprint —
 * area, axis-aligned bounds and centroid on the galactic plane — so consumers can
 * read per-region facts without touching the (much larger) lookup geometry.
 * Resolving a *coordinate or `id64`* to a region lives in `./galactic-region-lookup`,
 * which loads the separate cell grid.
 *
 * The region ids and names come from klightspeed's EliteDangerousRegionMap; the
 * footprint fields are derived from its grayscale region map. See the attribution
 * in `data/astro/galactic-regions.jsonc`.
 *
 * @remarks
 * Region ids are 1–42; id `0` means "outside the mapped region grid" and has no
 * {@link GalacticRegion} object.
 *
 * @packageDocumentation
 */

import regionData from '../../../data/astro/galactic-regions.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/** A 2-D point on the galactic plane (X east/west, Z toward/away from the core), in light-years. */
export interface PlanePoint {
    /** Galactic X coordinate, in light-years. */
    readonly x: number;
    /** Galactic Z coordinate, in light-years. */
    readonly z: number;
}

/**
 * Axis-aligned bounds of a region on the galactic plane, in light-years.
 *
 * @remarks
 * The region map is two-dimensional (X/Z only); the vertical Y axis is not encoded,
 * so regions have no Y extent here.
 */
export interface PlaneBounds {
    /** Minimum galactic X, in light-years. */
    readonly minX: number;
    /** Maximum galactic X, in light-years. */
    readonly maxX: number;
    /** Minimum galactic Z, in light-years. */
    readonly minZ: number;
    /** Maximum galactic Z, in light-years. */
    readonly maxZ: number;
}

/**
 * A single Elite Dangerous galactic codex region.
 *
 * @remarks
 * Footprint fields ({@link GalacticRegion.areaLy2}, {@link GalacticRegion.bounds},
 * {@link GalacticRegion.centroid}) are approximations derived from the ≈49.35 ly
 * region grid, not survey-precise figures.
 */
export interface GalacticRegion {
    /** Region id, 1–42. Stable across releases; matches the codex region ordering. */
    readonly id: number;
    /** Human-readable region name, e.g. `"Inner Orion Spur"`. */
    readonly name: string;
    /**
     * Grayscale value this region has in the upstream `RegionMap.png`
     * (`0xA8` for region 1, decreasing by 4 per id). Useful when cross-referencing
     * the source image.
     */
    readonly grayscale: number;
    /** Number of grid cells the region occupies (each cell ≈49.35 ly square). */
    readonly cellCount: number;
    /** Approximate footprint area on the galactic plane, in square light-years. */
    readonly areaLy2: number;
    /** Axis-aligned bounds on the galactic plane, in light-years. */
    readonly bounds: PlaneBounds;
    /** Cell-weighted centroid on the galactic plane, in light-years. */
    readonly centroid: PlanePoint;
}

/**
 * All 42 galactic regions, ordered by id (index `i` holds region id `i + 1`).
 *
 * @remarks
 * This loads only `galactic-regions.jsonc` (region metadata); the lookup cell grid
 * lives in a separate module, so importing this never bundles it.
 *
 * @example
 * ```ts
 * GALACTIC_REGIONS.length; // -> 42
 * GALACTIC_REGIONS[0].name; // -> 'Galactic Centre'
 * ```
 */
export const GALACTIC_REGIONS: readonly GalacticRegion[] = deepFreeze(
    regionData as readonly GalacticRegion[],
);

const BY_ID: ReadonlyMap<number, GalacticRegion> = new Map(GALACTIC_REGIONS.map((r) => [r.id, r]));

const BY_NAME: ReadonlyMap<string, GalacticRegion> = new Map(
    GALACTIC_REGIONS.map((r) => [r.name.toLowerCase(), r]),
);

/**
 * Look up a region by its id.
 *
 * @param id - Region id, 1–42.
 * @returns The {@link GalacticRegion}, or `null` if `id` is `0` (outside the map)
 * or otherwise unknown.
 * @example
 * ```ts
 * getGalacticRegion(18)?.name; // -> 'Inner Orion Spur'
 * ```
 */
export function getGalacticRegion(id: number): GalacticRegion | null {
    return BY_ID.get(id) ?? null;
}

/**
 * Look up a region by name (case-insensitive).
 *
 * @param name - The region name, e.g. `"Inner Orion Spur"`. Matching ignores case
 * and surrounding whitespace.
 * @returns The {@link GalacticRegion}, or `null` if no region has that name.
 * @example
 * ```ts
 * getGalacticRegionByName('the void')?.id; // -> 42
 * ```
 */
export function getGalacticRegionByName(name: string): GalacticRegion | null {
    return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}
