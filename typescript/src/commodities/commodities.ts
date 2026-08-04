/**
 * Market-commodity types and lookups.
 *
 * Elite Dangerous trades goods at station commodity markets. Frontier splits them
 * into two registries: the ~257 **standard** commodities on every market, and the
 * ~142 **rare** commodities each produced at a single station. This module holds the
 * {@link Commodity} record shape and the functions that find one
 * ({@link getCommodity}, {@link getCommodityBySymbol}, {@link getCommodityByName},
 * {@link commoditiesInCategory}).
 *
 * **Every lookup searches all 399 commodities by default** — standard and rare — so
 * you do not have to know which registry a good belongs to before you can find it:
 *
 * ```ts
 * getCommodity('lavian brandy')?.rare; // -> true
 * ```
 *
 * Each lookup still takes an optional second argument to **narrow** the search to a
 * subset — one registry's catalogue, or any array you have filtered yourself:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./commodities-standard` | `COMMODITIES` | 257 |
 * | `./commodities-rare` | `RARE_COMMODITIES` | 142 |
 * | `./commodities-all` | `ALL_COMMODITIES` | 399 (the default) |
 *
 * That argument narrows *results*, not bundle size: importing any lookup from here
 * pulls both catalogues, since that is what it falls back to (about 28 KB minified
 * for all 399). Every record carries a {@link Commodity.rare} flag, so a subset is
 * one `.filter()` away once the data is loaded.
 *
 * Data from EDCD FDevIDs (`commodity.csv`, `rare_commodity.csv`), plus one standard
 * record observed in a player journal and not yet in FDevIDs (its market category is
 * a maintainer assignment); see
 * [`data/commodities/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/commodities/SOURCES.md).
 *
 * @example
 * ```ts
 * import { getCommodity } from '@elite-dangerous-almanac/core/commodities';
 *
 * getCommodity('platinum')?.category; // -> 'Metals'
 * ```
 *
 * @packageDocumentation
 */

import { ALL_COMMODITIES } from './commodities-all.js';

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

/** Case- and whitespace-insensitive key for name, symbol, category and group matching. */
function normalize(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Look up a commodity by **whatever string you have** — its Frontier symbol or its
 * display name.
 *
 * Reach for this when the string could be either: a market or journal payload gives
 * you the symbol, a UI dropdown the display name. When you know which one you hold,
 * {@link getCommodityBySymbol} and {@link getCommodityByName} say so in the call.
 *
 * @param commodity - The symbol or display name. Leading/trailing whitespace and
 * case are ignored.
 * @param commodities - Optional subset to search instead of all 399 commodities —
 * `COMMODITIES` (standard only), `RARE_COMMODITIES`, or any array you have filtered
 * yourself.
 * @returns The matching {@link Commodity}, or `null` if nothing matches. Symbol is
 * tried first, so an exact symbol always wins.
 * @example
 * ```ts
 * getCommodity('lavianbrandy')?.name;   // -> 'Lavian Brandy'  (journal symbol)
 * getCommodity('Lavian Brandy')?.rare;  // -> true             (display name)
 * ```
 */
export function getCommodity(
    commodity: string,
    commodities: readonly Commodity[] = ALL_COMMODITIES,
): Commodity | null {
    return (
        getCommodityBySymbol(commodity, commodities) ?? getCommodityByName(commodity, commodities)
    );
}

/**
 * Look up a commodity by its Frontier symbol / journal id (case-insensitive).
 *
 * This is the same lookup as `getShipBySymbol` / `getMaterialBySymbol` — `symbol`
 * means Frontier's internal id in every catalogue.
 *
 * @param symbol - The internal symbol, e.g. `"Platinum"`, or the lower-cased form the
 * market/journal reports (`"platinum"`). Leading/trailing whitespace is ignored.
 * @param commodities - Optional subset to search instead of all 399 commodities —
 * `COMMODITIES` (standard only), `RARE_COMMODITIES`, or any array you have filtered
 * yourself. Omit it unless you specifically want to exclude the other registry.
 * @returns The matching {@link Commodity}, or `null` if no commodity has that symbol.
 * @example
 * ```ts
 * getCommodityBySymbol('lavianbrandy')?.name; // -> 'Lavian Brandy'
 * ```
 */
export function getCommodityBySymbol(
    symbol: string,
    commodities: readonly Commodity[] = ALL_COMMODITIES,
): Commodity | null {
    const wanted = normalize(symbol);
    return commodities.find((commodity) => normalize(commodity.symbol) === wanted) ?? null;
}

/**
 * Look up a commodity by its display name (case-insensitive).
 *
 * @param name - The display name as the market spells it, e.g. `"Lavian Brandy"`.
 * Leading/trailing whitespace and case are ignored, but matching is otherwise exact.
 * @param commodities - Optional subset to search (see {@link getCommodityBySymbol}).
 * @returns The matching {@link Commodity}, or `null` if no commodity has that name.
 * @example
 * ```ts
 * getCommodityByName('platinum')?.category; // -> 'Metals'
 * ```
 */
export function getCommodityByName(
    name: string,
    commodities: readonly Commodity[] = ALL_COMMODITIES,
): Commodity | null {
    const wanted = normalize(name);
    return commodities.find((commodity) => normalize(commodity.name) === wanted) ?? null;
}

/**
 * Every commodity in a given market group, in catalogue order.
 *
 * @param category - The market group to match, e.g. `"Metals"`. Leading/trailing
 * whitespace and case are ignored, like every other lookup here, so a group name
 * that arrived from a market payload or a user's dropdown resolves without
 * re-casing it first.
 * @param commodities - Optional subset to search (see {@link getCommodityBySymbol}).
 * @returns A new array of matches (possibly empty). The input is not modified.
 * @example
 * ```ts
 * commoditiesInCategory('Metals').length;            // -> every metal, standard and rare
 * commoditiesInCategory('metals', COMMODITIES).length; // -> the standard ones only
 * ```
 */
export function commoditiesInCategory(
    category: CommodityCategory,
    commodities?: readonly Commodity[],
): Commodity[];
export function commoditiesInCategory(
    category: string,
    commodities?: readonly Commodity[],
): Commodity[];
export function commoditiesInCategory(
    category: string,
    commodities: readonly Commodity[] = ALL_COMMODITIES,
): Commodity[] {
    const wanted = normalize(category);
    return commodities.filter((commodity) => normalize(commodity.category) === wanted);
}
