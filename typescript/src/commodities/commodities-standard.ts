/**
 * The catalogue of **standard** market commodities — the 257 goods traded at
 * station commodity markets, across all sixteen market groups.
 *
 * Every record here is a standard commodity (`rare: false`); the rare goods live in
 * `./commodities-rare`. Search it with the query functions in `./commodities`.
 *
 * Data from EDCD FDevIDs (`commodity.csv`), plus one record observed in a player
 * journal and absent from the pinned FDevIDs snapshot. Its market category is a
 * maintainer assignment; see
 * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/226 and
 * [`data/commodities/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/commodities/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Commodity } from './commodities.js';
import { buildCommodityCatalogue, type CommodityRecord } from './internal/commodity-catalogue.js';
import standardData from '../../../data/commodities/commodities.jsonc' with { type: 'json' };

/**
 * All 257 standard commodities, in Frontier's registry order.
 *
 * @remarks
 * Every record has `rare: false`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * import { COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-standard';
 *
 * COMMODITIES.length; // -> 257
 * COMMODITIES.find((c) => c.symbol === 'Gold')?.category; // -> 'Metals'
 * ```
 */
export const COMMODITIES: readonly Commodity[] = buildCommodityCatalogue(
    standardData as readonly CommodityRecord[],
    false,
);
