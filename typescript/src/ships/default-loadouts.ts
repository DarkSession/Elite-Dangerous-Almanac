/**
 * The stock module loadout for every player-flyable ship.
 *
 * Each record is deliberately small: a hull symbol plus the journal-compatible slot
 * and module symbols fitted when the ship is supplied. Use {@link getDefaultLoadout}
 * when an application needs the identities without pulling in the outfitting catalogue;
 * use `ShipLoadout.default` (in `./ship-loadout`) when it needs a live, calculated build.
 *
 * Stock builds come from EDSY, with coriolis-data and captured Frontier journal
 * loadouts supplying or corroborating the advanced planetary approach suite and cargo
 * hatches; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import defaultLoadoutsData from '../../../data/ships/default-loadouts.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex } from '../internal/registry-index.js';

/** One module fitted to a stock ship. */
export interface DefaultLoadoutModule {
    /** Journal-compatible mount key, e.g. `"FrameShiftDrive"` or `"Slot01_Size2"`. */
    readonly slot: string;
    /** Frontier module symbol, e.g. `"Int_Hyperdrive_Size2_Class1"`. */
    readonly symbol: string;
}

/** A hull's ready-to-fly module fit as supplied by the shipyard. */
export interface DefaultLoadout {
    /** Frontier hull symbol, e.g. `"SideWinder"`. */
    readonly symbol: string;
    /**
     * Fitted modules in outfitting-panel order. Empty optional, hardpoint and utility
     * mounts are omitted; armour, the seven core internals, planetary approach suite
     * and built-in cargo hatch are always present.
     */
    readonly modules: readonly DefaultLoadoutModule[];
}

/**
 * Default loadouts for all 48 player-flyable hulls, in
 * {@link ships!SHIPS | SHIPS} catalogue order.
 *
 * @remarks
 * The array, records and nested module entries are deeply frozen. This module carries
 * module identities only and does not import the much larger outfitting catalogues.
 *
 * @example
 * ```ts
 * import { DEFAULT_LOADOUTS } from '@elite-dangerous-almanac/core/ships/default-loadouts';
 *
 * DEFAULT_LOADOUTS.length; // -> 48
 * DEFAULT_LOADOUTS[0]?.modules.find((module) => module.slot === 'FrameShiftDrive')?.symbol;
 * // -> 'Int_Hyperdrive_Size2_Class1'
 * ```
 */
export const DEFAULT_LOADOUTS: readonly DefaultLoadout[] = deepFreeze(
    defaultLoadoutsData as readonly DefaultLoadout[],
);

const DEFAULT_LOADOUTS_BY_SYMBOL = /* @__PURE__ */ createKeyIndex(DEFAULT_LOADOUTS, 'symbol');

/**
 * Look up a hull's default module loadout by Frontier symbol, case-insensitively.
 *
 * @param shipSymbol - Hull symbol, e.g. `"SideWinder"`. Leading/trailing whitespace
 * and case are ignored.
 * @returns The deeply frozen default loadout, or `null` when the hull is unknown.
 * @throws {TypeError} If `shipSymbol` is present and not a string. A nullish value is
 * a miss, like any other unrecognised symbol.
 * @example
 * ```ts
 * import { getDefaultLoadout } from '@elite-dangerous-almanac/core/ships/default-loadouts';
 *
 * getDefaultLoadout(' sidewinder ')?.modules.length; // -> 16
 * getDefaultLoadout('not_a_ship'); // -> null
 * ```
 */
export function getDefaultLoadout(shipSymbol: string): DefaultLoadout | null {
    return findInKeyIndex(DEFAULT_LOADOUTS_BY_SYMBOL, shipSymbol, 'getDefaultLoadout: shipSymbol');
}
