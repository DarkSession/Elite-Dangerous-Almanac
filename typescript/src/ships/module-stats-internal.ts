/**
 * Stats for the **optional internal** (`internal`) modules — shield generators,
 * fuel scoops, cargo racks, the Guardian FSD Booster, limpet controllers, and the
 * rest of the optional-slot fittings.
 *
 * Keyed by the same `symbol` as `./modules-internal`; join on `symbol`. The
 * Guardian FSD Booster's `jumpBoost` — the flat jump bonus — lives here.
 *
 * Data from EDCD/coriolis-data; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { ModuleStats } from './module-stats.js';
import internalModuleStatsData from '../../../data/ships/module-stats-internal.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * Stats for the optional internal modules that carry them.
 *
 * @example
 * ```ts
 * getModuleStats('int_guardianfsdbooster_size5', INTERNAL_MODULE_STATS)?.jumpBoost; // -> 10.5
 * ```
 */
export const INTERNAL_MODULE_STATS: readonly ModuleStats[] = deepFreeze(
    internalModuleStatsData as readonly ModuleStats[],
);
