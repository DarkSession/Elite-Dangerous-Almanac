/**
 * The catalogue of **standard** market commodities — the goods traded at station
 * commodity markets, across every market group.
 *
 * Every record here is a standard commodity (`rare: false`); the rare goods live in
 * `./commodities-rare`. Search it with the query functions in `./commodities`.
 *
 * Data from EDCD FDevIDs (`commodity.csv`), from a player-journal observation with an
 * in-game category check, and from two readings of the running game's own commodity
 * registry, whose difference is a batch of mineral and chemical goods the FDevIDs
 * snapshot does not carry; see
 * [`data/commodities/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/commodities/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Commodity } from './commodities.js';
import { buildCommodityCatalogue, type CommodityRecord } from './internal/commodity-catalogue.js';
import standardData from '../../../data/commodities/commodities.jsonc' with { type: 'json' };

/**
 * Every standard commodity, in Frontier's registry order.
 *
 * @remarks
 * Every record has `rare: false`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * import { COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-standard';
 *
 * COMMODITIES.find((c) => c.symbol === 'Gold')?.category; // -> 'Metals'
 * ```
 */
export const COMMODITIES: readonly Commodity[] = buildCommodityCatalogue(
    standardData as readonly CommodityRecord[],
    false,
);
