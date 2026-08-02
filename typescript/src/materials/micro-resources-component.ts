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
import componentData from '../../../data/materials/micro-resources-component.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 33 component micro resources, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'component'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * COMPONENT_MICRO_RESOURCES.length; // -> 33
 * ```
 */
export const COMPONENT_MICRO_RESOURCES: readonly MicroResource[] = deepFreeze(
    componentData as readonly MicroResource[],
);
