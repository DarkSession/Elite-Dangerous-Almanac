/** Localized outfitting-module display names, isolated from module stats and other i18n data. */

import moduleNamesData from '../../../data/i18n/module-names.jsonc' with { type: 'json' };
import {
    createDeduplicatedLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameCatalogue,
} from './internal/localized-name.js';

const MODULE_NAMES = /* @__PURE__ */ createDeduplicatedLocalizedNameIndex(
    moduleNamesData as LocalizedNameCatalogue,
);

/**
 * Look up an outfitting module's source-backed display name for a locale.
 *
 * @param symbol - Frontier's module symbol, such as `"Int_Hyperdrive_Size6_Class5"`.
 * Matching ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"`, `"de-DE"` or
 * `"en-GB"`. Matching is case-insensitive; underscores are accepted in place of
 * hyphens. A regional or script subtag is dropped: every stored locale is a bare
 * language tag.
 * @returns The localized outfitting name; the canonical `OutfittingModule.name` for any
 * English tag; or `null` when the symbol is unknown or the locale is not one of the six
 * this catalogue stores.
 * @remarks
 * All six stored locales are complete for this dataset, so a supported locale always
 * answers. The table deduplicates modules that share one name in every locale, which is
 * finer than sharing one canonical English name: the game distinguishes the singular and
 * plural hull alloys, for instance, where English spells both the same. It does not
 * bundle any module stats, so this lookup avoids the `ALL_MODULES` catalogue.
 * @throws {TypeError} If `symbol` is present and not a string, or `locale` is not a
 * string. A nullish `symbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getModuleName } from '@elite-dangerous-almanac/core/i18n/modules';
 *
 * getModuleName('Int_Hyperdrive_Size6_Class5', 'de-DE'); // -> 'Frameshiftantrieb'
 * getModuleName('Int_LargeCargoRack_Size8_class1', 'de'); // -> 'Frachtgestell für Mk II'
 * getModuleName('Int_Hyperdrive_Size6_Class5', 'it'); // -> null
 * ```
 */
export function getModuleName(symbol: string, locale: string): string | null {
    return getLocalizedName(MODULE_NAMES, symbol, locale, 'getModuleName', 'symbol');
}
