/**
 * The **utility-mount** modules — the `utility` outfitting category: the small
 * utility-slot fittings (chaff and heat-sink launchers, point defence, shield
 * boosters, kill warrant / manifest / wake scanners, the xeno and Shutdown Field
 * scanners, …).
 *
 * ~4 KB bundled — the smallest catalogue. The other categories live in
 * `./modules-standard`, `./modules-internal` and `./modules-hardpoint`, so
 * importing this module never bundles them.
 *
 * Data from EDCD FDevIDs (`outfitting.csv`); see `data/ships/SOURCES.md`.
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
 * Every record has `category: 'utility'`. Search it with the query functions from
 * `./modules`.
 *
 * @example
 * ```ts
 * UTILITY_MODULES.length; // -> 35
 * ```
 */
export const UTILITY_MODULES: readonly OutfittingModule[] = deepFreeze(
    utilityModulesData as readonly OutfittingModule[],
);
