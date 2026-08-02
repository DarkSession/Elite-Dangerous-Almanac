# TODO

Known gaps and follow-up work, newest first. Long-form provenance and the reasoning
behind a decision live in the relevant `data/<domain>/SOURCES.md`; this file is the
short, actionable list.

## Ships — data gaps

### 1. Engineering options cover 428 of the 1198 modules

`data/ships/engineering-options.jsonc` has 22 groups — power plants, thrusters, drives
(and SCO drives), distributors, shield generators, shield cell banks, shield boosters,
hull reinforcements, and thirteen weapon families — and maps 428 modules into them.
Everything else answers `[]` from `getBlueprintsForModule` /
`getExperimentalsForModule` and `null` from
`getEngineeringGroup`, which reads as "cannot be engineered" and is wrong for whole
families that real builds engineer constantly: **hull armour** (all 241 records),
**sensors**, **life support**, **heat sink** and **chaff launchers**, **point defence**,
**ECM**, the **Detailed Surface Scanner**, **limpet controllers**, **AFMUs**, **fuel
scoops**, **FSD interdictors**, **cargo racks** (`CargoRack_IncreasedCapacity`), the
**Guardian weapons** and the KWS/manifest/wake scanners.

Measured against the new build corpus: 497 of its 1902 declared engineering entries sit
on a module the options catalogue does not group. The blueprints themselves are all
present in `BLUEPRINTS` — only the module→group map and the per-group lists are missing,
so this is a data gap, not a calculation one: `ShipLoadout.applyBlueprint` does not read
this catalogue at all — it checks the blueprint's own target family, which is a separate
problem (§4 and §10). Both source registries carry the missing lists (EDSY
`mtype[].blueprints` / `.expeffects`, coriolis `modifications/modules.json`).

### 2. A hardpoint cannot carry a restriction at all — the Type-11's mining mounts

