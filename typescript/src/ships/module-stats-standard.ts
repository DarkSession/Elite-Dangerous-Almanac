/**
 * Stats for the **core internal** (`standard`) modules — power plant, thrusters,
 * frame shift drive, life support, power distributor, sensors, fuel tank.
 *
 * Keyed by the same `symbol` as `./modules-standard`; join on `symbol`. This is
 * where the FSD constants for jump-range maths live. Ship-specific armour has no
 * generic stats and is not carried here.
 *
 * Data from EDCD/coriolis-data; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { ModuleStats } from './module-stats.js';
import standardModuleStatsData from '../../../data/ships/module-stats-standard.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * Stats for the core internal modules that carry them.
 *
 * @example
 * ```ts
 * import { getModuleStats } from '@elite-dangerous-almanac/core/ships/module-stats';
 * getModuleStats('int_hyperdrive_size5_class5', STANDARD_MODULE_STATS)?.fuelPower; // -> 2.45
 * ```
 */
export const STANDARD_MODULE_STATS: readonly ModuleStats[] = deepFreeze(
    standardModuleStatsData as readonly ModuleStats[],
);
