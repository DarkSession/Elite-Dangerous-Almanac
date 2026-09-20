The icons the galaxy map draws over a system, and the colours it draws them in.

[GalaxyMapMarkerCatalogue](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.GalaxyMap.Class.GalaxyMapMarkerCatalogue)
holds every marker, each a
[GalaxyMapMarker](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.GalaxyMap.Record.GalaxyMapMarker)
carrying its symbol, its glyph colour and its frame colour. Both colours are uppercase
`#RRGGBB` strings, so a caller hands either straight to a colour parser or a brush.

The catalogue takes a symbol in any casing, with any surrounding whitespace, and answers
`null` for one no marker carries.

A marker's symbol also names its vector asset, which the package carries under
`assets/galaxy-map/`.

Every shape in an asset paints with `currentColor`, and the root `<svg>` carries the
marker's own colour. A host that embeds the file inline therefore recolours it with one
CSS `color` declaration, and one that loads it with `<img>` keeps the game's colour.
`front-line.svg` is the exception: its frame holds the frame colour as a literal, which
no `color` declaration reaches.

A marker is safe to embed inline as supplied: it holds only static `svg`, `title`,
`defs`, `mask`, `filter`, `feGaussianBlur`, `g`, `use`, `path`, `rect`, `circle` and
`ellipse` elements, and every `href`, `mask` and `filter` points inside the same file.
There are no scripts, styles, event-handler attributes, foreign or media elements,
links or external references. Every definition id is unique across the set, so a page
can inline all of them. This content guarantee applies to the unmodified package files.

The catalogue carries no display name. Each asset's `<title>` holds the English label.
