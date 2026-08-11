/**
 * Every market commodity — the standard and rare catalogues concatenated.
 *
 * Importing this pulls both data modules; when you only need one, import
 * `COMMODITIES` or `RARE_COMMODITIES` from its own module so a bundler can drop the
 * other.
 *
 * @packageDocumentation
 */

import type { Commodity } from './commodities.js';
import { COMMODITIES } from './commodities-standard.js';
import { RARE_COMMODITIES } from './commodities-rare.js';

/**
 * All 399 commodities, standard first then rare.
 *
 * @example
 * ```ts
 * import { ALL_COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-all';
 *
 * ALL_COMMODITIES.length; // -> 399
 * ```
 */
export const ALL_COMMODITIES: readonly Commodity[] = Object.freeze([
    ...COMMODITIES,
    ...RARE_COMMODITIES,
]);
