# Data sources — `data/ships/`

Each section records the source, acquisition date, immutable revision or checksum,
derivation and manual corrections for the catalogue it describes. See
`../SNAPSHOTS.md` for the provenance requirements.

## Upstream snapshots this domain is pinned to

Referred to throughout by source name; the pin is here, once.

| Source                                                                                                                                                   | Pin                                                                                                                                                                         | Acquired       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) — `shipyard.csv`, `outfitting.csv`                                                                       | no immutable revision recorded                                                                                                                                              | 2026-07-24 UTC |
| [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) — `ships/*.json`, `modules/**`, `modifications/*`                                            | commit `0db9234b5b9ce8c939ea84133d7ce336eea88e27`                                                                                                                           | 2026-07-24 UTC |
| coriolis-data `modifications/modules.json`                                                                                                               | SHA-256 `09b6427c86bc3cfb578a246f7c6be1791429bb67009b7adaa7909e30aadc160f` — read from the branch tip, so pinned by digest                                                  | 2026-08-05 UTC |
| [EDSY](https://github.com/taleden/EDSY) `eddb.js`                                                                                                        | commit `cd68edfba665719958ce038b6e5d9eb02d0d2b02`, SHA-256 `967834d65a75ab1dea4bbaa7e1d6674cbe4083dca03f770d058497e9f7693071`, internal `db 20260428` / `version 423039901` | 2026-08-02 UTC |
| EDSY `eddb.js` — Vessel Hangar variants                                                                                                                  | commit `510468167e0ef3b895e39391a8c56b5cdd5c3282`, SHA-256 `0574db06f796cdf7dfbe20a5f89f8a378e692873ae49133e9b49557fe8d8cba3`                                               | 2026-08-09 UTC |
| [EDSY](https://github.com/taleden/EDSY) `edsy.js`                                                                                                        | SHA-256 `a40e9bbe65d482a029527d6dc2abdbd1819672e5a5d4a3a4d88ea411f02575f5` — read from the branch tip, so pinned by digest                                                  | 2026-08-06 UTC |
| [Odyssey Materials Helper](https://github.com/jixxed/ed-odyssey-materials-helper) CAPI fixture `application/src/test/resources/parser/capifc/test9.json` | commit `2c652a2349b754f1dde1a58b6daaac5a04e421a6`                                                                                                                           | 2026-08-09 UTC |
| [EDCD/Coriolis](https://github.com/EDCD/coriolis) — the application, for its formulas                                                                    | commit `68c042ca6e3db62372cbbb2077cf972345511712`                                                                                                                           | 2026-08-01 UTC |
| [msarilar/EDEngineer](https://github.com/msarilar/EDEngineer) `EDEngineer/Resources/Data/blueprints.json`                                                | SHA-256 `787e6bd0579264d7b4615a281318792cb212285786f4ae07f61ec1cc464cdec0` — read from the branch tip, so pinned by digest                                                  | 2026-08-08 UTC |
| Elite Dangerous in-game verification                                                                                                                     | observed in-game                                                                                                                                                            | 2026-08-08 UTC |

Every `eddb.js` derivation uses the baseline snapshot unless its catalogue note names
the Vessel Hangar snapshot.

**Licence positions, once.** FDevIDs states none — consult the repository terms before
redistributing the raw identifiers. coriolis-data's and Coriolis's MIT licence covers
their _code_; their JSON values do not fall under it, and EDEngineer's MIT licence sits
the same way. EDSY is © taleden under
[CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/). The stat, slot and
price values in this directory are Elite Dangerous game data, the property of Frontier
Developments plc, redistributed under [Frontier's media-usage
terms](https://forums.frontier.co.uk/threads/510879/).
Odyssey Materials Helper is MIT-licensed; the CAPI response used here is factual game
output rather than project-authored code.

**Some values come from no registry at all** — readings taken from the live game's own
outfitting, module and engineering panels, and captures contributed by the repository
owner from their own fleet. Each is named where it is used, because it cannot be
re-derived from a public source: the shared fixtures pinning it are the only guard it
has.

This file is the long form of the attribution for the ship and outfitting data files in
this directory; each data file also repeats its own credit in a comment header, so the
provenance meets you where you meet the data.

The data files are **JSONC** (`.jsonc`): attribution lives in a comment so it
documents the file without becoming part of the payload every consumer inlines
into their bundle. Comments are the only JSONC extension used — no trailing commas —
so stripping comments leaves strict JSON any language's standard parser accepts.
See AGENTS.md §Attribution for how to consume them.

## Ships

Each hull is **one record** carrying its identity, its stats, and its slot layout —
identity from FDevIDs, stats and slots from coriolis-data, joined on `symbol`.

- **Files:** `ships.jsonc` (48 player-flyable hulls) and `fixtures/ships/ships.json`,
  `ship-stats.json`, `ship-slots.json` (the stats and slots halves keep their own
  parity fixtures).
- **Identity source:** FDevIDs `shipyard.csv`, columns `id,symbol,name,entitlement`.
- **Identity derivation:** records are carried over in shipyard order (roughly the
  order hulls were introduced): internal `symbol` and display `name`. The CSV's
  numeric ship-type `id` column is dropped — hulls are keyed by `symbol`.
  `entitlement` is FDevIDs' DLC/grant token, kept only where the CSV gives one (28 of
  the 48 hulls carry no entitlement, so the field is omitted rather than stored empty).
- **Stats + slots source:** coriolis-data `ships/*.json` — `properties` for stats,
  `slots` + `bulkheads` for the layout.
- **Stats derivation:** acquisition normalisation looks up each hull's coriolis
  record by display name (normalised; coriolis "Viper" ⇒ registry "Viper MkIII") and
  copies a fixed whitelist of `properties` fields (`hullMass`, `speed`, `boost`,
  `baseArmour`, …). The repository's
  `scripts/data/ships/merge-normalized-catalogues.mjs` then performs the deterministic
  symbol join, preserving registry order and rejecting duplicate or unmatched input.
  Masses are tonnes, speeds m/s, rotation rates deg/s.
- **Slots derivation:** coriolis's fixed-order `slots.standard` seven-array becomes
  the seven named `core` sizes (power plant, thrusters, frame shift drive, life
  support, power distributor, sensors, fuel tank); `slots.hardpoints` splits into
  `hardpoints` (the non-zero weapon mounts) and `utility` (the count of zero
  entries); `slots.internal` becomes `optional`. Both `hardpoints` and `optional` are
  arrays of `{ size, restriction?, name? }` — the two fields below. Coriolis's per-hull
  `bulkheads` are **not** kept on the hull: they are joined onto that hull's armour
  modules instead (see "Modules"), because armour is a module and the catalogue keeps a
  module's stats with the module. **Slot keys** are journal-compatible
  (`FrameShiftDrive`, `HugeHardpoint1`, `TinyHardpoint2`, `Slot01_Size6`, `Military01`,
  `PlanetaryApproachSuite`), so a build assembled from an empty hull and one loaded
  from a SLEF export share one vocabulary. See `typescript/src/ships/slots.ts`.

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
spelling. `fixtures/ships/slef-inara-lynx-highliner.json` settles it: its `passenger01`,
`passenger02` and `passenger03` each hold an `int_mkii_passengercabin_*`, spelled
exactly as the numbering rules and the stored names give them. The catalogue itself
corroborates independently — the Lynx's `Slot02_Size5` follows the three cabin mounts,
which only comes out right if a cabin mount is a _restricted_ one and so consumes no
`SlotNN` number. `slots.test.ts` asserts that. What the mount accepts is both cabin
families entire: the 14 `Int_PassengerCabin_*` records (sizes 2–6, economy through
luxury, the higher classes only on the larger sizes) and the 9
`Int_MkII_PassengerCabin_*` (sizes 2–6, economy and business; the Mk II family has no
first-class or luxury cabin). No fuel tank, which every _other_ optional mount takes.

**Which module families each restriction accepts is pinned** in
`fixtures/ships/ship-slots.json` under `restrictions`: one entry per restricted mount
naming modules it must accept and modules it must refuse, plus one unrestricted mount
for contrast. That is a fact about the game rather than about any implementation, so it
belongs in the shared fixtures and not only in the TypeScript prefix lists.

### `name` — the journal's own key for a mount

`enumerateSlots` numbers a hull's unrestricted optionals `Slot01_SizeN`, `Slot02_SizeN`,
… with no gaps and its hardpoints `1, 2, 3` within each size class. Thirteen hulls carry
explicit names. Ten require them because the game does not follow one of those rules;
the Panther Clipper Mk II, Type-11 Prospector and Lynx Highliner carry source-pinning
names that the rules also derive. Non-derivable names are stored against the mount:
`{ "size": 1, "name": "Slot14_Size1" }`. A mount with **no** `name` is one the rules
already get right; a hull that names any mount of a kind names all of them, so a derived
key and a stored name can never compete for the same string.

**Source:** EDSY `eddb.js` `ship[…].slotnames`. These are **journal** names rather than
EDSY's own — `edsy.js` reads them in `Build.fromJournal()` and writes them in
`exportJournal()`. Only EDSY carries them; coriolis-data does not model journal slot
names at all, so the corroborating source has to be captures, and five are in hand —
four SLEF exports and one journal — covering four of the 13 hulls with names of their
own (below). One is a journal rather
than an export: `journal-lynx-highliner.json` gives Frontier's own casing for a hull the
Inara export already covers in lower case, and one thing that export does not — its
`PlanetaryApproachSuite` mount. All 29 outfitting keys bind to the stored layout; its
seven cosmetic slots (`WeaponColour`, `Decal1`–`3`, `EngineColour`, `VesselVoice`,
`ShipCockpit`) are not outfitting mounts and remain outside the export-only sweep.

**Derivation.** EDSY keeps `military` mounts in a group of their own and does not model
the planetary approach suite; this catalogue keeps both inline in `optional`. The two
lists are therefore walked in parallel: every mount consumes the next EDSY name except a
`military` one (which takes `Military01`, `Military02`) and the `planetaryApproachSuite`
one. Two facts hold for all 13 and are asserted before anything is written: EDSY's
`slots` sizes equal this catalogue's mount-for-mount, and its name list is exactly
consumed. **So this is a naming difference alone — no hull's layout, mount count or size
differs from coriolis's.**

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
  numbering rules derive them exactly. They are kept so the stored table matches EDSY's
  13 entries one for one and re-deriving it is a straight comparison; a test asserts the
  rules still produce those two unaided, so neither the rule nor its coverage is
  weakened by the override sitting on top.

**The `_SizeN` suffix is Frontier's, and on three hulls it is wrong.** The Keelback, Asp
Scout and Type-7 name mounts with a class the hull does not have there. That is the
game's own text, not a transcription slip: `edsy.js` compensates for exactly this when
importing, taking the greater of the name's size and the fitted module's class. This
catalogue stores the name verbatim and keeps the mount's real size in the `optional`
entry beside it, so `BuildSlot.size` is always the mount's. `parseSlotName` reads the
size _off the name_ by design, and its doc says so.

**Two numbering rules for a restricted mount**, both derived from EDSY's name lists and
both reproduced by `enumerateSlots`:

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

**Checked against real captures.** Five exports are asserted key by key against the
hull's enumerated layout in `slots.test.ts`: `slef-the-deep-black.json` (Caspian
Explorer), `slef-inara-type-11.json`, `slef-inara-lynx-highliner.json`,
`slef-inara-panther-mkii.json` and `slef-inara-cutter-antixeno.json`. The Caspian
capture is the load-bearing one: its internals read `Slot01_Size7`…`Slot10_Size3`,
`Slot13_Size1`, `Slot14_Size1`, all of which the plain numbering produces — evidence for
leaving that hull's optionals alone rather than assuming EDSY simply omitted them. The
journal captures are not in that test: a journal states cosmetic slots (`Decal1`,
`WeaponColour`, `ShipCockpit`, …) that no hull layout declares, so the assertion is
written for exports that carry outfitting mounts alone. The Lynx journal's 29
outfitting keys, including its approach suite, are pinned separately by the full layout
and targeted fit assertions.

**All 13 hulls' full enumerated key lists are pinned** in
`fixtures/ships/ship-slots.json` under `keys`, and the `spot` layouts carry their mount
names, so a port produces the same vocabulary.

### Per-hull corrections and additions

- **Type-11 Prospector — eight hardpoints, not four.** The acquired record read
  `hardpoints: [2, 1, 1, 1]`. Coriolis writes a _restricted_ hardpoint as an object
  rather than a bare size and the Type-11 is the only hull in coriolis-data that has
  any, so acquisition's "non-zero numbers are weapon mounts" rule silently dropped its
  3/2/2/1 mining mounts — leaving the game's dedicated mining hull with nowhere to fit a
  mining tool, and no large mount at all for `Hpt_MiningToolV2_Fixed_Large`, which is
  itself `restrictedToShips: ["LakonMiner"]` and so unfittable on the only hull that may
  carry it. Stored as `[3, 2, 2, 2, 1, 1, 1, 1]`, which three sources agree on:
  coriolis-data, EDSY `eddb.js` (`ship[…].slots.hardpoint = [3,2,2,2,1,1,1,1]`) and
  [Inara's ship page](https://inara.cz/elite/ship/68/), read 2026-08-02 UTC, listing
  1 Large Mining, 1 Medium, 2 Medium Mining, 3 Small and 1 Small Mining. The four
  unrestricted mounts are exactly the `[2, 1, 1, 1]` the record already had.
- **Lynx Highliner (`MediumTransport01`) — from EDSY, Frontier's Lynx update notes and
  a Frontier journal capture:**
  the Lynx has no coriolis hull entry, so its stats and slot layout are sourced instead
  from EDSY's ship data and Frontier's Lynx update notes (hull mass 260 t, 285/350 m/s,
  200/350 base shield/armour, hardness 55, 2 crew, rotation 26/60/19 deg/s, min thrust
  73.75%; core PP5/thr6/FSD5/LS6/dist5/sen3/tank5; hardpoints 1 large + 4 medium;
  4 utilities; unrestricted/passenger optionals 6/6/6/5/5/4/4/3/2/1; its five armour
  options at 0/26/53/53/53 t, carried on the `MediumTransport01_Armour_*` module
  records). Values
  the static catalogue does not expose are omitted rather than invented: `masslock`,
  `heatCapacity`, `pipSpeed`, acceleration, and the min-pitch / boost-energy figures.
  Its two size-6 and one size-5 passenger mounts carry `"restriction": "passenger"` and
  the names `Passenger01`–`Passenger03`, sourced above. A final size-1
  `planetaryApproachSuite` mount named `PlanetaryApproachSuite` comes directly from
  `fixtures/ships/journal-lynx-highliner.json`, which fits
  `int_planetapproachsuite_advanced` there. The capture's acquisition date and checksum
  are recorded under Ground-truth ship builds.

## Modules (outfitting)

Each module is **one record** carrying its identity and its stats — identity from
FDevIDs, stats from coriolis-data and EDSY, joined on `symbol`.

- **Files:** `modules-core.jsonc`, `modules-internal.jsonc`,
  `modules-hardpoint.jsonc`, `modules-utility.jsonc`, and `fixtures/ships/modules.json`,
  `module-stats.json` (the stats half keeps its own parity fixture). Split along
  FDevIDs' four outfitting categories so an app that only wants weapons never bundles
  the 1005 core and optional internals; see AGENTS.md §Build.
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
  real DLC/grant token. `name` is the stable descriptive English label from FDevIDs,
  not a byte-exact localization field: readable expansions such as Frame Shift Drive and
  Auto Field-Maintenance Unit are retained rather than shortened to the game's current
  FSD and AFM strings. Consumers needing exact localized UI text must use a localization
  source keyed by `symbol`.
- **The CSV's `category` column is not stored — the file states it.** It would be the
  same string on every record of a file whose name already says it, 1199 repetitions of
  a fact the four-way split carries, and every payload byte is inlined into consumers'
  bundles. Each language loader adds it back from the file it read (TypeScript:
  `src/ships/module-catalogue.ts`), so a consumer's record carries `category` all the
  same; `schemas/ships/catalogues.schema.json` has one catalogue definition per file
  rather than a shared `moduleCatalogue`, which is what pins the difference between
  them. Nothing is derived from upstream for this: the CSV's category is exactly which
  file a record is in.
- **`slot` — which fixed mount a module fills.** A category is not a mount: `core` is
  eight of them, so "which core modules fit this hull's FSD mount?" is a question a
  category cannot answer and every consumer would have to answer for itself by matching
  symbol prefixes. Every record in `modules-core.jsonc` names its own mount — `armour`,
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
    classification in the data is what lets a consumer read the mount without
    reimplementing a prefix table, and what makes the odd ones out — the Guardian
    hybrids, the Python Mk II's `Int_MkIIAgileBoost_Engine_*` thrusters — facts about a
    record rather than special cases in code. Counts, per mount, are pinned in
    `fixtures/ships/modules.json` (`slotCounts`).
  - **A fuel tank is the one module built for two kinds of mount:** it is `fuelTank`
    and also fits any optional slot large enough, exactly as the game sells it.
- **Stats source:** coriolis-data `modules/**` for the mechanical, defence, power and
  weapon stats; EDSY `eddb.js` for mass, integrity, power draw, boot time and the
  engineering base stats coriolis does not carry; and in-game verification for the
  comprehensive audit and every game-settled correction below.
- **Stats derivation:** acquisition normalisation looks up each module's coriolis
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
  every other record remains an omitted sparse field. Both records and their boolean
  value are pinned in `fixtures/ships/module-stats.json`.
  - **`rateOfFire` is derived, not copied.** Upstream stores the fire interval; the
    journal (and this catalogue) report the combined shots per second, so it is
    computed as `burst / ((burst − 1) / burstRateOfFire + fireInterval)`. Coriolis
    (`Module.getRoF`) and EDSY (`rof = fpc / spc`) also fold `chargeTime` into this
    figure, but Frontier does not: `journal-federation-corvette-mixed.json` states
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
  - **Module-breach stats** (`breachdmg`, `breachmin`, `breachmax`) are the one
    deliberate omission from the weapon block — no calculation here reads them.
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

`applyBlueprint` refuses a recipe whose base stats a module record does not hold, so a
recipe that moves a stat needs that stat stored. Thirteen fields exist for that:
`engineHeatRate`, `fsdHeatRate`, `refuelRate`, `shieldBankReinforcement`,
`shieldBankHeat`, `shieldBankSpinUp`, `shieldBankDuration`, `scannerRange`, `scanAngle`,
`scanTime`, `probeRadius`, `interdictorFacingLimit` and `interdictorRange`. With them,
all 1902 declared engineering entries in `fixtures/ships/builds/` resolve. Counts and
spot values are pinned in `fixtures/ships/module-stats.json` (`statCounts`, `spot`) and
the corpus-wide claim in `builds.test.ts`.

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
  `fixtures/ships/journal-krait-phantom.json` settles it — the game reports the Detailed
  Surface Scanner's `DSS_PatchRadius` as `20` → `28` for a grade-4 Expanded Probe
  Scanning Radius roll. `interdictorRange` is **seconds to intercept**, the unit the
  game measures a supercruise separation in, not a distance. `refuelRate` is tonnes per
  second (EDSY `scooprate`); coriolis's `rate` is the same figure in kilograms.
- **A shield cell bank duplicates its heat under two stat names deliberately.** Its
  `shieldBankHeat` is the same figure as its `thermalLoad` — one upstream field read
  under two names. `ShieldBankHeat` maps to both fields in `module-stat-labels.ts`, so
  an engineered cell bank reads the same whichever field is asked. Scanner distance
  has one catalogue home instead: every utility scanner and sensor suite carries
  `scannerRange`, while `maximumRange` is reserved for weapons and non-scanner utility
  effects.
- **`EnergyPerRegen` needs no stored value.** All 57 shield generators carry
  `distributorDraw`, and EDSY (`genpwr`) and coriolis (`distdraw`) both confirm it is the
  same stat under the journal's other name; the mapping lives in the label table.
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
  registry this catalogue is keyed on capitalises the `B`. Matching case-insensitively,
  as every lookup in this library does, makes it a reading.
- **A weapon with no maximum range carries no Long Range falloff leg.** That leg is
  stored upstream as an overwrite in `[0, 1]` — a flag meaning "damage falls off from
  maximum range" — which the calculator resolves to the weapon's own range. On the 33
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
  The calculator compounds `DefenceModifierHealthMultiplier` from that zero, which is why
  a package can be engineered to a hull boost it never had and why a journal reports the
  leg with `OriginalValue: 0`. No value is stored on any record for it.
- **`GuardianModuleResistance` grants a capability rather than scaling a stat.** EDSY
  stores Anti-Guardian Zone Resistance as `agzresist`, an enumerated flag with values
  `''` / `'Active'`, no unit and no magnitude. Inara displays the activation as +100%, but
  treating that as an additive number would invent a base value the game does not have.
  The label mapping therefore writes a non-numeric, journal-compatible modifier
  `{ Label: 'GuardianModuleResistance', ValueStr: 'Active' }`; a fitted module's effective
  record exposes `guardianZoneResistance: true`. Apart from the two Guardian Nanite
  Torpedo Pylons that EDSY marks inherently `Active`, stock catalogue records omit the
  sparse flag, meaning the capability is not granted. The shared
  `guardianZoneResistanceCapability` fixture pins the same result on a Guardian power
  plant and a Guardian weapon, the string and numeric import representations, the SLEF
  round trip, and the ordinary power plant that remains outside the blueprint's menu.
  No raw `Loadout` capture in this repository states this modifier: `ValueStr: 'Active'`
  is the library's projection of EDSY's enum into the string-valued modifier shape SLEF
  already supports. On import, the presence of the mapped label grants the capability
  regardless of the producer's `ValueStr`, so this representation is not mistaken for a
  claim about Frontier's exact serialization.
  Separately, 14 corpus entries are refused because the engineering menu does not offer
  their recipe on that module — the residue recorded under §Engineering compatibility,
  not a missing stat.

### Deliberately absent fields

- **`integrity` is absent on 82 non-armour records** because no registry publishes one
  for those families and the game's module panel shows none. The set is pinned in
  `fixtures/ships/module-stats.json` `withoutIntegrity`, which fails if the membership
  ever changes. Guardian hull reinforcement packages are in that set and do draw power,
  so "no integrity" is not a shorthand for "inert".
- **`cost` is absent** when no published price exists; `undefined` never means free.

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
not.** Every engineered module in a `Loadout` states its own *unmodified* value beside
the modified one, so a capture reads base stats straight out of Frontier's own
arithmetic — including a hardpoint's reserve ammo and projectile speed, which the
in-game audit above lists as unreached, the shield-generator and shield-booster
resistances, which it lists as unsettled, and the ship-specific armour modules, which it
excludes from numeric verification altogether. Of the thirteen journal captures and the
EDSY export stored here, **twelve state base values**; between them they state **762**
that name a field this catalogue holds, and every one agrees — 670 to the stored decimal
and 92 to within the game's own float noise.

Counted as distinct (module, label) pairs rather than per capture, that reaches 18
modules on their resistances (five shield generators, two shield boosters, four hull
reinforcement packages and seven armour modules), those seven armour modules' hull
boosts, nine reserve-ammo and seven clip-size readings, and one projectile speed.

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
agree. Each also reaches a consumer: a sensor's engineered range resolves to the field a
sensor actually carries, so `effectiveStats` reports the 13 440 m
`journal-federation-corvette-beams.json` states rather than writing it to a
`maximumRange` no scanner has. The same resolution covers utility scanners, whose
distance also lives only in `scannerRange`. Without the fuel-scoop pairing a journal's
scoop-rate roll resolved to nothing and vanished from `effectiveStats` in silence, which
is the failure shape a label that names no field always has; the Caspian Explorer's
grade-5 roll now reads back as 1.245 → 1.8675, the ×1.5 the recipe defines, and its
`PowerDraw` leg lands at the recipe's ×1.15 in the same block. That read-back is swept
rather than sampled.
Wherever a
capture spells a stat by something other than the field's own first name, or names a
field the record does not carry — the two shapes a wrong resolution hides in — the result
is pinned at a field written out by hand rather than resolved: **58** of them, one per
module and field, in `capturedBaseStats.engineered`.

A fourth label, `Jitter`, already resolved to `jitter`. A capture states it as
`OriginalValue: 0` on a missile rack whose record holds no such field — a weapon that
carries no jitter fires true. That zero is a value rather than an absence, so it is a
`defaultBase` like `roundsPerShot`'s 1. **It changes no computed figure**: an additive
leg already starts from zero in `computeModifiers`, so Rapid Fire's jitter reaches 0.5
on that rack either way. What the default adds is the base itself — the modifier carries
`OriginalValue: 0`, the figure Frontier states, where it would otherwise carry none. It
is visible on the **66** weapons an engineer offers Rapid Fire, its multi-cannon
spelling or Inertial Impact (`special_distortion_field`) and which hold no jitter of
their own.

**`fixtures/ships/module-stats.json` `capturedBaseStats` holds all of this**, per
capture, so no port and no later change can quietly stop agreeing. Its `weapons` half
pins the eighteen weapons the captures state a `DamagePerSecond` for and requires
`damagePerSecond` to reproduce each. They are the only external readings of an
**unmodified** weapon's folded figure: in-game verification reads the stored inputs one
at a time, and the one product it does hold — a decorative flak launcher's panel DPS, in
`fixtures/ships/engineering.json` — is a modified weapon read to one decimal. On a beam
laser the fold is trivial, because a beam's damage is already per second, and
`inGameVerifiedValues` pins that figure for six beams; the huge and medium gimballed
beams are the two a capture reads that it does not, so on those this is the only check
`damage` has at all — no journal states `Damage` for a beam laser.

Every value supplied outside the primary registry is pinned individually in
`fixtures/ships/module-stats.json` `spot`, so all implementations validate against the
same numbers. Derived size-8 drive and `*_free` values also follow their family's curve.

**Every module in every catalogue carries at least one stat** (1199/1199), so
`fixtures/ships/module-stats.json` `counts` equals the catalogue sizes and no record
holds only a lone `mass`. 244 of the 833 `bootTime` values are `0` (every hardpoint
among them); they are stored rather than omitted, because an absent field means
absent. The fixture distinguishes explicit zeroes from omitted fields.

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
| `Hpt_Cannon_Gimbal_Large`                                        | `damage` / `thermalLoad`            | 37.39 / 2.9    | 37.421001 / 2.93    | observed in-game; the journal agrees                                                                                                                    |
| `Hpt_BeamLaser_Gimbal_Huge`                                      | `thermalLoad`                       | 10.6           | 10.62               | observed in-game; the journal agrees                                                                                                                    |
| `Int_ShieldGenerator_Size7_Class5_Strong`                        | `shieldBrokenRegenRate`             | 4.2            | 4.25                | observed in-game; the journal agrees                                                                                                                    |
| `Hpt_HeatSinkLauncher_Turret_Tiny`                               | `ammoMaximum`                       | 3              | 2                   | a journal states the base as 2, and EDSY agrees; in-game verification does not reach hardpoint reserve ammo                                             |

**In-game corrections.** Values are stored at the observed in-game precision; the
fixture's `inGameVerifiedValues` array pins every
corrected symbol and field individually. These groups account for 300 fields on 135
modules in addition to the Resource Siphon and four additional values pinned in `spot`:

| Records                                                                                                           | Fields                                                            | Stored in-game values                                                |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Int_Engine_Size4_Class{2,4}`, `Int_Hyperdrive_Size4_Class4`                                                      | thruster min/max mass; FSD optimal mass                           | 158/473, 193/578 and 438 t                                          |
| `Int_Engine_Size{2,3}_Class5_Fast`                                                                                | optimal/maximum multiplier                                        | 1.1 / 1.2 on both                                                   |
| `Int_GuardianShieldReinforcement_Size{1..5}_Class{1,2}`                                                           | integrity                                                         | 36/42, 40/48, 45/55, 51/63, 58/72                                   |
| `Int_MetaAlloyHullReinforcement_Size{1..5}_Class{1,2}`                                                            | caustic resistance                                                | 0.02 on all ten                                                     |
| shield generators                                                                                                 | regeneration / broken regeneration                                | exact 1.06–5.76 values pinned per symbol in the fixture             |
| `Int_ShieldCellBank_Size1_Class2`; `Int_FuelScoop_Size4_Class5`                                                   | reserve ammo; scoop rate                                          | 1; 0.343 t/s                                                        |
| Beam Laser, Cannon, Fragment Cannon, Multi-Cannon, Plasma Accelerator, Rail Gun, Shock Cannon and Point Defence records | damage / thermal load                                        | 34 scalar damage and 55 thermal-load corrections, pinned per symbol |
| Advanced Plasma Accelerator, Imperial Hammer, Shock Cannons and Mk II Plasma Shock Accelerator                    | burst interval / combined rate of fire                            | exact cycle values derived with the catalogue's documented formula  |
| mining, utility and Guardian hardpoints                                                                           | clip, distributor draw, reload, jitter, falloff and maximum range | exact values pinned per symbol                                      |
| anti-xeno, Guardian and special weapons                                                                                | scalar, distribution and exact damage components                  | 34 component records pinned per symbol                              |
| AX missiles, subsurface displacement missiles and seismic charge launchers                                             | projectile boundary parameters; misleading ordinary ranges absent | ten records and 16 absences pinned                                  |

In-game verification gives the integer thruster/FSD masses, 1.1/1.2 enhanced-thruster
multipliers and the rising Guardian Shield Reinforcement integrity ladder. These values
take precedence over family-shaped inference and registry agreement.

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
  non-integer boot time in all 1199 records, where its three family siblings are exactly 10. EDSY gives `boottime:9.85`.

### Prices — `cost` on modules, `hullCost` / `retailCost` on hulls

`cost` is the module's standard list price in credits, before any station discount or
markup — the figure an outfitting screen quotes at 0% discount. On hulls, `hullCost` is
the bare hull and `retailCost` the hull with its default module loadout (`retailCost` is
never below `hullCost`, and a test asserts it). Sources are coriolis-data's `cost` per
module and `properties.hullCost` / `retailCost` per ship, with EDSY filling the records
coriolis does not price (the newer hulls' armour and Operations additions) and supplying
the Lynx Highliner, which has no coriolis entry.
Ship-specific **armour** is priced from each hull's `bulkheads` upstream, joined on hull

- bulkhead name because those records carry no symbol upstream.

* **All 48 hulls are priced. 1173 of 1199 modules are.** The 26 without a price are the
  fifteen grant/starter `*_free` variants, the five size-8 frame shift drives, the three Mk II
  Vessel Hangars, the two unsold Corrosion Resistant Cargo Racks (both Community Goal
  rewards) and `Int_ShieldGenerator_Size1_Class4` — no registry publishes a figure for
  them. **`cost` is omitted, never set to 0**: `0` is a real price (the starter
  Lightweight Alloy bulkhead costs nothing), so a cost calculation must be able to tell
  "free" from "unknown".
* **Sixteen duplicated symbols take the first occurrence's price.** Where coriolis-data
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
* **Only one record is priced `0`:** `ModularCargoBayDoor`, which is built into every
  hull and cannot be bought. `fixtures/ships/module-stats.json` pins that list under
  `freeModules`, so a new zero has to be argued for rather than slipping in: a zero price
  is otherwise indistinguishable from a dropped one.
* **`Int_CorrosionProofCargoRack_Size1_Class2` is priced at 12 560, from EDSY**, where it
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
* **The size-5 and size-6 Corrosion Resistant Cargo Racks have no list price to
  publish**, and their absent `cost` means _no list price exists_, not _none has been
  found_. They are **not sold at any station**: FDevIDs `outfitting.csv` lists neither,
  and EDSY hides both with `cost: 0 // TODO: cost // CG reward`. They were Community Goal
  rewards and were sold nowhere. Frontier's own announcement of the **Rhea Disaster** CG
  states that "all participating commanders will now receive the Size 6 Corrosion
  Resistant Cargo Rack whilst the top 50% will now receive 2"
  ([@EliteDangerous](https://x.com/EliteDangerous/status/1812792503776489745); the CG
  itself ran on the [Frontier
  forums](https://forums.frontier.co.uk/threads/deliver-critical-aid-for-the-rhea-disaster.626528/)).
  The [Elite Dangerous
  Wiki](https://elite-dangerous.fandom.com/wiki/Corrosion_Resistant_Cargo_Rack) records
  that the class 5 and 6 modules "exist in limited numbers among CMDRs who received them
  as a Community Goal reward, but they are otherwise neither purchasable nor
  unlockable" — size 4 is the largest one obtainable, through a Human Technology Broker.
  So EDSY's `TODO: cost` is upstream expecting a figure that outfitting never quoted.
  Players do hold these racks, so a journal can name them and the catalogue must resolve
  them; `cost` stays omitted, since a reward module still has an insurance value and
  reporting it as free would understate a rebuy.
  - **Both sources read 2026-08-06 UTC; the wiki alone is unpinned.** An X status id
    names one immutable post, so the announcement is pinned by its URL. The wiki page is
    mutable and MediaWiki serves a stable `?oldid=` for it, but the host refuses
    automated requests from this environment (HTTP 403), so neither the revision id nor a
    stored copy could be captured and `../SNAPSHOTS.md`'s checksum fallback is out of
    reach for the same reason. The quotation above is the preserved form. The gap is
    recorded rather than closed with an invented revision, as that file requires, and a
    maintainer reading the page in a browser can close it by adding the `oldid`.
  - **What an unpinned source may carry: an interpretation, never a value or a record.**
    Nothing in any payload here derives from either of these two; they settle only what an
    already-absent `cost` _means_, and `cost` is `undefined` to a consumer either way.
    Using an unpinned page to add a price or a module would need the pin first.
  - **A capture reporting a `Value` was checked and rejected.**
    `fixtures/ships/slef-inara-cutter-antixeno.json` fits five of these racks. Its two
    size-6 records carry **no `Value` at all**; its size-5 carries `Value: 318174`. That
    is not a list price, and the same export is what proves it: the two size-4 racks in it
    read **82 774** and **91 970** against the one list price of 94 330 — about 12.25% and
    2.5% off. `Value` is net of the station discount, one reading with an unknown discount
    does not yield a list price, and a reward module was not bought at a discount to begin
    with. (318 174 is within a credit of 362 591 less 12.25%, and 362 591 is the
    _standard_ E-rated size-6 rack's price; that is arithmetic reaching for a target with
    a free variable, not a source. It is recorded only so the next reader does not redo
    it.)
  - Adding a value requires an in-game reading that does not go through a purchase: a
    `StoredModules` entry's `BuyPrice`, a `ModuleSell` on one, or the insurance figure a
    rebuy screen quotes. A journal `Loadout` `Value` is not sufficient, for the reason above.
* **Filled by hand, from a documented uniformity:** `Int_ShieldGenerator_Size1_Class4`
  (added from EDSY, so it has no coriolis record) takes the resistances and distributor
  draw every one of the 55 shield generators coriolis does carry shares — kinetic 0.4,
  thermal −0.2, explosive 0.5, draw 0.6. The cargo hatch (`ModularCargoBayDoor`) takes
  the 0.6 MW draw Coriolis hard-codes for it (`ModuleUtils.cargoHatch`), since it is
  fitted to every hull and cannot be removed.
* **Still not modelled:** passenger capacity and fighter-bay/rebuild counts. The
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
- **Stats kept deliberately (do not "fix" back):**
  - **`restrictedToShips`** carries the hull symbol(s) a non-armour module is limited
    to (coriolis's `ship` field: the MkII Gravity Optimised thrusters → `Explorer_NX`,
    the MkII Agile Boost thrusters → `SmallCombat01_NX` "Kestrel", the MkII Mining
    controller and Mining Volley Repeater → `LakonMiner`), plus the two Mk II Cargo Racks
    → `["PantherMkII"]` (EDSY marks them `reserved:{63:1}`, ship 63 being the Panther
    Clipper Mk II, and coriolis-data describes them as a "Panther Clipper storage rack")
    and the three Mk II Vessel Hangars → `["Explorer_NX", "PantherMkII", "LakonMiner"]`
    (EDSY has no record for the Mk II bays at all, so their restriction rests on
    Frontier's update notes and Inara). **Armour's** hull restriction is _not_ repeated
    here — it lives in the `ship` field (`OutfittingModule.ship` / `getModulesForShip`).
  - **`restrictedToSlot`** is the same idea one axis over: the slot restriction a module
    requires, so it fits only mounts carrying it — the mirror of a mount's `restriction`,
    and the half `restrictedToShips` cannot express. Five records have one: the two
    planetary approach suites, the two Mk II Cargo Racks and the Mk II Mining
    Multi-Limpet Controller. It composes with `restrictedToShips` rather than replacing
    it — the racks name both the hull that can buy them and the mount they go in.
    - **Sources.** EDSY refuses a reserved `icr` outside a slot named `CARGO*`, and
      coriolis-data carries `"restriction": "Cargo"` on the module; the same shape holds
      for the Mk II Mining Multi-Limpet Controller against `LIMPETCONTROLLER*`.
      `fixtures/ships/slef-inara-panther-mkii.json` shows the game agreeing: its two Mk II
      racks sit in `cargo01` and `cargo02` while its _unrestricted_ `slot01_size8` and
      `slot02_size7` carry ordinary racks — a build that could not exist if the
      reservation were about size. `fixtures/ships/slef-inara-type-11.json` does the same
      for the controller, in `limpetcontroller01`.
    - **The field is deliberately narrow.** It says a module fits _only_ mounts with that
      restriction, so it is wrong on anything the game also sells for an ordinary
      optional: a plain cargo rack fits a `cargo` mount _and_ every unrestricted one, and
      does not carry it. `modules.test.ts` pins the set of five so widening it is a
      deliberate act.
  - **Pre-engineered/duplicate drives share a `symbol`** in coriolis (e.g. the V1
    FSDs); the first (primary) occurrence wins, and any baked engineering is expected
    to arrive as SLEF `Engineering.Modifiers` instead.
- **Identity kept as-is from the source (do not "fix" these back):**
  - The `?` notes on `Hpt_CausticSinkLauncher_Turret_Tiny` and
    `Hpt_AntiUnknownShutdown_Tiny_V2` are not entitlement tokens and are omitted.
  - One source row (`Int_MkIIAgileBoost_Engine_Size5_Class5`) has the literal string
    `mount` in its `mount` column — a thruster has no hardpoint mount, so the field
    is omitted, matching every other thruster.
  - **`Int_LargeCargoRack_Size8_class1` really is spelled with a lower-case `class1`**
    — the only record in all four catalogues that is. It is not a typo here: EDCD
    FDevIDs `outfitting.csv` spells it exactly that way (row `129034964`), and identity
    comes from FDevIDs. EDSY normalises it to `_Class1`, which is why a cross-check
    against EDSY looks like it disagrees. Lookups are case-insensitive so nothing
    breaks, but `module.symbol` is what an app renders and compares, so leave the
    casing alone until FDevIDs changes it.

### Operations / Lynx additions — from EDSY, Inara and Frontier's update notes

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

- **Only player-obtainable outfitting is carried.** Built-in hull geometry,
  ship-launched-fighter internals, station and NPC fittings, and withdrawn or unreleased
  variants cannot be equipped by a player and are deliberately absent. Their symbols
  resolve to `null` rather than exposing records that look usable but are not.

- **Deliberately not modelled here:** the **Merc-Coin pre-engineered weapon variants**
  are not separate module records: their base module symbols already exist, and the
  pre-engineering is expressed as the Operations blueprints below — the pairing between
  the two is `pre-engineered.jsonc`. The **Nomad** (`Lander01`) is a ship-launched
  vehicle, not a shipyard hull, and its `Vehicle_Lander01_*` weapons carry no
  category/class/rating the module schema requires, so neither the vessel nor its modules
  are added.
- **Inclusion rule — a public registry or direct capture has to corroborate the record.** A module symbol is
  carried here only when [FDevIDs](https://github.com/EDCD/FDevIDs),
  [coriolis-data](https://github.com/EDCD/coriolis-data) or
  [EDSY](https://github.com/taleden/EDSY) lists it as player-obtainable outfitting, or a
  direct player-facing capture establishes the same thing. That keeps
  `getModuleBySymbol` and `getModulesForShip` a player-facing outfitting view rather than
  an inventory of every symbol the game has ever used. Two consequences worth knowing
  before "fixing" an apparent omission:
  - **Symbols outside outfitting are not stored** — hull geometry, ship-launched-fighter
    weapons and internals, station fittings, and non-purchasable internal or test variants.
    A journal will never ask you to price these, and the module schema has no
    category/class/rating for most of them.
  - **A named variant with no published stats is not stored either.** Where a registry
    records only that a variant exists, adding it would mean inventing the mass, power and
    integrity a fitting calculator needs. The one exception is documented above
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
references agree on every value below, and each is pinned by a test:

| Effect                                                   | Drawback leg                          | Benefit leg                                 |
| -------------------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `special_weapon_damage` (Oversized)                      | `PowerDraw +5%`                       | `Damage +3%`                                |
| `special_weapon_rateoffire` (Multi-servos)               | `PowerDraw +5%`                       | `BurstInterval −2.9126%`                    |
| `special_powerdistributor_capacity` (Cluster Capacitors) | three capacity legs, one recharge leg | `WeaponsRecharge` and `SystemsRecharge` −2% |
| `special_powerdistributor_fast` (Super Conduits)         | three capacity legs, one recharge leg | `WeaponsRecharge` and `SystemsRecharge` +4% |

Multi-servos is stored under `BurstInterval` for the reason given above — EDSY writes it
as `bstint: -2.9126…`, coriolis as `rof: -0.029126…` under its inverted convention, and
both come to the same +3% rate of fire.

**Deliberately not added: two single-sourced canister magnitudes.** coriolis gives
`special_radiant_canister` an `ammo: -0.25` and `special_shiftlock_canister` a
`damage: -0.2`; EDSY records no magnitude for either, its `special:` text describing only
the gameplay flag ("Area heat increased and sensors disrupted", "Area FSDs reboot"). The
in-game descriptions coriolis carries do say a cost exists ("at the cost of ammo
capacity" / "at the cost of reduced damage"), so the _direction_ is not in doubt — but a
magnitude a single source asserts is worse than this file's standing convention for a
qualitative effect: an empty `modifiers` list and a `description`. Both keep that, and a
test holds them to it.

**Not added: `special_plasma_slug_pa`.** coriolis splits Plasma Slug into a legacy id
(`special_plasma_slug`, named "Plasma slug (Legacy)", damage −20%) and a current
plasma-accelerator id (`special_plasma_slug_pa`, damage −10%). EDSY carries no `_pa` id
at all, and where it has to disambiguate — `edsy.js` `Build.fromCAPI`, importing a
Frontier API loadout — it does so by module type, mapping a rail gun's
`special_plasma_slug` to `special_plasma_slug_cooled`. `Build.fromJournal` looks the id
up straight through with no disambiguation at all. Both paths are evidence that
`special_plasma_slug` is the id the game writes. This repo follows EDSY: one
`special_plasma_slug` at damage −10% / ammo −100%, plus the `_cooled` rail-gun variant.

- **Files:** `blueprints.jsonc` (per-blueprint, per-grade stat modifiers **and**
  material requirements) and `experimental-effects.jsonc` (per special-effect stat
  modifiers **and** material cost), validated by `fixtures/ships/engineering.json`.
  Modifiers are resolved to journal Modifier **Labels** so the computed modifiers read
  back like a real `Engineering.Modifiers` block. Each blueprint is `{ name, grades }`
  (each grade `{ features, damageDistribution?, materials }`); each experimental effect is
  `{ name, modifiers, damageDistribution?, materials, description? }`.
- **Display names:** each blueprint and experimental effect carries its `name`.
  Effect names are the English strings observed in-game. Blueprint names are coriolis
  `blueprint.name` for the 81 blueprints coriolis carries, and the Operations dossier's
  display label for the other 28 — the 27 Operations keys and `GuardianModule_Sturdy`,
  which is journal-keyed but absent from coriolis, so its name comes from the same registry
  as its two `recipe_`-prefixed Inara aliases. Read them with `getBlueprintName` /
  `getExperimentalEffectName`.
  - **These are the short modifier labels, not the full outfitting-panel
    strings — deliberately.** The panel calls `Weapon_LongRange` "Long-Range Weapon",
    `ShieldBooster_HeavyDuty` "Heavy Duty Shield Booster" and
    `Armour_Advanced` "Lightweight Armour"; this catalogue says "Long range", "Heavy
    duty" and "Lightweight". Nearly all 81 differ that way, because a blueprint's name
    is read next to the module it is applied to, where repeating the module's own name
    is noise. The convention is house style and is kept: switching to the panel strings
    would change every `getBlueprintName` return for no gain. Two names were wrong in
    their own right rather than short by convention, and take EDSY's spelling —
    `CargoRack_IncreasedCapacity` is **"Expanded Cargo Rack"** (not "Expanded Capacity")
    and `special_choke_canister` **"Ion Disruption"** (not "Ion Disruptor").
- **`journalName` — on three records, and only three.** It marks a **collision**, not a
  rename: a key carries one only when the id the game writes for it is a key some _other_
  record already answers to. The other 106 go without for two different reasons — 79
  because their key already is the id a journal writes (including Anti-Guardian Zone
  Resistance as `GuardianModule_Sturdy`), and 27 because they are Operations ids for
  which no journal spelling has been observed — 21 of them recipes a module is sold
  already carrying, four recipes a player rolls at an engineer, and two the community
  spellings of Anti-Guardian Zone Resistance, whose journal id is a key here in its own
  right. The three that do are `Scanner_LongRange` and `Scanner_WideAngle`, coriolis keys
  for recipes the game writes as `Sensor_LongRange` / `Sensor_WideAngle` — the same ids it
  writes for the sensor suites' own Long Range and Wide Angle, which are different recipes
  — and `MC_Overcharged`, its key for the multi-cannon Overcharged, which the game writes
  as `Weapon_Overcharged` like every other weapon's. Each of the three names its journal
  spelling in `journalName`, so a reader holding one of these records can get back to the
  id a journal carries, and `resolveBlueprintForModule` can go the other way given a
  module. The field is deliberately **not** a general alias mechanism: it says "the game
  writes this recipe as X", nothing about equivalence, and a test holds it to exactly
  these three records, pinned in `fixtures/ships/engineering.json` under `journalNames`.
  Evidence, and why the split keys are kept at all, under §Engineering options → "Scanner
  Long Range and Wide Angle: one journal id, two recipes" and "Multi-cannon Overcharged:
  one journal id, two recipes".
- **Blueprint source:** [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data),
  `modifications/blueprints.json` (grade `features` + `components`) + `modifications.json`
  (apply method), same commit and Frontier media-usage terms as above. Each grade's
  `features` is a list of `{ label, method, min, max }`; the modifier value is bounded
  by the engineering quality roll (`v = min + (max − min)·quality`).
- **Material requirements** live on the same grade (`materials`), from that grade's
  `components` map. Coriolis keys components by material **display name**; a join script
  resolves each to the material's Frontier `symbol` against the `materials` domain at
  generation time, emitting `{ symbol, name, count }` per requirement (join `symbol` to
  `materials` for the material's own grade and category). **Kept as-is:**
  `CargoRack_IncreasedCapacity` grade 5 has no components upstream, so its `materials`
  is an empty list (the grade still resolves) rather than being dropped.
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
    name ("Module Reinforcement Package — Heavy duty"). Every lookup matches
    case-insensitively regardless, so a caller carrying any casing is still understood.
  - **Seven of these keys are almost certainly not journal ids in any casing.**
    `PowerDistributorS3C2_SupportFocused` and its four siblings, and
    `CargoRackS5C1_Extended` / `CargoRackS6C1_Extended`, embed a module size and class in
    the id. No blueprint Frontier writes is named that way — a journal spells the _module_
    `Int_CargoRack_Size5_Class1` and the _recipe_ separately. They read as Inara SKU ids
    for particular pre-engineered purchases. Dropping the prefix and casing them makes them
    consistent with their neighbours; it does not make them right, and no observation
    covers them either way. A consumer matching a journal `BlueprintName` should not expect
    these seven to be what it carries.
  - **The two Anti-Guardian aliases keep their `recipe_` prefix**, and are the only keys
    that do. For that recipe the real name _is_ known — `GuardianModule_Sturdy` — so they
    are not best guesses at a journal id but declared Inara-only spellings, kept so a build
    carrying either still resolves; stripping `recipe_guardianmodule_sturdy` would also
    collide with the real key.

  The registry exposes **one displayed total per grade**, not a roll-bounded range, so each
  feature stores that total as a fixed value (`min == max`).
  The three Plasma conversion recipes also expose equal and opposite damage-share totals.
  Inara labels those player-facing rows **Thermal** and **Plasma**, not with journal
  modifier labels: Thermal decreases by 3.9, 6.6, 9.4, 12.4 and 15.5 percentage points
  across grades 1–5, while Plasma increases by the same amount. This library represents
  the resistance-ignoring ship-damage member as `absolute`, matching EDSY's `abswgt`
  **Absolute Damage** member; a
  [contemporary community description](https://www.reddit.com/r/EliteDangerous/comments/1uk2zhp/plasma_laser_theorycrafting_following_new/)
  by **u/Techno3020** likewise identifies this specific conversion's Plasma share as
  absolute damage. The post states no redistribution licence and is linked only as
  corroboration; none of its text or media is redistributed. Because every eligible laser
  is 100% thermal before conversion, each grade stores the resulting
  `damageDistribution`: from 96.1/3.9 thermal/absolute at grade 1 through 84.5/15.5 at
  grade 5. `$Thermal;` and `$Absolute;` are the journal labels synthesized from that
  distribution by the TypeScript implementation; Inara does not publish those spellings,
  and no raw `Loadout` capture of this blueprint is currently in the repository.
  Their per-roll `materials` are from the same registry (resolved to Frontier material
  `symbol`s against the `materials` domain); the per-roll **Merc-Coin** amount is also
  charged but is a currency, not a material, so it is not stored. Some totals are
  non-monotonic (pre-engineered UI values, not primitive weights — notably the
  Enduring-feedback rail-gun damage and the Balanced-distributor G4 mass) and are
  **preserved as published, not silently "corrected"**. The Merc-Coin **weapon-reward**
  recipes begin at grade 2 because the bought module already contains the grade-1
  pre-engineering; the general/core/optional recipes (fuel scoop, laser plasma-conversion)
  span grades 1–5, and the Anti-Guardian recipe is grade 1 only.

- **Anti-Guardian Zone Resistance is keyed three times: once as the game spells it, twice
  as the registries do.** `blueprints.jsonc` stores the one player-facing blueprint under
  **`GuardianModule_Sturdy`** — the id a journal writes, and the only one any engineering
  menu lists — and again under the registry's `recipe_guardianmodule_sturdy` and
  `recipe_guardianweapon_sturdy`, so a journal or saved build referencing any of the three
  resolves. All three carry the same display name, define grade 1 only, expose the
  `GuardianModuleResistance` activation Inara displays as +100%, and carry the same recipe
  (2×`TG_Abrasion03`,
  1×`TG_CausticCrystal`); the compatibility gate accepts the two registry spellings as the
  journal id's other names (§Engineering compatibility). They are intentional duplicates,
  not a copy-paste slip — do not dedupe them.
  - **The journal writes `GuardianModule_Sturdy`, on weapons as well as modules.** A
    `StoredModules` capture contributed by the repository owner (2026-08-07 UTC) carries a
    **Guardian Gauss Cannon** — a weapon — with `"EngineerModifications":
"GuardianModule_Sturdy"`, `Level` 1. So the module spelling is what the game writes
    whichever kind of module the recipe sits on, and there is no evidence the game ever
    writes a weapon spelling: `recipe_guardianweapon_sturdy` is a registry key, not an
    observed journal one. EDSY names the blueprint `GuardianModule_Sturdy` for the same
    reason. **So `GuardianModule_Sturdy` is the key all nine offering menus list**, and
    the two registry spellings are stored beside it as aliases that resolve to the same
    recipe. The observed journal name is the identity and the community names are aliases.
- **Anti-Guardian Zone Resistance and Plasma conversion are blueprints, not experimental
  effects.** The Anti-Guardian journal observation puts `GuardianModule_Sturdy` in the
  module's `EngineerModifications` / blueprint position with `Level` 1, and Inara publishes
  it as a grade-1 blueprint with a per-roll material recipe and no experimental-effect slot.
  Frontier's Operations update notes place **Thermal Plasma Conversion** under
  **Blueprints**, and the live Inara pages publish grades 1–5, per-roll materials and the
  ordinary laser experimental effects that can be applied alongside it. Consequently
  `special_guardian_module_resistance` and `special_plasma_rounds` are not incomplete
  effect identities: neither belongs in `experimental-effects.jsonc`. The shared
  `blueprintOnlyModifications` fixture pins both absences and the corresponding blueprint
  records. Frontier's update notes were acquired 2026-08-09 UTC from
  <https://forums.frontier.co.uk/threads/648012/>; the page exposes no immutable revision.
- **Experimental-effect source:** [EDSY](https://github.com/taleden/EDSY) `eddb.js`
  `expeffect` is the primary source — one table holding each effect's modifiers and its
  recipe together, keyed the way this file is. EDSY is (c) taleden under a
  **CC BY-NC 4.0** License (<http://creativecommons.org/licenses/by-nc/4.0/>). The
  underlying game logic is Elite Dangerous data, the property of Frontier Developments
  plc, under Frontier's media-usage terms. Each effect is `{ modifiers, materials }`:
  `modifiers` a list of `{ label, method, value }`, `materials` its `mats` map resolved
  from EDSY's material short-codes to Frontier material `symbol`s against the `materials`
  domain, emitting `{ symbol, name, count }` per requirement. An experimental effect is a
  single application (one roll), so its `materials` is the whole cost.
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
  Their one-application `materials` are from the same in-game / Inara registry (a
  Merc-Coin amount is also charged but is not stored). Every one is a weapon effect, and
  the weapon groups' menus list them.
- **Three effects state a fixed converted damage type.** High Yield Shell, Inertial
  Impact and Overload Munitions produce 50/50 kinetic/explosive, kinetic/thermal and
  explosive/thermal respectively. Applying one replaces the weapon's conventional
  `damageDistribution`; `weaponMetrics` and `effectiveStats` therefore expose the
  converted by-type damage. Generated engineering writes the same journal-shaped
  `$Kinetic;`, `$Thermal;` and `$Explosive;` percentage modifiers, and an imported
  journal's own values take precedence over the effect catalogue. The nested label
  mapping treats an absent base share as 0%.

  `journal-federation-corvette.json` independently settles High Yield Shell, stating
  `$Kinetic;` 100 → 50 and `$Explosive;` 0 → 50 for its large gimballed cannon. The
  shared `capturedBaseStats.convertedDamageDistributions` fixture pins that import through
  effective stats and weapon metrics. Three remains a lower bound rather than a count:
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
- **The `Decorative_*` transformations EDSY lists are not blueprints, and are carried in
  `decorative-modifications.jsonc` instead.** They are real ids the game writes in the
  same field as a blueprint, and they name no recipe — see §Decorative modifications
  below for what they are and why they are stored apart.
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
    no penalty at all — and each carries a `journalName` saying so. See the next bullet,
    and §Scanner Long Range and Wide Angle and §Multi-cannon Overcharged under Engineering
    options.
  - **Generic community-goal and tech-broker wrappers** ("Unique Modification", "Unique
    Enhancement") — reward placeholders that carry no grades or features, so there is
    nothing for the calculator to fold.
  - **Effects with no published magnitude** are not stored with invented numbers. Where a
    qualitative effect _is_ published with a recipe it is carried with an empty `modifiers`
    list and a `description`, as described above; where neither a magnitude nor a recipe is
    published, it is left out entirely.
- **Calculator:** `typescript/src/ships/engineering.ts` (`computeModifiers`), wired
  into `ShipLoadout.applyBlueprint`. Validated to reproduce the real "Deep Black"
  export's engineered figures — `FSDOptimalMass` 4670 → **7528.04** at G5 Long Range
  with the Mass Manager (`special_fsd_heavy`) experimental.
- **Cost:** `getBlueprintCost(fdname, grade, currentGrade = 0)` (in `blueprints.ts`)
  totals the materials to engineer a module up to a grade: grade `g` takes `g` rolls
  (`rollsForGrade`), so the total is `Σ g ·` (grade `g`'s recipe) over every grade from
  `currentGrade + 1` to the target. `currentGrade` defaults to 0 (unengineered); set it to
  `grade − 1` to price a single grade alone. Fold in an experimental effect's
  `getExperimentalEffectMaterials` with `sumMaterials` for the grand total; the two data
  modules stay decoupled so neither pulls the other into a bundle.

## Engineering options (what each module can take)

- **File:** `engineering-options.jsonc`, validated by `fixtures/ships/engineering-options.json`.
  Read it with `getEngineeringGroup` / `getBlueprintsForModule` /
  `getExperimentalsForModule` / `getExperimentalsForBlueprint` /
  `typescript/src/ships/engineering-options.ts`; `resolveBlueprintForModule`, which reads a
  menu against `Blueprint.journalName`, is in `typescript/src/ships/blueprint-journal.ts`.
- **Availability is a property of the module, not of the blueprint.** A Pulse Laser and a
  Rail Gun both take the Efficient blueprint but offer different experimental effects, so
  "which experimentals go with blueprint X" has no single answer. Modules are therefore
  grouped (53 groups covering 1028 engineerable modules) and each group lists the
  `blueprints` and `experimentals` it offers. `getExperimentalsForBlueprint` is provided
  for convenience and returns the **union** across every group offering that blueprint —
  deliberately looser than the per-module answer, and a test pins that it is never
  narrower.
- **Source:** [EDSY](https://github.com/taleden/EDSY) `eddb.js`, whose module-group tables
  carry each group's `blueprints` and `expeffects` lists and which modules belong to each
  group, and whose module records carry the per-module `noblueprints` / `noexpeffects`
  denials that narrow either list. Second registry: coriolis-data
  `modifications/modules.json`, which carries the same per-group lists keyed by the
  journal `BlueprintName`s this catalogue joins on.
- **Coverage: every group EDSY's `mtype` table gives a `blueprints:` key.** That is 53
  groups over 1028 modules, including bulkheads (the 241 ship armour records), life
  support, sensors, the Detailed Surface Scanner, cargo racks, refineries, AFMUs, fuel
  scoops, FSD interdictors and boosters, Guardian module and shield reinforcement, the
  four engineerable limpet controllers, chaff, heat sink and caustic sink launchers,
  point defence, ECMs, the KWS/manifest/wake scanners, the Guardian Gauss/Plasma/Shard
  weapons, the AX missile racks and the Enzyme Missile Rack.
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
  - **14 modules are absent because upstream denies them every blueprint:** eight AX
    multi-cannons (all but the two gimballed), five of the seven mining tools, and the
    Mk II Plasma Shock Accelerator — which is why `antiXenoMultiCannons` holds 2 of that
    family's 10 modules, `miningToolsLasers` 2 of its 7 and `plasmaAccelerators` 4 of its 5. The ten plain Module Reinforcement Packages are denied their family's only recipe
    and are absent too, which leaves `moduleReinforcements` holding the ten Guardian
    packages.
  - **The 171 modules absent take no engineering.** Whole families first, both registries
    agreeing: fuel tanks, passenger cabins, the repair/recon/research/decontamination and
    multi-limpet controllers, meta-alloy and ordinary module reinforcement, the Pulse Wave
    Analyser, the mining launchers, Shock Cannons, Nanite Torpedo Pylons, fighter and
    vehicle hangars, the docking computers and Supercruise Assist, the module stabilisers,
    the planetary approach suites, the cargo hatch and
    the AX utility modules (Xeno Scanners, Shutdown Field Neutralisers). Then the
    individually denied modules described above. `getEngineeringGroup` returning `null`
    therefore means "the game engineers nothing here", not "not listed yet" — see the API
    note in `engineering-options.ts`.
  - **EDSY's `_X_` prefix means "not applicable" and is honoured**, not stripped: the
    Detailed Surface Scanner's group lists only `iss_er` (`Sensor_Expanded`), because its
    three other entries are `_X_`-marked. The `Decorative_*` entries on the remote-release
    launchers are dropped for the same reason `blueprints.jsonc` does not carry them: a
    decorative transformation names no recipe, and no engineer applies one. So a
    launcher left with only those entries is offering nothing, and its `noblueprints`
    reading holds — carrying one already transformed is not the same as being
    engineerable. §Decorative modifications has the evidence.
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
  - **13 groups rest on EDSY alone**, because coriolis carries no blueprint list for
    them at all: the nine Guardian-only groups (`guardianPowerPlants`,
    `guardianPowerDistributors`, `guardianHullReinforcements`, `moduleReinforcements`,
    `shieldReinforcements`, `fsdBoosters`, `guardianGauss`, `guardianPlasma`,
    `guardianShard`), `antiXenoMissileRacks`, `experimentalWeapons`,
    `miningToolsLasers` and `antiXenoMultiCannons`. That is coriolis being
    silent rather than contradicting — its Guardian and anti-xeno groups are empty
    objects — but it means the second registry corroborates 40 of the 53 groups, not
    all of them. The Guardian-weapon menus are independently settled by the in-game
    observations below: stock weapons take Anti-Guardian Zone Resistance alone, while
    the pre-engineered articles are final.
  - **The multi-cannon Overcharged is the one place a group follows coriolis over EDSY.**
    EDSY has a single Overcharged for every weapon; coriolis splits it, and `multiCannons`
    lists coriolis's `MC_Overcharged`. `antiXenoMultiCannons` lists that key too, but not
    for that reason — coriolis carries no blueprint list for an anti-xeno group, so it is
    EDSY being followed into coriolis's spelling. See "Multi-cannon Overcharged: one
    journal id, two recipes" below for the evidence and for what the split costs.
  - **The groups name 86 of the 109 blueprints.** The other 23 are accounted for: 21 are
    Operations keys of modules sold already engineered rather than offered in a menu, and
    the other two are the registry's spellings of Anti-Guardian Zone Resistance, which every
    group lists under the journal id `GuardianModule_Sturdy`. Four Operations keys _are_
    named by a group, because they are recipes a player applies — see "Four Operations
    recipes are listed by a menu" below.
  - **14 modules are bound by the family rule, not by a source row.** EDSY has no live
    entry for `Int_Hyperdrive_Size8_Class{1..5}` or `Int_ShieldGenerator_Size1_Class4`
    (both present but commented out, and both naming their `mtype` — `cfsd` and `isg`),
    nor for eight of the `*_free` starter fittings. Each takes its family's group, on the
    same rule the stats above use: a `*_free` variant is its priced twin bar the price,
    and a size-8 drive is a drive. `Int_FuelTank_Size1_Class3_free` is not bound because
    fuel tanks are not engineerable.
- **Scanner Long Range and Wide Angle: one journal id, two recipes.**
  These two modifications are offered on the internal sensor suite _and_ on the
  KWS/manifest/wake scanners, and the game writes the same `BlueprintName` for both. EDSY
  is explicit about it — `cs_lr` (suite) and `scan_lr` (scanner) are two rows with
  different numbers and one `fdname: 'Sensor_LongRange'`, likewise `cs_wa` / `scan_wa`
  under `Sensor_WideAngle` — and its journal importer resolves a `BlueprintName` through a
  **per-module-type** map (`edsy.js` `Build.fromJournal`:
  `fdevmap.mtypeBlueprint[mtypeid][fdname]`), which is the same admission read as code.
  coriolis's `Scanner_LongRange` / `Scanner_WideAngle` keys are its own disambiguation, not
  a second journal spelling; its `fdname` field for both simply repeats its key. The two
  recipes disagree in both directions, so no rule of thumb recovers the right one:

  | Blueprint id (G1) | Sensor suite                          | Utility scanner                          |
  | ----------------- | ------------------------------------- | ---------------------------------------- |
  | `…_LongRange`     | `Mass` ×1.20, `ScannerRange` +0…15%   | `PowerDraw` ×1.10, `ScannerRange` +0…24% |
  | `…_WideAngle`     | `PowerDraw` ×1.10, `ScannerRange` −4% | `Mass` ×1.20, `ScannerTimeToScan` +10%   |

  Both keep their `SensorTargetScanAngle` leg. The catalogue keeps coriolis's split keys,
  because two recipes need two records and the menus have to name the one they roll.

  **The fix is two stored facts and no third list.** What the game writes for a recipe is a
  property of the recipe, so it is stored on the recipe: `blueprints.jsonc` gives
  `Scanner_LongRange` and `Scanner_WideAngle` a **`journalName`** naming the id a journal
  carries. They are two of the three records that carry the field out of 109 —
  `MC_Overcharged`, below, is the third. Every other key either already _is_ the id a
  journal writes or is an Operations spelling, which is why the field is absent everywhere
  else. Which of the two colliding recipes a given module rolls is a property of the module,
  and `engineering-options.jsonc` already carries it — the
  menu. `resolveBlueprintForModule` is the join: it asks which blueprint _this module is
  offered_ answers to the incoming id. `ShipLoadout.applyBlueprint` resolves before it
  folds, so an EDSY-authored build declaring `Sensor_LongRange` on a wake scanner
  engineers, and engineers the scanner's numbers.

  Storing it as a per-group alias map instead is worse: the same two entries would be
  repeated on every scanner group — three today — and silently missing from the fourth if
  the game ever adds one, which is the hand-maintained-second-answer failure
  §Engineering compatibility below was written about. Deriving it by _signature_,
  the way the generic `Misc_*` spellings are derived, is not available either: these two
  ids touch different labels by design, so a signature match could never fire, and any
  looser rule would be inventing a pairing rather than reading one.

  The resolution runs into a menu and never out of one — a sensor suite is not thereby
  offered `Scanner_LongRange` — and it is only well defined while no menu offers two
  blueprints written the same way, which a test asserts for all 53. Both directions are
  pinned in `fixtures/ships/engineering.json` (`scannerIdCollision`): the exact modifier
  block the same id produces on each family, and `journalNames`, the whole of the blueprint
  side.

  **The join lives in a module of its own so a menu-only consumer does not import the
  recipes.** `ships/blueprint-journal` depends on both catalogues;
  `engineering-options` carries no recipe data in its graph. `package.test.mjs` asserts
  that separation and bounds the menu graph at 96 KB.

  The evidence for the collision is in `edsy.js` — the file carrying `Build.fromJournal`
  — rather than in the `eddb.js` tables the rest of this section reads, which is why both
  EDSY files are pinned at the head of this document.

- **Checked against the build corpus.** Of the 1902 declared engineering entries in
  `fixtures/ships/builds/`, 1900 sit on a module this catalogue groups, and 1882 are
  applicable end to end: the module is grouped, its group offers the blueprint, and where
  an experimental is declared the module can take it. 70 of the 1882 declare the generic
  spelling of a family-specific recipe (`Misc_LightWeight` on a life support, and so on)
  and count as offered; the shape of that judgement is pinned in the fixture as
  `corpus.blueprintAliases`. A further **71** are a journal spelling resolved against
  `journalName` above, counted separately as `corpus.journalSpellingsAccepted` because it
  is a different mechanism — 70 of them `Weapon_Overcharged` on a multi-cannon, which
  rolls `MC_Overcharged`, and the 71st `Sensor_LongRange` on a wake scanner in
  `type9-military-combat-3`. Another **18** describe final pre-engineered Guardian
  weapons rather than recipes a player may apply: 5 Guardian Gauss Cannons declaring
  `Weapon_HighCapacity`, 5 medium and 2 small Guardian Plasma Chargers declaring
  `Weapon_Overcharged`, and 6 Guardian Shard Cannons declaring `Weapon_LongRange` plus
  `special_super_penetrator_cooled`. Their stock counterparts offer only Anti-Guardian
  Zone Resistance; the final articles offer nothing. The fixture pins those four shapes
  under `corpus.finalPreEngineered`.

  The remaining two are `corpus.notEngineerable`: `Weapon_Efficient` on the Mk II Plasma
  Shock Accelerator (both in `smallcombat01-nx-combat`), which EDSY denies every blueprint
  (`noblueprints: {'*'}`). coriolis cannot corroborate either way: its
  `modifications/modules.json` is keyed by module _group_, so it says nothing about one
  module. This is the one case where the corpus declares engineering on a module the game
  does not let a player engineer. The Mk II weapon is absent from the pinned upstream
  engineering data, so the catalogue does not infer a menu from the corpus.

  A corpus build's engineering is declared by its author, never read off an outfitting
  screen, so it is evidence about the catalogue but not authority over it. Of the **39
  module bindings** that rest on a `noblueprints` denial, the corpus engineers exactly one
  module at all — the Mk II above, twice. It offers no support for the other 38 denials
  and no contradiction of them, which is the strongest check available on data that only
  one registry publishes.

- **File order is derivable:** `modules` is written group by group in the order `groups`
  declares them, and within a group in module-catalogue order, so a re-derivation from the
  same sources reproduces the file rather than reshuffling it.
- **`exclusions` are the exceptions, and they are real.** 24 modules take their group's
  blueprints but not all of its experimental effects: 13 Multi-cannons cannot take Phasing
  Sequence, six dumbfire racks cannot take Drag Munitions, four missile racks are short of
  Penetrator Munitions or FSD Interrupt, and the small fixed Abrasion Blaster takes none
  at all. Upstream these are an exclusion map (with a wildcard for "none of them"); here
  the wildcard is **expanded to the explicit list** so a consumer never has to interpret
  one. A module absent from `exclusions` takes its whole group's list. Five mining tools
  that would otherwise be listed here are absent from the catalogue entirely, taking no
  blueprint either.
- **Kept deliberately:** the Abrasion Blaster stays in `modules` (it has a blueprint) even
  though its experimental list resolves to empty — "engineerable with no experimental
  slot" and "not engineerable at all" are different answers, and `getEngineeringGroup`
  separates them. That distinction carries most of the catalogue: 30 of the 53 groups
  offer no experimental at all, so 388 of the 1028 grouped modules answer `[]` while still
  having blueprints.
- **Key form:** the Anti-Guardian blueprint is listed under `GuardianModule_Sturdy`, the id
  a Loadout writes and the one EDSY uses. The registry's `recipe_guardianmodule_sturdy` and
  `recipe_guardianweapon_sturdy` are stored in `blueprints.jsonc` beside it so a build
  carrying either still resolves, but a menu lists the journal spelling.
- **A Guardian module has no experimental slot.** This is a rule about the recipe rather
  than about any one module: **Anti-Guardian Zone Resistance carries no experimental
  effect, and on a Guardian _module_ — power plant, power distributor, hull/module/shield
  reinforcement package, FSD booster — it is the whole menu.** An engineered Guardian
  module that does carry an experimental was obtained **already engineered**, as a
  community-goal reward or a tech-broker unlock, rather than rolled at an engineer; this
  file answers what a player may apply, so it does not list those. All nine groups
  offering `GuardianModule_Sturdy` therefore list `"experimentals": []`.
  - **"Whole menu" holds for the weapon groups too.** `guardianGauss`,
    `guardianPlasma` and `guardianShard` are menus of `GuardianModule_Sturdy` alone. An
    ordinary recipe reaches a Guardian weapon only as a purchase, represented in
    `pre-engineered.jsonc`.
  - **The reward variants are not catalogued anywhere here, and that is a gap.**
    `pre-engineered.jsonc` carries seven Guardian rows and all seven are **weapons**
    (Gauss, Plasma, Shard), each with a `blueprint` and no `experimental`; there is no
    `Int_Guardian*` row at all. So a Guardian power plant that arrived from a community
    goal with, say, `special_powerplant_lightweight` on it is recorded in neither file —
    the menu correctly refuses it, and the pre-engineered catalogue does not describe it.
    No registry publishes those variants, which is why none is invented here. Nothing in
    this repository should be read as claiming otherwise.
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
    of the 1902 declared engineering entries in `fixtures/ships/builds/` engineers a
    Guardian power plant, distributor or hull reinforcement package at all. Its
    Guardian-weapon entries are final pre-engineered articles, a separate case recorded
    below.
  - **What a consumer sees:** `getExperimentalsForModule` answers `[]` for the 25 modules
    in the three split families above (`guardianPowerPlants`, `guardianPowerDistributors`
    and `guardianHullReinforcements`), `ShipLoadout.applyBlueprint` refuses an
    `experimental` on them, and `getExperimentalsForBlueprint('GuardianModule_Sturdy')`
    answers `[]` rather than a union across the nine groups that offer the recipe.
    Blueprints are unaffected on every module. Pinned in
    `fixtures/ships/engineering-options.json` as `antiGuardianZoneResistance` (the nine
    groups, the empty list, six representative modules) and on each half of
    `splitFamilies`.
- **Multi-cannon Overcharged: one journal id, two recipes.** `multiCannons` and
  `antiXenoMultiCannons` list **`MC_Overcharged`** where every other weapon menu lists
  `Weapon_Overcharged`, and the record carries `journalName: "Weapon_Overcharged"`. Same
  shape as the scanner ids above, in the family far more consumers touch: 70 of the
  corpus's 1902 declared entries resolve through it, against one for the scanners.
  - **Source: coriolis-data, which states it twice.** `modifications/modules.json` lists
    `MC_Overcharged` on exactly two groups — `mc` (multi-cannons) and `advmc` (Advanced
    Multi-cannons) — and `Weapon_Overcharged` on the other six weapon groups offering
    Overcharged at all (`bl`, `c`, `fc`, `pa`, `pl`, `ul`). `modifications/blueprints.json`
    gives **both** keys the fdname `Weapon_Overcharged`, which is the statement that one
    journal id names two recipes. That file is pinned by SHA-256
    `cba5a11fc7728e0d1da63fcbbc8d9dfedf9fbc51c99692ee187c7bf0293b3fa1`, read 2026-08-07
    UTC; `modifications/modules.json` is the snapshot the table above pins.
  - **The two recipes differ by one leg.** `MC_Overcharged` carries an `AmmoClipSize`
    **reduction** at every grade — −3% at grade 1 to −15% at grade 5, the cost Overcharged
    charges for its damage — that `Weapon_Overcharged` does not; the materials are
    identical grade for grade. Reading the journal id as `Weapon_Overcharged` on a
    multi-cannon drops that penalty and makes the recipe look strictly better than the game
    makes it.
  - **EDSY agrees the leg exists and differs about who pays it.** `eddb.js` has one
    Overcharged (`wpn_oc`) carrying `ammoclip:[-3,-6,-9,-12,-15]` for _every_ group that
    lists it. So coriolis expresses the leg by splitting the key and EDSY by keeping one
    recipe whose clip leg is inert on a clipless weapon; on the multi-cannon they agree,
    which is what `multiCannons` follows. **This is not the scanner collision's shape** and
    the comparison should not be pushed that far: the scanner pair is two recipes rolling
    different stats in opposite directions on two families, this pair differs by one leg on
    one family in the direction both sources give it.
  - **`antiXenoMultiCannons` takes `MC_Overcharged` on EDSY's word alone.** coriolis keys
    the anti-xeno multi-cannons apart as `axmc` and gives that group no Overcharged at all,
    so it cannot say which of its two keys an AX multi-cannon takes. That silence does not
    leave the question open, because this is one of the 13 groups resting on EDSY alone,
    where the rule is to follow the only registry that covers the group unless a capture
    contradicts it — as one does for the three Guardian weapon groups above, and none does
    here. EDSY's single `wpn_oc` carries the clip leg on every group that lists it, `axmc`
    included, and both AX multi-cannons carry a clip. Answering the leg answers the key
    too. coriolis's two keys differ by exactly that leg and nothing else — same name, same
    three other legs, same materials grade for grade — so the clip-carrying record is the
    only one either registry could be describing, and naming it is reading EDSY rather than
    guessing at coriolis. No registry writes this row down as it stands — coriolis carries
    no blueprint list for the group and EDSY does not use the key — so it is the one menu
    row assembled from one registry's coverage and the other's spelling.
  - **The clip leg stops at the multi-cannon, and Frontier says so.** The 26 clip-bearing
    modules the other groups hold — 12 cannons, 10 fragment cannons and four plasma
    accelerators — fold no clip change, and the game agrees on all three groups.
    `fixtures/ships/journal-federation-corvette.json` carries a **large gimballed cannon
    under `Weapon_Overcharged` at grade 5, quality 1**, with High Yield Shell. Its eight
    `Modifiers` are `DamagePerSecond`, `Damage`, `DistributorDraw`, `ThermalLoad`,
    `RateOfFire` and the experimental's three-part damage-type split — and **no
    `AmmoClipSize`**. `AmmoInClip` is **5** against the module's stock magazine of 5, so
    the roll left the magazine where it was; a 15% cut would have left four rounds, and a
    journal writes the leg out wherever a recipe applies one — as this repository's other
    captures show it doing for the `AmmoClipSize` and `AmmoMaximum` a High Capacity roll
    charges.
    - **The roll is a full grade 5, so the missing leg is the recipe and not a partial
      craft.** `DistributorDraw` 1.14 → 1.539 is ×1.35 and `ThermalLoad` 2.93 → 3.3695 is
      ×1.15 — Overcharged's grade-5 figures exactly. `Damage` 37.421 → 41.350 is
      ×1.70 × 0.65, the recipe's grade-5 damage against High Yield Shell's own −35%;
      `RateOfFire` 0.440529 → 0.396476 is that experimental's burst-interval leg; and
      `DamagePerSecond` is the product of the two, as it is before the roll. Every number
      in the block is accounted for and none of them is a clip.
    - **A fragment cannon says the same, at a different grade and an interpolated
      quality.** `fixtures/ships/journal-federation-corvette-plasma.json` carries a
      **medium fixed fragment cannon under `Weapon_Overcharged` at grade 4, quality
      0.826**, with Corrosive Shell. Its five `Modifiers` are `DamagePerSecond`,
      `Damage`, `DistributorDraw`, `ThermalLoad` and the experimental's `AmmoMaximum`
      — and **no `AmmoClipSize`**. The roll is accounted for the same way the cannon's
      is: `DistributorDraw` 0.37 → 0.481 is ×1.3 and `ThermalLoad` 0.74 → 0.8288 is
      ×1.12, Overcharged's flat grade-4 figures, and `Damage` 2.985 → 4.724061 is
      ×1.5826, its grade-4 damage band 1.5–1.6 read at the stated quality. The reserve
      leg is Corrosive Shell's flat −20% (180 → 144), not a clip leg by another name.
    - **What that reading adds is the modifier list, not a second count of loaded
      rounds.** `AmmoInClip` is 3 against the module's stock magazine of 3, and that is
      consistent either way: the grade-4 clip leg is −12%, and 3 × 0.88 is 2.64, which
      rounds back to 3 under the whole-round rule this library and both registries
      apply. Where the cannon's magazine corroborates its absent leg, the fragment
      cannon's cannot, so what carries this case is Frontier writing no `AmmoClipSize`
      on a second group and at a second grade. The quality is not part of that argument
      — the clip leg is flat per grade in both registries, so a rolled one would have
      landed at −12% whatever the quality — but the `Damage` leg lands off both band
      endpoints, which says the roll was a genuine interpolated one rather than a
      full-quality craft.
    - **A plasma accelerator closes the third group, at a third grade.**
      `fixtures/ships/journal-caspian-explorer.json` carries a **medium fixed plasma
      accelerator under `Weapon_Overcharged` at grade 1, quality 1**, with no
      experimental. Its four
      `Modifiers` are `DamagePerSecond`, `Damage`, `DistributorDraw` and `ThermalLoad` —
      and **no `AmmoClipSize`**. Nothing in the block is unaccounted for, and at full
      quality every one of its three recipe legs is reproducible rather than merely
      consistent (`DamagePerSecond` is the fourth modifier and not a fourth leg: it is
      the `Damage` leg folded against the weapon's unmodified rate of fire, 70.589996 ×
      0.330033, and its ×1.3 over the base figure is the damage leg alone — the
      distributor and thermal legs are not factors in it):
      `computeModifiers` folding grade 1 at quality 1 gives `Damage` 54.3 → 70.59 (the
      grade's 0–30% band read at its top), `DistributorDraw` 8.65 → 9.9475 (×1.15) and
      `ThermalLoad` 15.58 → 16.0474 (×1.03), which are the three figures Frontier states
      to within its own float noise. As on the fragment cannon the magazine settles
      nothing by itself — the grade-1 cut is −3%, and 5 × 0.97 = 4.85 rounds back to the
      stock 5 — so the modifier list is again what carries it. With this each of the
      three clip-bearing groups that take the recipe has been read once, so the 26
      modules between them rest on a reading of their own group rather than on the
      registries alone.
    - **EDEngineer says it too, and not by reading coriolis.** EDEngineer `blueprints.json`
      keys a recipe on **(weapon type, blueprint, grade)** rather than on a recipe id — the
      shape the engineer menus themselves have — lists Overcharged on exactly the seven
      weapon types coriolis covers, and carries its `Clip Size` leg of −3% to −15% on the
      multi-cannon alone. Its `CoriolisGuid` field is a uuid join into coriolis's per-grade
      `uuid` — exact where it resolves, and it does not resolve everywhere — and coriolis
      gives its two Overcharged records ten distinct uuids
      sharing none — yet **all 35** of EDEngineer's Overcharged rows, across all seven
      types and every grade, carry the five belonging to the _clip-less_
      `Weapon_Overcharged`. So the clip leg on its multi-cannon rows cannot have come from
      the record those rows cite. It is not blind to the stat on the groups in question
      either: High Capacity
      carries `Clip Size +100%` on the cannon and on the fragment cannon, and the fragment
      cannon's Double Shot sets a clip outright.
    - **EDSY is the outlier, and not for want of a way to say otherwise.** `eddb.js`'s
      blueprint table is willing to hold two rows under one fdname: `Sensor_LongRange` and
      `Sensor_WideAngle` are the only fdnames among its 67 rows used twice, and they are
      used twice deliberately (§Scanner Long Range and Wide Angle). So the single `wpn_oc`
      carrying `ammoclip` for every weapon is a position rather than a limitation — and it
      is the position all three captures contradict. Reading it would report a cannon four
      rounds the game loads five of.
    - **A capture that disagreed would split the key again, not overturn a reading.** The
      three readings are one module each, at one grade each, and none of them is a survey
      of its group — what they settle is that the recipe carries no clip leg on the group
      the module belongs to. Should a later capture state an `AmmoClipSize` on any of the
      three, the fix is a further key split for that group, since two of the three would
      still be pinned to readings taken from the game.
    - **None of the six Guardian plasma launchers is in this set** — their menu lists
      Anti-Guardian Zone Resistance and nothing else, and the Fixed Small and Fixed Medium
      are sold carrying `Weapon_Overcharged` rather than offered it. The three laser groups
      do list Overcharged and carry no clip, so the question never reached them.
  - **The sale rows follow the menu.** `pre-engineered.jsonc` sells both AX multi-cannons
    as the tech-broker Enhanced AX Multi-Cannon with Overcharged already applied, and its
    `blueprint` names the recipe rather than the id a journal writes, so those two rows
    name `MC_Overcharged` as well. Nothing about the sale changes: a reward variant's stats
    are its own stored block, never the recipe folded. What it keeps true is that no
    pre-engineered row names a spelling that resolves, on its own module, to a different
    recipe — the case `blueprintAvailableFor` describes, where the non-final sale route
    accepts an id the fold then reads as something else. `pre-engineered.test.ts` asserts it over all 73
    rows, and both AX rows are pinned in `fixtures/ships/pre-engineered.json`, so a port
    validates the same rule. The two Guardian plasma launchers sold under
    `Weapon_Overcharged` are final and never take the sale route; that id is still their
    own recipe, and their menu offers no Overcharged for it to resolve into.
  - **What a consumer sees:** `getBlueprintsForModule` answers `MC_Overcharged` on all 14
    multi-cannons and on both AX multi-cannons; `applyBlueprint` accepts either spelling,
    resolving the journal one against the menu, and folds the clip reduction. Pinned in
    `fixtures/ships/engineering.json` as `overchargedIdCollision` — five modifier blocks
    in full, with the medium cannon, the medium fragment cannon and the medium plasma
    accelerator as the controls that take the same journal id and no clip leg — and in
    `journalNames`.
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

  So these recipes reach the weapons only as **pre-engineered identities**, and the menu
  must not offer them — otherwise
  `getBlueprintsForModule` promises a Guardian Plasma Turret an Overcharged roll that no
  engineer will perform. `engineering-options.test.ts` classifies the 18 corpus entries as
  `finalPreEngineered` before checking applicable recipes, and `pre-engineered.jsonc`
  marks all seven catalogued Guardian-weapon variants `engineeringLocked: true`.

- **Four Operations recipes are listed by a menu.** Most Operations keys belong to modules
  bought already engineered and no menu names them, but `FuelScoop_Efficiency` on
  `fuelScoops` and, on the three laser groups, `PulseLaser_ThermalPlasmaConversion`,
  `BurstLaser_ThermalPlasmaConversion` and `BeamLaser_ThermalPlasmaConversion` are recipes
  a player applies. (Anti-Guardian Zone Resistance is the fifth menu recipe of that kind,
  listed under the journal spelling `GuardianModule_Sturdy`
  rather than an Operations key.)
  - **The grade range is what separates a recipe from a purchase.** A Merc-Coin
    weapon-reward recipe begins at grade 2 because the bought module already contains the
    grade-1 pre-engineering; a recipe defining a grade 1 has nothing pre-applied and is
    rolled at an engineer from stock. All 21 recipes bound to a pre-engineered row run 2–5;
    these four run 1–5 and are the only Operations keys that do, apart from the grade-1-only
    Anti-Guardian pair.
  - **The module family is a field this file already carries.** The Inara registry that
    supplied these recipes supplied their display names, and the name states the family:
    "Fuel Scoop — Scoop rate enhanced", "Beam Laser — Plasma conversion", and so on. That is
    the same reading already load-bearing in `pre-engineered.jsonc`, where
    `SeekerMissileRackMedium_Lockdown` binds to the medium rack. It is **not** the
    prefix inference the family map used: that guessed a family from a _module symbol_,
    where this reads a family the registry names.
  - **The modifier legs agree.** `FuelScoop_Efficiency` moves `RefuelRate` and
    `PowerDraw`, and a fuel scoop is the only module in the catalogues with a `RefuelRate`
    to move. The three plasma conversions move `PowerDraw` and `Damage`; their names
    narrow them to one laser family each. Their player-facing Thermal / Plasma source legs
    become the grade's complete thermal/absolute `damageDistribution` rather than scalar
    features; the mapping and its evidence are recorded with the catalogue source above.
  - **Neither menu registry lists them, which is expected rather than a conflict.**
    `eddb.js` contains no `recipe_` string at all and coriolis's group tables carry only
    journal-keyed ids, so both are silent on the whole Operations family; these recipes have
    never come from either. The live Inara Plasma conversion pages, acquired directly
    2026-08-09 UTC (no immutable revision is exposed), publish a per-roll material cost
    **plus a Merc-Coin amount** — the shape of a blueprint rolled at an engineer, not of a
    module bought ready-made. The Burst and Beam pages are `/elite/blueprint/202/` and
    `/elite/blueprint/203/`; the Pulse page exposes the same five damage-share totals.
  - **What a consumer sees:** one more id on 40 fuel scoops and on 12 modules in each laser
    group. No experimental list moves.
## Decorative modifications

- **File:** `decorative-modifications.jsonc`, validated by the `decorativeModifications`
  block in `fixtures/ships/engineering.json`. Read it with `getDecorativeModification` /
  `isDecorativeModification` / `getDecorativeModificationsForModule` /
  `typescript/src/ships/decorative-modifications.ts`. Three records —
  `Decorative_Green`, `Decorative_Red`, `Decorative_Yellow` — each
  `{ name, modules, modifiers }`.
- **They are a festive transformation the game writes in an engineering field, which is the
  whole of the problem they cause.** A `StoredModules` capture contributed by the repository owner
  (521 stored modules, 2026-08-07 UTC) holds three medium turreted Remote Release Flak
  Launchers, one per colour, in `EngineerModifications`. Those three are the only ones of
  the capture's 46 distinct spellings that name no recipe: every other spelling, down to
  the lower-case `weapon_longrange` the game writes on a Guardian Shard Cannon, resolves
  against `BLUEPRINTS`. An id that resolves to nothing looks exactly like a catalogue gap
  and is not one, which is what this catalogue exists to say.
- **Why they are not in `blueprints.jsonc`.** There is no recipe to store: no grade, no
  material cost, and no engineer who applies one. Giving them an empty grade 1 so the key
  would exist would state a recipe the game does not have, and would make
  `getBlueprintCost` price a roll nobody can make. A separate catalogue costs a few hundred
  bytes and claims only what is known.
- **They are not cosmetic-only: each carries a −99% `Damage` modifier.** A festive launcher
  fires fireworks rather than flak, and the cut is what makes that true. It is the only
  stat any of the three moves, and it is stored, so no record here may be read as "this
  module is unmodified" — reading one that way overstates a fitted launcher's damage a
  hundredfold. EDSY lists the three transformations with no modifiers, which the cut shows
  to be an incomplete record rather than a second opinion.
  - **The method is derived, not assumed.** The figures are the repository owner's
    outfitting panel: the transformation at −99.0%, the resulting launcher at 0.3 damage
    and 0.2/s. The panel rounds to one decimal, so no one of those pins the modifier —
    together they do. −99.0% of the medium turreted launcher's 34 base damage is 0.34,
    which displays as 0.3, and 0.34 × its 0.5 rate of fire is 0.17, which displays as
    0.2/s. A flat `overwrite` to the displayed 0.3 would read −99.1% and 0.1/s, matching
    neither of the other two. So the modifier is multiplicative and the panel's 0.3 is a
    rounding of 0.34. `fixtures/ships/engineering.json` pins all three figures and the test
    recomputes them, which is what would catch the stored value being re-entered as the
    number the panel printed.
  - **A moving stat is still not a reason to put them in `BLUEPRINTS`.** A modifier set
    that arrives fixed with an awarded module is a pre-engineered variant in shape, not a
    blueprint — no roll, no grade, no quality — which is why the records carry
    `pre-engineered.jsonc`'s `{ label, method, value }` vocabulary rather than a
    `BlueprintFeature`'s `min`/`max`. What does not work is a `PreEngineeredVariant` row
    itself: that needs a `blueprint` joining to `BLUEPRINTS` and a `grade`, and these have
    neither. The shared vocabulary is the useful half — read each value as its own `min`
    and `max` and a decorative modifier goes through `computeModifiers` unchanged, exactly
    as `pre-engineered-stats.ts` does for a bought variant.
- **Why they are in no engineering menu.** No engineer applies one: the three launchers
  were **awarded** already transformed, so the module arrives carrying the transformation
  rather than being taken to an engineer for it — the same shape as the Guardian modules whose
  community-goal experimental effects §Engineering options keeps out of the menus. **That
  acquisition route is the contributor's account, not a reading of the capture**, which
  records the transformation and nothing about how the module was obtained; it is stated
  here because it is what the exclusion rests on, and no journal field can corroborate it.
  It is also what makes EDSY's Decorative entries a `noblueprints` reading rather than an
  engineerable one: a remote-release launcher left with only those entries is offering
  nothing, so it stays ungrouped, `getEngineeringGroup` answers `null` for it, and
  `applyBlueprint` refuses every recipe on it.
- **`modules` is what has been observed, not what the game permits.** The medium turreted
  Remote Release Flak Launcher (`Hpt_FlakMortar_Turret_Medium`) is the only module any
  capture shows carrying a decorative transformation, and it is the only symbol stored.
  A module absent from the list is one nothing has been seen on; the field is worded that
  way in the API rather than as a permission.
- **`name` pairs the festive naming with the id's colour** — `"Festive Green"`,
  `"Festive Red"`, `"Festive Yellow"`. No registry publishes the outfitting panel's own
  string: EDSY carries the transformation, not a label. The festive naming is the
  repository owner's, recorded because it is what the transformation is known as and is
  more use to a UI than a bare colour; if the panel wording is ever read off the game, it
  replaces this verbatim.
- **What a consumer gets.** `getBlueprint('Decorative_Green')` answers `null`, because it
  is not a blueprint; `isDecorativeModification` is what tells that apart
  from an id the library has never heard of. `ShipLoadout.applyBlueprint` refuses a
  decorative id with a `TypeError` naming the transformation, not with the `RangeError` a
  missing grade earns: the id is real, and the refusal has to read that way. Importing a
  build is unaffected either way — `fromLoadout` stores the `Engineering` block as the
  journal wrote it and never looks the id up. A build assembled by hand carries the cut
  only if the consumer folds `modifiers` in themselves, which `computeModifiers` does in
  three lines; a build imported from a journal already has it, the game's own
  `Engineering.Modifiers` being exact.

## Engineering compatibility (may this recipe go on this module?)

Not a data file, and not a second opinion. `ShipLoadout.applyBlueprint` reads the menu
above: a recipe it does not list for that module is refused. The two questions a consumer
can ask — what a module takes, and whether a particular recipe may go on it — therefore
cannot disagree, and `engineering.test.ts` asserts that for all 1199 modules.

**Do not reintroduce a family map.** Inferring a module's family and a blueprint's family
from their symbols, and comparing the two, is the obvious alternative and it is worse:
two hand-maintained answers to one question drift, and measured against the menu that
inference refused recipes on 52 modules and mismatched 76 of the corpus's 1902 declared
entries. Both failures were in the inference rather than in any data — the Hatch Breaker
Limpet Controller's symbol is `Int_DroneControl_ResourceSiphon`, which a "hatchbreaker"
prefix rule never matches, and the Caustic Sink Launcher's says `causticsink` where its
group is the heat sink launchers'. A per-module menu has nothing to infer.

Three accommodations sit beyond the menu, and the three bullets below are them. They are
listed as they are best explained rather than as they run — the gate applies the journal
spelling first, then the non-final pre-engineered route, then the generic spelling, and
only the first can change _which recipe_ an accepted id names, so the other two cannot
disagree whichever way round they are asked. `loadout-engineering.ts` states the running
order.

- **Accommodation: the journal spelling of a menu entry.** Where the game writes one
  `BlueprintName` for two different recipes, the module's own group carries the map from
  that id to the entry of its menu it names — only the three utility-scanner groups need
  one, and §Scanner Long Range and Wide Angle above is the whole of it. It is pinned data,
  not inference, because unlike the generic spellings below the two ids do _not_ describe
  the same modification.
- **Accommodation: the generic spelling.** Where a modification applies to several
  families the game writes a family-specific `BlueprintName` and this catalogue lists that
  one, but a build authored elsewhere carries the generic `Misc_*` id — 70 corpus entries
  do. Both are accepted, because both name the same recipe, and `blueprints.jsonc` shows
  it: their grades touch the same labels by the same methods. The pairs are pinned in
  `fixtures/ships/engineering-options.json` (`corpus.blueprintAliases`) and the gate derives
  exactly that set, which a test asserts rather than trusting.
- **The alias is directional, and that is what keeps it safe.** A generic id stands in for a
  family's id, never for another generic one: `Misc_ChaffCapacity` and
  `Misc_HeatSinkCapacity` are both "Ammo capacity" over the same three labels, but they
  roll different amounts of different ammunition — the chaff recipe adds up to +50% of a
  chaff launcher's 10 rounds, the heat sink's a flat +49% of a launcher's 2 — so neither
  may substitute for the other. An id **no menu lists anywhere** substitutes too, which
  covers Anti-Guardian Zone Resistance, whose two registry spellings
  (`recipe_guardianmodule_sturdy`, `recipe_guardianweapon_sturdy`) sit beside the
  `GuardianModule_Sturdy` the nine offering groups list — see §Engineering, "Anti-Guardian
  Zone Resistance is keyed three times". The game writes only the last of the three, so
  the other two reach the recipe through this route. `Weapon_LightWeight` is excluded by
  the labels instead — a weapon's Lightweight cuts distributor draw, which the generic one
  does not touch.
- **What the corpus cannot engineer, and why refusing is the honest answer.** Two entries
  put `Weapon_Efficient` on the Mk II Plasma Shock Accelerator, which EDSY marks
  `noblueprints`. They are recorded under `corpus.notEngineerable` by identity and count,
  so a new disagreement cannot hide in the allowance. The 18 Guardian-weapon entries are
  refused for a different reason: they describe final pre-engineered articles, pinned
  under `corpus.finalPreEngineered`, rather than recipes a player may apply.
- **Accommodation: the pre-engineered route.** Most Operations keys belong to a module
  bought already engineered, so no menu lists one and the menu check alone would refuse
  all 21 of them everywhere. (The four a menu _does_ list are recipes a player rolls from
  grade 1 and need no accommodation; see §Engineering options.)
  `pre-engineered.jsonc` names which module each arrives on, so the gate accepts a recipe on
  the non-final module that is sold carrying it and nowhere else:
  `RailGun_LongShot` resolves on the medium rail gun, not on the small one. What
  that buys is the **climb**, not the purchase: a Mercenary module arrives at grade 1
  and its recipe publishes grades 2–5, the grades an engineer can still add. It cannot
  reproduce the grade the module was sold at — all 22 Mercenary rows are grade 1, none of
  those recipes defines a grade 1, and the blueprint lookup refuses that call before the
  gate is reached — and it is not how a reward variant is recreated either, which
  `pre-engineered-stats` does from the variant's own `modifiers`. A row marked
  `engineeringLocked` never takes this route. One of the 22 Mercenary rows, the
  Mercenary Module Reinforcement Package, has no engineering menu at all, so the gate asks
  what a module is _sold_ with before it concludes the module takes nothing.

  **Every blueprint and experimental effect reaches at least one module.** The sweep
  behind the claim — every id in `BLUEPRINTS` and `EXPERIMENTAL_EFFECTS` against all
  1199 module symbols, through the gate — is pinned whole in
  `fixtures/ships/engineering.json` under `reachability`, residue included, so an id
  stranded by a catalogue change fails a test rather than passing unnoticed.

## Pre-engineered modules

- **File:** `pre-engineered.jsonc`, validated by `fixtures/ships/pre-engineered.json`.
  Read it with `getPreEngineeredVariants` / `getPreEngineeredByBlueprint` /
  `isPreEngineered` in `typescript/src/ships/pre-engineered.ts`, and resolve a variant
  into a fittable module with `getPreEngineeredStats` in `pre-engineered-stats.ts`.
- **Why it is a catalogue of its own.** A pre-engineered module has **no symbol of its
  own** — the game sells an ordinary module with engineering already applied, and a
  journal `Loadout` reports it as the base `symbol` plus an `Engineering` block. So the
  module catalogues already hold every one of these modules and `blueprints.jsonc`
  already holds every one of these blueprints; what neither can hold is the **link**
  saying which stock modules can be bought already engineered, and with what. That link
  is this file. Each record is a
  pairing — `{ symbol, name, blueprint, grade, acquisition }` plus the stat block and
  price described below — not a module, which is also why it is exempt from the "unique
  symbols per catalogue" rule the other array-shaped files follow.
- **Neither column is a key on its own.** One base module is sold in several
  pre-engineered flavours (the medium Seeker Missile Rack has six), and one blueprint is
  sold on several base modules (the Drag seeker on both the medium and the large rack),
  so both lookups return arrays.
- **`acquisition` says where a variant comes from.** 73 records: 22 `mercenary`,
  30 `communityGoal` and 21 `techBroker`.
  - **`mercenary`** — the Merc-Coin shop rows. Source: the in-game outfitting and
    blueprint registries, cross-checked against the current
    [Inara outfitting](https://inara.cz/elite/outfitting/) and
    [blueprint](https://inara.cz/elite/blueprints/) registries and Frontier's update
    notes. All 22 are grade 1, and that is the point: the purchased module already
    contains the grade-1 pre-engineering, which is exactly why these blueprints' own
    recipes start at grade 2 (see the Operations section above). The two facts are
    consistent by construction and a test asserts it —
    `getBlueprintCost(bp, target, 1)` prices taking a bought variant the rest of the way.
    - **The large Seeker Missile Rack's Lockdown** is a `mercenary` row on
      `Hpt_BasicMissileRack_Fixed_Large` at **900 MC**, taking the shop total to 13 900 MC.
      Four things agree, none of them a guess about a module symbol: the registry keys
      Lockdown by _size_ and the twin `SeekerMissileRackMedium_Lockdown` binds to the medium
      rack; the large rack is already a Merc row for `SeekerMissileRack_Drag`, so the shop
      stocks it; both Lockdown recipes run grades 2–5, the weapon-reward range that marks a
      module as bought pre-engineered; and it is the only grade-2–5 Operations recipe in the
      file
      that would otherwise have no row, all 20 others having one. Price and size confirmed
      2026-08-07 UTC against a web-search index of the Inara outfitting listing, which
      reports the MERC Lockdown Seeker Missile Rack [Fixed] at 900 MC for the 3A and 800 MC
      for the 2B; `inara.cz` is refused by the acquisition environment's network policy, so
      that is a read of an index of the page rather than a capture of it. Both halves check
      against rows already here — the large rack is 3A and its other Merc row is 900 MC, the
      medium is 2B and its Lockdown row is 800 MC — and that corroboration is what carries
      the weight.
  - **`communityGoal`** — modules awarded for taking part in a community goal. Source:
    [EDSY](https://github.com/taleden/EDSY)'s stored-module presets, which record each
    reward as an encoded module state; the blueprint, grade and experimental effect were
    decoded from that state rather than inferred from its display label, and every
    resulting id is asserted to join to `blueprints.jsonc`,
    `experimental-effects.jsonc` and the module catalogues. 28 of the 30 are grade 5;
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
- **`engineeringLocked: true` marks all seven pre-engineered Guardian-weapon rows as
  final.** Their stock Gauss, Plasma and Shard counterparts offer Anti-Guardian Zone
  Resistance and nothing else; the bought or awarded articles accept no further
  blueprint or experimental effect, including that resistance. Source: the repository
  maintainer's in-game verification on 2026-08-09 UTC; there is no immutable upstream
  revision because neither engineering registry publishes the final-article restriction.
  `getPreEngineeredStats` carries the flag onto the resolved module so fitting one keeps
  the restriction.
- **A reward variant is not reproducible by engineering the same blueprint.** Alongside
  its blueprint and effect, each reward carries hand-set modifier overrides no blueprint
  grants — that is what makes it a reward rather than a shortcut. The `blueprint` /
  `grade` / `experimental` recorded here **identify** the variant; they are not a recipe
  that recreates it. `getBlueprintCost` on a reward row prices ordinary engineering, not
  the reward.
- **Two community-goal rewards are not stored:** the size-5 and size-6 Corrosion
  Resistant Cargo Racks carry no engineering at all. They already exist as ordinary
  module records (`Int_CorrosionProofCargoRack_Size{5,6}_Class1`), so there is no pairing
  to record.
- **The identity of a variant is the `(symbol, blueprint, grade, experimental)`
  quadruple.** No narrower key holds: one module carries several variants, one blueprint
  appears on several modules, `(symbol, blueprint)` repeats when only the effect differs
  (the medium Seeker Missile Rack has three High Capacity rewards), and even
  `(symbol, blueprint, experimental)` repeats when only the grade differs — the medium
  Guardian Shard Cannon carries Long Range with no experimental twice, at grade 5 as a
  community-goal reward and at grade 1 from the Salvation broker.
- **`mercCoinCost` is the shop price in Merc Coin**, on the 22 `mercenary` rows and
  nowhere else. Source: the in-game outfitting registry, with the variants and prices
  corroborated by the current [Inara outfitting registry](https://inara.cz/elite/outfitting/).
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
    `0.699988`). A test caps the decimal places so the step cannot silently regress.
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
    over 11 modules in all, each pinned by a test to resolve to exactly its stored value.
    Worth stating plainly, because the blueprint name invites the opposite reading: the
    Shard's `MaximumRange` ×1.7647 with `FalloffRange` ×0.88235 is **not** a Long Range
    roll of any grade. It is a bespoke stat block, as every reward variant's is.
    - **The guard that matters:** an `overwrite` is absolute, so it is only applied where
      _this repo's_ base agrees with the one the stat was inverted against. One candidate
      failed that check and was left as a multiplier — the medium Guardian Gauss Cannon's
      damage, where EDSY's stock figure is 70 and coriolis's (and therefore this
      catalogue's) is 38.5. Converting it would have silently imported EDSY's stock value
      under cover of a rounding fix. The two sources differ on the gauss cannons' stock
      damage by a constant factor (40 vs 22 small, 70 vs 38.5 medium); which is right is
      an open question about the _module_ catalogue, recorded here and not settled.
  - **Burst interval has to be added to the decoder's output by hand.** EDSY carries no
    journal Label for `bstint` — the journal reports the resulting `RateOfFire`, never the
    interval it comes from — so a straight decode drops it, leaving the 13 variants that
    change a burst pattern on the _stock_ cadence, and four of them (the two frag cannons
    and the two Guardian gauss cannons) inconsistent as well as slow, carrying the
    engineered `BurstSize` — and, on the gauss cannons, the engineered `BurstRateOfFire` —
    against a stock interval. All 13 are stored under **`BurstInterval`**, the same label
    the Rapid Fire and High Capacity blueprint features use (see the Engineering section
    above), and it is the file's one departure from what the decoder emits: re-running the
    decoder over the same EDSY revision reproduces every other byte. Nothing downstream
    would catch the omission on its own — a stock cadence is a plausible number — so
    `fixtures/ships/pre-engineered.json` pins all 13 intervals and the rate each derives,
    under `burstIntervalVariants`.
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
    per cycle, which coriolis's does not. This is a divergence between the two sources,
    not one introduced by restoring the interval — they already disagreed on that
    variant's damage, clip size and ammunition.
  - **Resolution.** The module catalogues carry the weapon and scanner base stats needed
    by every reward variant. `getPreEngineeredStats` applies the supported modifiers and
    `unresolvedModifiers` reports any field the catalogue cannot model rather than
    dropping it silently. Every current reward variant changes at least one carried stat;
    the fixture pins the empty fully-unresolved set. As an external check, the 5A "FSD V1"
    resolves to 1785 optimal mass from the stock drive's 1050.
- **Not included:** engineered modules that are one-off mission or salvage rewards rather
  than a repeatable outfitting row. Those arrive in a build as their base symbol plus an
  `Engineering.Modifiers` block, which `ShipLoadout` already applies directly; there is no
  stable catalogue row to point at.

## Build-metric algorithms (power, shields, armour, weapons)

- **Files:** `typescript/src/ships/power.ts`, `shields.ts`, `armour.ts`,
  `resistances.ts`, `weapons.ts`, `ammunition.ts` and the `ShipLoadout` methods that feed
  them, validated by `fixtures/ships/build-metrics.json`.
- **Source of the formulas:** [EDCD/Coriolis](https://github.com/EDCD/coriolis)
  (**commit `68c042ca6e3db62372cbbb2077cf972345511712`**, acquired 2026-08-01 UTC) —
  `src/app/shipyard/Calculations.js` (`shieldStrength`, `shieldMetrics`,
  `armourMetrics`, `diminishingReturnsShields`, `diminishingReturnsArmour`,
  `mapIntoDiminishingRange`, `sysResistance`), `Ship.js` (`updatePowerUsed`,
  `powerUsageType`, `getSlotStatus`) and `Module.js` (`getDps`, `getSustainedFactor`,
  `getEps`, `getHps`). Coriolis's application code is MIT-licensed; the **mathematical
  formulas are ported as fact** (our own implementation, not copied code), attributed to
  the Coriolis contributors and to the Frontier forum research the code itself cites.
- **Cross-checked against [EDSY](https://github.com/taleden/EDSY)** (taleden, CC BY-NC
  4.0), `edsy.js`: `getMassCurveMultiplier`, `getEffectiveDamageResistance`,
  `getEffectiveShieldBoostMultiplier`, `getPipDamageResistance` and the `fpc`/`spc`/`rof`
  derivations. Coriolis's and EDSY's resistance models are algebraically identical
  (both are the community "half credit past 30%" rule); where the two differ, EDSY's
  reading of real journal data was taken:
  - a shield generator will not engage at all around a hull heavier than its maximum
    mass (EDSY `edsy.js` line ~2828), so the mass curve reports `0` past it;
  - a shield generator's minimum and maximum mass follow its **optimal** mass under
    engineering, and its minimum and maximum strength follow its optimal strength
    (EDSY `getRelatedAttrModifier`), because blueprint recipes only name the optimum.
- **Journal units and the `modmod` stats:** a journal reports hull boost, shield boost
  and the four resistances as _percentages of a multiplier_, and they compound on that
  multiplier rather than on the stat: a `+80%` bulkhead engineered by a `+32%` blueprint
  reads `137.6%` (`1.8 × 1.32 − 1`), and a `−20%` kinetic resistance with `+5%` reads
  `−14%` (`1.2 × 0.95` in damage-multiplier space). This is Frontier's `modmod`
  convention as EDSY documents it (`eddb.js` attribute table, `modmod: 100` / `-100`);
  it is verified against the shared `slef-the-deep-black.json` fixture, whose engineered
  armour carries exactly those values. `typescript/src/ships/module-stat-labels.ts`
  holds the per-label unit and algebra table.
- **Ammunition capacity is `clipSize` + `ammoMaximum`.** The reserve excludes the
  magazine, exactly as a journal's `AmmoInHopper` excludes `AmmoInClip`. The thirteen
  journal captures carry **60** non-zero readings across twenty-four distinct modules.
  They are not
  the only external check either stat gets — the `AmmoClipSize` and `AmmoMaximum`
  modifiers a capture states on an engineered module are a second and stronger one, and
  in-game verification does not reach a *hardpoint's* reserve ammo. All sixty sit
  exactly at capacity — among them the Python Mk II's Enhanced AX Multi-Cannon 100/2100
  and Guardian Shard Cannon 5/180, the Viper's two gimballed multi-cannons 90/2100, the
  Krait's two flak launchers 1/32 and two point-defence turrets 12/10000, and the
  Corvette's large gimballed cannon 5/100 under a grade-5 Overcharged. That every
  reading sits at capacity is not what licenses reading one back: a reading is a **lower
  bound** on a capacity and never a reading of one, so a rearm state cannot be read back
  as a catalogue figure. What does state a capacity is the `AmmoMaximum` **modifier** on
  an engineered module, which gives base and result together — the Lynx Highliner's
  heat-sink launcher reads 1/3 under a grade-1 Heat Sink Capacity against a base reserve
  of 2, so its reading alone would have been the engineered figure. On the Corsair the
  capacity a reading is checked against is the **engineered** one, since three of its
  five ammunition-bearing weapons state an `AmmoClipSize` or `AmmoMaximum` modifier.
  Pinned by `fixtures/ships/build-metrics.json` §ammunition.journalReadings. A module
  carrying a magazine but no reserve figure — the two Abrasion Blasters, and nothing
  else — is reported as unlimited; one carrying neither (the lasers) has no capacity to
  report. A reserve of **zero** is a third answer and not an unlimited one: the Mk II
  Plasma Shock Accelerator has nothing behind its magazine, and Plasma Slug empties a
  rail gun's reserve because the weapon then reloads from ship fuel, which is a tank
  this does not model.
- **Engineered ammunition is reported in whole rounds: a clip rounds up to a whole burst,
  and a reserve rounds to the nearest round.** Both stats are multiplicative under
  engineering, so a roll that is not a whole multiple leaves a fraction, and a ship cannot
  load a tenth of a round. Only a computed clip is rounded: a stock one is left alone,
  which matters because the Mk II Plasma Shock
  Accelerator's 18 rounds are **not** a whole number of its 4-round bursts, so the rule is
  the registries' treatment of a roll rather than a claim about how magazines are built.
  EDSY rounds the clip up to a multiple of the burst size —
  `ceil(ammoclip / bstsize) * bstsize`, with the
  comment "when modifying clip size, round up to a multiple of burst size" — and Coriolis
  rounds it up without the burst step (`Module.getClip`, "Clip size is always rounded up"),
  so the two agree wherever a weapon fires one round at a time and EDSY is taken where they
  differ, as everywhere else in this section. Neither rounds the reserve anywhere: EDSY's
  own rearm-cost and ammo-time maths multiplies the fractional `ammomax` as it stands, and
  Coriolis returns the same kind of product. Frontier's own values settle the library's
  rule instead. A grade-1 Heat Sink Capacity roll computes 2 × 1.49 = 2.98 and the journal
  states **3**; the Corsair's intermediate High Capacity roll computes 87.499008 and the
  journal states **87**. Nearest-integer rounding reproduces both, so it runs after the
  blueprint and experimental contributions have all compounded.

  Seven captures state an engineered clip or reserve, twenty-one readings between them,
  and twenty agree exactly under those rules and the two manual quality corrections
  recorded below. One of them is a fragment cannon's Corrosive Shell reserve at quality
  0.826, where the ammunition leg is the experimental's flat −20% rather than a
  quality-rolled one. The twenty-first is the Corsair's dumbfire rack, a **legacy
  engineering** roll from the system in which attributes advanced independently. Its one
  reported `Quality` cannot reconstruct both per-leg values through the current
  shared-quality model: Frontier states a clip of 23 where that model rounds up to 22. This
  is not evidence for changing the current recipe band. The exception remains pinned in
  `fixtures/ships/build-metrics.json` §ammunition.engineeredGroundTruth. The rounding is
  applied in `computeModifiers` (`engineering.ts`), which is every place this library
  computes an engineered stat — a blueprint roll and a pre-engineered variant's published
  article alike — and nowhere else. **Three things it computes nothing for are left
  alone**: a journal's own `Engineering.Modifiers`, which are never recomputed, so a clip
  the game states passes through untouched; a recipe leg that _overwrites_ the clip, which
  is a registry's published figure rather than a product of one (the two Guardian Plasma
  Launchers' 20 rounds); and a roll that leaves the clip where it was, so the Mk II Plasma
  Shock Accelerator's 18 rounds survive a zero-magnitude roll — reachable only by calling
  `computeModifiers` directly, since no engineering menu offers that weapon anything for
  `applyBlueprint` to accept. EDSY draws the same line, rounding inside the branch that
  stores a roll and never on a restored or built-in module. Pinned by
  `fixtures/ships/engineering.json`
  §clipRounding and, for the published article, `fixtures/ships/pre-engineered.json`
  §resolved.fragmentCannonDoubleShot.
- **A published multiplier is snapped to the precision it is stated at before a clip's
  directional round-up.** Both registries state a recipe's multiplier to
  three or four decimals, so a leg meant to add two thirds is written `0.667`: Drag
  Munitions computes 10.002 rounds on a 6-round Seeker Missile Rack, and the community-goal
  Fragment Cannon's authored `1.6667` computes 8.0001 against two-round bursts. Left alone,
  that thousandth becomes a whole extra round once the clip is rounded up — a whole extra
  burst on a burst weapon. A clip within **half a unit in the multiplier's third decimal,
  scaled by the base clip**, is therefore taken as the whole number it means: 0.003 rounds
  on a 6-round clip, against the 0.02 that Double Shot's 4.02 genuinely adds, and clips are
  small enough (100 rounds at the widest) that the band stays a fraction of a round. A
  reserve needs no separate snap because its ordinary nearest-round step absorbs the same
  transcription noise. Snapping applies to a **stated** multiplier only: a quality roll
  between two published legs is a real number with no whole magazine behind it, so a small
  multi-cannon at High Capacity
  grade 5 and quality 0.07 holds 185.12 rounds, which means 186 and rounds up.

- **`sustainedFireFactor` rounds a clip up to a whole round, not to a whole burst**
  (`weapons.ts`), matching Coriolis's own `getClip`, which is what its `getSustainedFactor`
  reads. Nothing this library computes reaches it fractional, so the two rules can only
  part on a clip a journal states as a fraction on a burst weapon — no capture here carries
  one. Left as it is rather than aligned, because a reload cycle is Coriolis's algorithm end
  to end and taking half of EDSY's rule into it would agree with neither.

## Jump-range and fuel algorithm

- **Files:** `typescript/src/ships/jump-range.ts` and `ship-loadout.ts`, validated
  by `fixtures/ships/jump-range.json` and `fixtures/ships/slef-the-deep-black.json`.
- **Source of the formula:** the community-standard hyperspace model as implemented
  by [EDSY](https://github.com/taleden/EDSY) (taleden), itself derived from
  Frontier's "mass effect on hyperspace range" description. EDSY's code is licensed
  CC BY-NC 4.0; the **mathematical formula is ported as fact** (our own
  implementation, not copied code), attributed to taleden and to Frontier's forum
  post. The port is validated to reproduce EDSY's own exported `MaxJumpRange`
  (89.414678 LY) for the sample "Deep Black" build.
- **SLEF:** the sample loadout is a real EDSY export; the parser follows the
  [Inara SLEF specification](https://inara.cz/elite/inara-impexp-slef/) (a journal
  `Loadout` event wrapped in a `{ header, data }` envelope). The **writer**
  (`toSlef` / `stringifySlef`, and `ShipLoadout.toLoadoutEvent`) follows the same
  specification, and every entry it emits is checked with the parser's own guards so
  output always parses back.

## Ground-truth builds

Real builds whose figures came from the game or its tools rather than from this
library, so the maths is checked against something external. Each is stored verbatim as
its own fixture, with the expected outputs in a sibling fixture that names it by path —
where the build is used for metrics. Several pin no metric and are evidence about
something else. The Corvette is evidence about a _recipe_, and what is checked against it
is which legs a blueprint folds; the Inara exports are evidence for the outfitting
_rules_, and what is checked against them is which module the game put in which mount and
under which slot spelling; the Cutter is evidence about _prices_, and what is checked
against it is that a build fitting an unpriceable module exports no module total and no
rebuy.

**What may be taken, and from where.** A capture is Frontier game output — which parts a
player put in which slots — and it is redistributed here under Frontier's media-usage
terms, like every other value in this repository. It is _not_ the work of the project it
was found in, so that project's own licence is not the test of whether a build can be
carried: a repository that states no licence, or one whose terms forbid redistributing
its code, still holds a game capture that those terms do not reach. `../../AGENTS.md`
states the rule; what it asks in return is the part that binds. Credit the source when
there is one to credit — the entries below name project, file, revision and checksum —
and scrub the person before storing anything. A build with no traceable origin is
acceptable rather than excluded; the 181-build corpus below is exactly that case, and
what it costs is written down there. The exception covers builds only: the stat tables
and catalogues everything else here derives from are held to the licence they ship
under, which is why several are cited above rather than copied.

- **`fixtures/ships/slef-the-deep-black.json`** — a real EDSY export of an exploration
  Caspian Explorer. Its acquisition date and immutable source revision are not recorded;
  see the jump-range note above. Zero weapons, so it
  exercises jump range, fuel and power but not the combat metrics.
- **`fixtures/ships/journal-krait-phantom.json`** — a real Frontier journal `Loadout`
  event for an engineered combat Krait Phantom (40 `Modules` entries, 6 hardpoints and
  utilities). Acquired **2026-08-02 UTC** from
  [adam-drewery/EliteAssist](https://github.com/adam-drewery/EliteAssist),
  `src/example_data/loadout.json` (repository licence **WTFPL**; the loadout itself is
  Frontier game output, redistributed under Frontier's media-usage terms). Source file
  SHA-256 `509db62ac63fe1a07eb41d1840435f1e775fbb687e03629aa8856adefae64312`;
  stored unmodified apart from unwrapping the single-element array and re-indenting.
  Its `UnladenMass`, `CargoCapacity` and `MaxJumpRange` are **Frontier's own figures** —
  the strongest ground truth available, since no third-party calculator sits in between.
  Its credit figures are a purchase record rather than ground truth: they are pinned as
  evidence of how far a build can sit from list price, and as the source purchase record
  itself. Pinned by `fixtures/ships/slef-export.json`,
  `fixtures/ships/source-purchase.json` and `fixtures/ships/jump-range.json`.

- **`fixtures/ships/journal-viper-mkiv.json`** — a real Frontier journal `Loadout` event
  for a **wholly unengineered** Viper Mk IV (27 `Modules` entries: four gimballed
  weapons, a heat sink, a shield booster, an SRV bay and an FSD interdictor, no cargo).
  Acquired **2026-08-06 UTC** from
  [UFO-Studios/EDDP](https://github.com/UFO-Studios/EDDP), `exampleLogs.json` at
  `8904e5b0343c3521d2fa3f521f4490f4c1e7c8e4` — a captured journal log the project ships
  as example data. That repository's own licence (UFO Licence 1.0, which GitHub reports
  as `NOASSERTION`) forbids redistributing **the project**; it does not reach a Frontier
  journal line inside it, which is the exception stated at the head of this section and
  the whole reason this build can be carried. Source log SHA-256 `15d9d79b7546968637bdaa4fb266b4847a1c23cc0203e7ad0285f5e5878e9304`; the
  stored fixture is the log's **last** `Loadout` event, unwrapped from the line-delimited
  log and re-indented, otherwise byte-for-byte. Its `ShipName`, `ShipIdent`, `ShipID` and
  `timestamp` are kept, as the Krait Phantom capture's are — they describe a ship. Nothing
  else from the log was taken: the surrounding events carry a commander.

  **Nothing on this build is modified.** The Krait Phantom agrees with the game only once
  an engineered Long Range drive and a Guardian booster are folded in, so it proves the
  _engineered_ path; here `UnladenMass` 260.799988 (ours 260.8) and `MaxJumpRange`
  21.951651 (ours 21.951648, both within 1e-4) are Frontier reading back the base module
  masses and the base FSD's `optMass` 525 / `maxFuel` 3 / `fuelMul` 0.012 /
  `fuelPower` 2.3 — the stats every other figure in this repository is built on. `CargoCapacity` 0 is exact, and with no rack
  fitted its laden and unladen jump are the same number.

  **Its credits read the price table wider than any other source.** All 20 priced modules
  sit at a flat **0.85** of catalogue list, each within a credit after the game's own
  rounding — 20 independent prices confirmed at once, across hardpoints, core internals
  and optionals. The hull is the counter-case that keeps the retail rule in place: the
  Krait's `HullValue` was its hull _with_ stock fittings to the credit, while this one is
  246 650, **below** even the bare `hullCost` 312 797 and 0.85 of neither convention. Its
  own `Rebuy` 260 198 is not 5% of its own `HullValue` plus `ModulesValue` either (that
  truncates to 260 196). So a journal's credits are a purchase record however uniform they
  look. Pinned by `fixtures/ships/slef-export.json` (`viperMkIV`),
  `fixtures/ships/source-purchase.json` and `fixtures/ships/jump-range.json`.

  **What it does not close:** shields, armour and weapon DPS. It carries four weapons and
  a shield generator, and states no figure for any of them: a `Loadout` states a stat only
  as the `OriginalValue` beside an engineered one, and nothing on this build is
  engineered — see
  <https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/12>.

- **`fixtures/ships/journal-python-mkii-antixeno.json`** — a real Frontier journal
  `Loadout` event for a **wholly unengineered** anti-xeno Python MkII (22 `Modules`
  entries: four large and two medium anti-xeno and Guardian hardpoints, no utilities, an
  8t cargo rack). Contributed **2026-08-08 UTC** by the repository owner. No upstream
  project or export tool is recorded for it — the same position as the 181 origin-less
  builds in `fixtures/ships/builds/`, and not a reason to leave it out; the loadout is
  Frontier game output redistributed under Frontier's media-usage terms. Stored SHA-256
  `92e01bb62f1aede9c2cd28f5a789a8db1509f3a87c667077aa8402dcbab43b9c`; held byte-for-byte
  as received apart from re-indenting. Its `ShipName` (empty), `ShipIdent`, `ShipID` and
  `timestamp` are kept, as the other captures' are — they describe a ship, and nothing
  in the event names a person.

  **It is the second ground truth for the catalogue's own numbers, on a hull and a drive
  the Viper Mk IV does not reach.** Nothing here is engineered either, so `UnladenMass`
  699 (ours 699, exact) and `MaxJumpRange` 17.495169 (ours 17.495170, within 1e-4) are
  Frontier reading back the base module masses and a **size-5 class-3 SCO** drive's
  `optMass` 1050 / `maxFuel` 5 / `fuelMul` 0.012 / `fuelPower` 2.45 — a drive class the
  Viper's size-4 capture does not exercise, on a 699t hull rather than a 261t one.
  `CargoCapacity` 8 is exact, and unlike the Viper this build carries a rack, so its laden
  jump is the shorter one.

  **It reads the anti-xeno weapons' ammunition, which no other source here does.** The
  game reports `AmmoInClip` and `AmmoInHopper` for what is loaded, so the Enhanced AX
  Multi-Cannon's 100/2100 and the Guardian Shard Cannon's 5/180 confirm `clipSize` and
  `ammoMaximum` on two records directly. The other four weapons report zero on both
  counts, which is this ship's rearm state and not a statement about the catalogue, so
  they are not pinned. Four of its six weapons sit in families this catalogue gives no
  engineering menu — the Enhanced AX pair among the eight AX multi-cannons upstream denies
  every blueprint, plus the Guardian Nanite Torpedo Pylon and the Remote Release Flak
  Launcher — so it also demonstrates that a build made largely of unengineerable modules
  computes end to end.

  **Its credits are a second reading of the 12.25% discount.** All 18 priced modules sit
  at **0.8775** of catalogue list, each within a credit after the game's own rounding —
  the same fraction as the Deep Black EDSY export and is independently present in a
  Frontier journal, a third discount overall beside
  the Viper's flat 0.85. The residual credit splits cleanly and is left unmodelled: the 12
  internals land exactly on the floor of the ratio, the six hardpoints one credit above
  it. The hull behaves as the Viper's does rather than the Krait's — `HullValue`
  56 801 651 is **below** even the bare `hullCost` 64 743 724 and is 0.8775 of neither
  convention — and its own `Rebuy` 3 268 938 is not 5% of its own figures either (that
  truncates to 3 268 937). So a journal's credits remain a purchase record. Pinned by
  `fixtures/ships/slef-export.json` (`pythonMkII`) and `fixtures/ships/jump-range.json`.

  **What it does not close:** shields, armour and weapon DPS, exactly as the Viper Mk IV
  does not — it carries six weapons and a shield generator, and being unengineered it
  states no `OriginalValue` for any of them. See
  <https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/12>.

  **Its ammunition state is deliberately not carried.** `LoadoutModule` models neither
  `AmmoInClip` nor `AmmoInHopper`, so importing this capture drops both and a re-export
  never writes them: they say how much was left in the magazine at the instant of capture,
  which is the ship's rearm state and not part of the build — the same footing as a
  capture's own credit figures, which a re-export recomputes by default rather than
  echoes. What a
  fitted weapon _can_ hold is a property of the build, and `ammunitionCapacity` in
  `ships/ammunition` reports it from `clipSize` and `ammoMaximum`, post-engineering. The fixture therefore reads the two
  counts off the stored capture, and checks them against the capacity a parsed build
  reports for the same weapons — which agree here because both are fully rearmed.

- **`fixtures/ships/journal-corsair.json`** — a real Frontier journal `Loadout` event for a
  heavily **engineered** Corsair (36 `Modules` entries: six hardpoints, three shield
  boosters, an engineered overcharge drive, 144 t of cargo). Contributed **2026-08-08 UTC**
  by the repository owner. No upstream project is recorded for it — the same position as
  the Python Mk II and Corvette captures, and not a reason to leave it out; the loadout is
  Frontier game output redistributed under Frontier's media-usage terms. Stored SHA-256
  `b26450197e4521144a2c6450c0e28e283c424e806d42b335e147852933381c4b`. Its `ShipName`,
  `ShipIdent`, `ShipID` and `timestamp` are kept, as the other captures' are — they
  describe a ship, and nothing in the event names a person; the engineer names are the
  game's own NPCs.

  **One manual correction.** The capture reached this repository as pasted text, and the
  transport had broken `int_powerplant_size7_class5` across a line inside the string. That
  break is repaired and nothing else is altered, so the checksum above attests to the
  stored file rather than to a file Frontier wrote. A capture that arrives as a file should
  be preferred to this one if the two ever conflict.

  **It recomputes to Frontier's own aggregates.** With its
  own aggregates stripped, this build recomputes to `UnladenMass` 641.9 (journal 641.900024)
  and `MaxJumpRange` 41.191542 (journal 41.191536, within 1e-4) — through a size-5 class-4
  **overcharge** drive under `FSD_LongRange` grade 5 with Mass Manager, three shield
  boosters at 14 t each, a 48 t armoured power plant and a 0.6 t lightweight life support.
  `CargoCapacity` 144 is exact.

  **It states the only engineered clip this library cannot reproduce.** Sixteen of the
  seventeen clips a capture states agree exactly. Three of its five ammunition-bearing
  weapons carry an `AmmoClipSize` or `AmmoMaximum` modifier — the two gimballed medium
  multi-cannons and the medium dumbfire rack, all three under High Capacity, where the
  two plasma accelerators take Long Range and it charges neither — and every weapon is
  fully rearmed:

  - **At full quality this capture's figures agree exactly.** High Capacity grade 5 doubles a
    gimballed medium multi-cannon's 90/2100 to 180/4200, and with Corrosive Shell the
    reserve is 3360 — 2100 × 2 × 0.8, which five captures state and all five agree on.
  - **The dumbfire rack is a legacy-engineering roll.** Under that older system its
    attributes advanced independently, so the single `Quality` 0.8931 cannot be used as one
    shared interpolation for both ammunition legs. Frontier states 12 → **23** and 48 →
    **87**; the current model produces 22 and a reserve that rounds to 87. FSD Interrupt
    cannot account for the split — it carries `Damage` and `BurstInterval` legs only — and
    the legacy provenance is why the current recipe band is not changed to fit it.
  - **Importing is unaffected**, which is the point of rounding only where a roll is
    computed: the stated modifiers are used verbatim, so this build reads back 23/87.

  Pinned by `fixtures/ships/build-metrics.json` §ammunition.engineeredGroundTruth, including
  the legacy exception, so a change to the model has to face it.

- **`fixtures/ships/journal-federation-corvette.json`** — a real Frontier journal `Loadout`
  event for a heavily **engineered** combat Federal Corvette (45 `Modules` entries: two huge
  beam lasers, a large cannon, a missile rack, eight shield boosters, four hull
  reinforcements). Contributed **2026-08-08 UTC** by the repository owner, the same position
  as the Corsair above: no upstream project, and the loadout is Frontier game output
  redistributed under Frontier's media-usage terms. Stored SHA-256
  `084e63b2dad5c59861ca32cc8925accf263d7b56816494a974a30b0d0815a731`. Its `ShipName`,
  `ShipIdent`, `ShipID` and `timestamp` are kept for the reason the other captures' are, and
  the engineer names are the game's own NPCs. The capture reached this repository as pasted
  text and is stored re-indented and otherwise unaltered, so the checksum attests to the
  stored file rather than to a file Frontier wrote.

  **It is the reading that settles the Overcharged clip question** — its large gimballed
  cannon carries `Weapon_Overcharged` at grade 5, quality 1, with no `AmmoClipSize` modifier
  and a full magazine of 5. See §Multi-cannon Overcharged under Engineering options for what
  that decides.

  **Its base values agree with in-game verification.** The exact values pinned in the
  catalogue are `Hpt_Cannon_Gimbal_Large` `damage` 37.421001 and `thermalLoad` 2.93,
  `Hpt_BeamLaser_Gimbal_Huge` `thermalLoad` 10.62, and
  `Int_ShieldGenerator_Size7_Class5_Strong` `shieldBrokenRegenRate` 4.25.
  The capture states 71 distinct (module, journal `Label`) base values, 68 of which name a
  field this catalogue holds; 60 agree to the stored decimal and eight more agree within
  the game's own float noise (`20.000004` for 20, `-39.999996` for −40).

- **Five further `Loadout` captures**, contributed **2026-08-08 UTC** by the repository
  owner from their own fleet, in the same licence position as the Corvette above: no
  upstream project, Frontier game output redistributed under Frontier's media-usage
  terms. Each reached this repository as pasted text and is stored re-indented and
  otherwise unaltered, so the checksum attests to the stored file rather than to a file
  Frontier wrote, exactly as the other captures' do. Each keeps its `ShipName`,
  `ShipIdent`, `ShipID` and `timestamp` for the reason the other captures' are kept, and
  the engineer names are the game's own NPCs.

  | File | Build | Stored SHA-256 |
  | --- | --- | --- |
  | `journal-federation-corvette-beams.json` | a beam-heavy Federal Corvette (54 `Modules`): two huge, one large and two medium gimballed beam lasers under Efficient and Long Range, two small multi-cannons, eight shield boosters, four shield cell banks | `793ba6c0c34a946b537c6c2612d08df28ae9b21d9538b3d3df3ea530d1ba0c80` |
  | `journal-federation-corvette-multirole.json` | a Federal Corvette carrying a fuel scoop, fighter bay and FSD interdictor alongside its beam lasers and a drunk missile rack (54 `Modules`) | `1ee184d1a16467371d04297a9584c91882f08c7cdbf1173a2867e201dacb90b3` |
  | `journal-cobra-mkv.json` | a Cobra Mk V gunship (39 `Modules`): two medium and one small gimballed beam laser, two multi-cannons and a Bi-Weave generator | `8b0a632ad05eb312dee94161aa7205ca4f2ee7dfea0c297d6614051977d95bbe` |
  | `journal-kestrel-mkii.json` | a Kestrel Mk II (29 `Modules`) with three Mk II Plasma Shock Autocannons, two Cytoscrambler burst lasers and the Mk II agile-boost thrusters | `da2cb25e82e1c6a9408b5db3dd4d0faf192d64dcf9c2ab1e6bdbad8efd129451` |
  | `journal-lynx-highliner.json` | a Lynx Highliner rescue fit (36 `Modules`): five gimballed multi-cannons, a heat-sink launcher, Mk II passenger cabins | `6bc9e3a43834336686bfb5115c69222c258b7b6b3bd67f9c53cfd420fbdfce67` |

  **Two journal quality fields are manually corrected when the captures are used to test a
  simulated roll.** The repository owner confirms that every blueprint on the Cobra Mk V
  and the multirole Federal Corvette is fully engineered. The Cobra's `MediumHardpoint3`
  nevertheless reports `Quality` 0.9844, and the Corvette's `SmallHardpoint2` reports
  0.9438; both are treated as quality **1**. The captures stay verbatim and keep their
  checksums. `fixtures/ships/build-metrics.json` records the journal number as
  `reportedQuality` beside the corrected `quality`, and the ammunition test asserts both
  sides so the correction cannot silently become a fixture rewrite.

  Between them they state 363 further base values. Two hulls are the reason to keep them
  individually rather than as two more Corvettes: the **Kestrel Mk II** is the only reading
  of the Cytoscrambler Burst Laser and of `Int_MkIIAgileBoost_Engine_Size5_Class5`, and the
  **Lynx Highliner** — a hull coriolis-data does not carry at all — is the only reading of a
  heat-sink launcher's *base* reserve and directly states the hull's size-1
  `PlanetaryApproachSuite` mount by fitting its advanced suite there. A
  capture reads only the modules a player engineered: the Kestrel's three Mk II Plasma
  Shock Autocannons and the Lynx's Mk II passenger cabins are fitted stock, so they
  state no base value and are not evidence about those records.

  **Each rebuilds to the `UnladenMass` and `MaxJumpRange` it states**, which is what says
  the stored text is faithful: both figures are dropped and recomputed from the modules
  alone, so every module mass, every engineered mass modifier and the drive's whole fuel
  curve have to be right for them to land. The residue is the game's own float32
  arithmetic — at worst 9.8 × 10⁻⁵ t and 6.3 × 10⁻⁶ ly across all thirteen journal
  captures, not these five alone. Pinned by `fixtures/ships/module-stats.json`
  `capturedBaseStats.rebuilds`.

  A hull's cargo hatch id varies by family — the Lynx fits `ModularCargoBayDoorFDL` where
  most hulls fit `ModularCargoBayDoor` — and only the latter has a catalogue record. The
  hatch is built into every hull, cannot be bought and weighs nothing, so `#moduleMass`
  reads the whole `modularcargobaydoor*` family as massless in the cargo-hatch slot;
  without that a capture of such a hull has an unknown mass and no jump range at all. The
  built-in hatch remains deliberately uncatalogued.

- **`fixtures/ships/journal-federation-corvette-mixed.json`** — a real Frontier journal
  `Loadout` event for a mixed-weapon Federal Corvette (48 `Modules`: two huge plasma
  accelerators, one large burst laser, three small and one medium rail gun, eight shield
  boosters and four hull reinforcements). Contributed **2026-08-09 UTC** by the repository
  owner from their own fleet, with no upstream project; the loadout is Frontier game output
  redistributed under Frontier's media-usage terms. It reached this repository as pasted
  text and is stored re-indented and otherwise unaltered. Stored SHA-256
  `55dad081b44f214a95a6483b08ca3c9b0ddb8632b2ec815f906a5ff516603fe0`.
  Its `ShipName`, `ShipIdent`, `ShipID` and `timestamp` are kept for the same reason as the
  other captures', and the engineer names are the game's own NPCs.

  **It settles how charge time relates to rate of fire.** Frontier states the small rail
  gun's unmodified `RateOfFire` as 1.587302 and the medium's as 1.204819, exactly the
  reciprocals of their 0.63 s and 0.83 s burst intervals. Their 1.2 s `chargeTime` is
  therefore a delay before impact, not part of the displayed firing cadence. The catalogue
  stores those two captured rates and derives the Imperial Hammer's corrected 4.090909 from
  its three-round burst (`3 / (2 / 6 + 0.4)`) under the same family rule. These three values
  are manual corrections to the Coriolis/EDSY derivation, which includes charge time.
  The capture's base `DamagePerSecond` values independently close the fold: 23.34 ×
  1.587302 = 37.047619 for the small rail gun and 41.53 × 1.204819 = 50.036144 for the
  medium. Its 88 distinct base values, 84 mapped catalogue readings and full mass/jump-range
  rebuild are pinned in `fixtures/ships/module-stats.json`.

- **`fixtures/ships/journal-federation-corvette-plasma.json`** — the same Federal Corvette
  (`ShipID` 44) as the rail-gun refit above, in an earlier fit: two huge plasma
  accelerators, a large gimballed burst laser, a Rocket Propelled FSD Disruptor, a medium
  fragment cannon, a Cytoscrambler burst laser, a small rail gun, eight shield boosters and
  four hull reinforcements (48 `Modules`). Contributed **2026-08-09 UTC** by the repository
  owner from their own fleet, with no upstream project; the loadout is Frontier game output
  redistributed under Frontier's media-usage terms. It reached this repository as pasted
  text and is stored re-indented and otherwise unaltered, so the checksum attests to the
  stored file rather than to a file Frontier wrote. Stored SHA-256
  `810748968e0cca8b8b209f90b1927668c1b0ede492478b720d2b5f5ddd234b99`. Its `ShipName`,
  `ShipIdent`, `ShipID` and `timestamp` are kept for the same reason as the other captures',
  and the engineer names are the game's own NPCs.

  **What it is kept for is the fragment cannon** — see §Multi-cannon Overcharged under
  Engineering options for what its `Weapon_Overcharged` roll decides.
  Beside that it is the only reading of a fragment cannon's and a Rocket Propelled FSD
  Disruptor's own `DamagePerSecond`, the only reading of a gimballed burst laser's absent
  `Jitter`, and the only statement of Corrosive Shell's reserve leg on a weapon that is not
  a multi-cannon (180 → 144, the flat −20%, at an interpolated quality where a rolled leg
  would not have landed exactly).

  **Its rail gun repeats the refit's, and that is what it is worth.** `SmallHardpoint2`
  carries the same `Weapon_LightWeight` grade 5 at quality 1 with Plasma Slug, and
  states the same eight modifiers to the same digits — `Mass` 2 → 0.2, `Integrity` 40 →
  15.999999, `PowerDraw` 1.15 → 0.69, `Damage` 23.34 → 21.006001, `DistributorDraw` 2.69
  → 1.7485, `ThermalLoad` 12 → 7.2, `AmmoMaximum` 80 → 0 and `DamagePerSecond` 37.047619
  → 33.342857. Two captures of the same ship an hour and twenty minutes apart agreeing
  digit for digit is a check on the stored text rather than new evidence about the
  recipe: nothing here is read that the refit does not also state. Its 89 distinct base
  values, 83 mapped catalogue readings and full mass/jump-range rebuild are pinned in
  `fixtures/ships/module-stats.json`.

- **`fixtures/ships/journal-caspian-explorer.json`** — a real Frontier journal `Loadout`
  event for an engineered exploration Caspian Explorer (35 `Modules`: a medium fixed plasma
  accelerator, two heat-sink launchers, a size-7 fuel scoop, a Guardian FSD booster, a
  fighter bay, two Auto Field-Maintenance Units and an Operations Multi Limpet
  Controller). Contributed **2026-08-09 UTC** by the
  repository owner from their own fleet, with no upstream project; the loadout is Frontier
  game output redistributed under Frontier's media-usage terms. It reached this repository
  as pasted text and is stored re-indented and otherwise unaltered, so the checksum attests
  to the stored file rather than to a file Frontier wrote. Stored SHA-256
  `b6c738bfc0672019d340805f9a2775fd41e058633b4b3aa25fe93c354756eeae`. Its `ShipName`,
  `ShipIdent`, `ShipID` and `timestamp` are kept for the same reason as the other captures',
  and the engineer names are the game's own NPCs. The event carries no `HullValue`, which is
  stored as it arrived rather than filled in. That, with only 19 of its 35 entries priced,
  makes it the partially priced capture in `fixtures/ships/source-purchase.json`.

  **What it is kept for is the plasma accelerator** — see §Multi-cannon Overcharged under
  Engineering options for what its grade-1 `Weapon_Overcharged` roll settles. It is the
  third and last of the clip-bearing weapon groups to be read, and the only one of the
  three read with no experimental effect on the weapon, so every leg Frontier states folds
  from the recipe alone — where the cannon's `Damage` carries High Yield Shell's −35% and
  the fragment cannon's reserve is Corrosive Shell's, this capture's three recipe legs are
  reproduced from the recipe and nothing else.

  **It is also the only capture of a scoop-rate roll** — the Krait Phantom's scoop is
  engineered too, but under Shielded, which moves integrity and power draw and not the
  rate — and that is what uncovered a missing label: Frontier writes the scoop's rate
  as `FuelScoopRate` where the recipe that moves it says `RefuelRate`, so the roll
  resolved to no field and was dropped from
  `effectiveStats` in silence. Both spellings now reach `refuelRate` — see §Three journal
  spellings above. The capture settles the pairing on both legs of the recipe: `RefuelRate`
  1.245 → 1.8675 is `FuelScoop_Efficiency` grade 5's ×1.5, and `PowerDraw` 0.97 → 1.1155 is
  its ×1.15, on a catalogue base the capture also states.

  Beside those it is the only reading of a medium plasma accelerator's own
  `DamagePerSecond` (17.920792, which the library's fold reproduces). Its `Explorer_NX`
  armour block restates what `slef-the-deep-black.json` gives for the same hull under the
  same grade-5 Heavy Duty roll, and the difference between them is the point: this states
  80 as `79.999992` and −40 as `-39.999996` where the EDSY re-export has already rounded
  them, so it is Frontier's own arithmetic and the other is an app's. Its 43 distinct base
  values, 42 mapped catalogue readings and full mass/jump-range rebuild are pinned in
  `fixtures/ships/module-stats.json`.

- **`fixtures/ships/slef-inara-type-11.json`** — a real [Inara](https://inara.cz/) SLEF
  export of an engineered mining Type-11 Prospector (27 `Modules` entries), contributed
  **2026-08-04 UTC** by the repository owner from their own commander's fleet, which is
  the licence position: it is one player's build, shared by that player for this
  purpose, and like every other build here the loadout itself is Frontier game output
  redistributed under Frontier's media-usage terms. Source text SHA-256
  `3e008ea9b1226c49b6f7c080d897a4cbabbcbcc36ce83e58a293b397712279ee`.
  **Manual correction:** the header contains only `appName` and `appVersion`; its fleet
  link and account-specific custom properties are omitted. Stored-form SHA-256
  `7af8fc4c5412579e98e60908970593af4ad63db4b25fd608b728a618b2f4d4b4`.

  It is the **only external source that exercises the restricted mounts**, and it
  settles what nothing else could: Inara independently writes
  `largemininghardpoint1`, `mediummininghardpoint1`, `mediummininghardpoint2`,
  `mediumhardpoint3`, `smallmininghardpoint1`, `limpetcontroller01` and
  `fighterbay01` — this catalogue's keys character for character, once case is set
  aside. Its internals run `slot01_size6`…`slot05_size5`, then `slot06_size4`, so a
  restricted optional really does consume no `SlotNN` number, exactly as the numbering
  rule derived from EDSY says under §Ships. And its `mediumhardpoint3` carries a
  sub-surface displacement missile, confirming an _unrestricted_ mount takes mining
  tools too.

  **Its credit figures are a purchase record, not ground truth**, and diverge three
  ways: the hull sits at a 2.5% shipyard discount, the modules at about 5.2% across 23
  priced entries, and Inara **rounds** its `Rebuy` where the game truncates (5% of its
  own hull plus modules is 5 613 800.75, which it states as `5613801`). The journal
  capture above is the authority on that convention, so this catalogue keeps
  truncating; the divergence is pinned as evidence rather than followed.

  **It is one of the four Inara exports that exercise case-insensitive slot binding.**
  Inara lower-cases every slot key, as the SLEF specification's own example does, so a
  case-sensitive binding reports **no** occupied mounts on an Inara build and `setModule`
  on one adds a duplicate rather than replacing it. Nothing but an Inara-sourced export
  shows that: the EDSY export and the thirteen journal captures all use Frontier's own
  casing. `ShipLoadout` and `parseSlotName` resolve
  a slot key whatever its casing. Keys are deliberately **not** canonicalised on import —
  a build keeps its producer's spelling, so this fixture
  re-exports its slot keys byte for byte — its _credits_ deliberately do not survive a
  round trip, per the retail rule below — and the tests over it compare slot keys
  case-insensitively because that is what the library itself does.

- **`fixtures/ships/slef-inara-lynx-highliner.json`** — a real Inara SLEF export of an
  engineered passenger Lynx Highliner (27 `Modules` entries), contributed **2026-08-05
  UTC** by the repository owner from their own commander's fleet, same licence position
  as the Type-11 above. **Manual correction:** the header was reduced to `appName` and
  `appVersion`, dropping the `appURL` commander-fleet link and the
  `appCustomProperties` Inara commander and ship ids — a person's account, which
  `../../AGENTS.md` keeps out of the repository; nothing under `data` was touched, and
  the build is otherwise stored as received apart from re-indenting. Stored-form SHA-256
  `a213d4219fa9531224aafc185d399b08896f7c7ed0a7461b0c8dd0a822767651` (the checksum is of
  the scrubbed file, since that is what a port must reproduce).
  It is **the ground truth for the passenger restriction**: `passenger01` and
  `passenger02` hold `int_mkii_passengercabin_size6_class1` and `passenger03`
  `int_mkii_passengercabin_size5_class1`, which is what EDSY's `{ipc:1}` reservation
  could not confirm on its own — `PASSENGER` is absent from EDSY's journal import map.
  It carries three more cabins in _unrestricted_ mounts (`slot01_size6`, `slot03_size4`,
  `slot04_size4`), so it also shows the restriction runs one way only.
- **`fixtures/ships/slef-inara-panther-mkii.json`** — a real Inara SLEF export of a
  trading Panther Clipper Mk II (25 `Modules` entries), contributed **2026-08-05 UTC**
  on the same terms, scrubbed the same way. Stored-form SHA-256
  `b551f39bda3cf97bdf346cfad6eccdcd5b6424e60ea056b6b1226f76c842ec9b`. Its `ShipName` is
  kept, as the Krait Phantom capture's is: it describes a ship, not a person.
  It is **the ground truth for `restrictedToSlot`**: its two Mk II Cargo Racks sit in
  `cargo01` and `cargo02` while its unrestricted `slot01_size8` and `slot02_size7` carry
  ordinary `int_cargorack_*` racks of the same sizes — a build that cannot be explained
  by size or by hull, only by the mount.
- **`fixtures/ships/slef-inara-cutter-antixeno.json`** — a real Inara SLEF export of an
  engineered anti-xeno Imperial Cutter (33 `Modules` entries), contributed **2026-08-06
  UTC** on the same terms, scrubbed the same way: the header reduced to `appName` and
  `appVersion`, dropping the `appURL` fleet link and the `appCustomProperties` Inara
  commander and ship ids. Stored-form SHA-256
  `398558a45e3860b233c50caf4228de770dbeaf105ca9db1be035590d406b5287`. Its `ShipName`,
  `ShipIdent` and `ShipID` are kept, as the Panther's are.

  It is the **only capture that fits a module this catalogue cannot price**, providing
  external evidence for the omit-rather-than-under-report rule. Five of its optionals are
  corrosion-resistant racks:
  two size-6 and one size-5 — the Community Goal rewards left unpriced above — plus two
  size-4. So the capture declares `HullValue`, `ModulesValue` and `Rebuy`, and this
  library's re-export of it drops **`ModulesValue` and `Rebuy`** — the two figures that
  cannot be built without a price for every module — while still quoting `HullValue`,
  which needs only the hull and is unaffected. Ours reads 200 493 413, the bare retail
  `hullCost`; the capture declares 180 435 868, which is neither that nor the
  `retailCost` 208 969 451, so its hull figure is discarded like every other capture's.
  What discount stands behind it is deliberately **not** worked out — 180 435 868 is
  0.89996 of `hullCost`, near enough 10% to be tempting and 8204 credits short of it, and
  the rule against reaching for a target with a free variable applies here exactly as it
  does to the rack `Value` below. `ship-loadout-export.test.ts` pins the two omissions and
  the retail hull figure.

  **It is also what settles that the reward racks' `Value` is not their list price.**
  Its size-5 rack reports `Value: 318174` and _both_ size-6 racks report no `Value` at
  all — but its two size-4 racks are one module at one list price (94 330) reporting
  **82 774** and **91 970**, about 12.25% and 2.5% off. `Value` is therefore net of
  whatever discount applied, so no single reading recovers a list price, and a reward
  module was not bought at a station in the first place. The same test pins this
  rejection.

Two facts the Krait Phantom capture established that the EDSY export could not:

- **A journal lists far more than fitted modules.** 15 of its 40 entries are the
  cockpit, ship kit, nameplates, bobbles, paint, engine/weapon colours and voice pack.
  None is an outfitting module — this catalogue deliberately does not carry them — and
  all weigh nothing and cost nothing. They are recognised by slot: `parseSlotName`
  returns `null` for exactly these, and only for these.

  `parseSlotName` is the single classifier: an article absent from the module catalogues
  is free and weightless only when its key names no outfitting mount. Known catalogue
  modules are priced and weighed regardless of their slot spelling. A new outfitting
  mount containing an unknown module remains a deliberate gap because neither the module
  nor its physical values can be resolved.

- **The two sources disagree about `HullValue`** — the game counts the hull's stock
  fittings inside it, EDSY does not. See the credits note below, which is why neither
  reading is carried through.

**Credits are quoted at retail, and a build's own figures are kept apart.** `HullValue`
is the bare hull's `hullCost`, `ModulesValue` the sum of every fitted module's catalogue
list price, and `Rebuy` a flat 5% of the two, truncated. Nothing a source claims to have
paid is priced into that, because what a build reports is one commander's purchase at one
station rather than a property of the build. Three observations from the corpus show how
far that can be from list:

- **Discounts are real and invisible.** The Deep Black's modules all sit at a uniform
  **0.8775** of list — a 12.25% outfitting discount — while its hull is at full price.
  The Viper Mk IV capture's 20 priced modules sit at exactly **0.85**, and its hull at
  neither its bare nor its retail price. Nothing in either source says so.
- **The two sources disagree about what `HullValue` means.** The game reports the hull
  _with its stock fittings_ (coriolis `retailCost`, 37 472 252 for the Krait, matching
  its journal exactly), EDSY the bare hull (`hullCost`, 189 326 510 for the Caspian
  Explorer, also exact). Consistently, the journal gives no `Value` at all to the five
  modules that came free with that hull, because their cost already sits inside
  `HullValue`. Quoting `hullCost` and pricing every fitted module keeps one convention
  and avoids double-counting either way.
- **A build's own parts need not add up.** Earlier `Loadout` events in the same Viper
  Mk IV log declare `ModulesValue` 4 940 956 while their per-module `Value`s sum to
  3 942 898: a journal omits `Value` on a module that was nonetheless paid for, here the
  FSD interdictor bought minutes before. The event stored as the fixture is the last one,
  by which point the interdictor is priced and the parts do add up — but a figure rebuilt
  from either would inherit whatever that capture happened to know.

The upside is that the default export becomes a pure function of the hull and the fitted
module symbols. Two builds with the same fit price identically whatever their owners paid;
an edit reprices exactly the module that changed; and such a document always adds up,
since each module carries the same list price the total counted. Where a fitted module has no
published price the total is omitted rather than under-reported — 26 catalogue records
can trigger that today: the two unsold corrosion-resistant racks, the three Mk II
vessel hangars, `Int_ShieldGenerator_Size1_Class4`, `Int_Hyperdrive_Size8_Class{1..5}`
and the fifteen grant/starter `*_free` variants.

**What the source paid is preserved, as provenance rather than as a price.** The three
observations above are reasons not to let a capture's figures set the price of a fit;
they are not reasons to lose them. So each import keeps them verbatim in a read-only
source purchase record — the stated `HullValue`, `ModulesValue` and `Rebuy`, and every
slot the capture priced, each with the module symbol that price was paid for. The record
is fixed at import and survives every edit, unlike the live figures, which an edit
discards because no catalogue records what a replaced module was bought for.

It is exported only when a caller names it, and then **every captured figure stays pinned
to what it was paid for**. A slot whose module has been swapped or removed exports
unpriced — the figure belongs to the article that was fitted, not to the mount — and
`ModulesValue` and `Rebuy` go with it, because they counted that article. Emitting the
module totals anyway would forge the very signal this record exists to expose: re-import
such a document and its declared total disagrees with the sum of its parts,
indistinguishable from a genuinely partial capture like the Viper Mk IV events above,
except that this library would have manufactured the disagreement. Engineering a module
changes nothing here — it is not a purchase — and filling a mount the capture never
priced leaves the totals standing, since an unpriced module beside a stated total is what
a partial capture looks like anyway.

Two limits of that test are worth stating, because both look like bugs and neither is
fixable from the record:

- **A total built on an unpriced module outlives it.** Where a capture's total exceeds
  its priced parts, it counted a module it never priced — the Viper Mk IV log's freshly
  bought FSD interdictor. Remove that module and the total again covers something no
  longer aboard, and nothing can tell: the record knows which modules were priced, and
  only the capture ever knew which ones the total counted. The article test is the
  sharpest one the record supports, not a guarantee that an exported total adds up.
- **`HullValue` always stands**, because a captured hull figure names no slot and no edit
  narrows it. On a game capture it counts the hull _with_ its stock fittings, though, so
  removing one of those five leaves it overstating what is aboard — the same ambiguity
  about what `HullValue` includes that the retail export sidesteps by quoting `hullCost`.

`fixtures/ships/source-purchase.json` pins the record and that export for four captures,
spanning a uniform 12.25% discount, fully priced (Deep Black); a different discount, 15%
(Viper Mk IV); a capture that states no `HullValue` and prices only 19 of its 35 entries
(Caspian Explorer); and one whose `HullValue` counts the hull's stock fittings, so the
five modules that came with it carry no `Value` (Krait Phantom). Its `editedExports`
section pins what each kind of edit does to the export.

**No single discount is derived from it, and none should be.** Dividing a stated total by
the retail total looks like it recovers the station's outfitting discount — 0.8775 on the
Deep Black, 0.85 on the Viper Mk IV — and for those two captures it does. It is not one
number in general: a capture can omit `Value` on a module that was paid for, hold modules
bought at different stations at different discounts, and disagree with its own parts. A
derived percentage would read as a fact about the build and be wrong for most of them, so
what a source stated is offered as stated and nothing is computed from it.

Physical figures (`UnladenMass`, `CargoCapacity`, `FuelCapacity`, `MaxJumpRange`) are
recomputed too, and unlike the credits they **do** reproduce each source's own figures
exactly — which is what shows the recomputation is right rather than merely
self-consistent.

**Still missing external ground truth:** what a build's modules compose to — its
shield strength, its hull total, and its combined damage per second, `sumWeaponMetrics`
and `sustainedDamagePerSecond` among them. A journal states the modules, not what they
add up to, so every such figure is checked against our own maths. An EDSY or Coriolis
_reading_ of a fitted build would close that gap; the build corpus below does not,
because it pins figures this library computed rather than figures a tool published. The
module-level inputs are read: a capture states an engineered weapon's own unmodified
`DamagePerSecond`, Frontier's fold of the four stored stats, for eighteen weapons, and
states the resistances and hull boost the same way — see §Reconciliation and in-game
audit, and <https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/12> for what
remains.

## Build corpus — `fixtures/ships/builds/`

181 community builds, 2–5 for each of the 48 hulls, as a breadth fixture: 4271 fitted
modules covering 558 distinct module symbols, and every hull's slot _layout_ exercised by
builds people actually fly rather than by hand-written combinations. Not every individual
mount: 64 of the 1294 non-cargo-hatch slots are never occupied (18 hulls are covered
mount-for-mount), and the Panther Clipper Mk II's weapon and utility mounts are all empty
because both of its builds are pure traders.

- **Acquisition (2026-08-02 UTC).** Public build links — Coriolis (`coriolis.io/outfit`,
  `s.orbis.zone`) and EDSY (`edsy.org`) — were collected from community build libraries,
  forum and Steam threads, video descriptions and squadron documents, then decoded
  locally to Frontier slot keys and module symbols. Both link formats carry the whole
  build in the URL: Coriolis's is the module-id serialisation its `Ship.buildFrom` reads
  (with the engineering struct in the fourth, gzipped part); EDSY's is the versioned
  hash its `Build.fromHash` reads. The decoders were throwaway scripts run outside the
  working tree, per AGENTS.md; this repository stores only the decoded data.
- **What is deliberately not kept, and what that costs.** A build's own name, author and
  source link are **not** stored, on the maintainer's instruction that the sources need
  not be credited. State the consequence plainly against `data/SNAPSHOTS.md`, which asks
  that a source with no immutable version be preserved by content or checksum: each build
  file preserves the build payload, but **no
  individual build can be traced back to the page it came from, or re-derived from this
  repository**. What remains auditable is everything that makes it a fixture — every
  build re-checks against the catalogues (slot exists, module fits, metrics reproduce),
  which `builds.test.ts` does on every run. Re-collecting the corpus means harvesting
  links afresh.
- **Validation.** Every stored build resolves all modules in the catalogues, fits each
  module into a compatible slot on its hull, and fills all seven core internals.
  Near-duplicates (>85% identical fit) are excluded, and each hull's selections span the
  roles represented by the corpus.
- **Layout.** One file per build, `fixtures/ships/builds/<id>.json`, named by the `id`
  it carries; `index.json` lists every id with its hull and role, and holds the corpus's
  description. One file per build keeps a change to one build a one-file diff, and lets a
  port load a single build without parsing the other 180. It is the one fixture a test
  reads from disk rather than importing — 181 static JSON imports would be a wall — so
  `index.json` is the entry point and the files are the fixture.
- **What the fixture pins.** The fit (slot → module symbol, power priority, and the
  engineering the author declared), plus the metrics this library derives: mass, cargo,
  fuel, jump range, the power budget, shield and armour strength with resistances, and
  weapon DPS. **Engineering is recorded but not applied** — every pinned figure comes
  from stock module stats, so builds designed around an engineered plant read
  `withinBudget: false`. That keeps the numbers a pure function of the catalogues and
  cheap for a port to reach, and it is a choice rather than a limitation: every one of
  the 1902 declared entries resolves against the base stats recorded under §Modules, and
  `index.json` carries `declaredEngineering` so `builds.test.ts` asserts exactly that on
  every run.
  Applying them and re-pinning every metric would be a separate pass over the corpus.
- **Not ground truth.** These figures are this implementation's own output, pinned so
  every future implementation must agree. Only the _builds_ are external.
