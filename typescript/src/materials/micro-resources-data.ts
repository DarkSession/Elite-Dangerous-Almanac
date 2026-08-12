/**
 * The catalogue of **data** micro resources — the intel and files downloaded,
 * stolen or traded on foot.
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
import dataData from '../../../data/materials/micro-resources-data.jsonc' with { type: 'json' };

/**
 * All 114 data micro resources, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'data'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * import { DATA_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-data';
 *
 * DATA_MICRO_RESOURCES.length; // -> 114
 * ```
 */
export const DATA_MICRO_RESOURCES: readonly MicroResource[] = buildMicroResourceCatalogue(
    dataData as readonly MicroResourceRecord[],
    'data',
);
