/**
 * The Elite Dangerous ship catalogue — Frontier's shipyard registry of every
 * player-flyable hull, with the lookups an app needs to turn an id, an internal
 * symbol, or a display name into a {@link Ship}.
 *
 * Unlike the outfitting modules (split into several catalogues by category), there
 * is only one list of ships and it is tiny (48 records, ~3.5 KB bundled), so this
 * module carries both the {@link SHIPS} data and the query functions. Importing a
 * lookup therefore bundles the whole ship list — which is what you wanted anyway.
 *
 * Data from EDCD FDevIDs (`shipyard.csv`); see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import shipsData from '../../../data/ships/ships.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * One ship hull in Frontier's shipyard registry.
 *
 * @remarks
 * A pure id/name record — this is the shipyard registry, not a stats sheet, so it
 * carries no hull mass, jump range or slot layout.
 */
export interface Ship {
    /**
     * Internal identifier, e.g. `"Empire_Trader"` (Imperial Clipper).
     *
     * @remarks
     * The journal's `Ship` field carries this lower-cased (`"empire_trader"`);
     * {@link getShipBySymbol} matches case-insensitively so either form resolves.
     * This is the hull's key — Frontier's numeric ship-type id is not carried.
     */
    readonly symbol: string;
    /** Display name, e.g. `"Imperial Clipper"`. Unique across the catalogue. */
    readonly name: string;
    /**
     * Frontier's DLC / purchase-grant entitlement token, e.g.
     * `"ELITE_HORIZONS_V_PLANETARY_LANDINGS"`.
     *
     * @remarks
     * Present only when the hull is gated behind an entitlement; absent (rather than
     * empty) for hulls available to everyone.
     */
    readonly entitlement?: string;
}

/**
 * Every player-flyable ship hull, in Frontier's shipyard order (roughly the order
 * the hulls were introduced, Sidewinder first).
 *
 * @example
 * ```ts
 * SHIPS.length;                                  // -> 48
 * SHIPS.find((s) => s.symbol === 'Anaconda')?.name; // -> 'Anaconda'
 * ```
 */
export const SHIPS: readonly Ship[] = deepFreeze(shipsData as readonly Ship[]);

/**
 * Look up a ship by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Empire_Trader"`. Leading/trailing
 * whitespace and case are ignored, so the journal's lower-cased form
 * (`"empire_trader"`) resolves too.
 * @returns The matching {@link Ship}, or `null` if no hull has that symbol.
 * @example
 * ```ts
 * getShipBySymbol('empire_trader')?.name; // -> 'Imperial Clipper'
 * ```
 */
export function getShipBySymbol(symbol: string): Ship | null {
    const wanted = symbol.trim().toLowerCase();
    return SHIPS.find((ship) => ship.symbol.toLowerCase() === wanted) ?? null;
}

/**
 * Look up a ship by display name, case-insensitively.
 *
 * @param name - The display name as the shipyard spells it, e.g.
 * `"Imperial Clipper"`. Leading/trailing whitespace and case are ignored, but
 * matching is otherwise exact.
 * @returns The matching {@link Ship}, or `null` if no hull has that name.
 * @example
 * ```ts
 * getShipByName('imperial clipper')?.symbol; // -> 'Empire_Trader'
 * ```
 */
export function getShipByName(name: string): Ship | null {
    const wanted = name.trim().toLowerCase();
    return SHIPS.find((ship) => ship.name.toLowerCase() === wanted) ?? null;
}
