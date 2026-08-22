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
 * English tag; or `null` when the
 * symbol is unknown, the locale is unsupported, or the pinned sources carry no value
 * for that module and locale.
 * @remarks
 * The table deduplicates modules that share one canonical name. It does not bundle any
 * module stats, so this lookup avoids the 1,199-record `ALL_MODULES` catalogue. Missing
 * translations never silently fall back to English.
 * @throws {TypeError} If `symbol` is present and not a string, or `locale` is not a
 * string. A nullish `symbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getModuleName } from '@elite-dangerous-almanac/core/i18n/modules';
 *
 * getModuleName('Int_Hyperdrive_Size6_Class5', 'de-DE'); // -> 'Frameshiftantrieb'
 * getModuleName('Int_LargeCargoRack_Size8_class1', 'de'); // -> null
 * ```
 */
export function getModuleName(symbol: string, locale: string): string | null {
    return getLocalizedName(MODULE_NAMES, symbol, locale, 'getModuleName', 'symbol');
}
