/**
 * The galaxy map's location markers and the colours the game draws them in.
 *
 * @remarks
 * Each marker's `symbol` also names its vector asset, `assets/galaxy-map/<symbol>.svg`,
 * whose root `<svg>` carries the same `color` this catalogue reports.
 *
 * Read from the in-game galaxy map; see
 * [ATTRIBUTIONS.md](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/blob/main/ATTRIBUTIONS.md)
 * for credit and licence terms.
 *
 * @packageDocumentation
 */

import markersData from '../../../data/galaxy-map/markers.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex } from '../internal/registry-index.js';

/**
 * One galaxy-map marker and the two colours the game draws it in.
 *
 * @remarks
 * Both colours are uppercase seven-character `#RRGGBB` strings, so a consumer can
 * hand either straight to CSS, to a canvas fill, or to a colour parser.
 */
export interface GalaxyMapMarker {
    /**
     * The marker's stable identifier, in lower-case kebab case, which is also the
     * base name of its asset file (`bookmark`, `front-line`, `station-under-attack`).
     */
    readonly symbol: string;
    /**
     * The glyph's colour, as `#RRGGBB`. This is the marker's primary colour: the one
     * a caller uses to tint an icon, draw a legend swatch, or colour a map pin.
     */
    readonly color: string;
    /**
     * The square border's colour, as `#RRGGBB`.
     *
     * @remarks
     * This matches {@link GalaxyMapMarker.color} on every marker but `front-line`,
     * which the game frames in a darker purple than its arrow. It is always present,
     * so a caller never has to fall back to `color`.
     */
    readonly frameColor: string;
}

/**
 * Every galaxy-map marker, sorted by {@link GalaxyMapMarker.symbol}.
 *
 * @remarks
 * The array and its records are frozen at runtime. Importing this catalogue costs
 * about 2 KiB minified, so it carries no per-marker split.
 *
 * @example
 * ```ts
 * import { GALAXY_MAP_MARKERS } from '@elite-dangerous-almanac/core/galaxy-map/markers';
 *
 * GALAXY_MAP_MARKERS[0]; // -> { symbol: 'bookmark', color: '#FF2800', frameColor: '#FF2800' }
 * ```
 */
export const GALAXY_MAP_MARKERS: readonly GalaxyMapMarker[] = deepFreeze(
    markersData as GalaxyMapMarker[],
);

const MARKER_INDEX = createKeyIndex(GALAXY_MAP_MARKERS, 'symbol');

/**
 * Find a marker by its symbol.
 *
 * @param symbol - A marker symbol in any casing, with optional surrounding
 * whitespace.
 * @returns The marker, or `null` when no marker carries that symbol.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish `symbol`
 * is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getGalaxyMapMarker } from '@elite-dangerous-almanac/core/galaxy-map/markers';
 *
 * getGalaxyMapMarker('front-line')?.color;      // -> '#9418FF'
 * getGalaxyMapMarker('front-line')?.frameColor; // -> '#4A00B5'
 * getGalaxyMapMarker('no-such-marker');         // -> null
 * ```
 */
export function getGalaxyMapMarker(symbol: string): GalaxyMapMarker | null {
    return findInKeyIndex(MARKER_INDEX, symbol, 'getGalaxyMapMarker: symbol');
}

/**
 * The colour a marker's glyph is drawn in.
 *
 * @param symbol - A marker symbol in any casing, with optional surrounding
 * whitespace.
 * @returns The `#RRGGBB` colour, or `null` when no marker carries that symbol.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish `symbol`
 * is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getGalaxyMapMarkerColor } from '@elite-dangerous-almanac/core/galaxy-map/markers';
 *
 * getGalaxyMapMarkerColor('titan');   // -> '#FF0000'
 * getGalaxyMapMarkerColor('mission'); // -> '#005DFF'
 * ```
 */
export function getGalaxyMapMarkerColor(symbol: string): string | null {
    return findInKeyIndex(MARKER_INDEX, symbol, 'getGalaxyMapMarkerColor: symbol')?.color ?? null;
}