**A hull's `hardpoints` is a bare `readonly number[]` of sizes, so there is nowhere to
say that a mount only takes certain modules.** The Type-11 Prospector needs exactly that:
four of its eight mounts (1 large, 2 medium, 1 small) are **mining-only**, and the other
four take ordinary weapons. Their sizes were restored on 2026-08-02 (see
`data/ships/SOURCES.md`) so builds fit at all, but today `setModule` will happily put a
plasma accelerator in the large mining mount, and nothing can answer "what may I fit
here?" for that hull. Coriolis-data carries the rule (`{ "class": 3, "name": "Mining",
"eligible": { "abl": 1, "ml": 1, … } }`) and Inara shows it in the outfitting list.

Fixing it is a shape change, not a data patch:

- `ShipSlots.hardpoints` becomes `{ size, restriction? }` entries, mirroring
  `OptionalSlotSpec` (a breaking change to a published type — or add a parallel
  `hardpointSpecs` and keep `hardpoints` as sizes).
- `SlotRestriction` gains `mining` (and see below), `BuildSlot`/`enumerateSlots` carry it
  through, `parseSlotName` cannot infer it — the journal names these mounts like any
  other, so only the hull layout knows.
- `setModule` enforces it, the `schemas/ships` catalogue schema gains the property, and
  `fixtures/ships/ship-slots.json` pins the Type-11 layout that already spot-checks it.

**The same gap on optional internals**, where the field exists but the values do not:
`military` and `planetaryApproachSuite` are the only restrictions modelled, so the
**Panther Clipper Mk II's two cargo-only optionals** and the Type-11's
**limpet-controller** and **vessel-hangar** optionals are stored as ordinary slots.

Separately — and by a different mechanism — the three **Mk II Vessel Hangars**
(`Int_FighterBayMk2_Size{5,6,7}_Class1`) carry no `restrictedToShips`, although
`data/ships/SOURCES.md` records that they fit only the Caspian Explorer, Panther Clipper
Mk II and Type-11. That field already exists and is already used this way (the Mk II
mining controller and `Hpt_MiningToolV2_Fixed_Large` both name `LakonMiner`), so it is a
missing value, not a missing feature.

### 3. Three stat gaps the 2026-08-02 reconciliation did not close

All three were surfaced by that pass and deliberately left rather than guessed. Long-form
reasoning in `data/ships/SOURCES.md`.

**a. 83 non-armour records still have no `integrity`.** Mostly the families that carry no
other mechanical stat either — passenger cabins (23), hull and Guardian/meta-alloy
reinforcement packages (30), fuel tanks (9), cargo racks (16), module stabilisers,
planetary approach suites. Neither EDSY nor any other registry carries an integrity for them, and the in-game panel
does not show one. A further 241 records without `integrity` are ship armour, which is a
different shape and not counted here.

**b. The four `Int_StellarBodyDiscoveryScanner_*` records have no `powerDraw`.** They are
the remainder of the old "106 modules are missing `powerDraw`" gap. No source has a value:
EDSY gives them only mass and integrity, and coriolis-data has no record for them at
all. They are withdrawn modules whose function is
built in now, so `0` is plausible but unsourced — left absent, since absent means unknown.

**c. `Int_DroneControl_ResourceSiphon` has no `mass`.** The only record left from the old
"Modules still missing `mass`, deliberately" gap. EDSY omits the field and its engine
reads a missing mass as zero, but it does not *state* zero, and unlike the built-ins this
catalogue does carry an explicit `mass: 0` for, there is no uniformity to appeal to —
every sized limpet controller in the family has a real, non-zero mass. Left absent rather
than inferred. Fill from a real journal `Loadout` that fits it, or from an outfitting
screen reading.

### 4. Blueprints cannot be applied to most real builds: base stats are missing

`applyBlueprint` refuses a recipe when the module record does not carry every base stat
the recipe modifies — incomplete engineering is rejected rather than stored half-applied.
The build corpus measures the cost: **405 of its 1902 declared engineering entries are
rejected for a missing base stat**, and the blueprints hit are the most-used in the game.
Every count below is reproducible from `fixtures/ships/builds/`.

| Missing base stat | Field today | Blocks | Rejections |
| --- | --- | --- | --- |
| `EngineHeatRate` | none | `Engine_Dirty`, `Engine_Tuned` | 125 |
| `SensorTargetScanAngle`, `ScannerRange`, `ScannerTimeToScan` | none | `Sensor_LightWeight`, `Sensor_LongRange`, `Sensor_FastScan`, `Sensor_WideAngle`, `Scanner_LongRange` — on the sensor suites and on the KWS/manifest/wake scanners | 111 |
| `ShotSpeed` | `shotSpeed`, on 111 of 1198 records | `Weapon_LongRange` and `Weapon_Focused` on the 49 weapons with no value — pulse/burst/beam lasers, rail guns, mine launchers, mining lasers, Gauss cannons | 70 |
| `EnergyPerRegen` | none | `ShieldGenerator_Reinforced`, `_Optimised`, `_Thermic` | 36 |
| `ProbeRadius` | none | `Sensor_Expanded` (Detailed Surface Scanner) | 30 |
| `ShieldBankReinforcement`, `ShieldBankHeat`, `ShieldBankSpinUp`, `ShieldBankDuration` | none | every shield-cell-bank blueprint | 13 |
| `FSDHeatRate` | none | `FSD_FastBoot` and `FSD_Shielded`, which modify it directly, and any blueprint paired with `special_fsd_cooled`, which is the whole of that effect; plain and SCO drives alike. Also why `unresolvedModifiers()` still reports it on the pre-engineered V1 drive (pinned in `fixtures/ships/pre-engineered.json`) | 11 |
| `ReloadTime` | `reloadTime`, on 121 of 1198 records | `Weapon_RapidFire` on weapons with no value | 6 |
| `FSDInterdictorFacingLimit`, `FSDInterdictorRange` | none | `FSDinterdictor_Expanded` | 3 |

Two different jobs, so do not treat the table as one task:

- **`shotSpeed` and `reloadTime` already exist** — field, TSDoc, `schemas/ships` property
  and `module-stat-labels` entry are all in place. They need **values** for the records
  that lack them, not new fields.
- **The rest have no field at all.** Each needs an `OutfittingModule` field with its
  TSDoc, a `schemas/ships` property, a `module-stat-labels` entry and fixture pins,
  plus the values. EDSY carries `scanrng`, `maxangle`, `scantime`, `proberad`, the
  shield-bank fields and both heat rates; coriolis-data carries most of the same.

A third case is **not** a missing stat: `DefenceModifierHealthMultiplier` on a hull
reinforcement package. `module-stat-labels.ts` maps it to `hullBoost`, and its comment
already explains that a reinforcement package has no base hull boost — the game's
modifier *is* the bonus. That leg needs additive-from-zero handling in the calculator,
not a sourced base value. No corpus build hits it today.

This is why `fixtures/ships/builds/` pins its metrics **pre-engineering**: applying what
those builds declare is not possible today.

### 5. Four corrosion-resistant cargo racks have no price at all

`Int_CorrosionProofCargoRack_Size{1_Class2,5_Class1,6_Class1}` read `cost: 0` in
coriolis-data itself — a gap upstream, not the duplicate-symbol defect fixed in this
change, so there is no first occurrence to fall back on; `_Size2_Class1` never carried a
price at all. They are not free: the size-4
record is priced at 94 330, and the E-rated rack family follows a ×3.25 curve, putting
sizes 5 and 6 near 306 000 and 996 000.

`cost` is now omitted on all four so a calculation can tell "free" from "unknown", and
they are pinned in `fixtures/ships/module-stats.json` under `unpriced`. Since credits are
quoted at retail, a build carrying one of these exports no `ModulesValue` or `Rebuy` at
all until real prices are sourced from EDSY or Inara.

### 6. Two experimental effects exist in the game that no public dataset carries

`special_guardian_module_resistance` ("Anti-Guardian Field Resistance") and
`special_plasma_rounds` ("Plasma Conversion") are real effect identities — the
catalogue already carries their paired blueprints (`recipe_guardianmodule_sturdy`,
`recipe_*_thermalplasmaconversion`) — but **neither EDSY nor coriolis-data has them**,
and both carry exactly the same 87 effects this catalogue does.

Their numeric modifiers are not recoverable from Frontier's static files either: the
static effect resources hold compiled modifier arrays with no field labels, and the
ingredient and roll numbers are fetched from a live service rather than shipped. So
they are recorded here by identity and display name only. Adding hollow records with
empty `modifiers` would be worse than the gap — a consumer cannot tell "no modifiers"
from "modifiers unknown". Fill them from a real `EngineerCraft` journal capture that
applies either effect.

### 7. Module identities exist that no outfitting registry lists

Reconciling the catalogue against the full set of module identities the game recognises
surfaced 535 this catalogue does not carry. **None of them appear in EDCD FDevIDs `outfitting.csv`**, so
the outfitting catalogue is complete with respect to what a player can actually buy —
this is a note, not a defect.

Most are ship-part identities that were never outfitting (hull radiators, drive
nacelles, landing gear, shield emitters), ship-launched-fighter internals, or
station/NPC modules. A few look like real but unreleased or withdrawn outfitting:
`Int_MetaAlloyHullReinforcementMk2_Size{1..5}_Class2` ("Improved Meta-Alloy Hull
Reinforcement"), `Int_ShieldGenerator_Size{1..8}_Class2_AntiCaustic` ("Anti-Caustic
Shield"), `Int_Cloud_Resistant_Sensors_Size{1..8}_Class3` and `Hpt_Cannon_Turret_Huge`.
Worth re-checking after a game update; do not add them until FDevIDs lists them, since
absence there is the evidence they are not purchasable.

## Ships — test coverage

### 8. No external ground truth for shields, armour or weapon DPS

A journal `Loadout` event never reports them, so the corpus validates mass, capacities,
jump range and credits against Frontier's own figures but checks the defence and weapon
metrics only against our own maths. An EDSY or Coriolis reading of a weaponed build
would close this — it is the largest remaining hole in the parity story.

### 9. Only two builds in the corpus carry a source's own figures

`fixtures/ships/builds/` now covers every hull with 2–5 real community builds,
including cargo-heavy ones (Type-9, Cutter and Panther trade fits), so breadth is no
longer the gap. What those 181 builds cannot do is *check* the maths: their pinned
figures are this library's own output. Only the Caspian Explorer EDSY export and the
Krait Phantom journal capture carry numbers computed elsewhere.

More builds of that kind are still worth having — a journal capture for a large trader
would confirm laden jump range and cargo mass at a scale the Krait's 32 t cannot.
Acquisition constraint: such a source must carry a licence that permits redistribution.
A Viper Mk IV capture from `UFO-Studios/EDDP` was checked and passed, but its repository
states no licence (`NOASSERTION`), so it was not committed.

## Ships — API

### 10. `Misc_LightWeight` is rejected on the modules that most often carry it

`applyBlueprint` maps a blueprint to a module *family* and refuses a mismatch. The
Lightweight recipe used by life support, limpet controllers and AFMUs is
`Misc_LightWeight`, but `blueprintTargets` claims it targets only
"miscellaneous/chaff/heatSink/pointDefence", so the call throws for exactly the fits
real builds use. Measured on `fixtures/ships/builds/`: **76 of the corpus's 1902 declared
engineering entries are rejected for a target-family mismatch**, 52 of them
`Misc_LightWeight` (45 on life support, 5 on collector controllers, 2 on scanners) across
47 builds, and `fixtures/ships/slef-the-deep-black.json` — already in the repository —
carries `Misc_LightWeight` on its life support. `Misc_Shielded` fails the same way on
AFMUs, collector controllers, fuel scoops and life support (19), as does
`Misc_HeatSinkCapacity` on the Caustic Sink Launcher (2 — the launcher's engineering
target is `miscellaneous`, not `heatSink`, so the ordinary heat sink launcher is fine and
this one is not), and `Misc_Reinforced`, `HatchBreakerLimpet_LightWeight` and
`Sensor_LongRange` on a scanner (1 each). Together with §4 that is 481 of 1902 entries
rejected, across 128 of the 181 builds. The mapping in `engineering-compatibility.ts`
needs the wider target list; note `LifeSupport_LightWeight` and
`CollectionLimpet_LightWeight` also exist as separate recipe ids, so which id a build
carries depends on where it was authored.

### 11. Journal-only fields do not survive an import

`LoadoutEvent` omits fields real journals carry: `timestamp`, `ShipID`, `HullHealth`,
`Hot`, module `AmmoInClip` / `AmmoInHopper`, and engineering `Engineer` / `EngineerID` /
`BlueprintID`. They pass `parseSlef` harmlessly — the validators allow-list rather than
key-close — but `cloneLoadoutModule` and `ShipLoadout.fromLoadout` drop them, so a
journal → `ShipLoadout` → SLEF round trip loses them.

Deliberately out of scope when SLEF export was added; the additions would all be
optional and backwards-compatible.

### 12. An export cannot report what a build actually cost

Credits are quoted at retail, so a source's own purchase record — the station discount
it was bought at, and any per-module `Value` — is dropped on the way out. That is the
intended behaviour, but it means a consumer wanting "what did this commander pay" has
nowhere to get it. If that turns out to be wanted, the honest shape is a separate
accessor for the source's stated figures rather than putting them back in the export,
where they would be indistinguishable from list prices.

### 13. The cosmetic slot families are a hand-maintained list

`COSMETIC_SLOT_PATTERNS` in `typescript/src/ships/ship-loadout.ts` names the journal slot
families that hold cosmetics rather than outfitting — cockpit, paint, decals, nameplates,
bobbles, ship kits, colours, voice packs, string lights — and
`fixtures/ships/slef-export.json` pins it under `classification` so a port draws the same
line.

Matching is **positive**, which is the safe direction: an article the catalogue can
identify counts whatever its slot is called, and anything neither the catalogue nor this
list recognises is unknown, so an export omits the figures rather than understating them.
The cost is that a cosmetic family Frontier adds later takes `ModulesValue`,
`UnladenMass`, `MaxJumpRange` and `Rebuy` off every build wearing it until the list is
extended. The Krait Phantom capture exercises 15 of the families; the rest rest on the
journal documentation. Worth re-checking whenever a capture joins the corpus.

### 14. `modulesValue` and `rebuy` getters die on a no-op refit

`#adjustImportedFigures` deletes both from `#top` on any `setModule`, including
re-fitting the identical module, so the getters that report the *source's* figures start
returning `null`. Exports are unaffected — they never read those fields. Cheap fix: skip
the delete when `previous?.Item === next?.Item`.
