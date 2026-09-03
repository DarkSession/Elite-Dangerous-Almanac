/** Localized market-commodity display names, isolated from commodity metadata. */

import commodityNamesData from '../../../data/i18n/commodity-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const COMMODITY_NAMES = /* @__PURE__ */ createLocalizedNameIndex(
    commodityNamesData as LocalizedNameMap,
);

/**
 * Look up a market commodity's source-backed display name for a locale.
 *
 * @param symbol - Frontier's commodity symbol, such as `"LavianBrandy"`. Matching
 * ignores case and surrounding whitespace, so the lower-cased form a market or journal
 * line reports resolves too.
 * @param locale - A BCP 47 language or regional tag, such as `"de"` or `"de-DE"`; see
 * {@link GameLocale} for how a tag is matched.
 * @returns The localized commodity name; the canonical `Commodity.name` for any English
 * tag; or `null` when the symbol is unknown or the locale is not one of the six this
 * catalogue stores.
 * @remarks
 * Standard and rare commodities share this one lookup, as they share one symbol space.
 * All six stored locales are complete for this dataset, so a supported locale always
 * answers. This function bundles names only, not categories or the `rare` flag.
 *
 * **This is a heavy `i18n` dataset**: six locales for every good in both commodity
 * catalogues is ~101 KiB minified (~27 KiB gzipped). It has its own module so an application that
 * never shows a translated commodity name does not pay for it — import it from
 * `core/i18n/commodities` rather than the `core/i18n` barrel if you want that boundary
 * to be explicit.
 * @throws {TypeError} If `symbol` is present and not a string, or `locale` is not a
 * string. A nullish `symbol` is a lookup miss and returns `null`.
 * @example
 * ```ts
 * import { getCommodityName } from '@elite-dangerous-almanac/core/i18n/commodities';
 *
 * getCommodityName('LavianBrandy', 'de-DE'); // -> 'Lave-Brandy'
 * getCommodityName('platinum', 'ru'); // -> 'Платина'
 * getCommodityName('platinum', 'it'); // -> null
 * ```
 */
export function getCommodityName(symbol: string, locale: string): string | null {
    return getLocalizedName(COMMODITY_NAMES, symbol, locale, 'getCommodityName', 'symbol');
}
