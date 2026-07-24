/**
 * Stats for the **hardpoint** modules — the weapons and tools on a hardpoint.
 *
 * Keyed by the same `symbol` as `./modules-hardpoint`; join on `symbol`. Only the
 * mechanical stats (mass, integrity, power draw, boot time) are carried — weapon
 * combat stats (damage, falloff, breach, thermal load, …) are intentionally not.
 *
 * Data from EDCD/coriolis-data; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { ModuleStats } from './module-stats.js';
import hardpointModuleStatsData from '../../../data/ships/module-stats-hardpoint.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/** Mechanical stats for the hardpoint modules. */
export const HARDPOINT_MODULE_STATS: readonly ModuleStats[] = deepFreeze(
    hardpointModuleStatsData as readonly ModuleStats[],
);
