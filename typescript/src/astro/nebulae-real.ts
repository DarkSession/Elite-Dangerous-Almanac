/**
 * The catalogue of **real** nebulae — the 180 real-world nebulae and dark regions
 * Elite Dangerous models under their catalogue name (Horsehead, Witch Head,
 * Barnard's Loop, the Coalsack and Aquila dark regions, …).
 *
 * This is the small, human-recognisable slice of the nebula catalogue (~19 KB
 * bundled) and the one most apps want. The much larger planetary and procedurally
 * generated classes live in `./nebulae-planetary` and `./nebulae-procgen`, so
 * importing this module never bundles them.
 *
 * Data from EDAstro (CMDR Orvidius); see [`data/astro/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Nebula } from './nebulae.js';
import realNebulaeData from '../../../data/astro/nebulae-real.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';

/**
 * All 180 real-world nebulae and dark regions, sorted by name.
 *
 * @remarks
 * Every record has `type: 'real'`. Search it with `nearestNebulae` or
 * `nebulaeWithin` from `./nebulae`.
 *
 * @example
 * ```ts
 * import { REAL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-real';
 *
 * REAL_NEBULAE.length; // -> 180
 * REAL_NEBULAE.find((n) => n.name === 'Horsehead Nebula')?.system;
 * // -> 'Horsehead Dark Region IR-V c2-9'
 * ```
 */
export const REAL_NEBULAE: readonly Nebula[] = deepFreeze(realNebulaeData as readonly Nebula[]);
