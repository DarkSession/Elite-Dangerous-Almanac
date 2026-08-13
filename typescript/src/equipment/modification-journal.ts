/**
 * Resolve a personal-weapon modification from its journal spelling to its exact recipe.
 *
 * The journal omits the technology suffix from Greater Range, Headshot Damage and Higher
 * Accuracy. Their Kinetic, Laser and Plasma recipes cost different materials, so the
 * equipped weapon is needed to settle which recipe the journal means. This mirrors the
 * collision resolver used by ship engineering.
 *
 * @packageDocumentation
 */

import { requireString, requireStringIfPresent } from '../internal/argument-guards.js';
import { normalizeKey } from '../internal/registry-index.js';
import { PERSONAL_MODIFICATION_JOURNAL_NAMES } from './internal/modification-journal-names.js';
import { getPersonalWeaponBySymbol } from './weapons.js';

/**
 * Resolve the modification recipe a journal symbol identifies on a handheld weapon.
 *
 * @param weaponSymbol - Frontier handheld-weapon symbol. A nullish or unknown weapon
 * cannot resolve a collision and leaves `journalSymbol` unchanged.
 * @param journalSymbol - Symbol from the journal modification list. Matching ignores
 * case and surrounding whitespace.
 * @returns The recipe key used by `PERSONAL_MODIFICATIONS` and
 * `PERSONAL_MODIFICATION_COSTS`, or `journalSymbol` unchanged when no collision resolves.
 * @throws {TypeError} If `journalSymbol` is not a string, or if a present weapon symbol
 * is not a string.
 * @example
 * ```ts
 * import { resolvePersonalModificationForWeapon } from '@elite-dangerous-almanac/core/equipment/modification-journal';
 * resolvePersonalModificationForWeapon(
 *   'wpn_m_assaultrifle_kinetic_fauto',
 *   'weapon_range',
 * ); // -> 'weapon_range_kinetic'
 * ```
 */
export function resolvePersonalModificationForWeapon(
    weaponSymbol: string,
    journalSymbol: string,
): string {
    requireStringIfPresent(weaponSymbol, 'resolvePersonalModificationForWeapon: weaponSymbol');
    const wanted = normalizeKey(
        requireString(journalSymbol, 'resolvePersonalModificationForWeapon: journalSymbol'),
        'resolvePersonalModificationForWeapon: journalSymbol',
    );
    const weapon = getPersonalWeaponBySymbol(weaponSymbol);
    if (!weapon) return journalSymbol;

    for (const [recipeSymbol, writtenSymbol] of Object.entries(
        PERSONAL_MODIFICATION_JOURNAL_NAMES,
    )) {
        if (
            writtenSymbol.toLowerCase() === wanted &&
            recipeSymbol.endsWith(`_${weapon.engineeringType}`)
        ) {
            return recipeSymbol;
        }
    }
    return journalSymbol;
}
