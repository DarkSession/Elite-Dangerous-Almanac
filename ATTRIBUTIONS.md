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
- **Engineered ammunition rounding** — a computed clip is rounded up to a whole
  multiple of the burst size. Ported as fact (our own implementation) from
  [EDSY](https://github.com/taleden/EDSY) by **taleden**
  (**CC BY-NC 4.0**), `edsy.js` — "when modifying clip size, round up to a multiple
  of burst size" — cross-checked against
  [EDCD/Coriolis](https://github.com/EDCD/coriolis) by the **Coriolis contributors**
  (**MIT**), `src/app/shipyard/Module.js` commit `68c042ca`, whose `getClip` rounds
  the clip up without the burst step. Both registries leave the reserve fractional;
  Frontier journal captures credited under Ground-truth ship builds establish the
  library's nearest-whole-round treatment. `data/ships/SOURCES.md` records the
  evidence and the legacy-engineering exception among the captures.
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
  FDevIDs states no explicit licence; consult the repository terms. Thargoid
  caustic/Titan materials absent from the pinned source are supplemented from
  [INARA](https://inara.cz/elite/components/) and keyed by their journal symbols.
- **Odyssey micro resources** — on-foot component, data, consumable and item
  names, symbols and categories, from
  [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`microresources.csv`), which
  states no explicit licence; consult the repository terms.
- **Ships and outfitting modules** — hull and module names, Frontier ids, symbols,
  sizes, ratings, mounts and entitlement tokens, from
  [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) (`shipyard.csv`,
  `outfitting.csv`), which states no explicit licence; consult the repository
  terms. The six bundle-granted Mk I/Mk II Vessel Hangar variants absent from that
  snapshot are corroborated by the
  [Odyssey Materials Helper](https://github.com/jixxed/ed-odyssey-materials-helper)
  CAPI fixture (`application/src/test/resources/parser/capifc/test9.json`, commit
  `2c652a2349b754f1dde1a58b6daaac5a04e421a6`) published by **Jixxed** under the
  **MIT licence**. The response itself is factual Elite Dangerous game output; only
  the module identities, bundle flags and grant tokens are used.
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
  property of Frontier Developments plc** — see the Frontier notice below. Values and
  newer records missing there, including Anti-Guardian Zone Resistance's non-numeric
  `agzresist` capability shape, are supplemented from
  [EDSY](https://github.com/taleden/EDSY) (`eddb.js`) by **taleden**, whose code is
  **CC BY-NC 4.0**; `data/ships/SOURCES.md` pins the exact snapshots and field-level
  derivation.
- **In-game verification** — names, numeric values and engineering restrictions were
  checked directly in Elite Dangerous. This includes the fact that stock Guardian
  weapons accept only Anti-Guardian Zone Resistance while pre-engineered Guardian
  weapons are final and accept no further engineering. These are **Elite Dangerous game
  data, property of Frontier Developments plc**; observation dates, field-level coverage,
  corrections and unresolved fields are in `data/ships/SOURCES.md`.
- **Experimental (special) effect modifiers, damage-type conversions, their material
  recipes, and journal Modifier Labels** — the numeric experimental-effect modifiers,
  fixed converted damage splits and material costs, which coriolis-data does not carry
  in one complete record, plus the attribute-to-journal-Label mapping, from
  [EDSY](https://github.com/taleden/EDSY) (`eddb.js`) by **taleden**, whose code is
  licensed **CC BY-NC 4.0**. High Yield Shell's split and nested journal labels are also
  checked against the Frontier `Loadout` capture described in `data/ships/SOURCES.md`.
- **Which blueprints and experimental effects each module can take** — the module-group
  menus in `data/ships/engineering-options.jsonc`: which modules form a group, the
  blueprint and experimental-effect lists each group offers, and the per-module
  `noblueprints` / `noexpeffects` denials that narrow them, from
  [EDSY](https://github.com/taleden/EDSY) (`eddb.js` `mtype[]` and `module[]`, taleden,
  **CC BY-NC 4.0**), cross-checked against and, for the families EDSY records under one
  generic recipe id, keyed by
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data)
  `modifications/modules.json` (**MIT** for its code; the values are game data). The
  availability rules are **Elite Dangerous game data, property of Frontier Developments
  plc**; see the notice below. `data/ships/SOURCES.md` records the group-by-group
  derivation, the two registries' disagreements, and the modules bound by a family rule
  rather than a source row.
- **The decorative modifications and the module they sit on** — the three
  `Decorative_*` festive transformations in `data/ships/decorative-modifications.jsonc`,
  and the medium turreted Remote Release Flak Launcher observed carrying them, from a
  `StoredModules` journal capture contributed by the repository owner from their own
  commander's storage (521 stored modules, **2026-08-07 UTC**), scrubbed of the commander,
  carrier and market it came from. Their festive naming and that the launchers were awarded
  already transformed are the same contributor's account rather than readings of the
  capture, which carries neither; the stored −99% `Damage` modifier is derived from three
  figures read off that contributor's own outfitting panel, as
  `data/ships/SOURCES.md` sets out. [EDSY](https://github.com/taleden/EDSY) (taleden,
  **CC BY-NC 4.0**) lists the same three transformations with no modifiers, which the
  damage cut shows to be an incomplete record. The capture is Elite Dangerous game output and
  the transformations are **Elite Dangerous game data, property of Frontier Developments
  plc**; see the notice below. The capture itself is not redistributed —
  `data/ships/SOURCES.md` → §Decorative modifications records what was read from it.
- **The journal spelling of the multi-cannon Overcharged blueprint** — the `journalName`
  on `MC_Overcharged` in `data/ships/blueprints.jsonc`, and the ordinary multi-cannon menu
  listing that key rather than `Weapon_Overcharged`, from
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) (**MIT** for its code; the
  values are game data): `modifications/blueprints.json` gives both keys the fdname
  `Weapon_Overcharged`, and `modifications/modules.json` lists the multi-cannon key on the
  `mc` and `advmc` groups alone. The anti-xeno multi-cannon menu lists it on
  [EDSY](https://github.com/taleden/EDSY)'s authority instead (`eddb.js`, taleden,
  **CC BY-NC 4.0**), whose single Overcharged carries the clip penalty on every group
  offering it — coriolis-data carries no blueprint list for an anti-xeno group, so that row
  is credited to neither registry alone. coriolis-data's acquisition date and digest are in
  `data/ships/SOURCES.md` → §Engineering options, "Multi-cannon Overcharged"; EDSY's are in
  the source table at the head of that file.
- **That Overcharged's clip penalty stops at the multi-cannon** — recorded in
  `data/ships/SOURCES.md` rather than in a payload: the reason the 26 clip-bearing
  cannons, fragment cannons and plasma accelerators offered `Weapon_Overcharged` fold no
  `AmmoClipSize` leg, where [EDSY](https://github.com/taleden/EDSY) `eddb.js` (taleden,
  **CC BY-NC 4.0**) carries one for every weapon. Settled on all three groups by Frontier
  journal captures (each credited under Ground-truth ship builds below):
  `fixtures/ships/journal-federation-corvette.json`, whose grade-5 cannon reports the
  recipe's other legs and no clip,
  `fixtures/ships/journal-federation-corvette-plasma.json`, whose grade-4 fragment cannon
  does the same, and `fixtures/ships/journal-caspian-explorer.json`, whose grade-1 plasma
  accelerator does the same at full quality. The same reading is carried by
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) and by
  [msarilar/EDEngineer](https://github.com/msarilar/EDEngineer)
  `EDEngineer/Resources/Data/blueprints.json` (**MIT** for its code; the values are game
  data), which keys a recipe on weapon type, blueprint and grade rather than on a recipe
  id and gives the clip leg to the multi-cannon alone. EDEngineer's acquisition date and
  digest are in `data/ships/SOURCES.md` → §Upstream snapshots.
- **The turreted heat sink launcher's reserve ammo** — the `ammoMaximum` of 2 on
  `Hpt_HeatSinkLauncher_Turret_Tiny` in `data/ships/modules-utility.jsonc`, a field the
  in-game verification pass does not reach. From a Frontier journal capture,
  `fixtures/ships/journal-lynx-highliner.json` (credited under Ground-truth ship builds
  below), whose grade-1 Heat Sink Capacity roll states the base beside the modified
  figure. [EDSY](https://github.com/taleden/EDSY) `eddb.js` (taleden, **CC BY-NC 4.0**)
  reads the same, against [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data)'s 3
  (**MIT** for its code; the values are game data).
- **The medium fixed Guardian Shard Cannon's projectile speed** — the
  `shotSpeed` of 1133.333374 m/s on `Hpt_Guardian_ShardCannon_Fixed_Medium` and the
  6299.209 m/s overwrite on its tech-broker Modified variant. From Frontier's own
  `OriginalValue` and engineered `Value` in
  `fixtures/ships/journal-anaconda-slapaconda.json` (credited under Ground-truth ship
  builds below), replacing the registry-derived 1133 and 3568.6 m/s figures.
- **The journal spelling of the two scanner blueprints** — the `journalName` on
  `Scanner_LongRange` and `Scanner_WideAngle` in `data/ships/blueprints.jsonc`, recording
  that the game writes both as `Sensor_LongRange` / `Sensor_WideAngle` even though those
  ids also name the sensor suites' different recipes. From a second
  [EDSY](https://github.com/taleden/EDSY) file, **`edsy.js`** (taleden, **CC BY-NC 4.0**):
  its `Build.fromJournal` resolves a journal blueprint name through a per-module-type map,
  read alongside `eddb.js`'s own two rows sharing that fdname. Acquisition date and digest
  in `data/ships/SOURCES.md`.
- **The Operations Merc-Coin blueprints and shop rows** — which module family each of the
  four grade-1–5 Merc-Coin blueprints applies to (fuel scoop Scoop rate enhanced, and the
  pulse/burst/beam laser Plasma conversions), the Plasma conversions' player-facing
  Thermal / Plasma damage-share modifiers, and the large Seeker Missile Rack's Lockdown
  variant with its 900 MC price. From the [Inara](https://inara.cz/) blueprint and
  outfitting registries, the same source the rest of the Operations records come from;
  the live Plasma conversion pages were acquired directly **2026-08-09 UTC** and expose no
  immutable revision. Frontier's
  [Operations update notes](https://forums.frontier.co.uk/threads/648012/) independently
  classify Thermal Plasma Conversion under **Blueprints**; the page was acquired
  **2026-08-09 UTC** and exposes no immutable revision. The catalogue maps their Plasma
  share to its `absolute` damage member, corroborated by EDSY's resistance-ignoring
  **Absolute Damage** member and a
  [contemporary community description](https://www.reddit.com/r/EliteDangerous/comments/1uk2zhp/plasma_laser_theorycrafting_following_new/)
  by **u/Techno3020** describing this conversion's Plasma share as absolute damage. That
  post states no redistribution licence and is linked only as corroboration; none of its
  text or media is redistributed. `data/ships/SOURCES.md` records the distinction between
  Inara's labels and the journal labels synthesized by the implementation. The values are
  **Elite Dangerous game data, property of Frontier Developments plc**; see the notice
  below.
- **How the Corrosion Resistant Cargo Racks are obtained** — not a stored value but the
  basis for two catalogue decisions: dropping the size-2 record as a variant that never
  released, and recording the size-5 and size-6 records as Community Goal rewards whose
  missing `cost` is the absence of a list price rather than an unfound one. From the
  [Elite Dangerous Wiki](https://elite-dangerous.fandom.com/wiki/Corrosion_Resistant_Cargo_Rack)
  (Fandom, **CC BY-SA 3.0**), alongside Frontier Developments' own announcement of the
  Rhea Disaster Community Goal
  ([@EliteDangerous](https://x.com/EliteDangerous/status/1812792503776489745), with the
  goal itself on the [Frontier
  forums](https://forums.frontier.co.uk/threads/deliver-critical-aid-for-the-rhea-disaster.626528/)).
  Both read **2026-08-06 UTC**; neither is pinned to a revision, and `data/ships/SOURCES.md`
  records why the wiki's could not be captured. The availability facts are **Elite
  Dangerous game data, property of Frontier Developments plc**; see the notice below.
  `data/ships/SOURCES.md` records what each source states and the capture whose reported
  `Value` was checked and rejected.
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
  were observed in-game. In-game verification covers all
  module identities and the numeric values on 952 non-armour modules, including the exact
  corrections to structural, shield, reinforcement, shield-cell, scoop and weapon fields,
  including exact damage components and projectile boundary parameters.
  In every case the values are
  **Elite Dangerous game data, property of Frontier Developments plc**; see the notice
  below. `data/ships/SOURCES.md` has the per-field coverage split and the fields that
  remain unavailable or semantically unclassified after in-game verification.
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

- **Ground-truth ship builds (test fixtures, not shipped)** — nineteen real builds that
  check the loadout maths against external captures.
  `fixtures/ships/slef-the-deep-black.json` is a real
  [EDSY](https://edsy.org/) export (taleden, **CC BY-NC 4.0**).
  `fixtures/ships/journal-krait-phantom.json` is a real Frontier journal `Loadout`
  event, obtained from
  [adam-drewery/EliteAssist](https://github.com/adam-drewery/EliteAssist)
  (`src/example_data/loadout.json`, **WTFPL**).
  `fixtures/ships/journal-viper-mkiv.json` is a real Frontier journal `Loadout` event
  for an unengineered ship, obtained from
  [UFO-Studios/EDDP](https://github.com/UFO-Studios/EDDP) (`exampleLogs.json`, a captured
  journal log the project ships as example data). That repository's own code is under the
  **UFO Licence 1.0**, which permits use with credit but not redistribution of the
  project; the licence covers UFO Studios' project, not the Frontier journal line quoted
  from its example data, which travels under Frontier's media-usage terms below like every
  other build here. Credit to UFO Studios & AW2C Systems Ltd for capturing and publishing
  the log. No code from that project is used.
  `fixtures/ships/journal-python-mkii-antixeno.json`,
  `journal-python-mkii-spire-ops.json`, `journal-anaconda-slapaconda.json`,
  `journal-corsair.json`,
  `journal-federation-corvette.json`, `journal-federation-corvette-beams.json`,
  `journal-federation-corvette-multirole.json`, `journal-federation-corvette-mixed.json`,
  `journal-federation-corvette-plasma.json`, `journal-cobra-mkv.json`,
  `journal-kestrel-mkii.json`, `journal-lynx-highliner.json` and
  `journal-caspian-explorer.json` are real Frontier journal
  `Loadout` events contributed by the repository owner from their own fleet, with no
  upstream project to credit; the Corvette is what says Overcharged does not cut a
  cannon's clip, the plasma Corvette what says the same for a fragment cannon and the
  Caspian Explorer what says it for a plasma accelerator, the
  mixed Corvette settles that a rail gun's charge delay is excluded from Frontier's
  `RateOfFire`, and twelve of them — every one but the unengineered Python Mk II — together
  with the Krait Phantom capture and the EDSY export are what the module catalogue's base
  stats are checked against. The beam-heavy Corvette, Cobra Mk V, Kestrel Mk II, The Deep
  Black, Lynx Highliner, Panther Clipper Mk II, Corsair, Spire Ops and Slapaconda also
  have directly observed in-game statistics-panel readings for jump, power, speed, mass,
  shield and armour figures. The Cobra, Kestrel, Lynx, Panther, Corsair, Spire Ops and
  Slapaconda observations add combined-weapon output, while The Deep Black records the
  weaponless panel. The Panther
  observation is a later refit than its same-named SLEF capture, so the two are preserved
  separately. The Kestrel's separately observed name is recorded without rewriting the
  older unnamed capture. They are pinned in
  `fixtures/ships/build-metrics.json`. The Caspian Explorer is also the only capture of a
  scoop-rate roll, and is what says Frontier writes that stat as `FuelScoopRate` where
  the recipe says `RefuelRate`. The Lynx capture also supplies that hull's size-1
  `PlanetaryApproachSuite` mount by fitting the advanced suite there.
  `fixtures/ships/slef-inara-type-11.json`, `slef-inara-lynx-highliner.json`,
  `slef-inara-panther-mkii.json` and `slef-inara-cutter-antixeno.json` are real
  [Inara](https://inara.cz/) SLEF exports, contributed by the repository owner from their
  own commander's fleet. The Lynx Highliner and the Panther Clipper Mk II are what a
  restricted mount's rules are checked against, and the Cutter is what the omitted-price
  rule is checked against. Their headers keep only the producing app and version.
  All twenty are Elite Dangerous game output and remain the property of Frontier
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
