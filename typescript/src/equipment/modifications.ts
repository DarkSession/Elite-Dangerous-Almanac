/**
 * Engineer-applied modification recipes for Odyssey suits and handheld weapons.
 *
 * The catalogue is keyed by recipe symbol, following the same pattern as ship
 * blueprints and experimental effects. Most keys are the exact symbol written by a
 * journal loadout. Greater Range, Headshot Damage and Higher Accuracy each have three
 * technology-specific recipes; use `equipment/modification-journal` to resolve those
 * journal symbols against a weapon.
 *
 * Material shopping lists live separately in `equipment/modification-costs`, so reading
 * names and engineer availability does not bundle every recipe ingredient.
 *
 * @packageDocumentation
 */

import modificationsData from '../../../data/equipment/modifications.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';

/** Equipment kind a personal modification can be installed on. */
export type PersonalModificationTarget = 'suit' | 'weapon';

/** One permanent personal-equipment engineering recipe. */
export interface PersonalModification {
    /** English in-game display name. */
    readonly name: string;
    /** Whether the modification fits suits or handheld weapons. */
    readonly target: PersonalModificationTarget;
    /** English names of the on-foot engineers who offer the modification. */
    readonly engineers: readonly string[];
}

/**
 * All 31 suit and weapon engineering recipes, keyed by recipe symbol.
 *
 * @remarks
 * There are 25 distinct display names. Greater Range, Headshot Damage and Higher
 * Accuracy each have separate Kinetic, Laser and Plasma recipes because their material
 * costs differ. Their keys end in `_kinetic`, `_laser` or `_plasma`; the journal omits
 * that suffix, so resolve its value with `resolvePersonalModificationForWeapon` from
 * `equipment/modification-journal`.
 *
 * @example
 * ```ts
 * import { PERSONAL_MODIFICATIONS } from '@elite-dangerous-almanac/core/equipment/modifications';
 * PERSONAL_MODIFICATIONS['suit_nightvision']?.name; // -> 'Night Vision'
 * ```
 */
export const PERSONAL_MODIFICATIONS: Readonly<Record<string, PersonalModification>> = deepFreeze(
    modificationsData as Record<string, PersonalModification>,
);

/**
 * Look up a personal-equipment modification by recipe symbol, case-insensitively.
 *
 * @param symbol - Recipe symbol such as `"suit_nightvision"` or
 * `"weapon_range_kinetic"`.
 * @returns The frozen modification record, or `null` when unknown.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish symbol is a
 * miss, answered like an unrecognised one.
 * @example
 * ```ts
 * import { getPersonalModification } from '@elite-dangerous-almanac/core/equipment/modifications';
 * getPersonalModification('suit_nightvision')?.name; // -> 'Night Vision'
 * ```
 */
export function getPersonalModification(symbol: string): PersonalModification | null {
    return findByRawKey(PERSONAL_MODIFICATIONS, symbol, 'getPersonalModification: symbol');
}
