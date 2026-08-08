/**
 * **Unknown module stats** — which missing stats are gaps in the data rather than
 * stats the module does not have.
 *
 * Every stat on an {@link OutfittingModule} is optional, and a missing one reads as
 * `undefined` either way. Most absences are the module simply not having the stat: a
 * cargo rack draws no power, a fuel tank has no rate of fire. A few are gaps — the
 * module has the stat in game and no source publishes it — and those cannot be added
 * up as zero without under-reporting the answer.
 *
 * The record itself says which is which, in
 * {@link OutfittingModule.unknownStats | unknownStats}; this module is just the
 * predicate over it, so the question can be asked without spelling out the array
 * check:
 *
 * ```ts
 * isStatUnknown(getModuleBySymbol('Int_DroneControl_ResourceSiphon'), 'mass');
 * // -> false (the current game record states 0 t)
 * isStatUnknown(getModuleBySymbol('Int_CargoRack_Size4_Class1'), 'powerDraw');
 * // -> false (it draws nothing)
 * ```
 *
 * Four records carry the field today: the withdrawn Discovery Scanners, whose
 * `powerDraw` no registry carries. What would fill them is recorded in
 * [the ships provenance notes](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @remarks
 * **This module holds no data** — it reads the field off a record you already have,
 * so it costs a few bytes and pulls no catalogue.
 *
 * **`cost` is deliberately never named.** Every module without a price has no
 * *published* price, so an absent `cost` already means unknown on its own — there is
 * nothing to disambiguate. See the README's list-prices section.
 *
 * **A `false` is a real answer, and the engineering calculator acts on it.** An absence
 * this predicate does not claim is a stat the module simply does not have — a beam
 * laser's shot speed, a pulse laser's reload — and a blueprint that scales such a stat
 * leaves it alone rather than being refused. Naming a stat here says the opposite: the
 * value exists and nobody publishes it, so nothing can be scaled from it and the recipe
 * is refused outright.
 *
 * **The field can only name stats the record shape has.** A journal label the shape
 * models no field for at all — Anti-Guardian Zone Resistance, which is a capability
 * rather than a number — cannot be named, and is tracked at
 * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/27.
 *
 * @packageDocumentation
 */

import type { ModuleStatField, OutfittingModule } from './modules.js';

/**
 * Re-exported so a consumer deep-importing this subpath can name the {@link
 * isStatUnknown} `field` parameter's type without reaching into `./modules`, which
 * would pull all four catalogues.
 */
export type { ModuleStatField } from './modules.js';

/**
 * Whether one module's missing stat is a gap in the data rather than a stat the
 * module does not have.
 *
 * @param module - The module record. `null` or `undefined` — an article the
 * catalogue could not identify — answers `false`: an unrecognised module's stats are
 * all unknown, which is a different question and one the caller already knows the
 * answer to.
 * @param field - The record field in question, e.g. `'powerDraw'`.
 * @returns `true` only for a value this catalogue knows it is missing.
 * @example
 * ```ts
 * import { isStatUnknown } from '@elite-dangerous-almanac/core/ships/unknown-stats';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * const scanner = getModuleBySymbol('Int_StellarBodyDiscoveryScanner_Advanced');
 * scanner?.powerDraw; // -> undefined
 * isStatUnknown(scanner, 'powerDraw'); // -> true: don't add it up as 0 MW
 * ```
 */
export function isStatUnknown(
    module: OutfittingModule | null | undefined,
    field: ModuleStatField,
): boolean {
    return module?.unknownStats?.includes(field) ?? false;
}

/**
 * Every module in a catalogue with at least one unknown stat — the answer to "what
 * does this catalogue know it is missing?".
 *
 * @param catalogue - The modules to search. Required: this module holds no data, and
 * defaulting to the whole registry would pull all four catalogues (~288 KB) into any
 * bundle that imports the predicate above.
 * @returns The records carrying {@link OutfittingModule.unknownStats}, in catalogue
 * order.
 * @example
 * ```ts
 * import { modulesWithUnknownStats } from '@elite-dangerous-almanac/core/ships/unknown-stats';
 * import { INTERNAL_MODULES } from '@elite-dangerous-almanac/core/ships/modules-internal';
 *
 * modulesWithUnknownStats(INTERNAL_MODULES).map((m) => [m.symbol, m.unknownStats]);
 * // -> the four records, each carrying `['powerDraw']`
 * ```
 */
export function modulesWithUnknownStats(
    catalogue: readonly OutfittingModule[],
): readonly OutfittingModule[] {
    return catalogue.filter((module) => module.unknownStats !== undefined);
}
