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
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 159 hardpoint modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'hardpoint'`. Search it with plain `Array` methods
 * (`HARDPOINT_MODULES.find((m) => m.symbol.toLowerCase() === wanted)` — a journal spells
 * the symbol lower-cased) to keep the other three categories
 * out of your bundle — the lookups in `./modules` default to all 1198 modules, so
 * importing one pulls every catalogue.
 *
 * @example
 * ```ts
 * HARDPOINT_MODULES.length; // -> 159
 * HARDPOINT_MODULES.filter((m) => m.mount === 'Turreted').length; // turreted variants
 * ```
 */
export const HARDPOINT_MODULES: readonly OutfittingModule[] = deepFreeze(
    hardpointModulesData as readonly OutfittingModule[],
);
