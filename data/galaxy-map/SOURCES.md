# Data sources — `data/galaxy-map/`

**Acquired:** 2026-09-20 UTC. **Upstream revision:** unavailable — the game publishes no
immutable identifier for its interface artwork, so the captures are the evidence.

## Markers

- **File:** `markers.jsonc` (one record per galaxy-map marker).
- **Source:** Frontier Developments plc — bitmap captures of the marker icons the galaxy
  map draws over a system, one PNG per marker.
- **Derivation:** each record is `{ symbol, color, frameColor }`. `symbol` is a
  kebab-case name for the marker, chosen here rather than taken from the game, which
  exposes no identifier for these icons; it also names the marker's redrawn vector in
  `assets/galaxy-map/`. `color` is the exact RGB value of the capture's dominant opaque
  glyph pixel, written as uppercase `#RRGGBB`. `frameColor` is the same measurement taken
  on the square border.
- **The captures are not retained, and they carry no checksum.** They are
  Frontier's artwork, and the media-usage rules in `ATTRIBUTIONS.md` cover the redrawn
  vectors this repository ships, not a redistributed copy of the source bitmaps. The
  vectors are drawn from geometric shapes rather than traced, so a capture is not
  recoverable from one. `data/SNAPSHOTS.md` asks for a checksum where the content itself
  cannot be kept, so this is a gap: #59 records what would close it.

### Measuring a capture

Read the capture's stored RGB. Do not composite it over a background first: that mixes
the background into the value, in proportion to how transparent the pixel is.

`front-line` is the one capture with no opaque pixel, so the Derivation bullet above
does not describe it. Its alpha is a flat 198 across the whole canvas, so an alpha-keyed
measurement returns the canvas rather than the glyph. Both of its colours come from the
RGB planes, which is where its shape sits.

### Manual corrections

None. Every value is a measurement.

### `front-line` is the one marker with two colours

The game frames it in `#4A00B5` and draws the arrow inside in `#9418FF`. Every other
marker frames and draws in one colour, so `frameColor` repeats `color`.

### `station-abandoned` is nearly black on purpose

Its `#211C21` is the colour the game uses, not a failed measurement or a transparent
pixel read by mistake. An abandoned station is drawn dark, and a consumer that treats a
near-black marker colour as an error would reject a correct record.
