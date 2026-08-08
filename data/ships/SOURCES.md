# Data sources — `data/ships/`

**Library snapshot:** 2026-07-24, revised since. **Initial upstream revision:** not
recorded. See `../SNAPSHOTS.md` for the update policy and that known limitation. Each
section below carries the provenance of the catalogue it describes — the source, the
revision it was read at, the derivation, and every value that came from somewhere else.

## Upstream snapshots this domain is pinned to

Referred to throughout by source name; the pin is here, once.

| Source                                                                                                   | Pin                                                                                                                                                          | Acquired      |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| [EDCD FDevIDs](https://github.com/EDCD/FDevIDs) — `shipyard.csv`, `outfitting.csv`                       | no immutable revision recorded                                                                                                                               | 2026-07-24 UTC |
| [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) — `ships/*.json`, `modules/**`, `modifications/*` | commit `0db9234b5b9ce8c939ea84133d7ce336eea88e27`                                                                                                            | 2026-07-24 UTC |
| coriolis-data `modifications/modules.json`                                                               | SHA-256 `09b6427c86bc3cfb578a246f7c6be1791429bb67009b7adaa7909e30aadc160f` — read from the branch tip, so pinned by digest                                    | 2026-08-05 UTC |
| [EDSY](https://github.com/taleden/EDSY) `eddb.js`                                                        | commit `cd68edfba665719958ce038b6e5d9eb02d0d2b02`, SHA-256 `967834d65a75ab1dea4bbaa7e1d6674cbe4083dca03f770d058497e9f7693071`, internal `db 20260428` / `version 423039901` | 2026-08-02 UTC |
| [EDSY](https://github.com/taleden/EDSY) `edsy.js`                                                        | SHA-256 `a40e9bbe65d482a029527d6dc2abdbd1819672e5a5d4a3a4d88ea411f02575f5` — read from the branch tip, so pinned by digest                                    | 2026-08-06 UTC |
| [EDCD/Coriolis](https://github.com/EDCD/coriolis) — the application, for its formulas                     | commit `68c042ca6e3db62372cbbb2077cf972345511712`                                                                                                            | 2026-08-01 UTC |

Every read of `eddb.js` recorded here is of that one byte-identical snapshot; where a
later section describes a field taken from it, that is the same file read for something
the earlier ones did not take, not a new acquisition.

**Licence positions, once.** FDevIDs states none — consult the repository terms before
redistributing the raw identifiers. coriolis-data's and Coriolis's MIT licence covers
their *code*; their JSON values do not fall under it. EDSY is © taleden under
[CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/). The stat, slot and
price values in this directory are Elite Dangerous game data, the property of Frontier
Developments plc, redistributed under [Frontier's media-usage
terms](https://forums.frontier.co.uk/threads/510879/).

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
which only comes out right if a cabin mount is a *restricted* one and so consumes no
`SlotNN` number. `slots.test.ts` asserts that. What the mount accepts is both cabin
families entire: the 14 `Int_PassengerCabin_*` records (sizes 2–6, economy through
luxury, the higher classes only on the larger sizes) and the 9
`Int_MkII_PassengerCabin_*` (sizes 2–6, economy and business; the Mk II family has no
first-class or luxury cabin). No fuel tank, which every *other* optional mount takes.

**Which module families each restriction accepts is pinned** in
`fixtures/ships/ship-slots.json` under `restrictions`: one entry per restricted mount
naming modules it must accept and modules it must refuse, plus one unrestricted mount
for contrast. That is a fact about the game rather than about any implementation, so it
belongs in the shared fixtures and not only in the TypeScript prefix lists.

### `name` — the journal's own key for a mount, on the 13 hulls that need one

`enumerateSlots` numbers a hull's unrestricted optionals `Slot01_SizeN`, `Slot02_SizeN`,
… with no gaps and its hardpoints `1, 2, 3` within each size class. **On 11 hulls one of
those two rules is not what the game does** — the optional rule on nine of them, the
hardpoint rule on the Type-8 Transporter and Caspian Explorer — and the sequences have
no derivable pattern, so the game's name is stored against the mount:
`{ "size": 1, "name": "Slot14_Size1" }`. A mount with **no** `name` is one the rules
already get right; a hull that names any mount of a kind names all of them, so a derived
key and a stored name can never compete for the same string.

**Source:** EDSY `eddb.js` `ship[…].slotnames`. These are **journal** names rather than
EDSY's own — `edsy.js` reads them in `Build.fromJournal()` and writes them in
`exportJournal()`. Only EDSY carries them; coriolis-data does not model journal slot
names at all, so the corroborating source has to be real journal captures, and two are
in hand (below).

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
- **Type-8 Transporter** *hardpoints* `…SmallHardpoint2`, **`SmallHardpoint4`**,
  `SmallHardpoint5`, `SmallHardpoint6` — no `SmallHardpoint3`.
- **Caspian Explorer** *hardpoints* `LargeHardpoint1`, **`MediumHardpoint6`**,
  **`MediumHardpoint5`**, `MediumHardpoint1`…`4` — out of order, not merely gapped, so
  the same key names a *different physical mount* than position would suggest. Its
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
size *off the name* by design, and its doc says so.

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

**Checked against real captures.** `fixtures/ships/slef-the-deep-black.json` is a
Caspian Explorer journal export and `fixtures/ships/slef-inara-type-11.json` a Type-11
one; every slot key in both is a mount the hull's enumerated layout declares, which
`slots.test.ts` asserts. The Caspian capture is the load-bearing one: its internals read
`Slot01_Size7`…`Slot10_Size3`, `Slot13_Size1`, `Slot14_Size1`, all of which the plain
numbering produces — evidence for leaving that hull's optionals alone rather than
assuming EDSY simply omitted them.

**All 13 hulls' full enumerated key lists are pinned** in
`fixtures/ships/ship-slots.json` under `keys`, and the `spot` layouts carry their mount
names, so a port produces the same vocabulary.

### Per-hull corrections and additions

- **Type-11 Prospector — eight hardpoints, not four.** The acquired record read
  `hardpoints: [2, 1, 1, 1]`. Coriolis writes a *restricted* hardpoint as an object
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
- **Lynx Highliner (`MediumTransport01`) — from EDSY + Frontier's Lynx update notes:**
  the Lynx has no coriolis hull entry, so its stats and slot layout are sourced instead
  from EDSY's ship data and Frontier's Lynx update notes (hull mass 260 t, 285/350 m/s,
  200/350 base shield/armour, hardness 55, 2 crew, rotation 26/60/19 deg/s, min thrust
  73.75%; core PP5/thr6/FSD5/LS6/dist5/sen3/tank5; hardpoints 1 large + 4 medium;
  4 utilities; optionals 6/6/6/5/5/4/4/3/2/1; its five armour options at 0/26/53/53/53 t,
  carried on the `MediumTransport01_Armour_*` module records). Values
  the static catalogue does not expose are omitted rather than invented: `masslock`,
  `heatCapacity`, `pipSpeed`, acceleration, and the min-pitch / boost-energy figures.
  Its two size-6 and one size-5 passenger mounts carry `"restriction": "passenger"` and
  the names `Passenger01`–`Passenger03`, sourced above.

## Modules (outfitting)

Each module is **one record** carrying its identity and its stats — identity from
FDevIDs, stats from coriolis-data and EDSY, joined on `symbol`.

- **Files:** `modules-core.jsonc`, `modules-internal.jsonc`,
  `modules-hardpoint.jsonc`, `modules-utility.jsonc`, and `fixtures/ships/modules.json`,
  `module-stats.json` (the stats half keeps its own parity fixture). Split along
  FDevIDs' four outfitting categories so an app that only wants weapons never bundles
  the 1003 core and optional internals; see AGENTS.md §Build.
- **Identity source:** FDevIDs `outfitting.csv`, columns
  `id,symbol,category,name,mount,guidance,ship,class,rating,entitlement`.
- **Identity derivation:** FDevIDs' 1190 modules are carried over in CSV order within
  each category file; the Operations/Lynx additions and the 1B shield generator below
  bring the internal catalogue to 482 and all four to **1197**. The CSV's numeric `id`
  column is dropped — modules are keyed by `symbol`. `class` is FDevIDs' `class` — the
  module size (0–8) — and `rating` its grade letter (A–I); together they are the "5A"
  the outfitting screen shows. `mount` (Fixed / Gimballed / Turreted) and `guidance`
  (Dumbfire / Seeker / Swarm) are stored only on the hardpoints that carry them; `ship`
  names the hull an armour variant belongs to (armour is the one ship-specific module,
  so only the 241 armour records carry it); `entitlement` is kept only where it is a
  real DLC/grant token.
- **The CSV's `category` column is not stored — the file states it.** It would be the
  same string on every record of a file whose name already says it, 1197 repetitions of
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
  engineering base stats coriolis does not carry, and for the corrections listed below.
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
  `thermload`→`thermalLoad`, `piercing`→`armourPiercing`, `range`→`maximumRange`,
  `falloff`→`falloffRange`, `shotspeed`→`shotSpeed`, `jitter`).
  - **`rateOfFire` is derived, not copied.** Upstream stores the fire interval; the
    journal (and this catalogue) report the combined shots per second, so it is
    computed as `burst / ((burst − 1) / burstRateOfFire + fireInterval + chargeTime)` —
    the same derivation Coriolis (`Module.getRoF`) and EDSY (`rof = fpc / spc`) use.
    Continuous-fire weapons (beam and mining lasers) have no fire interval upstream and
    so carry no `rateOfFire`; their `damage`, `distributorDraw` and `thermalLoad` are
    already per second.
  - **`maximumRange`/`falloffRange` are limited to the hardpoint and utility
    categories.** Upstream's `range` is metres for anything hardpoint-mounted but
    kilometres for sensors and its own units for limpet controllers, so the range
    fields are only carried where the unit is unambiguous.
  - **Two upstream zeroes are dropped rather than copied:** `roundspershot: 0` on two
    Shock Cannon variants (Coriolis itself reads the field as `roundspershot || 1`; a
    zero would zero their DPS) and `burstrof: 0` on the Mining Volley Repeater, whose
    burst is a single shot.
  - **`shotSpeed` and `reloadTime` are absent on the weapons that have neither, and
    that absence is an answer.** The 49 weapons with no `shotSpeed` are the lasers, rail
    guns, Gauss cannons and mine launchers — nothing there travels, so there is no
    projectile speed to move. The 41 with no `reloadTime` are a *different and smaller*
    family, the pulse, burst, beam and mining lasers alone: they have no clip and never
    reload, while rail guns, Gauss cannons and mine launchers all reload and all carry
    the stat. Neither registry publishes a figure for either set, and EDSY's per-family
    `modifiable` lists say outright that the game does not move those stats on those
    weapons. The two medium Seismic Charge Launchers, fixed and turreted, *do* reload,
    and take EDSY's `rldtime` of 1 s.
  - **Module-breach stats** (`breachdmg`, `breachmin`, `breachmax`) are the one
    deliberate omission from the weapon block — no calculation here reads them.
- **Massless modules state `"mass": 0` rather than omitting the field.** Upstream
  carries **no `mass` key at all** for fuel scoops, refineries, AFM units and docking
  computers, and Coriolis's own code reads a missing mass as zero (`Module.getMass()` →
  `this.mass || 0`). This catalogue reads an absent field as *unknown* instead, so a
  single such module would make a whole hull's mass — and with it its jump range —
  impossible to compute. The 106 affected records (`Int_FuelScoop_*` ×40,
  `Int_Repairer_*` ×40, `Int_Refinery_*` ×20, `Int_DockingComputer_{Standard,Advanced}`,
  the three withdrawn `Int_StellarBodyDiscoveryScanner_*` tiers, `ModularCargoBayDoor`)
  say so outright, matching upstream's own `"mass": 0` on
  `Int_DetailedSurfaceScanner_Tiny`. **Verified, not assumed:** summing the Deep Black's
  module masses with these six families excluded gives exactly the 1237.3 t its journal
  reports, so the game itself treats them as zero. `Int_DroneControl_ResourceSiphon` is
  **not** among them — limpet controllers do have mass, so its absent `mass` is a
  genuine gap, declared in `unknownStats` below.

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
- **Two stats duplicate a number the record already has, deliberately.** A utility
  scanner's `scannerRange` is the same distance as its `maximumRange`, and a shield cell
  bank's `shieldBankHeat` the same figure as its `thermalLoad` — one upstream field each,
  read under two names. Dropping either would change what a consumer reads, and dropping
  the new name would leave the sensor suites (which have no `maximumRange`) and the Pulse
  Wave Analyser (which has none either) modelled differently from their siblings. Both
  pairs are kept in step instead: `ScannerRange` and `ShieldBankHeat` each map to both
  fields in `module-stat-labels.ts`, so an engineered scanner or cell bank reads the same
  whichever field is asked.
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
- **Four records read from a commented-out upstream row.** The three withdrawn Discovery
  Scanners (`Int_StellarBodyDiscoveryScanner_{Standard,Intermediate,Advanced}`) and the
  free twin of the first take `scanAngle: 10` and `scanTime: 5` from EDSY's row for them,
  which the file keeps but comments out — `/* removed, now built-in */`, the modules
  having left the game in 3.3. The same precedent as `special_feedback_cascade` under
  §Engineering. The values matter because these four are `scanner`-family, so
  `Scanner_WideAngle` (both legs) and `Sensor_FastScan` (the scan time) reach them:
  without a base those legs would be silently dropped as "the module has no such stat",
  which is untrue of them. Their `activerng` / `passiverng` — a detection radius in
  light-seconds, and infinite on the Advanced — are a different quantity from
  `scannerRange` and are deliberately not mapped, so a discovery scanner has no scan
  *range* in the sense the label means. `Scanner_LongRange` refuses on them regardless,
  on their unknown and declared `powerDraw`.
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
- **What is still refused, and why that is right.** A stat a record declares **unknown**
  — the Resource Siphon controller's mass, the withdrawn Discovery Scanners' power draw —
  refuses every recipe that scales it, because nothing can be scaled from an unknown. And
  `GuardianModuleResistance` refuses everywhere, because it is not a number: EDSY stores
  Anti-Guardian Zone Resistance as a flag the recipe *grants*, and this record shape has
  no field for it
  ([issue #27](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/27)). Beyond
  base stats, 14 corpus entries are refused because the engineering menu does not offer
  that recipe on that module — the residue recorded under §Engineering compatibility, not
  a missing stat.

### `unknownStats` — an absence that means *nobody publishes it*

A missing stat is usually an answer: a cargo rack draws no power, a fuel tank has no
rate of fire. On five records it is a gap instead, and the record says so in its own
`unknownStats` field, so a program can tell the two apart without a second lookup.

- **Two fields, five records.** `powerDraw` on the four
  `Int_StellarBodyDiscoveryScanner_*` records, and `mass` on
  `Int_DroneControl_ResourceSiphon`. Both are argued at length below and neither has a
  source. Filling one means deleting its name in the same change —
  `unknown-stats.test.ts` fails on a declared field that has a value.
- **On the record, not in a register beside it.** A separate `unknown-stats.jsonc`
  joined back by symbol would reintroduce exactly the join this domain removed when
  identity and stats were merged into one record: a consumer holding the `undefined`
  would have to know a second file existed to interpret it, and the register could name a
  symbol the catalogue does not carry. The field lives on the record, where the missing
  stat is, and the schema's `module` definition carries it. `ships/unknown-stats` is a
  data-free predicate over that field rather than a catalogue.
- **What it means for a build.** A module with an unknown `powerDraw` is reported in
  `PowerBudget.unknownDraws` and left out of every total, so the totals are an explicit
  lower bound rather than a confident understatement. Mass behaves the same way: one
  unknown module mass withholds `unladenMass` entirely.
- **`integrity` on the 82 non-armour records that lack it is *not* declared**, because
  the evidence says those families do not have the stat: no registry publishes one and
  the game's own module panel shows none. It is recorded instead as a pinned set,
  `fixtures/ships/module-stats.json` `withoutIntegrity`, which fails if the membership
  ever changes. Guardian hull reinforcement packages are in that set and do draw power,
  so "no integrity" is not a shorthand for "inert".
- **`cost` is deliberately never declared.** Every module without a price has no
  *published* price, so an absent `cost` is already unambiguous; there is nothing to
  disambiguate.
- **Scope.** The field can only name stats the record shape has. A recipe that scales a
  stat a record simply omits is inert; one that scales a stat named here is refused. One
  journal label is unmodellable, and it is a capability rather than a number:
  [issue #27](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/27).

### Reconciliation against EDSY — coverage, corrections and rejections

The four module catalogues are reconciled against EDSY `eddb.js`, which carries a mass,
integrity, power draw and boot time for nearly every outfitting module coriolis-data
leaves blank. Every value applied either comes from EDSY or was confirmed against it;
where a candidate correction disagreed with EDSY, EDSY won.

**Coverage, stated plainly.** EDSY carries 677 of the 717 `bootTime` values, 223 of 237
`integrity`, 104 of 115 `powerDraw`, and **contradicts none of them**. That leaves
**110 values across 50 records** EDSY does not supply. Two things count as "does not
supply", and they are not the same:

- **12 records have no EDSY entry at all** — nine of the ten `*_free` starter fittings
  (`Int_PowerPlant_Size2_Class1_free`, `Int_Engine_Size2_Class1_free`,
  `Int_Hyperdrive_Size2_Class1_free`, `Int_LifeSupport_Size1_Class1_free`,
  `Int_PowerDistributor_Size1_Class1_free`, `Int_Sensors_Size1_Class1_free`,
  `Int_FuelTank_Size1_Class3_free`, `Int_CargoRack_Size2_Class1_free`,
  `Int_StellarBodyDiscoveryScanner_Standard_free`) and
  `Int_FighterBayMk2_Size{5,6,7}_Class1`.
- **38 records EDSY lists but leaves the particular field blank.** Blank is the
  operative word: several of these entries are commented-out definitions with some
  values filled in and others left empty, and the filled ones count.
  `Int_Hyperdrive_Size8_Class{1..5}` state `boottime`, `fuelmul` and `fuelpower` — only
  mass, integrity, power draw, optimal mass and max fuel are blank.
  `Int_DetailedSurfaceScanner_Tiny` is missing boot time alone. The rest are
  `ModularCargoBayDoor`, `Int_ShieldGenerator_Size1_Class4` and the Guardian hull,
  module and shield reinforcement families, all missing boot time.

`Int_DroneControl_ResourceSiphon` is **not** in that set: EDSY gives it an integrity, a
power draw *and* a boot time. Only its mass is unaccounted for.
`Int_ShieldGenerator_Size2_Class1_free` is not in it either; EDSY carries that record in
full, including its resistances and the distributor draw it spells `genpwr`.

Of the 110, **108 are read from the live game's own outfitting and module panels**
(2026-08-02 UTC), the same route this file uses for the in-game blueprint and Operations
registries. The remaining **two are derived, not read**:
`Int_FuelTank_Size1_Class3_free`'s `fuelCapacity` and
`Int_CargoRack_Size2_Class1_free`'s `cargoCapacity` follow from capacity being exactly
2^size across all eight sizes of both families, with no exception.

**All 110 are pinned individually** in `fixtures/ships/module-stats.json` `spot`, so a
port validates against the same numbers and a silent drift fails a test — the only guard
these values have, since they cannot be re-fetched from a public source. Each is also
independently consistent with its own family's curve: the size-8 drives extend the
size-7 ladder, and every `*_free` variant matches its paid twin wherever the twin has a
value.

**Every module in every catalogue carries at least one stat** (1197/1197), so
`fixtures/ships/module-stats.json` `counts` equals the catalogue sizes and no record
holds only a lone `mass`. 244 of the 717 `bootTime` values are `0` (every hardpoint
among them); they are stored rather than omitted, because an absent field means
*unknown* here and collapsing a real zero into absence is the defect the `cost` handling
guards against. The four catalogues carry about 24 KB of raw JSON (+5.6%) for this,
inlined into every consumer's bundle.

**`Int_DroneControl_ResourceSiphon` keeps no `mass`, deliberately.** Setting it to `0`
on the grounds that EDSY omits the field and reads a missing mass as zero — the way this
catalogue treats `Int_DetailedSurfaceScanner_Tiny` and `Int_DockingComputer_Standard` —
would be wrong here: no source states the zero, and unlike those two there is no
uniformity to appeal to, since every sized limpet controller in the family has a real,
non-zero mass. A written-down inference is still an inference, and `absent` has to keep
meaning *unknown*. Its `integrity` 20 and `powerDraw` 0.4 do come from EDSY and are
kept. The outstanding mass is recorded in
[issue #17](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/17).

**The four `Int_StellarBodyDiscoveryScanner_*` records carry no `powerDraw`** for the
same reason: no source carries one — EDSY gives them only `mass` and `integrity`, and
coriolis-data has no record for them at all. They are withdrawn modules whose function
is now built in, and the absence is left as *unknown* rather than guessed at zero. Also
[#17](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/17).

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

**Corrections — 40 records, 43 fields.** In every case coriolis-data's value is the
source of the error and EDSY carries the corrected figure:

| Records | Field | coriolis | Stored | Why coriolis's value is wrong |
| --- | --- | --- | --- | --- |
| `Int_GuardianPowerDistributor_Size{1,4,5,6,7,8}` | `integrity` | 56 | 35/70/99/99/115/132 | 56 is size 3's value, repeated across six sizes |
| `Int_GuardianPowerDistributor_Size3` | `weaponsCapacity`/`weaponsRecharge` | 13 / 3.1 | 17 / 3.9 | copied from an adjacent size |
| `Int_GuardianPowerDistributor_Size4` | `systemsCapacity`/`systemsRecharge` | 14 / 1.7 | 17 / 2.5 | copied from an adjacent size |
| `Int_Sensors_Size1_Class{1..5}` | `integrity` | 46/41/51/61/56 | 36/32/40/48/44 | coriolis's size-1 row is a verbatim copy of its size-2 row; size 1 is the only mismatching size in the family |
| `Int_PowerDistributor_Size1_Class{1..5}` | `integrity` | 46/41/51/61/56 | 36/32/40/48/44 | same duplicated-row defect |
| `Int_Hyperdrive_Overcharge_Size7_Class2` | `integrity` | 2700 | 150 | `optMass` copied into `integrity`; every sibling drive is 131–164 |
| `Hpt_Slugshot_{Fixed,Gimbal,Turret}_Medium` | `integrity` | 80 | 51 | 80 is the huge-mount value |
| `Hpt_Slugshot_{Fixed,Gimbal,Turret}_Large` | `integrity` | 80 | 64 | as above; the catalogue already had 64 on `Hpt_Slugshot_Fixed_Large_Range` |
| `Hpt_PulseLaserBurst_Gimbal_Huge` | `integrity` | 80 | 64 | a real outlier, not the Fragment Cannon rule misapplied — see "look wrong and are not" below |
| `Hpt_HeatSinkLauncher_Turret_Tiny` | `integrity` | 20 | 45 | 20 is the chaff launcher's; the Caustic Sink Launcher, its analogue, is 45 in both sources — the same duplicate-record defect as its `cost` and `mass` |
| `Hpt_MRAScanner_Size0_Class1` | `integrity` | 24 | 32 | every other size-0 scanner family runs 32/24/40/56/48; 24 is a duplicate of the Class2 row |
| `Int_DroneControl_{FuelTransfer,Prospector,Repair}_Size5_Class4` | `powerDraw` | 0.97 | 0.72 | 0.97 is the size-7 B-rated value; 0.72 holds the Class4/Class1 ratio the family keeps elsewhere (1.78 at sizes 1 and 3, 1.76 at size 7, 1.80 here) |
| `Hpt_Mining_SubSurfDispMisle_Turret_Small` | `powerDraw` | 0.42 | 0.53 | |
| `Int_ShieldGenerator_Size1_Class5_Strong` | `mass` | 2.5 | 2.6 | Prismatic is exactly 2× the base generator at every other size, so size 1 is 2×1.3, not half of size 2's 5.0 |
| `Int_ShieldGenerator_Size2_Class5_Strong` | `minMass` | 23 | 28 | |
| `Int_MetaAlloyHullReinforcement_Size1_Class2` | `mass` | 2 | 1 | |
| `Int_Engine_Size3_Class5` | `integrity` | 72 | 70 | |
| `Int_Powerplant_Size5_Class4` | `integrity` | 114 | 115 | |
| `Int_FSDInterdictor_Size2_Class2` | `integrity` | 51 | 31 | |
| `Int_StellarBodyDiscoveryScanner_{Standard,Intermediate,Advanced}` | `mass` | 0 | 2 | they are not massless: EDSY retains all three in its "removed, now built-in" block at `mass: 2.00`. Their `class` stays 1, per FDevIDs |

**Rejected — three candidate corrections cross-checking threw out.** Recorded so they
are not "found" and applied again:

- **`Int_GuardianShieldReinforcement_*` `integrity` is genuinely 36 on all ten records.**
  A flat value across five sizes and two classes looks exactly like a placeholder, and a
  reference figure suggests a rising 36→72 curve, but EDSY independently
  carries 36 for all ten. Applying the curve would corrupt correct data.
- **`Int_Engine_Size{2,3}_Class5_Fast` multipliers stay 1.15 / 1.367.** EDSY stores
  thruster multipliers as whole percentages (`engoptmul:115`), so it agrees on 1.15 and
  cannot represent 1.367 at all; the catalogue's value is the more precise one.
- **Thruster and FSD mass-curve fractions stay fractional.** `Int_Engine_Size4_Class2`
  `minMass` 157.5 / `maxMass` 472.5, `Int_Engine_Size4_Class4` 192.5 / 577.5 and
  `Int_Hyperdrive_Size4_Class4` `optMass` 437.5 are exact — `optMass/2`, `optMass×1.5`
  and `350×1.25`. The whole numbers are a rounding artefact of a source that stores these
  fields as integers, so applying them would *introduce* error.

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
  non-integer boot time in all 1197 records, where its three family siblings are exactly
  10. EDSY gives `boottime:9.85`.

### Prices — `cost` on modules, `hullCost` / `retailCost` on hulls

`cost` is the module's standard list price in credits, before any station discount or
markup — the figure an outfitting screen quotes at 0% discount. On hulls, `hullCost` is
the bare hull and `retailCost` the hull with its default module loadout (`retailCost` is
never below `hullCost`, and a test asserts it). Sources are coriolis-data's `cost` per
module and `properties.hullCost` / `retailCost` per ship, with EDSY filling the records
coriolis does not price (the newer hulls' armour, the Operations additions, the retained
withdrawn scanners) and supplying the Lynx Highliner, which has no coriolis entry.
Ship-specific **armour** is priced from each hull's `bulkheads` upstream, joined on hull
+ bulkhead name because those records carry no symbol upstream.

- **All 48 hulls are priced. 1176 of 1197 modules are.** The 21 without a price are the
  ten starter `*_free` variants, the five size-8 frame shift drives, the three Mk II
  Vessel Hangars, the two unsold Corrosion Resistant Cargo Racks (both Community Goal
  rewards) and `Int_ShieldGenerator_Size1_Class4` — no registry publishes a figure for
  them. **`cost` is omitted, never set to 0**: `0` is a real price (the starter
  Lightweight Alloy bulkhead costs nothing), so a cost calculation must be able to tell
  "free" from "unknown".
- **Sixteen duplicated symbols take the first occurrence's price.** Where coriolis-data
  holds a symbol twice, the "first occurrence wins" rule that governs `mass` governs
  `cost` too; taking the *second*, unpriced record would leave them at `0`. The sixteen:
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
  hull and cannot be bought. `fixtures/ships/module-stats.json` pins that list under
  `freeModules`, so a new zero has to be argued for rather than slipping in: a zero price
  is otherwise indistinguishable from a dropped one.
- **`Int_CorrosionProofCargoRack_Size1_Class2` is priced at 12 560, from EDSY**, where it
  is module `161`, annotated `// at Palin, Sedesi`. Coriolis reads `cost: 0` for it,
  which is coriolis's own gap and not a shared one: on the two corrosion racks *both*
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

    **What that does and does not bound.** It bounds the *rounding* to under 10 credits,
    and not to ± 5: EDSY does not always round to nearest, since among the pairs differing
    by under 10 credits a handful differ by 6 to 9, and EDSY is *above* coriolis in every
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
  publish**, and their absent `cost` means *no list price exists*, not *none has been
  found*. They are **not sold at any station**: FDevIDs `outfitting.csv` lists neither,
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
    already-absent `cost` *means*, and `cost` is `undefined` to a consumer either way.
    Using an unpinned page to add a price or a module would need the pin first.
  - **A capture reporting a `Value` was checked and rejected.**
    `fixtures/ships/slef-inara-cutter-antixeno.json` fits five of these racks. Its two
    size-6 records carry **no `Value` at all**; its size-5 carries `Value: 318174`. That
    is not a list price, and the same export is what proves it: the two size-4 racks in it
    read **82 774** and **91 970** against the one list price of 94 330 — about 12.25% and
    2.5% off. `Value` is net of the station discount, one reading with an unknown discount
    does not yield a list price, and a reward module was not bought at a discount to begin
    with. (318 174 is within a credit of 362 591 less 12.25%, and 362 591 is the
    *standard* E-rated size-6 rack's price; that is arithmetic reaching for a target with
    a free variable, not a source. It is recorded only so the next reader does not redo
    it.)
  - **What would close it** is an in-game reading that does not go through a purchase: a
    `StoredModules` entry's `BuyPrice`, a `ModuleSell` on one, or the insurance figure a
    rebuy screen quotes. A journal `Loadout` `Value` will not do it, for the reason above.
    Tracked on [#18](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/18).
- **Filled by hand, from a documented uniformity:** `Int_ShieldGenerator_Size1_Class4`
  (added from EDSY, so it has no coriolis record) takes the resistances and distributor
  draw every one of the 55 shield generators coriolis does carry shares — kinetic 0.4,
  thermal −0.2, explosive 0.5, draw 0.6. The cargo hatch (`ModularCargoBayDoor`) takes
  the 0.6 MW draw Coriolis hard-codes for it (`ModuleUtils.cargoHatch`), since it is
  fitted to every hull and cannot be removed.
- **Still not modelled:** passenger capacity and fighter-bay/rebuild counts. The
  **Merc-Coin** price of the pre-engineered variants is carried, but on the variant
  rather than the module — see `mercCoinCost` in the pre-engineered section.

### Armour, and the fields kept deliberately

- **Armour (bulkhead) stats:** coriolis keeps a hull's five (Caspian Explorer: six)
  armour options on the *hull* record; this catalogue keeps them on the matching
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
      racks sit in `cargo01` and `cargo02` while its *unrestricted* `slot01_size8` and
      `slot02_size7` carry ordinary racks — a build that could not exist if the
      reservation were about size. `fixtures/ships/slef-inara-type-11.json` does the same
      for the controller, in `limpetcontroller01`.
    - **The field is deliberately narrow.** It says a module fits *only* mounts with that
      restriction, so it is wrong on anything the game also sells for an ordinary
      optional: a plain cargo rack fits a `cargo` mount *and* every unrestricted one, and
      does not carry it. `modules.test.ts` pins the set of five so widening it is a
      deliberate act.
  - **Pre-engineered/duplicate drives share a `symbol`** in coriolis (e.g. the V1
    FSDs); the first (primary) occurrence wins, and any baked engineering is expected
    to arrive as SLEF `Engineering.Modifiers` instead.
- **Identity kept as-is from the source (do not "fix" these back):**
  - **The three withdrawn Discovery Scanner tiers** (`Int_StellarBodyDiscoveryScanner_Standard`
    / `_Intermediate` / `_Advanced`) are retained: a registry that maps a module
    symbol to a name must still resolve symbols that appear in older journals and
    saved builds.
  - Two non-entitlement notes in the source `entitlement` column — `removed` (on the
    scanners above) and `?` (on `Hpt_CausticSinkLauncher_Turret_Tiny` and
    `Hpt_AntiUnknownShutdown_Tiny_V2`, whose gating FDevIDs has not confirmed) — are
    dropped rather than stored as if they were grants. Their records are kept; only
    the fake entitlement is omitted.
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

- **Mk II Vessel Hangars** (`Int_FighterBayMk2_Size{5,6,7}_Class1`) — internal records
  with the same operational stats as the Mk I bays at half the mass (10/20/30 t,
  integrity 60/80/120, power 0.25/0.35/0.35 MW). The three Mk I **Fighter Hangar**
  records are named **Mk I Vessel Hangar** (same symbols and stats; the Operations update
  renamed them and let them deploy the Nomad).
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
    non-purchasable internal variants that rule excludes;
    [#20](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/20) states the
    same test over a different set of symbols: absence from FDevIDs is the evidence a
    variant is not purchasable.
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
- **Inclusion rule — a public registry has to corroborate the record.** A module symbol is
  carried here only when [FDevIDs](https://github.com/EDCD/FDevIDs),
  [coriolis-data](https://github.com/EDCD/coriolis-data) or
  [EDSY](https://github.com/taleden/EDSY) lists it as player-obtainable outfitting. That
  keeps `getModuleBySymbol` and `getModulesForShip` a player-facing outfitting view rather
  than an inventory of every symbol the game has ever used. Two consequences worth knowing
  before "fixing" an apparent omission:
  - **Symbols outside outfitting are not stored** — hull geometry, ship-launched-fighter
    weapons and internals, station fittings, and non-purchasable internal or test variants.
    A journal will never ask you to price these, and the module schema has no
    category/class/rating for most of them.
  - **A named variant with no published stats is not stored either.** Where a registry
    records only that a variant exists, adding it would mean inventing the mass, power and
    integrity a fitting calculator needs. The one exception is documented above
    (`Int_ShieldGenerator_Size1_Class4`), where the multipliers *are* published and only
    the three unknown fields are omitted.
  - The built-in **Cargo Hatch** is stored once as `ModularCargoBayDoor`; per-hull
    duplicates of the same fitting are not carried separately.

## Engineering (blueprints and experimental effects)

**Rate-of-fire features carry the label of the stat they change.** Frontier's own
`Weapon_RapidFire` and `Weapon_HighCapacity` recipes modify the **fire interval** —
coriolis-data stores the feature as `rof` but flags it `higherbetter: false`, and its own
calculator inverts it (`Module.js`: `if (name == 'rof') modValue = 1/(1+modValue) - 1`),
while EDSY stores the same recipes outright as burst-interval modifiers
(`bstint:[-8,-17,-26,-35,-44]`). Those ten features are therefore stored here under
**`BurstInterval`**, the stat they actually move; a weapon's combined `rateOfFire`
follows from the interval and its burst pattern. The Inara-sourced Operations totals are
left as published: they are *displayed* rate-of-fire changes, so they keep the
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
| `special_weapon_rateoffire` (Multi-Servos)               | `PowerDraw +5%`                       | `BurstInterval −2.9126%`                    |
| `special_powerdistributor_capacity` (Cluster Capacitors) | three capacity legs, one recharge leg | `WeaponsRecharge` and `SystemsRecharge` −2% |
| `special_powerdistributor_fast` (Super Conduits)         | three capacity legs, one recharge leg | `WeaponsRecharge` and `SystemsRecharge` +4% |

Multi-Servos is stored under `BurstInterval` for the reason given above — EDSY writes it
as `bstint: -2.9126…`, coriolis as `rof: -0.029126…` under its inverted convention, and
both come to the same +3% rate of fire.

**Deliberately not added: two single-sourced canister magnitudes.** coriolis gives
`special_radiant_canister` an `ammo: -0.25` and `special_shiftlock_canister` a
`damage: -0.2`; EDSY records no magnitude for either, its `special:` text describing only
the gameplay flag ("Area heat increased and sensors disrupted", "Area FSDs reboot"). The
in-game descriptions coriolis carries do say a cost exists ("at the cost of ammo
capacity" / "at the cost of reduced damage"), so the *direction* is not in doubt — but a
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
  (each grade `{ features, materials }`); each experimental effect is
  `{ name, modifiers, materials, description? }`.
- **Display names:** each blueprint and experimental effect carries its `name`.
  Effect names are EDSY `expeffect[].name` (all 87); blueprint names are coriolis
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
  rename: a key carries one only when the id the game writes for it is a key some *other*
  record already answers to. The other 106 go without for two different reasons — 79
  because their key already is the id a journal writes (Anti-Guardian Zone Resistance is
  now one of them, as `GuardianModule_Sturdy`), and 27 because they are Operations ids for
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
    `recipe_fuelscoop_efficiency`, `recipe_modulereinforcement_heavyduty` — and the
    catalogue once stored them that way, on the reading that the prefix was Frontier's own
    compiled key. It is not. Neither menu registry uses it: coriolis's
    `modifications/blueprints.json` has **81 keys and not one prefixed**, and `eddb.js`
    contains no `recipe_` string at all (both checked 2026-08-07 UTC). Nor does real export
    data: a SLEF export contributed by the repository owner carries the Mercenary Module
    Reinforcement Package as **`modulereinforcement_heavyduty`** — the registry id minus
    the prefix, in the lower case Inara writes everything in — and across the 181-build
    corpus **not one of 1902 declared engineering entries is prefixed**. So the prefix is
    an Inara listing convention, and these keys are the id with it removed.
  - **The casing is Frontier's, taken from a raw journal.** Inara publishes these ids
    lower-case, but Inara lower-cases *every* id it exports (`weapon_efficient`,
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
    the id. No blueprint Frontier writes is named that way — a journal spells the *module*
    `Int_CargoRack_Size5_Class1` and the *recipe* separately. They read as Inara SKU ids
    for particular pre-engineered purchases. Dropping the prefix and casing them makes them
    consistent with their neighbours; it does not make them right, and no observation
    covers them either way. A consumer matching a journal `BlueprintName` should not expect
    these seven to be what it carries.
  - **The two Anti-Guardian aliases keep their `recipe_` prefix**, and are the only keys
    that do. For that recipe the real name *is* known — `GuardianModule_Sturdy` — so they
    are not best guesses at a journal id but declared Inara-only spellings, kept so a build
    carrying either still resolves; stripping `recipe_guardianmodule_sturdy` would also
    collide with the real key.

  The registry exposes **one displayed total per grade**, not a roll-bounded range, so each
  feature stores that total as a fixed value (`min == max`).
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
  resolves. All three carry the same display name, the same grade-1-only
  `GuardianModuleResistance` +100%, and the same recipe (2×`TG_Abrasion03`,
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
    the two registry spellings are stored beside it as aliases that still resolve — the
    journal name is the identity, a community name is the alias. That ordering is not
    cosmetic: while the menus listed an Inara `recipe_`-prefixed key,
    `getBlueprint('GuardianModule_Sturdy')` answered `null` and `applyBlueprint` refused
    the id on the very module the capture shows carrying it, so the inversion was a defect
    rather than a naming preference.
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
    `modifications/specials.json` (recipes). All 87 effects here appear in
    `specials.json`; **85** have a `modifierActions.json` entry to diff against — the two
    that do not, `special_blinding_shell` and `special_smart_rounds`, are qualitative
    records this file stores with no modifiers either. The two sources agree everywhere
    once each one's conventions are accounted for: coriolis stores the four resistances
    as `modmod` percentage points where this file stores fractions (hull and shield boost
    it stores as fractions, exactly as here — it is *EDSY* that uses points for those),
    names a thruster's or drive's heat `thermload` where the journal Label is
    `EngineHeatRate` / `FSDHeatRate`, and inverts rate of fire as described above.
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
  / burst interval +50%). Their one-application `materials` are from the same in-game /
  Inara registry (a Merc-Coin amount is also charged but is not stored). Every one is a
  weapon effect, and the weapon groups' menus list them.
- **Feedback Cascade (`special_feedback_cascade`) is easy to miss in EDSY**, which holds
  it commented out (`wpnx_feca`, marked "verify mats") — the plain effect players apply
  themselves, as against the pre-engineered rail-gun variant
  `special_feedback_cascade_cooled` beside it. It is damage −20% with the same
  one-application recipe as the cooled variant (5×`SymmetricKeys`, 5×`ShieldEmitters`,
  5×`FilamentComposites`).
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
    qualitative effect *is* published with a recipe it is carried with an empty `modifiers`
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
    exception, because a group *is* a menu and these are two menus. Reading the
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
    Mk II Plasma Shock Autocannon — which is why `antiXenoMultiCannons` holds 2 of that
    family's 10 modules, `miningToolsLasers` 2 of its 7 and `plasmaAccelerators` 4 of its
    5. The ten plain Module Reinforcement Packages are denied their family's only recipe
    and are absent too, which leaves `moduleReinforcements` holding the ten Guardian
    packages.
  - **The 169 modules absent take no engineering.** Whole families first, both registries
    agreeing: fuel tanks, passenger cabins, the repair/recon/research/decontamination and
    multi-limpet controllers, meta-alloy and ordinary module reinforcement, the Pulse Wave
    Analyser, the mining launchers, Shock Cannons, Nanite Torpedo Pylons, fighter and
    vehicle hangars, the docking computers and Supercruise Assist, the module stabilisers,
    the planetary approach suites, the withdrawn discovery scanners, the cargo hatch and
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
    all of them, and the Guardian-weapon disagreement in
    [#36](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/36) has only
    one registry behind it.
  - **The multi-cannon Overcharged is the one place a group follows coriolis over EDSY.**
    EDSY has a single Overcharged for every weapon; coriolis splits it, and `multiCannons`
    lists coriolis's `MC_Overcharged`. See "Multi-cannon Overcharged: one journal id, two
    recipes" below for the evidence and for what the split costs.
  - **The groups name 86 of the 109 blueprints.** The other 23 are accounted for: 21 are
    Operations keys of modules sold already engineered rather than offered in a menu, and
    the other two are the registry's spellings of Anti-Guardian Zone Resistance, which every
    group lists under the journal id `GuardianModule_Sturdy`. Four Operations keys *are*
    named by a group, because they are recipes a player applies — see "Four Operations
    recipes are listed by a menu" below.
  - **14 modules are bound by the family rule, not by a source row.** EDSY has no live
    entry for `Int_Hyperdrive_Size8_Class{1..5}` or `Int_ShieldGenerator_Size1_Class4`
    (both present but commented out, and both naming their `mtype` — `cfsd` and `isg`),
    nor for eight of the `*_free` starter fittings. Each takes its family's group, on the
    same rule the stats above use: a `*_free` variant is its priced twin bar the price,
    and a size-8 drive is a drive. `Int_FuelTank_Size1_Class3_free` and
    `Int_StellarBodyDiscoveryScanner_Standard_free` are not bound, because their twins are
    not engineerable either.
- **Scanner Long Range and Wide Angle: one journal id, two recipes.**
  These two modifications are offered on the internal sensor suite *and* on the
  KWS/manifest/wake scanners, and the game writes the same `BlueprintName` for both. EDSY
  is explicit about it — `cs_lr` (suite) and `scan_lr` (scanner) are two rows with
  different numbers and one `fdname: 'Sensor_LongRange'`, likewise `cs_wa` / `scan_wa`
  under `Sensor_WideAngle` — and its journal importer resolves a `BlueprintName` through a
  **per-module-type** map (`edsy.js` `Build.fromJournal`:
  `fdevmap.mtypeBlueprint[mtypeid][fdname]`), which is the same admission read as code.
  coriolis's `Scanner_LongRange` / `Scanner_WideAngle` keys are its own disambiguation, not
  a second journal spelling; its `fdname` field for both simply repeats its key. The two
  recipes disagree in both directions, so no rule of thumb recovers the right one:

  | Blueprint id (G1)  | Sensor suite                            | Utility scanner                              |
  | ------------------ | --------------------------------------- | -------------------------------------------- |
  | `…_LongRange`      | `Mass` ×1.20, `ScannerRange` +0…15%      | `PowerDraw` ×1.10, `ScannerRange` +0…24%      |
  | `…_WideAngle`      | `PowerDraw` ×1.10, `ScannerRange` −4%   | `Mass` ×1.20, `ScannerTimeToScan` +10%        |

  Both keep their `SensorTargetScanAngle` leg. The catalogue keeps coriolis's split keys,
  because two recipes need two records and the menus have to name the one they roll.

  **The fix is two stored facts and no third list.** What the game writes for a recipe is a
  property of the recipe, so it is stored on the recipe: `blueprints.jsonc` gives
  `Scanner_LongRange` and `Scanner_WideAngle` a **`journalName`** naming the id a journal
  carries. They are two of the three records that carry the field out of 109 —
  `MC_Overcharged`, below, is the third. Every other key either already *is* the id a
  journal writes or is an Operations spelling, which is why the field is absent everywhere
  else. Which of the two colliding recipes a given module rolls is a property of the module,
  and `engineering-options.jsonc` already carries it — the
  menu. `resolveBlueprintForModule` is the join: it asks which blueprint *this module is
  offered* answers to the incoming id. `ShipLoadout.applyBlueprint` resolves before it
  folds, so an EDSY-authored build declaring `Sensor_LongRange` on a wake scanner
  engineers, and engineers the scanner's numbers.

  Storing it as a per-group alias map instead is worse: the same two entries would be
  repeated on every scanner group — three today — and silently missing from the fourth if
  the game ever adds one, which is the hand-maintained-second-answer failure
  §Engineering compatibility below was written about. Deriving it by *signature*,
  the way the generic `Misc_*` spellings are derived, is not available either: these two
  ids touch different labels by design, so a signature match could never fire, and any
  looser rule would be inventing a pairing rather than reading one.

  The resolution runs into a menu and never out of one — a sensor suite is not thereby
  offered `Scanner_LongRange` — and it is only well defined while no menu offers two
  blueprints written the same way, which a test asserts for all 53. Both directions are
  pinned in `fixtures/ships/engineering.json` (`scannerIdCollision`): the exact modifier
  block the same id produces on each family, and `journalNames`, the whole of the blueprint
  side.

  **The join lives in a module of its own so a menu-only consumer pays nothing for it.**
  The function needs the menus *and* the recipes, so putting it in `engineering-options`
  would take that module's import graph from 64 KB to 285 KB (7.2 KB to 25.3 KB gzipped)
  for every consumer who only wanted to know what a module takes — measured the way
  `README.md` defines a size, over a module and everything it imports, which is what
  `package.test.mjs` walks. Tree-shaking recovers it, but the repo does not measure in
  tree-shaken bundles and a plain ESM consumer would not get it. So it is
  `ships/blueprint-journal`: `engineering-options` carries no recipe data in its graph (a
  test asserts the absence and bounds the size at 96 KB rather than pinning it, so a data
  change moves the figure without moving the test), `blueprints` is about 221 KB, and the
  285 KB is paid by callers who ask for the join. This closed
  [#32](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/32).

  The evidence for the collision is in `edsy.js` — the file carrying `Build.fromJournal`
  — rather than in the `eddb.js` tables the rest of this section reads, which is why both
  EDSY files are pinned at the head of this document.
- **Checked against the build corpus.** Of the 1902 declared engineering entries in
  `fixtures/ships/builds/`, 1900 sit on a module this catalogue groups, and 1889 are clean
  end to end: the module is grouped, its group offers the blueprint, and where an
  experimental is declared the module can take it. 70 of the 1889 declare the generic
  spelling of a family-specific recipe (`Misc_LightWeight` on a life support, and so on)
  and count as offered; the shape of that judgement is pinned in the fixture as
  `corpus.blueprintAliases`. A further **71** are a journal spelling resolved against
  `journalName` above, counted separately as `corpus.journalSpellingsAccepted` because it
  is a different mechanism — 70 of them `Weapon_Overcharged` on a multi-cannon, which
  rolls `MC_Overcharged`, and the 71st `Sensor_LongRange` on a wake scanner in
  `type9-military-combat-3`. And **13** are explained by neither spelling rule but by the
  *sale*: the module was bought carrying the recipe, so no menu lists it
  (`corpus.preEngineeredSalesAccepted`; every one is a Guardian weapon — see "An ordinary
  recipe on a Guardian weapon is a purchase, not an engineer roll" below). For those 13 the
  clause "its group offers the blueprint" does not hold, and is not meant to. The residue
  is **13 entries no registry supports**, left as explicit exemptions rather than folded
  in:
  - `corpus.notOffered` — five `Weapon_HighCapacity` on the Guardian Gauss Cannon and six
    `special_super_penetrator_cooled` on the Guardian Shard Cannon
    ([#36](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/36)).
  - `corpus.notGrouped` — two `Weapon_Efficient` entries on the Mk II Plasma Shock
    Autocannon (both in `smallcombat01-nx-combat`), which EDSY denies every blueprint
    (`noblueprints: {'*'}`). coriolis cannot corroborate either way: its
    `modifications/modules.json` is keyed by module *group*, so it says nothing about one
    module. This is the one case where the corpus engineers a module this catalogue calls
    unengineerable, and it is the newest weapon involved, so an upstream lag is at least
    as likely as a mis-declaration. Also tracked in
    [#36](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/36).

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
  effect, and on a Guardian *module* — power plant, power distributor, hull/module/shield
  reinforcement package, FSD booster — it is the whole menu.** An engineered Guardian
  module that does carry an experimental was obtained **already engineered**, as a
  community-goal reward or a tech-broker unlock, rather than rolled at an engineer; this
  file answers what a player may apply, so it does not list those. All nine groups
  offering `GuardianModule_Sturdy` therefore list `"experimentals": []`.
  - **"Whole menu" holds for the weapon groups too.** It once did not: `guardianGauss`,
    `guardianPlasma` and `guardianShard` each also listed one ordinary weapon recipe. They
    no longer do — an ordinary recipe reaches a Guardian weapon only as a purchase, so it
    is `pre-engineered.jsonc` that carries it (see "An ordinary recipe on a Guardian
    weapon is a purchase, not an engineer roll" below). All nine groups are menus of one
    recipe.
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
    above, and the kind of evidence
    [#33](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/33) named as
    sufficient ("a capture of the in-game experimental list"). There is no upstream
    revision to pin, because no registry publishes the fact; neither contradicts the
    report either, both being silent.
  - **Scope: all nine Guardian groups, weapons included.** `guardianGauss`,
    `guardianPlasma` and `guardianShard` once also listed an ordinary weapon blueprint
    (`Weapon_RapidFire`, `Weapon_Overcharged`, `Weapon_LongRange`). They no longer do:
    those recipes reach a Guardian weapon only as a **purchase**. See "an ordinary recipe on
    a Guardian weapon is a purchase" below.
  - **The corpus neither corroborates nor contradicts.** None of the 1902 declared
    engineering entries in `fixtures/ships/builds/` engineers a Guardian power plant,
    distributor or hull reinforcement package at all. The six
    `special_super_penetrator_cooled` entries on a Guardian Shard Cannon sit in
    `corpus.notOffered` under #36 for an unrelated reason.
  - **What a consumer sees:** `getExperimentalsForModule` answers `[]` for the 25 modules
    in the three split families above (`guardianPowerPlants`, `guardianPowerDistributors`
    and `guardianHullReinforcements`), `ShipLoadout.applyBlueprint` refuses an
    `experimental` on them, and `getExperimentalsForBlueprint('GuardianModule_Sturdy')`
    answers `[]` rather than a union across the nine groups that offer the recipe.
    Blueprints are unaffected on every module. Pinned in
    `fixtures/ships/engineering-options.json` as `antiGuardianZoneResistance` (the nine
    groups, the empty list, six representative modules) and on each half of
    `splitFamilies`.
- **Multi-cannon Overcharged: one journal id, two recipes.** `multiCannons` lists
  **`MC_Overcharged`** where every other weapon menu lists `Weapon_Overcharged`, and the
  record carries `journalName: "Weapon_Overcharged"`. Same shape as the scanner ids above,
  in the family far more consumers touch: 70 of the corpus's 1902 declared entries resolve
  through it, against one for the scanners.
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
    Overcharged (`wpn_oc`) carrying `ammoclip:[-3,-6,-9,-12,-15]` for *every* group that
    lists it. So coriolis expresses the leg by splitting the key and EDSY by keeping one
    recipe whose clip leg is inert on a clipless weapon; on the multi-cannon they agree,
    which is what `multiCannons` follows. **This is not the scanner collision's shape** and
    the comparison should not be pushed that far: the scanner pair is two recipes rolling
    different stats in opposite directions on two families, this pair differs by one leg on
    one family in the direction both sources give it.
  - **`antiXenoMultiCannons` stays on `Weapon_Overcharged`.** coriolis keys the anti-xeno
    multi-cannons apart as `axmc` and gives that group no Overcharged at all, so it cannot
    say which of its two keys an AX multi-cannon takes, and picking one would be inference
    over the only source that distinguishes them. That is a narrower refusal than it
    looks: whether the clip *leg* applies to an AX multi-cannon is a different question,
    EDSY is not silent on it, and it is
    [#48](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/48) case B.
  - **28 clip-bearing modules are still offered a clip-less Overcharged**, in two cases
    needing different evidence, tracked at #48. 26 are a registry disagreement — 12
    cannons, 10 fragment cannons, four plasma accelerators, whose groups coriolis covers
    and gives the clip-less key. The other two are the anti-xeno multi-cannons, which sit
    in a group coriolis leaves empty, so they are among the 13 resting on EDSY alone and
    the only registry describing them says the clip drops. (It was 34 until the Guardian
    weapon menus stopped offering the ordinary recipes at all: the six Guardian plasma
    launchers left this set entirely, being sold with `Weapon_Overcharged` rather than
    offered it.) The three laser groups also list `Weapon_Overcharged` and are
    unaffected: no laser carries a clip.
  - **What a consumer sees:** `getBlueprintsForModule` answers `MC_Overcharged` on all 14
    multi-cannons; `applyBlueprint` accepts either spelling, resolving the journal one
    against the menu, and folds the clip reduction. Pinned in
    `fixtures/ships/engineering.json` as `overchargedIdCollision` — both modifier blocks in
    full, with the medium cannon as the control that takes the same journal id and no clip
    leg — and in `journalNames`.
- **An ordinary recipe on a Guardian weapon is a purchase, not an engineer roll.** The
  three Guardian weapon groups list **only** Anti-Guardian Zone Resistance, exactly as the
  six Guardian *module* groups do. They previously also listed one ordinary weapon recipe
  each — `Weapon_RapidFire` on `guardianGauss`, `Weapon_Overcharged` on `guardianPlasma`,
  `Weapon_LongRange` on `guardianShard` — which claimed a player could roll it at an
  engineer. Two independent bodies of real data say otherwise, and the repository owner
  confirms it:
  - A 521-module `StoredModules` capture (2026-08-07 UTC) holds **20** Guardian weapons
    carrying an ordinary recipe. Every one is a **Fixed Small or Fixed Medium** variant that
    `pre-engineered.jsonc` already records as *sold* carrying that exact recipe. No Large
    and no Turret variant carries one, and exactly one Guardian weapon in the whole capture
    carries `GuardianModule_Sturdy` — the only recipe a player can actually roll onto it.
  - The 181-build community corpus adds **13** more of the same shape (5× and 2× Guardian
    Plasma Launcher Fixed Medium/Small with `Weapon_Overcharged`, 6× Guardian Shard Cannon
    Fixed Medium with `Weapon_LongRange`), every one on a variant sold carrying that recipe.
    The corpus holds five further Guardian-weapon entries — `Weapon_HighCapacity` on a
    Guardian Gauss Cannon — which the purchase account does *not* explain: no registry
    lists that recipe for that module and `pre-engineered.jsonc` does not sell it. They are
    the residue tracked as `corpus.notOffered`, unchanged by this reading and unexplained
    by it.

  So the recipe reaches the weapon by the **pre-engineered route**, which already carries
  every one of these rows, and the menu must not offer it — otherwise
  `getBlueprintsForModule` promises a Guardian Plasma Turret an Overcharged roll that no
  engineer will perform. `engineering-options.test.ts` counts a corpus declaration
  explained this way as `preEngineeredSalesAccepted` (13), a fourth explanation beside the
  generic alias, the journal spelling and the pinned residue — and the only one that is
  about how a module was *obtained* rather than how a recipe was *spelled*.

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
    prefix inference the family map used: that guessed a family from a *module symbol*,
    where this reads a family the registry names.
  - **The modifier legs agree.** `FuelScoop_Efficiency` moves `RefuelRate` and
    `PowerDraw`, and a fuel scoop is the only module in the catalogues with a `RefuelRate`
    to move. The three plasma conversions move `PowerDraw` and `Damage`, which their names
    narrow to one laser family each.
  - **Neither menu registry lists them, which is expected rather than a conflict.**
    `eddb.js` contains no `recipe_` string at all and coriolis's group tables carry only
    journal-keyed ids, so both are silent on the whole Operations family; these recipes have
    never come from either. Corroborated 2026-08-07 UTC against a web-search index of the
    Inara blueprint pages for Plasma conversion (`/elite/blueprint/202/`, `/203/`), which
    publish a per-roll material cost **plus a Merc-Coin amount** — the shape of a blueprint
    rolled at an engineer, not of a module bought ready-made. `inara.cz` is refused by the
    acquisition environment's network policy, so that is a read of an index of those pages
    rather than a capture of them.
  - **What a consumer sees:** one more id on 40 fuel scoops and on 12 modules in each laser
    group. No experimental list moves.
- **`special_feedback_cascade` is offered by nothing, and correctly.** It is the one id in
  either catalogue that no module accepts. coriolis's `modifications/specials.json` names it
  **"Feedback cascade (Legacy)"** and EDSY's row for it is **commented out** —
  `//	wpnx_feca : { … fdname:'special_feedback_cascade' }` — which is why no `expeffects`
  list names it while `hrgx_feca` (`special_feedback_cascade_cooled`) sits on the rail gun
  menu. Reading a commented-out EDSY row as a withdrawal is the precedent §Modules already
  sets for the retired Discovery Scanners. `specials.json` is pinned by SHA-256
  `2f86f850f12cc28b4d3e46d672790bac2be6dc9bf5ad350f799c9f43fee0ad1d`, read 2026-08-07 UTC.
  - **The "(Legacy)" marker alone would not settle it**, which is why both readings are
    needed: the other two legacy-marked specials are live menu entries —
    `special_plasma_slug` on the plasma accelerators, `special_super_penetrator` on the rail
    guns — so the marker is not on its own a claim that an effect is unreachable. The EDSY
    commenting-out is the half specific to this one.
  - **The record is kept rather than dropped.** A journal or saved build from before the
    withdrawal can still name it, and a consumer holding one needs its modifiers to read the
    block. `applyBlueprint` refuses it on every module, which is the right answer to "may I
    apply this now".

## Decorative modifications

- **File:** `decorative-modifications.jsonc`, validated by the `decorativeModifications`
  block in `fixtures/ships/engineering.json`. Read it with `getDecorativeModification` /
  `isDecorativeModification` / `getDecorativeModificationsForModule` /
  `typescript/src/ships/decorative-modifications.ts`. Three records —
  `Decorative_Green`, `Decorative_Red`, `Decorative_Yellow` — each `{ name, modules }`.
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
- **They are not cosmetic-only, and the `Damage` cut is not stored.** A festive launcher
  fires fireworks rather than flak, and the transformation carries a heavy cut to the
  module's `Damage` to match — the repository owner puts it near 99%. **No magnitude is
  stored**, because none is published and an estimate is not a measurement: a
  `StoredModules` entry has no `Modifiers` block at all, and EDSY lists the three
  transformations with no modifiers, which the cut shows to be an incomplete record rather
  than a second opinion. What would fill it is one `Loadout` event with a festive launcher
  fitted: its `Engineering.Modifiers` carries the exact value and method, the way the
  community-goal rows in `pre-engineered.jsonc` carry theirs. Until then the honest reading
  of a record here is "this id is real and names no recipe", **not** "this module is
  unmodified" — a consumer wanting the real damage must read the journal's own
  `Engineering.Modifiers`, which is exact.
  - **This is why they stay out of `BLUEPRINTS` even now that a stat is known to move.**
    A modifier set that arrives fixed with an awarded module is a pre-engineered variant in
    shape, not a blueprint — no roll, no grade, no quality. If the captured block turns out
    to carry several legs, reusing `pre-engineered.jsonc`'s `modifiers` vocabulary here is
    the change to make; what does not work is a `PreEngineeredVariant` row, which needs a
    `blueprint` joining to `BLUEPRINTS` and a `grade`, and these have neither.
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
  journal wrote it and never looks the id up, so a festive launcher imported from a journal
  keeps its real damage while one assembled by hand does not.

## Engineering compatibility (may this recipe go on this module?)

Not a data file, and not a second opinion. `ShipLoadout.applyBlueprint` reads the menu
above: a recipe it does not list for that module is refused. The two questions a consumer
can ask — what a module takes, and whether a particular recipe may go on it — therefore
cannot disagree, and `engineering.test.ts` asserts that for all 1197 modules.

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
spelling first, then the pre-engineered route, then the generic spelling, and only the
first can change *which recipe* an accepted id names, so the other two cannot disagree
whichever way round they are asked. `loadout-engineering.ts` states the running order.

- **Accommodation: the journal spelling of a menu entry.** Where the game writes one
  `BlueprintName` for two different recipes, the module's own group carries the map from
  that id to the entry of its menu it names — only the three utility-scanner groups need
  one, and §Scanner Long Range and Wide Angle above is the whole of it. It is pinned data,
  not inference, because unlike the generic spellings below the two ids do *not* describe
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
  chaff launcher's 10 rounds, the heat sink's a flat +49% of a launcher's 3 — so neither
  may substitute for the other. An id **no menu lists anywhere** substitutes too, which
  covers Anti-Guardian Zone Resistance, whose two registry spellings
  (`recipe_guardianmodule_sturdy`, `recipe_guardianweapon_sturdy`) sit beside the
  `GuardianModule_Sturdy` the nine offering groups list — see §Engineering, "Anti-Guardian
  Zone Resistance is keyed three times". The game writes only the last of the three, so
  the other two reach the recipe through this route. `Weapon_LightWeight` is excluded by
  the labels instead — a weapon's Lightweight cuts distributor draw, which the generic one
  does not touch.
- **What the corpus cannot engineer, and why refusing is the honest answer.** 13 of its
  1902 entries declare a recipe no registry lists for that module: `Weapon_HighCapacity` on
  a Guardian Gauss Cannon (5) and `special_super_penetrator_cooled` on a Guardian Shard
  Cannon (6), where EDSY's `hexgg` group answers Rapid Fire and Anti-Guardian Zone
  Resistance alone; and `Weapon_Efficient` on the Mk II Plasma Shock Autocannon (2), which
  EDSY marks `noblueprints`. All thirteen are refused, each citing an upstream denial —
  which is a tightening on real community builds, and deliberate: an inference loose
  enough to admit them classifies all three as weapons and cannot see that the game offers
  those particular weapons almost nothing. They are recorded in the fixture and exempted
  by name with their counts, never by a bare total, so a new disagreement fails a test
  instead of hiding in the allowance. Tracked at
  [#36](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/36).
- **Accommodation: the pre-engineered route.** Most Operations keys belong to a module
  bought already engineered, so no menu lists one and the menu check alone would refuse
  all 21 of them everywhere. (The four a menu *does* list are recipes a player rolls from
  grade 1 and need no accommodation; see §Engineering options.)
  `pre-engineered.jsonc` names which module each arrives on, so the gate accepts a recipe on
  the module that is sold carrying it and nowhere else:
  `RailGun_LongShot` resolves on the medium rail gun, not on the small one. What
  that buys is the **climb**, not the purchase: a Mercenary module arrives at grade 1
  and its recipe publishes grades 2–5, the grades an engineer can still add. It cannot
  reproduce the grade the module was sold at — all 22 Mercenary rows are grade 1, none of
  those recipes defines a grade 1, and the blueprint lookup refuses that call before the
  gate is reached — and it is not how a reward variant is recreated either, which
  `pre-engineered-stats` does from the variant's own `modifiers`. One of the 22, the
  Mercenary Module Reinforcement Package, has no engineering menu at all, so the gate asks
  what a module is *sold* with before it concludes the module takes nothing.

  **Every blueprint reaches at least one module; one experimental effect reaches none.**
  That one is `special_feedback_cascade`, which both registries have withdrawn (see
  §Engineering options), so refusing it everywhere is the right answer rather than a hole.
  The sweep behind the claim — every id in `BLUEPRINTS` and `EXPERIMENTAL_EFFECTS` against
  all 1197 module symbols, through the gate — is pinned whole in
  `fixtures/ships/engineering.json` under `reachability`, residue included, so an id
  stranded by a later change fails a test rather than passing unnoticed.
- **What it costs.** `ShipLoadout` carries the options catalogue whether or not the
  consumer opens a menu, plus `pre-engineered` for the route above: measured on the
  shipped `dist/`, its import graph is about 696 KB, 82 KB gzipped, against roughly
  624 KB / 74 KB for the same tree without them. That is the price of one answer to the
  two questions instead of two answers that can drift, paid deliberately.

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
      Lockdown by *size* and the twin `SeekerMissileRackMedium_Lockdown` binds to the medium
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
      an open question about the *module* catalogue, recorded here and not settled.
  - **Burst interval has to be added to the decoder's output by hand.** EDSY carries no
    journal Label for `bstint` — the journal reports the resulting `RateOfFire`, never the
    interval it comes from — so a straight decode drops it, leaving the 13 variants that
    change a burst pattern on the *stock* cadence, and four of them (the two frag cannons
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
  - **What resolves, and what cannot.** The module catalogues now carry the weapon stats
    too, so `Damage`, `MaximumRange`, `AmmoClipSize` and the rest resolve like everything
    else. `getPreEngineeredStats` resolves what it can and `unresolvedModifiers` reports
    the remainder rather than dropping it silently; only the Detailed Surface Scanner's
    variant, which changes scanner stats alone, resolves to no change at all — a set
    pinned in the fixture. Cross-checked against a known value: the 5A "FSD V1"
    resolves to 1785 optimal mass from the stock drive's 1050.
- **Not included:** engineered modules that are one-off mission or salvage rewards rather
  than a repeatable outfitting row. Those arrive in a build as their base symbol plus an
  `Engineering.Modifiers` block, which `ShipLoadout` already applies directly; there is no
  stable catalogue row to point at.

## Build-metric algorithms (power, shields, armour, weapons)

- **Files:** `typescript/src/ships/power.ts`, `shields.ts`, `armour.ts`,
  `resistances.ts`, `weapons.ts` and the `ShipLoadout` methods that feed them, validated
  by `fixtures/ships/build-metrics.json`.
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
  and the four resistances as *percentages of a multiplier*, and they compound on that
  multiplier rather than on the stat: a `+80%` bulkhead engineered by a `+32%` blueprint
  reads `137.6%` (`1.8 × 1.32 − 1`), and a `−20%` kinetic resistance with `+5%` reads
  `−14%` (`1.2 × 0.95` in damage-multiplier space). This is Frontier's `modmod`
  convention as EDSY documents it (`eddb.js` attribute table, `modmod: 100` / `-100`);
  it is verified against the shared `slef-the-deep-black.json` fixture, whose engineered
  armour carries exactly those values. `typescript/src/ships/module-stat-labels.ts`
  holds the per-label unit and algebra table.

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
where the build is used for metrics. The last three below pin no metric: two are evidence
for the outfitting *rules*, and what is checked against them is which module the game put
in which mount; the Cutter is evidence about *prices*, and what is checked against it is
that a build fitting an unpriceable module exports no module total and no rebuy.

**What may be taken, and from where.** A capture is Frontier game output — which parts a
player put in which slots — and it is redistributed here under Frontier's media-usage
terms, like every other value in this repository. It is *not* the work of the project it
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
  Caspian Explorer. Acquired earlier; see the jump-range note above. Zero weapons, so it
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
  Its credit figures are a purchase record rather than ground truth, and are pinned only
  as evidence of how far a build can sit from list price. Pinned by
  `fixtures/ships/slef-export.json` and `fixtures/ships/jump-range.json`.

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

  It is **the only ground truth for the catalogue's own numbers**. The Krait Phantom
  agrees with the game only once an engineered Long Range drive and a Guardian booster are
  folded in, so it proves the *engineered* path; nothing on this build is modified, so its
  `UnladenMass` 260.799988 (ours 260.8) and `MaxJumpRange` 21.951651 (ours 21.951648, both
  within 1e-4) are Frontier reading back the base module masses and the base FSD's
  `optMass` 525 / `maxFuel` 3 / `fuelMul` 0.012 / `fuelPower` 2.3 — the stats every other
  figure in this repository is built on. `CargoCapacity` 0 is exact, and with no rack
  fitted its laden and unladen jump are the same number.

  **Its credits read the price table wider than any other source.** All 20 priced modules
  sit at a flat **0.85** of catalogue list, each within a credit after the game's own
  rounding — 20 independent prices confirmed at once, across hardpoints, core internals
  and optionals. The hull is the counter-case that keeps the retail rule in place: the
  Krait's `HullValue` was its hull *with* stock fittings to the credit, while this one is
  246 650, **below** even the bare `hullCost` 312 797 and 0.85 of neither convention. Its
  own `Rebuy` 260 198 is not 5% of its own `HullValue` plus `ModulesValue` either (that
  truncates to 260 196). So a journal's credits are a purchase record however uniform they
  look. Pinned by `fixtures/ships/slef-export.json` (`viperMkIV`) and
  `fixtures/ships/jump-range.json`.

  **What it does not close:** shields, armour and weapon DPS. It carries four weapons and
  a shield generator, but a journal reports none of those figures — see
  <https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/12>.

- **`fixtures/ships/slef-inara-type-11.json`** — a real [Inara](https://inara.cz/) SLEF
  export of an engineered mining Type-11 Prospector (27 `Modules` entries), contributed
  **2026-08-04 UTC** by the repository owner from their own commander's fleet, which is
  the licence position: it is one player's build, shared by that player for this
  purpose, and like every other build here the loadout itself is Frontier game output
  redistributed under Frontier's media-usage terms. Source text SHA-256
  `3e008ea9b1226c49b6f7c080d897a4cbabbcbcc36ce83e58a293b397712279ee`; stored unmodified
  apart from re-indenting. The header's Inara commander and ship ids are kept as
  received, where the other Inara captures below have them scrubbed as a person's account
  details; bringing this one into line is the owner's call, so the two forms differ
  deliberately rather than by oversight.

  It is the **only external source that exercises the restricted mounts**, and it
  settles what nothing else could: Inara independently writes
  `largemininghardpoint1`, `mediummininghardpoint1`, `mediummininghardpoint2`,
  `mediumhardpoint3`, `smallmininghardpoint1`, `limpetcontroller01` and
  `fighterbay01` — this catalogue's keys character for character, once case is set
  aside. Its internals run `slot01_size6`…`slot05_size5`, then `slot06_size4`, so a
  restricted optional really does consume no `SlotNN` number, exactly as the numbering
  rule derived from EDSY says under §Ships. And its `mediumhardpoint3` carries a
  sub-surface displacement missile, confirming an *unrestricted* mount takes mining
  tools too.

  **Its credit figures are a purchase record, not ground truth**, and diverge three
  ways: the hull sits at a 2.5% shipyard discount, the modules at about 5.2% across 23
  priced entries, and Inara **rounds** its `Rebuy` where the game truncates (5% of its
  own hull plus modules is 5 613 800.75, which it states as `5613801`). The journal
  capture above is the authority on that convention, so this catalogue keeps
  truncating; the divergence is pinned as evidence rather than followed.

  **It is also the only fixture that exercises case-insensitive slot binding.** Inara
  lower-cases every slot key, as the SLEF specification's own example does, so a
  case-sensitive binding reports **no** occupied mounts on an Inara build and `setModule`
  on one adds a duplicate rather than replacing it. Nothing but an Inara-sourced export
  shows that: the other two ground-truth fixtures are an EDSY export and a journal
  capture, which both use Frontier's own casing. `ShipLoadout` and `parseSlotName` resolve
  a slot key whatever its casing. Keys are deliberately **not** canonicalised on import —
  a build keeps its producer's spelling, so this fixture
  re-exports its slot keys byte for byte — its *credits* deliberately do not survive a
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
  It carries three more cabins in *unrestricted* mounts (`slot01_size6`, `slot03_size4`,
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

  It is the **only capture that fits a module this catalogue cannot price**, and the
  first real evidence for the omit-rather-than-under-report rule, which until now only a
  hand-assembled build exercised. Five of its optionals are corrosion-resistant racks:
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
  Its size-5 rack reports `Value: 318174` and *both* size-6 racks report no `Value` at
  all — but its two size-4 racks are one module at one list price (94 330) reporting
  **82 774** and **91 970**, about 12.25% and 2.5% off. `Value` is therefore net of
  whatever discount applied, so no single reading recovers a list price, and a reward
  module was not bought at a station in the first place. The arithmetic is pinned in the
  same test so the rejection is a regression rather than a paragraph.

Two facts the Krait Phantom capture established that the EDSY export could not:

- **A journal lists far more than fitted modules.** 15 of its 40 entries are the
  cockpit, ship kit, nameplates, bobbles, paint, engine/weapon colours and voice pack.
  None is an outfitting module — this catalogue deliberately does not carry them — and
  all weigh nothing and cost nothing. They are recognised by slot: `parseSlotName`
  returns `null` for exactly these, and only for these.

  **That `null` is the whole test, and a second list was tried and dropped.**
  `ship-loadout.ts` briefly carried its own `COSMETIC_SLOT_PATTERNS` — eleven families
  named positively (cockpit, paint, decals, nameplates, bobbles, ship kits, colours,
  voice packs, string lights) so that an unfamiliar key was unknown rather than free.
  Only 15 of the 40 slots in this capture exercised it; the rest rested on the journal
  documentation, and the whole list was a hand-maintained copy of knowledge
  `parseSlotName` already holds in the other direction. It was removed: an article the
  catalogue cannot identify is free and weightless exactly when its key names no mount.
  The catalogue keeping the first say is what makes that safe — a fitted module it knows
  is priced and weighed whatever its slot is called, so the negative test is only ever
  reached by an article nothing recognises. What the change costs is a slot family the
  game has not shipped yet: a *new outfitting* mount holding a module absent from this
  catalogue now reads as free rather than unknown, where the pattern list would have
  omitted the figures. That was judged the better exposure, because the list's own
  failure mode — a decoration family added later silently taking `ModulesValue`,
  `UnladenMass`, `MaxJumpRange` and `Rebuy` off every build wearing it — landed on
  builds that are otherwise entirely computable, and needed a release to fix.
- **The two sources disagree about `HullValue`** — the game counts the hull's stock
  fittings inside it, EDSY does not. See the credits note below, which is why neither
  reading is carried through.

**Credits are quoted at retail, and a build's own figures are discarded.** `HullValue`
is the bare hull's `hullCost`, `ModulesValue` the sum of every fitted module's catalogue
list price, and `Rebuy` a flat 5% of the two, truncated. Nothing a source claims to have
paid is carried through, because what a build reports is one commander's purchase at one
station rather than a property of the build. Three observations from the corpus show how
far that can be from list:

- **Discounts are real and invisible.** The Deep Black's modules all sit at a uniform
  **0.8775** of list — a 12.25% outfitting discount — while its hull is at full price.
  The Viper Mk IV capture's 20 priced modules sit at exactly **0.85**, and its hull at
  neither its bare nor its retail price. Nothing in either source says so.
- **The two sources disagree about what `HullValue` means.** The game reports the hull
  *with its stock fittings* (coriolis `retailCost`, 37 472 252 for the Krait, matching
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

The upside is that the export becomes a pure function of the hull and the fitted module
symbols. Two builds with the same fit price identically whatever their owners paid; an
edit reprices exactly the module that changed; and a document always adds up, since each
module carries the same list price the total counted. Where a fitted module has no
published price the total is omitted rather than under-reported — 21 catalogue records
can trigger that today: the two unsold corrosion-resistant racks, the three Mk II
vessel hangars, `Int_ShieldGenerator_Size1_Class4`, `Int_Hyperdrive_Size8_Class{1..5}`
and the ten `*_free` starter variants.

Physical figures (`UnladenMass`, `CargoCapacity`, `FuelCapacity`, `MaxJumpRange`) are
recomputed too, and unlike the credits they **do** reproduce each source's own figures
exactly — which is what shows the recomputation is right rather than merely
self-consistent.

**Still missing external ground truth:** shields, armour and weapon DPS. A journal never
reports them — not even the Viper Mk IV capture, which carries four weapons and a shield
generator — and every weaponed build here is checked against our own maths. An EDSY or
Coriolis *reading* of a weaponed build would close that gap; the build corpus below does
not, because it pins figures this library computed rather than figures a tool published.

## Build corpus — `fixtures/ships/builds/`

181 community builds, 2–5 for each of the 48 hulls, as a breadth fixture: 4271 fitted
modules covering 558 distinct module symbols, and every hull's slot *layout* exercised by
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
  working tree, per AGENTS.md — what landed here is the decoded data.
- **What is deliberately not kept, and what that costs.** A build's own name, author and
  source link are **not** stored, on the maintainer's instruction that the sources need
  not be credited. State the consequence plainly against `data/SNAPSHOTS.md`, which asks
  that a source with no immutable version be preserved by content or checksum: each build
  file *is* the decoded content of its link, so the payload is preserved, but **no
  individual build can be traced back to the page it came from, or re-derived from this
  repository**. What remains auditable is everything that makes it a fixture — every
  build re-checks against the catalogues (slot exists, module fits, metrics reproduce),
  which `builds.test.ts` does on every run. Re-collecting the corpus means harvesting
  links afresh.
- **Validation.** Every build was assembled through `ShipLoadout` before selection: each
  module must resolve in the catalogues, its slot must exist on that hull and accept it,
  and all seven core internals must be filled. Builds that failed were dropped; the one
  systematic failure was the Type-11's missing mining hardpoints, a defect in this
  catalogue rather than in the builds, corrected under §Ships. Near-duplicates (>85%
  identical fit) were collapsed,
  and each hull's picks spread across the roles its builds cover.
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
  every future implementation must agree. Only the *builds* are external.
