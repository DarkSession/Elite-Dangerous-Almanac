/** Localized engineering-material display names, isolated from material metadata. */

import materialNamesData from '../../../data/i18n/material-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const MATERIAL_NAMES = /* @__PURE__ */ createLocalizedNameIndex(
    materialNamesData as LocalizedNameMap,
);

/**
 * Look up a ship engineering material's source-backed display name for a locale.
 *
 * @param symbol - Frontier's material symbol, such as `"GridResistors"`. Matching
 * ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"`, `"de-DE"` or
 * `"en-GB"`. Matching is case-insensitive; underscores are accepted in place of
 * hyphens. A regional or script subtag is dropped: every stored locale is a bare
 * language tag.
 * @returns The localized material name; the canonical `Material.name` for any English
 * tag; or `null` when the symbol is unknown or the locale is not one of the six this
 * catalogue stores.
 * @remarks
 * All six stored locales are complete for this dataset, so a supported locale always
 * answers. This function bundles names only, not material grades, categories or
 * engineering costs. Odyssey micro resources use {@link getMicroResourceName} instead.
 * @throws {TypeError} If `symbol` is present and not a string, or `locale` is not a
 * string. A nullish `symbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getMaterialName } from '@elite-dangerous-almanac/core/i18n/materials';
 *
 * getMaterialName('GridResistors', 'de-DE'); // -> 'Gitterwiderstände'
 * getMaterialName('vanadium', 'de'); // -> 'Vanadium'
 * getMaterialName('vanadium', 'it'); // -> null
 * ```
 */
export function getMaterialName(symbol: string, locale: string): string | null {
    return getLocalizedName(MATERIAL_NAMES, symbol, locale, 'getMaterialName', 'symbol');
}
