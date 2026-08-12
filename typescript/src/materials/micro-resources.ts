/**
 * Odyssey **micro resource** types and lookups.
 *
 * Elite Dangerous: Odyssey adds on-foot **micro resources** — the components, data,
 * consumables and items a Commander carries on foot (distinct from the ship-side
 * engineering {@link Material}s, which have a grade and a line). This module holds the
 * {@link MicroResource} record shape and the functions that find one
 * ({@link getMicroResourceBySymbol}, {@link getMicroResourceByName},
 * {@link microResourcesInCategory}).
 *
 * **Every lookup searches all 196 micro resources by default** — you do not have to
 * hand it a catalogue:
 *
 * ```ts
 * getMicroResourceBySymbol('graphene')?.category; // -> 'component'
 * ```
 *
 * Each lookup still takes an optional second argument to **narrow** the search to a
 * subset — one category's catalogue, or any array you have filtered yourself:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./micro-resources-component` | `COMPONENT_MICRO_RESOURCES` | 33 |
 * | `./micro-resources-consumable` | `CONSUMABLE_MICRO_RESOURCES` | 6 |
 * | `./micro-resources-data` | `DATA_MICRO_RESOURCES` | 114 |
 * | `./micro-resources-item` | `ITEM_MICRO_RESOURCES` | 43 |
 * | `./micro-resources-all` | `ALL_MICRO_RESOURCES` | 196 (the default) |
 *
 * It narrows *results*, not bundle size: importing a lookup pulls all four
 * catalogues, since that is what it falls back to — 14.9 KiB minified for all 196.
 * {@link microResourcesInCategory} reaches the same subsets from a plain string.
 *
 * Data originates from EDCD FDevIDs (`microresources.csv`); see
 * [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @example
 * ```ts
 * import { getMicroResourceBySymbol } from '@elite-dangerous-almanac/core/materials/micro-resources';
 *
 * getMicroResourceBySymbol('graphene')?.name; // -> 'Graphene'
 * ```
 *
 * @packageDocumentation
 */

import { ALL_MICRO_RESOURCES } from './micro-resources-all.js';
import {
    createKeyIndex,
    filterByKey,
    findByKey,
    findInKeyIndex,
} from '../internal/registry-index.js';

/**
 * Frontier's micro-resource category — which on-foot inventory a micro resource
 * belongs to.
 *
 * - `component` — the manufactured parts spent upgrading suits and hand weapons.
 * - `consumable` — the deployable field tools (medkits, energy cells, grenades,
 *   E-Breach).
 * - `data` — the intel and files downloaded, stolen or traded on foot.
 * - `item` — the physical goods collected and traded on foot.
 */
export type MicroResourceCategory = 'component' | 'consumable' | 'data' | 'item';

/**
 * One Odyssey micro resource in Frontier's registry.
 *
 * @remarks
 * A pure registry record — it tells you what a micro resource *is* (symbol, name,
 * category), not where it is found or what it is worth. Unlike the ship-side
 * {@link Material}, a micro resource has no grade or line.
 */
export interface MicroResource {
    /**
     * Frontier's internal symbol, e.g. `"graphene"` — the id the player journal
     * reports (case-insensitively). This is the same field, with the same meaning,
     * as `symbol` on a ship, module or material.
     */
    readonly symbol: string;
    /** Which on-foot inventory the micro resource belongs to. */
    readonly category: MicroResourceCategory;
    /** Display name, e.g. `"Graphene"`. */
    readonly name: string;
}

const MICRO_RESOURCES_BY_SYMBOL = /* @__PURE__ */ createKeyIndex(ALL_MICRO_RESOURCES, 'symbol');
const MICRO_RESOURCES_BY_NAME = /* @__PURE__ */ createKeyIndex(ALL_MICRO_RESOURCES, 'name');

/**
 * Look up a micro resource by its Frontier symbol / journal id (case-insensitive).
 *
 * Here, `symbol` is Frontier's internal item id for the micro resource.
 *
 * @param symbol - The internal symbol, e.g. `"graphene"`, or the lower-cased form the
 * player journal reports. Leading/trailing whitespace and case are ignored.
 * @param microResources - Optional subset to search instead of all 196 micro
 * resources — `COMPONENT_MICRO_RESOURCES`, `CONSUMABLE_MICRO_RESOURCES`,
 * `DATA_MICRO_RESOURCES`, `ITEM_MICRO_RESOURCES`, or any array you have filtered
 * yourself. Omit it unless you specifically want to exclude the rest.
 * @returns The matching {@link MicroResource}, or `null` if no micro resource has
 * that symbol.
 * @example
 * ```ts
 * import { getMicroResourceBySymbol } from '@elite-dangerous-almanac/core/materials/micro-resources';
 *
 * getMicroResourceBySymbol('circuitboard')?.name; // -> 'Circuit Board'
 * ```
 */
export function getMicroResourceBySymbol(
    symbol: string,
    microResources: readonly MicroResource[] = ALL_MICRO_RESOURCES,
): MicroResource | null {
    return microResources === ALL_MICRO_RESOURCES
        ? findInKeyIndex(MICRO_RESOURCES_BY_SYMBOL, symbol)
        : findByKey(microResources, 'symbol', symbol);
}

/**
 * Look up a micro resource by its display name (case-insensitive).
 *
 * @param name - The display name as the catalogue spells it, e.g. `"Circuit Board"`.
 * Leading/trailing whitespace and case are ignored.
 * @param microResources - Optional subset to search (see {@link getMicroResourceBySymbol}).
 * @returns The matching {@link MicroResource}, or `null` if no micro resource has
 * that name.
 * @example
 * ```ts
 * import { getMicroResourceByName } from '@elite-dangerous-almanac/core/materials/micro-resources';
 *
 * getMicroResourceByName('circuit board')?.symbol; // -> 'circuitboard'
 * ```
 */
export function getMicroResourceByName(
    name: string,
    microResources: readonly MicroResource[] = ALL_MICRO_RESOURCES,
): MicroResource | null {
    return microResources === ALL_MICRO_RESOURCES
        ? findInKeyIndex(MICRO_RESOURCES_BY_NAME, name)
        : findByKey(microResources, 'name', name);
}

/**
 * Every micro resource in a given category, in catalogue order.
 *
 * @param category - The category to match, e.g. `'component'`. Leading/trailing
 * whitespace and case are ignored, like every other lookup here.
 * @param microResources - Optional subset to search (see {@link getMicroResourceBySymbol}).
 * @returns A new array of matches (possibly empty). The input is not modified.
 * @example
 * ```ts
 * import { microResourcesInCategory } from '@elite-dangerous-almanac/core/materials/micro-resources';
 *
 * microResourcesInCategory('consumable').length; // -> 6
 * microResourcesInCategory('Consumable').length; // -> 6; case is ignored
 * ```
 */
export function microResourcesInCategory(
    category: string,
    microResources: readonly MicroResource[] = ALL_MICRO_RESOURCES,
): MicroResource[] {
    return filterByKey(microResources, 'category', category);
}
