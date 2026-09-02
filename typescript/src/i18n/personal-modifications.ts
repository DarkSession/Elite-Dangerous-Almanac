/**
 * Localized personal-equipment modification names and descriptions, isolated from the
 * recipes' modifiers and material costs.
 */

import modificationDescriptionsData from '../../../data/i18n/personal-modification-descriptions.jsonc' with { type: 'json' };
import modificationNamesData from '../../../data/i18n/personal-modification-names.jsonc' with { type: 'json' };
import {
    createDeduplicatedLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameCatalogue,
} from './internal/localized-name.js';

const MODIFICATION_NAMES = /* @__PURE__ */ createDeduplicatedLocalizedNameIndex(
    modificationNamesData as LocalizedNameCatalogue,
);

const MODIFICATION_DESCRIPTIONS = /* @__PURE__ */ createDeduplicatedLocalizedNameIndex(
    modificationDescriptionsData as LocalizedNameCatalogue,
);

/**
 * Look up an engineer-applied personal-equipment modification's source-backed display
 * name for a locale.
 *
 * @param modificationSymbol - The recipe symbol `PERSONAL_MODIFICATIONS` is keyed by,
 * such as `"suit_increasedmeleedamage"` or the technology-specific
 * `"weapon_range_laser"`. A journal line writes the unsuffixed `"weapon_range"`, which
 * `resolvePersonalModificationForWeapon` turns into the specific symbol. Matching
 * ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched.
 * @returns The localized modification name; the canonical `PersonalModification.name`
 * for any English tag; or `null` when the recipe is unknown or the locale is not one of
 * the six this catalogue stores.
 * @remarks
 * All six stored locales are complete for this dataset, so a supported locale always
 * answers. The game offers Greater Range, Headshot Damage and Improved Hip Fire Accuracy
 * as one menu entry each, so the three Kinetic, Laser and Plasma recipes this repository
 * keys separately share that entry's record rather than storing it three times.
 * @throws {TypeError} If `modificationSymbol` is present and not a string, or `locale`
 * is not a string. A nullish `modificationSymbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getPersonalModificationName } from '@elite-dangerous-almanac/core/i18n/personal-modifications';
 *
 * getPersonalModificationName('suit_nightvision', 'de'); // -> 'Nachtsicht'
 * getPersonalModificationName('weapon_range_laser', 'fr'); // -> 'Portée améliorée'
 * getPersonalModificationName('suit_nightvision', 'it'); // -> null
 * ```
 */
export function getPersonalModificationName(
    modificationSymbol: string,
    locale: string,
): string | null {
    return getLocalizedName(
        MODIFICATION_NAMES,
        modificationSymbol,
        locale,
        'getPersonalModificationName',
        'modificationSymbol',
    );
}

/**
 * Look up an engineer-applied personal-equipment modification's display description —
 * the prose the game shows a player, in all six stored locales.
 *
 * @param modificationSymbol - The recipe symbol `PERSONAL_MODIFICATIONS` is keyed by,
 * exactly as {@link getPersonalModificationName} accepts. Matching ignores case and
 * surrounding whitespace.
 * @param locale - A BCP 47 locale. All six stored locales are complete for this dataset.
 * @returns The localized description, or `null` when the recipe is unknown or the
 * requested locale is not one this catalogue stores.
 * @remarks
 * This is display prose, not a statement of the magnitudes a recipe applies: the game
 * says a modification "allows more ammo to be carried for each weapon", never how much
 * more. `PersonalModification.modifiers` answers that, and the two are deliberately not
 * the same string. It is also the only account of the recipes whose `modifiers` list is
 * empty, whether because the recipe switches a capability on or because it moves a
 * stat the panel puts no number on. English is the game's own wording rather than a
 * projection of `PersonalModification.name`.
 * @throws {TypeError} If a present `modificationSymbol` or `locale` is not a string.
 * @example
 * ```ts
 * import { getPersonalModificationDescription } from '@elite-dangerous-almanac/core/i18n/personal-modifications';
 *
 * getPersonalModificationDescription('suit_nightvision', 'en');
 * // -> 'Adds Night Vision capabilities to the suit.'
 * getPersonalModificationDescription('suit_nightvision', 'ja'); // -> null
 * ```
 */
export function getPersonalModificationDescription(
    modificationSymbol: string,
    locale: string,
): string | null {
    return getLocalizedName(
        MODIFICATION_DESCRIPTIONS,
        modificationSymbol,
        locale,
        'getPersonalModificationDescription',
        'modificationSymbol',
    );
}
