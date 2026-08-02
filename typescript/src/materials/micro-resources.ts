/**
 * Odyssey **micro resource** types and lookups — the **data-free** core of the
 * micro-resources feature.
 *
 * Elite Dangerous: Odyssey adds on-foot **micro resources** — the components, data,
 * consumables and items a Commander carries on foot (distinct from the ship-side
 * engineering {@link Material}s, which have a grade and a line). This module holds the
 * {@link MicroResource} record shape and the pure functions that search a catalogue
 * ({@link getMicroResourceBySymbol}, {@link getMicroResourceByName},
 * {@link microResourcesInCategory}); the catalogues themselves live in sibling
 * modules, one per Frontier category, so you only bundle the ones you ask for:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./micro-resources-component` | `COMPONENT_MICRO_RESOURCES` | 33 |
 * | `./micro-resources-consumable` | `CONSUMABLE_MICRO_RESOURCES` | 6 |
 * | `./micro-resources-data` | `DATA_MICRO_RESOURCES` | 114 |
 * | `./micro-resources-item` | `ITEM_MICRO_RESOURCES` | 43 |
 * | `./micro-resources-all` | `ALL_MICRO_RESOURCES` | 196 |
 *
 * Importing a query function from here costs nothing but the function: pass in
 * whichever catalogue you imported.
 *
 * Data originates from EDCD FDevIDs (`microresources.csv`); see
 * [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @example
 * ```ts
 * import { getMicroResourceBySymbol } from '@elite-dangerous-almanac/core/materials/micro-resources';
 * import { COMPONENT_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-component';
 *
 * getMicroResourceBySymbol('graphene', COMPONENT_MICRO_RESOURCES)?.name; // -> 'Graphene'
 * ```
 *
 * @packageDocumentation
 */

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
 * Look up a micro resource by its Frontier symbol / journal id (case-insensitive).
 *
 * This is the same lookup as `getMaterialBySymbol` / `getModuleBySymbol` — `symbol`
 * means Frontier's internal id in every catalogue.
 *
 * @param symbol - The internal symbol, e.g. `"graphene"`, or the lower-cased form the
 * player journal reports. Leading/trailing whitespace and case are ignored.
 * @param microResources - The catalogue to search — `COMPONENT_MICRO_RESOURCES`,
 * `CONSUMABLE_MICRO_RESOURCES`, `DATA_MICRO_RESOURCES`, `ITEM_MICRO_RESOURCES`,
 * `ALL_MICRO_RESOURCES`, or any subset you have filtered yourself.
 * @returns The matching {@link MicroResource}, or `null` if the catalogue holds no
 * micro resource with that symbol.
 * @example
 * ```ts
 * getMicroResourceBySymbol('circuitboard', COMPONENT_MICRO_RESOURCES)?.name; // -> 'Circuit Board'
 * ```
 */
export function getMicroResourceBySymbol(
    symbol: string,
    microResources: readonly MicroResource[],
): MicroResource | null {
    const wanted = normalize(symbol);
    return microResources.find((resource) => normalize(resource.symbol) === wanted) ?? null;
}

/**
 * Look up a micro resource by its display name (case-insensitive).
 *
 * @param name - The display name as the catalogue spells it, e.g. `"Circuit Board"`.
 * Leading/trailing whitespace and case are ignored.
 * @param microResources - The catalogue to search (see {@link getMicroResourceBySymbol}).
 * @returns The matching {@link MicroResource}, or `null` if the catalogue holds no
 * micro resource of that name.
 * @example
 * ```ts
 * getMicroResourceByName('circuit board', COMPONENT_MICRO_RESOURCES)?.symbol; // -> 'circuitboard'
 * ```
 */
export function getMicroResourceByName(
    name: string,
    microResources: readonly MicroResource[],
): MicroResource | null {
    const wanted = normalize(name);
    return microResources.find((resource) => normalize(resource.name) === wanted) ?? null;
}

/**
 * Every micro resource in a given category, in catalogue order.
 *
 * @param category - The category to match, e.g. `'component'`. Leading/trailing
 * whitespace and case are ignored, like every other lookup here.
 * @param microResources - The catalogue to search (see {@link getMicroResourceBySymbol}).
 * @returns A new array of matches (possibly empty). The input is not modified.
 * @example
 * ```ts
 * microResourcesInCategory('consumable', ALL_MICRO_RESOURCES).length; // -> 6
 * microResourcesInCategory('Consumable', ALL_MICRO_RESOURCES).length; // -> 6; case is ignored
 * ```
 */
export function microResourcesInCategory(
    category: MicroResourceCategory,
    microResources: readonly MicroResource[],
): MicroResource[];
export function microResourcesInCategory(
    category: string,
    microResources: readonly MicroResource[],
): MicroResource[];
export function microResourcesInCategory(
    category: string,
    microResources: readonly MicroResource[],
): MicroResource[] {
    const wanted = normalize(category);
    return microResources.filter((resource) => normalize(resource.category) === wanted);
}
