/**
 * The catalogue of **real** nebulae — the 180 real-world nebulae and dark regions
 * Elite Dangerous models under their catalogue name (Horsehead, Witch Head,
 * Barnard's Loop, the Coalsack and Aquila dark regions, …).
 *
 * This is the small, human-recognisable slice of the nebula catalogue (~16 KiB
 * bundled) and the one most apps want. The much larger planetary and procedurally
 * generated classes live in `./nebulae-planetary` and `./nebulae-procgen`, so
 * importing this module never bundles them.
 *
 * Data from EDAstro; see [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md) for credit and licence terms.
 *
 * @packageDocumentation
 */

import type { Nebula } from './nebulae.js';
import { buildNebulaCatalogue, type NamedNebulaRecord } from './internal/nebula-catalogue.js';
import realNebulaeData from '../../../data/astro/nebulae-real.jsonc' with { type: 'json' };

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
export const REAL_NEBULAE: readonly Nebula[] = buildNebulaCatalogue(
    realNebulaeData as readonly NamedNebulaRecord[],
    'real',
);
