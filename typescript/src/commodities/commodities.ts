/**
 * Market-commodity types and lookups — the **data-free** core of the commodities
 * feature.
 *
 * Elite Dangerous trades goods at station commodity markets. Frontier splits them
 * into two registries: the ~256 **standard** commodities on every market, and the
 * ~142 **rare** commodities each produced at a single station. This module holds the
 * {@link Commodity} record shape and the pure functions that search a catalogue
 * ({@link getCommodityBySymbol}, {@link getCommodityByName},
 * {@link commoditiesInCategory}); the catalogues themselves live in sibling modules,
 * so you only bundle the ones you ask for:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./commodities-standard` | `COMMODITIES` | 256 |
 * | `./commodities-rare` | `RARE_COMMODITIES` | 142 |
 * | `./commodities-all` | `ALL_COMMODITIES` | 398 |
 *
 * Importing a query function from here costs nothing but the function: pass in
 * whichever catalogue you imported.
 *
 * Data from EDCD FDevIDs (`commodity.csv`, `rare_commodity.csv`); see
 * `data/commodities/SOURCES.md`.
 *
 * @example
 * ```ts
 * import { getCommodityBySymbol } from '@elite-dangerous-almanac/core/commodities';
 * import { COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-standard';
 *
 * getCommodityBySymbol('platinum', COMMODITIES)?.name; // -> 'Platinum'
 * ```
 *
 * @packageDocumentation
 */

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
 * Look up a commodity by its Frontier symbol / journal id (case-insensitive).
 *
 * This is the same lookup as `getShipBySymbol` / `getMaterialBySymbol` — `symbol`
 * means Frontier's internal id in every catalogue.
 *
 * @param symbol - The internal symbol, e.g. `"Platinum"`, or the lower-cased form the
 * market/journal reports (`"platinum"`). Leading/trailing whitespace is ignored.
 * @param commodities - The catalogue to search — `COMMODITIES`, `RARE_COMMODITIES`,
 * `ALL_COMMODITIES`, or any subset you have filtered yourself.
 * @returns The matching {@link Commodity}, or `null` if the catalogue holds no
 * commodity with that symbol.
 * @example
 * ```ts
 * getCommodityBySymbol('lavianbrandy', RARE_COMMODITIES)?.name; // -> 'Lavian Brandy'
 * ```
 */
export function getCommodityBySymbol(
    symbol: string,
    commodities: readonly Commodity[],
): Commodity | null {
    const wanted = normalize(symbol);
    return commodities.find((commodity) => normalize(commodity.symbol) === wanted) ?? null;
}

/**
 * Look up a commodity by its display name (case-insensitive).
 *
 * @param name - The display name as the market spells it, e.g. `"Lavian Brandy"`.
 * Leading/trailing whitespace and case are ignored, but matching is otherwise exact.
 * @param commodities - The catalogue to search (see {@link getCommodityBySymbol}).
 * @returns The matching {@link Commodity}, or `null` if the catalogue holds no
 * commodity of that name.
 * @example
 * ```ts
 * getCommodityByName('platinum', COMMODITIES)?.category; // -> 'Metals'
 * ```
 */
export function getCommodityByName(
    name: string,
    commodities: readonly Commodity[],
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
 * @param commodities - The catalogue to search (see {@link getCommodityBySymbol}).
 * @returns A new array of matches (possibly empty). The input is not modified.
 * @example
 * ```ts
 * commoditiesInCategory('Metals', COMMODITIES).length; // -> every metal on the market
 * commoditiesInCategory('metals', COMMODITIES).length; // -> the same; case is ignored
 * ```
 */
export function commoditiesInCategory(
    category: CommodityCategory,
    commodities: readonly Commodity[],
): Commodity[] {
    const wanted = normalize(category);
    return commodities.filter((commodity) => normalize(commodity.category) === wanted);
}
