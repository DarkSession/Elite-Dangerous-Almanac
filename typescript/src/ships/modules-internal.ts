/**
 * The **optional internal** modules — the `internal` outfitting category:
 * everything that fills an optional internal slot (cargo racks, shield generators,
 * fuel scoops, refineries, passenger cabins, limpet and planetary controllers,
 * hull/module reinforcement, …).
 *
 * The other categories live in `./modules-core`, `./modules-hardpoint` and
 * `./modules-utility`, so importing this module never bundles them.
 *
 * Identity from EDCD FDevIDs (`outfitting.csv`), stats from EDCD/coriolis-data,
 * joined on `symbol`; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import internalModulesData from '../../../data/ships/modules-internal.jsonc' with { type: 'json' };
import { buildModuleCatalogue, type ModuleRecord } from './module-catalogue.js';

/**
 * All 482 optional internal modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'internal'`, added from the file it was read from
 * rather than repeated on every record. To keep the other three categories out of
 * your bundle, search this array directly — `INTERNAL_MODULES.find((m) =>
 * m.symbol.toLowerCase() === wanted)`, lower-cased because a journal's symbols are —
 * rather than with the lookups in `./modules`, which default to all 1197 modules.
 *
 * @example
 * ```ts
 * INTERNAL_MODULES.length; // -> 482
 * ```
 */
export const INTERNAL_MODULES: readonly OutfittingModule[] = buildModuleCatalogue(
    internalModulesData as readonly ModuleRecord[],
    'internal',
);
