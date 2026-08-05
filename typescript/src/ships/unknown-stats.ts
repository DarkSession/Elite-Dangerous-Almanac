/**
 * **Unknown module stats** — which absences in the outfitting catalogue mean *nobody
 * knows this value*, rather than *the module has no such stat*.
 *
 * Every stat on an {@link OutfittingModule} is optional, and a missing one reads as
 * `undefined` either way. Most absences are the module simply not having the stat: a
 * cargo rack draws no power, a fuel tank has no rate of fire. A few are gaps — the
 * module has the stat in game and no source publishes it — and those cannot be added up
 * as zero without under-reporting the answer.
 *
 * This is the list of the second kind, so a calculation can tell them apart:
 *
 * ```ts
 * isStatUnknown('Int_DroneControl_ResourceSiphon', 'mass'); // -> true  (a gap)
 * isStatUnknown('Int_CargoRack_Size4_Class1', 'powerDraw'); // -> false (draws nothing)
 * ```
 *
 * Five records today: the four withdrawn Discovery Scanners, whose `powerDraw` no
 * registry carries, and the unsized Hatch Breaker Limpet Controller, whose `mass` none
 * carries. What would fill each is recorded in
 * [the ships provenance notes](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @remarks
 * **`cost` is deliberately not listed.** Every module without a price has no *published*
 * price, so an absent `cost` already means unknown on its own — there is nothing to
 * disambiguate. See the README's list-prices section.
 *
 * **Nor is this the whole of what the catalogue does not know.** The base stats that
 * engineering blueprints modify and no record carries (`EngineHeatRate`,
 * `EnergyPerRegen`, the scanner ranges and the rest) are a separate and larger gap,
 * tracked in `TODO.md`; a field with no place in the record shape cannot be named here.
 * Read a `false` from {@link isStatUnknown} as "not one of the known gaps", not as
 * "the game has no such value".
 *
 * Its own module and data file — five records, so a consumer that needs the distinction
 * pays about a hundred bytes for it and one that does not pays nothing.
 *
 * @packageDocumentation
 */

import unknownStatsData from '../../../data/ships/unknown-stats.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';
import type { OutfittingModule } from './modules.js';

/**
 * A module record's stat fields — the keys {@link isStatUnknown} takes.
 *
 * The whole record shape, not a stats-only subset: identity fields (`symbol`, `name`,
 * `category`) are never unknown, so asking about one simply answers `false`.
 */
export type ModuleStatField = keyof OutfittingModule;

/** One module and the stats its catalogue record omits because they are unknown. */
export interface UnknownModuleStats {
    /** The module's Frontier symbol, e.g. `"Int_DroneControl_ResourceSiphon"`. */
    readonly symbol: string;
    /**
     * The fields whose absence from that module's record means *unknown*. Every one is
     * absent from the record: a value that gets sourced is filled in there and dropped
     * from here in the same change.
     */
    readonly stats: readonly ModuleStatField[];
}

/**
 * Every module with a stat the catalogue cannot supply, and which stats those are.
 *
 * @example
 * ```ts
 * import { UNKNOWN_MODULE_STATS } from '@elite-dangerous-almanac/core/ships/unknown-stats';
 *
 * UNKNOWN_MODULE_STATS.length; // -> 5
 * UNKNOWN_MODULE_STATS.flatMap((entry) => entry.stats); // -> 4 × 'powerDraw', 1 × 'mass'
 * ```
 */
export const UNKNOWN_MODULE_STATS: readonly UnknownModuleStats[] = deepFreeze(
    unknownStatsData as readonly UnknownModuleStats[],
);

/**
 * The stats a module's record omits because they are unknown — empty for the 1193
 * modules with no such gap.
 *
 * @param symbol - The module's Frontier symbol. Matched case-insensitively, so a
 * journal's lower-cased `Item` works as-is.
 * @param catalogue - Optional subset to search. Defaults to every entry.
 * @returns The unknown fields, in the order the catalogue lists them; `[]` when the
 * module has no unknown stat, and also when the symbol is not a module at all.
 * @example
 * ```ts
 * import { unknownStatsFor } from '@elite-dangerous-almanac/core/ships/unknown-stats';
 *
 * unknownStatsFor('int_stellarbodydiscoveryscanner_advanced'); // -> ['powerDraw']
 * unknownStatsFor('Int_Hyperdrive_Size5_Class5');              // -> []
 * ```
 */
export function unknownStatsFor(
    symbol: string,
    catalogue: readonly UnknownModuleStats[] = UNKNOWN_MODULE_STATS,
): readonly ModuleStatField[] {
    const wanted = symbol.toLowerCase();
    return catalogue.find((entry) => entry.symbol.toLowerCase() === wanted)?.stats ?? [];
}

/**
 * Whether one module's missing stat is a gap in the data rather than a stat the module
 * does not have.
 *
 * @param symbol - The module's Frontier symbol, matched case-insensitively.
 * @param field - The record field in question, e.g. `'powerDraw'`.
 * @param catalogue - Optional subset to search. Defaults to every entry.
 * @returns `true` only for a value this catalogue knows it is missing.
 * @example
 * ```ts
 * import { isStatUnknown } from '@elite-dangerous-almanac/core/ships/unknown-stats';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * const scanner = getModuleBySymbol('Int_StellarBodyDiscoveryScanner_Advanced');
 * scanner?.powerDraw; // -> undefined
 * isStatUnknown(scanner!.symbol, 'powerDraw'); // -> true: don't add it up as 0 MW
 * ```
 */
export function isStatUnknown(
    symbol: string,
    field: ModuleStatField,
    catalogue: readonly UnknownModuleStats[] = UNKNOWN_MODULE_STATS,
): boolean {
    return unknownStatsFor(symbol, catalogue).includes(field);
}
