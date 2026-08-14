/** Localized engineering-blueprint display names, isolated from blueprint mechanics. */

import blueprintNamesData from '../../../data/i18n/blueprint-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const BLUEPRINT_NAMES = /* @__PURE__ */ createLocalizedNameIndex(
    blueprintNamesData as LocalizedNameMap,
);

/**
 * Look up an engineering blueprint's source-backed display name for a locale.
 *
 * @param fdname - Frontier's blueprint id, such as `"FSD_LongRange"`. Matching ignores
 * case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"`, `"de-DE"` or
 * `"en-GB"`. Matching is case-insensitive; underscores are accepted in place of
 * hyphens. A regional tag falls back to its language after an exact-locale miss.
 * @returns The localized blueprint name; the canonical `Blueprint.name` for any English
 * tag; or `null` when the id is unknown, the locale is
 * unsupported, or the pinned source carries no value for that blueprint and locale.
 * @remarks
 * Names stay keyed per `fdname`: the same English phrase can require different grammar
 * when translated for different module families. This function bundles names only, not
 * blueprint modifiers or material costs. Missing translations never silently fall back
 * to English.
 * @throws {TypeError} If `fdname` is present and not a string, or `locale` is not a
 * string. A nullish `fdname` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getBlueprintName } from '@elite-dangerous-almanac/core/i18n/blueprints';
 *
 * getBlueprintName('FSD_LongRange', 'de-DE'); // -> 'Erhöhte FSA-Reichweite'
 * getBlueprintName('AbrasionBlaster_FarReaching', 'fr'); // -> null
 * ```
 */
export function getBlueprintName(fdname: string, locale: string): string | null {
    return getLocalizedName(BLUEPRINT_NAMES, fdname, locale, 'getBlueprintName', 'fdname');
}
