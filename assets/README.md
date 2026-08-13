# Shared assets

The ship illustrations and schematics live under `ships/`. Each player-flyable hull has
one directory named with the exact `symbol` from `data/ships/ships.jsonc`:

```text
assets/ships/<symbol>/illustration.svg
assets/ships/<symbol>/schematic-top.svg
assets/ships/<symbol>/schematic-bottom.svg
```

`illustration.svg` is a coloured, three-quarter vector view on a `1200 × 800` canvas.
`schematic-top.svg` and `schematic-bottom.svg` are feature-annotated technical views of
the upper and lower hull surfaces on the same canvas. The set covers all 48 hulls in the
ship catalogue. The SVG content is preserved as supplied; only the filenames are made
consistent for consumers.

These assets and imagery remain the property of Frontier Developments plc and are used
under the media-usage terms in [`ATTRIBUTIONS.md`](../ATTRIBUTIONS.md). They are shared
repository assets and are not bundled into the TypeScript package.
