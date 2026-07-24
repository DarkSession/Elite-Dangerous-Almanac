/**
 * The **complete** outfitting catalogue: standard, internal, hardpoint and utility
 * modules in one array.
 *
 * @remarks
 * **This module pulls in every module catalogue (~161 KB bundled)** — it exists for
 * consumers that really do want to search all 1190 modules (a "resolve any module
 * id" lookup, say). If you only need one category, import that catalogue's module
 * (`./modules-standard`, `./modules-internal`, `./modules-hardpoint`,
 * `./modules-utility`) and nothing else gets bundled.
 *
 * Data from EDCD FDevIDs (`outfitting.csv`); see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import { STANDARD_MODULES } from './modules-standard.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import { UTILITY_MODULES } from './modules-utility.js';

/**
 * Every outfitting module — the concatenation of `STANDARD_MODULES`,
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
 * ALL_MODULES.length;                                          // -> 1190
 * ALL_MODULES.filter((m) => m.category === 'utility').length;  // -> 35
 * ```
 */
export const ALL_MODULES: readonly OutfittingModule[] = Object.freeze([
    ...STANDARD_MODULES,
    ...INTERNAL_MODULES,
    ...HARDPOINT_MODULES,
    ...UTILITY_MODULES,
]);
