# Data sources — `data/ships/`

## Upstream snapshots this domain is pinned to

Referred to throughout by source name; the pin is here, once.

| Source                                                                                          | Pin                                                                                                                                                                         | Acquired       |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| EDCD FDevIDs — `shipyard.csv`, `outfitting.csv`                                                 | no immutable revision recorded                                                                                                                                              | 2026-07-24 UTC |
| EDCD/coriolis-data — `ships/*.json`, `modules/**`, `modifications/*`                            | commit `0db9234b5b9ce8c939ea84133d7ce336eea88e27`                                                                                                                           | 2026-07-24 UTC |
| coriolis-data `modifications/modules.json`                                                      | SHA-256 `09b6427c86bc3cfb578a246f7c6be1791429bb67009b7adaa7909e30aadc160f` — read from the branch tip, so pinned by digest                                                  | 2026-08-05 UTC |
| EDSY `eddb.js`                                                                                  | commit `cd68edfba665719958ce038b6e5d9eb02d0d2b02`, SHA-256 `967834d65a75ab1dea4bbaa7e1d6674cbe4083dca03f770d058497e9f7693071`, internal `db 20260428` / `version 423039901` | 2026-08-02 UTC |
| EDSY `eddb.js` — Vessel Hangar variants                                                         | commit `510468167e0ef3b895e39391a8c56b5cdd5c3282`, SHA-256 `0574db06f796cdf7dfbe20a5f89f8a378e692873ae49133e9b49557fe8d8cba3`                                               | 2026-08-09 UTC |
| EDSY `edsy.js`                                                                                  | SHA-256 `a40e9bbe65d482a029527d6dc2abdbd1819672e5a5d4a3a4d88ea411f02575f5` — read from the branch tip, so pinned by digest                                                  | 2026-08-06 UTC |
| Odyssey Materials Helper CAPI fixture `application/src/test/resources/parser/capifc/test9.json` | commit `2c652a2349b754f1dde1a58b6daaac5a04e421a6`                                                                                                                           | 2026-08-09 UTC |
| EDCD/Coriolis — the application, for its formulas                                               | commit `68c042ca6e3db62372cbbb2077cf972345511712`                                                                                                                           | 2026-08-01 UTC |
| msarilar/EDEngineer `EDEngineer/Resources/Data/blueprints.json`                                 | SHA-256 `787e6bd0579264d7b4615a281318792cb212285786f4ae07f61ec1cc464cdec0` — read from the branch tip, so pinned by digest                                                  | 2026-08-08 UTC |
| Elite Dangerous in-game verification                                                            | game version `4.4.0.3`; direct in-game observation                                                                                                                          | 2026-08-14 UTC |

Every `eddb.js` derivation uses the baseline snapshot unless its catalogue note names
the Vessel Hangar snapshot.

**Some values come from no registry at all** — readings taken from the live game's own
outfitting, module and engineering panels, and captures contributed by the repository
owner from their own fleet. Each is named where it is used because it cannot be
re-derived from a public source.

## Ships

Each hull is **one record** carrying its identity, its stats, and its slot layout —
identity from FDevIDs, stats and slots from coriolis-data, joined on `symbol`.

- **File:** `ships.jsonc` (48 player-flyable hulls).
- **Identity source:** FDevIDs `shipyard.csv`, columns `id,symbol,name,entitlement`.
- **Identity derivation:** records are carried over in shipyard order (roughly the
  order hulls were introduced): internal `symbol` and display `name`. The CSV's
  numeric ship-type `id` column is dropped — hulls are keyed by `symbol`.
  `entitlement` is FDevIDs' DLC/grant token, kept only where the CSV gives one (28 of
  the 48 hulls carry no entitlement, so the field is omitted rather than stored empty).
- **Stats + slots source:** coriolis-data `ships/*.json` — `properties` for manufacturer,
  numeric size class and stats,
  `slots` + `bulkheads` for the layout.
- **Manufacturer and size derivation:** `properties.manufacturer` is copied, with
  coriolis-data's abbreviated `Lakon` normalized to the shipyard name `Lakon Spaceways`;
  numeric `properties.class` maps `1`/`2`/`3` to `small`/`medium`/`large`, the game's
  landing-pad classes. The Lynx Highliner instead takes Zorgon Peterson and class 2
  (`medium`) from Frontier's update notes and EDSY's `class:2` record.
- **Stats derivation:** acquisition normalization looks up each hull's coriolis
  record by display name (normalized; coriolis "Viper" ⇒ registry "Viper MkIII") and
  copies a fixed whitelist of `properties` fields (`hullMass`, source `speed` as
  `maximumSpeed`, `boost`, `baseArmour`, …). The repository's
  `scripts/data/ships/merge-normalized-catalogues.mjs` then performs the deterministic
  symbol join, preserving registry order and rejecting duplicate or unmatched input.
  Masses are tonnes, speeds m/s, rotation rates deg/s. The in-game hull audit below
  overrides registry values where they disagree.
- **Speed is stored as installed endpoints.** An Elite Dangerous `4.4.0.3` hull audit
  recorded 2026-08-14 UTC supplies `minimumSpeed` and `maximumSpeed` directly for all 48
  hulls.
  The game's ratio values carry no independent information:
  `minThrust = 100 * minimumSpeed / maximumSpeed` and
  `pipSpeed = (maximumSpeed - minimumSpeed) / (4 * maximumSpeed)`. The ratios are
  therefore not retained; reconstructing an endpoint from rounded ratios can disagree
  with the installed whole-number value (the Lynx's `73.75%` ratio produces
  `210.1875` m/s rather than its installed `210` m/s).
- **Angular rates are stored as zero- and four-ENG-PIP endpoints.** The same game audit
  supplies `minPitch`, `minRoll` and `minYaw` from each flight-default block. The
  selected full-rate words come from the hull overrides; an exact `-1.0` override
  sentinel selects the corresponding flight-default word. This structure holds for all
  48 player hulls. EDSY's public handling implementation independently identifies these
  minima as zero-ENG-PIP values and linearly interpolates each axis to its full rate.
- **Installed English display names are taken verbatim from the game.** The Elite
  Dangerous `4.4.0.3` localisation audit recorded 2026-08-14 UTC replaces eight compact
  registry spellings:

  | Symbol        | Registry name          | Stored game name        |
  | ------------- | ---------------------- | ----------------------- |
  | `Viper`       | `Viper MkIII`          | `Viper Mk III`          |
  | `CobraMkIII`  | `Cobra MkIII`          | `Cobra Mk III`          |
  | `Viper_MkIV`  | `Viper MkIV`           | `Viper Mk IV`           |
  | `CobraMkIV`   | `Cobra MkIV`           | `Cobra Mk IV`           |
  | `Krait_MkII`  | `Krait MkII`           | `Krait Mk II`           |
  | `Python_NX`   | `Python MkII`          | `Python Mk II`          |
  | `CobraMkV`    | `Cobra MkV`            | `Cobra Mk V`            |
  | `PantherMkII` | `Panther Clipper MkII` | `Panther Clipper Mk II` |

  The same display-name corrections are propagated to the matching armour-module
  `ship` foreign keys in `modules-core.jsonc`.

- **In-game hull-stat audit corrections.** Live game readings from Elite Dangerous
  `4.4.0.3`, recorded 2026-08-14 UTC, govern the following registry disagreements and
  omissions. Values are transcribed directly, subject only to the established numeric
  precision described above.

  | Field                 | Registry value → stored game value                                                                                                                                                                                                  |
  | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `baseShieldStrength`  | `Type7` 155→156                                                                                                                                                                                                                     |
  | `masslock`            | `Orca` 16→15; `Cutter` 27→26; `Viper_MkIV` 7→8; `Asp_Scout` 8→9; `Mandalay` 11→12; `PantherMkII` 27→25; `LakonMiner` 16→15; `Explorer_NX` 19→21; `SmallCombat01_NX` 10→11; `MediumTransport01` absent→16                            |
  | `reserveFuelCapacity` | `Mandalay` 0.52→0.5; `PantherMkII` 1.16→1.11; `LakonMiner` 0.77→0.6; `SmallCombat01_NX` 0.57→0.61                                                                                                                                   |
  | `heatCapacity`        | `Dolphin` 165→245; `Python_NX` 316→260; `Type8` 226→236; `Mandalay` 250→245; `Corsair` 230→280; `PantherMkII` 250→329; `LakonMiner` 289→300; `Explorer_NX` 250→341; `SmallCombat01_NX` 237→263; `MediumTransport01` absent→279      |
  | `heatDissipation`     | `Python_NX` 52→52.05; `Type8` 36.5→36.45; `CobraMkV` 40.5→40.63; `Corsair` 52→52.05; `PantherMkII` 62.5→62.45; `LakonMiner` 52.15→52.05; `Explorer_NX` 72.1→71.93; `SmallCombat01_NX` 39.85→37.93; `MediumTransport01` absent→49.35 |
  | `maximumSpeed`        | `Type9_Military` 179→180; `TypeX_3` 204→200; `CobraMkV` 291→290; `PantherMkII` 181→180; `LakonMiner` 272→270; `SmallCombat01_NX` 271→270                                                                                            |
  | `boost`               | `Type9_Military` 219→220; `CobraMkV` 412→410; `LakonMiner` 367→365                                                                                                                                                                  |
  | `pitch`               | `Type9_Military` 20→22; `Krait_MkII` 26→31; `TypeX` 39→38; `TypeX_3` 32→35; `Krait_Light` 26→31; `Mamba` 27→30; `Python_NX` 37.72→37; `CobraMkV` 45.61→45; `SmallCombat01_NX` 51.4→50                                               |
  | `roll`                | `Type9_Military` 20→40; `TypeX` 92→90; `Mamba` 80→75; `Python_NX` 92.76→91; `CobraMkV` 121.62→120; `SmallCombat01_NX` 123.36→120                                                                                                    |
  | `yaw`                 | `Python_NX` 12.74→12.5; `CobraMkV` 33.45→33; `SmallCombat01_NX` 24.67→24                                                                                                                                                            |

- **`heatDissipation` is the hull's audited maximum cooling rate.** Coriolis-data carries no
  dissipation figure at all, and the game shows a player none: it is a community
  measurement of Frontier's game rather than a stat the game displays. The baseline is
  EDSY `eddb.js` `ship[…].heatdismax` from the pinned snapshot, joined by
  case-insensitive `fdname` / `symbol`. A complete maintainer-supplied thermal audit
  from Elite Dangerous `4.4.0.3`, recorded 2026-08-14 UTC, governs all 48 values and
  supplies the nine corrections and omissions listed above. The other 39 values agree
  with EDSY exactly.
  Each value is the load in thermal-load units per second shed at heat level 1. The
  stored catalogue range is Hauler `16.2` through Cutter `72.58`.

- **Slots derivation:** coriolis's fixed-order `slots.standard` seven-array becomes
  the seven named `core` sizes (power plant, thrusters, frame shift drive, life
  support, power distributor, sensors, fuel tank); `slots.hardpoints` splits into
  `hardpoints` (the non-zero weapon mounts) and `utility` (the count of zero
  entries); `slots.internal` becomes `optional`. Both `hardpoints` and `optional` are
  arrays of `{ size, restriction?, name? }` — the two fields below. Coriolis's per-hull
  `bulkheads` are **not** kept on the hull: they are joined onto that hull's armour
  modules instead (see "Modules"), because armour is a module and the catalogue keeps a
  module's stats with the module. Slot keys follow the journal vocabulary
  (`FrameShiftDrive`, `HugeHardpoint1`, `TinyHardpoint2`, `Slot01_Size6`, `Military01`,
  `PlanetaryApproachSuite`).

### Gunsights

- **File:** `gunsights.jsonc` (48 player-flyable hulls, 234 weapon hardpoints).
- **Source:** in-game gunsight observations from the in-game verification snapshot
  pinned above.
- **Derivation:** each observation is joined to `ships.jsonc` by case-insensitive hull
  symbol. Its hardpoints are joined by exact journal slot key to the hardpoints returned
  by `enumerateSlots`, then written in the existing `Ship.hardpoints` order. One observed
  identity absent from the player-flyable hull catalogue is discarded.
- **Fields retained:** only the camera-relative horizontal and vertical offsets, in
  metres, as `[horizontalOffsetMetres, verticalOffsetMetres]`. Every observed fixed-weapon
  direction coefficient is exactly zero, so those coefficients carry no information and
  are omitted. Hull identity is already the map key; display names, slot keys and
  hardpoint counts are recoverable from `ships.jsonc`; all other acquisition and
  presentation metadata is unnecessary for projection and is dropped.
- **Precision:** offsets remain at their observed numeric precision. Exact zero and tiny
  near-zero values both describe centerline mounts; the residuals are numeric precision,
  not meaningful sub-millimetre displacements to interpret or normalize.
- **Manual corrections:** none. All 48 hulls and all 234 of their hardpoint slot keys join
  one-to-one without correction.

### Default loadouts

- **File:** `default-loadouts.jsonc` (48 hulls, 831 fitted modules).
- **Primary source:** EDSY `eddb.js` `ship[*].stock`, from the baseline pinned snapshot.
  It carries all 48 current hulls, including the Lynx Highliner absent from the pinned
  coriolis-data revision, and distinguishes current stock modules such as SCO frame
  shift drives, Supercruise Assist and Advanced Docking Computer.
- **Derivation:** the source ship is joined to `ships.jsonc` by case-insensitive Frontier
  `fdname` / `symbol`. EDSY's `hardpoint`, `utility`, `component`, `military` and
  `internal` stock arrays are walked against the stored hull layout in their published
  order. Numeric module ids resolve first through a ship's own `module` overrides and
  then through EDSY's global module table; the resulting Frontier `fdname` becomes the
  stored module `symbol`. Zero entries are empty optional, hardpoint or utility mounts
  and are omitted. The output stores the layout's canonical journal slot key, not the
  source array position. All 831 fitted symbols and mounts resolve against the checked-in
  ship and module catalogues and pass the same compatibility rules as `ShipLoadout`.
- **Planetary approach suite:** EDSY treats the approach suite as a built-in outside its
  stock arrays. `int_planetapproachsuite_advanced` is added to every hull's dedicated
  `PlanetaryApproachSuite` mount. Coriolis-data stores id `4F` (the advanced suite) on 46
  of its 47 hulls; the Python Mk II is its lone empty entry. Captured Frontier loadouts
  independently show the advanced suite on the Python Mk II and on every other captured
  hull, including the Lynx Highliner.
- **Cargo hatch:** the built-in hatch is added to every hull after the EDSY arrays. EDSY
  exports `ModularCargoBayDoorFDL` for the Fer-de-Lance family; captured Frontier Lynx
  Highliner loadouts show the same symbol, so those two hulls carry it and every other
  hull carries `ModularCargoBayDoor`. The hull-specific variant resolves through the
  standard hatch's known stats in `ShipLoadout`.
- **Source disagreement:** coriolis-data's `defaults` arrays are not used as the primary
  source. They stop at 47 hulls, omit several current stock assists, and predate some SCO
  stock fits. They corroborate the older core, weapon and internal identities where both
  sources cover the same ship.

### `restriction` — a mount that takes one family of modules

Seven values: `mining` on a hardpoint, and `military`, `planetaryApproachSuite`,
`cargo`, `limpetController`, `vesselHangar` or `passenger` on an optional. Those seven
are the complete set the game has, not a subset these layouts happen to reach: there
are no mount-type restrictions on hardpoints (fixed/gimballed/turret) and no restricted
utility mounts, so neither has a value here and neither is a gap.

**Both registries carry the rule, and they agree mount-for-mount.**

- **coriolis-data** writes a restricted mount as an object rather than a bare size:
  `ships/type_11_prospector.json` has `{ "class": 3, "name": "Mining", "eligible": {
"abl": 1, "ml": 1, "mvr": 1, "pwa": 1, "scl": 1, "sdm": 1 } }` for the large mount and
  `{ "class": 5, "name": "Limpets", … }` / `{ "class": 5, "name": "Fighter", "eligible":
{ "fh": 1 } }` for two of its optionals, and `ships/panther_clipper.json` the same
  `"name": "Cargo"` object with `"eligible": { "cr": 1, "crl": 1, "ft": 1 }` on its
  first size-8 mount and on its first size-**7** — not on the two size-8s.
- **EDSY** `eddb.js` carries it as a per-slot `reserved` map — `{hmtl:1,hmtm:1}` on the
  Type-11's mounts 0, 1, 2 and 4, `{iclc,idlc,iftlc,ihblc,imlc,iplc,inlc,irlc,islc}` and
  `{ifh:1}` on its two restricted optionals, `{cft:1,icr:1}` on the Panther's two, and
  `{ipc:1}` on the Lynx Highliner's three cabin mounts.

They differ on exactly one entry: coriolis lists `pwa` (the Pulse Wave Analyser) as
eligible for a mining hardpoint. It is a **utility** fitting in both registries and in
this catalogue, and no utility module fits a hardpoint of any kind, so the difference is
a grouping artefact and is not stored. Coriolis's `sdm` group and EDSY's `hmtm` both
include the Sub-Surface Extraction Missile (`Hpt_Human_Extraction_Fixed_Medium`)
alongside the displacement missile it varies, so it counts as a mining tool despite its
unrelated symbol.

