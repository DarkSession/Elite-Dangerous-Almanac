/**
 * The **complete** nebula catalogue: real, planetary and procedurally generated
 * nebulae in one array.
 *
 * @remarks
 * **This module pulls in every nebula catalogue (~682 KiB bundled)** — it exists for
 * consumers that really do want to search all 5835 records (a "nearest nebula to my
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
 * Filter on {@link Nebula.type} to narrow it down after the fact — though importing
 * the single catalogue you need is cheaper, since it keeps the others out of your
 * bundle entirely.
 *
 * @example
 * ```ts
 * import { ALL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-all';
 *
 * ALL_NEBULAE.length;                                        // -> 5835
 * ALL_NEBULAE.filter((n) => n.type === 'procgen').length;    // -> 166
 * ```
 */
export const ALL_NEBULAE: readonly Nebula[] = Object.freeze([
    ...REAL_NEBULAE,
    ...PLANETARY_NEBULAE,
    ...PROCGEN_NEBULAE,
]);
