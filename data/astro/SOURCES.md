# Data sources — `data/astro/`

Attribution for the astrophysical data files in this directory. Each file also
carries machine-readable attribution in an `attribution` object where practical.

## Procedural naming and named-region origins

- **File/code:** `named-region-origins.json`, `typescript/src/astro/sector-name.ts`,
  and the system-name/address modules.
- **Source:** the EDTS reference implementation (`pgdata.py`) by Alot
  (Esvandiary), based on community reverse-engineering of Elite Dangerous's
  procedural generator. The previously cited GitHub repository is no longer
  publicly available, so its original license could not be independently
  re-confirmed.
- **Derivation:** named-region origins are stored in the game's internal coordinate
  frame (32 units per light-year from the galaxy corner). Where a region is defined
  by a single sphere, its origin and extent are the sphere's axis-aligned bounds in
  that frame. The NGC 2392 record was restored from its catalogued 100 ly sphere and
  verified by encoding the EDSM system `NGC 2392 Sector UJ-Q b5-0` (id64
  `674176509065`, EDSM system id 21224).

## Hand-authored named sectors and fixtures

- **Files:** `hand-authored-regions.json`, `fixtures/astro/hand-authored-regions.json`,
  and `fixtures/astro/system-addresses.json`.
- **Sources:** [EDSM](https://www.edsm.net) and [Spansh](https://spansh.co.uk),
  maintained by their respective community contributors. These are factual system
  names, coordinates, addresses, permit flags, and region bounds; consult each
  service's published terms for use of its API/data.
- **Derivation:** sphere membership and real-system triples are cross-checked across
  the services. Decimal id64 values remain strings in JSON so every target language
  can parse them without IEEE-754 precision loss.

## Galactic codex regions

- **Files:** `galactic-regions.json` (per-region metadata),
  `galactic-region-cells.json` (per-region lookup geometry + projection). Split
  along the metadata-vs-geometry axis so metadata-only consumers do not bundle the
  grid (see AGENTS.md §Build).
- **Source:** [EliteDangerousRegionMap](https://github.com/klightspeed/EliteDangerousRegionMap)
- **Author:** Ben Peddell ([klightspeed](https://github.com/klightspeed))
- **License:** MIT
- **Derivation:** The 42 region ids/names and each region's run-length cell
  geometry (`cells`) are taken from the upstream `RegionMapData.json` (itself
  generated from `RegionMap.png`), re-grouped per region. The per-region footprint
  fields (`cellCount`, `areaLy2`, `bounds`, `centroid`) are computed by this project
  from that grid and are approximate (≈49.35 ly grid resolution); coordinates are
  quantised to 1/64 ly.
- **Grid mapping:** regions sit on a `4096 / 83` ly (≈49.3494 ly) grid over the
  galactic plane, origin corner at `(x0, y0, z0) = (-49985, -40985, -24105)` ly.
  Original region-boundary research: Frontier forums,
  [Determining the region of a system](https://forums.frontier.co.uk/threads/determining-the-region-of-a-system.537845/).
- **Ported algorithm:** `typescript/src/astro/galactic-region-lookup.ts` ports
  `findRegion` / `findRegionForBoxel` from the upstream `RegionMap.js`.
