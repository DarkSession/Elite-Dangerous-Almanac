# Third-party notices

Elite Dangerous Almanac incorporates community-researched algorithms and factual
galaxy data. The project implementation is MIT-licensed; upstream material remains
subject to its respective terms.

- **Procedural sector and system naming:** reverse-engineered by the Elite
  Dangerous community and ported from the EDTS reference implementation
  (`pgdata.py`) by Alot/Esvandiary. The previously cited repository is no longer
  publicly available, so its original license could not be independently
  re-confirmed.
- **Galactic codex regions:** region names, ids, and lookup geometry derive from
  [EliteDangerousRegionMap](https://github.com/klightspeed/EliteDangerousRegionMap)
  by Ben Peddell (klightspeed), MIT.
- **Nebula catalogues:** the nebula names, catalogued systems, coordinates,
  classes and region ids come from the EDAstro nebulae coordinates dataset
  published by CMDR Orvidius at [EDAstro](https://edastro.com/mapcharts/),
  obtained via
  [canonn-science/canonn-signals](https://github.com/canonn-science/canonn-signals)
  (`src/assets/nebulae.json`, MIT, © 2023 Canonn Research Group). EDAstro states
  no explicit licence for the dataset; consult the site's terms before
  redistributing it.
- **Permit-locked systems and regions:** transcribed from the community-maintained
  "Elite Dangerous Permit Database" spreadsheet, obtained via
  [canonn-science/canonn-signals](https://github.com/canonn-science/canonn-signals)
  (`src/app/data/permit-locked-systems.ts`, MIT, © 2023 Canonn Research Group).
  Permit status is published in no game file or API, so the list is hand-maintained
  and best-effort. The system addresses accompanying it are factual records from
  [Spansh](https://spansh.co.uk), cross-checked against
  [EDSM](https://www.edsm.net).
- **Hand-authored sector spheres, named-sector origins, and validation fixtures:**
  factual records compiled and cross-checked against
  [EDSM](https://www.edsm.net) and [Spansh](https://spansh.co.uk). The NGC 2392
  fixture was obtained from the EDSM system API (system id 21224); its region
  origin is derived from the catalogued sphere bounds.
- **Engineering materials:** material names, Frontier ids, symbols, grades and
  groups come from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`material.csv`),
  the community-maintained registry of Frontier's internal ids. FDevIDs states no
  explicit licence; consult the repository terms. The newest Thargoid caustic/Titan
  materials it does not yet list are supplemented from
  [INARA](https://inara.cz/elite/components/) and flagged provisional (`id`/`symbol`
  null).
- **Ships and outfitting modules:** hull and module names, Frontier ids, symbols,
  sizes, ratings, mounts and entitlement tokens come from
  [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`shipyard.csv`, `outfitting.csv`),
  the community-maintained registry of Frontier's internal ids. FDevIDs states no
  explicit licence; consult the repository terms.

The detailed per-file provenance and derivation notes live in the repository's
`data/astro/SOURCES.md`, `data/materials/SOURCES.md` and `data/ships/SOURCES.md`.
