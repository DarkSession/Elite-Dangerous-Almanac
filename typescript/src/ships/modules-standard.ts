/**
 * The **core internal** modules — the `standard` outfitting category: the eight
 * slots every hull must fill (armour, power plant, thrusters, frame shift drive,
 * life support, power distributor, sensors, fuel tank).
 *
 * ~67 KB bundled. The armour variants here are the one ship-specific module, so
 * this is also where {@link getModulesForShip} finds a hull's bulkheads. The other
 * categories live in `./modules-internal`, `./modules-hardpoint` and
 * `./modules-utility`, so importing this module never bundles them.
 *
 * Data from EDCD FDevIDs (`outfitting.csv`); see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import standardModulesData from '../../../data/ships/modules-standard.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 521 core internal modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'standard'`. Search it with the query functions from
 * `./modules`.
 *
 * @example
 * ```ts
 * STANDARD_MODULES.length; // -> 521
 * ```
 */
export const STANDARD_MODULES: readonly OutfittingModule[] = deepFreeze(
    standardModulesData as readonly OutfittingModule[],
);
