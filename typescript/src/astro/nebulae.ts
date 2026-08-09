/**
 * Nebula catalogue types and proximity queries — the **data-free** core of the
 * nebulae feature.
 *
 * Elite Dangerous models thousands of nebulae. This module holds the
 * {@link Nebula} record shape and the pure functions that search a catalogue
 * ({@link nearestNebulae}, {@link nebulaeWithin}, {@link getNebulaByName}); the
 * catalogues themselves live in sibling modules, one per class, so you only bundle
 * the ones you ask for:
 *
 * Sizes are the published minified ESM, before any transport compression; the gzipped
 * figure is roughly a fifth of it.
 *
 * | Module | Export | Entries | Minified | Gzipped |
 * | --- | --- | --- | --- | --- |
 * | `./nebulae-real` | `REAL_NEBULAE` | 180 | 19 KB | 5 KB |
 * | `./nebulae-procgen` | `PROCGEN_NEBULAE` | 166 | 19 KB | 6 KB |
 * | `./nebulae-planetary` | `PLANETARY_NEBULAE` | 5489 | 645 KB | 140 KB |
 * | `./nebulae-all` | `ALL_NEBULAE` | 5835 | 682 KB | 151 KB |
 *
 * Importing a query function from here costs nothing but the function: pass in
 * whichever catalogue you imported. The catalogue argument is **required** — 94% of
 * `ALL_NEBULAE` is planetary nebulae most apps never touch, so there is no default
 * worth falling back to silently.
 *
 * Positions are galactic light-years with Sol at the origin — the same frame the
 * journal, EDSM and Spansh use. Catalogue data originates from EDAstro
 * (CMDR Orvidius); see [`data/astro/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md).
 *
 * @example
 * ```ts
 * import { nearestNebulae } from '@elite-dangerous-almanac/core/astro/nebulae';
 * import { REAL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-real';
 *
 * nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 1)[0].name; // -> 'Pleiades'
 * ```
 *
 * @packageDocumentation
 */

import type { GalacticPosition } from './galactic-position.js';

/**
 * How a nebula is classified by the source catalogue.
 *
 * - `real` — a catalogued real-world nebula or dark region the game models by name
 *   (Horsehead Nebula, Barnard's Loop, Coalsack Dark Region, …).
 * - `planetary` — a planetary nebula, catalogued at the procedurally-named system
 *   it surrounds. By far the largest class.
 * - `procgen` — a procedurally generated nebula, catalogued at a nearby system.
 */
export type NebulaType = 'real' | 'planetary' | 'procgen';

/**
 * One catalogued nebula and where it sits in the galaxy.
 *
 * @remarks
 * A nebula is a volume, but the catalogue records a single reference point — the
 * position of {@link Nebula.system}, the system it is catalogued at. Distances
 * computed from it are therefore "distance to the catalogued system", not distance
 * to the nebula's edge.
 */
export interface Nebula {
    /**
     * Display name, e.g. `"Witch Head Nebula"`. For procedurally-named nebulae this
     * is usually the system name, sometimes with a community name appended in
     * parentheses (`"Aemonz WZ-Y e6771 (Lazurite Nebula)"`).
     */
    readonly name: string;
    /** The in-game system the nebula is catalogued at, e.g. `"Witch Head Sector IR-W c1-8"`. */
    readonly system: string;
    /** Galactic X of the catalogued system, in light-years (Sol at origin). */
    readonly x: number;
    /** Galactic Y of the catalogued system, in light-years (Sol at origin). */
    readonly y: number;
    /** Galactic Z of the catalogued system, in light-years (Sol at origin). */
    readonly z: number;
    /** Which class of nebula this is. */
    readonly type: NebulaType;
    /**
     * Id of the galactic codex region the nebula sits in, 1–42.
     *
     * @remarks
     * Resolve it to a name with `getCodexRegion` from `./codex-region` — that
     * costs ~9 KB of region metadata rather than the ~267 KB lookup grid
     * `findCodexRegionAt` needs.
     */
    readonly regionId: number;
}

/** A {@link Nebula} annotated with its distance from a queried point. */
export interface NebulaWithDistance extends Nebula {
    /** Straight-line distance from the queried coordinates, in light-years. */
    readonly distanceLy: number;
}

