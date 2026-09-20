/**
 * The galaxy map's location markers — the icons the game draws over systems, and
 * the colours it draws them in.
 *
 * Ask for one marker by symbol, or read the whole catalogue:
 *
 * ```ts
 * import { getGalaxyMapMarkerColor, GALAXY_MAP_MARKERS } from '@elite-dangerous-almanac/core/galaxy-map';
 *
 * getGalaxyMapMarkerColor('conflict-zone'); // -> '#FFAE00'
 * GALAXY_MAP_MARKERS[0].symbol;             // -> 'bookmark'
 * ```
 *
 * A symbol also names the marker's vector asset, so a consumer that ships the
 * shared `assets/galaxy-map/` directory builds the path from the same string:
 *
 * ```ts
 * import { getGalaxyMapMarker } from '@elite-dangerous-almanac/core/galaxy-map';
 *
 * const symbol = getGalaxyMapMarker('titan')?.symbol ?? 'unknown';
 * `assets/galaxy-map/${symbol}.svg`; // -> 'assets/galaxy-map/titan.svg'
 * ```
 *
 * Every shape in an asset paints with `currentColor`, and the root `<svg>` carries the
 * marker's own colour. A host that embeds the file inline therefore recolours it with
 * one CSS `color` declaration, and one that loads it with `<img>` keeps the game's
 * colour. `front-line.svg` is the exception: its frame holds the literal
 * {@link GalaxyMapMarker.frameColor}, which no `color` declaration reaches.
 *
 * The catalogue carries no display name. Each asset's `<title>` holds the English
 * label, which is also what a screen reader announces for an inline-embedded marker.
 *
 * @packageDocumentation
 */

export {
    GALAXY_MAP_MARKERS,
    getGalaxyMapMarker,
    getGalaxyMapMarkerColor,
    type GalaxyMapMarker,
} from './markers.js';
