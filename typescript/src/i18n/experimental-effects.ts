/** Localized experimental-effect display names, isolated from effect mechanics. */

import effectNamesData from '../../../data/i18n/experimental-effect-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const EXPERIMENTAL_EFFECT_NAMES = /* @__PURE__ */ createLocalizedNameIndex(
    effectNamesData as LocalizedNameMap,
);

/**
 * Look up an engineering experimental effect's source-backed display name for a locale.
 *
 * @param experimentalEffectSymbol - Frontier's experimental-effect id, such as
 * `"special_concordant_sequence"`. Matching ignores case and surrounding whitespace.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched.
 * @returns The localized effect name; the canonical `ExperimentalEffect.name` for any
 * English tag; or `null` when
 * the id is unknown, the locale is unsupported, or the pinned source carries no value
 * for that effect and locale.
 * @remarks
 * This function bundles names only, not modifier mechanics or material costs. Missing
 * translations never silently fall back to English.
 * @throws {TypeError} If `experimentalEffectSymbol` is present and not a string, or
 * `locale` is not a string. A nullish `experimentalEffectSymbol` is a lookup miss and
 * returns `null`.
 * @example
 * ```ts
 * import { getExperimentalEffectName } from '@elite-dangerous-almanac/core/i18n/experimental-effects';
 *
 * getExperimentalEffectName('special_concordant_sequence', 'de');
 * // -> 'Konkordante Sequenz'
 * getExperimentalEffectName('special_concordant_sequence', 'ja-JP'); // -> null
 * ```
 */
export function getExperimentalEffectName(
    experimentalEffectSymbol: string,
    locale: string,
): string | null {
    return getLocalizedName(
        EXPERIMENTAL_EFFECT_NAMES,
        experimentalEffectSymbol,
        locale,
        'getExperimentalEffectName',
        'experimentalEffectSymbol',
    );
}
