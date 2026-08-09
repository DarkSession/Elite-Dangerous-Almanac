# Data sources — `data/astro/`

**Acquired:** 2026-07-24. **Upstream revision:** unavailable. See
`../SNAPSHOTS.md` for the provenance requirements.

Attribution for the astrophysical data files in this directory. This file is the
long form; each data file also repeats its own credit in a comment header, so the
provenance meets you where you meet the data.

The data files are **JSONC** (`.jsonc`) for exactly that reason: attribution in a
comment documents the file without becoming part of the payload, which every
consumer inlines into their bundle. Comments are the only JSONC extension used —
no trailing commas — so stripping comments leaves strict JSON that any language's
standard parser accepts. See AGENTS.md §Attribution for how to consume them.

## Procedural naming and named-region origins

- **File/code:** `named-region-origins.jsonc`, `typescript/src/astro/sector-name.ts`,
  and the system-name/address modules.
- **Source:** the EDTS reference implementation (`edtslib/pgdata.py` and
  `edtslib/pgnames.py`) by Andy Martin (Esvandiary), based on community
  reverse-engineering of Elite Dangerous's procedural generator.
- **Author/License:** Andy Martin (Esvandiary),
  [bitbucket.org/Esvandiary/edts](https://bitbucket.org/Esvandiary/edts),
  BSD 3-Clause License, © 2016 Andy Martin. The full BSD 3-Clause text is reproduced in
  `ATTRIBUTIONS.md`.
- **Derivation:** named-region origins are stored in the game's internal coordinate
  frame (32 units per light-year from the galaxy corner). Where a region is defined
  by a single sphere, its origin and extent are the sphere's axis-aligned bounds in
  that frame. The NGC 2392 record is derived from its catalogued 100 ly sphere and
  verified by encoding the EDSM system `NGC 2392 Sector UJ-Q b5-0` (id64
  `674176509065`, EDSM system id 21224).

## Hand-authored named sectors and fixtures

- **Files:** `hand-authored-regions.jsonc`, `fixtures/astro/hand-authored-regions.json`,
  and `fixtures/astro/system-addresses.json`. Region names and spheres only —
  whether a region is permit-locked is recorded once, in `permit-locked-regions.jsonc`.
- **Sources:** [EDSM](https://www.edsm.net) and [Spansh](https://spansh.co.uk),
  maintained by their respective community contributors. These are factual system
  names, coordinates, addresses, permit flags, and region bounds; consult each
  service's published terms for use of its API/data.
- **Derivation:** sphere membership and real-system triples are cross-checked across
  the services. Decimal id64 values remain strings in JSON so every target language
  can parse them without IEEE-754 precision loss.

## Nebulae

- **Files:** `nebulae-real.jsonc` (180 catalogued real-world nebulae and dark
  regions), `nebulae-procgen.jsonc` (166 procedurally generated nebulae),
  `nebulae-planetary.jsonc` (5489 planetary nebulae), and
  `fixtures/astro/nebulae.json`. The class split lets consumers import recognisable
  named nebulae without bundling the planetary catalogue; see AGENTS.md §Build.
- **Source:** the EDAstro nebulae coordinates dataset
  (`nebulae-coordinates.csv`, columns `Name,System,X,Y,Z,Type,RegionID`),
  published at [EDAstro](https://edastro.com/mapcharts/) by **CMDR Orvidius**.
  EDAstro publishes no explicit licence for the file; consult the site's terms
  before redistributing it. Original observations are community exploration data.
- **Obtained via:**
  [canonn-science/canonn-signals](https://github.com/canonn-science/canonn-signals),
  `src/assets/nebulae.json` (MIT, © 2023 Canonn Research Group), which converts
  the CSV to JSON verbatim. The
  records here were checked against both and are identical field-for-field.
- **Derivation:** records are carried over unchanged (name, catalogued system,
  galactic X/Y/Z in light-years with Sol at the origin, class, region id), grouped
  by `type` into one file per class and sorted by name. `regionId` is the galactic
  codex region id from the source CSV — a column the canonn-signals JSON drops —
  and all 5835 values were verified to agree with this project's own
  `findRegionAt` lookup, which the test suite re-checks on every run.
- **Caveat:** a nebula is a volume, but the dataset records a single point — the
  position of the system it is catalogued at.

## Permit-locked systems and regions

- **Files:** `permit-locked-systems.jsonc`, `permit-locked-regions.jsonc`,
  `fixtures/astro/permit-locks.json`, and the corresponding TypeScript permit
  modules.
- **Source:** the community-maintained "Elite Dangerous Permit Database"
  spreadsheet. Permit status appears in no game data file, journal event or API
  (Sol itself reports no permit flag), so the list is hand-maintained by the
  community and is best-effort.
- **Obtained via:**
  [canonn-science/canonn-signals](https://github.com/canonn-science/canonn-signals),
  `src/app/data/permit-locked-systems.ts` (MIT, © 2023 Canonn Research Group),
  which transcribes the sheet into two arrays.
- **Derivation:** the 54 exact system names are carried over unchanged and sorted
  case-insensitively. Permit state is split by lookup domain so region-only
  consumers do not load the individual-system catalogue. The 28 region entries
  are names of regions in `hand-authored-regions.jsonc`, which stores their spheres
  and nothing about permits. Each name doubles as the matching prefix,
  because the game names every system in a region after it
  (`Col 70 Sector AA-D b17-0`). The upstream list matches 19 lower-cased stems
  instead; the two agree except for the digit-suffixed regions, which the region
  names resolve exactly.
- **System addresses:** `id64` comes from [Spansh](https://spansh.co.uk) for 53 of
  the 54, cross-checked against [EDSM](https://www.edsm.net) for the 38 EDSM holds,
  with no disagreement in address or coordinates. The remaining 16 are absent from
  EDSM entirely, which is expected of systems no commander can enter to report.
  `Plaa Ain HA-Z d46` is in neither service; it is procedurally named, so its
  address is encoded by this project's own `StarSystem`, whose output was confirmed
  against Spansh on the other two procedural entries in the list
  (`Dryio Flyuae IC-B c1-377`, `Scheau Bli NB-O d6-1409`). Values are stored as
  decimal strings so every target language parses them without IEEE-754 loss.
- **`Bleia1`–`Bleia5` and `Praei1`–`Praei6` are in-game region names**, not
  groupings: EDSM holds `Bleia1 DL-Y f26`, `Bleia2 AA-A h55` and
  `Praei3 MJ-D b43-8`, each inside the same-named sphere of
  `hand-authored-regions.jsonc`. The bare stems `Bleia` and `Praea` name *unrelated*
  procedural sectors far outside the permit spheres — `Bleia Flyuae DH-U e3-26`
  sits ≈6800 ly beyond every Bleia sphere and `Praea Aec AA-A b1-1` ≈46 kly from
  the Praei ones — so neither is a permit prefix. All of these systems, with EDSM
  coordinates, are in `fixtures/astro/permit-locks.json`, where the test suite
  asserts the name route and the coordinate route agree on each.
- **Caveat:** region membership is inferred from the system name, since no
  per-system region-permit flag is published; resolving a permit from coordinates
  (`handAuthoredRegionForCoords`) is exact and should be preferred where
  coordinates are available. Permit-locked *bodies* inside otherwise-open systems
  (Diso 5 C, Lave 2, Sol's Moon and Triton) are out of scope — a system-level flag
  would misreport their systems.

## Galactic codex regions

- **Files:** `galactic-regions.jsonc` (per-region metadata),
  `galactic-region-cells.jsonc` (per-region lookup geometry + projection). Split
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
