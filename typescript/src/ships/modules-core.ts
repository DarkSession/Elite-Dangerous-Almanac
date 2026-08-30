/**
 * The **core internal** modules — the `core` outfitting category: the eight slots
 * every hull must fill (armour, power plant, thrusters, frame shift drive, life
 * support, power distributor, sensors, fuel tank).
 *
 * The armour variants here are the one ship-specific module, so this is also where
 * `getBulkheadsForShip` from `./modules` finds a hull's bulkheads. The other categories
 * live in `./modules-internal`, `./modules-hardpoint` and `./modules-utility`, so
 * importing this module never bundles them.
 *
 * Identity from EDCD FDevIDs (`outfitting.csv`), stats from EDCD/coriolis-data,
 * joined on `symbol`; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import coreModulesData from '../../../data/ships/modules-core.jsonc' with { type: 'json' };
import { buildModuleCatalogue, type ModuleRecord } from './internal/module-catalogue.js';

/**
 * All 516 core internal modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'core'`, added from the file it was read from
 * rather than repeated on every record. To keep the other three categories out of
 * your bundle, search this array directly — `CORE_MODULES.find((m) =>
 * m.symbol.toLowerCase() === wanted)`, lower-cased because a journal's symbols are —
 * rather than with the lookups in `./modules`, which default to all 1194 modules.
 *
 * @example
 * ```ts
 * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
 *
 * CORE_MODULES.length; // -> 516
 * ```
 */
export const CORE_MODULES: readonly OutfittingModule[] = buildModuleCatalogue(
    coreModulesData as readonly ModuleRecord[],
    'core',
);
