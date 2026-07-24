/**
 * Hand-authored named sectors, resolved by galactic position.
 *
 * The procedural generator only produces the boxel name for a position. Systems
 * that physically fall inside a hand-authored nebula or cluster region (Pleiades,
 * Coalsack, the NGC/IC/Col catalogues, …) are instead displayed by the game under
 * that region's name. Each region is one or more spheres in galactic light-years
 * (Sol at the origin); membership is first-match sphere containment.
 *
 * Sphere records are compiled and cross-checked against EDSM and Spansh; see
 * `data/astro/SOURCES.md` for provenance and source terms.
 *
 * The list is pre-sorted **smallest-radius-first**, which reproduces the game's
 * overlap priority: when spheres overlap, the most specific (smallest) region
 * wins. Data is loaded once from shared JSON (`data/astro/`).
 *
 * @remarks
 * "Region" is overloaded in this galaxy. A {@link HandAuthoredRegion} is a *hand-authored
 * named sector* (Pleiades, Coalsack, …) — not to be confused with a **procedural
 * sector** (`./sector-name`) or a **galactic codex region** (`./galactic-region`,
 * the 42 codex zones). Use {@link handAuthoredRegionForCoords} here for the first, and
 * `findRegionAt` from `./galactic-region-lookup` for the third.
 *
 * @packageDocumentation
 */

import type { GalacticCoords } from './coords.js';
import handAuthoredData from '../../../data/astro/hand-authored-regions.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/** One sphere of a hand-authored region (centre and radius in light-years). */
export interface HandAuthoredSphere {
    /** Sphere centre X in light-years (Sol at origin). */
    readonly cx: number;
    /** Sphere centre Y in light-years. */
    readonly cy: number;
    /** Sphere centre Z in light-years. */
    readonly cz: number;
    /** Sphere radius in light-years. */
    readonly r: number;
}

/**
 * A hand-authored named sector: its canonical name and the spheres it occupies.
 *
 * @remarks
 * Whether the region needs a permit is not stored here — 28 of these regions are
 * permit-locked, and `isPermitLockedRegionName` in `./permit-locks` is the single
 * place that knows which. Pass {@link HandAuthoredRegion.name} to it.
 */
export interface HandAuthoredRegion {
    /** Canonically-cased region name, e.g. `Pleiades Sector`. */
    readonly name: string;
    /** The spheres whose union defines the region's volume. */
    readonly spheres: readonly HandAuthoredSphere[];
}

/** All hand-authored regions, sorted smallest-radius-first (overlap priority). */
export const HAND_AUTHORED_REGIONS: readonly HandAuthoredRegion[] = deepFreeze(
    handAuthoredData as readonly HandAuthoredRegion[],
);

/**
 * The hand-authored region containing a galactic point, or `null` for procedural
 * space.
 *
 * Because {@link HAND_AUTHORED_REGIONS} is sorted smallest-radius-first, the first region
 * whose sphere set contains the point is the most specific one — matching the
 * game's overlap priority.
 *
 * @remarks
 * This resolves a *hand-authored named sector* only. For the codex region a point
 * falls in, use `findRegionAt` from `./galactic-region-lookup` instead.
 *
 * @param coords - Galactic position in light-years (Sol at origin). All three axes
 * are used — hand-authored regions are 3-D spheres, so `y` matters here (unlike the
 * flat `findRegionAt`). A {@link StarSystem.coords} value can be passed directly.
 * @returns The containing region, or `null` if the point is in procedural space.
 * @example
 * ```ts
 * handAuthoredRegionForCoords({ x: -80.6, y: -146.7, z: -343.3 })?.name; // -> 'Pleiades Sector'
 * ```
 * @example
 * Resolving a permit lock from a position — the exact route, since it does not
 * depend on how the system is named:
 * ```ts
 * import { isPermitLockedRegionName } from './permit-locked-regions.js';
 *
 * const region = handAuthoredRegionForCoords(coords);
 * const needsPermit = region !== null && isPermitLockedRegionName(region.name);
 * ```
 */
export function handAuthoredRegionForCoords(coords: GalacticCoords): HandAuthoredRegion | null {
    const { x, y, z } = coords;
    for (const region of HAND_AUTHORED_REGIONS) {
        for (const s of region.spheres) {
            const dx = x - s.cx;
            const dy = y - s.cy;
            const dz = z - s.cz;
            if (dx * dx + dy * dy + dz * dz <= s.r * s.r) return region;
        }
    }
    return null;
}
