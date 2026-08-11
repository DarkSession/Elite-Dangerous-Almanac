/**
 * The catalogue of **planetary** nebulae — 5489 of them, the largest class in the
 * catalogue, each catalogued at the procedurally-named system it surrounds.
 *
 * @remarks
 * **This is the heaviest data module in the library (~645 KiB bundled).** Import it
 * only when you genuinely need every planetary nebula; for the 180 recognisable
 * real-world nebulae use `./nebulae-real` instead (~19 KiB). Because each catalogue
 * is its own module, importing that one never pulls this one in.
 *
 * Data from EDAstro (CMDR Orvidius); see [`data/astro/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Nebula } from './nebulae.js';
import planetaryNebulaeData from '../../../data/astro/nebulae-planetary.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';

/**
 * All 5489 planetary nebulae, sorted by name.
 *
 * @remarks
 * Every record has `type: 'planetary'`. `name` is normally identical to `system`;
 * where explorers have given one a community name it is appended in parentheses
 * (`"Aemonz WZ-Y e6771 (Lazurite Nebula)"`).
 *
 * @example
 * ```ts
 * import { PLANETARY_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-planetary';
 *
 * PLANETARY_NEBULAE.length;  // -> 5489
 * PLANETARY_NEBULAE[0]?.name; // -> 'Aemonz EQ-Y e1899'
 * ```
 */
export const PLANETARY_NEBULAE: readonly Nebula[] = deepFreeze(
    planetaryNebulaeData as readonly Nebula[],
);
