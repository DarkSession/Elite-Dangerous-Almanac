/**
 * The **complete** module-stats catalogue: standard, internal, hardpoint and
 * utility module stats in one array.
 *
 * @remarks
 * **This pulls in every stats catalogue** — it exists for consumers that want to
 * resolve any module's stats from one list. If you only need one category, import
 * that catalogue (`./module-stats-standard`, `./module-stats-internal`,
 * `./module-stats-hardpoint`, `./module-stats-utility`) and nothing else is bundled.
 *
 * Data from EDCD/coriolis-data; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { ModuleStats } from './module-stats.js';
import { STANDARD_MODULE_STATS } from './module-stats-standard.js';
import { INTERNAL_MODULE_STATS } from './module-stats-internal.js';
import { HARDPOINT_MODULE_STATS } from './module-stats-hardpoint.js';
import { UTILITY_MODULE_STATS } from './module-stats-utility.js';

/**
 * Every module's stats — the concatenation of the four category catalogues, in that
 * order. Not every registry module has a stats row (ship-specific armour has none),
 * so this is shorter than `ALL_MODULES`.
 *
 * @example
 * ```ts
 * getModuleStats('int_guardianfsdbooster_size5', ALL_MODULE_STATS)?.jumpBoost; // -> 10.5
 * ```
 */
export const ALL_MODULE_STATS: readonly ModuleStats[] = Object.freeze([
    ...STANDARD_MODULE_STATS,
    ...INTERNAL_MODULE_STATS,
    ...HARDPOINT_MODULE_STATS,
    ...UTILITY_MODULE_STATS,
]);
