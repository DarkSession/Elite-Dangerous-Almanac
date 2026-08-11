/**
 * The **complete** outfitting catalogue: standard, internal, hardpoint and utility
 * modules in one array.
 *
 * @remarks
 * **This module pulls in every module catalogue** — it exists for consumers that
 * really do want to search all 1199 modules (a "resolve any module id" lookup, say).
 * If you only need one category, import that catalogue's module
 * (`./modules-core`, `./modules-internal`, `./modules-hardpoint`,
 * `./modules-utility`) and nothing else gets bundled.
 *
 * Identity primarily from EDCD FDevIDs (`outfitting.csv`), with supplemental module
 * identities documented in the source record; stats from EDCD/coriolis-data and EDSY,
 * joined on `symbol`. See [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import { CORE_MODULES } from './modules-core.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import { UTILITY_MODULES } from './modules-utility.js';

/**
 * Every outfitting module — the concatenation of `CORE_MODULES`,
 * `INTERNAL_MODULES`, `HARDPOINT_MODULES` and `UTILITY_MODULES`, in that order
 * (each in Frontier's registry order).
 *
 * @remarks
 * Filter on {@link OutfittingModule.category} to narrow it down after the fact —
 * though importing the single catalogue you need is cheaper, since it keeps the
 * others out of your bundle entirely.
 *
 * @example
 * ```ts
 * import { ALL_MODULES } from '@elite-dangerous-almanac/core/ships/modules-all';
 *
 * ALL_MODULES.length;                                          // -> 1199
 * ALL_MODULES.filter((m) => m.category === 'utility').length;  // -> 35
 * ```
 */
export const ALL_MODULES: readonly OutfittingModule[] = Object.freeze([
    ...CORE_MODULES,
    ...INTERNAL_MODULES,
    ...HARDPOINT_MODULES,
    ...UTILITY_MODULES,
]);
