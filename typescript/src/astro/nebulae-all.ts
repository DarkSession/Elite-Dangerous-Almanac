/**
 * The **complete** nebula catalogue: real, planetary and procedurally generated
 * nebulae in one array.
 *
 * @remarks
 * **This module pulls in every nebula catalogue (~432 KiB bundled)** — it exists for
 * consumers that want to search every record (a "nearest nebula to my
 * position" tool, say). If you only need one class, import that catalogue's module
 * (`./nebulae-real`, `./nebulae-planetary`, `./nebulae-procgen`) and nothing else
 * gets bundled.
 *
 * Data from EDAstro; see [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md) for credit and licence terms.
 *
 * @packageDocumentation
 */

import type { Nebula } from './nebulae.js';
import { REAL_NEBULAE } from './nebulae-real.js';
import { PLANETARY_NEBULAE } from './nebulae-planetary.js';
import { PROCGEN_NEBULAE } from './nebulae-procgen.js';

/**
 * Every catalogued nebula — the concatenation of `REAL_NEBULAE`,
 * `PLANETARY_NEBULAE` and `PROCGEN_NEBULAE`, in that order (each class sorted by
 * name).
 *
 * @remarks
 * Filter on {@link Nebula.type} to narrow it down after the fact.
 *
 * @example
 * ```ts
 * import { ALL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-all';
 *
 * ALL_NEBULAE.find((n) => n.name === 'Horsehead Nebula')?.type;    // -> 'real'
 * ALL_NEBULAE.find((n) => n.name === 'Agnairt AA-A h36')?.type;     // -> 'procgen'
 * ```
 */
export const ALL_NEBULAE: readonly Nebula[] = Object.freeze([
    ...REAL_NEBULAE,
    ...PLANETARY_NEBULAE,
    ...PROCGEN_NEBULAE,
]);
