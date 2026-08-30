/** Localized Odyssey micro-resource display names, isolated from resource metadata. */

import microResourceNamesData from '../../../data/i18n/micro-resource-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const MICRO_RESOURCE_NAMES = /* @__PURE__ */ createLocalizedNameIndex(
    microResourceNamesData as LocalizedNameMap,
);

/**
 * Look up an Odyssey micro-resource's source-backed display name for a locale.
 *
 * @param symbol - Frontier's micro-resource symbol, such as `"graphene"`. Matching
 * ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"`, `"de-DE"` or
 * `"en-GB"`. Matching is case-insensitive; underscores are accepted in place of
 * hyphens. A regional or script subtag is dropped: every stored locale is a bare
 * language tag.
 * @returns The localized micro-resource name; the canonical `MicroResource.name` for
 * any English tag; or `null` when the symbol is unknown or the locale is not one of the
 * six this catalogue stores.
 * @remarks
 * All six stored locales are complete for this dataset, so a supported locale always
 * answers. This function bundles names only, not micro-resource categories or equipment
 * costs. Ship engineering materials use {@link getMaterialName} instead.
 * @throws {TypeError} If `symbol` is present and not a string, or `locale` is not a
 * string. A nullish `symbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getMicroResourceName } from '@elite-dangerous-almanac/core/i18n/micro-resources';
 *
 * getMicroResourceName('graphene', 'fr-FR'); // -> 'Graphène'
 * getMicroResourceName('aerogel', 'de'); // -> 'Aerogel'
 * getMicroResourceName('aerogel', 'it'); // -> null
 * ```
 */
export function getMicroResourceName(symbol: string, locale: string): string | null {
    return getLocalizedName(MICRO_RESOURCE_NAMES, symbol, locale, 'getMicroResourceName', 'symbol');
}
