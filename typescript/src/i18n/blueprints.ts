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
 * @param blueprintSymbol - Frontier's blueprint id, such as `"FSD_LongRange"`. Matching ignores
 * case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched.
 * @returns The localized blueprint name; the canonical `Blueprint.name` for any English
 * tag; or `null` when the id is unknown, the locale is
 * unsupported, or the pinned source carries no value for that blueprint and locale.
 * @remarks
 * Names stay keyed per blueprint symbol: the same English phrase can require different
 * grammar when translated for different module families. This function bundles names only, not
 * blueprint modifiers or material costs. Missing translations never silently fall back
 * to English.
 * @throws {TypeError} If `blueprintSymbol` is present and not a string, or `locale` is not a
 * string. A nullish `blueprintSymbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getBlueprintName } from '@elite-dangerous-almanac/core/i18n/blueprints';
 *
 * getBlueprintName('FSD_LongRange', 'de-DE'); // -> 'Erhöhte FSA-Reichweite'
 * getBlueprintName('AbrasionBlaster_FarReaching', 'fr'); // -> 'Surfaceur abrasif longue portée'
 * getBlueprintName('MC_Overcharged', 'fr'); // -> 'Arme surchargée'
 * ```
 */
export function getBlueprintName(blueprintSymbol: string, locale: string): string | null {
    return getLocalizedName(
        BLUEPRINT_NAMES,
        blueprintSymbol,
        locale,
        'getBlueprintName',
        'blueprintSymbol',
    );
}
