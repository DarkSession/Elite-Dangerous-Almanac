# Shared assets

## Ships

The ship gunsights, illustrations, and schematics live under `ships/`. Each
player-flyable hull has one directory named with the exact `symbol` from
`data/ships/ships.jsonc`:

```text
assets/ships/<symbol>/gunsight.svg
assets/ships/<symbol>/illustration.svg
assets/ships/<symbol>/schematic-top.svg
assets/ships/<symbol>/schematic-bottom.svg
```

`gunsight.svg` plots the fixed-weapon aim points at a nominal 1,000-metre target range
on a `600 × 600` canvas. `illustration.svg` is a coloured, three-quarter vector view on
a `1200 × 800` canvas. `schematic-top.svg` and `schematic-bottom.svg` are
feature-annotated technical views of the upper and lower hull surfaces on the same
canvas. The set covers every hull in the ship catalogue. The SVG content is preserved
as supplied; only the ship-image filenames are made consistent for consumers.

The TypeScript build copies `ships/` byte-for-byte into its npm package. The installed
package's [ship-assets documentation](../typescript/README.md#ship-assets) defines the
supported schematic annotations and embedding constraints.

## Galaxy-map markers

The galaxy map's location markers live under `galaxy-map/`, one file per marker. Each
file is named with the exact `symbol` from `data/galaxy-map/markers.jsonc`:

```text
assets/galaxy-map/<symbol>.svg
```

Both builds copy `galaxy-map/` byte-for-byte into their packages, under the same
`assets/galaxy-map/` path.

Each marker is a hand-drawn vector recreation of the in-game icon on a `64 × 64`
canvas, built from geometric shapes rather than traced from the bitmap. Every file
holds one `<title>`, the square frame, and the glyph inside it.

The root `<svg>` carries the in-game colour in a `color` attribute and each shape
paints with `currentColor`. A consumer that embeds the file inline therefore recolours
a marker with one CSS `color` declaration; a consumer that loads it with `<img>` gets
the in-game colour. `front-line.svg` is the one file with a second colour: it draws its
frame in a darker purple than its arrow, as a literal that no `color` declaration
reaches. Both colours are also published by the `galaxy-map` marker catalogue, keyed by
the same symbol.

Where the game shows the background through a glyph, the marker cuts a hole instead of
painting black. The skull's eye sockets, the fleet carrier's ring and the crossed
swords are examples. A hole lets a marker read on any background.

## Ownership

These assets and imagery remain the property of Frontier Developments plc and are used
under the media-usage terms in [`ATTRIBUTIONS.md`](../ATTRIBUTIONS.md).
