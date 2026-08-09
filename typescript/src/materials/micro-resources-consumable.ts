/**
 * The catalogue of **consumable** micro resources — the deployable field tools
 * (medkits, energy cells, grenades, E-Breach) carried on foot.
 *
 * Search it with the query functions in `./micro-resources`.
 *
 * Data from EDCD FDevIDs (`microresources.csv`); see [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { MicroResource } from './micro-resources.js';
import consumableData from '../../../data/materials/micro-resources-consumable.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';

/**
 * All 6 consumable micro resources, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'consumable'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * CONSUMABLE_MICRO_RESOURCES.length; // -> 6
 * ```
 */
export const CONSUMABLE_MICRO_RESOURCES: readonly MicroResource[] = deepFreeze(
    consumableData as readonly MicroResource[],
);
