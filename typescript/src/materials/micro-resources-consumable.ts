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
import {
    buildMicroResourceCatalogue,
    type MicroResourceRecord,
} from './internal/micro-resource-catalogue.js';
import consumableData from '../../../data/materials/micro-resources-consumable.jsonc' with { type: 'json' };

/**
 * Every consumable micro resource, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'consumable'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * import { CONSUMABLE_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-consumable';
 *
 * CONSUMABLE_MICRO_RESOURCES.find((resource) => resource.symbol === 'healthpack')?.name; // -> 'Medkit'
 * ```
 */
export const CONSUMABLE_MICRO_RESOURCES: readonly MicroResource[] = buildMicroResourceCatalogue(
    consumableData as readonly MicroResourceRecord[],
    'consumable',
);
