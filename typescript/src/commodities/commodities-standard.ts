/**
 * The catalogue of **standard** market commodities — the 256 goods traded at
 * station commodity markets, across all sixteen market groups.
 *
 * Every record here is a standard commodity (`rare: false`); the rare goods live in
 * `./commodities-rare`. Search it with the query functions in `./commodities`.
 *
 * Data from EDCD FDevIDs (`commodity.csv`); see `data/commodities/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { Commodity } from './commodities.js';
import { buildCommodityCatalogue, type CommodityRecord } from './commodity-catalogue.js';
import standardData from '../../../data/commodities/commodities.jsonc' with { type: 'json' };

/**
 * All 256 standard commodities, in Frontier's registry order.
 *
 * @remarks
 * Every record has `rare: false`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * COMMODITIES.length; // -> 256
 * COMMODITIES.find((c) => c.symbol === 'Gold')?.category; // -> 'Metals'
 * ```
 */
export const COMMODITIES: readonly Commodity[] = buildCommodityCatalogue(
    standardData as readonly CommodityRecord[],
    false,
);
