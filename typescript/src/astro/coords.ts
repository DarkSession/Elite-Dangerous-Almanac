/**
 * Shared galactic coordinate type.
 *
 * A single point in the Elite Dangerous galaxy, in **light-years with Sol at the
 * origin** — the same frame the game journal and community APIs (EDSM, Spansh)
 * report system positions in. Several astro features consume it, so it lives in
 * its own module rather than being owned by any one of them.
 *
 * @packageDocumentation
 */

/** A point in the galaxy, in light-years, with Sol at the origin. */
export interface GalacticCoords {
    /** Galactic X in light-years (Sol at origin). */
    x: number;
    /** Galactic Y in light-years (Sol at origin). */
    y: number;
    /** Galactic Z in light-years (Sol at origin). */
    z: number;
}
