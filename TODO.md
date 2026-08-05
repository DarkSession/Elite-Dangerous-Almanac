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
problem (§5 and §12). Both source registries carry the missing lists (EDSY
`mtype[].blueprints` / `.expeffects`, coriolis `modifications/modules.json`).

### 2. Eleven hulls name their journal slots in ways `enumerateSlots` does not

`enumerateSlots` numbers a hull's unrestricted optionals `Slot01_SizeN`,
`Slot02_SizeN`, … with no gaps, and its hardpoints `1, 2, 3` within each size class.
**Neither rule is what the game does on 11 hulls.** EDSY's `ship[…].slotnames` — the
table `edsy.js` reads journal slot names with (`Build.fromJournal`) and writes them back
from (`exportJournal`) — carries an override for exactly **13** hulls. The 2026-08-04
pass reproduces two of them (Panther Clipper Mk II, Type-11 Prospector) exactly; the
other eleven diverge, every one of them a naming difference alone:

| Hull | EDSY's journal names | `enumerateSlots` |
| --- | --- | --- |
| Anaconda | `…Slot10_Size4`, **`Slot13_Size2`**, **`Slot14_Size1`** | `…Slot11_Size2`, `Slot12_Size1` |
| Type-9 Heavy | **`Slot00_Size8`** first, then `Slot01`…`Slot08`, **`Slot11_Size2`**, **`Slot12_Size1`** | `Slot01`…`Slot11`, 1-based, no gap |
| Type-10 Defender | `Slot01`…`Slot08`, **`Slot11_Size2`**, **`Slot12_Size1`** | `Slot09_Size2`, `Slot10_Size1` |
| Federal Dropship | `…Slot06_Size3`, **`Slot09_Size2`**, **`Slot10_Size1`** | `Slot07_Size2`, `Slot08_Size1` |
| Vulture | `Slot01`, `Slot02`, `Slot03`, **`Slot05`**, `Slot06`, `Slot07`, `Slot08` | `Slot01`…`Slot07` |
| Type-7 Transporter | `Slot01_Size6`, `Slot02_Size6`, `Slot03_Size5`, `Slot04_Size5`, `Slot05_Size4`, `Slot06_Size4`, `Slot07_Size2`, `Slot08_Size2`, `Slot09_Size2`, **`Slot09_Size1`** — the number 09 twice, and six of the ten suffixes misreport the size | `Slot01_Size6`…`Slot10_Size1`, sizes 6,6,6,5,5,5,3,3,2,1 |
| Keelback | `Slot03_Size3` on a slot that is size **4** | `Slot03_Size4` |
| Asp Scout | `Slot01_Size4` on a slot that is size **5** | `Slot01_Size5` |
| **Type-8 Transporter** | *hardpoints* `…SmallHardpoint2`, **`SmallHardpoint4`**, `SmallHardpoint5`, `SmallHardpoint6` | `SmallHardpoint3`, `4`, `5` |
| **Caspian Explorer** | *hardpoints* `LargeHardpoint1`, **`MediumHardpoint6`**, **`MediumHardpoint5`**, `MediumHardpoint1`…`4` — out of order, not merely gapped | `MediumHardpoint1`…`6` in layout order |
| Lynx Highliner | `Slot01_Size6`, **`Passenger01`…`03`**, `Slot02_Size5`, … (§3) | `Slot01`…`Slot10` |

Two things this is **not**. It is not a size disagreement: our `hardpoints` and
`optional` sizes match EDSY's own `slots` arrays for all 13 hulls, so only the names
differ. And on the Keelback, Asp Scout and Type-7 the journal's own `_SizeN` suffix
misreports the slot — `edsy.js` compensates for exactly that, taking the greater of the
name's size and the fitted module's class, which is why those rows show a size in the
name that the hull does not have.

The restricted mounts closed in the 2026-08-04 pass (see `data/ships/SOURCES.md`) fixed
the *rule* — a restricted mount takes a name of its own and consumes no `SlotNN` number
— but not this. The consequence is one-directional: a build **assembled here** on one of
those hulls emits slot keys a game journal would not use, so a SLEF export of it names
slots the game does not have. Import is unaffected, since `parseSlotName` reads kind and
size off the name rather than matching a hull's list. The Caspian Explorer is the worst
case, because its keys are not merely renumbered — a build assembled here puts a weapon
in a *different physical mount* than the same key would in game.

