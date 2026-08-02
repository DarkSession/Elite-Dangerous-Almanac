/**
 * The catalogue of **rare** market commodities — the 142 location-specific luxury
 * goods, each produced at a single station and worth more the further it is carried.
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
import { buildCommodityCatalogue, type CommodityRecord } from './commodity-catalogue.js';
import rareData from '../../../data/commodities/rare-commodities.jsonc' with { type: 'json' };

/**
 * All 142 rare commodities, in Frontier's registry order.
 *
 * @remarks
 * Every record has `rare: true`. The array and its records are frozen. A rare's
 * origin station is not carried — the CSV's `market_id` is dropped, since the library
 * has no station registry to resolve it against.
 *
 * @example
 * ```ts
 * RARE_COMMODITIES.length; // -> 142
 * RARE_COMMODITIES.find((c) => c.symbol === 'LavianBrandy')?.name; // -> 'Lavian Brandy'
 * ```
 */
export const RARE_COMMODITIES: readonly Commodity[] = buildCommodityCatalogue(
    rareData as readonly CommodityRecord[],
    true,
);