**`passenger` rests on a capture as well as on EDSY**, and needs to. `PASSENGER` is the
one restricted family absent from EDSY's journal import map and its `ipc` eligibility
check is commented out in `edsy.js`, so the reservation alone confirmed no journal
spelling. `fixtures/ships/slef-inara-lynx-highliner.jsonc` settles it: its `passenger01`,
`passenger02` and `passenger03` each hold an `int_mkii_passengercabin_*`, spelled
exactly as the stored names give them. The Lynx's `Slot02_Size5` follows the three cabin
mounts in the same capture.

### `name` — the journal's own key for a mount

Thirteen hulls carry explicit journal slot names from EDSY. Ten depart from the game's
regular numbering; the Panther Clipper Mk II, Type-11 Prospector and Lynx Highliner are
included because EDSY publishes their otherwise-regular names. Non-derivable names are
stored on the mount, for example `{ "size": 1, "name": "Slot14_Size1" }`.

**Source:** EDSY `eddb.js` `ship[…].slotnames`. These are **journal** names rather than
EDSY's own — `edsy.js` reads them in `Build.fromJournal()` and writes them in
`exportJournal()`. Only EDSY carries them; coriolis-data does not model journal slot
names at all, so the corroborating source has to be captures, and five are in hand —
four SLEF exports and one journal — covering four of the 13 hulls with names of their
own (below). One is a journal rather
than an export: `journal-lynx-highliner.jsonc` gives Frontier's own casing for a hull the
Inara export already covers in lower case, and one thing that export does not — its
`PlanetaryApproachSuite` mount. All 29 outfitting keys bind to the stored layout; its
seven cosmetic slots (`WeaponColour`, `Decal1`–`3`, `EngineColour`, `VesselVoice`,
`ShipCockpit`) are not outfitting mounts and remain outside the export-only sweep.

**Derivation.** EDSY keeps `military` mounts in a group of their own and does not model
the planetary approach suite; this catalogue keeps both inline in `optional`. The two
lists are therefore walked in parallel: every mount consumes the next EDSY name except a
`military` one (which takes `Military01`, `Military02`) and the `planetaryApproachSuite`
one. EDSY's `slots` sizes equal this catalogue's mount-for-mount, and its name list is
exactly consumed. This is a naming difference alone: no hull's layout, mount count or
size differs from coriolis's.

- **Anaconda** `…Slot10_Size4`, then **`Slot13_Size2`, `Slot14_Size1`** — no 11 or 12.
- **Type-9 Heavy** starts at **`Slot00_Size8`**, the only hull that does, then runs
  `Slot01`…`Slot08` and jumps to **`Slot11_Size2`, `Slot12_Size1`**.
- **Type-10 Defender** (`Type9_Military`) `Slot01`…`Slot08`, then the same
  **`Slot11`/`Slot12`** jump.
- **Federal Dropship** `…Slot06_Size3`, then **`Slot09_Size2`, `Slot10_Size1`**.
- **Vulture** `Slot01`, `Slot02`, `Slot03`, **`Slot05`**, `Slot06`, `Slot07`, `Slot08`.
- **Type-7 Transporter** uses the number **`09` twice** (`Slot09_Size2` and
  `Slot09_Size1` — distinct keys), and five of its ten suffixes misreport the size.
- **Keelback** `Slot03_Size3` on a size-**4** mount; **Asp Scout** `Slot01_Size4` on a
  size-**5** one.
- **Type-8 Transporter** _hardpoints_ `…SmallHardpoint2`, **`SmallHardpoint4`**,
  `SmallHardpoint5`, `SmallHardpoint6` — no `SmallHardpoint3`.
- **Caspian Explorer** _hardpoints_ `LargeHardpoint1`, **`MediumHardpoint6`**,
  **`MediumHardpoint5`**, `MediumHardpoint1`…`4` — out of order, not merely gapped, so
  the same key names a _different physical mount_ than position would suggest. Its
  optionals are **not** overridden: EDSY gives none, and the Caspian capture below
  confirms the plain numbering is right for them.
- **Lynx Highliner** `Slot01_Size6`, **`Passenger01`–`03`**, `Slot02_Size5`, …
- **Panther Clipper Mk II** and **Type-11 Prospector** are carried too, though the
  regular numbering derives their names. They are kept so the stored table matches EDSY's
  13 entries one for one.

**The `_SizeN` suffix is Frontier's, and on three hulls it is wrong.** The Keelback, Asp
Scout and Type-7 name mounts with a class the hull does not have there. That is the
game's own text, not a transcription slip: `edsy.js` compensates for exactly this when
importing, taking the greater of the name's size and the fitted module's class. This
catalogue stores the name verbatim and keeps the mount's real size in the `optional`
entry beside it.

**Two numbering rules for a restricted mount** are derived from EDSY's name lists:

- a restricted **hardpoint** shares the per-size-class numbering with the unrestricted
  ones and only takes an infix, so the Type-11's four medium mounts run
  `MediumMiningHardpoint1`, `MediumMiningHardpoint2`, `MediumHardpoint3`;
- a restricted **optional** takes a name and number of its own and does **not** consume
  a `SlotNN` number, exactly as `Military01` and `PlanetaryApproachSuite` do — so the
  Panther's column runs `Cargo01`, `Slot01_Size8`, `Cargo02`, `Slot02_Size7`, …

EDSY's journal import map lists `HUGEMININGHARDPOINT`, `LARGEMININGHARDPOINT`,
`MEDIUMMININGHARDPOINT`, `SMALLMININGHARDPOINT`, `CARGO`, `LIMPETCONTROLLER` and
`FIGHTERBAY` as slot-name prefixes it must recognise, which is the other half of the
evidence that these are the game's strings.

**Checked against real captures.** Five exports were compared key by key against the
hull's enumerated layout: `slef-the-deep-black.jsonc` (Caspian
Explorer), `slef-inara-type-11.jsonc`, `slef-inara-lynx-highliner.jsonc`,
`slef-inara-panther-mkii.jsonc` and `slef-inara-cutter-antixeno.jsonc`. The Caspian
capture is the load-bearing one: its internals read `Slot01_Size7`…`Slot10_Size3`,
`Slot13_Size1`, `Slot14_Size1`, all of which the plain numbering produces — evidence for
leaving that hull's optionals alone rather than assuming EDSY omitted them. The Lynx
journal also supplies 29 outfitting keys, including its approach suite; its cosmetic
slots are outside the hull layout.

### Per-hull source exceptions

- **Type-11 Prospector — eight hardpoints, not four.** The acquired record read
  `hardpoints: [2, 1, 1, 1]`. Coriolis writes a _restricted_ hardpoint as an object
  rather than a bare size and the Type-11 is the only hull in coriolis-data that has
  any, so acquisition's "non-zero numbers are weapon mounts" rule silently dropped its
  3/2/2/1 mining mounts — leaving the game's dedicated mining hull with nowhere to fit a
  mining tool, and no large mount at all for `Hpt_MiningToolV2_Fixed_Large`, which is
  itself `restrictedToShips: ["LakonMiner"]` and so unfittable on the only hull that may
  carry it. Stored as `[3, 2, 2, 2, 1, 1, 1, 1]`, which three sources agree on:
  coriolis-data, EDSY `eddb.js` (`ship[…].slots.hardpoint = [3,2,2,2,1,1,1,1]`) and
  Inara's ship page 68, read 2026-08-02 UTC, listing
  1 Large Mining, 1 Medium, 2 Medium Mining, 3 Small and 1 Small Mining. The four
  unrestricted mounts are exactly the `[2, 1, 1, 1]` the record already had.
- **Lynx Highliner (`MediumTransport01`) — from EDSY, Frontier's Lynx update notes,
  a Frontier journal capture and in-game verification:**
  the Lynx has no coriolis hull entry, so its stats and slot layout are sourced instead
  from EDSY's ship data and Frontier's Lynx update notes (hull mass 260 t, 285/350 m/s,
  200/350 base shield/armour, hardness 55, 2 crew, rotation 26/60/19 deg/s, min thrust
  73.75%; core PP5/thr6/FSD5/LS6/dist5/sen3/tank5; hardpoints 1 large + 4 medium;
  4 utilities; unrestricted/passenger optionals 6/6/6/5/5/4/4/3/2/1; its five armour
  options at 0/26/53/53/53 t, carried on the `MediumTransport01_Armour_*` module
  records). EDSY independently gives the 23 deg/s zero-ENG-PIP pitch rate. A maintainer's
  Elite Dangerous `4.4.0.3` game audit recorded 2026-08-14 UTC supplies `masslock: 16`,
  `heatCapacity: 279`, `heatDissipation: 49.35`, the installed `minimumSpeed: 210` /
  `maximumSpeed: 285` pair, and the complete angular endpoints `23/26` pitch, `60/60`
  roll and `19/19` yaw. Values the static catalogue does not expose are omitted rather
  than invented: acceleration and the boost-energy figures.
  Its two size-6 and one size-5 passenger mounts carry `"restriction": "passenger"` and
  the names `Passenger01`–`Passenger03`, sourced above. A final size-1
  `planetaryApproachSuite` mount named `PlanetaryApproachSuite` comes directly from
  `fixtures/ships/journal-lynx-highliner.jsonc`, which fits
  `int_planetapproachsuite_advanced` there; that capture carries its own provenance in
  its file header.

## Modules (outfitting)

Each module is **one record** carrying its identity and its stats — identity from
FDevIDs, stats from coriolis-data and EDSY, joined on `symbol`.

- **Files:** `modules-core.jsonc`, `modules-internal.jsonc`,
  `modules-hardpoint.jsonc`, `modules-utility.jsonc`, split along FDevIDs' four
  outfitting categories.
- **Identity source:** FDevIDs `outfitting.csv`, columns
  `id,symbol,category,name,mount,guidance,ship,class,rating,entitlement`, supplemented
  for the six bundle-granted Vessel Hangars by the pinned CAPI response below.
- **Identity derivation:** the acquired FDevIDs module records are kept in CSV order
  within each category file. The catalogue contains 484 internal records and **1199**
  records across all four categories. The CSV's numeric `id`
  column is dropped — modules are keyed by `symbol` — and rows marked `removed` are
  excluded because they are not current outfitting modules. `class` is FDevIDs' `class` — the
  module size (0–8) — and `rating` its grade letter (A–I); together they are the "5A"
  the outfitting screen shows. `mount` (Fixed / Gimballed / Turreted) and `guidance`
  (Dumbfire / Seeker / Swarm) are stored only on the hardpoints that carry them; `ship`
  names the hull an armour variant belongs to (armour is the one ship-specific module,
  so only the 241 armour records carry it); `entitlement` is kept only where it is a
  real DLC/grant token. `name` is FDevIDs' descriptive English label, including expanded
  forms such as Frame Shift Drive and Auto Field-Maintenance Unit.
- **The CSV's `category` column is not stored — the file states it.** It would be the
  same string on every record. The CSV's category determines which file receives each
  record.
- **`slot` — which fixed mount a module fills.** A category is not a mount: `core` is
  eight of them. Every record in `modules-core.jsonc` names its own mount — `armour`,
  or one of the seven core functions the ship records' `core` block is keyed by
  (`powerPlant`, `thrusters`, `frameShiftDrive`, `lifeSupport`, `powerDistributor`,
  `sensors`, `fuelTank`) — as do the fifteen Guardian Hybrid power plants and
  distributors in `modules-internal.jsonc`, which fill a core mount although FDevIDs
  files them as internal modules. No other record carries one: a weapon, a utility
  fitting or an ordinary optional internal fits any mount of its kind that is large
  enough, so there is no single mount to name.
  - **Derivation:** the value is the mount the module is sold for in the outfitting
    screen, assigned by symbol family — the 241 `*_Armour_*` records are `armour`, the
    `Int_PowerPlant_*`/`Int_GuardianPowerplant_*` are `powerPlant`, and so on through
    `Int_Engine_*` and `Int_MkIIAgileBoost_Engine_*` (`thrusters`), `Int_Hyperdrive_*`
    (`frameShiftDrive`), `Int_LifeSupport_*`, `Int_PowerDistributor_*`/
    `Int_GuardianPowerDistributor_*`, `Int_Sensors_*` and `Int_FuelTank_*`. Holding the
    classification also covers the odd ones out: the Guardian hybrids and the Python Mk
    II's `Int_MkIIAgileBoost_Engine_*` thrusters.
  - **A fuel tank is the one module built for two kinds of mount:** it is `fuelTank`
    and also fits any optional slot large enough, exactly as the game sells it.
- **`kind` is the ordinary engineering-menu family.** The 1005 records mapped by
  `engineering-options.jsonc` repeat that map's group key in the compact on-disk `kind`
  field. The remaining 194 records carry no `kind` because they have no ordinary
  engineering menu; this includes the five Enzyme/AX weapons, the fixed Mining Laser and
  Abrasion Blaster, and the 16 cargo racks documented under Engineering options below.
  The group source, derivation, split
  Guardian families and coverage are documented under Engineering options below; this
  field is a projection of that map, not a separate classification source.
- **Stats source:** coriolis-data `modules/**` for the mechanical, defence, power and
  weapon stats; EDSY `eddb.js` for mass, integrity, power draw, boot time and the
  engineering base stats coriolis does not carry; and in-game verification for the
  comprehensive audit and every game-settled correction below.
- **Stats derivation:** acquisition normalization looks up each module's coriolis
  record by `symbol` (case-insensitively) and copies a fixed whitelist of fields under
  clearer names — e.g. coriolis `optmass`→`optMass`, `fuelmul`→`fuelMul`,
  `pgen`→`powerCapacity`, `wepcap`→`weaponsCapacity`. The repository's
  `scripts/data/ships/merge-normalized-catalogues.mjs` performs the final checked
  symbol join. The stat fields are sparse (only the ones a module's group uses) and
  appended after the identity fields on the same record. Masses are tonnes, power
  megawatts, jump ranges light-years, weapon ranges metres.
- **Defence, power and weapon stats:** coriolis-data supplies the resistances
  (`kinres`/`thermres`/`explres`/`causres` →
  `kineticResistance`/`thermalResistance`/`explosiveResistance`/`causticResistance`),
  `hullreinforcement`→`hullReinforcement`, `shieldaddition`→`shieldAddition`,
  `protection`→`moduleProtection`, `passive`→`alwaysPowered`, and the weapon block
  (`damage`, `damagedist`→`damageDistribution` with the single-letter keys spelled out,
  `roundspershot`→`roundsPerShot`, `fireint`→`burstInterval`, `burst`→`burstRounds`,
  `burstrof`→`burstRateOfFire`, `charge`→`chargeTime`, `clip`→`clipSize`,
  `ammo`→`ammoMaximum`, `reload`→`reloadTime`, `distdraw`→`distributorDraw`,
  `thermload`→`thermalLoad`, `piercing`→`armourPiercing`, weapon/non-scanner utility
  `range`→`maximumRange`, scanner `range`→`scannerRange`, `falloff`→`falloffRange`,
  `shotspeed`→`shotSpeed`, `jitter`).
  EDSY's `agzresist` enum supplies `guardianZoneResistance: true` on
  `Hpt_ATVentDisruptorPylon_Fixed_Medium` and
  `Hpt_ATVentDisruptorPylon_Fixed_Large`, the two Guardian Nanite Torpedo Pylons and the
  only stock records whose value is `Active` in the pinned snapshot; the empty value on
  every other record remains an omitted sparse field.
  - **`rateOfFire` is derived, not copied.** Upstream stores the fire interval; the
    journal (and this catalogue) report the combined shots per second, so it is
    computed as `burst / ((burst − 1) / burstRateOfFire + fireInterval)`. Coriolis
    (`Module.getRoF`) and EDSY (`rof = fpc / spc`) also fold `chargeTime` into this
    figure, but Frontier does not: `journal-federation-corvette-mixed.jsonc` states
    `RateOfFire` base values of 1.587302 for the small rail gun and 1.204819 for the
    medium, exactly `1 / burstInterval` in both cases. Charge time is therefore kept as
    the delay before impact but excluded from the reported firing cadence.
    Continuous-fire weapons (beam and mining lasers) have no fire interval upstream and
    so carry no `rateOfFire`; their `damage`, `distributorDraw` and `thermalLoad` are
    already per second.
  - **`maximumRange`/`falloffRange` describe weapons and non-scanner utility
    effects.** A utility scanner's distance lives only in `scannerRange`; it is not
    also exposed as a weapon range. Upstream's `range` is metres for anything
    hardpoint-mounted but kilometres for sensors and its own units for limpet
    controllers, so a value is carried only under the field whose meaning and unit are
    unambiguous.
  - **Two upstream zeroes are dropped rather than copied:** `roundspershot: 0` on two
    Shock Cannon variants (Coriolis itself reads the field as `roundspershot || 1`; a
    zero would zero their DPS) and `burstrof: 0` on the Mining Volley Repeater, whose
    burst is a single shot.
  - **`shotSpeed` and `reloadTime` are absent on the weapons that have neither, and
    that absence is an answer.** The 49 weapons with no `shotSpeed` are the lasers, rail
    guns, Gauss cannons and mine launchers — nothing there travels, so there is no
    projectile speed to move. The 41 with no `reloadTime` are a _different and smaller_
    family, the pulse, burst, beam and mining lasers alone: they have no clip and never
    reload, while rail guns, Gauss cannons and mine launchers all reload and all carry
    the stat. Neither registry publishes a figure for either set, and EDSY's per-family
    `modifiable` lists say outright that the game does not move those stats on those
    weapons. The two medium Seismic Charge Launchers, fixed and turreted, _do_ reload,
    and take EDSY's `rldtime` of 1 s.
  - **Module-breach stats** (`breachdmg`, `breachmin`, `breachmax`) are omitted from the
    weapon block.
- **Massless modules state `"mass": 0` rather than omitting the field.** The registries
  carry **no `mass` key at all** for fuel scoops, refineries, AFM units and docking
  computers, and Coriolis's own code reads a missing mass as zero (`Module.getMass()` →
  `this.mass || 0`). This catalogue reads an absent field as _unknown_ instead, so a
  single such module would make a whole hull's mass — and with it its jump range —
  impossible to compute. The 104 affected records (`Int_FuelScoop_*` ×40,
  `Int_Repairer_*` ×40, `Int_Refinery_*` ×20, `Int_DockingComputer_{Standard,Advanced}`,
  `ModularCargoBayDoor`, `Int_DroneControl_ResourceSiphon`) say so outright, matching
  upstream's own `"mass": 0` on `Int_DetailedSurfaceScanner_Tiny`. **Verified, not
  assumed:** summing the Deep Black's module masses with these families excluded gives
  exactly the 1237.3 t its journal reports. The Resource Siphon was also observed in-game
  at zero mass.

