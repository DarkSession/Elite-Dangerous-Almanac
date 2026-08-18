/** Localized ship names and manufacturer labels, isolated from hull statistics. */

import manufacturerNamesData from '../../../data/i18n/ship-manufacturer-names.jsonc' with { type: 'json' };
import shipNamesData from '../../../data/i18n/ship-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const SHIP_NAMES = /* @__PURE__ */ createLocalizedNameIndex(shipNamesData as LocalizedNameMap);
const MANUFACTURER_NAMES = /* @__PURE__ */ createLocalizedNameIndex(
    manufacturerNamesData as LocalizedNameMap,
);

/**
 * Look up a ship hull's source-backed display name.
 *
 * @param symbol - Frontier's ship symbol. Matching ignores case and surrounding whitespace.
 * @param locale - A BCP 47 locale. Regional tags fall back to their supported language.
 * @returns The explicit localized name, or `null` for an unknown ship, unsupported locale,
 * or unavailable translation. A source-backed spelling may be identical to English.
 * @throws {TypeError} If a present `symbol` or `locale` is not a string.
 * @example
 * ```ts
 * import { getShipName } from '@elite-dangerous-almanac/core/i18n/ships';
 *
 * getShipName('empire_trader', 'fr-FR'); // -> 'Imperial Clipper'
 * getShipName('empire_trader', 'de'); // -> null
 * ```
 */
export function getShipName(symbol: string, locale: string): string | null {
    return getLocalizedName(SHIP_NAMES, symbol, locale, 'getShipName', 'symbol');
}

/**
 * Look up the display name of a ship hull's manufacturer.
 *
 * @param symbol - Frontier's ship symbol. Matching ignores case and surrounding whitespace.
 * @param locale - A BCP 47 locale. The current source supplies canonical English only.
 * @returns The manufacturer name, or `null` for an unknown ship or unavailable locale.
 * @throws {TypeError} If a present `symbol` or `locale` is not a string.
 * @example
 * ```ts
 * import { getShipManufacturer } from '@elite-dangerous-almanac/core/i18n/ships';
 *
 * getShipManufacturer('SideWinder', 'en-GB'); // -> 'Faulcon DeLacy'
 * getShipManufacturer('SideWinder', 'fr'); // -> null
 * ```
 */
export function getShipManufacturer(symbol: string, locale: string): string | null {
    return getLocalizedName(MANUFACTURER_NAMES, symbol, locale, 'getShipManufacturer', 'symbol');
}
