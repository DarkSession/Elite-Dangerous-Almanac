/**
 * The catalogue of **component** micro resources — the manufactured parts spent
 * upgrading suits and hand weapons at Pioneer Supplies.
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
import componentData from '../../../data/materials/micro-resources-component.jsonc' with { type: 'json' };

/**
 * All 33 component micro resources, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'component'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * import { COMPONENT_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-component';
 *
 * COMPONENT_MICRO_RESOURCES.length; // -> 33
 * ```
 */
export const COMPONENT_MICRO_RESOURCES: readonly MicroResource[] = buildMicroResourceCatalogue(
    componentData as readonly MicroResourceRecord[],
    'component',
);
