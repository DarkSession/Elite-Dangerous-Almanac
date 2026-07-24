/**
 * The **optional internal** modules — the `internal` outfitting category:
 * everything that fills an optional internal slot (cargo racks, shield generators,
 * fuel scoops, refineries, passenger cabins, limpet and planetary controllers,
 * hull/module reinforcement, …).
 *
 * The other categories live in `./modules-standard`, `./modules-hardpoint` and
 * `./modules-utility`, so importing this module never bundles them.
 *
 * Identity from EDCD FDevIDs (`outfitting.csv`), stats from EDCD/coriolis-data,
 * joined on `symbol`; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import internalModulesData from '../../../data/ships/modules-internal.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * All 475 optional internal modules, in Frontier's registry order.
 *
 * @remarks
 * Every record has `category: 'internal'`. Search it with the query functions from
 * `./modules`.
 *
 * @example
 * ```ts
 * INTERNAL_MODULES.length; // -> 475
 * ```
 */
export const INTERNAL_MODULES: readonly OutfittingModule[] = deepFreeze(
    internalModulesData as readonly OutfittingModule[],
);
