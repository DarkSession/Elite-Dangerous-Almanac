/**
 * One-application material costs for personal-equipment modifications.
 *
 * Keys exactly match `PERSONAL_MODIFICATIONS` from `equipment/modifications`. Keeping
 * the shopping lists separate follows the ship-engineering boundary: a consumer parsing
 * loadout identities does not pay for material data it never reads.
 *
 * @packageDocumentation
 */

import modificationCostsData from '../../../data/equipment/modification-costs.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';
import type { PersonalEngineeringIngredient } from './engineering.js';

/**
 * Every personal-modification recipe's one-application material list.
 *
 * @remarks
 * Its keys exactly match `PERSONAL_MODIFICATIONS` from `equipment/modifications`. The
 * catalogues are separate runtime payloads so identity-only consumers do not bundle
 * ingredient symbols and counts.
 *
 * @example
 * ```ts
 * import { PERSONAL_MODIFICATION_COSTS } from '@elite-dangerous-almanac/core/equipment/modification-costs';
 * PERSONAL_MODIFICATION_COSTS['suit_nightvision']?.[0]?.symbol; // -> 'surveillanceequipment'
 * ```
 */
export const PERSONAL_MODIFICATION_COSTS: Readonly<
    Record<string, readonly PersonalEngineeringIngredient[]>
> = deepFreeze(modificationCostsData as Record<string, readonly PersonalEngineeringIngredient[]>);

/**
 * Look up a personal modification's one-application material cost.
 *
 * @param symbol - Recipe symbol, such as `"suit_nightvision"` or
 * `"weapon_range_kinetic"`, matched case-insensitively after trimming surrounding
 * whitespace.
 * @returns The frozen ingredient list, or `null` when unknown.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish symbol is a
 * miss, answered like an unrecognised one.
 * @example
 * ```ts
 * import { getPersonalModificationCost } from '@elite-dangerous-almanac/core/equipment/modification-costs';
 * getPersonalModificationCost('suit_nightvision')?.[0]?.symbol; // -> 'surveillanceequipment'
 * ```
 */
export function getPersonalModificationCost(
    symbol: string,
): readonly PersonalEngineeringIngredient[] | null {
    return findByRawKey(PERSONAL_MODIFICATION_COSTS, symbol, 'getPersonalModificationCost: symbol');
}
