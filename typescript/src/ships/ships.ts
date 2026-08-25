/**
 * The Elite Dangerous ship catalogue — every player-flyable hull's **identity, its
 * stats, and its slot layout in one record**, with the lookups an app needs to turn
 * an internal symbol or a display name into a {@link Ship}.
 *
 * There is only one list of ships and it is tiny (48 records), so the lookups here
 * take no catalogue argument at all — they always search {@link SHIPS}. Importing one
 * bundles the whole ship list, which is what you wanted anyway. Stock module identities
 * live in `./default-loadouts`, keeping this small hull catalogue independent of them.
 *
 * Symbols and entitlements come from EDCD FDevIDs (`shipyard.csv`), with exact English
 * display names and stat corrections verified in-game. The remaining stats and slot
 * layout come primarily from EDCD/coriolis-data, joined on `symbol`; see
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import shipsData from '../../../data/ships/ships.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex } from '../internal/registry-index.js';
import { requireStringIfPresent } from '../internal/argument-guards.js';
import type { CoreSlots, HardpointSlotSpec, OptionalSlotSpec, ShipSlots } from './slots.js';

/**
 * One ship hull — its **identity, stats and slot layout** in one record.
 *
 * @remarks
 * `symbol` and any `entitlement` come from Frontier's shipyard registry. `name` is the
 * installed English localisation string where in-game verification differs from that
 * registry. `manufacturer`, `size`, the stats fields (`hullMass`, `maximumSpeed`, …), and the
 * slot-layout fields (`core`, `hardpoints`, `optional`, …) come primarily from
 * coriolis-data, with verified in-game readings governing stat disagreements and
 * omissions. `manufacturer` and `size` are present for every hull; fields documented
 * as optional below remain absent where their source carries no value. The Lynx
 * Highliner (`MediumTransport01`), which is absent from the pinned coriolis-data
 * revision, carries equivalent fields sourced from EDSY, Frontier's update notes and
 * in-game verification. Masses are tonnes, speed/boost fields are metres per second,
 * and rotation rates are degrees per second. Minimum/full endpoint pairs are the
 * installed values at zero/four ENG pips.
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
    /** Installed English display name, e.g. `"Imperial Clipper"`. Unique across the catalogue. */
    readonly name: string;
    /** Hull manufacturer as the shipyard names it, e.g. `"Faulcon DeLacy"`. */
    readonly manufacturer: string;
    /** Landing-pad size class required by the hull. */
    readonly size: 'small' | 'medium' | 'large';
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
    /** Speed at zero ENG pips, in metres per second. */
    readonly minimumSpeed: number;
    /** Speed at four ENG pips, in metres per second. */
    readonly maximumSpeed: number;
    /** Boost speed, in metres per second. */
    readonly boost: number;
    /** Base shield strength, in megajoules, before generator and boosters. */
    readonly baseShieldStrength: number;
    /** Base armour (hull hit points) before reinforcement. */
    readonly baseArmour: number;
    /** Hull hardness — resistance to armour piercing. */
    readonly hardness: number;
    /** Mass-lock factor — how strongly the hull impedes a smaller ship's FSD. */
    readonly masslock: number;
    /** Number of crew seats (SLF/multicrew). */
    readonly crew: number;
    /** Heat capacity — how much heat the hull absorbs before taking damage. */
    readonly heatCapacity: number;
    /**
     * Maximum heat dissipation, in thermal-load units per second — the heat the hull
     * sheds at heat level `1`, and the load a build can carry indefinitely.
     *
     * @remarks
     * The stat a heat calculation reads: heat settles where thermal load and
     * dissipation balance, and {@link heatCapacity} only decides how long the ship
     * takes to get there. See `./heat`.
     *
     * Community-measured rather than published by Frontier. Every player-flyable hull
     * carries a value, from the Hauler's `16.2` through the Cutter's `72.58`.
     */
    readonly heatDissipation: number;
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
    /** Pitch rate at zero ENG pips, in degrees per second from `0` through {@link pitch}. */
    readonly minPitch: number;
    /** Pitch rate at four ENG pips, in degrees per second. */
    readonly pitch: number;
    /** Roll rate at zero ENG pips, in degrees per second from `0` through {@link roll}. */
    readonly minRoll: number;
    /** Roll rate at four ENG pips, in degrees per second. */
    readonly roll: number;
    /** Yaw rate at zero ENG pips, in degrees per second from `0` through {@link yaw}. */
    readonly minYaw: number;
    /** Yaw rate at four ENG pips, in degrees per second. */
    readonly yaw: number;

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
 * Every player-flyable ship hull, in Frontier's shipyard order — roughly the order the
 * hulls were introduced, beginning with the Sidewinder.
 *
 * @example
 * ```ts
 * import { SHIPS } from '@elite-dangerous-almanac/core/ships/ships';
 *
 * SHIPS.length;                                  // -> 48
 * SHIPS.find((s) => s.symbol === 'Anaconda')?.name; // -> 'Anaconda'
 * ```
 */