The honest fix is a per-hull slot-name override in `ships.jsonc` (an optional
`slotNames` alongside `hardpoints`/`optional`, mirroring EDSY's own shape) rather than a
cleverer numbering rule — the sequences have no derivable pattern. Only EDSY carries
them; coriolis-data does not model journal names at all, so a second source would have
to be real journal captures.

### 3. Four restricted-mount rules the game has that nothing here models

`SlotRestriction` now has six values — `mining` on a hardpoint, and `military`,
`planetaryApproachSuite`, `cargo`, `limpetController` and `vesselHangar` on an optional.
Four further rules are visible in the sources and deliberately not stored, each for its
own reason:

- **Passenger-reserved optionals.** The Lynx Highliner's two size-6 and one size-5
  optionals take passenger cabins only; EDSY names them `Passenger01`..`Passenger03`
  and reserves them to `{ipc:1}`. Unlike every other restricted family, `PASSENGER` is
  **not** in EDSY's journal import map and its eligibility check for `ipc` is commented
  out in `edsy.js`, so the journal name is the one unconfirmed thing about it. Fill it
  from a real journal `Loadout` for a Lynx; the rest of the mechanism is already in
  place (`OptionalRestriction` + a `restriction` value + a prefix list).
- **The restriction's other half: a module that fits *only* a restricted mount.** The
  planetary approach suite is the one module modelled this way (`setModule` refuses it
  in any other slot), but the sources give two more. EDSY reserves
  `Int_LargeCargoRack_Size7_Class1` and `_Size8_Class1` (Mk II Cargo Rack) to ship 63,
  the Panther Clipper Mk II, and `edsy.js` refuses any reserved `icr` outside a slot
  named `CARGO*`; coriolis-data carries the same as `"restriction": "Cargo"` on the
  module and describes it as a "Panther Clipper storage rack". The Mk II Mining
  Multi-Limpet Controller is the same shape against `LIMPETCONTROLLER*`.

  Both now carry the hull half — `restrictedToShips: ["PantherMkII"]` on the racks
  (added 2026-08-04, after a review found a Type-9 happily carrying one) and
  `["LakonMiner"]` on the controller — so neither leaks onto a hull that cannot buy it.
  **The slot half is what remains**, and it is the same for both:
  `ShipLoadout.empty('PantherMkII').setModule('Slot01_Size8', mkIICargoRack)` still
  succeeds although the game only sells that rack for `Cargo01`/`Cargo02`, and the
  controller is still accepted in the Type-11's unrestricted `Slot05_Size5`. The fix is
  a module-side field naming the slot restriction a module *requires* — the mirror of
  `OptionalRestriction` — which would also let the planetary approach suite's
  hard-coded special case in `#fitError` become ordinary data.
- **Mount-type restrictions on a hardpoint.** Nothing here records that a mount is
  fixed-only, gimballed-only or turret-only; `OutfittingModule.mount` carries the
  weapon's side of it, but no hull says a mount refuses a turret.
- **The size-0 utility mount rules.** `utility` is a bare count, so a utility mount
  cannot carry a restriction either. No hull is known to need one — this is recorded so
  the omission is visible, not because a case exists.

### 4. Three stat gaps the 2026-08-02 reconciliation did not close

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

### 5. Blueprints cannot be applied to most real builds: base stats are missing

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

### 6. Four corrosion-resistant cargo racks have no price at all

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

### 7. Two experimental effects exist in the game that no public dataset carries

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

### 8. Module identities exist that no outfitting registry lists

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

### 9. No external ground truth for shields, armour or weapon DPS

A journal `Loadout` event never reports them, so the corpus validates mass, capacities,
jump range and credits against Frontier's own figures but checks the defence and weapon
metrics only against our own maths. An EDSY or Coriolis reading of a weaponed build
would close this — it is the largest remaining hole in the parity story.

### 10. Only three builds in the corpus carry a source's own figures

`fixtures/ships/builds/` now covers every hull with 2–5 real community builds,
including cargo-heavy ones (Type-9, Cutter and Panther trade fits), so breadth is no
longer the gap. What those 181 builds cannot do is *check* the maths: their pinned
figures are this library's own output. Only the Caspian Explorer EDSY export, the
Krait Phantom journal capture and the Inara Type-11 export (added 2026-08-04) carry
numbers computed elsewhere.

More builds of that kind are still worth having — a journal capture for a large trader
would confirm laden jump range and cargo mass at a scale the Krait's 32 t cannot, and
none of the three carries an external shield, armour or DPS figure, which is §9's gap.
Acquisition constraint: such a source must carry a licence that permits redistribution.
A Viper Mk IV capture from `UFO-Studios/EDDP` was checked and passed, but its repository
states no licence (`NOASSERTION`), so it was not committed.

## Ships — API

### 11. A build imported from Inara binds to no slot at all, and editing it duplicates modules

**Slot keys are matched case-sensitively, and Inara lower-cases every one of them.**
`fixtures/ships/slef-inara-type-11.json` is a real Inara export whose slots read
`largemininghardpoint1`, `powerplant`, `slot01_size6`. Nothing in `slots()` binds to
them, so on a 27-module build:

| | |
| --- | --- |
| `slots()` occupied | **0 of 27** |
| `moduleAt('LargeMiningHardpoint1')` | `null` |
| `getFittedModule('FrameShiftDrive')` | `null` |
| `hardpoints()[0].module` | `null` |
| `parseSlotName('powerplant')` | `null` |

The figures are unaffected, because they read the module map rather than the layout:
mass, cargo, jump range, power, weapons, `modulesValue` and `rebuy` are all correct,
and a SLEF round trip preserves every module. **Editing is the dangerous part.**
`setModule('LargeMiningHardpoint1', …)` does not replace the lower-cased entry, it
*adds* one: the build goes to 28 modules carrying two large mining hardpoints, which
inflates mass, power draw, cargo and credits with no error.

This affects **every hull and every Inara-sourced SLEF**, and predates the slot
restrictions — `powerplant` fails exactly like `largemininghardpoint1`. It went unseen
because both other ground-truth fixtures are EDSY and journal exports, which use
Frontier's own casing. `ship-loadout.ts` already notes that producers lower-case slot
keys "as the SLEF specification's own example does", and handles it for cosmetic
classification but not for slot binding.

The fix is to resolve slot keys case-insensitively in `#requireSlot`, `moduleAt`,
`getFittedModule`, `setModule`, `removeModule` and the occupancy check, and to let
`parseSlotName` classify any casing — **not** to canonicalise keys on import, which
would break the byte-identical re-export the round-trip tests pin. Until then, tests
over the Inara fixture compare slot keys case-insensitively.

### 12. `Misc_LightWeight` is rejected on the modules that most often carry it

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
`Sensor_LongRange` on a scanner (1 each). Together with §5 that is 481 of 1902 entries
rejected, across 128 of the 181 builds. The mapping in `engineering-compatibility.ts`
needs the wider target list; note `LifeSupport_LightWeight` and
`CollectionLimpet_LightWeight` also exist as separate recipe ids, so which id a build
carries depends on where it was authored.

### 13. Journal-only fields do not survive an import

`LoadoutEvent` omits fields real journals carry: `timestamp`, `ShipID`, `HullHealth`,
`Hot`, module `AmmoInClip` / `AmmoInHopper`, and engineering `Engineer` / `EngineerID` /
`BlueprintID`. They pass `parseSlef` harmlessly — the validators allow-list rather than
key-close — but `cloneLoadoutModule` and `ShipLoadout.fromLoadout` drop them, so a
journal → `ShipLoadout` → SLEF round trip loses them.

Deliberately out of scope when SLEF export was added; the additions would all be
optional and backwards-compatible.

### 14. An export cannot report what a build actually cost

Credits are quoted at retail, so a source's own purchase record — the station discount
it was bought at, and any per-module `Value` — is dropped on the way out. That is the
intended behaviour, but it means a consumer wanting "what did this commander pay" has
nowhere to get it. If that turns out to be wanted, the honest shape is a separate
accessor for the source's stated figures rather than putting them back in the export,
where they would be indistinguishable from list prices.

### 15. The cosmetic slot families are a hand-maintained list

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

### 16. `modulesValue` and `rebuy` getters die on a no-op refit

`#adjustImportedFigures` deletes both from `#top` on any `setModule`, including
re-fitting the identical module, so the getters that report the *source's* figures start
returning `null`. Exports are unaffected — they never read those fields. Cheap fix: skip
the delete when `previous?.Item === next?.Item`.
