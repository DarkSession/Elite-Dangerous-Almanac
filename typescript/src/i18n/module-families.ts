/** Localized outfitting module-family names, isolated from the module catalogues. */

import familyNamesData from '../../../data/i18n/module-family-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const FAMILY_NAMES = /* @__PURE__ */ createLocalizedNameIndex(familyNamesData as LocalizedNameMap);

/**
 * Look up an outfitting family's source-backed display name for a locale.
 *
 * @param familyId - The stable family id carried by `OutfittingModuleIdentity.familyId`,
 * such as `"shieldGenerators"`. Matching ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"`, `"de-DE"` or
 * `"en-GB"`. Matching is case-insensitive; underscores are accepted in place of
 * hyphens. A regional or script subtag is dropped: every stored locale is a bare
 * language tag.
 * @returns The localized family name; the canonical `OUTFITTING_FAMILIES` name for any
 * English tag; or `null` when the family is unknown, the locale is unsupported, or the
 * pinned source carries no category label for that family and locale.
 * @remarks
 * Every module carries a family, so an outfitting list can group and label every choice
 * `ShipLoadout.modulesForSlot()` returns from this lookup alone. The table bundles no
 * module stats. Missing translations never silently fall back to English: 19 of the 77
 * families have no source-backed label in any locale, tracked by
 * [#320](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/320).
 * @throws {TypeError} If `familyId` is present and not a string, or `locale` is not a
 * string. A nullish `familyId` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getOutfittingFamilyName } from '@elite-dangerous-almanac/core/i18n/module-families';
 *
 * getOutfittingFamilyName('shieldGenerators', 'de-DE'); // -> 'Schildgeneratoren'
 * getOutfittingFamilyName('xenoScanners', 'de'); // -> null
 * ```
 */
export function getOutfittingFamilyName(familyId: string, locale: string): string | null {
    return getLocalizedName(FAMILY_NAMES, familyId, locale, 'getOutfittingFamilyName', 'familyId');
}
