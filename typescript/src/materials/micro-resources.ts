/**
 * Odyssey **micro resource** types and lookups.
 *
 * Elite Dangerous: Odyssey adds on-foot **micro resources** — the components, data,
 * consumables and items a Commander carries on foot (distinct from the ship-side
 * engineering {@link Material}s, which have a grade and a line). This module holds the
 * {@link MicroResource} record shape and the functions that find one
 * ({@link getMicroResource}, {@link getMicroResourceBySymbol},
 * {@link getMicroResourceByName}, {@link microResourcesInCategory}).
 *
 * **Every lookup searches all 196 micro resources by default** — you do not have to
 * hand it a catalogue:
 *
 * ```ts
 * getMicroResource('graphene')?.category; // -> 'component'
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
 * That argument narrows *results*, not bundle size: importing any lookup from here
 * pulls all four catalogues, since that is what it falls back to (about 14 KB
 * minified for all 196). {@link microResourcesInCategory} reaches the same subsets
 * from a plain string once the data is loaded.
 *
 * Data originates from EDCD FDevIDs (`microresources.csv`); see
 * [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @example
 * ```ts
 * import { getMicroResource } from '@elite-dangerous-almanac/core/materials/micro-resources';
 *
 * getMicroResource('graphene')?.name; // -> 'Graphene'
 * ```
 *
 * @packageDocumentation
 */

import { ALL_MICRO_RESOURCES } from './micro-resources-all.js';

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

/** Case- and whitespace-insensitive key for name, symbol, category and group matching. */
function normalize(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Look up a micro resource by **whatever string you have** — its Frontier symbol or
 * its display name.
 *
 * Reach for this when the string could be either: a journal line gives you the
 * symbol, a UI dropdown the display name. When you know which one you hold,
 * {@link getMicroResourceBySymbol} and {@link getMicroResourceByName} say so in the
 * call.
 *
 * @param microResource - The symbol or display name. Leading/trailing whitespace and
 * case are ignored.
 * @param microResources - Optional subset to search instead of all 196 micro
 * resources — one category's catalogue or any array you have filtered yourself.
 * @returns The matching {@link MicroResource}, or `null` if nothing matches. Symbol
 * is tried first, so an exact symbol always wins.
 * @example
 * ```ts
 * getMicroResource('circuitboard')?.name;    // -> 'Circuit Board'  (journal symbol)
 * getMicroResource('Circuit Board')?.symbol; // -> 'circuitboard'   (display name)
 * ```
 */
export function getMicroResource(
    microResource: string,
    microResources: readonly MicroResource[] = ALL_MICRO_RESOURCES,
): MicroResource | null {
    return (
        getMicroResourceBySymbol(microResource, microResources) ??
        getMicroResourceByName(microResource, microResources)
    );
}

/**
 * Look up a micro resource by its Frontier symbol / journal id (case-insensitive).
 *
 * This is the same lookup as `getMaterialBySymbol` / `getModuleBySymbol` — `symbol`
 * means Frontier's internal id in every catalogue.
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
 * getMicroResourceBySymbol('circuitboard')?.name; // -> 'Circuit Board'
 * ```
 */
export function getMicroResourceBySymbol(
    symbol: string,
    microResources: readonly MicroResource[] = ALL_MICRO_RESOURCES,
): MicroResource | null {
    const wanted = normalize(symbol);
    return microResources.find((resource) => normalize(resource.symbol) === wanted) ?? null;
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
 * getMicroResourceByName('circuit board')?.symbol; // -> 'circuitboard'
 * ```
 */
export function getMicroResourceByName(
    name: string,
    microResources: readonly MicroResource[] = ALL_MICRO_RESOURCES,
): MicroResource | null {
    const wanted = normalize(name);
    return microResources.find((resource) => normalize(resource.name) === wanted) ?? null;
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
 * microResourcesInCategory('consumable').length; // -> 6
 * microResourcesInCategory('Consumable').length; // -> 6; case is ignored
 * ```
 */
export function microResourcesInCategory(
    category: MicroResourceCategory,
    microResources?: readonly MicroResource[],
): MicroResource[];
export function microResourcesInCategory(
    category: string,
    microResources?: readonly MicroResource[],
): MicroResource[];
export function microResourcesInCategory(
    category: string,
    microResources: readonly MicroResource[] = ALL_MICRO_RESOURCES,
): MicroResource[] {
    const wanted = normalize(category);
    return microResources.filter((resource) => normalize(resource.category) === wanted);
}
