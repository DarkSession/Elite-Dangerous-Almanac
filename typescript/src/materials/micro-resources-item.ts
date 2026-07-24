/**
 * The catalogue of **item** micro resources — the physical goods collected and
 * traded on foot.
 *
 * Search it with the query functions in `./micro-resources`.
 *
 * Data from EDCD FDevIDs (`microresources.csv`); see `data/materials/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { MicroResource } from './micro-resources.js';
import itemData from '../../../data/materials/micro-resources-item.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 43 item micro resources, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'item'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * ITEM_MICRO_RESOURCES.length; // -> 43
 * ```
 */
export const ITEM_MICRO_RESOURCES: readonly MicroResource[] = deepFreeze(
    itemData as readonly MicroResource[],
);
