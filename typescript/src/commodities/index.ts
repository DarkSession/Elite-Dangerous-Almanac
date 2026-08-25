/**
 * Elite Dangerous market commodities — the goods traded at station commodity
 * markets, standard and rare.
 *
 * Every lookup searches both registries by default — import the function and call
 * it:
 *
 * ```ts
 * import { getCommodityByName, commoditiesInCategory } from '@elite-dangerous-almanac/core/commodities';
 *
 * getCommodityByName('gold')?.category;   // -> 'Metals'
 * commoditiesInCategory('Metals').length; // -> every metal, standard and rare
 * ```
 *
 * The by-key lookups also take an optional trailing argument to **narrow** the search
 * to one registry, or to an array you have filtered yourself. It must be one of the
 * exported catalogues *by reference*; `ALL_COMMODITIES` (or omitting it) is the one
 * that answers from an index rather than a scan:
 *
 * ```ts
 * import { getCommodityByName } from '@elite-dangerous-almanac/core/commodities';
 * import { COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-standard';
 *
 * getCommodityByName('lavian brandy', COMMODITIES); // -> null; it is a rare
 * ```
 *
 * A lookup that returns an array takes no catalogue — narrow its result with
 * `.filter()`:
 *
 * ```ts
 * import { commoditiesInCategory } from '@elite-dangerous-almanac/core/commodities';
 *
 * commoditiesInCategory('Metals').filter((c) => !c.rare).length; // -> the standard ones only
 * ```
 *
 * @packageDocumentation
 */

// ── Types and the lookups (each defaults to both registries) ─────────────────
export {
    getCommodityBySymbol,
    getCommodityByName,
    commoditiesInCategory,
    type Commodity,
    type CommodityCategory,
} from './commodities.js';

// ── Catalogues (one module per registry, for narrowing a search by hand) ──────
export { COMMODITIES } from './commodities-standard.js';
export { RARE_COMMODITIES } from './commodities-rare.js';
export { ALL_COMMODITIES } from './commodities-all.js';
