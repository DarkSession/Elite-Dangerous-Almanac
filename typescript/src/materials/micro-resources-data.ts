/**
 * The catalogue of **data** micro resources — the intel and files downloaded,
 * stolen or traded on foot.
 *
 * Search it with the query functions in `./micro-resources`.
 *
 * Data from EDCD FDevIDs (`microresources.csv`); see `data/materials/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { MicroResource } from './micro-resources.js';
import dataData from '../../../data/materials/micro-resources-data.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 114 data micro resources, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'data'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * DATA_MICRO_RESOURCES.length; // -> 114
 * ```
 */
export const DATA_MICRO_RESOURCES: readonly MicroResource[] = deepFreeze(
    dataData as readonly MicroResource[],
);
