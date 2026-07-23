/**
 * The catalogue of **procedurally generated** nebulae — 166 nebulae the galaxy
 * generator places out in the black, catalogued at a nearby system.
 *
 * Their names follow the procedural scheme of the sector they sit in
 * (`Agnairt AA-A h36`), so unlike {@link REAL_NEBULAE} they carry no real-world
 * catalogue identity. About 19 KB bundled; the far larger planetary class lives in
 * `./nebulae-planetary`.
 *
 * Data from EDAstro (CMDR Orvidius); see `data/astro/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { Nebula } from './nebulae.js';
import procgenNebulaeData from '../../../data/astro/nebulae-procgen.json' with { type: 'json' };

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
 * PROCGEN_NEBULAE.length;    // -> 166
 * PROCGEN_NEBULAE[0].name;   // -> 'Agnairt AA-A h36'
 * ```
 */
export const PROCGEN_NEBULAE: readonly Nebula[] = (
    procgenNebulaeData as { nebulae: readonly Nebula[] }
).nebulae;
