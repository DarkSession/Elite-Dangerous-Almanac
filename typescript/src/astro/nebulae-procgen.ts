/**
 * The catalogue of **procedurally generated** nebulae — 166 nebulae the galaxy
 * generator places out in the black, catalogued at a nearby system.
 *
 * Their names follow the procedural scheme of the sector they sit in
 * (`Agnairt AA-A h36`), so unlike {@link REAL_NEBULAE} they carry no real-world
 * catalogue identity. About 19 KiB bundled; the far larger planetary class lives in
 * `./nebulae-planetary`.
 *
 * Data from EDAstro; see [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md) for credit and licence terms.
 *
 * @packageDocumentation
 */

import type { Nebula } from './nebulae.js';
import procgenNebulaeData from '../../../data/astro/nebulae-procgen.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';

/**
 * All 166 procedurally generated nebulae, sorted by name.
 *
 * @remarks
 * Every record has `type: 'procgen'`. Note that `name` and `system` differ here:
 * the nebula is named for its own boxel (`Agnairt AA-A h36`) while `system` is the
 * catalogued system nearby (`Agnairt TA-U d4-360`).
 *
 * @example
 * ```ts
 * import { PROCGEN_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-procgen';
 *
 * PROCGEN_NEBULAE.length;    // -> 166
 * PROCGEN_NEBULAE[0]?.name;   // -> 'Agnairt AA-A h36'
 * ```
 */
export const PROCGEN_NEBULAE: readonly Nebula[] = deepFreeze(
    procgenNebulaeData as readonly Nebula[],
);
