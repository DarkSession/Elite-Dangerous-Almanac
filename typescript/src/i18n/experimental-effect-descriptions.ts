/** Localized experimental-effect descriptions, isolated from effect statistics. */

import descriptionsData from '../../../data/i18n/experimental-effect-descriptions.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const DESCRIPTIONS = /* @__PURE__ */ createLocalizedNameIndex(descriptionsData as LocalizedNameMap);

/**
 * Look up an experimental effect's display description.
 *
 * @param experimentalEffectSymbol - Frontier's experimental-effect id. Matching ignores case and
 * surrounding whitespace.
 * @param locale - A BCP 47 locale. The current source supplies canonical English only.
 * @returns The localized description, or `null` when the effect is unknown, has no
 * source description, or the requested locale is unavailable.
 * @throws {TypeError} If a present `experimentalEffectSymbol` or `locale` is not a string.
 * @example
 * ```ts
 * import { getExperimentalEffectDescription } from '@elite-dangerous-almanac/core/i18n/experimental-effect-descriptions';
 *
 * getExperimentalEffectDescription('special_auto_loader', 'en'); // -> 'Reloads the weapon while it continues firing.'
 * getExperimentalEffectDescription('special_auto_loader', 'fr'); // -> null
 * ```
 */
export function getExperimentalEffectDescription(
    experimentalEffectSymbol: string,
    locale: string,
): string | null {
    return getLocalizedName(
        DESCRIPTIONS,
        experimentalEffectSymbol,
        locale,
        'getExperimentalEffectDescription',
        'experimentalEffectSymbol',
    );
}
