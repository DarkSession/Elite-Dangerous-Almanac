/**
 * Permit-locked systems and regions — "can a commander jump here without a
 * permit?", answered from a **system name** alone.
 *
 * A permit lock is not published in any game data file, journal event or API
 * (even Sol, permit-locked since launch, reports no permit flag), so this is a
 * hand-maintained community list. It has two halves:
 *
 * - {@link PERMIT_LOCKED_SYSTEMS} — 54 individually locked systems, each with its
 *   name and `id64` (`Sol`, `Shinrarta Dezhra`, `Achenar`, …).
 * - {@link PERMIT_LOCKED_REGIONS} — 28 whole regions whose permit covers every
 *   system inside them (`Col 70 Sector`, `Bleia1`, `Cone Sector`, …), matched by
 *   name prefix, because the game names every system in a region after it.
 *
 * {@link permitLockForSystemName} checks both and tells you which one hit.
 *
 * @remarks
 * Permit state lives in the two tree-shakeable leaf modules
 * `./permit-locked-systems` and `./permit-locked-regions`; this module composes and
 * re-exports both. `HandAuthoredRegion` carries no permit flag, so
 * {@link isPermitLockedRegionName} is how the geometric route asks the question:
 *
 * ```ts
 * const region = findHandAuthoredRegionAt(position);
 * const needsPermit = region !== null && isPermitLockedRegionName(region.name);
 * ```
 *
 * **Prefer that route when you have coordinates.** Resolving a region from a
 * *position* is exact; matching the start of a name is a best-effort fallback for
 * when a name is all you have (a journal line, a user's search box, a route plan).
 *
 * **Scope.** Systems only. Permit-locked *bodies* inside otherwise-open systems
 * (Diso 5 C, Lave 2, Sol's Moon and Triton) are deliberately excluded — a
 * system-level flag would be wrong for them.
 *
 * Sourced from the community "Elite Dangerous Permit Database" spreadsheet via
 * canonn-signals (MIT, © 2023 Canonn Research Group); see [`data/astro/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md).
 *
 * @example
 * ```ts
 * import {
 *     permitLockForSystemName,
 *     permitLockedSystemForAddress,
 * } from '@elite-dangerous-almanac/core/astro/permit-locks';
 *
 * permitLockForSystemName('Shinrarta Dezhra');          // -> { kind: 'system', ... }
 * permitLockForSystemName('Col 70 Sector AA-D b17-0');  // -> { kind: 'region', name: 'Col 70 Sector' }
 * permitLockedSystemForAddress(event.SystemAddress);    // accepts a journal number
 * ```
 *
 * @packageDocumentation
 */

import { permitLockedSystemForName } from './permit-locked-systems.js';
import { permitLockedRegionForSystemName } from './permit-locked-regions.js';

export {
    PERMIT_LOCKED_SYSTEMS,
    permitLockedSystemForName,
    permitLockedSystemForAddress,
    type PermitLockedSystem,
    type SystemAddressInput,
} from './permit-locked-systems.js';
export {
    PERMIT_LOCKED_REGIONS,
    isPermitLockedRegionName,
    permitLockedRegionForSystemName,
} from './permit-locked-regions.js';

/**
 * Why a system needs a permit: because that exact system is locked
 * (`kind: 'system'`), or because it lies inside a locked region
 * (`kind: 'region'`).
 */
export type PermitLock =
    | {
          /** The system itself is on the permit-locked list. */
          readonly kind: 'system';
          /** The canonically-cased system name, e.g. `"Shinrarta Dezhra"`. */
          readonly name: string;
          /** That system's 64-bit system address. */
          readonly id64: bigint;
      }
    | {
          /** The system lies inside a permit-locked region. */
          readonly kind: 'region';
          /**
           * The region's name, e.g. `"Col 70 Sector"`. Also a `HAND_AUTHORED_REGIONS`
           * entry name, so you can look its spheres up by it (see
           * `./hand-authored-regions`). No `id64` — a region is not a system.
           */
          readonly name: string;
      };

/**
 * The permit lock that applies to a system name, or `null` if it is open space.
 *
 * Checks the exact-name list first, then the region names, so a system that is
 * both individually listed and inside a locked region reports `kind: 'system'`.
 *
 * @param name - A system name in any casing, with or without surrounding
 * whitespace, e.g. `"  shinrarta dezhra "`. An empty or blank string yields `null`.
 * @returns A {@link PermitLock} naming the system or region responsible, or `null`
 * when nothing on the list matches.
 * @example
 * ```ts
 * permitLockForSystemName('sol');
 * // -> { kind: 'system', name: 'Sol', id64: 10477373803n }
 *
 * permitLockForSystemName('Bleia1 DL-Y f26');
 * // -> { kind: 'region', name: 'Bleia1' }
 *
 * permitLockForSystemName('Col 285 Sector IX-T d3-31'); // -> null (the bubble's Col 285)
 * ```
 */
export function permitLockForSystemName(name: string): PermitLock | null {
    const system = permitLockedSystemForName(name);
    if (system !== null) return { kind: 'system', name: system.name, id64: system.id64 };

    const region = permitLockedRegionForSystemName(name);
    return region === null ? null : { kind: 'region', name: region };
}

/**
 * Whether a system needs a permit — either its own, or its region's.
 *
 * A convenience wrapper over {@link permitLockForSystemName} for when you only need
 * the yes/no. Use that function instead when you want to tell the commander *which*
 * permit they are missing.
 *
 * @param name - A system name in any casing, e.g. `"vega"`.
 * @returns `true` if the name matches a permit-locked system or region.
 * @example
 * ```ts
 * isPermitLockedSystemName('Sirius');                 // -> true  (system lock)
 * isPermitLockedSystemName('Cone Sector GW-W c1-5');  // -> true  (region lock)
 * isPermitLockedSystemName('Colonia');                // -> false
 * ```
 */
export function isPermitLockedSystemName(name: string): boolean {
    return permitLockForSystemName(name) !== null;
}
