/**
 * Shared galactic position type.
 *
 * A single point in the Elite Dangerous galaxy, in **light-years with Sol at the
 * origin** — the same frame the game journal and community APIs (EDSM, Spansh)
 * report system positions in. Several astro features consume it, so it lives in
 * its own module rather than being owned by any one of them.
 *
 * @packageDocumentation
 */

/**
 * A point in the galaxy, in light-years, with Sol at the origin.
 *
 * @example
 * ```ts
 * import type { GalacticPosition } from '@elite-dangerous-almanac/core/astro/galactic-position';
 *
 * const position: GalacticPosition = { x: 751, y: -179, z: -91 };
 * ```
 */
export interface GalacticPosition {
    /** Galactic X in light-years (Sol at origin). */
    readonly x: number;
    /** Galactic Y in light-years (Sol at origin). */
    readonly y: number;
    /** Galactic Z in light-years (Sol at origin). */
    readonly z: number;
}
