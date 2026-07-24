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
- **Engineering materials:** material names, symbols, grades and
  groups come from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`material.csv`),
  the community-maintained registry of Frontier's internal ids. FDevIDs states no
  explicit licence; consult the repository terms. The newest Thargoid caustic/Titan
  materials it does not yet list are supplemented from
  [INARA](https://inara.cz/elite/components/) and keyed by their journal symbols.
- **Odyssey micro resources:** on-foot component, data, consumable and item names,
  symbols and categories come from
  [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`microresources.csv`), which
  states no explicit licence; consult the repository terms.
- **Ships and outfitting modules:** hull and module names, Frontier ids, symbols,
  sizes, ratings, mounts and entitlement tokens come from
  [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`shipyard.csv`, `outfitting.csv`),
  the community-maintained registry of Frontier's internal ids. FDevIDs states no
  explicit licence; consult the repository terms.
- **Ship and module stats, slot layouts and blueprints:** hull masses, module masses,
  power, FSD constants, thruster/shield/distributor performance, ship-restriction
  flags, per-hull slot layouts and engineering blueprint modifiers come from
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) (`ships/*.json`,
  `modules/**`, `modifications/**`, commit `0db9234`). Coriolis-data releases only its
  _code_ under MIT; the JSON stat values are **Elite Dangerous game data, property of
  Frontier Developments plc**, used under Frontier's media-usage terms (see below).
- **Experimental (special) effect modifiers, material recipes, and journal Modifier
  Labels:** the numeric experimental-effect modifiers and their material costs — which
  coriolis-data does not carry — plus the attribute-to-journal-Label mapping come from
  [EDSY](https://github.com/taleden/EDSY) (`eddb.js`) by taleden, whose code is licensed
  **CC BY-NC 4.0**.
- **Jump-range and fuel algorithm:** the hyperspace formula is ported as fact
  (our own implementation) from [EDSY](https://github.com/taleden/EDSY) by taleden,
  whose code is licensed **CC BY-NC 4.0** — attribution to taleden and to Frontier's
  original "mass effect on hyperspace range" forum post. **SLEF** parsing follows the
  [Inara Ship Loadout Export Format specification](https://inara.cz/elite/inara-impexp-slef/).
- **Market commodities:** standard and rare commodity names, symbols and categories
  come from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`commodity.csv`,
  `rare_commodity.csv`), which states no explicit licence; consult the repository
  terms.
- **Elite Dangerous game data (Frontier media-usage notice):** the ship and module
  stat values are the property of Frontier Developments plc and are used under
  Frontier's [media-usage rules](https://forums.frontier.co.uk/threads/elite-dangerous-media-usage-rules.510879/):
  _"Elite Dangerous Almanac was created using assets and imagery from Elite Dangerous,
  with the permission of Frontier Developments plc, for non-commercial purposes. It is
  not endorsed by nor reflects the views or opinions of Frontier Developments and no
  employee of Frontier Developments was involved in the making of it."_ Projects that
  redistribute this data should include the same notice.

The detailed per-file provenance and derivation notes live in the repository's
`data/astro/SOURCES.md`, `data/materials/SOURCES.md`, `data/ships/SOURCES.md` and
`data/commodities/SOURCES.md`.
