/**
 * The Elite Dangerous ship catalogue — every player-flyable hull's **identity, its
 * stats, and its slot layout in one record**, with the lookups an app needs to turn
 * an internal symbol or a display name into a {@link Ship}.
 *
 * There is only one list of ships and it is tiny (48 records), so the lookups here
 * take no catalogue argument at all — they always search {@link SHIPS}. Importing one
 * bundles the whole ship list, which is what you wanted anyway.
 *
 * Identity from EDCD FDevIDs (`shipyard.csv`); stats and slot layout from
 * EDCD/coriolis-data, joined on `symbol`; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import shipsData from '../../../data/ships/ships.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByKey } from '../internal/registry-index.js';
import type { CoreSlots, HardpointSlotSpec, OptionalSlotSpec, ShipSlots } from './slots.js';

/**
 * One ship hull — its **identity, stats and slot layout** in one record.
 *
 * @remarks
 * The identity fields (`symbol`, `name`, `entitlement`) come from Frontier's
 * shipyard registry and are always present. The stats fields (`hullMass`, `speed`,
 * …) and the slot-layout fields (`core`, `hardpoints`, `optional`, …) come from
 * coriolis-data and are present for every hull it covers. The Lynx Highliner
 * (`MediumTransport01`), which is not yet present there, carries equivalent fields
 * sourced from EDSY and Frontier's update notes. Masses are tonnes, `speed`/`boost`
 * are metres per second at 4 pips to engines, rotation rates are degrees per second.
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

    // ── Stats (primarily from coriolis-data; see the module remarks for exceptions). ──

    /** Empty-hull mass, in tonnes. A build's unladen mass is this plus every fitted module. */
    readonly hullMass: number;
    /** Top speed at 4 pips to engines, in metres per second. */
    readonly speed: number;
    /** Boost speed, in metres per second. */
    readonly boost: number;
    /** Base shield strength, in megajoules, before generator and boosters. */
    readonly baseShieldStrength: number;
    /** Base armour (hull hit points) before reinforcement. */
    readonly baseArmour: number;
    /** Hull hardness — resistance to armour piercing. */
    readonly hardness: number;
    /** Mass-lock factor — how strongly the hull impedes a smaller ship's FSD. */
    readonly masslock?: number;
    /** Number of crew seats (SLF/multicrew). */
    readonly crew: number;
    /** Heat capacity — how much heat the hull absorbs before taking damage. */
    readonly heatCapacity?: number;
    /** Reserve tank capacity, in tonnes (feeds the main tank from empty). */
    readonly reserveFuelCapacity: number;
    /**
     * Standard price of the **hull alone**, in credits, before any discount. This is
     * the figure a shipyard quotes when you already own the modules.
     */
    readonly hullCost: number;
    /**
     * Standard price of the hull **with its default module loadout**, in credits — the
     * "retail" price a shipyard shows for a ready-to-fly ship. Always ≥ {@link hullCost}.
     */
    readonly retailCost: number;
    /** Pitch rate, in degrees per second. */
    readonly pitch: number;
    /** Roll rate, in degrees per second. */
    readonly roll: number;
    /** Yaw rate, in degrees per second. */
    readonly yaw: number;
    /** Minimum thrust as a percentage — the throttle floor. */
    readonly minThrust: number;
    /** Speed gained per pip to engines, as a fraction of base speed. */
    readonly pipSpeed?: number;

    // ── Slot layout (from coriolis-data) — present alongside the stats. ──

    /** The seven core-internal mount sizes. */
    readonly core: CoreSlots;
    /**
     * Weapon hardpoints, largest first (1 Small – 4 Huge). A mount carries a
     * `restriction` only when it takes one family of weapons and nothing else — on
     * the Type-11 Prospector's four mining mounts alone.
     */
    readonly hardpoints: readonly HardpointSlotSpec[];
    /** Number of tiny utility mounts. */
    readonly utility: number;
    /**
     * Optional-internal mounts, largest first. A mount carries a `name` only where the
     * game's slot key is not what `enumerateSlots` would number it — the Anaconda's
     * `Slot14_Size1`, the Type-9 Heavy's `Slot00_Size8`, the Keelback's
     * `Slot03_Size3`.
     */
    readonly optional: readonly OptionalSlotSpec[];
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
    return findByKey(SHIPS, 'symbol', (ship) => ship.symbol, symbol);
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
    return findByKey(SHIPS, 'name', (ship) => ship.name, name);
}

/**
 * A hull's slot layout as a self-contained {@link ShipSlots}, ready to feed
 * {@link enumerateSlots}.
 *
 * @param symbol - The internal identifier, e.g. `"Anaconda"` (case-insensitive).
 * @returns The hull's slot layout, or `null` if no hull with that symbol is carried
 * or its catalogue record has no slot data. This is a projection of the slot-bearing
 * fields already on {@link Ship}.
 * @remarks
 * This is the **read-only** layout, for your own outfitting UI (feed it to
 * `enumerateSlots`). To assemble and edit an actual build — fit modules, engineer
 * them, read jump range — start a `ShipLoadout` instead and use its live
 * `slots()` / `slots('core')` views.
 * @example
 * ```ts
 * getShipSlots('anaconda')?.hardpoints;
 * // -> [{ size: 4 }, { size: 3 }, { size: 3 }, { size: 3 }, { size: 2 }, ...]
 * getShipSlots('LakonMiner')?.hardpoints[0];
 * // -> { size: 3, restriction: 'mining', name: 'LargeMiningHardpoint1' }
 * getShipSlots('Anaconda')?.optional?.at(-2);   // -> { size: 1, name: 'Slot14_Size1' }
 * getShipSlots('Sidewinder')?.optional?.at(-2); // -> { size: 1 } — the rules fit
 * ```
 */
export function getShipSlots(symbol: string): ShipSlots | null {
    const ship = getShipBySymbol(symbol);
    if (!ship) return null;
    return {
        symbol: ship.symbol,
        core: ship.core,
        hardpoints: ship.hardpoints,
        utility: ship.utility,
        optional: ship.optional,
    };
}