### Engineering base stats — the values a recipe scales

Thirteen stored fields supply the base values referenced by engineering recipes:
`engineHeatRate`, `fsdHeatRate`, `refuelRate`, `shieldBankReinforcement`,
`shieldBankHeat`, `shieldBankSpinUp`, `shieldBankDuration`, `scannerRange`, `scanAngle`,
`scanTime`, `probeRadius`, `interdictorFacingLimit` and `interdictorRange`.

- **EDSY is primary here**, being the only one of the two registries that carries the
  heat rates and the scanner stats at all. Cross-checked against coriolis-data
  (`modules/**`, `modifications/modifierActions.json`, `modifications/blueprints.json`).
- **Which upstream field is which.** coriolis's `modifierActions.json` maps each journal
  Modifier Label to the field it moves, and is what settles the joins:
  `EngineHeatRate`/`FSDHeatRate`/`ShieldBankHeat` → `thermload`, `EnergyPerRegen` →
  `distdraw`, `ShieldBankReinforcement` → `shieldreinforcement`, `ShieldBankSpinUp` →
  `spinup`, `ShieldBankDuration` → `duration`, `ScannerRange` → `range`,
  `SensorTargetScanAngle`/`MaxAngle` → `angle`, `ScannerTimeToScan` → `scantime`,
  `FSDInterdictorFacingLimit` → `facinglimit`, `FSDInterdictorRange` → `ranget`. EDSY's
  own attribute table names the same stats `engheat`, `fsdheat`, `scbheat`, `genpwr`,
  `shieldrnfps`, `spinup`, `scbdur`, `scanrng`/`typemis`, `maxangle`/`scanangle`,
  `scantime`, `facinglim`, `timerng`, `scooprate` and `proberad`.
- **The two registries agree everywhere both carry a value.** Shield cell banks, the
  interdictors, the utility scanners, the sensor suites and the shield generators were
  compared record by record; the one difference is a rounding, coriolis's `duration: 17`
  against EDSY's `scbdur: 17.1` on the 8A cell bank, and EDSY's figure is kept as the
  more precise. coriolis carries **no** `thermload` on thrusters or drives despite
  naming the field in `modifierActions.json`, which is why EDSY is primary.
- **Units, where the two disagree about them.** `scannerRange` is stored in **metres**
  throughout, which is what a journal reports and what EDSY stores; coriolis holds a
  sensor suite's as kilometres (`5.76` for the 8D suite, `5760` here) and a utility
  scanner's as metres. `probeRadius` is stored as a **percentage** (`20`), not a
  fraction: that is EDSY's form, coriolis's `proberadius: 0.2` the other, and
  `fixtures/ships/journal-krait-phantom.jsonc` settles it — the game reports the Detailed
  Surface Scanner's `DSS_PatchRadius` as `20` → `28` for a grade-4 Expanded Probe
  Scanning Radius roll. `interdictorRange` is **seconds to intercept**, the unit the
  game measures a supercruise separation in, not a distance. `refuelRate` is tonnes per
  second (EDSY `scooprate`); coriolis's `rate` is the same figure in kilograms.
- **A shield cell bank duplicates its heat under two stat names deliberately.** Its
  `shieldBankHeat` is the same figure as its `thermalLoad` — one upstream field read
  under two names. Scanner distance has one catalogue home instead: every utility
  scanner and sensor suite carries
  `scannerRange`, while `maximumRange` is reserved for weapons and non-scanner utility
  effects.
- **`EnergyPerRegen` needs no stored value.** All 57 shield generators carry
  `distributorDraw`, and EDSY (`genpwr`) and coriolis (`distdraw`) both confirm it is the
  same stat under the journal's other name.
- **Nine figures no third-party registry lists, derived from the family rule.** Eight
  records: the three `*_free` starter fittings (thrusters, drive, sensors — the sensors
  contribute both a `scannerRange` and a `scanAngle`) and the five plain size-8 drives.
  Each `*_free` record is byte-identical to its priced twin apart from the missing
  `cost`, so it takes that twin's value. A drive's heat rate is a function of its **size
  alone** across all 66 records EDSY does carry — 10, 14, 18, 27, 37, 43 for sizes 2 to
  7, identical between the plain and SCO lines at every size — and the size-8 SCO drives
  are 50, so the size-8 plain drives take 50. Stated as derivation, not as a reading.
  The Mk II supercharge-optimised size-8 SCO drive is **not** among them: EDSY publishes
  its `fsdheat: 50` outright, spelling the fdname
  `Int_Hyperdrive_Overcharge_Size8_Class5_Overchargebooster_MkII` where the outfitting
  registry this catalogue is keyed on capitalises the `B`. The case-insensitive source
  join makes it a reading.
- **A weapon with no maximum range carries no Long Range falloff leg.** That leg is
  stored upstream as an overwrite in `[0, 1]` — a flag meaning "damage falls off from
  maximum range." On the 33
  weapons `Weapon_LongRange` reaches that have no range at all (missile and torpedo
  racks, mine launchers, flak mortars, the AX dumbfires) there is nothing to resolve
  against, and the recipe's `Range` leg is inert there for the same reason; the flag is
  dropped rather than published as a one-metre falloff. Seven of the 33 do carry a real
  `falloffRange` — the flak mortars, the AX dumbfire missiles and the Disruptor pulse
  laser — and keep it unchanged: only the sentinel is ever dropped, and no record's
  `falloffRange` is small enough to be mistaken for one.
- **A hull reinforcement package's hull boost is computed, not stored.** A
  percentage-of-a-multiplier stat has no absent state, because no hull boost is a ×1
  multiplier — 0% — and EDSY says so explicitly (`hullbst`, `default: 0`, `modmod: 100`).
  A journal therefore reports `OriginalValue: 0`; no value is stored on any record.
- **`GuardianModuleResistance` grants a capability rather than scaling a stat.** EDSY
  stores Anti-Guardian Zone Resistance as `agzresist`, an enumerated flag with values
  `''` / `'Active'`, no unit and no magnitude. Inara displays the activation as +100%, but
  treating that as an additive number would invent a base value the game does not have.
  Apart from the two Guardian Nanite Torpedo Pylons that EDSY marks inherently `Active`,
  stock catalogue records omit the sparse flag. No raw `Loadout` capture in this
  repository states the modifier; its journal representation is therefore not treated as
  Frontier provenance.

### Deliberately absent fields

- **`integrity` is absent on 82 non-armour records** because no registry publishes one
  for those families and the game's module panel shows none. Guardian hull reinforcement
  packages are in that set and do draw power,
  so "no integrity" is not a shorthand for "inert".
- **`cost` is absent** when no published price exists.

### Reconciliation and in-game audit

The four module catalogues are reconciled against the registries and in-game
observations. EDSY fills values coriolis-data leaves blank; where either registry
disagrees with an in-game value, the in-game value governs.

EDSY supplies most module values that coriolis-data omits. In-game verification supplies
the remaining observable values, including the unsized Resource Siphon's zero mass.
Two starter capacities are derived rather than read:
`Int_FuelTank_Size1_Class3_free`'s `fuelCapacity` and
`Int_CargoRack_Size2_Class1_free`'s `cargoCapacity` follow from capacity being exactly
2^size across all eight sizes of both families, with no exception.

**In-game coverage, stated separately from registry coverage.** In-game verification
covers **1193/1199** catalogue identities. Numeric verification covers **952/1199**
non-armour modules, and the other **241/1199** verified identities are the ship-specific
armour modules; their class, mass, hull boost and resistances retain their registry
provenance rather than being described as game-verified. The six bundle-granted Vessel
Hangars rely on the public registry and CAPI evidence below. Their stats match their
ordinary twins, but they have not been independently checked in the module panel.

Every numeric field available through in-game verification was compared. Exact
full-field coverage includes `powerDraw`
831/837, `bootTime` 827/833, power-plant output and efficiency 43/43 each, every FSD
field 72/72, every thruster heat-rate record 40/40, all six distributor fields 49/49,
sensor range and angle 41/41, shield mass/strength curves 57/57, shield regeneration
57/57, shield-cell timing/reinforcement/heat 40/40, fuel-scoop rate 40/40,
interdictor range/facing 20/20, cargo capacity 16/16, fuel capacity 9/9, hull
reinforcement 30/30, module protection 20/20, shield addition 10/10, Guardian jump
boost 5/5, weapon armour piercing 157/157, burst rounds 18/18, burst rate 16/16 and
rounds per shot 19/19. `powerDraw` and `bootTime` have no discrepancies at all.

In-game verification did not yield the 1173 store prices, hardpoint reserve ammo (120),
projectile speed (111), rail-gun charge time (3), or the 23 hardpoint scanners'
range/angle/time fields. Twenty-one hardpoint maximum-range values, ECM heat and reload,
the 241 armour modules, blueprint grade rolls and crafting costs remain unverified too.
It also did not unambiguously settle the shield-generator resistances, shield-booster
properties or probe radius. Those values are not changed on guesswork. For the 34
anti-xeno, Guardian and special weapons whose damage observed in-game does not reduce honestly
to one conventional scalar, `damageComponents` preserves the exact amounts. The two
channel types not established by in-game verification remain `unclassified`. Ten
projectile-limited hardpoints carry their boundary parameters observed in-game in
`projectileRange`; those parameters are not presented as effective ranges.

**A journal capture is a third source, and it reaches fields in-game verification does
not.** Every engineered module in a `Loadout` states its own _unmodified_ value beside
the modified one, so a capture reads base stats straight out of Frontier's own
arithmetic — including a hardpoint's reserve ammo and projectile speed, which the
in-game audit above lists as unreached, the shield-generator and shield-booster
resistances, which it lists as unsettled, and the ship-specific armour modules, which it
excludes from numeric verification altogether. Of the nineteen journal captures and the
EDSY export stored here, **eighteen state base values**; between them they state **1,070**
that name a field this catalogue holds, and every one agrees — 936 to the stored decimal
and 134 to within the game's own float noise.

Counted as distinct (module, label) pairs rather than per capture, that reaches 21
modules on their resistances (seven shield generators, two shield boosters, four hull
reinforcement packages and eight armour modules), those eight armour modules' hull
boosts, nine reserve-ammo and seven clip-size readings, and two projectile speeds.

**`Hpt_HeatSinkLauncher_Turret_Tiny` holds a reserve of 2**, which is a capture's figure
rather than a registry's. The Lynx Highliner states it under a grade-1 Heat Sink Capacity
that takes it to 3 — what 2 × 1.49 rounds to, where a base of 3 would have loaded 4 — and
the same block's `Mass` ×2 and `ReloadTime` ×1.5 legs read as the recipe defines them, so
the modifier is being read correctly. EDSY agrees at 2; coriolis-data's 3 is the figure the
corrections table below rejects. A hardpoint's reserve ammo is one of the fields the audit
above lists as unreached, which is why a capture is the source here.

**Three journal spellings reach a field only because a capture spells them that way.**
`Range` is a scanner's `scannerRange` — a weapon's `maximumRange` under the same label,
resolved per record; `DamageFalloffRange` is the
`falloffRange` a blueprint recipe calls `FalloffRange`, the same pairing as
`ProbeRadius` / `DSS_PatchRadius`; and `FuelScoopRate` is the `refuelRate` the
`FuelScoop_Efficiency` recipe calls `RefuelRate`. The nineteen readings behind the three
agree. The Caspian Explorer's grade-5 scoop roll reads 1.245 → 1.8675, the recipe's ×1.5,
and its `PowerDraw` leg reads ×1.15 in the same block.

A fourth label, `Jitter`, already resolved to `jitter`. A capture states it as
`OriginalValue: 0` on a missile rack whose record holds no such field — a weapon that
carries no jitter fires true. That zero is a value rather than an absence, so it is a
`defaultBase` like `roundsPerShot`'s 1. It applies to the 66 weapons offered Rapid Fire,
its multi-cannon spelling, or Inertial Impact (`special_distortion_field`) that hold no
jitter of their own.

**Eighteen weapons have a `DamagePerSecond` a capture states outright.** These are the only
external readings of an unmodified weapon's folded figure. On a beam laser the fold is
trivial because `damage` is already per second; the huge and medium gimballed beams have
no separate journal `Damage` reading.

**Every module in every catalogue carries at least one stat** (1199/1199), and no
record holds only a lone `mass`. 244 of the 833 `bootTime` values are `0` (every hardpoint
among them); they are stored rather than omitted, because an absent field means
absent.

**`Int_DroneControl_ResourceSiphon` has a mass of 0 t.** The value is read directly from
in-game: 0 t mass, alongside integrity 20, power draw 0.4 MW and boot time 0 s. It is not
inferred from EDSY's omitted field or from family uniformity; every sized limpet
controller in the family retains its real, non-zero mass.

**The three `*_free` starter fittings that would otherwise be hollow.**
`Int_ShieldGenerator_Size2_Class1_free` takes `shieldRegenRate` 1,
`shieldBrokenRegenRate` 1.6, the resistances 0.4 / −0.2 / 0.5 and `distributorDraw` 0.6
— **all six straight from EDSY**, which carries that record in full (as `genrate`,
`bgenrate`, `kinres`/`thmres`/`expres` as whole percentages, and `genpwr` for the
distributor draw). Rating-level uniformity gives the identical numbers — all eight
E-rated generators share those resistances — but it is not what these values rest on.
`Int_FuelTank_Size1_Class3_free` takes `fuelCapacity: 2` and
`Int_CargoRack_Size2_Class1_free` `cargoCapacity: 4`, and those two genuinely are
derived from the 2^size rule above. Without all three a stock starter fit reports 0 t of
fuel, 0 t of cargo and 0/0/0 shield resistances.

**Registry-derived corrections.** These are retained where in-game verification agrees
or where no corresponding in-game value was available:

