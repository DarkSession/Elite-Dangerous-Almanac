# Data sources — `data/ships/`

**Library snapshot:** 2026-07-24, revised repeatedly since — most recently by a price correction on 2026-08-05, recorded with the other corrosion-rack price notes in "Modules (outfitting)". The dated `**Revision**` blocks below carry the larger passes; smaller corrections are recorded inline beside the field they touch, so this file rather than any count of it is the record. **Initial upstream revision:** not recorded. See `../SNAPSHOTS.md` for the update policy and known limitation.

**Revision 2026-08-05 (UTC), later the same day — the base stats blueprints modify are
now carried, so a real build can be engineered.** `applyBlueprint` refuses a recipe whose
base stats a module record does not hold, and 406 of the 1902 declared engineering entries
in `fixtures/ships/builds/` were being refused for exactly that: the most-used blueprints
in the game moved stats no record had. Thirteen stat fields are added and two backfilled;
after this pass every one of those 1902 entries resolves. Counts and spot values are
pinned in `fixtures/ships/module-stats.json` (`statCounts`, `spot`) and the corpus-wide
claim in `builds.test.ts`.

- **Sources.** EDSY `eddb.js` is the primary source for every field here — it is the only
  one of the two registries that carries the heat rates and the scanner stats at all. The
  file was re-read from `master` on 2026-08-05 (UTC) and is **byte-identical to the
  revision already recorded on this page**: SHA-256
  `967834d65a75ab1dea4bbaa7e1d6674cbe4083dca03f770d058497e9f7693071`, so the commit pin
  `cd68edfba665719958ce038b6e5d9eb02d0d2b02` still describes it. EDSY is (c) taleden under
  **CC BY-NC 4.0**; the values are Elite Dangerous game data, the property of Frontier
  Developments plc, redistributed under Frontier's media-usage terms. Cross-checked
  against [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) at the commit this
  domain already uses, `0db9234b5b9ce8c939ea84133d7ce336eea88e27` (`modules/**`,
  `modifications/modifierActions.json`, `modifications/blueprints.json`).
- **Which upstream field is which.** coriolis's `modifications/modifierActions.json` maps
  each journal Modifier Label to the field it moves, and is what settled the joins:
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
  against EDSY's `scbdur: 17.1` on the 8A cell bank, and EDSY's figure is kept as the more
  precise. coriolis carries **no** `thermload` on thrusters or drives despite naming the
  field in `modifierActions.json`, which is why EDSY is primary here.
- **Units, where the two disagree about them.** `scannerRange` is stored in **metres**
  throughout, which is what a journal reports and what EDSY stores; coriolis holds a
  sensor suite's as kilometres (`5.76` for the 8D suite, `5760` here) and a utility
  scanner's as metres. `probeRadius` is stored as a **percentage** (`20`), not a
  fraction: that is EDSY's form, coriolis's `proberadius: 0.2` is the other, and the
  journal capture already in this repository settles it — `fixtures/ships/journal-krait-phantom.json`
  reports the Detailed Surface Scanner's `DSS_PatchRadius` as `20` → `28` for a grade-4
  Expanded Probe Scanning Radius roll. `interdictorRange` is **seconds to intercept**, the
  unit the game measures a supercruise separation in, not a distance.
- **Two of the added stats duplicate a number the record already had, and that is
  deliberate.** A utility scanner's `scannerRange` is the same distance as its
  `maximumRange`, and a shield cell bank's `shieldBankHeat` the same figure as its
  `thermalLoad` — one upstream field each, read under two names. Dropping either would
  change what a consumer already reads, and dropping the new name would leave the sensor
  suites (which have no `maximumRange`) and the Pulse Wave Analyser (which has none
  either) modelled differently from their siblings. Both pairs are kept in step instead:
  `ScannerRange` and `ShieldBankHeat` each map to both fields in `module-stat-labels.ts`,
  so an engineered scanner or cell bank reads the same whichever field is asked.
- **Values no third-party registry lists, derived from the family rule.** Seven records:
  the three `*_free` starter fittings (thrusters, drive, sensors) and the five plain
  size-8 drives, plus the Mk II supercharge-optimised size-8 SCO drive. Each `*_free`
  record is byte-identical to its priced twin apart from the missing `cost`, so it takes
  that twin's value. A drive's heat rate is a function of its **size alone** across all 65
  records both registries do carry — 10, 14, 18, 27, 37, 43 for sizes 2 to 7, identical
  between the plain and SCO lines at every size — and the size-8 SCO drives are 50, so the
  size-8 plain drives and the Mk II booster take 50. Stated here as derivation, not as a
  reading: no registry publishes these eight figures.
- **`shotSpeed` and `reloadTime` needed almost nothing.** The 49 weapons with no
  `shotSpeed` and the 41 with no `reloadTime` are not gaps: they are the lasers, rail
  guns, Gauss cannons and mine launchers, which have no projectile to speed up and no clip
  to reload. Neither registry publishes a figure, and EDSY's per-family `modifiable` lists
  say outright that the game does not move those stats on those weapons. The **two** real
  omissions were the medium Seismic Charge Launchers, fixed and turreted, whose
  `reloadTime` of 1 s EDSY carries (`rldtime`) and this catalogue had dropped; both are
  filled. Nothing was invented for the other 88.
- **`EnergyPerRegen` needed no data at all.** All 57 shield generators already carried
  `distributorDraw`, and EDSY (`genpwr`) and coriolis (`distdraw`) both confirm it is the
  same stat under the journal's other name. It was a missing line in the label map, not a
  missing value, and it alone accounted for 36 of the 406 refusals.
- **`refuelRate` is not on issue #10's list**, which was measured from the corpus and no
  corpus build carries a fuel-scoop recipe. It is the same defect — `recipe_fuelscoop_efficiency`
  moves `RefuelRate` and no record held one — so it is closed here rather than left as the
  last hole of its kind. Stored in tonnes per second (EDSY `scooprate`); coriolis's `rate`
  is the same figure in kilograms.
