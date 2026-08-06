# Attributions and third-party notices

Elite Dangerous Almanac incorporates community-researched algorithms and factual
galaxy data. The project's own implementation is MIT-licensed; upstream material
remains subject to its own terms, several of which are **non-commercial**. Read
this file and `LICENSE` before redistributing the data or using it commercially.

This is the single canonical credits file. It is shipped to npm consumers inside
the package as `THIRD_PARTY_NOTICES.md`, which is a verbatim copy produced at
build time — edit this file, never the copy. The same credit also lives next to
each thing being credited: as a comment header on every `data/**/*.jsonc` file,
in the doc comment of each ported module, and in long form in the domain
`SOURCES.md` files listed at the end.

## Algorithms

- **Procedural sector and system naming** — reverse-engineered by the Elite
  Dangerous community and ported from the EDTS reference implementation
  (`edtslib/pgdata.py`, `edtslib/pgnames.py`) by **Andy Martin** (Esvandiary),
  <https://bitbucket.org/Esvandiary/edts>, licensed **BSD 3-Clause, © 2016 Andy
  Martin** — reproduced in full at the end of this file, as its terms require.
  The TypeScript port passed through
  [canonn-science/canonn-signals](https://github.com/canonn-science/canonn-signals)
  (MIT, © 2023 Canonn Research Group) before being restructured here. (EDTS lives
  on Bitbucket, not GitHub.)
- **Build-metric algorithms** — the power budget and its priority groups, shield
  strength and its mass curve, armour hit points, resistance stacking with its
  diminishing returns, and weapon DPS / capacitor draw / heat. Ported as fact
  (our own implementation) from [EDCD/Coriolis](https://github.com/EDCD/coriolis)
  by the **Coriolis contributors** — `src/app/shipyard/Calculations.js`, `Ship.js`
  and `Module.js`, commit `68c042ca`, whose application code is **MIT**-licensed.
  Cross-checked against [EDSY](https://github.com/taleden/EDSY) by **taleden**
  (**CC BY-NC 4.0**), whose reading of real journal data settles the percentage
  stats' units and compounding. Both credit the original Frontier-forum research
  the formulas come from; `data/ships/SOURCES.md` records the exact functions,
  commits and threads.
- **Jump-range and fuel algorithm** — the hyperspace formula, ported as fact (our
  own implementation) from [EDSY](https://github.com/taleden/EDSY) by **taleden**
  (**CC BY-NC 4.0**), derived from Frontier's "mass effect on hyperspace range"
  description.
- **SLEF parsing and writing** — both follow the
  [Inara Ship Loadout Export Format specification](https://inara.cz/elite/inara-impexp-slef/).

## Data

- **Galactic codex regions** — the 42 regions, their ids and lookup geometry, and
  boxel/coordinate region resolution, from
  [EliteDangerousRegionMap](https://github.com/klightspeed/EliteDangerousRegionMap)
  by **Ben Peddell** ([klightspeed](https://github.com/klightspeed)), **MIT**.
  Per-region footprint figures (area, bounds, centroid) are derived by this
  project and are approximate. Original region-boundary research on the
  [Frontier forums](https://forums.frontier.co.uk/threads/determining-the-region-of-a-system.537845/).
- **Nebula catalogues** — names, catalogued systems, coordinates, classes and
  region ids, from the EDAstro nebulae coordinates dataset published by **CMDR
  Orvidius** ([EDAstro](https://edastro.com/mapcharts/)), obtained via
  [canonn-science/canonn-signals](https://github.com/canonn-science/canonn-signals)
  (`src/assets/nebulae.json`, MIT, © 2023 Canonn Research Group). EDAstro states
  no explicit licence for the dataset; consult the site's terms before
  redistributing it.
- **Permit-locked systems and regions** — transcribed from the
  community-maintained "Elite Dangerous Permit Database" spreadsheet, obtained via
  [canonn-science/canonn-signals](https://github.com/canonn-science/canonn-signals)
  (`src/app/data/permit-locked-systems.ts`, MIT, © 2023 Canonn Research Group).
  Permit status is published in no game file or API, so the list is
  hand-maintained and best-effort. The accompanying system addresses are factual
  records from [Spansh](https://spansh.co.uk), cross-checked against
  [EDSM](https://www.edsm.net); the region half is reconciled against this
  project's hand-authored region spheres.
- **Hand-authored region spheres, named-region origins, and ground-truth `id64`
  fixtures** — factual records compiled and cross-checked against
  [EDSM](https://www.edsm.net) and [Spansh](https://spansh.co.uk). The NGC 2392
  fixture was obtained from the EDSM system API (system id 21224); its region
  origin is derived from the catalogued sphere bounds.
- **Engineering materials** — raw, manufactured and encoded material names, ids,
  symbols, grades and groups, from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs)
  (`material.csv`), the community-maintained registry of Frontier's internal ids.
  FDevIDs states no explicit licence; consult the repository terms. The newest
  Thargoid caustic/Titan materials it does not yet list are supplemented from
  [INARA](https://inara.cz/elite/components/) and keyed by their journal symbols.
- **Odyssey micro resources** — on-foot component, data, consumable and item
  names, symbols and categories, from
  [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`microresources.csv`), which
  states no explicit licence; consult the repository terms.
- **Ships and outfitting modules** — hull and module names, Frontier ids, symbols,
  sizes, ratings, mounts and entitlement tokens, from
  [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`shipyard.csv`,
  `outfitting.csv`), which states no explicit licence; consult the repository
  terms.
- **Market commodities** — standard and rare commodity names, symbols and market
  categories, from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs)
  (`commodity.csv`, `rare_commodity.csv`), which states no explicit licence;
  consult the repository terms. One standard record (`curatedcommodity` /
  Curated Commodity Package) is not in FDevIDs and is taken from a player-journal
  `MarketBuy` observation; its market category is a maintainer assignment, not an
  upstream value. See `data/commodities/SOURCES.md`.
- **Ship and module stats, slot layouts and blueprints** — hull and module masses,
  power, FSD constants, thruster/shield/distributor performance, damage
  resistances, hull and shield reinforcement, module protection, armour hull
  boost, weapon damage, rate of fire, clip/reload, distributor draw, thermal load,
  piercing and ranges, ship-restriction flags, per-hull slot layouts and
  engineering blueprint modifiers, from
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) (`ships/*.json`,
  `modules/**`, `modifications/**`, commit `0db9234`). Coriolis-data releases only
  its _code_ under MIT; the JSON stat values are **Elite Dangerous game data,
  property of Frontier Developments plc** — see the Frontier notice below.
- **Experimental (special) effect modifiers, their material recipes, and journal
  Modifier Labels** — the numeric experimental-effect modifiers and their material
  costs, which coriolis-data does not carry, plus the attribute-to-journal-Label
  mapping, from [EDSY](https://github.com/taleden/EDSY) (`eddb.js`) by **taleden**,
  whose code is licensed **CC BY-NC 4.0**.
- **Which blueprints and experimental effects each module can take** — the module-group
  menus in `data/ships/engineering-options.jsonc`: which modules form a group, the
  blueprint and experimental-effect lists each group offers, and the per-module
  `noblueprints` / `noexpeffects` denials that narrow them, from
  [EDSY](https://github.com/taleden/EDSY) (`eddb.js` `mtype[]` and `module[]`, taleden,
  **CC BY-NC 4.0**), cross-checked against and, for the families EDSY records under one
  generic recipe id, keyed by
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data)
  `modifications/modules.json` (**MIT** for its code; the values are game data). The
  per-group `aliases` in `engineering-options.jsonc` — the journal `BlueprintName`s a menu
  answers to under another id, which the three utility-scanner groups need because the game
  writes `Sensor_LongRange` and `Sensor_WideAngle` for two different recipes — rest on a
  second EDSY file, **`edsy.js`**: its `Build.fromJournal` resolves a journal blueprint name
  through a per-module-type map, read alongside `eddb.js`'s own two rows sharing that
  fdname. Same author and **CC BY-NC 4.0** terms. The availability rules are **Elite
  Dangerous game data, property of Frontier Developments plc**; see the notice below.
  `data/ships/SOURCES.md` records the group-by-group derivation, the two registries'
  disagreements, the acquisition digests, and the modules bound by a family rule rather
  than a source row.
- **Per-hull journal slot names** — the slot keys 10 hulls use that no numbering rule
  derives (the Anaconda's `Slot13_Size2`, the Type-9 Heavy's `Slot00_Size8`, the Caspian
  Explorer's out-of-order medium hardpoints), plus 3 more the rules do derive — the
  Panther Clipper Mk II, the Type-11 Prospector and the Lynx Highliner — pinned so the
  stored table matches its source one for one. Stored as a `name` on the mount itself, from [EDSY](https://github.com/taleden/EDSY)
  (`eddb.js` `ship[…].slotnames`, taleden, **CC BY-NC 4.0**), the only registry that
  models them — coriolis-data does not carry journal slot names at all. The names
  themselves are **Elite Dangerous game data, property of Frontier Developments plc**;
  see the notice below.
- **Module mass, integrity, power draw and boot time** — the per-module figures
  backfilled onto the records coriolis-data leaves blank, and the corrections applied
  where coriolis-data's value is a duplicated or mis-copied row, come from
  [EDSY](https://github.com/taleden/EDSY) (`eddb.js`, taleden, **CC BY-NC 4.0**), which
  carries them for nearly every outfitting module. The remainder — the size-8 frame
  shift drives and the `*_free` starter fittings, which no third-party registry lists —
  were read from the live game's own outfitting panels. Either way the values are
  **Elite Dangerous game data, property of Frontier Developments plc**; see the notice
  below. `data/ships/SOURCES.md` has the record-by-record derivation, the per-field
  coverage split, and the three candidate corrections that cross-checking **rejected**.
  Where neither registry nor panel yielded a figure, the module record says so itself,
  in its `unknownStats` field. That classification is this repository's own
  reconciliation work — no third-party figure is reproduced by it.
- **The base stats engineering blueprints modify** — thruster and frame shift drive heat
  rates, fuel scoop rate, the shield cell bank stats (reinforcement, heat, spin-up,
  duration), scanner range, scan angle and scan time on both the sensor suites and the
  utility scanners, the Detailed Surface Scanner's probe radius, and the FSD
  interdictor's facing limit and range — plus the two Seismic Charge Launcher reload
  times coriolis-data leaves blank — from
  [EDSY](https://github.com/taleden/EDSY) (`eddb.js`, taleden, **CC BY-NC 4.0**), which
  is the only one of the two registries that carries them — coriolis-data names several
  of these stats in `modifications/modifierActions.json` without holding a value for
  them. Cross-checked against
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) (commit `0db9234`)
  wherever it does. The values are **Elite Dangerous game data, property of Frontier
  Developments plc**; see the notice below. `data/ships/SOURCES.md` records the
  field-by-field joins, the units each source uses, and the handful of figures derived
  from a family rule rather than read from a registry.

- **Ground-truth ship builds (test fixtures, not shipped)** — five real builds used to
  check the loadout maths against something other than itself.
  `fixtures/ships/slef-the-deep-black.json` is a real
  [EDSY](https://edsy.org/) export (taleden, **CC BY-NC 4.0**).
  `fixtures/ships/journal-krait-phantom.json` is a real Frontier journal `Loadout`
  event, obtained from
  [adam-drewery/EliteAssist](https://github.com/adam-drewery/EliteAssist)
  (`src/example_data/loadout.json`, **WTFPL**).
  `fixtures/ships/slef-inara-type-11.json`, `slef-inara-lynx-highliner.json` and
  `slef-inara-panther-mkii.json` are real [Inara](https://inara.cz/) SLEF exports,
  contributed by the repository owner from their own commander's fleet; the latter two
  are what a restricted mount's rules are checked against, and their headers keep only
  the producing app and version.
  All five are Elite Dangerous game output and remain the property of Frontier
  Developments plc — see the notice below. None is bundled into the published package.

- **Community build corpus (test fixtures, not shipped)** — `fixtures/ships/builds/`
  holds 181 ship builds published by Elite Dangerous players as
  [Coriolis](https://coriolis.io/) (`s.orbis.zone`) and [EDSY](https://edsy.org/) share
  links, decoded to Frontier slot keys and module symbols. A loadout is a list of which
  parts go in which slots — Elite Dangerous game data, the property of **Frontier
  Developments plc** (see the notice below), assembled by a player. Individual builds
  are stored without their author, name or link; see `data/ships/SOURCES.md` for the
  acquisition record and what that choice costs. Decoding the two link formats used
  each tool's own published serialisation and id tables —
  [EDCD/coriolis](https://github.com/EDCD/coriolis) and
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) (**MIT**, code) and EDSY's
  `eddb.js` (taleden, **CC BY-NC 4.0**) — all already credited above; no code from any of
  them is vendored here. Not bundled into the published package.

## Elite Dangerous game data (Frontier media-usage notice)

The ship and module stat values are the property of **Frontier Developments plc**
and are used under Frontier's
[media-usage rules](https://forums.frontier.co.uk/threads/elite-dangerous-media-usage-rules.510879/):

> Elite Dangerous Almanac was created using assets and imagery from Elite
> Dangerous, with the permission of Frontier Developments plc, for non-commercial
> purposes. It is not endorsed by nor reflects the views or opinions of Frontier
> Developments and no employee of Frontier Developments was involved in the making
> of it.

Projects that redistribute this data should include the same notice.

## Per-file provenance

Detailed derivation notes, upstream revisions, manual corrections and known gaps
live with the data, in
[`data/astro/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md),
[`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md),
[`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md)
and
[`data/commodities/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/commodities/SOURCES.md).
[`data/SNAPSHOTS.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/SNAPSHOTS.md)
records the snapshot date and the metadata every update must carry. Those files
live in the repository only — this file is also published inside the npm package
as `THIRD_PARTY_NOTICES.md`, where they are not present, so the links are absolute.

If you add or change data, port an algorithm, or add a dependency that warrants
credit, update the in-source attribution and this file in the same change.

---

## EDTS license (procedural naming)

The procedural sector- and system-naming algorithm and its region tables derive
from EDTS by Andy Martin (<https://bitbucket.org/Esvandiary/edts>), whose full
license is reproduced here as required by its terms:

```
Copyright (c) 2016, Andy Martin
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the EDTS Project nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE EDTS PROJECT OR ANDY MARTIN BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