| Records                                                          | Field                               | coriolis       | Stored              | Why coriolis's value is wrong                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------- | -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Int_GuardianPowerDistributor_Size{1,4,5,6,7,8}`                 | `integrity`                         | 56             | 35/70/99/99/115/132 | 56 is size 3's value, repeated across six sizes                                                                                                        |
| `Int_GuardianPowerDistributor_Size3`                             | `weaponsCapacity`/`weaponsRecharge` | 13 / 3.1       | 17 / 3.9            | copied from an adjacent size                                                                                                                           |
| `Int_GuardianPowerDistributor_Size4`                             | `systemsCapacity`/`systemsRecharge` | 14 / 1.7       | 17 / 2.5            | copied from an adjacent size                                                                                                                           |
| `Int_Sensors_Size1_Class{1..5}`                                  | `integrity`                         | 46/41/51/61/56 | 36/32/40/48/44      | coriolis's size-1 row is a verbatim copy of its size-2 row; size 1 is the only mismatching size in the family                                          |
| `Int_PowerDistributor_Size1_Class{1..5}`                         | `integrity`                         | 46/41/51/61/56 | 36/32/40/48/44      | same duplicated-row defect                                                                                                                             |
| `Int_Hyperdrive_Overcharge_Size7_Class2`                         | `integrity`                         | 2700           | 150                 | `optMass` copied into `integrity`; every sibling drive is 131–164                                                                                      |
| `Hpt_Slugshot_{Fixed,Gimbal,Turret}_Medium`                      | `integrity`                         | 80             | 51                  | 80 is the huge-mount value                                                                                                                             |
| `Hpt_Slugshot_{Fixed,Gimbal,Turret}_Large`                       | `integrity`                         | 80             | 64                  | as above; the catalogue already had 64 on `Hpt_Slugshot_Fixed_Large_Range`                                                                             |
| `Hpt_PulseLaserBurst_Gimbal_Huge`                                | `integrity`                         | 80             | 64                  | a real outlier, not the Fragment Cannon rule misapplied — see "look wrong and are not" below                                                           |
| `Hpt_HeatSinkLauncher_Turret_Tiny`                               | `integrity`                         | 20             | 45                  | 20 is the chaff launcher's; the Caustic Sink Launcher, its analogue, is 45 in both sources — the same duplicate-record defect as its `cost` and `mass` |
| `Hpt_MRAScanner_Size0_Class1`                                    | `integrity`                         | 24             | 32                  | every other size-0 scanner family runs 32/24/40/56/48; 24 is a duplicate of the Class2 row                                                             |
| `Int_DroneControl_{FuelTransfer,Prospector,Repair}_Size5_Class4` | `powerDraw`                         | 0.97           | 0.72                | 0.97 is the size-7 B-rated value; 0.72 holds the Class4/Class1 ratio the family keeps elsewhere (1.78 at sizes 1 and 3, 1.76 at size 7, 1.80 here)     |
| `Hpt_Mining_SubSurfDispMisle_Turret_Small`                       | `powerDraw`                         | 0.42           | 0.53                |                                                                                                                                                        |
| `Int_ShieldGenerator_Size1_Class5_Strong`                        | `mass`                              | 2.5            | 2.6                 | Prismatic is exactly 2× the base generator at every other size, so size 1 is 2×1.3, not half of size 2's 5.0                                           |
| `Int_ShieldGenerator_Size2_Class5_Strong`                        | `minMass`                           | 23             | 28                  |                                                                                                                                                        |
| `Int_MetaAlloyHullReinforcement_Size1_Class2`                    | `mass`                              | 2              | 1                   |                                                                                                                                                        |
| `Int_Engine_Size3_Class5`                                        | `integrity`                         | 72             | 70                  |                                                                                                                                                        |
| `Int_Powerplant_Size5_Class4`                                    | `integrity`                         | 114            | 115                 |                                                                                                                                                        |
| `Int_FSDInterdictor_Size2_Class2`                                | `integrity`                         | 51             | 31                  |                                                                                                                                                        |
| `Hpt_Cannon_Gimbal_Large`                                        | `damage` / `thermalLoad`            | 37.39 / 2.9    | 37.421001 / 2.93    | observed in-game; the journal agrees                                                                                                                   |
| `Hpt_BeamLaser_Gimbal_Huge`                                      | `thermalLoad`                       | 10.6           | 10.62               | observed in-game; the journal agrees                                                                                                                   |
| `Int_ShieldGenerator_Size7_Class5_Strong`                        | `shieldBrokenRegenRate`             | 4.2            | 4.25                | observed in-game; the journal agrees                                                                                                                   |
| `Hpt_HeatSinkLauncher_Turret_Tiny`                               | `ammoMaximum`                       | 3              | 2                   | a journal states the base as 2, and EDSY agrees; in-game verification does not reach hardpoint reserve ammo                                            |
| `Hpt_Guardian_ShardCannon_Fixed_Medium`                          | `shotSpeed`                         | 1133           | 1133.333374         | Frontier's journal states the base beside the tech-broker Modified variant's engineered value                                                          |

**In-game corrections.** Values are stored at the observed in-game precision. These groups
account for 300 fields on 135 modules in addition to the Resource Siphon:

| Records                                                                                                                 | Fields                                                            | Stored in-game values                                              |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Int_Engine_Size4_Class{2,4}`, `Int_Hyperdrive_Size4_Class4`                                                            | thruster min/max mass; FSD optimal mass                           | 158/473, 193/578 and 438 t                                         |
| `Int_Engine_Size{2,3}_Class5_Fast`                                                                                      | acceleration optimal/maximum multiplier                           | 1.1 / 1.2 on both                                                  |
| `Int_GuardianShieldReinforcement_Size{1..5}_Class{1,2}`                                                                 | integrity                                                         | 36/42, 40/48, 45/55, 51/63, 58/72                                  |
| `Int_MetaAlloyHullReinforcement_Size{1..5}_Class{1,2}`                                                                  | caustic resistance                                                | 0.02 on all ten                                                    |
| shield generators                                                                                                       | regeneration / broken regeneration                                | observed 1.06–5.76 values per symbol                               |
| `Int_ShieldCellBank_Size1_Class2`; `Int_FuelScoop_Size4_Class5`                                                         | reserve ammo; scoop rate                                          | 1; 0.343 t/s                                                       |
| Beam Laser, Cannon, Fragment Cannon, Multi-Cannon, Plasma Accelerator, Rail Gun, Shock Cannon and Point Defence records | damage / thermal load                                             | 34 scalar damage and 55 thermal-load corrections                   |
| Advanced Plasma Accelerator, Imperial Hammer, Shock Cannons and Mk II Plasma Shock Accelerator                          | burst interval / combined rate of fire                            | exact cycle values derived with the catalogue's documented formula |
| mining, utility and Guardian hardpoints                                                                                 | clip, distributor draw, reload, jitter, falloff and maximum range | observed values per symbol                                         |
| anti-xeno, Guardian and special weapons                                                                                 | scalar, distribution and exact damage components                  | 34 component records                                               |
| AX missiles, subsurface displacement missiles and seismic charge launchers                                              | projectile boundary parameters; misleading ordinary ranges absent | ten records and 16 absences                                        |

In-game verification gives the integer thruster/FSD masses, 1.1/1.2 enhanced-thruster
acceleration multipliers and the rising Guardian Shield Reinforcement integrity ladder.
The enhanced thrusters additionally retain Coriolis's separately sourced 0.9/1.25/1.6
speed curve and 0.9/1.1/1.3 rotation curve; its mobility calculation applies those
curves instead of treating the outfitting panel's acceleration curve as all three.
These values take precedence over family-shaped inference and registry agreement.

**The two fixed Guardian Shard Cannons' damage is derived from a panel reading, not read
off one.** Individual outfitting panels observed **2026-08-10 UTC**, with grade-1
Anti-Guardian Zone Resistance active on both weapons, display **5.2 damage / 104.5
damage/s** on the fixed large and **3.7 damage / 74.5 damage/s** on the fixed medium; a
six-shard build's panel adds a 566.9 damage/s total. The panel exposes only rounded
values, so it does not uniquely reveal the underlying decimals. The stored **5.225** and
**3.7235** damage per projectile apply the uniform 10% correction all three readings
indicate to the older registry figures 4.75 and 3.385; at 12 projectiles and 1.666667
shots/s they reproduce both individual displays and the build total. The remaining fields
those panels state agree with the catalogue as stored (8/4 t mass, 51/42 integrity,
1.68/1.21 MW power, 1.4/0.65 MW distributor draw, 2.2/1.2 thermal load, 60/45 armour
piercing, 1700 m maximum and falloff ranges, 5/180 ammunition, 1133/1133.333374 m/s
projectile speed). A panel reading has no upstream immutable revision.

**The two fixed Guardian Gauss Cannons' damage comes directly from stock module-panel
readings.** Individual outfitting panels observed **2026-08-12 UTC** display **22.0**
damage for the small 1D cannon and **38.5** for the medium 2B cannon. Those readings
settle the registry disagreement in favour of coriolis-data's 22 / 38.5 rather than
EDSY's 40 / 70. The catalogue stores the displayed values without further derivation and
applies the same correction to their exact thermal and anti-xeno components. The two
records are pinned in `fixtures/ships/module-stats.jsonc`. A panel reading has no upstream
immutable revision.

**Values that look wrong and are not.** Three records break the pattern their family
follows and are confirmed outright by EDSY. Recorded so the "breaks its family's curve"
heuristic does not keep rediscovering them:

- **`Hpt_PulseLaserBurst_Gimbal_Huge` `integrity` really is 64**, and it really is the
  only huge (class-4, 16 t) hardpoint not at 80 — its own fixed sibling is 80. EDSY gives
  `integ:64` for it and 80 for the other eleven. Note that EDSY also gives it
  `maxbrc: 80`, which is max **breach** damage and is easy to misread as the integrity.
- **`Int_GuardianPowerDistributor_Size{5,6}` `integrity` really are both 99.** Guardian
  distributor integrity otherwise tracks 0.80× the A-rated standard ladder, which would
  put size 5 near 85; EDSY states 99 for both sizes. The duplicate is in the game data.
- **`Int_DroneControl_Recon_Size5_Class1` `bootTime` really is 9.85** — the only
  non-integer boot time in all 1199 records, where its three family siblings are exactly 10.
  EDSY gives `boottime:9.85`.

### Prices — `cost` on modules, `hullCost` / `retailCost` on hulls

`cost` is the module's standard list price in credits, before any station discount or
markup — the figure an outfitting screen quotes at 0% discount. On hulls, `hullCost` is
the bare hull and `retailCost` the hull with its default module loadout (`retailCost` is
never below `hullCost`). Sources are coriolis-data's `cost` per
module and `properties.hullCost` / `retailCost` per ship, with EDSY filling the records
coriolis does not price (the newer hulls' armour and Operations additions) and supplying
the Lynx Highliner, which has no coriolis entry.
Ship-specific **armour** is priced from each hull's `bulkheads` upstream, joined on hull
and bulkhead name because those records carry no symbol upstream.

- **All 48 hulls are priced. 1173 of 1199 modules are.** The 26 without a price are the
  fifteen grant/starter `*_free` variants, the five size-8 frame shift drives, the three Mk II
  Vessel Hangars, the two unsold Corrosion Resistant Cargo Racks (both Community Goal
  rewards) and `Int_ShieldGenerator_Size1_Class4` — no registry publishes a figure for
  them. **`cost` is omitted, never set to 0**: `0` is a real price (the starter
  Lightweight Alloy bulkhead costs nothing), while omission means unknown.
- **Sixteen duplicated symbols take the first occurrence's price.** Where coriolis-data
  holds a symbol twice, the "first occurrence wins" rule that governs `mass` governs
  `cost` too; taking the _second_, unpriced record would leave them at `0`. The sixteen:
  `Hpt_HeatSinkLauncher_Turret_Tiny` 3500 — confirmed independently against a real
  journal, which prices the fitted module at 3071 = 3500 less the 12.25% outfitting
  discount that export was taken at; `Int_Hyperdrive_Size5_Class5` 5 103 953;
  `Int_CargoRack_Size5_Class1` 111 566 and `_Size6_Class1` 362 591;
  `Int_DetailedSurfaceScanner_Tiny` 250 000; `Hpt_MultiCannon_Fixed_Medium` 38 000;
  `Hpt_Railgun_Fixed_Medium` 412 800; `Hpt_BasicMissileRack_Fixed_Medium` 512 400;
  `Hpt_MiningLaser_Fixed_Small` 6800; `Hpt_ATDumbfireMissile_Fixed_Large` 1 352 250;
  and the six small/medium Guardian weapons (Gauss 167 250 / 543 801, Plasma
  176 500 / 567 761, Shard 151 650 / 507 761).
- **Only one record is priced `0`:** `ModularCargoBayDoor`, which is built into every
  hull and cannot be bought. A zero price is otherwise indistinguishable from a dropped
  one, so a new one has to be argued for.
- **`Int_CorrosionProofCargoRack_Size1_Class2` is priced at 12 560, from EDSY**, where it
  is module `161`, annotated `// at Palin, Sedesi`. Coriolis reads `cost: 0` for it,
  which is coriolis's own gap and not a shared one: on the two corrosion racks _both_
  registries price they agree exactly (`_Size1_Class1` 6250, `_Size4_Class1` 94 330), and
  the only corrosion racks FDevIDs `outfitting.csv` lists at all are those two plus
  `_Size1_Class2` itself — so it is the last of the purchasable ones. It is certainly not
  free: the Deep Black's journal buys the size-4 at 82 775 = 94 330 less that export's
  12.25% discount.
  - **Read that 12 560 as a 10-granular figure, not a to-the-credit one.** EDSY publishes
    module costs at **10-credit granularity**, which is measured rather than assumed. Two
    observations, both scoped to `eddb.module` — EDSY's outfitting table, where module
    `161` lives — so they can be re-run. Totals across the whole of `eddb.js` are
    deliberately not quoted: they move with how the scan treats commented-out records,
    the ship table's own armour rows and case-mismatched symbols, whereas within the
    module table the result is flat.
    - **Every cost in that table is a multiple of 10 but one:**
      `Int_ShieldGenerator_Size1_Class5`, at 88 075. (Take in the ship table's own armour
      rows as well and eight more appear — Python Mk II and Cobra Mk V — and the hull
      prices in that table add three more again, for the Python Mk II, Cobra Mk V and
      Panther Clipper Mk II. That spread is exactly the method-dependence being avoided
      by scoping to the module table.)
    - Where coriolis prices the same module and the two differ, the difference is
      overwhelmingly EDSY carrying coriolis's exact figure rounded to the nearest 10
      (`Int_CargoRack_Size5_Class1` 111 566 → 111 570, `_Size6_Class1` 362 591 →
      362 590). A minority are the registries disagreeing about the price itself rather
      than about precision, sometimes widely
      (`Hpt_MkIIPlasmaShockAutocannon_Fixed_Large`: EDSY 4 612 670, coriolis 3 051 200),
      so read a lone EDSY figure as possibly stale as well as rounded.

    **What that does and does not bound.** It bounds the _rounding_ to under 10 credits,
    and not to ± 5: EDSY does not always round to nearest, since among the pairs differing
    by under 10 credits a handful differ by 6 to 9, and EDSY is _above_ coriolis in every
    one of them (`Int_LifeSupport_Size8_Class5`: coriolis 27 249 391 → EDSY 27 249 400).
    It does **not** bound how far the figure sits from the game's own price. Three pairs
    where both registries publish a multiple of 10 still differ by 10
    (`Int_FighterBay_Size{6,7}_Class1`, `Int_PassengerCabin_Size6_Class1`), which no
    rounding explains: whatever the real price is, at least one of the two registries is
    wrong about it by five credits or more, and neither says which. So treat 12 560 as the
    best published figure at 10-credit resolution, not as an accuracy guarantee; only an
    in-game reading settles the last digits. Every EDSY-sourced price in this catalogue
    carries the same granularity, so this record is no less exact than the rest of them.
- **The size-5 and size-6 Corrosion Resistant Cargo Racks have no list price to
  publish**, and their absent `cost` means _no list price exists_, not _none has been
  found_. They are **not sold at any station**: FDevIDs `outfitting.csv` lists neither,
  and EDSY hides both with `cost: 0 // TODO: cost // CG reward`. They were Community Goal
  rewards and were sold nowhere. Frontier's own announcement of the **Rhea Disaster** CG
  states that "all participating commanders will now receive the Size 6 Corrosion
  Resistant Cargo Rack whilst the top 50% will now receive 2"
  (post id `1812792503776489745`; the CG itself ran on the Frontier forums, thread
  `626528`). The Elite Dangerous Wiki's Corrosion Resistant Cargo Rack page records
  that the class 5 and 6 modules "exist in limited numbers among CMDRs who received them
  as a Community Goal reward, but they are otherwise neither purchasable nor
  unlockable" — size 4 is the largest one obtainable, through a Human Technology Broker.
  So EDSY's `TODO: cost` is upstream expecting a figure that outfitting never quoted.
  Players do hold these racks, so a journal can name them and the catalogue must resolve
  them; `cost` stays omitted, since a reward module still has an insurance value and
  reporting it as free would understate a rebuy.
  - **Both sources were read 2026-08-06 UTC; the wiki is unpinned.** An X status id
    names one immutable post, so the announcement is pinned by its URL. The wiki page is
    mutable and MediaWiki serves a stable `?oldid=` for it, but the host refuses
    automated requests from this environment (HTTP 403), so neither the revision id nor a
    stored copy could be captured and `../SNAPSHOTS.md`'s checksum fallback is out of
    reach for the same reason. The quotation above is the preserved form; no revision is
    invented.
  - **What an unpinned source may carry: an interpretation, never a value or a record.**
    Nothing in any payload here derives from either of these two; they settle only what an
    already-absent `cost` means.
    Using an unpinned page to add a price or a module would need the pin first.
  - **A capture reporting a `Value` was checked and rejected.**
    `fixtures/ships/slef-inara-cutter-antixeno.jsonc` fits five of these racks. Its two
    size-6 records carry **no `Value` at all**; its size-5 carries `Value: 318174`. That
    is not a list price, and the same export is what proves it: the two size-4 racks in it
    read **82 774** and **91 970** against the one list price of 94 330 — about 12.25% and
    2.5% off. `Value` is net of the station discount, one reading with an unknown discount
    does not yield a list price, and a reward module was not bought at a discount to begin
    with. (318 174 is within a credit of 362 591 less 12.25%, and 362 591 is the
    _standard_ E-rated size-6 rack's price; that is arithmetic reaching for a target with
    a free variable, not a source.)
  - Adding a value requires an in-game reading that does not go through a purchase: a
    `StoredModules` entry's `BuyPrice`, a `ModuleSell` on one, or the insurance figure a
    rebuy screen quotes. A journal `Loadout` `Value` is not sufficient, for the reason above.
