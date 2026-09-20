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
 * A symbol also names the marker's vector asset, so one string gives both the colour
 * and the file:
 *
 * ```ts
 * import { getGalaxyMapMarker } from '@elite-dangerous-almanac/core/galaxy-map';
 *
 * const symbol = getGalaxyMapMarker('titan')?.symbol ?? 'unknown';
 * `assets/galaxy-map/${symbol}.svg`; // -> 'assets/galaxy-map/titan.svg'
 * ```
 *
 * The package exports that path under `@elite-dangerous-almanac/core/assets/`. A
 * bundler resolves an asset import statically, so write the whole specifier as a
 * literal — `@elite-dangerous-almanac/core/assets/galaxy-map/titan.svg` — rather than
 * building it from a symbol at run time.
 *
 * Every shape in an asset paints with `currentColor`, and the root `<svg>` carries the
 * marker's own colour. A host that embeds the file inline therefore recolours it with
 * one CSS `color` declaration, and one that loads it with `<img>` keeps the game's
 * colour. `front-line.svg` is the exception: its frame holds the literal
 * {@link GalaxyMapMarker.frameColor}, which no `color` declaration reaches.
 *
 * A marker is safe to embed inline as supplied: it holds only static `svg`, `title`,
 * `defs`, `mask`, `filter`, `feGaussianBlur`, `g`, `use`, `path`, `rect`, `circle` and
 * `ellipse` elements, and every `href`, `mask` and `filter` points inside the same
 * file. There are no scripts, styles, event-handler attributes, foreign or media
 * elements, links or external references. Every definition id is unique across the
 * set, so a page can inline all of them.
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
