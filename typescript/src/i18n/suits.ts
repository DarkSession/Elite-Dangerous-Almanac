/**
 * Localized personal-suit display names and descriptions, and the weapon-mount labels,
 * isolated from suit stats.
 */

import suitDescriptionsData from '../../../data/i18n/suit-descriptions.jsonc' with { type: 'json' };
import suitNamesData from '../../../data/i18n/suit-names.jsonc' with { type: 'json' };
import type { PersonalMount, PersonalMountKey } from '../equipment/suits.js';
import { requireObject } from '../internal/argument-guards.js';
import {
    createDeduplicatedLocalizedNameIndex,
    getLocalizedName,
    getLocalizedText,
    type LocalizedNameCatalogue,
} from './internal/localized-name.js';

const SUIT_NAMES = /* @__PURE__ */ createDeduplicatedLocalizedNameIndex(
    suitNamesData as LocalizedNameCatalogue,
);

const SUIT_DESCRIPTIONS = /* @__PURE__ */ createDeduplicatedLocalizedNameIndex(
    suitDescriptionsData as LocalizedNameCatalogue,
);

/**
 * Look up an Odyssey suit's source-backed display name for a locale.
 *
 * @param suit - Either the grade-independent family `Suit.family` carries, such as
 * `"utilitysuit"`, or one grade's Frontier symbol, such as `"utilitysuit_class3"` — the
 * form a journal line writes. Matching ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched.
 * @returns The localized suit name; the canonical `Suit.name` for any English tag; or
 * `null` when the suit is unknown or the locale is not one of the six this catalogue
 * stores.
 * @remarks
 * All six stored locales are complete for this dataset, so a supported locale always
 * answers. The game names a suit per family rather than per grade, so every grade of one
 * suit resolves to the same name. The name is the suit's own: the outfitting list
 * prefixes it with the manufacturer — "Remlok Maverick Suit" — which names a shop
 * listing rather than the suit, and is not stored. This lookup bundles no suit stats.
 * @throws {TypeError} If `suit` is present and not a string, or `locale` is not a
 * string. A nullish `suit` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getSuitName } from '@elite-dangerous-almanac/core/i18n/suits';
 *
 * getSuitName('utilitysuit', 'de-DE'); // -> 'Maverick-Anzug'
 * getSuitName('explorationsuit_class3', 'fr'); // -> 'Combinaison Artemis'
 * getSuitName('utilitysuit', 'it'); // -> null
 * ```
 */
export function getSuitName(suit: string, locale: string): string | null {
    return getLocalizedName(SUIT_NAMES, suit, locale, 'getSuitName', 'suit');
}

/**
 * Look up an Odyssey suit's display description — the prose the game shows a player, in
 * all six stored locales.
 *
 * @param suit - Either the grade-independent family `Suit.family` carries or one grade's
 * Frontier symbol, exactly as {@link getSuitName} accepts. Matching ignores case and
 * surrounding whitespace.
 * @param locale - A BCP 47 locale. All six stored locales are complete for this dataset.
 * @returns The localized description, or `null` when the suit is unknown or the
 * requested locale is not one this catalogue stores.
 * @remarks
 * This is display prose, not a statement of what the suit does: it names no shield
 * strength, no battery capacity and no resistance. Those are the stats
 * `SUITS` carries, and the two are deliberately not the same string. English is the
 * game's own wording here rather than a projection of `Suit.name`.
 * @throws {TypeError} If a present `suit` or `locale` is not a string.
 * @example
 * ```ts
 * import { getSuitDescription } from '@elite-dangerous-almanac/core/i18n/suits';
 *
 * getSuitDescription('flightsuit', 'en')?.startsWith('Remlok'); // -> true
 * getSuitDescription('flightsuit', 'ja'); // -> null
 * ```
 */
export function getSuitDescription(suit: string, locale: string): string | null {
    return getLocalizedName(SUIT_DESCRIPTIONS, suit, locale, 'getSuitDescription', 'suit');
}

const MOUNT_LABELS: Readonly<Record<PersonalMountKey, string>> = /* @__PURE__ */ Object.freeze({
    PrimaryWeapon1: 'Primary Weapon 1',
    PrimaryWeapon2: 'Primary Weapon 2',
    SecondaryWeapon: 'Secondary Weapon',
});

/**
 * Resolve a suit weapon mount's display name for a locale.
 *
 * @param mount - A mount from `Suit.mounts`.
 * @param locale - A BCP 47 locale. The mount-label source supplies English only.
 * @returns The mount's English display name for an English locale, otherwise `null`.
 * `null` too when the mount carries a key this library does not name.
 * @throws {TypeError} If `mount` is not an object or `locale` is not a string.
 * @remarks
 * The label reads the Frontier journal `SlotName` the mount carries, so it distinguishes
 * a suit's primary mounts from each other. A consumer needs no table of its own.
 *
 * No locale but English answers, although the game itself publishes all six:
 * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/26
 * @example
 * ```ts
 * import { getSuitByFamily } from '@elite-dangerous-almanac/core/equipment/suits';
 * import { getPersonalMountName } from '@elite-dangerous-almanac/core/i18n/suits';
 *
 * const suit = getSuitByFamily('tacticalsuit')!;
 * getPersonalMountName(suit.mounts[1]!, 'en-GB'); // -> 'Primary Weapon 2'
 * getPersonalMountName(suit.mounts[2]!, 'de'); // -> null
 * ```
 */
export function getPersonalMountName(mount: PersonalMount, locale: string): string | null {
    requireObject(mount, 'getPersonalMountName: mount');
    const label = Object.hasOwn(MOUNT_LABELS, mount.key) ? MOUNT_LABELS[mount.key] : undefined;
    return getLocalizedText(
        label === undefined ? null : { en: label },
        locale,
        'getPersonalMountName',
    );
}
