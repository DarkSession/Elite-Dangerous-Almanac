/**
 * The catalogue of **planetary** nebulae — the largest class in the catalogue, each
 * catalogued at the procedurally-named system it surrounds.
 *
 * @remarks
 * **This is the heaviest data module in the library (~399 KiB bundled).** Import it
 * only when you genuinely need every planetary nebula; for the recognisable
 * real-world nebulae use `./nebulae-real` instead (~16 KiB). Because each catalogue
 * is its own module, importing that one never pulls this one in.
 *
 * Data from EDAstro; see [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md) for credit and licence terms.
 *
 * @packageDocumentation
 */

import type { Nebula } from './nebulae.js';
import { buildNebulaCatalogue, type PlanetaryNebulaRecord } from './internal/nebula-catalogue.js';
import planetaryNebulaeData from '../../../data/astro/nebulae-planetary.jsonc' with { type: 'json' };

/**
 * Every planetary nebula, sorted by name.
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
 * PLANETARY_NEBULAE[0]?.name; // -> 'Aemonz EQ-Y e1899'
 * ```
 */
export const PLANETARY_NEBULAE: readonly Nebula[] = buildNebulaCatalogue(
    planetaryNebulaeData as readonly PlanetaryNebulaRecord[],
    'planetary',
);
