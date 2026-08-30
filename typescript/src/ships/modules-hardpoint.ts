/**
 * The **hardpoint** modules — the `hardpoint` outfitting category: the weapons and
 * tools mounted on a hardpoint (lasers, multi-cannons, missile and mine launchers,
 * mining lasers, the various Thargoid/Guardian hardpoints, …).
 *
 * These are the modules that carry a {@link OutfittingModule.mount}
 * (Fixed / Gimballed / Turreted) and, for launchers, a
 * {@link OutfittingModule.guidance}. The other categories live in
 * `./modules-core`, `./modules-internal` and `./modules-utility`, so importing
 * this module never bundles them.
 *
 * Identity from EDCD FDevIDs (`outfitting.csv`), stats from EDCD/coriolis-data,
 * joined on `symbol`; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import hardpointModulesData from '../../../data/ships/modules-hardpoint.jsonc' with { type: 'json' };
import { buildModuleCatalogue, type ModuleRecord } from './internal/module-catalogue.js';

/**
 * All 159 hardpoint modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'hardpoint'`, added from the file it was read from
 * rather than repeated on every record. To keep the other three categories out of
 * your bundle, search this array directly — `HARDPOINT_MODULES.find((m) =>
 * m.symbol.toLowerCase() === wanted)`, lower-cased because a journal's symbols are —
 * rather than with the lookups in `./modules`, which default to all 1194 modules.
 *
 * @example
 * ```ts
 * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
 *
 * HARDPOINT_MODULES.length; // -> 159
 * HARDPOINT_MODULES.filter((m) => m.familyId === 'beamLasers').length; // -> 12
 * HARDPOINT_MODULES.filter((m) => m.mount === 'Turreted').length; // turreted variants
 * ```
 */
export const HARDPOINT_MODULES: readonly OutfittingModule[] = buildModuleCatalogue(
    hardpointModulesData as readonly ModuleRecord[],
    'hardpoint',
);
