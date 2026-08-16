/**
 * The catalogue of **item** micro resources — the physical goods collected and
 * traded on foot.
 *
 * Search it with the query functions in `./micro-resources`.
 *
 * Data from EDCD FDevIDs (`microresources.csv`) and in-game verification; see [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { MicroResource } from './micro-resources.js';
import {
    buildMicroResourceCatalogue,
    type MicroResourceRecord,
} from './internal/micro-resource-catalogue.js';
import itemData from '../../../data/materials/micro-resources-item.jsonc' with { type: 'json' };

/**
 * All 62 item micro resources, in catalogue order.
 *
 * @remarks
 * Every record has `category: 'item'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * import { ITEM_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-item';
 *
 * ITEM_MICRO_RESOURCES.length; // -> 62
 * ```
 */
export const ITEM_MICRO_RESOURCES: readonly MicroResource[] = buildMicroResourceCatalogue(
    itemData as readonly MicroResourceRecord[],
    'item',
);
