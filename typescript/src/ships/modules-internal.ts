/**
 * The **optional internal** modules — the `internal` outfitting category:
 * everything that fills an optional internal slot (cargo racks, shield generators,
 * fuel scoops, refineries, passenger cabins, limpet and planetary controllers,
 * hull/module reinforcement, …), plus the articles the registry files here that an
 * optional slot does not take: the hull's own Cargo Hatch and the Guardian hybrid
 * power plants and distributors, which go in a core mount.
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
 * Every module in the `internal` outfitting category, in registry order.
 *
 * @remarks
 * Every record has `category: 'internal'`, added from the file it was read from
 * rather than repeated on every record. **The category is the registry's filing, not a
 * fitting rule**, so do not read a fit off it: `ModularCargoBayDoor` (family
 * `cargoHatches`) is the hull's built-in Cargo Hatch and goes in the fixed `CargoHatch`
 * mount alone; the fifteen Guardian hybrid power plants and distributors carry a core
 * {@link ships!OutfittingModule.slot | slot} and fit only that core mount; and others
 * here reserve a restricted mount or a named hull. Ask
 * {@link ships!ShipLoadout.modulesForSlot | ShipLoadout.modulesForSlot} what a mount
 * takes rather than filtering this array by size.
 *
 * To keep the other three categories out of your bundle, search this array directly —
 * `INTERNAL_MODULES.find((m) => m.symbol.toLowerCase() === wanted)`, lower-cased because
 * a journal's symbols are — rather than with the lookups in `./modules`, which default
 * to the whole catalogue.
 *
 * @example
 * ```ts
 * import { INTERNAL_MODULES } from '@elite-dangerous-almanac/core/ships/modules-internal';
 *
 * INTERNAL_MODULES.find((m) => m.symbol === 'Int_CargoRack_Size1_Class1')?.familyId; // -> 'cargoRacks'
 * ```
 */
export const INTERNAL_MODULES: readonly OutfittingModule[] = buildModuleCatalogue(
    internalModulesData as readonly ModuleRecord[],
    'internal',
);
