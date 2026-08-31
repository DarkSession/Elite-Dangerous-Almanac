/**
 * The **optional internal** modules — the `internal` outfitting category:
 * everything that fills an optional internal slot (cargo racks, shield generators,
 * fuel scoops, refineries, passenger cabins, limpet and planetary controllers,
 * hull/module reinforcement, …), plus the one article the registry files here that
 * no optional slot takes: the Cargo Hatch, which belongs to the hull.
 *
 * The other categories live in `./modules-core`, `./modules-hardpoint` and
 * `./modules-utility`, so importing this module never bundles them.
 *
 * Identity primarily from EDCD FDevIDs (`outfitting.csv`), with six bundle-granted
 * Vessel Hangar variants from a public CAPI capture; stats from EDCD/coriolis-data and
 * EDSY, joined on `symbol`. See [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import internalModulesData from '../../../data/ships/modules-internal.jsonc' with { type: 'json' };
import { buildModuleCatalogue, type ModuleRecord } from './internal/module-catalogue.js';

/**
 * All 484 optional internal modules, in registry order.
 *
 * @remarks
 * Every record has `category: 'internal'`, added from the file it was read from
 * rather than repeated on every record. The category is the registry's filing rather
 * than a fitting rule: `ModularCargoBayDoor` (family `cargoHatches`) is the hull's
 * built-in Cargo Hatch, it goes in the fixed `CargoHatch` mount alone, and
 * {@link ships!ShipLoadout.modulesForSlot | ShipLoadout.modulesForSlot} never offers it.
 * Everything else here fits an optional internal slot of its size.
 *
 * To keep the other three categories out of your bundle, search this array directly —
 * `INTERNAL_MODULES.find((m) => m.symbol.toLowerCase() === wanted)`, lower-cased because
 * a journal's symbols are — rather than with the lookups in `./modules`, which default
 * to all 1194 modules.
 *
 * @example
 * ```ts
 * import { INTERNAL_MODULES } from '@elite-dangerous-almanac/core/ships/modules-internal';
 *
 * INTERNAL_MODULES.length; // -> 484
 * INTERNAL_MODULES.filter((m) => m.familyId === 'cargoRacks').length; // -> 16
 * ```
 */
export const INTERNAL_MODULES: readonly OutfittingModule[] = buildModuleCatalogue(
    internalModulesData as readonly ModuleRecord[],
    'internal',
);
