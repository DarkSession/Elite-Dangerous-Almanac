/**
 * Every Odyssey micro resource — the component, consumable, data and item
 * catalogues concatenated.
 *
 * Importing this pulls all four data modules; when you only need one category,
 * import `COMPONENT_MICRO_RESOURCES`, `CONSUMABLE_MICRO_RESOURCES`,
 * `DATA_MICRO_RESOURCES` or `ITEM_MICRO_RESOURCES` from their own module so a bundler
 * can drop the rest.
 *
 * @packageDocumentation
 */

import type { MicroResource } from './micro-resources.js';
import { COMPONENT_MICRO_RESOURCES } from './micro-resources-component.js';
import { CONSUMABLE_MICRO_RESOURCES } from './micro-resources-consumable.js';
import { DATA_MICRO_RESOURCES } from './micro-resources-data.js';
import { ITEM_MICRO_RESOURCES } from './micro-resources-item.js';

/**
 * All 226 micro resources across every category — component, then consumable, then
 * data, then item.
 *
 * @example
 * ```ts
 * import { ALL_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-all';
 *
 * ALL_MICRO_RESOURCES.length; // -> 226
 * ```
 */
export const ALL_MICRO_RESOURCES: readonly MicroResource[] = Object.freeze([
    ...COMPONENT_MICRO_RESOURCES,
    ...CONSUMABLE_MICRO_RESOURCES,
    ...DATA_MICRO_RESOURCES,
    ...ITEM_MICRO_RESOURCES,
]);