export const SHIPS: readonly Ship[] = deepFreeze(shipsData as readonly Ship[]);

const SHIPS_BY_SYMBOL = /* @__PURE__ */ createKeyIndex(SHIPS, 'symbol');
const SHIPS_BY_NAME = /* @__PURE__ */ createKeyIndex(SHIPS, 'name');

/**
 * Look up a ship by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Empire_Trader"`. Leading/trailing
 * whitespace and case are ignored, so the journal's lower-cased form
 * (`"empire_trader"`) resolves too.
 * @returns The matching {@link Ship}, or `null` if no hull has that symbol.
 * @remarks
 * The hulls form one small, unsplit catalogue, so unlike module, material,
 * micro-resource and commodity lookups there is no useful subset argument to narrow.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
 *
 * getShipBySymbol('empire_trader')?.name; // -> 'Imperial Clipper'
 * ```
 */
export function getShipBySymbol(symbol: string): Ship | null {
    return findInKeyIndex(SHIPS_BY_SYMBOL, symbol, 'getShipBySymbol: symbol');
}

/**
 * Look up a ship by display name, case-insensitively.
 *
 * @param name - The display name as the shipyard spells it, e.g.
 * `"Imperial Clipper"`. Leading/trailing whitespace and case are ignored, but
 * matching is otherwise exact.
 * @returns The matching {@link Ship}, or `null` if no hull has that name.
 * @remarks
 * The hulls form one small, unsplit catalogue, so unlike module, material,
 * micro-resource and commodity lookups there is no useful subset argument to narrow.
 * @throws {TypeError} If `name` is present and not a string. A nullish
 * `name` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getShipByName } from '@elite-dangerous-almanac/core/ships/ships';
 *
 * getShipByName('imperial clipper')?.symbol; // -> 'Empire_Trader'
 * ```
 */
export function getShipByName(name: string): Ship | null {
    return findInKeyIndex(SHIPS_BY_NAME, name, 'getShipByName: name');
}

/**
 * A hull's slot layout as a self-contained {@link ShipSlots}, ready to feed
 * {@link enumerateSlots}.
 *
 * @param symbol - The internal identifier, e.g. `"Anaconda"`. Leading/trailing
 * whitespace and case are ignored.
 * @returns The hull's slot layout, or `null` if no hull with that symbol is carried.
 * This is a projection of the slot-bearing fields already on {@link Ship}, all four of
 * which every carried hull has, so a symbol that resolves always has a layout.
 * @remarks
 * This is the **read-only** layout, for your own outfitting UI (feed it to
 * `enumerateSlots`). To assemble and edit an actual build — fit modules, engineer
 * them, read jump range — start a `ShipLoadout` instead and use its live
 * `slots()` / `slots('core')` views.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getShipSlots } from '@elite-dangerous-almanac/core/ships/ships';
 *
 * getShipSlots('anaconda')?.hardpoints;
 * // -> [{ size: 4 }, { size: 3 }, { size: 3 }, { size: 3 }, { size: 2 }, ...]
 * getShipSlots('LakonMiner')?.hardpoints[0];
 * // -> { size: 3, restriction: 'mining', name: 'LargeMiningHardpoint1' }
 * getShipSlots('Anaconda')?.optional?.at(-2);   // -> { size: 1, name: 'Slot14_Size1' }
 * getShipSlots('Sidewinder')?.optional?.at(-2); // -> { size: 1 } — the rules fit
 * ```
 */
export function getShipSlots(symbol: string): ShipSlots | null {
    // Named here rather than left to the lookup below, so a wrong type reports the
    // function the caller reached for instead of the one it delegates to.
    requireStringIfPresent(symbol, 'getShipSlots: symbol');
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