- **What is still refused, and why that is right.** Two things, after this pass. A stat a
  record declares **unknown** — the Resource Siphon controller's mass, the withdrawn
  Discovery Scanners' power draw — still refuses every recipe that scales it, because
  nothing can be scaled from an unknown. And `GuardianModuleResistance` refuses
  everywhere, because it is not a number: EDSY stores Anti-Guardian Zone Resistance as a
  flag the recipe *grants*, and this record shape has no field for it
  ([issue #27](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/27)). Beyond
  base stats, 76 corpus entries are still refused for a target-family mismatch, which is a
  mapping defect rather than a data one
  ([issue #14](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/14)).
- **A hull reinforcement package's hull boost is computed, not stored.** Its
  `DefenceModifierHealthMultiplier` leg used to be refused as a missing base stat. It is
  not one: a percentage-of-a-multiplier stat has no absent state, because no hull boost is
  a ×1 multiplier — 0% — and EDSY says so explicitly (`hullbst`, `default: 0`,
  `modmod: 100`). The calculator now compounds from that zero, which is why a package can
  be engineered to a hull boost it never had and why a journal reports the leg with
  `OriginalValue: 0`. No value was added to any record for this.

**Revision 2026-08-05 (UTC) — the stats no source carries are now stated as unknown.**
No value was added, changed or removed: this revision is a *classification* of the three
gaps the 2026-08-02 pass left open. Five module records gain an `unknownStats` field
naming the stats they omit because the value is unknown, so a program can tell an
absence that means "the module has no such stat" from one that means "nobody publishes
it". Derivation is this repository's own reconciliation: each entry restates a finding
the 2026-08-02 revision below already made against coriolis-data (commit
`0db9234b5b9ce8c939ea84133d7ce336eea88e27`) and EDSY `eddb.js` (commit
`cd68edfba665719958ce038b6e5d9eb02d0d2b02`, SHA-256
`967834d65a75ab1dea4bbaa7e1d6674cbe4083dca03f770d058497e9f7693071`) — that neither
registry carries the value. No source was re-acquired or fetched for this revision.

- **Declared unknown (2 fields, 5 records).** `powerDraw` on the four
  `Int_StellarBodyDiscoveryScanner_*` records, and `mass` on
  `Int_DroneControl_ResourceSiphon`. Both are argued at length below and neither has a
  source; the record names them so the absence is a statement rather than a silence.
  Filling one means deleting its name in the same change — `unknown-stats.test.ts`
  fails on a declared field that has a value.
- **On the record, not in a register beside it.** An earlier draft of this revision put
  the five in a payload of their own, `data/ships/unknown-stats.jsonc`, joined back by
  symbol. That reintroduced exactly the join this domain removed when identity and stats
  were merged into one record: a consumer holding the `undefined` had to know a second
  file existed to interpret it, and the register could name a symbol the catalogue did
  not carry. The field lives on the record instead, where the missing stat is, and the
  schema's `module` definition carries it. `ships/unknown-stats` is now a data-free
  predicate over that field rather than a catalogue.
- **What that changes for a build.** `ShipLoadout.powerBudget()` used to skip a module
  with no `powerDraw`, which is right for a cargo rack and wrong for a Discovery
  Scanner: the build read as having headroom it may not have. Such a module is now
  reported in `PowerBudget.unknownDraws` and left out of every total, so the totals are
  an explicit lower bound instead of a confident understatement. Mass already behaved
  this way — one unknown module mass withholds `unladenMass` entirely — and is unchanged.
- **`integrity` on the 83 non-armour records that lack it is *not* declared**, because
  the evidence says those families do not have the stat: no registry publishes one and
  the game's own module panel shows none. It is recorded instead as a pinned set,
  `fixtures/ships/module-stats.json` `withoutIntegrity`, which fails if the membership
  ever changes. Guardian hull reinforcement packages are in that set and do draw power,
  so "no integrity" is not a shorthand for "inert".
- **`cost` is deliberately never declared.** Every module without a price has no
  *published* price, so an absent `cost` is already unambiguous (README, list prices);
  there is nothing to disambiguate.
- **Scope.** The field can only name stats the record shape has. The base stats
  blueprints modify that no record carried at all — `EngineHeatRate`, the scanner ranges
  and the rest — were sourced by the revision above, which also made this distinction
  load-bearing: a recipe that scales a stat a record simply omits is now inert, while one
  that scales a stat named here is refused. One journal label is still unmodellable, and
  it is a capability rather than a number:
  [issue #27](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/27).

**Revision 2026-08-04 (UTC) — a restricted mount is now stored as one, and the journal
names it by.** A hull's `hardpoints` was a bare array of sizes, so there was nowhere to
record that four of the Type-11 Prospector's eight mounts take mining tools and nothing
else; `optional` had the field but only two of its values. Both are now arrays of
`{ size, restriction? }`, and `restriction` takes six values: `mining` on a hardpoint,
and `military`, `planetaryApproachSuite`, `cargo`, `limpetController` or `vesselHangar`
on an optional.

**No value here was inferred from one source.** Both registries this domain already
uses carry the rule, at the revisions already recorded above — nothing new was
acquired, so no new snapshot metadata applies:

- [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) **commit
  `0db9234b5b9ce8c939ea84133d7ce336eea88e27`** writes a restricted mount as an object
  rather than a bare size: `ships/type_11_prospector.json` has
  `{ "class": 3, "name": "Mining", "eligible": { "abl": 1, "ml": 1, "mvr": 1, "pwa": 1,
  "scl": 1, "sdm": 1 } }` for the large mount and `{ "class": 5, "name": "Limpets", … }`
  / `{ "class": 5, "name": "Fighter", "eligible": { "fh": 1 } }` for two of its
  optionals, and `ships/panther_clipper.json` has the same `"name": "Cargo"` object with
  `"eligible": { "cr": 1, "crl": 1, "ft": 1 }` on its first size-8 mount and on its
  first size-**7** — not on the two size-8s.
- [EDSY](https://github.com/taleden/EDSY) `eddb.js` (the same file already used on
  2026-08-02: internal `db 20260428`, SHA-256
  `967834d65a75ab1dea4bbaa7e1d6674cbe4083dca03f770d058497e9f7693071`) carries the same
  rule as a per-slot `reserved` map — `{hmtl:1,hmtm:1}` on the Type-11's mounts 0, 1, 2
  and 4, `{iclc,idlc,iftlc,ihblc,imlc,iplc,inlc,irlc,islc}` and `{ifh:1}` on its two
  restricted optionals, `{cft:1,icr:1}` on the Panther's two.

The two agree mount-for-mount. They differ on exactly one entry: coriolis lists `pwa`
(the Pulse Wave Analyser) as eligible for a mining hardpoint. It is a **utility**
fitting in both registries and in this catalogue, and no utility module fits a
hardpoint of any kind, so the difference is a grouping artefact and is not stored.
Coriolis's `sdm` group and EDSY's `hmtm` both include the Sub-Surface Extraction
Missile (`Hpt_Human_Extraction_Fixed_Medium`) alongside the displacement missile it
varies, so it counts as a mining tool despite its unrelated symbol.

**The journal names a restricted mount differently, which the earlier note assumed it
did not.** EDSY's `ship[…].slotnames` gives the Type-11 `LargeMiningHardpoint1`,
`MediumMiningHardpoint1`, `MediumMiningHardpoint2`, `MediumHardpoint3`,
`SmallMiningHardpoint1`, `SmallHardpoint2..4` and, for its internals,
`LimpetController01` and `FighterBay01`; the Panther Clipper Mk II gets `Cargo01` and
`Cargo02`. These are journal names, not EDSY's own: `edsy.js` reads them in
`Build.fromJournal()` and writes them in `exportJournal()`, and its journal import map
lists `HUGEMININGHARDPOINT`, `LARGEMININGHARDPOINT`, `MEDIUMMININGHARDPOINT`,
`SMALLMININGHARDPOINT`, `CARGO`, `LIMPETCONTROLLER` and `FIGHTERBAY` as slot-name
prefixes it must recognise. Two numbering rules follow from the lists, and both are
reproduced by `enumerateSlots`:

- a restricted **hardpoint** shares the per-size-class numbering with the unrestricted
  ones and only takes an infix, so the Type-11's four medium mounts run
  `MediumMiningHardpoint1`, `MediumMiningHardpoint2`, `MediumHardpoint3`;
- a restricted **optional** takes a name and number of its own and does **not** consume
  a `SlotNN` number, exactly as `Military01` and `PlanetaryApproachSuite` already did —
  so the Panther's column runs `Cargo01`, `Slot01_Size8`, `Cargo02`, `Slot02_Size7`, …

Both hulls' full enumerated key lists are pinned in `fixtures/ships/ship-slots.json`
under `keys`, and the two hulls' layouts under `spot`, so a port produces the same
vocabulary. **Which module families each restriction accepts is pinned there too**,
under `restrictions`: one entry per restricted mount naming modules it must accept and
modules it must refuse, plus one unrestricted mount for contrast. That is a fact about
the game rather than about any implementation, so it belongs in the shared fixtures and
not only in the TypeScript prefix lists. The six corpus builds on these hulls
(`fixtures/ships/builds/lakonminer-mining*.json`, `panthermkii-trade*.json`) were
re-slotted onto the corrected keys; every one of them already had its modules in
mounts the restrictions allow, so no build's fit changed and no pinned metric moved.

Alongside this, two families gained a `restrictedToShips` they should already have had.
Both are missing values, not a new feature — `Int_MultiDroneControl_MiningV2_Size5_Class5`
already carries the field the same way:

- the three **Mk II Vessel Hangars** → `["Explorer_NX", "PantherMkII", "LakonMiner"]`,
  which this file had recorded in prose since the Operations pass. EDSY has no record
  for the Mk II bays at all, so their hull restriction still rests on Frontier's update
  notes and Inara, as it did when the records were added.
- the two **Mk II Cargo Racks** (`Int_LargeCargoRack_Size{7,8}_Class1`) →
  `["PantherMkII"]`, from both registries: EDSY marks them `reserved:{63:1}` (ship 63
  is the Panther Clipper Mk II) and coriolis-data describes them as a "Panther Clipper
  storage rack". Without it they fitted **any** hull's size-7 or size-8 optional, which
  a review caught by building a Type-9 that carried one. The sources say something
  stronger still — that they fit only a *cargo-restricted* mount, so even the Panther's
  own unrestricted size-8 should refuse one — and that half needs a module-side field
  this catalogue does not have; it is recorded in
  [issue #11](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/11) rather
  than approximated.

**Revision 2026-08-02 (UTC) — every module now carries stats, and 40 records were
corrected.** The four module catalogues were reconciled against
[EDSY](https://github.com/taleden/EDSY) `eddb.js` (commit
`cd68edfba665719958ce038b6e5d9eb02d0d2b02`, its internal `db 20260428`, SHA-256
`967834d65a75ab1dea4bbaa7e1d6674cbe4083dca03f770d058497e9f7693071`, acquired 2026-08-02
UTC), which carries a mass, integrity, power draw and boot time for nearly every
outfitting module that coriolis-data leaves blank. Every value applied here either comes
from EDSY or was confirmed against it; where a candidate correction disagreed with EDSY,
EDSY won and the change was dropped — three were **rejected** on that basis, listed
below. The payloads touched are `data/ships/modules-*.jsonc`, plus one display name each
in `blueprints.jsonc` and `experimental-effects.jsonc`.

**Coverage, stated plainly.** EDSY carries 677 of the 717 `bootTime` values, 223 of 237
`integrity`, 104 of 115 `powerDraw`, and **contradicts none of them** — every value it
does supply matches what is stored here. That leaves **110 values across 50 records**
EDSY does not supply. Two things count as "does not supply", and they are not the same:

- **12 records have no EDSY entry at all** — nine of the ten `*_free` starter fittings
  (`Int_PowerPlant_Size2_Class1_free`, `Int_Engine_Size2_Class1_free`,
  `Int_Hyperdrive_Size2_Class1_free`, `Int_LifeSupport_Size1_Class1_free`,
  `Int_PowerDistributor_Size1_Class1_free`, `Int_Sensors_Size1_Class1_free`,
  `Int_FuelTank_Size1_Class3_free`, `Int_CargoRack_Size2_Class1_free`,
  `Int_StellarBodyDiscoveryScanner_Standard_free`) and
  `Int_FighterBayMk2_Size{5,6,7}_Class1`.
- **38 records EDSY lists but leaves the particular field blank.** Blank is the operative
  word: several of these entries are commented-out definitions with some values filled in
  and others left empty, and the filled ones count. `Int_Hyperdrive_Size8_Class{1..5}`
  state `boottime`, `fuelmul` and `fuelpower` — only mass, integrity, power draw,
  optimal mass and max fuel are blank. `Int_DetailedSurfaceScanner_Tiny` is missing boot
  time alone. The rest are `ModularCargoBayDoor`, `Int_ShieldGenerator_Size1_Class4` and
  the Guardian hull, module and shield reinforcement families, all missing boot time.

`Int_DroneControl_ResourceSiphon` is **not** in that set: EDSY gives it an integrity, a
power draw *and* a boot time. Only its mass is unaccounted for, and that is left absent
rather than guessed — see below. `Int_ShieldGenerator_Size2_Class1_free` is not in it
either; EDSY carries that record in full, including its resistances and the distributor
draw it spells `genpwr`.

Of the 110, **108 were read from the live game's own outfitting and module panels**
(2026-08-02 UTC), the same route this file already uses for the in-game blueprint and
Operations registries. The remaining **two are derived, not read**:
`Int_FuelTank_Size1_Class3_free`'s `fuelCapacity` and
`Int_CargoRack_Size2_Class1_free`'s `cargoCapacity` follow from capacity being exactly
2^size across all eight sizes of both families, with no exception.

**All 110 are pinned individually** in `fixtures/ships/module-stats.json` `spot`, so a
port validates against the same numbers and a silent drift fails a test — that is the
only guard these values have, since they cannot be re-fetched from a public source. Each
is also independently consistent with its own family's curve: the size-8 drives extend
the size-7 ladder, and every `*_free` variant matches its paid twin wherever the twin has
a value.

- **Backfilled (a field the record did not have, so no value was overwritten):**
  `bootTime` on 717 records, `integrity` on 237, `powerDraw` on 115, `mass` on 16, and
  the family curves on the rows that had none — `optMass`/`maxFuel`/`fuelMul`/`fuelPower`
  on 6, the thruster and shield mass curves on 2 each, the distributor capacities and
  recharges on 1, and `powerCapacity`/`heatEfficiency` on 1, plus the three `*_free`
  completions described below. **Every module in every
  catalogue now has at least one stat** (1198/1198), so `fixtures/ships/module-stats.json`
  `counts` now equals the catalogue sizes — and no record is left holding only a lone
  `mass`.
- **Closes the tracked gap "Modules still missing `mass`, deliberately" for all but one
  record.** The ten `*_free` starter variants,
  `Int_Hyperdrive_Size8_Class{1..5}` and `Int_ShieldGenerator_Size1_Class4` had `mass`
  left absent because absent meant *unknown*. They are now sourced.
  `Int_DroneControl_ResourceSiphon`, the eleventh, is **not** — see below. All but
  `Int_ShieldGenerator_Size1_Class4` were identity-only rows; that one already carried a
  12-field hand-filled curve, and it was **confirmed unchanged** — its `optMass` 25 /
  `minMass` 13 / `maxMass` 63 and 0.6-1.1-1.6 multipliers match the reference figures
  exactly, which retrospectively validates that hand-fill.
- **Fills 102 of the 106 records in the tracked gap "106 modules are missing
  `powerDraw` that upstream carries".** The fuel scoop, AFM unit, refinery and docking
  computer families are complete. The four `Int_StellarBodyDiscoveryScanner_*` records
  are **not** filled: no source carries a power draw for them — EDSY gives them only
  `mass` and `integrity`, and coriolis-data has no record for them at all. They are withdrawn modules whose function is now built in, and
  the absence is left as *unknown* rather than guessed at zero. Recorded in
  [issue #17](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/17).
  The part that is closed is the defect the item was written about: the Deep Black's 7A
  fuel scoop, 6A AFM unit and advanced docking computer now draw the 4.68 MW it
  predicted, so its `retracted` budget moves 14.8159 → 19.4959 MW and its headroom
  8.0321 → 3.3521 MW. `fixtures/ships/build-metrics.json` is re-pinned; the build stays
  within budget.
- **`Int_DroneControl_ResourceSiphon` keeps no `mass` — deliberately.** An earlier draft
  of this revision set it to `0` on the grounds that EDSY omits the field and reads a
  missing mass as zero, the same way this catalogue treats
  `Int_DetailedSurfaceScanner_Tiny` and `Int_DockingComputer_Standard`. That was wrong to
  apply here: no source states the zero, and unlike those two there is no uniformity to
  appeal to — every sized limpet controller in the family has a real, non-zero mass. A
  written-down inference is still an inference, and `absent` has to keep meaning
  *unknown*. Its `integrity` 20 and `powerDraw` 0.4 do come from EDSY and are kept. The
  outstanding mass is recorded in
  [issue #17](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/17).
- **The three `*_free` starter fittings that were still hollow are now complete.**
  `Int_ShieldGenerator_Size2_Class1_free` gains `shieldRegenRate` 1,
  `shieldBrokenRegenRate` 1.6, the resistances 0.4 / −0.2 / 0.5 and `distributorDraw`
  0.6 — **all six straight from EDSY**, which carries that record in full (as
  `genrate`, `bgenrate`, `kinres`/`thmres`/`expres` as whole percentages, and `genpwr`
  for the distributor draw). An earlier draft of this revision justified them by
  rating-level uniformity instead, which produced identical numbers but understated the
  provenance; the uniformity is real — all eight E-rated generators share those
  resistances — but it is not what these values rest on.
  `Int_FuelTank_Size1_Class3_free` gains `fuelCapacity: 2` and
  `Int_CargoRack_Size2_Class1_free` `cargoCapacity: 4`, and **those two genuinely are
  derived**: EDSY has no entry for either record, but capacity is exactly 2^size across
  all eight sizes of both families with no exception, so the value follows from the
  record's own `class`. Without all three a stock starter fit reported 0 t of fuel, 0 t
  of cargo and 0/0/0 shield resistances.
- **Cost:** the four catalogues grow about 24 KB of raw JSON (+5.6%), which is inlined
  into every consumer's bundle. 244 of the 717 `bootTime` values are `0` (every hardpoint
  among them). They are kept rather than omitted because this catalogue's convention is
  that an absent field means *unknown* — collapsing a real zero into absence is the
  defect the `cost` handling already guards against.

**Corrected — 40 records, 43 fields.** In every case coriolis-data's value is the source
of the error and EDSY carries the corrected figure:

| Records | Field | Was | Now | Why the old value was wrong |
| --- | --- | --- | --- | --- |
| `Int_GuardianPowerDistributor_Size{1,4,5,6,7,8}` | `integrity` | 56 | 35/70/99/99/115/132 | 56 is size 3's value, repeated across six sizes |
| `Int_GuardianPowerDistributor_Size3` | `weaponsCapacity`/`weaponsRecharge` | 13 / 3.1 | 17 / 3.9 | copied from an adjacent size |
| `Int_GuardianPowerDistributor_Size4` | `systemsCapacity`/`systemsRecharge` | 14 / 1.7 | 17 / 2.5 | copied from an adjacent size |
| `Int_Sensors_Size1_Class{1..5}` | `integrity` | 46/41/51/61/56 | 36/32/40/48/44 | coriolis's size-1 row is a verbatim copy of its size-2 row; size 1 is the only mismatching size in the family |
| `Int_PowerDistributor_Size1_Class{1..5}` | `integrity` | 46/41/51/61/56 | 36/32/40/48/44 | same duplicated-row defect |
| `Int_Hyperdrive_Overcharge_Size7_Class2` | `integrity` | 2700 | 150 | `optMass` copied into `integrity`; every sibling drive is 131–164 |
| `Hpt_Slugshot_{Fixed,Gimbal,Turret}_Medium` | `integrity` | 80 | 51 | 80 is the huge-mount value |
| `Hpt_Slugshot_{Fixed,Gimbal,Turret}_Large` | `integrity` | 80 | 64 | as above; the catalogue already had 64 on `Hpt_Slugshot_Fixed_Large_Range` |
| `Hpt_PulseLaserBurst_Gimbal_Huge` | `integrity` | 80 | 64 | a real outlier, not the Fragment Cannon rule misapplied — see "Values that look wrong and are not" below |
| `Hpt_HeatSinkLauncher_Turret_Tiny` | `integrity` | 20 | 45 | 20 is the chaff launcher's; the Caustic Sink Launcher, its analogue, is 45 in both sources. Same duplicate-record defect as the `cost` fix in the previous revision, which had been applied to `cost` and `mass` but not `integrity` |
| `Hpt_MRAScanner_Size0_Class1` | `integrity` | 24 | 32 | every other size-0 scanner family runs 32/24/40/56/48; 24 had been duplicated into Class1 |
| `Int_DroneControl_{FuelTransfer,Prospector,Repair}_Size5_Class4` | `powerDraw` | 0.97 | 0.72 | 0.97 is the size-7 B-rated value; 0.72 restores the Class4/Class1 ratio the family holds elsewhere (1.78 at sizes 1 and 3, 1.76 at size 7, 1.80 here) |
| `Hpt_Mining_SubSurfDispMisle_Turret_Small` | `powerDraw` | 0.42 | 0.53 | |
| `Int_ShieldGenerator_Size1_Class5_Strong` | `mass` | 2.5 | 2.6 | Prismatic is exactly 2× the base generator at every other size, so size 1 is 2×1.3, not half of size 2's 5.0 |
| `Int_ShieldGenerator_Size2_Class5_Strong` | `minMass` | 23 | 28 | |
| `Int_MetaAlloyHullReinforcement_Size1_Class2` | `mass` | 2 | 1 | |
| `Int_Engine_Size3_Class5` | `integrity` | 72 | 70 | |
| `Int_Powerplant_Size5_Class4` | `integrity` | 114 | 115 | |
| `Int_FSDInterdictor_Size2_Class2` | `integrity` | 51 | 31 | |
| `Int_StellarBodyDiscoveryScanner_{Standard,Intermediate,Advanced}` | `mass` | 0 | 2 | the previous revision set all three to 0 as part of the massless-modules pass. They are not massless: EDSY retains all three in its "removed, now built-in" block at `mass: 2.00`. Their `class` stays 1, per FDevIDs |

**Rejected — three candidate corrections that cross-checking threw out.** Recorded so
they are not "found" and applied again:

- **`Int_GuardianShieldReinforcement_*` `integrity` is genuinely 36 on all ten records.**
  A flat value across five sizes and two classes looks exactly like a placeholder, and a
  reference figure suggested a rising 36→72 curve, but EDSY independently
  carries 36 for all ten. Applying the curve would have corrupted correct data.
- **`Int_Engine_Size{2,3}_Class5_Fast` multipliers stay 1.15 / 1.367.** EDSY stores
  thruster multipliers as whole percentages (`engoptmul:115`), so it agrees on 1.15 and
  cannot represent 1.367 at all; the catalogue's value is the more precise one.
- **Thruster and FSD mass-curve fractions stay fractional (placeholder).** `Int_Engine_Size4_Class2`
  `minMass` 157.5 / `maxMass` 472.5, `Int_Engine_Size4_Class4` 192.5 / 577.5 and
  `Int_Hyperdrive_Size4_Class4` `optMass` 437.5 are exact — `optMass/2`, `optMass×1.5`
  and `350×1.25`. The whole numbers are a rounding artefact of a source that stores these
  fields as integers, so applying them would have *introduced* error.

**Values that look wrong and are not.** Three records break the pattern their family
follows, were challenged on exactly that basis during review, and were then confirmed
outright by EDSY at the revision above. Recorded so the "breaks its family's curve"
heuristic does not keep rediscovering them:

- **`Hpt_PulseLaserBurst_Gimbal_Huge` `integrity` really is 64**, and it really is the
  only huge (class-4, 16 t) hardpoint not at 80 — its own fixed sibling is 80. EDSY gives
  `integ:64` for it and 80 for the other eleven. Note that EDSY also gives it
  `maxbrc: 80`, which is max **breach** damage and is easy to misread as the integrity.
- **`Int_GuardianPowerDistributor_Size{5,6}` `integrity` really are both 99.** Guardian
  distributor integrity otherwise tracks 0.80× the A-rated standard ladder, which would
  put size 5 near 85; EDSY states 99 for both sizes. The duplicate is in the game data.
- **`Int_DroneControl_Recon_Size5_Class1` `bootTime` really is 9.85** — the only
  non-integer boot time in all 1198 records, where its three family siblings are exactly
  10. EDSY gives `boottime:9.85`.

Two display names were corrected, each one EDSY carries and this catalogue had wrong:
`CargoRack_IncreasedCapacity` "Expanded Capacity" → **"Expanded Cargo Rack"**, and
`special_choke_canister` "Ion Disruptor" → **"Ion Disruption"**. The other blueprint
names were checked and deliberately left alone — see "Display names" below.

**Revision 2026-08-01 (UTC) — completeness pass over the outfitting and engineering
catalogues.** The four module catalogues, `blueprints.jsonc` and
`experimental-effects.jsonc` were re-checked against
[EDSY](https://github.com/taleden/EDSY) `eddb.js` (commit
`882a67ee03b69a05e139134a153d8c7c18e60250`, acquired 2026-08-01 UTC) and the in-game /
[Inara](https://inara.cz/elite/blueprints/) blueprint and experimental-effect registries,
looking for records those sources carry that the earlier FDevIDs/coriolis-data join had
dropped. Every value below comes from EDSY or the in-game registry. Added:
`Int_ShieldGenerator_Size1_Class4`, `recipe_guardianweapon_sturdy`,
`special_feedback_cascade`. Corrected: `special_feedback_cascade_cooled`,
`special_plasma_slug_cooled`, `special_super_penetrator_cooled` and
`special_incendiary_rounds`, each of which had lost modifiers its EDSY source carries.
Ship hulls were checked and needed no change.

**Revision 2026-08-01 (UTC) — defence, power and weapon stats, and the bulkhead move.**
The four module catalogues gained the stats the build calculations need: the four damage
resistances, hull and shield reinforcement, module protection, the `alwaysPowered` flag,
and the weapon stats (damage and its type split, rate of fire, clip and reload,
distributor draw, thermal load, piercing, ranges, shot speed, jitter). Source:
[EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) at the same commit
`0db9234b5b9ce8c939ea84133d7ce336eea88e27` already used for the other stats (see
"Modules" below for the field mapping, the derivations, and the three values filled by
hand). In the same pass each hull's **`bulkheads` list moved
out of `ships.jsonc` and onto its `<Hull>_Armour_*` records** in
`modules-core.jsonc`: armour is a module like any other, so its mass, hull boost and
resistances now live with every other module's stats instead of being duplicated on the
hull.

Attribution for the ship and outfitting data files in this directory. This file
is the long form; each data file also repeats its own credit in a comment header,
so the provenance meets you where you meet the data.

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
- **Identity source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), the
  community-maintained registry of Frontier's internal ids and names (`shipyard.csv`,
  columns `id,symbol,name,entitlement`). FDevIDs states no explicit licence; consult
  the repository terms before redistributing the raw identifiers.
- **Identity derivation:** records are carried over in shipyard order (roughly the
  order hulls were introduced): internal `symbol` and display `name`. The CSV's
  numeric ship-type `id` column is dropped — hulls are keyed by `symbol`.
  `entitlement` is FDevIDs' DLC/grant token, kept only where the CSV gives one (28 of
  the 48 hulls carry no entitlement, so the field is omitted rather than stored empty).
- **Stats + slots source:** [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data),
  `ships/*.json` (`properties` for stats, `slots` + `bulkheads` for the layout),
  **commit `0db9234b5b9ce8c939ea84133d7ce336eea88e27`** (`master`, acquired 2026-07-24
  UTC). Coriolis-data's `LICENSE.md` releases only its _code_ under MIT; the JSON
  **stat/slot values are Elite Dangerous game data, the property of Frontier
  Developments plc**, redistributed here under Frontier's media-usage terms.
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
  entries); `slots.internal` becomes `optional`. A `hardpoints` or `optional` entry is
  a `{ size }` with an optional `restriction` — see the 2026-08-04 revision above for
  the six restriction values and where each comes from. Coriolis's per-hull
  `bulkheads` are **not** kept on the hull: they are joined onto that hull's armour
  modules instead (see "Modules"), because armour is a module and the catalogue keeps a
  module's stats with the module. **Slot keys** are journal-compatible
  (`FrameShiftDrive`, `HugeHardpoint1`, `TinyHardpoint2`, `Slot01_Size6`, `Military01`,
  `PlanetaryApproachSuite`), so a build assembled from an empty hull and one loaded
  from a SLEF export share one vocabulary. See `typescript/src/ships/slots.ts`.
- **Manual correction, 2026-08-02 — the Type-11 Prospector's four mining hardpoints.**
  The hull carried `hardpoints: [2, 1, 1, 1]`; it has eight mounts, not four. Coriolis
  writes a *restricted* hardpoint as an object (`{ "class": 3, "name": "Mining",
  "eligible": {…} }`) rather than a bare size, and the Type-11 is the only hull in
  coriolis-data that has any, so acquisition's "non-zero numbers are weapon mounts" rule
  silently dropped its 3/2/2/1 mining mounts — leaving the game's dedicated mining hull
  with nowhere to fit a mining tool, and no large mount at all for
  `Hpt_MiningToolV2_Fixed_Large` — which is itself `restrictedToShips: ["LakonMiner"]`,
  so it was unfittable on the only hull that may carry it. Corrected to
  `[3, 2, 2, 2, 1, 1, 1, 1]`, which three sources agree on: coriolis-data (commit as
  above), EDSY's `eddb.js` (database version `423039901`, last modified `20260428`;
  `ship[…].slots.hardpoint = [3,2,2,2,1,1,1,1]`) and
  [Inara's ship page](https://inara.cz/elite/ship/68/), read 2026-08-02, listing 1 Large
  Mining, 1 Medium, 2 Medium Mining, 3 Small and 1 Small Mining. The four unrestricted
  mounts are exactly the `[2, 1, 1, 1]` the record already had. The mining restriction
  itself was **not** stored at the time — the slot schema had no hardpoint restriction —
  so the catalogue said only that the mounts exist and how big they are. Closed by the
  2026-08-04 revision above.
- **Lynx Highliner (`MediumTransport01`) — from EDSY + Frontier's Lynx update notes:**
  the Lynx has no coriolis hull entry, so its stats and slot layout are sourced instead
  from EDSY's ship data and Frontier's Lynx update notes (hull mass 260 t, 285/350 m/s,
  200/350 base shield/armour, hardness 55, 2 crew, rotation 26/60/19 deg/s, min thrust
  73.75%; core PP5/thr6/FSD5/LS6/dist5/sen3/tank5; hardpoints 1 large + 4 medium;
  4 utilities; optionals 6/6/6/5/5/4/4/3/2/1; its five armour options at 0/26/53/53/53 t,
  carried on the `MediumTransport01_Armour_*` module records). Values
  the static catalogue does not expose are omitted rather than invented: `masslock`,
  `heatCapacity`, `pipSpeed`, acceleration, and the min-pitch / boost-energy figures.
  The two size-6 and one size-5 passenger-reserved optionals are stored as plain
  optional slots: the schema now carries slot restrictions (2026-08-04, above), but
  no passenger value, because the journal names for those three mounts are the one
  restricted family EDSY's own import map does not claim — see
  [issue #11](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/11).

## Modules (outfitting)

Each module is **one record** carrying its identity and its stats — identity from
FDevIDs, stats from coriolis-data, joined on `symbol`.

- **Files:** `modules-core.jsonc`, `modules-internal.jsonc`,
  `modules-hardpoint.jsonc`, `modules-utility.jsonc`, and `fixtures/ships/modules.json`,
  `module-stats.json` (the stats half keeps its own parity fixture). Split along
  FDevIDs' four outfitting categories so an app that only wants weapons never bundles
  the 1003 core and optional internals; see AGENTS.md §Build.
- **Identity source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), `outfitting.csv`
  (columns `id,symbol,category,name,mount,guidance,ship,class,rating,entitlement`),
  same licence note as above.
- **Identity derivation:** the 1190 FDevIDs modules are carried over in CSV order within
  each category file (the Operations/Lynx additions and the 1B shield generator below bring
  the internal catalogue to 483, all four to 1198). The CSV's numeric `id` column is dropped — modules are keyed by
  `symbol`. `class` is FDevIDs' `class` — the module size (0–8) — and `rating`
  its grade letter (A–I); together they are the "5A" the outfitting screen shows.
  `mount` (Fixed / Gimballed / Turreted) and `guidance` (Dumbfire / Seeker / Swarm)
  are stored only on the hardpoints that carry them; `ship` names the hull an armour
  variant belongs to (armour is the one ship-specific module, so only the 241 armour
  records carry it); `entitlement` is kept only where it is a real DLC/grant token.
- **Stats source:** [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data),
  `modules/**`, **commit `0db9234b5b9ce8c939ea84133d7ce336eea88e27`** (`master`,
  acquired 2026-07-24 UTC). Coriolis-data's `LICENSE.md` releases only its _code_
  under MIT; the JSON **stat values are Elite Dangerous game data, the property of
  Frontier Developments plc**, redistributed under Frontier's media-usage terms.
- **Stats derivation:** acquisition normalisation looks up each module's coriolis
  record by `symbol` (case-insensitively) and copies a fixed whitelist of fields under
  clearer names — e.g. coriolis `optmass`→`optMass`, `fuelmul`→`fuelMul`,
  `pgen`→`powerCapacity`, `wepcap`→`weaponsCapacity`. The repository's
  `scripts/data/ships/merge-normalized-catalogues.mjs` performs the final checked
  symbol join. The stat fields are sparse (only the ones a module's group uses) and
  appended after the identity fields on the same record. Masses are tonnes, power
  megawatts, jump ranges light-years, weapon ranges metres.
- **Defence, power and weapon stats (2026-08-01 revision):** the same coriolis-data
  commit supplies the resistances (`kinres`/`thermres`/`explres`/`causres` →
  `kineticResistance`/`thermalResistance`/`explosiveResistance`/`causticResistance`),
  `hullreinforcement`→`hullReinforcement`, `shieldaddition`→`shieldAddition`,
  `protection`→`moduleProtection`, `passive`→`alwaysPowered`, and the weapon block
  (`damage`, `damagedist`→`damageDistribution` with the single-letter keys spelled out,
  `roundspershot`→`roundsPerShot`, `fireint`→`burstInterval`, `burst`→`burstRounds`,
  `burstrof`→`burstRateOfFire`, `charge`→`chargeTime`, `clip`→`clipSize`,
  `ammo`→`ammoMaximum`, `reload`→`reloadTime`, `distdraw`→`distributorDraw`,
  `thermload`→`thermalLoad`, `piercing`→`armourPiercing`, `range`→`maximumRange`,
  `falloff`→`falloffRange`, `shotspeed`→`shotSpeed`, `jitter`). The join was additive:
  no field the catalogue already carried was overwritten.
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
  - **Massless modules now state `"mass": 0` instead of omitting the field**
    (revision 2026-08-02 UTC; coriolis-data commit
    `0db9234b5b9ce8c939ea84133d7ce336eea88e27`, re-read for this change). Upstream
    carries **no `mass` key at all** for fuel scoops, refineries, AFM units and docking
    computers, and Coriolis's own code reads a missing mass as zero
    (`Module.getMass()` → `this.mass || 0`). This catalogue instead reads an absent
    field as *unknown*, so a single such module made a whole hull's mass — and with it
    its jump range — impossible to compute. The 106 affected records
    (`Int_FuelScoop_*` ×40, `Int_Repairer_*` ×40, `Int_Refinery_*` ×20,
    `Int_DockingComputer_{Standard,Advanced}`, the three removed
    `Int_StellarBodyDiscoveryScanner_*` tiers, `ModularCargoBayDoor`) now say so
    outright, matching upstream's own `"mass": 0` on `Int_DetailedSurfaceScanner_Tiny`.
    **Verified, not assumed:** summing the Deep Black's module masses with these six
    families excluded already gave exactly the 1237.3 t its journal reports, so the
    game itself treats them as zero.
    **Deliberately left absent** (unknown, not zero): the ten `*_free` starter
    variants and `Int_Hyperdrive_Size8_Class{1..5}`, which are identity-only rows with
    no stats whatsoever; `Int_ShieldGenerator_Size1_Class4`, whose omission is
    documented below; and `Int_DroneControl_ResourceSiphon` — limpet controllers do
    have mass, so that one is a genuine gap rather than a zero.
  - **Sixteen duplicated symbols were priced at `0`** because the "first occurrence
    wins" rule above had been applied to `mass` but not to `cost`: where coriolis-data
    holds a symbol twice, the merge took the price from the *second*, unpriced record.
    All sixteen now carry the first occurrence's price (revision 2026-08-02 UTC, same
    commit `0db9234b`):
    `Hpt_HeatSinkLauncher_Turret_Tiny` 3500 — confirmed independently against a real
    journal, which prices the fitted module at 3071 = 3500 less the 12.25% outfitting
    discount that export was taken at; `Int_Hyperdrive_Size5_Class5` 5 103 953;
    `Int_CargoRack_Size5_Class1` 111 566 and `_Size6_Class1` 362 591;
    `Int_DetailedSurfaceScanner_Tiny` 250 000; `Hpt_MultiCannon_Fixed_Medium` 38 000;
    `Hpt_Railgun_Fixed_Medium` 412 800; `Hpt_BasicMissileRack_Fixed_Medium` 512 400;
    `Hpt_MiningLaser_Fixed_Small` 6800; `Hpt_ATDumbfireMissile_Fixed_Large` 1 352 250;
    and the six small/medium Guardian weapons (Gauss 167 250 / 543 801, Plasma
    176 500 / 567 761, Shard 151 650 / 507 761).
    **Still `0`, deliberately:** only `ModularCargoBayDoor`, which is built into every
    hull and cannot be bought. `fixtures/ships/module-stats.json` pins that list under
    `freeModules`, so a new zero has to be argued for rather than slipping in: a zero
    price is otherwise indistinguishable from a dropped one.
  - **Corrosion-resistant cargo racks are *unpriced* rather than `0`.**
    `Int_CorrosionProofCargoRack_Size{1_Class2,5_Class1,6_Class1}` read `cost: 0`
    upstream — a gap in coriolis, not the duplicate-symbol defect above, so there is no
    first occurrence to fall back on. They are certainly not free: the size-4 record is
    priced, and the Deep Black's journal buys it at 82 775 = 94 330 less that export's
    12.25% discount. Carrying `0` made a build with one silently under-report instead of
    omitting the figure, so the field is omitted, matching `_Size2_Class1`, which never
    had one. *Superseded for `_Size1_Class2` by the next bullet.*
  - **2026-08-05 (UTC) — `_Size1_Class2` is priced at 12 560, from EDSY.**
    Same EDSY snapshot the 2026-08-02 revision above pins (`eddb.js` SHA-256
    `967834d6…`, internal `db 20260428`), re-read for this change; the record is module
    `161`, annotated `// at Palin, Sedesi`. Coriolis's `0` was coriolis's own gap, not a
    shared one: on the two corrosion racks *both* registries price they agree exactly
    (`_Size1_Class1` 6250, `_Size4_Class1` 94 330), and the only corrosion racks FDevIDs
    `outfitting.csv` lists at all are those two plus `_Size1_Class2` itself — so this is
    the last of the purchasable ones.
  - **Read that 12 560 as a 10-granular figure, not a to-the-credit one.** EDSY publishes
    module costs at **10-credit granularity**, which is measured rather than assumed. Two
    observations,
    both scoped to `eddb.module` — EDSY's outfitting table, where module `161` lives —
    so they can be re-run. Totals across the whole of `eddb.js` are deliberately not
    quoted: they move with how the scan treats commented-out records, the ship table's
    own armour rows and case-mismatched symbols, whereas within the module table the
    result is flat.
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
    in-game reading settles the last digits. Every EDSY-sourced price already in this
    catalogue carries the same granularity, so this record is no less exact than the rest
    of them.
  - **The remaining three racks have no list price to publish** (same revision).
    `_Size2_Class1`, `_Size5_Class1` and `_Size6_Class1` are **not sold at any station**:
    FDevIDs `outfitting.csv` lists none of them, and EDSY hides all three — `cost: NaN`
    with the comment "never released" on size 2, `cost: 0 // TODO: cost // CG reward` on
    sizes 5 and 6. Sizes 5 and 6 were handed out as Community Goal rewards and size 2
    never shipped, so the `0` upstream is not a dropped figure but the absence of one.
    That makes this a different gap from the one above: **no registry publishes a price
    today**, and none is likely to, because no outfitting screen quotes these — though
    EDSY's own `TODO: cost` says upstream considers the figure pending rather than
    non-existent. Closing it takes an in-game observation rather than a registry — a
    journal `Loadout` module `Value`, a `StoredModules` entry's `BuyPrice`, or a
    `ModuleSell` on one — and until then `cost` stays omitted, since a reward module
    still has an insurance value and reporting it as free would understate a rebuy.
  - **Filled by hand, from a documented uniformity:** `Int_ShieldGenerator_Size1_Class4`
    (added from EDSY in the earlier pass, so it has no coriolis record) takes the
    resistances and distributor draw every one of the 55 shield generators coriolis does
    carry shares — kinetic 0.4, thermal −0.2, explosive 0.5, draw 0.6. The cargo hatch
    (`ModularCargoBayDoor`) takes the 0.6 MW draw Coriolis hard-codes for it
    (`ModuleUtils.cargoHatch`), since it is fitted to every hull and cannot be removed.
- **Armour (bulkhead) stats:** coriolis keeps a hull's five (Caspian Explorer: six)
  armour options on the *hull* record; this catalogue keeps them on the matching
  `<Hull>_Armour_*` module records, joined by hull and by the symbol's grade suffix
  (`_Grade1`, `_Grade1_Default`, `_Grade2`, `_Grade3`, `_Mirrored`, `_Reactive`). Each
  gains its added `mass` (t), `hullBoost` (the fraction of the hull's base armour it
  adds on top) and the four resistances. The Lynx Highliner has no coriolis hull entry,
  so its options take the per-grade hull boost and resistances that all 47 hulls coriolis
  does carry share, with the masses already sourced from EDSY.
- **Stats kept deliberately (do not "fix" back):**
  - **`restrictedToShips`** carries the hull symbol(s) a non-armour module is limited
    to (coriolis's `ship` field: the MkII Gravity Optimised thrusters → `Explorer_NX`,
    the MkII Agile Boost thrusters → `SmallCombat01_NX` "Kestrel", the MkII Mining
    controller and Mining Volley Repeater → `LakonMiner`). **Armour's** hull
    restriction is _not_ repeated here — it lives in the `ship` field
    (`OutfittingModule.ship` / `getModulesForShip`).
  - **Weapon combat stats are now carried too.** The original merge took only the
    mechanical/engineering stats; the enrichment pass described under "Build metrics"
    below added the combat side, so all 159 hardpoint records carry `damage` and
    `thermalLoad`, 133 a `falloffRange` and 142 a `burstInterval`. Module-breach stats
    (`breachdmg`, `breachmin`, `breachmax`) remain the one deliberate omission — no
    calculation here reads them.
  - **Ship-specific armour now carries its bulkhead stats.** These records were once
    identity-only; the same enrichment pass moved each hull's per-bulkhead block off
    `ships.jsonc` and onto the 241 `*_Armour_*` module records, which now carry `mass`,
    `hullBoost` and the four resistances.
  - **Pre-engineered/duplicate drives share a `symbol`** in coriolis (e.g. the V1
    FSDs); the first (primary) occurrence wins, and any baked engineering is expected
    to arrive as SLEF `Engineering.Modifiers` instead.
- **Identity kept as-is from the source (do not "fix" these back):**
  - **The three removed Discovery Scanner tiers** (`Int_StellarBodyDiscoveryScanner_Standard`
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
- **Operations / Lynx additions — from EDSY, Inara and Frontier's update notes** (not
  in coriolis-data / FDevIDs at the acquired commit):
  - **Mk II Vessel Hangars** (`Int_FighterBayMk2_Size{5,6,7}_Class1`) — new internal
    records with the same operational stats as the Mk I bays at half the mass
    (10/20/30 t, integrity 60/80/120, power 0.25/0.35/0.35 MW). The three Mk I
    **Fighter Hangar** records were renamed to **Mk I Vessel Hangar** (same symbols and
    stats; the Operations update renamed them and let them deploy the Nomad). The Mk II
    bays' restriction to the Caspian Explorer / Panther Clipper Mk II / Type-11
    Prospector was documented but not stored; it is now
    `restrictedToShips: ["Explorer_NX", "PantherMkII", "LakonMiner"]` on all three
    records (2026-08-04, above) — the hull symbols the registry does carry.
  - **Mk II passenger cabins** (`Int_MkII_PassengerCabin_Size{2..6}_Class{1,2}`) already
    existed as identity records; their mass was added (2.5/5/10/20/40 t by size) and the
    two size-6 records' `class` was corrected from 5 to 6.
  - **Corrosion Resistant Cargo Racks** `Int_CorrosionProofCargoRack_Size{2,5,6}_Class1`
    (capacity 4/32/64) and the built-in **Cargo Hatch** `ModularCargoBayDoor`
    (power 0.6 MW) were added — live EDSY records (not commented out, unlike the 1B
    shield generator below) that the FDevIDs join had omitted. All three racks carry
    EDSY's `hidden:1`, and they are also the three the prices section leaves unpriced,
    but the flag is not the reason: `hidden:1` marks a record EDSY keeps out of its
    pickers for assorted reasons, and of the nine such records in its module table one
    does carry a price (`Int_DroneControl_ResourceSiphon`, `cost: 18040` — which EDSY
    itself annotates `// bug?`, so it is a weak counter-example, but it is enough to show
    the flag is not a statement about price). They are unpriced because no source states
    a figure — see the prices section for what each one actually says.
  - **1B Shield Generator** (`Int_ShieldGenerator_Size1_Class4`) — a gap in FDevIDs, not
    in the game: every other shield-generator size carries all five ratings, and size 1
    ran E/D/C/A with **B missing**. The module is real, so the record was added with the
    stats its sources do expose — `optMass` 25 t, `minMass` 13 t, `maxMass` 63 t,
    multipliers 0.6 / 1.1 / 1.6, regen 1.0 / 1.6 MJ/s. **`mass`, `integrity` and
    `powerDraw` are deliberately omitted**: EDSY carries this variant commented out with
    those three fields blank (identity `fdid` 128064261 and the multipliers only), and no
    other registry publishes them. Omitted rather than interpolated from the neighbouring
    ratings — see the Lynx note above for the same rule.
- **Prices — `cost` on modules, `hullCost` / `retailCost` on hulls.** `cost` is the
  module's standard list price in credits, before any station discount or markup — the
  figure an outfitting screen quotes at 0% discount. On hulls, `hullCost` is the bare
  hull and `retailCost` the hull with its default module loadout (`retailCost` is never
  below `hullCost`, and a test asserts it). Sources are coriolis-data's `cost` per module
  and `properties.hullCost` / `retailCost` per ship, with EDSY filling the records
  coriolis does not price (the newer hulls' armour, the Operations additions, the
  retained removed scanners) and supplying the Lynx Highliner, which has no coriolis
  entry. Ship-specific **armour** is priced from each hull's `bulkheads` upstream, joined
  on hull + bulkhead name because those records carry no symbol upstream.
  - **All 48 hulls are priced. 1176 of 1198 modules are.** The 22 without a price are the
    ten starter `*_free` variants, the five size-8 frame shift drives, the three Mk II
    Vessel Hangars, the **three unsold** Corrosion Resistant Cargo Racks (two Community
    Goal rewards and one never-released variant) and `Int_ShieldGenerator_Size1_Class4` —
    no registry publishes a figure for them. Three of
    the four racks joined the list in the 2026-08-02 revision described above (moving this
    count from 1178/20), and `_Size1_Class2` left it again on 2026-08-05 when EDSY was
    found to price it. **`cost` is omitted, never set to 0**:
    `0` is a real price (the starter Lightweight Alloy bulkhead costs nothing), so a
    cost calculation must be able to tell "free" from "unknown".
  - **Still not modelled:** passenger capacity and fighter-bay/rebuild counts. The
    **Merc-Coin** price of the pre-engineered variants is now carried, but on the
    variant rather than the module — see `mercCoinCost` in the pre-engineered section.
- **Deliberately not modelled here:** the **Merc-Coin
  pre-engineered weapon variants** are not separate module records: their base module
  symbols already exist, and the pre-engineering is expressed as the Operations
  blueprints below — the pairing between the two is `pre-engineered.jsonc` (next section). The **Nomad** (`Lander01`) is a ship-launched vehicle, not a
  shipyard hull, and its `Vehicle_Lander01_*` weapons carry no category/class/rating the
  module schema requires, so neither the vessel nor its modules are added.
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
follows from the interval and its burst pattern. The Inara-sourced `recipe_*` totals are
left as published: they are *displayed* rate-of-fire changes, so they keep the
`RateOfFire` label and apply to the rate directly — which is the only reading that
reproduces the published figure on a charged weapon such as the rail gun.

**Corrected 2026-08-01:** the four `special_hullreinforcement_*` experimental effects
stored their `DefenceModifierHealthAddition` contribution as *additive*, which read as a
flat 0.05 hull points rather than the percentage both sources give (coriolis's
`modifierActions` treats `hullreinforcement` as a multiplicative percentage; EDSY stores
`ihrpx_ap: { hullrnf: -5 }`). They are now `multiplicative`. The label was inert until
this revision gave hull reinforcement packages a `hullReinforcement` base to apply to.

**Completed 2026-08-01: six experimental-effect legs that recorded only the cost.** Four
effects carried their drawback and not the benefit they are named for, so each looked
complete while doing nothing a build would notice. Both references agree on every value,
and each addition is now pinned by a test:

| Effect                                                   | Was                                   | Added                                       |
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
  `blueprint.name` for the 81 journal-keyed blueprints and the Operations dossier's
  display label for the 27 `recipe_*` ones. Read them with `getBlueprintName` /
  `getExperimentalEffectName`.
  - **These are the short modifier labels, not the full outfitting-panel
    strings — deliberately.** The panel calls `Weapon_LongRange` "Long-Range Weapon",
    `ShieldBooster_HeavyDuty` "Heavy Duty Shield Booster" and
    `Armour_Advanced` "Lightweight Armour"; this catalogue says "Long range", "Heavy
    duty" and "Lightweight". Nearly all 81 differ that way, because a blueprint's name
    is read next to the module it is applied to, where repeating the module's own name
    is noise. Re-checked on 2026-08-02 and left as-is: the
    convention is house style, and switching to the panel strings would change every
    `getBlueprintName` return for no gain. Only the two names that were wrong in their
    own right were corrected (see the 2026-08-02 revision).
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
  general/core/optional recipes (`recipe_*` keys, e.g. `recipe_fuelscoop_efficiency`,
  `recipe_multicannon_rapid`) plus the Anti-Guardian `recipe_guardianmodule_sturdy`
  (grade 1 only). These are **keyed by Frontier's compiled `recipe_*` key**, not a
  journal `BlueprintName`. The registry exposes **one displayed total per grade**, not a
  roll-bounded range, so each feature stores that total as a fixed value (`min == max`).
  Their per-roll `materials` are from the same registry (resolved to Frontier material
  `symbol`s against the `materials` domain); the per-roll **Merc-Coin** amount is also
  charged but is a currency, not a material, so it is not stored. Some totals are
  non-monotonic (pre-engineered UI values, not primitive weights — notably the
  Enduring-feedback rail-gun damage and the Balanced-distributor G4 mass) and are
  **preserved as published, not silently "corrected"**. The Merc-Coin **weapon-reward**
  recipes begin at grade 2 because the bought module already contains the grade-1
  pre-engineering; the general/core/optional recipes (fuel scoop, laser plasma-conversion)
  span grades 1–5, and the Anti-Guardian recipe is grade 1 only.
- **Anti-Guardian Zone Resistance is keyed twice.** The registry exposes the one
  player-facing blueprint under a module key and a weapon key —
  `recipe_guardianmodule_sturdy` and **`recipe_guardianweapon_sturdy`** — with the same
  display name, the same grade-1-only `GuardianModuleResistance` +100%, and the same
  recipe (2×`TG_Abrasion03`, 1×`TG_CausticCrystal`). Both are stored so a journal or saved
  build referencing either resolves; `blueprintTargets` scopes the weapon key to weapons
  and the module key to the wider family list. The two are intentional duplicates, not a
  copy-paste slip — do not dedupe them.
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
- **Weapon-combat experimental effects — re-added for completeness:** the 29 effects
  once dropped (Auto Loader, Corrosive Shell, Force Shell, FSD Interrupt, Plasma Slug, …)
  are now present. A purely-qualitative one — a gameplay flag with no numeric magnitude
  the data exposes — carries an **empty `modifiers` list and a human-readable
  `description`** instead; effects that do have magnitudes carry them (e.g. Force Shell
  shot speed −16.6667%, FSD Interrupt damage −30% / burst interval +50%). Their
  one-application `materials` are from the same in-game / Inara registry (a Merc-Coin
  amount is also charged but is not stored). All target weapons in the compatibility map.
- **Feedback Cascade (`special_feedback_cascade`) — added.** The catalogue carried only
  the pre-engineered rail-gun variant `special_feedback_cascade_cooled`; the plain effect
  players apply themselves was missing. EDSY holds it commented out (`wpnx_feca`, marked
  "verify mats"), which is why the earlier import skipped it. It is damage −20% with the
  same one-application recipe as the cooled variant (5×`SymmetricKeys`,
  5×`ShieldEmitters`, 5×`FilamentComposites`).
- **Pre-engineered `_cooled` variants now keep their base effect's modifiers.** Each
  `_cooled` rail-gun variant is its base effect **plus** a −40% thermal load, but three
  had been stored carrying the thermal cut alone: `special_feedback_cascade_cooled` was
  missing damage −20%, `special_plasma_slug_cooled` damage −10% and ammo −100%, and
  `special_super_penetrator_cooled` reload +50%. All three now match EDSY's `hrgx_*`
  entries. `special_incendiary_rounds` likewise regained its burst interval +5.2632%.
  Damage-**type** splits (kinetic/thermal/explosive weights) stay in `description` rather
  than `modifiers`, as they already do for High Yield Shell and Inertial Impact.
- **Journal Labels** for both sources are resolved via EDSY's own attribute table
  (`attr → fdattr`), the authority for the exact Label strings the game writes
  (e.g. coriolis `optmass` on an FSD → `FSDOptimalMass`, `maxfuel` → `MaxFuelPerJump`).
  Group-ambiguous keys (`optmass`, `optmul`, `thermload`) are disambiguated by the
  blueprint's target module group.
- **Kept deliberately (do not "fix" back):** the module **stats** layer still carries
  no weapon combat stats, but the weapon-combat **experimental effects** and the
  Operations weapon **blueprints** are included as reference data (their combat labels
  simply have no base value for the calculator to fold, so they are stored, not
  computed). The dormant `Decorative_*` transformations EDSY also lists are **not**
  included — internal visual/test entries, not obtainable engineering.
- **Blueprint keys deliberately left out:**
  - **Per-module-group aliases, not extra blueprints.** A blueprint that applies to several
    module groups is exposed once per group under a `recipe_sensor_<group>_<mod>`-style
    key whose display name points back at the canonical blueprint — for example the
    long-range sensor modification appears once for sensors and again for each scanner
    type. The blueprints they point at are already stored under their journal
    `BlueprintName`s (`Sensor_LongRange`, `Scanner_WideAngle`, `Misc_LightWeight`, …),
    which is what the journal actually writes. Storing the aliases would multiply one
    blueprint into many identical records.
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
  `getExperimentalsForModule` / `getExperimentalsForBlueprint` in
  `typescript/src/ships/engineering-options.ts`.
- **Availability is a property of the module, not of the blueprint.** A Pulse Laser and a
  Rail Gun both take the Efficient blueprint but offer different experimental effects, so
  "which experimentals go with blueprint X" has no single answer. Modules are therefore
  grouped (22 groups covering 428 engineerable modules) and each group lists the
  `blueprints` and `experimentals` it offers. `getExperimentalsForBlueprint` is provided
  for convenience and returns the **union** across every group offering that blueprint —
  deliberately looser than the per-module answer, and a test pins that it is never
  narrower.
- **Source:** [EDSY](https://github.com/taleden/EDSY) `eddb.js`, whose module-group tables
  carry each group's `blueprints` and `expeffects` lists, plus the per-module exclusions
  described below. Same CC BY-NC 4.0 licence note as the experimental-effect section
  above. Acquired 2026-08-01 UTC.
- **`exclusions` are the exceptions, and they are real.** 29 modules do not take their
  whole group's list: the Multi-cannons cannot take Phasing Sequence, the dumbfire racks
  cannot take Drag Munitions, and the mining tools take no experimental at all. Upstream
  these are an exclusion map (with a wildcard for "none of them"); here the wildcard is
  **expanded to the explicit list** so a consumer never has to interpret one. A module
  absent from `exclusions` takes its whole group's list.
- **Kept deliberately:** a mining tool stays in `modules` (it has blueprints) even though
  its experimental list resolves to empty — "engineerable with no experimental slot" and
  "not engineerable at all" are different answers, and `getEngineeringGroup` separates
  them.
- **Key form:** EDSY names the Anti-Guardian blueprint by its journal form
  (`GuardianModule_Sturdy`); this catalogue stores it under the `recipe_*` id the rest of
  `blueprints.jsonc` uses, so every id here joins directly.

## Pre-engineered modules

- **File:** `pre-engineered.jsonc`, validated by `fixtures/ships/pre-engineered.json`.
  Read it with `getPreEngineeredVariants` / `getPreEngineeredByBlueprint` /
  `isPreEngineered` in `typescript/src/ships/pre-engineered.ts`, and resolve a variant
  into a fittable module with `getPreEngineeredStats` in `pre-engineered-stats.ts`.
- **Why it is a catalogue of its own.** A pre-engineered module has **no symbol of its
  own** — the game sells an ordinary module with engineering already applied, and a
  journal `Loadout` reports it as the base `symbol` plus an `Engineering` block. So the
  module catalogues already hold every one of these modules and `blueprints.jsonc`
  already holds every one of these blueprints; what was missing was the **link** saying
  which stock modules can be bought already engineered, and with what. Each record is a
  pairing — `{ symbol, name, blueprint, grade, acquisition }` plus the stat block and
  price described below — not a module, which is also why it is exempt from the "unique
  symbols per catalogue" rule the other array-shaped files follow.
- **Neither column is a key on its own.** One base module is sold in several
  pre-engineered flavours (the medium Seeker Missile Rack has six), and one blueprint is
  sold on several base modules (the Drag seeker on both the medium and the large rack),
  so both lookups return arrays.
- **`acquisition` says where a variant comes from.** 72 records: 21 `mercenary`,
  30 `communityGoal` and 21 `techBroker`.
  - **`mercenary`** — the Merc-Coin shop rows. Source: the in-game outfitting and
    blueprint registries, cross-checked against the current
    [Inara outfitting](https://inara.cz/elite/outfitting/) and
    [blueprint](https://inara.cz/elite/blueprints/) registries and Frontier's update
    notes. All 21 are grade 1, and that is the point: the purchased module already
    contains the grade-1 pre-engineering, which is exactly why these blueprints' own
    recipes start at grade 2 (see the Operations section above). The two facts are
    consistent by construction and a test asserts it —
    `getBlueprintCost(bp, target, 1)` prices taking a bought variant the rest of the way.
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
- **`mercCoinCost` is the shop price in Merc Coin**, on the 21 `mercenary` rows and
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
  resistance. 51 rows carry one; the 21 `mercenary` rows do not, because no registry
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
    across 7 modules were corrected this way; the file now holds 20 `overwrite` modifiers
    over 11 modules, each pinned by a test to resolve to exactly its stored value.
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
  - **Burst interval, dropped from 13 variants, is now restored.** EDSY carries no
    journal Label for `bstint` — the journal reports the resulting `RateOfFire`, never the
    interval it comes from — so the decoder skipped it, and the 13 variants that change a
    burst pattern kept the *stock* cadence. Four of them (the two frag cannons and the two
    Guardian gauss cannons) were left inconsistent as well as slow, carrying the engineered
    `BurstSize` — and, on the gauss cannons, the engineered `BurstRateOfFire` — against a
    stock interval. They are now stored under **`BurstInterval`**, the
    same label the Rapid Fire and High Capacity blueprint features use (see the
    Engineering section above), which is the only addition to the file: re-running the
    decoder over the same EDSY revision reproduces every other byte. Nothing downstream
    would have noticed the omission on its own — a stock cadence is a plausible number —
    so `fixtures/ships/pre-engineered.json` now pins all 13 intervals and the rate each
    derives, under `burstIntervalVariants`.
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
its own fixture, with the expected outputs in a sibling fixture that names it by path.

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

- **`fixtures/ships/slef-inara-type-11.json`** — a real [Inara](https://inara.cz/) SLEF
  export of an engineered mining Type-11 Prospector (27 `Modules` entries), contributed
  **2026-08-04 UTC** by the repository owner from their own commander's fleet, which is
  the licence position: it is one player's build, shared by that player for this
  purpose, and like every other build here the loadout itself is Frontier game output
  redistributed under Frontier's media-usage terms. Source text SHA-256
  `3e008ea9b1226c49b6f7c080d897a4cbabbcbcc36ce83e58a293b397712279ee`; stored unmodified
  apart from re-indenting. The header's Inara commander and ship ids are kept as
  received, since they are the provenance.

  It is the **only external source that exercises the restricted mounts**, and it
  settles what nothing else could: Inara independently writes
  `largemininghardpoint1`, `mediummininghardpoint1`, `mediummininghardpoint2`,
  `mediumhardpoint3`, `smallmininghardpoint1`, `limpetcontroller01` and
  `fighterbay01` — this catalogue's keys character for character, once case is set
  aside. Its internals run `slot01_size6`…`slot05_size5`, then `slot06_size4`, so a
  restricted optional really does consume no `SlotNN` number, exactly as the
  2026-08-04 revision derived from EDSY. And its `mediumhardpoint3` carries a
  sub-surface displacement missile, confirming an *unrestricted* mount takes mining
  tools too.

  **Its credit figures are a purchase record, not ground truth**, and diverge three
  ways: the hull sits at a 2.5% shipyard discount, the modules at about 5.2% across 23
  priced entries, and Inara **rounds** its `Rebuy` where the game truncates (5% of its
  own hull plus modules is 5 613 800.75, which it states as `5613801`). The journal
  capture above is the authority on that convention, so this catalogue keeps
  truncating; the divergence is pinned as evidence rather than followed.

  **One thing it exposed rather than confirmed:** Inara lower-cases every slot key, as
  the SLEF specification's own example does, and slot binding here is case-sensitive —
  so a build imported from Inara reports **no** occupied mounts and `setModule` on one
  adds a duplicate. That is a pre-existing defect of the loadout facade rather than of
  this data, and it is recorded in
  [issue #21](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/21); the
  tests over this fixture compare slot keys case-insensitively until it is fixed.

Two facts the Krait Phantom capture established that the EDSY export could not:

- **A journal lists far more than fitted modules.** 15 of its 40 entries are the
  cockpit, ship kit, nameplates, bobbles, paint, engine/weapon colours and voice pack.
  None is an outfitting module — this catalogue deliberately does not carry them — and
  all weigh nothing and cost nothing. They are recognised by slot: `parseSlotName`
  returns `null` for exactly these, and only for these.
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
  The Viper Mk IV's modules sit at exactly **0.85**. Nothing in the export says so.
- **The two sources disagree about what `HullValue` means.** The game reports the hull
  *with its stock fittings* (coriolis `retailCost`, 37 472 252 for the Krait, matching
  its journal exactly), EDSY the bare hull (`hullCost`, 189 326 510 for the Caspian
  Explorer, also exact). Consistently, the journal gives no `Value` at all to the five
  modules that came free with that hull, because their cost already sits inside
  `HullValue`. Quoting `hullCost` and pricing every fitted module keeps one convention
  and avoids double-counting either way.
- **A build's own parts need not add up.** A real Viper Mk IV journal declares
  `ModulesValue` 4 940 956 while its per-module `Value`s sum to 3 942 898: older journals
  omit `Value` on modules that were nonetheless paid for, here an FSD interdictor. A
  figure rebuilt from such a source would inherit the shortfall.

The upside is that the export becomes a pure function of the hull and the fitted module
symbols. Two builds with the same fit price identically whatever their owners paid; an
edit reprices exactly the module that changed; and a document always adds up, since each
module carries the same list price the total counted. Where a fitted module has no
published price the total is omitted rather than under-reported — 22 catalogue records
can trigger that today: the three unsold corrosion-resistant racks, the three Mk II
vessel hangars, `Int_ShieldGenerator_Size1_Class4`, `Int_Hyperdrive_Size8_Class{1..5}`
and the ten `*_free` starter variants.

Physical figures (`UnladenMass`, `CargoCapacity`, `FuelCapacity`, `MaxJumpRange`) are
recomputed too, and unlike the credits they **do** reproduce each source's own figures
exactly — which is what shows the recomputation is right rather than merely
self-consistent.

**Still missing external ground truth:** shields, armour and weapon DPS. A journal never
reports them, and every weaponed build here is checked against our own maths. An EDSY or
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
  and all seven core internals must be filled. Builds that failed were dropped — the one
  systematic failure, the Type-11's missing mining hardpoints, was a defect in this
  catalogue and is corrected above. Near-duplicates (>85% identical fit) were collapsed,
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
  cheap for a port to reach, and it is a choice rather than a limitation: since the base
  stats were sourced (revision above) all 1902 declared entries resolve, and `index.json`
  carries `declaredEngineering` so `builds.test.ts` can assert exactly that on every run.
  Applying them and re-pinning every metric would be a separate pass over the corpus.
- **Not ground truth.** These figures are this implementation's own output, pinned so
  every future implementation must agree. Only the *builds* are external.