- **Filled by hand, from a documented uniformity:** `Int_ShieldGenerator_Size1_Class4`
  (added from EDSY, so it has no coriolis record) takes the resistances and distributor
  draw every one of the 55 shield generators coriolis does carry shares — kinetic 0.4,
  thermal −0.2, explosive 0.5, draw 0.6. The cargo hatch (`ModularCargoBayDoor`) takes
  the 0.6 MW draw Coriolis hard-codes for it (`ModuleUtils.cargoHatch`), since it is
  fitted to every hull and cannot be removed.
- **Not modelled:** passenger capacity and fighter-bay/rebuild counts. The
  **Merc-Coin** price of the pre-engineered variants is carried, but on the variant
  rather than the module — see `mercCoinCost` in the pre-engineered section.

### Armour, and the fields kept deliberately

- **Armour (bulkhead) stats:** coriolis keeps a hull's five (Caspian Explorer: six)
  armour options on the _hull_ record; this catalogue keeps them on the matching
  `<Hull>_Armour_*` module records, joined by hull and by the symbol's grade suffix
  (`_Grade1`, `_Grade1_Default`, `_Grade2`, `_Grade3`, `_Mirrored`, `_Reactive`). Each
  carries its added `mass` (t), `hullBoost` (the fraction of the hull's base armour it
  adds on top) and the four resistances. Armour is a module like any other, so its stats
  live with every other module's rather than being duplicated on the hull. The Lynx
  Highliner has no coriolis hull entry, so its options take the per-grade hull boost and
  resistances that all 47 hulls coriolis does carry share, with the masses from EDSY.
