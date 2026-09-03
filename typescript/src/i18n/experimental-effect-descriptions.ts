/** Localized experimental-effect descriptions, isolated from effect statistics. */

import descriptionsData from '../../../data/i18n/experimental-effect-descriptions.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const DESCRIPTIONS = /* @__PURE__ */ createLocalizedNameIndex(descriptionsData as LocalizedNameMap);

/**
 * Look up an experimental effect's display description — the prose the game shows a
 * player, in all six stored locales.
 *
 * @remarks
 * This is display text, not a statement of the effect's mechanics. An effect's
 * `description` in the `ships/experimental-effects` catalogue answers the other
 * question — it names the damage split or behaviour the `modifiers` list cannot
 * express — and the two are deliberately not the same string.
 *
 * **This is a heavy `i18n` dataset**: six locales of prose for every effect is ~129 KiB
 * minified (~25 KiB gzipped), more than module names cost. It has its own module so an
 * application that never shows an effect description does not pay for it — import it
 * from `core/i18n/experimental-effect-descriptions` rather than the `core/i18n` barrel
 * if you want that boundary to be explicit.
 *
 * @param experimentalEffectSymbol - Frontier's experimental-effect id. Matching ignores case and
 * surrounding whitespace.
 * @param locale - A BCP 47 locale. All six stored locales are complete for this dataset.
 * @returns The localized description, or `null` when the effect is unknown or the
 * requested locale is not one this catalogue stores.
 * @throws {TypeError} If a present `experimentalEffectSymbol` or `locale` is not a string.
 * @example
 * ```ts
 * import { getExperimentalEffectDescription } from '@elite-dangerous-almanac/core/i18n/experimental-effect-descriptions';
 *
 * getExperimentalEffectDescription('special_auto_loader', 'en');
 * // -> 'An experimental upgrade that automatically reloads the weapon, even when firing.'
 * getExperimentalEffectDescription('special_auto_loader', 'it'); // -> null
 * ```
 */
export function getExperimentalEffectDescription(
    experimentalEffectSymbol: string,
    locale: string,
): string | null {
    return getLocalizedName(
        DESCRIPTIONS,
        experimentalEffectSymbol,
        locale,
        'getExperimentalEffectDescription',
        'experimentalEffectSymbol',
    );
}
