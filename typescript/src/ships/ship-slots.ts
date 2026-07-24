/**
 * Per-hull **slot layouts** — every mount a ship offers (core, hardpoint, utility,
 * optional internal) plus its armour options, keyed by the same `symbol` as
 * `./ships`.
 *
 * One small catalogue (47 hulls), so — like `./ship-stats` — this module carries both
 * the {@link SHIP_SLOTS} data and the {@link getShipSlots} lookup. Expand a layout
 * into keyed mounts with {@link enumerateSlots} from `./slots`.
 *
 * Data from EDCD/coriolis-data (`ships/*.json` slots + bulkheads); see
 * `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import shipSlotsData from '../../../data/ships/ship-slots.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';
import type { ShipSlots } from './slots.js';

/**
 * Every hull's slot layout, in the registry's shipyard order. Shorter than
 * {@link SHIPS} — hulls the upstream data does not cover are absent.
 *
 * @example
 * ```ts
 * SHIP_SLOTS.find((s) => s.symbol === 'Anaconda')?.core.frameShiftDrive; // -> 6
 * ```
 */
export const SHIP_SLOTS: readonly ShipSlots[] = deepFreeze(shipSlotsData as readonly ShipSlots[]);

/**
 * Look up a hull's slot layout by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Anaconda"`. Leading/trailing
 * whitespace and case are ignored, so the journal's lower-cased form resolves too.
 * @returns The matching {@link ShipSlots}, or `null` if no hull with that symbol is
 * carried.
 * @example
 * ```ts
 * getShipSlots('anaconda')?.hardpoints; // -> [4, 3, 3, 3, 2, 2, 1, 1]
 * ```
 */
export function getShipSlots(symbol: string): ShipSlots | null {
    const wanted = symbol.trim().toLowerCase();
    return SHIP_SLOTS.find((s) => s.symbol.toLowerCase() === wanted) ?? null;
}
