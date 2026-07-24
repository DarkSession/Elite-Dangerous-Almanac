/**
 * Stats for the **utility** modules — chaff, heat sinks, point defence, shield
 * boosters, and the utility-mount scanners.
 *
 * Keyed by the same `symbol` as `./modules-utility`; join on `symbol`. Shield
 * boosters carry their `shieldBoost` fraction here.
 *
 * Data from EDCD/coriolis-data; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { ModuleStats } from './module-stats.js';
import utilityModuleStatsData from '../../../data/ships/module-stats-utility.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/** Stats for the utility-mount modules. */
export const UTILITY_MODULE_STATS: readonly ModuleStats[] = deepFreeze(
    utilityModuleStatsData as readonly ModuleStats[],
);
