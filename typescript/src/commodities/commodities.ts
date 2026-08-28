/**
 * Market-commodity types and lookups.
 *
 * Elite Dangerous trades goods at station commodity markets. Frontier splits them
 * into two registries: the ~257 **standard** commodities on every market, and the
 * ~142 **rare** commodities each produced at a single station. This module holds the
 * {@link Commodity} record shape and the functions that find one
 * ({@link getCommodityBySymbol}, {@link getCommodityByName},
 * {@link commoditiesInCategory}).
 *
 * **Every lookup searches all 399 commodities by default** — standard and rare — so
 * you do not have to know which registry a good belongs to before you can find it:
 *
 * ```ts
 * getCommodityByName('lavian brandy')?.rare; // -> true
 * ```
 *
 * The two **by-key** lookups take an optional second argument to **narrow** the search
 * to a subset — one registry's catalogue, or any array you have filtered yourself:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./commodities-standard` | `COMMODITIES` | 257 |
 * | `./commodities-rare` | `RARE_COMMODITIES` | 142 |
 * | `./commodities-all` | `ALL_COMMODITIES` | 399 (the default) |
 *
 * It narrows *results*, not bundle size: importing a lookup pulls both catalogues,
 * since that is what it falls back to — ~30 KiB minified for all 399. Every record
 * carries a {@link Commodity.rare} flag, so a subset is one `.filter()` away.
 *
 * **Only `ALL_COMMODITIES` itself is indexed.** A by-key lookup answers from an O(1)
 * index when the catalogue you pass *is* `ALL_COMMODITIES` — the same object, not a
 * copy — and scans linearly otherwise, including for `[...ALL_COMMODITIES]`, which
 * holds the same 399 records. Omitting the argument always takes the indexed path, so
 * pass one only when you mean to exclude the other registry.
 *
 * {@link commoditiesInCategory} takes no catalogue: it returns an array, so narrowing
 * it is `.filter()` on the result — `rare` tells the two registries apart.
 *
 * @example
 * ```ts
 * import { getCommodityBySymbol } from '@elite-dangerous-almanac/core/commodities';
 *
 * getCommodityBySymbol('platinum')?.category; // -> 'Metals'
 * ```
 *
 * @packageDocumentation
 */

import { ALL_COMMODITIES } from './commodities-all.js';
import {
    createKeyIndex,
    filterByKey,
    findByKey,
    findInKeyIndex,
} from '../internal/registry-index.js';

/**
 * A market group — the shelf a commodity sits on at the commodity market.
 *
 * @remarks
 * These are Frontier's own category strings (spelled with spaces where the game
 * spells them so, e.g. `"Consumer Items"`). Both standard and rare commodities draw
 * from the same set; the rare registry uses only a subset of these groups.
 * `"NonMarketable"` is Frontier's group for goods that are not freely traded (its one
 * member is Limpets).
 */
export type CommodityCategory =
    | 'Chemicals'
    | 'Consumer Items'
    | 'Foods'
    | 'Industrial Materials'
    | 'Legal Drugs'
    | 'Machinery'
    | 'Medicines'
    | 'Metals'
    | 'Minerals'
    | 'NonMarketable'
    | 'Salvage'
    | 'Slavery'
    | 'Technology'
    | 'Textiles'
    | 'Waste'
    | 'Weapons';

/**
 * One tradable commodity in Frontier's market registry.
 *
 * @remarks
 * A pure id/name/category record — this is the commodity registry, not a price
 * sheet, so it carries no buy/sell price, supply, demand or producing station.
 * Whether it is a rare good is the {@link Commodity.rare} flag; a rare's origin
 * station is not carried (the library has no station registry to key it against).
 */
export interface Commodity {
    /**
     * Frontier's internal symbol, e.g. `"Platinum"` — the id the market and player
     * journal report (case-insensitively, so `"platinum"` matches). This is the same
     * field, with the same meaning, as `symbol` on a ship, module or material, and is
     * the commodity's key.
     */
    readonly symbol: string;
    /** Display name, e.g. `"Platinum"`. */
    readonly name: string;
    /** The market group this commodity is sold under. */
    readonly category: CommodityCategory;
    /**
     * Whether this is a **rare** commodity — a location-specific luxury good produced
     * at a single station — rather than a standard market good.
     *
     * @remarks
     * Derived from the catalogue the record lives in: every {@link RARE_COMMODITIES}
     * record is `true`, every {@link COMMODITIES} record is `false`.
     */
    readonly rare: boolean;
}

