/** Localized galactic codex region names, isolated from the region footprints. */

import codexRegionNamesData from '../../../data/i18n/codex-region-names.jsonc' with { type: 'json' };
import { getLocalizedText, type LocalizedNameMap } from './internal/localized-name.js';

const CODEX_REGION_NAMES = codexRegionNamesData as LocalizedNameMap;

/**
 * Look up a galactic codex region's source-backed display name for a locale.
 *
 * @param id - Region id, 1–42, as `CodexRegion.id` carries it. Id `0` means
 * "outside the mapped region grid" and has no name.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched.
 * @returns The localized region name; the canonical `CodexRegion.name` for any English
 * tag; or `null` when the id is not 1–42 or the locale is not one of the six this
 * catalogue stores.
 * @remarks
 * The catalogue is keyed by region id rather than by English name, because the id is
 * the region's stable identity while the name is the value being translated.
 *
 * All six stored locales are complete, so a supported locale always answers. The game
 * leaves many regions untranslated in some languages, and spells Izanami, Temple, Mare
 * Somnia, Xibalba and Tenebrae alike in all six. The catalogue stores those source values
 * verbatim rather than treating them as a missing translation.
 * @throws {TypeError} If `locale` is not a string. A nullish or out-of-range `id` is a
 * lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getCodexRegionName } from '@elite-dangerous-almanac/core/i18n/codex-regions';
 *
 * getCodexRegionName(1, 'de-DE'); // -> 'Galaktisches Zentrum'
 * getCodexRegionName(5, 'fr'); // -> 'Bras de la Règle'
 * getCodexRegionName(5, 'it'); // -> null
 * ```
 */
export function getCodexRegionName(id: number, locale: string): string | null {
    // Object.hasOwn keeps `toString` and other prototype keys from resolving.
    const key = String(id);
    const record = Object.hasOwn(CODEX_REGION_NAMES, key) ? CODEX_REGION_NAMES[key] : undefined;
    return getLocalizedText(record ?? null, locale, 'getCodexRegionName');
}