- **Deliberate stat fields:**
  - **`restrictedToShips`** carries the hull symbol(s) a non-armour module is limited
    to (coriolis's `ship` field: the MkII Gravity Optimised thrusters → `Explorer_NX`,
    the MkII Agile Boost thrusters → `SmallCombat01_NX` "Kestrel", the MkII Mining
    controller and Mining Volley Repeater → `LakonMiner`), plus the two Mk II Cargo Racks
    → `["PantherMkII"]` (EDSY marks them `reserved:{63:1}`, ship 63 being the Panther
    Clipper Mk II, and coriolis-data describes them as a "Panther Clipper storage rack")
    and the three Mk II Vessel Hangars → `["Explorer_NX", "PantherMkII", "LakonMiner"]`
    (EDSY has no record for the Mk II bays at all, so their restriction rests on
    Frontier's update notes and Inara). Armour records use the `ship` field instead.
  - **`restrictedToSlot`** is the same idea one axis over: the slot restriction a module
    requires, so it fits only mounts carrying it — the mirror of a mount's `restriction`,
    and the half `restrictedToShips` cannot express. Five records have one: the two
    planetary approach suites, the two Mk II Cargo Racks and the Mk II Mining
    Multi-Limpet Controller. It composes with `restrictedToShips` rather than replacing
    it — the racks name both the hull that can buy them and the mount they go in.
    - **Sources.** EDSY refuses a reserved `icr` outside a slot named `CARGO*`, and
      coriolis-data carries `"restriction": "Cargo"` on the module; the same shape holds
      for the Mk II Mining Multi-Limpet Controller against `LIMPETCONTROLLER*`.
      `fixtures/ships/slef-inara-panther-mkii.jsonc` shows the game agreeing: its two Mk II
      racks sit in `cargo01` and `cargo02` while its _unrestricted_ `slot01_size8` and
      `slot02_size7` carry ordinary racks — a build that could not exist if the
      reservation were about size. `fixtures/ships/slef-inara-type-11.jsonc` does the same
      for the controller, in `limpetcontroller01`.
    - **The field is deliberately narrow.** It says a module fits _only_ mounts with that
      restriction, so it is wrong on anything the game also sells for an ordinary
      optional: a plain cargo rack fits a `cargo` mount _and_ every unrestricted one, and
      does not carry it. The set of five is pinned, so widening it is a deliberate act.
  - **`exclusionGroup`** carries EDSY's one-per-ship `limit` families, renamed from its
    compact ids to stable descriptive values. EDSY has 17 one-per-ship source families;
    the stored set covers 194 internal and utility records in 16 of them: shield
    generators (standard, bi-weave and prismatic
    share one group), fuel scoops, refineries, frame-shift-drive interdictors, Guardian
    FSD boosters, vessel hangars, docking computers, supercruise assist, multi-limpet
    controllers, the two scanner families, experimental module stabilisers, and the five
    one-per-ship utility families. EDSY sets every one of those limits to `1`. EDSY's
    three legacy discovery scanners are absent because they
    are not current outfitting records; `Int_SupercruiseAssist` matches EDSY's
    `Int_SuperCruiseAssist` case-insensitively, as Frontier symbols are matched elsewhere.
    The three Mk I bundle-granted and all six Mk II Vessel Hangars are absent from the
    baseline table; they join to the separately pinned Vessel Hangar snapshot, where all
    nine carry the same `limit:'ifh'` as the ordinary Mk I records.
  - **`limitGroup` / `limitIncrease` preserve EDSY's non-exclusive fitting limit.** All
    33 current hardpoint records whose EDSY module carries `limit:'hex'` store
    `limitGroup:'experimentalWeapon'`; the source's `eddb.limit.hex` is `4`. This is the
    shared AX/Guardian experimental-weapon allowance, not a name-based classification:
    the marked set is exactly the source set, including the Caustic Missile Rack and
    excluding the two Guardian Nanite Torpedo Pylons, which EDSY does not limit. The
    class-3 and class-5 Experimental Weapon Stabilisers carry EDSY's
    `unlimit:'hex'` / `unlimitcount:1` and `2` as `limitIncrease`. EDSY's fitting logic
    adds those increases to the base allowance and counts every fitted stabiliser; both
    source records have effective `powerDraw:0`, so power state does not alter the
    structural allowance.
  - **Pre-engineered/duplicate drives share a `symbol`** in coriolis (e.g. the V1
    FSDs); the first (primary) occurrence wins, and any baked engineering is expected
    to arrive as SLEF `Engineering.Modifiers` instead.
- **Identity retained verbatim from the source:**
  - The `?` notes on `Hpt_CausticSinkLauncher_Turret_Tiny` and
    `Hpt_AntiUnknownShutdown_Tiny_V2` are not entitlement tokens and are omitted.
  - One source row (`Int_MkIIAgileBoost_Engine_Size5_Class5`) has the literal string
    `mount` in its `mount` column — a thruster has no hardpoint mount, so the field
    is omitted, matching every other thruster.
  - **`Int_LargeCargoRack_Size8_class1` really is spelled with a lower-case `class1`**
    — the only record in all four catalogues that is. It is not a typo here: EDCD
    FDevIDs `outfitting.csv` spells it exactly that way (row `129034964`), and identity
    comes from FDevIDs. EDSY normalises it to `_Class1`, which is why a cross-check
    against EDSY looks like it disagrees. The stored symbol retains FDevIDs' casing.

### Records sourced outside the baseline registries

Records not in coriolis-data / FDevIDs at the acquired revisions:

- **Vessel Hangars** — the three Mk II records
  (`Int_FighterBayMk2_Size{5,6,7}_Class1`) have the same operational stats as the Mk I
  bays at half the mass (10/20/30 t, integrity 60/80/120, power
  0.25/0.35/0.35 MW). The three Mk I **Fighter Hangar** records are named **Mk I Vessel
  Hangar** (same symbols and stats; the Operations update renamed them and let them
  deploy the Nomad).
  - **Six bundle-granted variants are separate identities.** The pinned CAPI response
    lists `Int_FighterBay{,Mk2}_Size{5,6,7}_Class1_Free` as modules with `bundle: true`
    and the grant tokens `ELITE_V_MKIFIGHTERBAY_FREE` / `ELITE_V_MKIIFIGHTERBAY_FREE`.
    That is direct player-facing evidence that they are obtainable, so they pass the
    inclusion rule below despite remaining absent from FDevIDs. The later EDSY snapshot
    independently lists all six and supplies the same mass, integrity, power draw and
    boot time as their ordinary twins. The Mk II grant variants retain the ordinary Mk
    II restriction to `Explorer_NX`, `PantherMkII` and `LakonMiner`; the Mk I variants
    remain unrestricted like their ordinary twins. `cost` is omitted: the CAPI response's
    zero is the bundle charge, not a standard purchase price for a separately sold
    module.
- **Mk II passenger cabins** (`Int_MkII_PassengerCabin_Size{2..6}_Class{1,2}`) — identity
  records from FDevIDs, with mass added (2.5/5/10/20/40 t by size) and the two size-6
  records' `class` corrected from 5 to 6.
- **Corrosion Resistant Cargo Racks** `Int_CorrosionProofCargoRack_Size{5,6}_Class1`
  (capacity 32/64) and the built-in **Cargo Hatch** `ModularCargoBayDoor` (power 0.6 MW)
  — live EDSY records (not commented out, unlike the 1B shield generator below) that the
  FDevIDs join omits. Both racks carry EDSY's `hidden:1`, and they are also the two the
  prices section leaves unpriced, but the flag is not the reason: `hidden:1` marks a
  record EDSY keeps out of its pickers for assorted reasons, and of the nine such records
  in its module table one does carry a price (`Int_DroneControl_ResourceSiphon`,
  `cost: 18040` — which EDSY itself annotates `// bug?`, so it is a weak counter-example,
  but enough to show the flag is not a statement about price).
  - **`_Size2_Class1` is not carried: it never existed in game.** No registry lists it as
    player-obtainable, which is the inclusion rule below failing rather than a price gap —
    FDevIDs `outfitting.csv` has no row, coriolis-data has no record at all, and EDSY
    carries it `cost: NaN` annotated "never released". A variant that never reached
    players is not a player-facing outfitting record, so it goes the way of the other
    non-purchasable internal variants that rule excludes.
- **1B Shield Generator** (`Int_ShieldGenerator_Size1_Class4`) — a gap in FDevIDs, not
  in the game: every other shield-generator size carries all five ratings, and size 1
  ran E/D/C/A with **B missing**. The module is real, so the record is carried with the
  stats its sources do expose — `optMass` 25 t, `minMass` 13 t, `maxMass` 63 t,
  multipliers 0.6 / 1.1 / 1.6, regen 1.0 / 1.6 MJ/s. **`mass`, `integrity` and
  `powerDraw` are deliberately omitted**: EDSY carries this variant commented out with
  those three fields blank (identity `fdid` 128064261 and the multipliers only), and no
  other registry publishes them. Omitted rather than interpolated from the neighbouring
  ratings — see the Lynx note under §Ships for the same rule.

### What is not carried, and why

- **Deliberately not modelled here:** the **Merc-Coin pre-engineered weapon variants**
  are not separate module records: their base module symbols already exist, and the
  pre-engineering is expressed as the Operations blueprints below — the pairing between
  the two is `pre-engineered.jsonc`. The **Nomad** (`Lander01`) is a ship-launched
  vehicle, not a shipyard hull, and its `Vehicle_Lander01_*` weapons carry no
  category/class/rating the module schema requires, so neither the vessel nor its modules
  are added.
- **Inclusion rule:** a module symbol is carried only when FDevIDs, coriolis-data or EDSY
  lists it as player-obtainable outfitting, or a direct player-facing capture establishes
  the same thing.
  - **Symbols outside outfitting are not stored** — hull geometry, ship-launched-fighter
    weapons and internals, station fittings, and non-purchasable internal or test variants.
  - **A named variant with no published stats is not stored either.** Where a registry
    records only that a variant exists, its missing values are not invented. The one
    exception is documented above
    (`Int_ShieldGenerator_Size1_Class4`), where the multipliers _are_ published and only
    the three unknown fields are omitted.
  - The built-in **Cargo Hatch** is stored once as `ModularCargoBayDoor`; per-hull
    duplicates of the same fitting are not carried separately.

## Engineering (blueprints and experimental effects)

In-game verification found 129 blueprint identities and 89 experimental/special
identities. It did not yield blueprint grade rolls, ingredient quantities or crafting
costs, so those tables retain the separately pinned sources below. All 133 experimental
modifier legs available for numeric in-game verification agree. The in-game evidence did
not settle every modifier's association with the library's public stat label, so those
associations retain their separately sourced mapping. Experimental display strings were
also verified in-game.

**Rate-of-fire features carry the label of the stat they change.** Frontier's own
`Weapon_RapidFire` and `Weapon_HighCapacity` recipes modify the **fire interval** —
coriolis-data stores the feature as `rof` but flags it `higherbetter: false`, and its own
calculator inverts it (`Module.js`: `if (name == 'rof') modValue = 1/(1+modValue) - 1`),
while EDSY stores the same recipes outright as burst-interval modifiers
(`bstint:[-8,-17,-26,-35,-44]`). Those ten features are therefore stored here under
**`BurstInterval`**, the stat they actually move; a weapon's combined `rateOfFire`
follows from the interval and its burst pattern. The Inara-sourced Operations totals are
left as published: they are _displayed_ rate-of-fire changes, so they keep the
`RateOfFire` label and apply to the rate directly — which is the only reading that
reproduces the published figure on a charged weapon such as the rail gun.

**`special_hullreinforcement_*` stores its `DefenceModifierHealthAddition` leg as
`multiplicative`, not `additive`.** Both sources give it as a percentage — coriolis's
`modifierActions` treats `hullreinforcement` as a multiplicative percentage and EDSY
stores `ihrpx_ap: { hullrnf: -5 }` — so reading it additively would apply a flat 0.05
hull points. The label only bites at all because hull reinforcement packages carry a
`hullReinforcement` base for it to apply to.

**Four effects carry a benefit leg only one of the two sources spells out.** Each names
a modification whose drawback is easy to find and whose benefit is not, so an effect
holding the drawback alone looks complete while doing nothing a build would notice. Both
references agree on every value below:

| Effect                                                   | Drawback leg                          | Benefit leg                                 |
| -------------------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `special_weapon_damage` (Oversized)                      | `PowerDraw +5%`                       | `Damage +3%`                                |
| `special_weapon_rateoffire` (Multi-servos)               | `PowerDraw +5%`                       | `BurstInterval −2.9126%`                    |
| `special_powerdistributor_capacity` (Cluster Capacitors) | three capacity legs, one recharge leg | `WeaponsRecharge` and `SystemsRecharge` −2% |
| `special_powerdistributor_fast` (Super Conduits)         | three capacity legs, one recharge leg | `WeaponsRecharge` and `SystemsRecharge` +4% |

Multi-servos is stored under `BurstInterval` for the reason given above — EDSY writes it
as `bstint: -2.9126…`, coriolis as `rof: -0.029126…` under its inverted convention, and
both come to the same +3% rate of fire.

**Excluded: two single-sourced canister magnitudes.** coriolis gives
`special_radiant_canister` an `ammo: -0.25` and `special_shiftlock_canister` a
`damage: -0.2`; EDSY records no magnitude for either, its `special:` text describing only
the gameplay flag ("Area heat increased and sensors disrupted", "Area FSDs reboot"). The
in-game descriptions coriolis carries do say a cost exists ("at the cost of ammo
capacity" / "at the cost of reduced damage"), so the _direction_ is not in doubt — but a
magnitude a single source asserts is worse than this file's standing convention for a
qualitative effect: an empty `modifiers` list and a `description`. Both keep that, and a
numeric modifier is not inferred.

**Excluded: `special_plasma_slug_pa`.** coriolis splits Plasma Slug into a legacy id
(`special_plasma_slug`, named "Plasma slug (Legacy)", damage −20%) and a current
plasma-accelerator id (`special_plasma_slug_pa`, damage −10%). EDSY carries no `_pa` id
at all, and where it has to disambiguate — `edsy.js` `Build.fromCAPI`, importing a
Frontier API loadout — it does so by module type, mapping a rail gun's
`special_plasma_slug` to `special_plasma_slug_cooled`. `Build.fromJournal` looks the id
up straight through with no disambiguation at all. Both paths are evidence that
`special_plasma_slug` is the id the game writes. This repo follows EDSY: one
`special_plasma_slug` at damage −10% / ammo −100%, plus the `_cooled` rail-gun variant.

- **Files:** `blueprints.jsonc` (per-blueprint, per-grade stat modifiers),
  `blueprint-costs.jsonc` (the matching per-grade material requirements),
  `blueprint-merc-coin-costs.jsonc` (the per-roll Merc-Coin amounts the 25 recipes that
  charge a currency bill alongside those materials),
  `blueprint-journal-names.jsonc` (the three recipe ids whose journal spelling collides
  with another recipe), `experimental-effects.jsonc` (special-effect stat modifiers and
  qualitative descriptions), and `experimental-effect-costs.jsonc` (the matching
  one-application material costs).
  Stored modifier labels use journal `Modifier` **Labels**. Each blueprint is `{ name, grades }`
  (each grade `{ features, damageDistribution? }`). The material cost file uses the same
  ids and grades for the craftable subset; fixed reward identities without an ordinary
  cost are absent. The Merc-Coin file is a subset of that subset, with the same ids and
  the same grades again — a recipe charging no currency is absent rather than zero. Each experimental effect is
  `{ name, modifiers, damageDistribution?, description? }`, with its cost file keyed by
  the same effect ids.
- **Display names:** each blueprint and experimental effect carries its `name`.
  Effect names are the English strings observed in-game. Blueprint names are coriolis
  `blueprint.name` for the 81 blueprints coriolis carries, and the Operations dossier's
  display label for the other 26 — the 25 Operations keys and `GuardianModule_Sturdy`,
  which is journal-keyed but absent from coriolis, so its name comes from the Inara
  registry like the Operations keys' own.
  - **These are the short modifier labels, not the full outfitting-panel
    strings — deliberately.** The panel calls `Weapon_LongRange` "Long-Range Weapon",
    `ShieldBooster_HeavyDuty` "Heavy Duty Shield Booster" and
    `Armour_Advanced` "Lightweight Armour"; this catalogue says "Long range", "Heavy
    duty" and "Lightweight". Nearly all 81 differ that way, because a blueprint's name
    is read next to the module it is applied to, where repeating the module's own name
    is noise. The convention is house style and is kept: switching to the panel strings
    would change every blueprint record's `name` for no gain. Two names were wrong in
    their own right rather than short by convention, and take EDSY's spelling —
    `CargoRack_IncreasedCapacity` is **"Expanded Cargo Rack"** (not "Expanded Capacity")
    and `special_choke_canister` **"Ion Disruption"** (not "Ion Disruptor").
- **Blueprint journal names — three collisions, stored separately from mechanics.**
  `blueprint-journal-names.jsonc` maps a recipe id only when the id the game writes for it
  is a key some _other_ record already answers to. The other 104 need no entry for two
  different reasons — 79
  because their key already is the id a journal writes (including Anti-Guardian Zone
  Resistance as `GuardianModule_Sturdy`), and 25 because they are Operations ids for
  which no journal spelling has been observed — 21 of them recipes a module is sold
  already carrying and four recipes a player rolls at an engineer. The three that do are
  `Scanner_LongRange` and `Scanner_WideAngle`, coriolis keys
  for recipes the game writes as `Sensor_LongRange` / `Sensor_WideAngle` — the same ids it
  writes for the sensor suites' own Long Range and Wide Angle, which are different recipes
  — and `MC_Overcharged`, its key for the multi-cannon Overcharged, which the game writes
  as `Weapon_Overcharged` like every other weapon's. The map is deliberately **not** a
  general alias mechanism: it says "the game writes this recipe as X", nothing about
  equivalence, and contains exactly these three records. EDSY publishes the sensor-suite
  and utility-scanner recipes as separate rows with different modifiers but the same
  journal fdnames; its journal importer resolves them by module type. Coriolis supplies the
  distinct stored recipe keys. The multi-cannon split is detailed under Engineering
  options.
- **Blueprint source:** EDCD/coriolis-data,
  `modifications/blueprints.json` (grade `features` + `components`) + `modifications.json`
  (apply method), same commit as above. Each grade's `features` is a list of
  `{ label, method, min, max }`; the modifier value is bounded
  by the engineering quality roll (`v = min + (max − min)·quality`).
- **Material requirements** live on the same grade (`materials`), from that grade's
  `components` map. Coriolis keys components by material **display name**; a join script
  resolves each to the material's Frontier `symbol` against the `materials` domain at
  generation time, emitting `{ symbol, name, count }` per requirement (join `symbol` to
  `materials` for the material's own grade and category). **Kept as-is:**
  `CargoRack_IncreasedCapacity` grade 5 has no components upstream. That absence does
  not establish a zero-cost crafting route: the id describes the two fixed Expanded
  Cargo Rack community-goal articles in `pre-engineered.jsonc`, so it remains in the
  mechanics catalogue for their modifier block but is absent from
  `blueprint-costs.jsonc`.
- **Operations pre-engineered blueprints — from the in-game / Inara blueprint registry**
  (not in coriolis at the acquired commit): the Merc-Coin weapon rewards and the
  general/core/optional recipes (the **Operations keys**, e.g. `FuelScoop_Efficiency`,
  `MultiCannon_Rapid`) plus the Anti-Guardian recipe (grade 1 only).
  - **The registry's `recipe_` prefix is dropped.** Inara publishes these ids prefixed —
    `recipe_fuelscoop_efficiency`, `recipe_modulereinforcement_heavyduty` — but the prefix
    is an Inara listing convention, not part of the Frontier id. Neither menu registry
    uses it: coriolis's
    `modifications/blueprints.json` has **81 keys and not one prefixed**, and `eddb.js`
    contains no `recipe_` string at all (both checked 2026-08-07 UTC). Nor does real export
    data: a SLEF export contributed by the repository owner carries the Mercenary Module
    Reinforcement Package as **`modulereinforcement_heavyduty`** — the registry id minus
    the prefix, in the lower case Inara writes everything in — and across the 181-build
    corpus **not one of 1902 declared engineering entries is prefixed**. So the prefix is
    an Inara listing convention, and these keys are the id with it removed.
  - **The casing is Frontier's, taken from a raw journal.** Inara publishes these ids
    lower-case, but Inara lower-cases _every_ id it exports (`weapon_efficient`,
    `fsd_longrange`), so its casing says nothing. A raw `Loadout` event contributed by the
    repository owner (2026-08-07 UTC) settles it: the game writes `Armour_HeavyDuty`,
    `HullReinforcement_HeavyDuty`, `PowerDistributor_HighFrequency`, `Sensor_LightWeight`,
    `Misc_LightWeight`, `Weapon_HighCapacity` — PascalCase, with the compound words joined
    and each part capitalised. The Operations keys follow that, so
    `recipe_modulereinforcement_heavyduty` is `ModuleReinforcement_HeavyDuty` and
    `recipe_railgun_longshot` is `RailGun_LongShot`. Only the case was changed: no letter
    was added, removed or altered, and word boundaries come from each recipe's own display
    name ("Module Reinforcement Package — Heavy duty").
  - **Seven of these keys are almost certainly not journal ids in any casing.**
    `PowerDistributorS3C2_SupportFocused` and its four siblings, and
    `CargoRackS5C1_Extended` / `CargoRackS6C1_Extended`, embed a module size and class in
    the id. No blueprint Frontier writes is named that way — a journal spells the _module_
    `Int_CargoRack_Size5_Class1` and the _recipe_ separately. They read as Inara SKU ids
    for particular pre-engineered purchases. Dropping the prefix and casing them makes them
    consistent with their neighbours; it does not establish them as journal ids, and no
    observation covers them either way.
  - **No key keeps the `recipe_` prefix, including the Anti-Guardian ones.** Inara
    publishes that recipe twice — `recipe_guardianmodule_sturdy` and
    `recipe_guardianweapon_sturdy` — but its real name _is_ known,
    `GuardianModule_Sturdy`, so neither is a best guess at a journal id the way the other
    Operations keys are. Stripping the prefix makes the first of the two the real key
    itself and the second a weapon-side spelling of a recipe the game writes the module
    way on weapons too. Storing either as a second
    record of the same recipe is rejected: it is a copy that can drift from the one the
    game names, no observed journal, SLEF export or corpus build carries a prefixed id
    (see above), and nothing else in this catalogue keys one recipe twice.

  The registry exposes **one displayed total per grade**, not a roll-bounded range, so each
  feature stores that total as a fixed value (`min == max`).
  The three Plasma conversion recipes also expose equal and opposite damage-share totals.
  Inara labels those player-facing rows **Thermal** and **Plasma**, not with journal
  modifier labels: Thermal decreases by 3.9, 6.6, 9.4, 12.4 and 15.5 percentage points
  across grades 1–5, while Plasma increases by the same amount. This library represents
  the resistance-ignoring ship-damage member as `absolute`, matching EDSY's `abswgt`
  **Absolute Damage** member; the contemporary community description credited in
  `ATTRIBUTIONS.md` likewise identifies this specific conversion's Plasma share as absolute
  damage, and is read as corroboration only — none of its text or media is redistributed.
  Because every eligible laser is 100% thermal before conversion, each grade stores the
  resulting `damageDistribution`: from 96.1/3.9 thermal/absolute at grade 1 through 84.5/15.5 at
  grade 5. Inara does not publish journal spellings for the damage members, and the
  repository contains no raw `Loadout` capture of this blueprint.
  Their per-roll `materials` are from the same registry (resolved to Frontier material
  `symbol`s against the `materials` domain). Where that same crafting-cost table lists a
  per-roll **Merc-Coin** amount beside them — on the 25 recipes named under "Merc-Coin
  crafting cost" below, which is every recipe in this bullet except the Anti-Guardian one
  — the amount is a currency rather than a material, so it is stored separately, in
  `blueprint-merc-coin-costs.jsonc`. Some totals are
  non-monotonic (pre-engineered UI values, not primitive weights — notably the
  Enduring-feedback rail-gun damage and the Balanced-distributor G4 mass) and are
  **preserved as published, not silently "corrected"**. The Merc-Coin **weapon-reward**
  recipes begin at grade 2 because the bought module already contains the grade-1
  pre-engineering; the general/core/optional recipes (fuel scoop, laser plasma-conversion)
  span grades 1–5, and the Anti-Guardian recipe is grade 1 only.

- **Merc-Coin crafting cost — `blueprint-merc-coin-costs.jsonc`.** A recipe that charges a
  currency lists it in the same Inara crafting-cost box as its materials, on a `Merc Coin`
  line carrying an amount and no material link. That amount is stored in its own file, per
  blueprint and per grade, because it is a currency and not a material: folding it into an
  `EngineeringMaterial` list would put something with no `symbol` in the materials domain.
  Amounts are **per roll**, exactly as the material recipes are, so pricing a climb weights
  each grade by its roll count.
  - **25 recipes charge one, and no other blueprint does.** Inara's blueprint index marks
    a charging recipe by rendering its name in the coin colour, and the marked set is
    exactly the 21 bespoke grade-2–5 recipes a bought Mercenary article climbs plus the
    four Operations recipes an ordinary menu lists at grades 1–5 (`FuelScoop_Efficiency`
    and the three `*Laser_ThermalPlasmaConversion`) — 18 marked rows of the 197 the index
    lists, because one published recipe can answer to more than one stored id. An ordinary
    engineer recipe is therefore **absent rather than zero**, and `GuardianModule_Sturdy`
    is absent for the same reason. That index is the whole evidence for the negative half
    of the claim: it is a completeness reading of one listing, not 197 pages checked one
    by one. Acquired 2026-08-22 UTC; the pages are live and expose no immutable revision.
  - **Every row is joined to its `fdname` by its own material recipe, not by name.** Inara
    publishes one page per recipe, keyed by its display name; each of the 18 pages' per-grade
    material lists was compared against `blueprint-costs.jsonc` before its Merc-Coin figures
    were taken, and all 25 rows agree on every grade, every material and every count. That is what
    binds "Rail Gun — Enduring feedback" to `RailGun_LongShot` rather than a guess at the
    display name.
  - **One published recipe, several stored ids, one set of amounts.** Inara publishes a
    single page for Cargo Rack — Extended, Power Distributor — Support focused, Fragment
    Cannon — Double screaming and Seeker Missile Rack — Lockdown, while this repository
    keys each as two or five per-SKU ids (see "Seven of these keys are almost certainly not
    journal ids" above). Those ids already carry **identical material recipes** at every
    grade, from that same one page; their Merc-Coin amounts are identical for the same
    reason, and are not a claim that the sizes were separately observed to cost the same.
  - **A pre-engineered article's shop price is a different number** and stays on the variant
    as `mercCoinCost`: that buys the article at grade 1, while these amounts buy the climb
    above it.
- **Anti-Guardian Zone Resistance is keyed once, as the game spells it.**
  `blueprints.jsonc` stores the one player-facing blueprint under
  **`GuardianModule_Sturdy`** — the id a journal writes, and the only one any engineering
  menu lists. It defines grade 1 only, exposes the `GuardianModuleResistance` activation
  Inara displays as +100%, and costs 2×`TG_Abrasion03`, 1×`TG_CausticCrystal`. Inara's
  `recipe_guardianmodule_sturdy` and `recipe_guardianweapon_sturdy` are that registry's
  spellings of this same recipe and are not stored beside it — see "No key keeps the
  `recipe_` prefix" above.
  - **The journal writes `GuardianModule_Sturdy`, on weapons as well as modules.** A
    `StoredModules` capture contributed by the repository owner (2026-08-07 UTC) carries a
    **Guardian Gauss Cannon** — a weapon — with `"EngineerModifications":
"GuardianModule_Sturdy"`, `Level` 1. So the module spelling is what the game writes
    whichever kind of module the recipe sits on, and there is no evidence the game ever
    writes a weapon spelling: `recipe_guardianweapon_sturdy` is a registry key, not an
    observed journal one. EDSY names the blueprint `GuardianModule_Sturdy` for the same
    reason. `GuardianModule_Sturdy` is therefore the key all nine offering menus list.
- **Anti-Guardian Zone Resistance and Plasma conversion are blueprints, not experimental
  effects.** The Anti-Guardian journal observation puts `GuardianModule_Sturdy` in the
  module's `EngineerModifications` / blueprint position with `Level` 1, and Inara publishes
  it as a grade-1 blueprint with a per-roll material recipe and no experimental-effect slot.
  Frontier's Operations update notes place **Thermal Plasma Conversion** under
  **Blueprints**, and the live Inara pages publish grades 1–5, per-roll materials and the
  ordinary laser experimental effects that can be applied alongside it. Consequently
  `special_guardian_module_resistance` and `special_plasma_rounds` are not incomplete
  effect identities: neither belongs in `experimental-effects.jsonc`. Frontier's
  Operations update-notes thread `648012` was acquired 2026-08-09 UTC; the page exposes
  no immutable revision.
- **Experimental-effect source:** EDSY `eddb.js`
  `expeffect` is the primary source — one table holding each effect's modifiers and its
  recipe together, keyed the way the two local files are. `experimental-effects.jsonc`
  takes its `{ label, method, value }` modifiers; `experimental-effect-costs.jsonc` takes
  its `mats` map, resolved from EDSY's material short-codes to Frontier material `symbol`s
  against the `materials` domain and emitted as `{ symbol, name, count }`. An experimental
  effect is a single application, so that list is the whole material cost.
  - **Cross-checked against coriolis-data** (commit
    `0db9234b5b9ce8c939ea84133d7ce336eea88e27`, acquired 2026-08-01 UTC), which holds the
    same facts split across `modifications/modifierActions.json` (modifiers) and
    `modifications/specials.json` (recipes). All 86 active effects here appear in
    `specials.json`; **84** have a `modifierActions.json` entry to diff against — the two
    that do not, `special_blinding_shell` and `special_smart_rounds`, are qualitative
    records this file stores with no modifiers either. The two sources agree everywhere
    once each one's conventions are accounted for: coriolis stores the four resistances
    as `modmod` percentage points where this file stores fractions (hull and shield boost
    it stores as fractions, exactly as here — it is _EDSY_ that uses points for those),
    names a thruster's or drive's heat `thermload` where the journal Label is
    `EngineHeatRate` / `FSDHeatRate`, and inverts rate of fire as described above.
    The catalogue excludes rows that the source marks as withdrawn or comments out;
    they are not effects offered by a current engineering menu.
  - **What the two sources genuinely disagree on**, beyond the two coriolis-only legs
    noted above: EDSY gives `special_plasma_slug` and `special_plasma_slug_cooled` an
    `ammomax: -100` leg (stored here as `AmmoMaximum −1`, the "reloads from ship fuel"
    mechanic) that coriolis's `modifierActions` does not carry at all; and coriolis
    splits Plasma Slug by weapon family where EDSY does not, discussed next.
- **Weapon-combat experimental effects are carried in full** — 29 of them (Auto Loader,
  Corrosive Shell, Force Shell, FSD Interrupt, Plasma Slug, …). A purely-qualitative one —
  a gameplay flag with no numeric magnitude the data exposes — carries an **empty
  `modifiers` list and a human-readable `description`** instead; effects that do have
  magnitudes carry them (e.g. Force Shell shot speed −16.6667%, FSD Interrupt damage −30%
  / burst interval +50%). A fixed damage-type conversion is carried separately as
  `damageDistribution`, because it is a nested split rather than a scalar modifier.
  Their one-application `materials` are the whole cost. **No experimental effect charges
  Merc Coin**, so nothing is missing beside them: repository-owner in-game confirmation,
  2026-08-22 UTC, no immutable upstream revision. The currency is charged by 25
  **blueprints** and by no effect, so an effect's empty currency cost is a fact about the
  game rather than an omission here — those blueprint amounts are carried, under
  "Merc-Coin crafting cost" above. Every one is a weapon effect, and
  the weapon groups' menus list them.
- **Three effects state a fixed converted damage type.** High Yield Shell, Inertial
  Impact and Overload Munitions produce 50/50 kinetic/explosive, kinetic/thermal and
  explosive/thermal respectively. Applying one replaces the weapon's conventional
  `damageDistribution`.

  `journal-federation-corvette.jsonc` independently settles High Yield Shell, stating
  `$Kinetic;` 100 → 50 and `$Explosive;` 0 → 50 for its large gimballed cannon. The
  three sourced conversions remain a lower bound rather than a count:
  **eleven** of the 40 effects an engineer offers a weapon carry no `description` at all —
  `special_incendiary_rounds` and `special_emissive_munitions` among them — so for those
  the data neither states a conversion nor rules one out.

- **A pre-engineered `_cooled` variant carries its base effect's modifiers as well as the
  cut.** Each `_cooled` rail-gun variant is its base effect **plus** a −40% thermal load,
  so `special_feedback_cascade_cooled` carries damage −20%, `special_plasma_slug_cooled`
  damage −10% and ammo −100%, and `special_super_penetrator_cooled` reload +50% — all
  matching EDSY's `hrgx_*` entries, and `special_incendiary_rounds` its burst interval
  +5.2632%. Storing the thermal cut alone is the easy mistake here. Damage-**type** splits
  (kinetic/thermal/explosive weights) stay in `description` rather than `modifiers`, as
  they do for High Yield Shell and Inertial Impact.
- **Journal Labels** for both sources are resolved via EDSY's own attribute table
  (`attr → fdattr`), the authority for the exact Label strings the game writes
  (e.g. coriolis `optmass` on an FSD → `FSDOptimalMass`, `maxfuel` → `MaxFuelPerJump`).
  Group-ambiguous keys (`optmass`, `optmul`, `thermload`) are disambiguated by the
  blueprint's target module group.
- **The `Decorative_*` transformations EDSY lists are not craftable blueprints.** They are
  real grade-5 ids the game writes in the same field as a blueprint, but name fixed reward
  variants rather than recipes. They are carried in `pre-engineered.jsonc`; see §Festive
  variants below.
- **Blueprint keys deliberately left out:**
  - **Per-module-group aliases, not extra blueprints.** A blueprint that applies to several
    module groups is exposed once per group under a `recipe_sensor_<group>_<mod>`-style
    key whose display name points back at the canonical blueprint — for example the
    long-range sensor modification appears once for sensors and again for each scanner
    type. The blueprints they point at are already stored under their journal
    `BlueprintName`s (`Sensor_LongRange`, `Misc_LightWeight`, …). Storing the aliases would
    multiply one blueprint into many identical records. **Three keys are the exception and
    are not journal names**: `Scanner_LongRange` and `Scanner_WideAngle`, coriolis's split
    of a recipe the game writes as `Sensor_LongRange` / `Sensor_WideAngle`, and
    `MC_Overcharged`, its split of the one the game writes as `Weapon_Overcharged`. They
    are kept because each rolls different numbers from the record it shares a journal id
    with — the scanner side against the suite side, the multi-cannon's clip penalty against
    no penalty at all — and each has its journal spelling in the collision map. See the next bullet,
    and §Scanner Long Range and Wide Angle and §Multi-cannon Overcharged under Engineering
    options.
  - **Generic community-goal and tech-broker wrappers** ("Unique Modification", "Unique
    Enhancement") — reward placeholders that carry no grades or features.
  - **Effects with no published magnitude** are not stored with invented numbers. Where a
    qualitative effect _is_ published with a recipe it is carried with an empty `modifiers`
    list and a `description`, as described above; where neither a magnitude nor a recipe is
    published, it is left out entirely.
- **Material costs:** `blueprint-costs.jsonc` preserves coriolis's material components per
  roll and grade; `experimental-effect-costs.jsonc` preserves EDSY's one-application
  recipes. Material display names are resolved against the materials domain while retaining
  the upstream Frontier symbols and counts.

## Engineering options (what each module can take)

- **File:** `engineering-options.jsonc`.
- **Availability is a property of the module, not of the blueprint.** A Pulse Laser and a
  Rail Gun both take the Efficient blueprint but offer different experimental effects, so
  "which experimentals go with blueprint X" has no single answer. Modules are therefore
  grouped (48 groups covering 1005 ordinary engineering menus) and each group lists the
  `blueprints` and `experimentals` it offers.
- **Source:** EDSY `eddb.js`, whose module-group tables carry each group's `blueprints`
  and `expeffects` lists and which modules belong to each group, and whose module records
  carry the per-module `noblueprints` / `noexpeffects`
  denials that narrow either list. Second registry: coriolis-data
  `modifications/modules.json`, which carries the same per-group lists keyed by the
  journal `BlueprintName`s this catalogue joins on.
- **Coverage: every retained group EDSY's `mtype` table gives a `blueprints:` key.** After
  the corrections below, that is 48 groups over 1005
  modules, including
  bulkheads (the 241 ship armour records), life
  support, sensors, the Detailed Surface Scanner, refineries, AFMUs, fuel
  scoops, FSD interdictors and boosters, Guardian module and shield reinforcement, the
  four engineerable limpet controllers, chaff, heat sink and caustic sink launchers,
  point defence, ECMs, the KWS/manifest/wake scanners, and the Guardian
  Gauss/Plasma/Shard weapons.
  - **A group is one menu, so `noblueprints` splits a family in two.** EDSY denies
    blueprints per module as well as per group (`edsy.js` `setBlueprintID` refuses a
    denied id; `'*'` means the module is not modifiable at all), and for three families
    the denial is a clean two-way split: a Guardian Power Plant is denied all three
    ordinary power-plant recipes and an ordinary one is denied Anti-Guardian Zone
    Resistance, and the same holds for the power distributors and the hull reinforcement
    packages. Those are stored as **two groups** — `powerPlants` /
    `guardianPowerPlants`, `powerDistributors` / `guardianPowerDistributors`,
    `hullReinforcements` / `guardianHullReinforcements` — rather than as a per-module
    exception, because a group _is_ a menu and these are two menus. Reading the
    registries alone would give the Guardian halves their ordinary twin's experimental
    list, since `expeffects` is published per group with no per-module denial on any of
    them; that they carry none is recorded further down, under "A Guardian module has no
    experimental slot".
  - **The ordinary halves must not list `GuardianModule_Sturdy`**, which is an
    Anti-Guardian recipe on a non-Guardian module and EDSY denies it. `powerPlants`,
    `powerDistributors` and `hullReinforcements` therefore hold ordinary modules only,
    and the 25 Guardian ones sit in the three groups above.
  - **14 modules are absent from the registry-derived result because upstream denies them
    every blueprint:** eight AX multi-cannons, five of the seven mining tools, and the Mk II
    Plasma Shock Accelerator. The two gimballed AX multi-cannons are removed by the in-game
    correction below, while `plasmaAccelerators` retains 4 of its 5 modules. The other two mining tools
    are the manually corrected Mining Laser and Abrasion Blaster below, so all seven lack
    an ordinary menu and the empty `miningToolsLasers` group is not retained.
    The ten plain Module Reinforcement Packages are denied their family's only recipe
    and are absent too, which leaves `moduleReinforcements` holding the ten Guardian
    packages.
  - **The 194 modules absent have no ordinary engineering menu.** For 171 this comes from
    the pinned registries. Whole families first, both registries
    agreeing: fuel tanks, passenger cabins, the repair/recon/research/decontamination and
    multi-limpet controllers, meta-alloy and ordinary module reinforcement, the Pulse Wave
    Analyser, the mining launchers, Shock Cannons, Nanite Torpedo Pylons, fighter and
    vehicle hangars, the docking computers and Supercruise Assist, the module stabilisers,
    the planetary approach suites, the cargo hatch and
    the AX utility modules (Xeno Scanners, Shutdown Field Neutralisers), followed by the
    individually denied modules described above. The other 23 are the five weapons, fixed
    Mining Laser, Abrasion Blaster and 16 cargo racks corrected from the registry-derived
    result below.
    They and the size-5 class-2 Module Reinforcement Package within the registry-derived
    171 have no stock menu, but qualifying Mercenary articles remain upgradeable through
    their bespoke recipes.
  - **EDSY's `_X_` prefix means "not applicable" and is honoured**, not stripped: the
    Detailed Surface Scanner's group lists only `iss_er` (`Sensor_Expanded`), because its
    three other entries are `_X_`-marked. The `Decorative_*` entries on the remote-release
    launchers are dropped for the same reason `blueprints.jsonc` does not carry them: a
    decorative transformation names no recipe, and no engineer applies one. So a
    launcher left with only those entries is offering nothing, and its `noblueprints`
    reading holds — carrying one already transformed is not the same as being
    engineerable. §Festive variants has the evidence.
  - **Where EDSY records one generic id and the journal writes a family-specific one,
    coriolis-data settles it.** EDSY collapses Lightweight, Reinforced and Shielded to
    `misc_lw` / `misc_rf` / `misc_sh` for eight families; coriolis keys the same lists by
    the journal `BlueprintName` this catalogue joins on, so life support lists
    `LifeSupport_LightWeight`, an AFMU `AFM_Shielded`, a fuel scoop `FuelScoop_Shielded`,
    a refinery `Refineries_Shielded` and each limpet controller its own. **This is not
    cosmetic for the scanners:** EDSY's `scan_lr` and `cs_lr` share the fdname
    `Sensor_LongRange`, but `Scanner_LongRange` is a different recipe (power draw, not
    mass; a larger range roll), so the utility scanners take the `Scanner_*` ids for Long
    Range and Wide Angle where the sensor suites take the `Sensor_*` ones. (Their other
    four ids are unaffected: `Sensor_FastScan` and the generic `Misc_*` trio, exactly as
    coriolis has them.) The shared fdname is not a defect in EDSY's table, and §Scanner
    Long Range and Wide Angle below is what follows from that. Eleven groups carry a
    substitution; the substituted lists are then checked against coriolis's own, as are
    the nine further groups it carries a list for —
    20 in all, every one an exact match. Chaff, heat sink, point defence and ECMs keep the
    generic `Misc_*` ids: there coriolis agrees with EDSY.
  - **Nine retained groups rest on EDSY alone**, because coriolis carries no blueprint list for
    them at all: the Guardian-only groups (`guardianPowerPlants`,
    `guardianPowerDistributors`, `guardianHullReinforcements`, `moduleReinforcements`,
    `shieldReinforcements`, `fsdBoosters`, `guardianGauss`, `guardianPlasma` and
    `guardianShard`). That is coriolis being
    silent rather than contradicting — its Guardian groups are empty objects — but it
    means the second registry corroborates 39 of the 48 groups, not
    all of them. The Guardian-weapon menus are independently settled by the in-game
    observations below: stock weapons take Anti-Guardian Zone Resistance alone, while
    the pre-engineered articles are final.
  - **The multi-cannon Overcharged is the one place a group follows coriolis over EDSY.**
    EDSY has a single Overcharged for every weapon; coriolis splits it, and `multiCannons`
    lists coriolis's `MC_Overcharged`. See "Multi-cannon Overcharged: one journal id, two
    recipes" below for the evidence and for what the split costs.
  - **The groups name 85 of the 107 blueprints.** Of the other 22, 21 are Operations keys
    of modules sold already engineered rather than offered in a menu; the last is the
    fixed Expanded Cargo Rack reward identity. Four Operations keys _are_ named by a
    group, because they are recipes a player applies — see "Four Operations recipes are
    listed by a menu" below.
  - **14 modules are bound by the family rule, not by a source row.** EDSY has no live
    entry for `Int_Hyperdrive_Size8_Class{1..5}` or `Int_ShieldGenerator_Size1_Class4`
    (both present but commented out, and both naming their `mtype` — `cfsd` and `isg`),
    nor for eight of the `*_free` starter fittings. Each takes its family's group, on the
    same rule the stats above use: a `*_free` variant is its priced twin bar the price,
    and a size-8 drive is a drive. `Int_FuelTank_Size1_Class3_free` is not bound because
    fuel tanks are not engineerable.
- **Corpus evidence does not override `noblueprints`.** Two corpus builds declare
  `Weapon_Efficient` on the Mk II Plasma Shock Accelerator, while EDSY denies that module
  every blueprint (`noblueprints: {'*'}`). Coriolis publishes only the group-level menu
  and cannot settle the module-specific denial. The catalogue follows EDSY because a
  build declaration is not evidence that the blueprint can be applied in-game.

- **File order is derivable:** `modules` is written group by group in the order `groups`
  declares them, and within a group in module-catalogue order, so a re-derivation from the
  same sources reproduces the file rather than reshuffling it.
- **`exclusions` are the exceptions, and they are real.** 23 modules take their group's
  blueprints but not all of its experimental effects: 13 Multi-cannons cannot take Phasing
  Sequence, six dumbfire racks cannot take Drag Munitions, four missile racks are short of
  Penetrator Munitions or FSD Interrupt. Upstream these are an exclusion map. A module
  absent from `exclusions` takes its whole group's list. All seven mining tools
  that would otherwise be listed here are absent from the catalogue entirely, taking no
  ordinary blueprint either.
- **The fixed Mining Laser and Abrasion Blaster have no ordinary engineering menu.** Both
  are removed from `modules`, despite EDSY assigning them to `miningToolsLasers` with
  `Weapon_LongRange`; the Abrasion Blaster is also removed from `exclusions`, where EDSY
  denies the group's experimental effect. Direct in-game menu confirmation recorded
  2026-08-15 UTC establishes that neither stock article can receive ordinary engineering;
  there is no immutable revision for an in-game observation. Their `Weapon_LongRange`
  grade-5 states are separately catalogued reward articles with hand-set modifiers that
  identify rather than reproduce them. This does not remove the Mercenary routes: both
  are acquired at grade 1 with bespoke recipes (`MiningLaser_LongRange` and
  `AbrasionBlaster_FarReaching`), whose sourced grades 2–5 remain applicable through the
  `pre-engineered.jsonc` purchase records. A re-derivation from EDSY must reapply this
  correction by dropping both module mappings, the now-empty `miningToolsLasers` group,
  both projected `kind` fields in `modules-hardpoint.jsonc`, and the Abrasion Blaster's
  now-unreachable experimental exclusion.
- **Expanded Cargo Rack is a fixed reward identity, not an ordinary cargo-rack recipe.**
  EDSY and coriolis expose `CargoRack_IncreasedCapacity` as the grade-5 identity carried
  by the size-5 and size-6 community-goal articles catalogued in `pre-engineered.jsonc`.
  Direct in-game menu confirmation recorded 2026-08-18 UTC establishes that none of the
  16 stock cargo-rack identities — ordinary, corrosion-resistant, or Mk II — has an
  ordinary engineering menu; there is no immutable revision for an in-game observation.
  The fixed articles keep their sourced modifier blocks and remain identifiable without
  granting the same state to a stock rack. A re-derivation must drop the `cargoRacks`
  group, all 16 module mappings, and the corresponding projected `kind` fields in
  `modules-internal.jsonc`.
- **The Enzyme Missile Rack and AX weapons have no ordinary engineering menu.** Direct
  in-game confirmation recorded 2026-08-18 UTC establishes that the Enzyme Missile Rack,
  both plain fixed AX Missile Racks and both gimballed Enhanced AX Multi-Cannons cannot
  receive ordinary engineering; there is no immutable revision for an in-game observation.
  The Enzyme Missile Rack bought from a Mercenary contact at grade 1 remains upgradeable
  through grades 2–5 of its bespoke `EnzymeMissileRack_HighYield` recipe. Its separately
  catalogued grade-5 High Capacity community-goal article is final. The Enhanced AX
  Multi-Cannons and AX Missile Racks in `pre-engineered.jsonc` are fixed tech-broker
  variants and cannot be engineered further. All five fixed articles carry
  `engineeringLocked: true`; the multi-cannons retain Frontier's journal identity
  `Weapon_Overcharged`, not the ordinary multi-cannon menu key `MC_Overcharged`. A
  re-derivation must drop the
  `experimentalWeapons`, `antiXenoMissileRacks` and `antiXenoMultiCannons` groups, their
  five module mappings and the corresponding projected `kind` fields in
  `modules-hardpoint.jsonc`.
- **An empty experimental menu is still distinct from no menu.** 27 of the 48 groups offer
  no experimental at all, so 368 of the 1005 grouped modules have an empty experimental
  list while retaining blueprints.
- **Key form:** the Anti-Guardian blueprint is listed under `GuardianModule_Sturdy`, the id
  a Loadout writes and the one EDSY uses — the same and only spelling `blueprints.jsonc`
  keys it under.
- **Anti-Guardian Zone Resistance carries no experimental effect.** All nine groups
  offering `GuardianModule_Sturdy` store `"experimentals": []`, including
  `guardianGauss`, `guardianPlasma` and `guardianShard`.
  - There are no pre-engineered Guardian module reward variants. The seven Guardian
    variants are weapons, whose ordinary recipes identify final purchases rather than
    engineer rolls.
  - **Neither registry publishes this, and a re-derivation will not reproduce it.**
    `expeffects` is published **per module group** by both — EDSY has no per-blueprint
    field and coriolis-data's `specials` sits beside `blueprints` rather than inside one —
    so a group offering exactly one blueprint still names the whole family's effects, and
    nothing in either file says a Guardian menu is narrower. Read EDSY alone and the three
    Guardian groups come back carrying their ordinary twin's list. This is a game fact
    recorded here, and it has to be reapplied after any re-derivation.
  - **Source:** a maintainer report of the in-game engineering menu, recorded 2026-08-07
    UTC — the same standing as the module-price and restricted-mount observations recorded
    above. There is no upstream
    revision to pin, because no registry publishes the fact; neither contradicts the
    report either, both being silent.
  - **The corpus neither corroborates nor contradicts the Guardian-module families.** None
    of the build corpus's 1902 declared engineering entries engineers a
    Guardian power plant, distributor or hull reinforcement package at all. Its
    Guardian-weapon entries are final pre-engineered articles, a separate case recorded
    below.
  - The 25 modules in the three split families above (`guardianPowerPlants`,
    `guardianPowerDistributors` and `guardianHullReinforcements`) therefore carry no
    experimental effects in the catalogue at all. Blueprints are unaffected on every
    module.
- **Multi-cannon Overcharged uses a distinct stored key.** The `multiCannons` menu lists
  `MC_Overcharged`; other weapon menus list
  `Weapon_Overcharged`. Coriolis `modifications/modules.json` assigns the first key to
  multi-cannons and the second to six other weapon groups, while
  `modifications/blueprints.json` gives both the journal fdname
  `Weapon_Overcharged`. The recipes differ only in the `AmmoClipSize` reduction carried
  by `MC_Overcharged` (−3% at grade 1 through −15% at grade 5).
  `modifications/blueprints.json` was acquired 2026-08-07 UTC and has SHA-256
  `cba5a11fc7728e0d1da63fcbbc8d9dfedf9fbc51c99692ee187c7bf0293b3fa1`.
  - EDSY uses one `wpn_oc` recipe and includes the clip reduction on every listed
    multi-cannon group.
  - Frontier journal captures independently show `Weapon_Overcharged` without an
    `AmmoClipSize` modifier on a large gimballed cannon
    (`journal-federation-corvette.jsonc`), a medium fixed fragment cannon
    (`journal-federation-corvette-plasma.jsonc`) and a medium fixed plasma accelerator
    (`journal-caspian-explorer.jsonc`). Their recorded grades, qualities and other
    modifier legs reproduce the published recipe values. EDEngineer's
    `blueprints.json` likewise assigns the clip reduction to multi-cannon types and not
    to cannon, fragment-cannon or plasma-accelerator types.
- **An ordinary recipe on a Guardian weapon identifies a final purchase, not an engineer
  roll.** The three Guardian weapon groups list **only** Anti-Guardian Zone Resistance,
  exactly as the six Guardian _module_ groups do. `Weapon_RapidFire` on `guardianGauss`,
  `Weapon_Overcharged` on `guardianPlasma` and `Weapon_LongRange` on `guardianShard`
  describe sold variants, not recipes a player can roll at an engineer. The bought or
  awarded articles are final: unlike their stock counterparts, they cannot even take
  Anti-Guardian Zone Resistance. Two independent bodies of real data and the repository
  owner's in-game verification (2026-08-09 UTC; no immutable revision) support that
  distinction:
  - A 521-module `StoredModules` capture (2026-08-07 UTC) holds **20** Guardian weapons
    carrying an ordinary recipe. Every one is a **Fixed Small or Fixed Medium** variant that
    `pre-engineered.jsonc` already records as _sold_ carrying that exact recipe. No Large
    and no Turret variant carries one, and exactly one Guardian weapon in the whole capture
    carries `GuardianModule_Sturdy` — the only recipe a player can actually roll onto it.
  - The 181-build community corpus adds **18** final articles: 5× and 2× Guardian Plasma
    Launcher Fixed Medium/Small with `Weapon_Overcharged`, 6× Guardian Shard Cannon Fixed
    Medium with `Weapon_LongRange` and `special_super_penetrator_cooled`, and 5× Guardian
    Gauss Cannon Fixed Medium with `Weapon_HighCapacity`. The declarations describe the
    pre-engineered articles as exported by the build tools; they do not expand either
    stock weapon's engineering menu.

  So these recipes reach the weapons only as **pre-engineered identities**, and no menu
  lists them: `pre-engineered.jsonc` marks all seven catalogued Guardian-weapon variants
  `engineeringLocked: true`, and the 18 build-corpus entries that name one are final
  articles rather than recipes a player may apply.

- **Four Operations recipes appear in engineering menus:** `FuelScoop_Efficiency` on
  `fuelScoops`, plus `PulseLaser_ThermalPlasmaConversion`,
  `BurstLaser_ThermalPlasmaConversion` and `BeamLaser_ThermalPlasmaConversion` on their
  respective laser groups. Inara publishes these as grades 1–5 with per-roll material and
  Merc-Coin costs, distinguishing them from the grade-2–5 reward recipes. The recipe names
  identify the module families, and their modifier fields match those families. The live
  Inara pages were acquired 2026-08-09 UTC; no immutable revision is exposed.

## Pre-engineered modules

### Festive variants

- **File:** `pre-engineered.jsonc`. Three grade-5 records pair
  `Hpt_FlakMortar_Turret_Medium` with `Decorative_Green`, `Decorative_Red` or
  `Decorative_Yellow`, the same fixed-variant relation used by the other records.
- **Source:** [issue #53](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/53)
  preserves the three relevant lines from a repository-owner `StoredModules` capture
  (521 stored modules, 2026-08-07 UTC): one medium turreted Remote Release Flak Launcher
  per colour, carrying `Decorative_Green`, `Decorative_Red` or `Decorative_Yellow` in
  `EngineerModifications`. The full capture is not checked into this repository. The
  repository owner's direct in-game reading supplies grade 5. Those three are the only
  ones of the capture's 46 distinct spellings reported not to name a recipe; every other
  spelling, down to the lower-case `weapon_longrange` written on a Guardian Shard Cannon,
  resolves against the blueprint catalogue. The festive identities have no material cost
  or applying engineer, so they are fixed transformations rather than craftable recipes.
- **They are not cosmetic-only: each carries a −99% `Damage` modifier.** A festive launcher
  fires fireworks rather than flak. The repository owner's outfitting panel reads −99.0%,
  0.3 damage and 0.2 damage/s. The medium turreted launcher's 34 base damage becomes 0.34,
  displayed as 0.3; at 0.5 shots/s that becomes 0.17, displayed as 0.2/s. An overwrite to
  0.3 would instead display 0.1/s, so the stored method is multiplicative. EDSY lists the
  transformations but omits this modifier.
- **Engineering availability:** the launchers were awarded already transformed; no
  engineer applies the transformation. The acquisition route is the contributor's
  account, not a field in the capture.
- **The records bind the transformation to what has been observed.** The medium turreted
  Remote Release Flak Launcher (`Hpt_FlakMortar_Turret_Medium`) is the only module the
  public capture excerpt shows carrying one, so it is the only base symbol paired with these identities.
  Nothing in the evidence supports applying `Decorative_*` to an arbitrary damage-bearing
  module.
- **`name` pairs the festive naming with the launcher and the id's colour.** No registry
  publishes the outfitting panel's own string: EDSY carries the transformation, not a
  label. The festive names come from the repository owner's account.

### Other pre-engineered variants

- **Guardian coverage is complete.** There are no pre-engineered Guardian power plant,
  distributor, hull-reinforcement, module-reinforcement, shield-reinforcement or
  FSD-booster reward variants, so the absence of an `Int_Guardian*` row is deliberate. The
  catalogue's seven Guardian rows are all weapons (Gauss, Plasma and Shard), each with a
  `blueprint` and no `experimental`. Source: maintainer confirmation recorded 2026-08-12
  UTC; there is no immutable upstream revision.
- **Records:** pair a base module `symbol` with its published pre-engineered identity:
  `{ symbol, name, blueprint, grade, acquisition }`, plus any sourced stat block and
  price. The game reports these articles under the base module symbol rather than a
  distinct variant symbol.
- **`acquisition` says where each remaining variant comes from.** 73 records: 22 `mercenary`,
  30 `communityGoal` and 21 `techBroker`.
  - **`mercenary`** — the Merc-Coin shop rows. Source: the in-game outfitting and
    blueprint registries, cross-checked against Inara's outfitting and blueprint registries
    acquired 2026-08-07 UTC (no immutable revision exposed) and Frontier's update notes.
    All 22 are grade 1, and that is the point: the
    purchased module already
    contains the grade-1 pre-engineering, which is exactly why these blueprints' own
    recipes start at grade 2 (see the Operations section above). The two facts are
    consistent by construction: material costs for further engineering begin at grade 2.
    - **The large Seeker Missile Rack's Lockdown** is a `mercenary` row on
      `Hpt_BasicMissileRack_Fixed_Large` at **900 MC**, taking the shop total to 13 900 MC.
      Four things agree, none of them a guess about a module symbol: the registry keys
      Lockdown by _size_ and the twin `SeekerMissileRackMedium_Lockdown` binds to the medium
      rack; the large rack is already a Merc row for `SeekerMissileRack_Drag`, so the shop
      stocks it; both Lockdown recipes run grades 2–5, the weapon-reward range that marks a
      module as bought pre-engineered; and it is the only grade-2–5 Operations recipe in the
      file
      that would otherwise have no row, all 20 others having one. Price and size confirmed
      2026-08-07 UTC against an index of the Inara outfitting listing, which
      reports the MERC Lockdown Seeker Missile Rack [Fixed] at 900 MC for the 3A and 800 MC
      for the 2B. This is an index reading rather than a pinned page capture. Both halves check
      against rows already here — the large rack is 3A and its other Merc row is 900 MC, the
      medium is 2B and its Lockdown row is 800 MC — and that corroboration is what carries
      the weight.
  - **`communityGoal`** — modules awarded for taking part in a community goal. Source:
    EDSY's stored-module presets, which record each reward as an encoded module state; the
    blueprint, grade and experimental effect were
    decoded from that state rather than inferred from its display label. All ids join to
    the blueprint, experimental-effect and module catalogues. 28 of the 30 are grade 5;
    8 carry an experimental effect. Acquired 2026-08-01 UTC.
  - **`techBroker`** — modules unlocked at a tech broker, from the same EDSY presets and
    decoded the same way. Human brokers stock the "V1" drives, the SCO drives and a
    seeker rack; the Guardian weapon rows come from the Salvation, Azimuth and Sirius
    brokers. 14 of the 21 are grade 5 — the seven grade-1 rows are the Guardian weapons
    and a heat sink launcher, where the blueprint named does define a grade 1, so the
    grade is a real grade of a real recipe rather than the Merc-shop convention.
    Acquired 2026-08-01 UTC.
  - **One route per row, not every route.** The source records a single tag per preset
    and several rows are annotated as having been obtainable both ways — the six SCO "V1"
    drives most obviously. `acquisition` records the tag; it is not a claim that no other
    route ever existed.
- **`engineeringLocked: true` marks 12 final weapon rows:** the seven pre-engineered
  Guardian weapons and the five fixed Enzyme/AX articles. Their evidence is recorded once
  under Engineering options.
- **A reward variant is not reproducible by engineering the same blueprint.** Alongside
  its blueprint and effect, each reward carries hand-set modifier overrides no blueprint
  grants — that is what makes it a reward rather than a shortcut. The `blueprint` /
  `grade` / `experimental` recorded here **identify** the variant; they are not a recipe
  that recreates it. The ordinary blueprint material recipe does not price the reward.
- **Two community-goal rewards are not stored:** the size-5 and size-6 Corrosion
  Resistant Cargo Racks carry no engineering at all. They already exist as ordinary
  module records (`Int_CorrosionProofCargoRack_Size{5,6}_Class1`), so there is no pairing
  to record.
- **`mercCoinCost` is the shop price in Merc Coin**, on the 22 `mercenary` rows and
  nowhere else. Source: the in-game outfitting registry, with the variants and prices
  corroborated by Inara's outfitting registry acquired 2026-08-07 UTC; no immutable
  revision is exposed.
  Merc Coin is a separate currency with no credit equivalent, which is why it is its own
  field rather than the `cost` modules carry. Tech-broker unlocks have no equivalent
  number: they are paid in materials and commodities, so nothing is stored for them.
- **`modifiers` is the hand-set stat block a reward variant arrives with** — what makes
  these records fittable rather than merely catalogued. Same vocabulary as a blueprint
  feature: a journal Modifier `label`, a `method` (`multiplicative` / `additive` /
  `overwrite`) and a `value`. Decoded from the same EDSY preset state as the blueprint
  and grade, then translated into the Almanac's own vocabulary — EDSY's attribute names
  map to journal Modifier Labels through its own table, and resistances, which EDSY
  stores in a different form from this repo, are converted using the module's base
  resistance. 51 rows carry one; the 22 `mercenary` rows do not, because no registry
  publishes the grade-1 pre-engineering they arrive with and a guess is worse than an
  omission.
  - **Values are the authored decimals, recovered rather than rounded.** The presets
    encode modifiers in EDSY's custom 20-bit float (1 sign, 5 exponent, 14 mantissa),
    which carries about fifteen significant bits — so decoding a change the game states
    as `+20%` yields `0.199997`. Rounding that by eye would be a guess, so instead each
    value is the **shortest decimal that re-encodes to the identical 20 bits**: the
    figure the encoder was originally given, checked by re-encoding rather than assumed.
    All 51 stat blocks recover exactly; a value with no short round-tripping form would
    have been kept as decoded, and none needed it. This is what makes the 5A "FSD V1"
    resolve to a whole 1785 optimal mass (from `+0.7`) instead of 1785.0126 (from
    `0.699988`).
  - **…except where the game authored a _stat_, not a multiplier.** Recovering the
    multiplier is the right move only when a multiplier is what was written down. The
    tech-broker "Modified Guardian Shard Cannon" is 3000 m range with falloff from
    1500 m — round numbers — but no short multiplier on a 1700 m base reproduces them, so
    the best recovery still read 2999.99 m and 1499.995 m. These are found with the same
    round-trip discipline applied one level up: round the **resulting stat**, derive the
    multiplier it implies, and re-encode. Where that lands on the stored bits (within the
    encoder's own one-unit rounding), the source cannot tell the two apart and the round
    stat is what was authored, so it is stored as an **`overwrite` of the stat** — exact,
    and the shape a journal reports a pre-engineered modifier in anyway. **14 modifiers**
    across 7 modules are stored this way, and the file holds 20 `overwrite` modifiers
    over 11 modules in all.
    Worth stating plainly, because the blueprint name invites the opposite reading: the
    Shard's `MaximumRange` ×1.7647 with `FalloffRange` ×0.88235 is **not** a Long Range
    roll of any grade. It is a bespoke stat block, as every reward variant's is.
    Frontier's `journal-anaconda-slapaconda.jsonc` capture directly reads the medium
    variant's projectile speed as 6299.208984 m/s. The stored overwrite is the authored
    decimal **6299.209 m/s**, with the journal residue treated as float noise, instead of
    EDSY's 3568.6 m/s preset-derived result for that field. The fixed-medium
    base damage of 3.7235 reproduces the same article's panel without a separate damage
    modifier: it displays as 3.7, and its 12 projectiles at 1.666667 shots/s display as
    74.5 damage/s.
    - **The guard that matters:** an `overwrite` is absolute, so it is only applied where
      _this repo's_ base agrees with the one the stat was inverted against. The Guardian
      Gauss Cannon's damage fails that check and stays multiplicative. EDSY's preset uses
      stock damage 40 / 70 for the small / medium cannons; current in-game module panels
      read 22 / 38.5, which the module catalogue now stores. Converting EDSY's resulting
      stat to an overwrite would therefore import its disproved stock value under cover of
      a rounding fix. The relative quarter-damage transformation remains usable without
      doing that; an absolute value would require a reading of the pre-engineered article
      itself.
  - **Burst interval has to be added to the decoder's output by hand.** EDSY carries no
    journal Label for `bstint` — the journal reports the resulting `RateOfFire`, never the
    interval it comes from — so a straight decode drops it, leaving the 13 variants that
    change a burst pattern on the _stock_ cadence, and four of them (the two frag cannons
    and the two Guardian gauss cannons) inconsistent as well as slow, carrying the
    engineered `BurstSize` — and, on the gauss cannons, the engineered `BurstRateOfFire` —
    against a stock interval. All 13 are stored under **`BurstInterval`**, the same label
    the Rapid Fire and High Capacity blueprint features use (see the Engineering section
    above), and it is the file's one departure from what the decoder emits: re-running the
    decoder over the same EDSY revision reproduces every other byte.
  - **Where the two references disagree about a pre-engineered weapon, this file follows
    EDSY.** coriolis models 29 pre-engineered modules as separate module records with
    their own observed stats rather than as modifiers, so the two can be compared. On the
    medium rail gun and the medium multi-cannon they agree within about 10% (0.3225 s
    against 0.36 s, 0.100 s against 0.1115 s). On the Guardian gauss cannons they do not:
    EDSY gives a four-round burst at 10 /s on a 0.5126 s interval with a quarter of the
    stock damage, thermal load and distributor draw, and coriolis a single shot on a
    1.15 s interval at reduced damage (9.6 on the small, 18.3 on the medium) with
    **stock** thermal load and distributor draw. Since
    the pre-engineered gauss cannon's defining property is that it runs cool, coriolis's
    record looks like the incomplete one; EDSY's also conserves the stock weapon's damage
    per cycle, which coriolis's does not. The two sources also disagree on the variant's
    damage, clip size and ammunition, independently of the restored interval.
- **Not included:** engineered modules that are one-off mission or salvage rewards rather
  than a repeatable outfitting row. They have no stable catalogue row.
