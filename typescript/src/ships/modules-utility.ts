/**
 * The **utility-mount** modules — the `utility` outfitting category: the small
 * utility-slot fittings (chaff and heat-sink launchers, point defence, shield
 * boosters, kill warrant / manifest / wake scanners, the xeno and Shutdown Field
 * scanners, …).
 *
 * The smallest catalogue. The other categories live in `./modules-core`,
 * `./modules-internal` and `./modules-hardpoint`, so importing this module never
 * bundles them.
 *
 * Identity from EDCD FDevIDs (`outfitting.csv`), stats from EDCD/coriolis-data,
 * joined on `symbol`; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import utilityModulesData from '../../../data/ships/modules-utility.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 35 utility-mount modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'utility'`. To keep the other three categories out of
 * your bundle, search this array directly — `UTILITY_MODULES.find((m) =>
 * m.symbol.toLowerCase() === wanted)`, lower-cased because a journal's symbols are —
 * rather than with the lookups in `./modules`, which default to all 1198 modules.
 *
 * @example
 * ```ts
 * UTILITY_MODULES.length; // -> 35
 * ```
 */
export const UTILITY_MODULES: readonly OutfittingModule[] = deepFreeze(
    utilityModulesData as readonly OutfittingModule[],
);
