/**
 * Elite Dangerous market commodities — the goods traded at station commodity
 * markets, standard and rare.
 *
 * The query functions hold no data; each catalogue is its own module, so import
 * only the ones you use:
 *
 * ```ts
 * import { getCommodityByName, commoditiesInCategory } from '@elite-dangerous-almanac/core/commodities';
 * import { COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-standard';
 *
 * getCommodityByName('gold', COMMODITIES)?.category;      // -> 'Metals'
 * commoditiesInCategory('Metals', COMMODITIES).length;    // -> every metal on the market
 * ```
 *
 * Data from EDCD FDevIDs (`commodity.csv`, `rare_commodity.csv`); see
 * `data/commodities/SOURCES.md`.
 *
 * @packageDocumentation
 */

// ── Types and the data-free query functions ──────────────────────────────────
export {
    getCommodityBySymbol,
    getCommodityByName,
    commoditiesInCategory,
    type Commodity,
    type CommodityCategory,
} from './commodities.js';

// ── Catalogues (one module per registry so bundlers can drop the rest) ────────
export { COMMODITIES } from './commodities-standard.js';
export { RARE_COMMODITIES } from './commodities-rare.js';
export { ALL_COMMODITIES } from './commodities-all.js';
