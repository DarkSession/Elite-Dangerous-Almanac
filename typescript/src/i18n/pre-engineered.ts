/** Localized pre-engineered variant names, isolated from module and modifier statistics. */

import namesData from '../../../data/i18n/pre-engineered-variant-names.jsonc' with { type: 'json' };
import {
    requireObject,
    requireString,
    requireStringIfPresent,
} from '../internal/argument-guards.js';
import type { PreEngineeredAcquisition } from '../ships/pre-engineered.js';
import {
    createDeduplicatedLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameCatalogue,
} from './internal/localized-name.js';

const NAMES = /* @__PURE__ */ createDeduplicatedLocalizedNameIndex(
    namesData as LocalizedNameCatalogue,
);

/** Stable fields that identify one pre-engineered variant. */
export interface PreEngineeredVariantIdentity {
    /** Base outfitting-module symbol. */
    readonly symbol: string;
    /** Frontier blueprint or fixed-reward symbol. */
    readonly blueprintSymbol: string;
    /** Frontier experimental-effect symbol, or `null`/omitted when none is fitted. */
    readonly experimentalEffectSymbol?: string | null;
    /** Route through which the variant is obtained. */
    readonly acquisition: PreEngineeredAcquisition;
}

function identityKey(identity: PreEngineeredVariantIdentity): string {
    const prefix = 'getPreEngineeredVariantName: variant';
    requireObject(identity, prefix);
    const symbol = requireString(identity.symbol, `${prefix}.symbol`).trim();
    const blueprint = requireString(identity.blueprintSymbol, `${prefix}.blueprintSymbol`).trim();
    requireStringIfPresent(identity.experimentalEffectSymbol, `${prefix}.experimentalEffectSymbol`);
    const experimental = identity.experimentalEffectSymbol?.trim() ?? '';
    const acquisition = requireString(identity.acquisition, `${prefix}.acquisition`).trim();
    return `${symbol}|${blueprint}|${experimental}|${acquisition}`;
}

/**
 * Look up the display name of one pre-engineered module variant.
 *
 * @param variant - The variant's stable catalogue identity. All four dimensions are used
 * because a base module and blueprint alone do not uniquely identify every reward.
 * @param locale - A BCP 47 locale. Regional tags fall back to their supported language.
 * @returns The explicit localized name, or `null` for an unknown variant or unavailable
 * translation. Decorative reward names currently have English values only.
 * @throws {TypeError} If `variant` is not an object, a required identity field or a
 * non-null `experimentalEffectSymbol` value is not a string, or `locale` is not a
 * string.
 * @example
 * ```ts
 * import { getPreEngineeredVariantName } from '@elite-dangerous-almanac/core/i18n/pre-engineered';
 *
 * getPreEngineeredVariantName({
 *   symbol: 'Hpt_FlakMortar_Turret_Medium',
 *   blueprintSymbol: 'Decorative_Red',
 *   acquisition: 'eventReward',
 * }, 'en'); // -> 'Festive Red Remote Release Flak Launcher'
 * ```
 */
export function getPreEngineeredVariantName(
    variant: PreEngineeredVariantIdentity,
    locale: string,
): string | null {
    return getLocalizedName(
        NAMES,
        identityKey(variant),
        locale,
        'getPreEngineeredVariantName',
        'variant',
    );
}
