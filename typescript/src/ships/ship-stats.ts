/**
 * Per-hull **ship stats** — hull mass, speed, base shields and armour, and the rest
 * of the numbers Frontier's shipyard does not print but a build calculator needs.
 *
 * One small catalogue (47 hulls), so — like `./ships` — this module carries both the
 * {@link SHIP_STATS} data and the {@link getShipStats} lookup. Keyed by the same
 * `symbol` as `./ships`; join on `symbol`.
 *
 * Data from EDCD/coriolis-data (`ships/*.json`); see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import shipStatsData from '../../../data/ships/ship-stats.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * The stats of one ship hull, keyed by its Frontier `symbol`.
 *
 * @remarks
 * `hullMass` is the empty hull's mass; a build's unladen mass is this plus every
 * fitted module. Masses are tonnes, `speed`/`boost` are metres per second at 4 pips
 * to engines, rotation rates are degrees per second.
 */
export interface ShipStats {
    /** Internal identifier, matching the registry's {@link Ship.symbol}. */
    readonly symbol: string;
    /** Empty-hull mass, in tonnes. */
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
    readonly masslock: number;
    /** Number of crew seats (SLF/multicrew). */
    readonly crew: number;
    /** Heat capacity — how much heat the hull absorbs before taking damage. */
    readonly heatCapacity: number;
    /** Reserve tank capacity, in tonnes (feeds the main tank from empty). */
    readonly reserveFuelCapacity: number;
    /** Pitch rate, in degrees per second. */
    readonly pitch: number;
    /** Roll rate, in degrees per second. */
    readonly roll: number;
    /** Yaw rate, in degrees per second. */
    readonly yaw: number;
    /** Minimum thrust as a percentage — the throttle floor. */
    readonly minThrust: number;
    /** Speed gained per pip to engines, as a fraction of base speed. */
    readonly pipSpeed: number;
}

/**
 * Every hull's stats, in the registry's shipyard order. Shorter than
 * {@link SHIPS} — hulls the upstream data does not cover are absent.
 *
 * @example
 * ```ts
 * SHIP_STATS.find((s) => s.symbol === 'Anaconda')?.hullMass; // -> 400
 * ```
 */
export const SHIP_STATS: readonly ShipStats[] = deepFreeze(shipStatsData as readonly ShipStats[]);

/**
 * Look up a hull's stats by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Anaconda"`. Leading/trailing
 * whitespace and case are ignored, so the journal's lower-cased form resolves too.
 * @returns The matching {@link ShipStats}, or `null` if no hull with that symbol is
 * carried.
 * @example
 * ```ts
 * getShipStats('anaconda')?.speed; // -> 180
 * ```
 */
export function getShipStats(symbol: string): ShipStats | null {
    const wanted = symbol.trim().toLowerCase();
    return SHIP_STATS.find((s) => s.symbol.toLowerCase() === wanted) ?? null;
}
