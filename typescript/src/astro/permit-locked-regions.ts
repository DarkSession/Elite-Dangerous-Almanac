/**
 * Whole permit-locked regions, kept separate from individually locked systems.
 *
 * Importing this leaf module costs only the 28 region names. `StarSystem` uses it
 * to preserve the library's fine-grained tree-shaking boundary.
 *
 * @packageDocumentation
 */

import regionsData from '../../../data/astro/permit-locked-regions.jsonc' with { type: 'json' };

/**
 * The 28 permit-locked regions, sorted by name.
 *
 * @remarks
 * Each entry is both a hand-authored region name and the whole-token prefix used
 * by system names inside it. The array is frozen at runtime.
 *
 * @example
 * ```ts
 * PERMIT_LOCKED_REGIONS.slice(0, 3); // -> [ 'Bleia1', 'Bleia2', 'Bleia3' ]
 * ```
 */
export const PERMIT_LOCKED_REGIONS: readonly string[] = Object.freeze([
    ...(regionsData as readonly string[]),
]);

/** Normalized region names paired with their canonical spelling. */
const REGION_INDEX: ReadonlyMap<string, string> = new Map(
    PERMIT_LOCKED_REGIONS.map((name) => [name.toLowerCase(), name]),
);

/**
 * Whether a region is permit-locked, by its exact name.
 *
 * @param name - A hand-authored region name in any casing, with optional
 * surrounding whitespace.
 * @returns `true` when the exact region is permit-locked. A system name inside the
 * region does not count as an exact region-name match.
 */
export function isPermitLockedRegionName(name: string): boolean {
    return REGION_INDEX.has(name.trim().toLowerCase());
}

/**
 * Find the permit-locked region prefix applying to a system name.
 *
 * @param systemName - A system name in any casing, with optional surrounding
 * whitespace.
 * @returns The canonically-cased region name, or `null` when no locked region
 * prefix applies.
 * @example
 * ```ts
 * permitLockedRegionForSystemName('Col 70 Sector AA-D b17-0');
 * // -> 'Col 70 Sector'
 * ```
 */
export function permitLockedRegionForSystemName(systemName: string): string | null {
    const normalized = systemName.trim().toLowerCase();
    if (!normalized) return null;

    for (const [key, region] of REGION_INDEX) {
        if (normalized === key || normalized.startsWith(`${key} `)) return region;
    }
    return null;
}
