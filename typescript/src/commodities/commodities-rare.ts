/**
 * The catalogue of **rare** market commodities — the location-specific luxury goods,
 * each produced at a single station and worth more the further it is carried.
 *
 * Every record here is a rare commodity (`rare: true`); the standard market goods
 * live in `./commodities-standard`. Search it with the query functions in
 * `./commodities`.
 *
 * Data from EDCD FDevIDs (`rare_commodity.csv`); see [`data/commodities/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/commodities/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Commodity } from './commodities.js';
import { buildCommodityCatalogue, type CommodityRecord } from './internal/commodity-catalogue.js';
import rareData from '../../../data/commodities/rare-commodities.jsonc' with { type: 'json' };

/**
 * Every rare commodity, in Frontier's registry order.
 *
 * @remarks
 * Every record has `rare: true`. The array and its records are frozen. A rare's
 * origin station is not carried — the CSV's `market_id` is dropped, since the library
 * has no station registry to resolve it against.
 *
 * @example
 * ```ts
 * import { RARE_COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-rare';
 *
 * RARE_COMMODITIES.find((c) => c.symbol === 'LavianBrandy')?.name; // -> 'Lavian Brandy'
 * ```
 */
export const RARE_COMMODITIES: readonly Commodity[] = buildCommodityCatalogue(
    rareData as readonly CommodityRecord[],
    true,
);