const COMMODITIES_BY_SYMBOL = /* @__PURE__ */ createKeyIndex(ALL_COMMODITIES, 'symbol');
const COMMODITIES_BY_NAME = /* @__PURE__ */ createKeyIndex(ALL_COMMODITIES, 'name');

/**
 * Look up a commodity by its Frontier symbol / journal id (case-insensitive).
 *
 * Here, `symbol` is Frontier's internal item id for the commodity.
 *
 * @param symbol - The internal symbol, e.g. `"Platinum"`, or the lower-cased form the
 * market/journal reports (`"platinum"`). Leading/trailing whitespace is ignored.
 * @param commodities - Optional subset to search instead of all 399 commodities —
 * `COMMODITIES` (standard only), `RARE_COMMODITIES`, or any array you have filtered
 * yourself. Omit it unless you specifically want to exclude the other registry: the
 * indexed O(1) path is taken only when the argument is omitted or is `ALL_COMMODITIES`
 * **by reference**, and every other array — a copy of that same catalogue included —
 * is scanned.
 * @returns The matching {@link Commodity}, or `null` if no commodity has that symbol.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getCommodityBySymbol } from '@elite-dangerous-almanac/core/commodities/commodities';
 *
 * getCommodityBySymbol('lavianbrandy')?.name; // -> 'Lavian Brandy'
 * ```
 */
export function getCommodityBySymbol(
    symbol: string,
    commodities: readonly Commodity[] = ALL_COMMODITIES,
): Commodity | null {
    return commodities === ALL_COMMODITIES
        ? findInKeyIndex(COMMODITIES_BY_SYMBOL, symbol, 'getCommodityBySymbol: symbol')
        : findByKey(commodities, 'symbol', symbol, 'getCommodityBySymbol: symbol');
}

/**
 * Look up a commodity by its display name (case-insensitive).
 *
 * @param name - The display name as the market spells it, e.g. `"Lavian Brandy"`.
 * Leading/trailing whitespace and case are ignored, but matching is otherwise exact.
 * @param commodities - Optional subset to search (see {@link getCommodityBySymbol}).
 * @returns The matching {@link Commodity}, or `null` if no commodity has that name.
 * @throws {TypeError} If `name` is present and not a string. A nullish
 * `name` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getCommodityByName } from '@elite-dangerous-almanac/core/commodities/commodities';
 *
 * getCommodityByName('platinum')?.category; // -> 'Metals'
 * ```
 */
export function getCommodityByName(
    name: string,
    commodities: readonly Commodity[] = ALL_COMMODITIES,
): Commodity | null {
    return commodities === ALL_COMMODITIES
        ? findInKeyIndex(COMMODITIES_BY_NAME, name, 'getCommodityByName: name')
        : findByKey(commodities, 'name', name, 'getCommodityByName: name');
}

/**
 * Every commodity in a given market group, in catalogue order.
 *
 * @param category - The market group to match, e.g. `"Metals"`. Leading/trailing
 * whitespace and case are ignored, like every other lookup here, so a group name
 * that arrived from a market payload or a user's dropdown resolves without
 * re-casing it first.
 * @returns A new array of matches (possibly empty).
 * @throws {TypeError} If `category` is present and not a string. A nullish
 * `category` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { commoditiesInCategory } from '@elite-dangerous-almanac/core/commodities/commodities';
 *
 * commoditiesInCategory('Metals').length; // -> every metal, standard and rare
 * commoditiesInCategory('metals').filter((c) => !c.rare).length; // -> the standard ones only
 * ```
 */
export function commoditiesInCategory(category: string): Commodity[] {
    return filterByKey(ALL_COMMODITIES, 'category', category, 'commoditiesInCategory: category');
}
