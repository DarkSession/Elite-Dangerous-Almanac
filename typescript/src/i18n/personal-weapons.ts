/** Localized handheld-weapon descriptions, isolated from weapon combat stats. */

import weaponDescriptionsData from '../../../data/i18n/personal-weapon-descriptions.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const WEAPON_DESCRIPTIONS = /* @__PURE__ */ createLocalizedNameIndex(
    weaponDescriptionsData as LocalizedNameMap,
);

/**
 * Look up a handheld weapon's display description — the prose the game shows a player,
 * in all six stored locales.
 *
 * @param symbol - Frontier's weapon symbol, such as `"wpn_s_pistol_kinetic_sauto"`.
 * Matching ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched. All six stored locales are complete for
 * this dataset.
 * @returns The localized description, or `null` when the weapon is unknown or the
 * requested locale is not one this catalogue stores.
 * @remarks
 * **There is no matching name lookup, and that is not a gap.** A handheld weapon's name
 * is a product name — "Karma P-15", "TK Aphelion" — that the game leaves in English in
 * every locale, so `PersonalWeapon.name` is the name in all six. This is display prose
 * and not a statement of the weapon's mechanics: it names no damage figure, rate of fire
 * or effective range, which are the stats `PERSONAL_WEAPONS` carries.
 * @throws {TypeError} If `symbol` is present and not a string, or `locale` is not a
 * string. A nullish `symbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getPersonalWeaponDescription } from '@elite-dangerous-almanac/core/i18n/personal-weapons';
 *
 * getPersonalWeaponDescription('wpn_m_sniper_plasma_charged', 'en');
 * // -> 'A semi-automatic, long-range plasma rifle with high damage output and a low rate of fire.'
 * getPersonalWeaponDescription('wpn_m_sniper_plasma_charged', 'it'); // -> null
 * ```
 */
export function getPersonalWeaponDescription(symbol: string, locale: string): string | null {
    return getLocalizedName(
        WEAPON_DESCRIPTIONS,
        symbol,
        locale,
        'getPersonalWeaponDescription',
        'symbol',
    );
}