/** Squared distance between a point and a nebula's catalogued system, in ly². */
function distanceSquared(coords: GalacticPosition, nebula: Nebula): number {
    const dx = coords.x - nebula.x;
    const dy = coords.y - nebula.y;
    const dz = coords.z - nebula.z;
    return dx * dx + dy * dy + dz * dz;
}

/**
 * The nebulae closest to a point, nearest first.
 *
 * @param coords - The point to measure from, in light-years (Sol at origin). A
 * `ProceduralSystem.position` value fits once you have narrowed it — it is
 * `GalacticPosition | null`, and is `null` unless that system was built from an address
 * *and* you supplied its coordinates, so null-check it first.
 * @param nebulae - The catalogue to search — `REAL_NEBULAE`, `PLANETARY_NEBULAE`,
 * `PROCGEN_NEBULAE`, `ALL_NEBULAE`, or any subset you have filtered yourself.
 * @param count - How many to return. Defaults to `3`. Values `<= 0` yield an empty
 * array; a `count` larger than the catalogue returns the whole catalogue.
 * @returns Up to `count` nebulae sorted by ascending {@link NebulaWithDistance.distanceLy}.
 * Ties keep catalogue order. The input array is not modified.
 * @example
 * ```ts
 * // The three real nebulae nearest Sol
 * nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE).map((n) => n.name);
 * // -> [ 'Pleiades', 'R Cra', 'Lupus Dark Region B' ]  (nearest first)
 *
 * nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 1)[0].distanceLy; // -> ≈383.31
 * ```
 */
export function nearestNebulae(
    coords: GalacticPosition,
    nebulae: readonly Nebula[],
    count = 3,
): NebulaWithDistance[] {
    if (count <= 0) return [];
    // Rank on squared distances (no sqrt per comparison), then take the square root
    // only for the handful of records actually returned.
    const ranked = nebulae.map((nebula) => ({ nebula, d2: distanceSquared(coords, nebula) }));
    ranked.sort((a, b) => a.d2 - b.d2);
    return ranked
        .slice(0, count)
        .map(({ nebula, d2 }) => ({ ...nebula, distanceLy: Math.sqrt(d2) }));
}

/**
 * Every nebula within a radius of a point, nearest first.
 *
 * @param coords - The point to measure from, in light-years (Sol at origin).
 * @param nebulae - The catalogue to search (see {@link nearestNebulae}).
 * @param radiusLy - Search radius in light-years, inclusive of the boundary.
 * Negative radii yield an empty array.
 * @returns The matching nebulae sorted by ascending
 * {@link NebulaWithDistance.distanceLy}. Ties keep catalogue order. The input array
 * is not modified.
 * @example
 * ```ts
 * // Real nebulae within 400 ly of Sol
 * nebulaeWithin({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 400).map((n) => n.name);
 * // -> [ 'Pleiades' ]
 * ```
 */
export function nebulaeWithin(
    coords: GalacticPosition,
    nebulae: readonly Nebula[],
    radiusLy: number,
): NebulaWithDistance[] {
    if (radiusLy < 0) return [];
    const limit = radiusLy * radiusLy;
    const hits: NebulaWithDistance[] = [];
    for (const nebula of nebulae) {
        const d2 = distanceSquared(coords, nebula);
        if (d2 <= limit) hits.push({ ...nebula, distanceLy: Math.sqrt(d2) });
    }
    hits.sort((a, b) => a.distanceLy - b.distanceLy);
    return hits;
}

/**
 * Look up a nebula by name (case-insensitive).
 *
 * @param name - The nebula name as the catalogue spells it, e.g.
 * `"Witch Head Nebula"`. Matching ignores case and surrounding whitespace but is
 * otherwise exact — including any parenthetical community name
 * (`"Aemonz WZ-Y e6771 (Lazurite Nebula)"`), so pass the whole string.
 * @param nebulae - The catalogue to search (see {@link nearestNebulae}).
 * @returns The matching {@link Nebula}, or `null` if the catalogue holds no nebula
 * of that name. Only the catalogue you pass is searched — a real nebula will not
 * be found in `PLANETARY_NEBULAE`.
 * @example
 * ```ts
 * getNebulaByName('witch head nebula', REAL_NEBULAE)?.system;
 * // -> 'Witch Head Sector RY-R b4-0'
 * ```
 */
export function getNebulaByName(name: string, nebulae: readonly Nebula[]): Nebula | null {
    const wanted = name.trim().toLowerCase();
    return nebulae.find((nebula) => nebula.name.toLowerCase() === wanted) ?? null;
}
