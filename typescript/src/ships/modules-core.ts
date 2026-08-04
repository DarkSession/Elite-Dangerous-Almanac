/**
 * The **core internal** modules — the `core` outfitting category: the eight slots
 * every hull must fill (armour, power plant, thrusters, frame shift drive, life
 * support, power distributor, sensors, fuel tank).
 *
 * The armour variants here are the one ship-specific module, so this is also where
 * {@link getModulesForShip} finds a hull's bulkheads. The other categories live in
 * `./modules-internal`, `./modules-hardpoint` and `./modules-utility`, so importing
 * this module never bundles them.
 *
 * Identity from EDCD FDevIDs (`outfitting.csv`), stats from EDCD/coriolis-data,
 * joined on `symbol`; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import coreModulesData from '../../../data/ships/modules-core.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 521 core internal modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'core'`. Search it with plain `Array` methods
 * (`CORE_MODULES.find((m) => m.symbol === wanted)`) to keep the other three categories
 * out of your bundle — the lookups in `./modules` default to all 1198 modules, so
 * importing one pulls every catalogue.
 *
 * @example
 * ```ts
 * CORE_MODULES.length; // -> 521
 * ```
 */
export const CORE_MODULES: readonly OutfittingModule[] = deepFreeze(
    coreModulesData as readonly OutfittingModule[],
);
