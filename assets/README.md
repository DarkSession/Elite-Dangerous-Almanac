# Shared assets

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

These assets and imagery remain the property of Frontier Developments plc and are used
under the media-usage terms in [`ATTRIBUTIONS.md`](../ATTRIBUTIONS.md). They are shared
repository assets; the TypeScript build copies them byte-for-byte into its npm package.
The installed package's [ship-assets documentation](../typescript/README.md#ship-assets)
defines the supported schematic annotations and embedding constraints.
