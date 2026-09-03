/** Localized suit-tool display names, isolated from tool battery and timing stats. */

import toolNamesData from '../../../data/i18n/personal-tool-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const TOOL_NAMES = /* @__PURE__ */ createLocalizedNameIndex(toolNamesData as LocalizedNameMap);

/**
 * Look up a suit tool's source-backed display name for a locale.
 *
 * @param id - The library id `PersonalTool.id` carries, such as `"arc-cutter"`. Matching
 * ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched.
 * @returns The localized tool name; the canonical `PersonalTool.name` for any English
 * tag; or `null` when the tool is unknown or the locale is not one of the six this
 * catalogue stores.
 * @remarks
 * All six stored locales are complete for this dataset, so a supported locale always
 * answers. Frontier publishes no item symbol for a tool, so the library id is the only
 * identifier this lookup takes — the same one `getPersonalToolById` takes.
 *
 * A returned value can equal the English, because the game leaves some tool names
 * untranslated. Such a value is the game's own, stored verbatim; the library never
 * supplies an English fallback. This lookup bundles no tool stats.
 * @throws {TypeError} If `id` is present and not a string, or `locale` is not a string. A
 * nullish `id` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getPersonalToolName } from '@elite-dangerous-almanac/core/i18n/personal-tools';
 *
 * getPersonalToolName('energylink', 'de-DE'); // -> 'Energie-Link'
 * getPersonalToolName('profile-analyser', 'fr'); // -> 'Analyseur de profil'
 * getPersonalToolName('arc-cutter', 'it'); // -> null
 * ```
 */
export function getPersonalToolName(id: string, locale: string): string | null {
    return getLocalizedName(TOOL_NAMES, id, locale, 'getPersonalToolName', 'id');
}
