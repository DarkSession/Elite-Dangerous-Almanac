# TODO

Known gaps and follow-up work, newest first. Long-form provenance and the reasoning
behind a decision live in the relevant `data/<domain>/SOURCES.md`; this file is the
short, actionable list.

## Ships — data gaps

### 1. Three stat gaps the 2026-08-02 reconciliation did not close

All three were surfaced by that pass and deliberately left rather than guessed. Long-form
reasoning in `data/ships/SOURCES.md`.

**a. 83 non-armour records still have no `integrity`.** Mostly the families that carry no
other mechanical stat either — passenger cabins (23), hull and Guardian/meta-alloy
reinforcement packages (30), fuel tanks (9), cargo racks (16), module stabilisers,
planetary approach suites. Neither Frontier's module definitions nor EDSY carries an
integrity for them. A further 241 records without `integrity` are ship armour, which is a
different shape and not counted here.

**b. The four `Int_StellarBodyDiscoveryScanner_*` records have no `powerDraw`.** They are
the remainder of the old "106 modules are missing `powerDraw`" gap. No source has a value:
Frontier's definitions give them only mass, integrity and size, EDSY the same, and
coriolis-data has no record for them at all. They are withdrawn modules whose function is
built in now, so `0` is plausible but unsourced — left absent, since absent means unknown.

**c. `Int_FuelTank_Size1_Class3_free` and `Int_CargoRack_Size2_Class1_free` have `mass`
and nothing else.** Their paid twins carry `fuelCapacity: 2` and `cargoCapacity: 4`, and
these are almost certainly the same modules, but no source states the capacity for the
`_free` rows and inferring it from the twin would be invention. Consequence: a build
using either reports zero fuel or cargo from it, so `jumpRange()` and a SLEF
`CargoCapacity` are wrong for a stock starter fit. Fill from a real journal `Loadout` of
a stock Sidewinder or Adder. Note these two are why "every module now has stats" is a
weaker claim than it sounds — they clear that bar on `mass` alone.

### 2. Frame Shift Drive and thruster heat rates are not carried

Frontier's module definitions expose an `FSDHeatRate` on every frame shift drive and an
engine heat rate on every thruster — 72 and 40 records respectively in this catalogue.
There is no field for either, so `unresolvedModifiers()` still reports `FSDHeatRate` on
the pre-engineered V1 drive (pinned in `fixtures/ships/pre-engineered.json`): a blueprint
can modify a stat the records do not hold.

Adding it means a new `OutfittingModule` field, its TSDoc, a `schemas/ships` property, a
`module-stat-labels` entry and fixture pins, so it was left out of the 2026-08-02 stat
pass rather than half-done. Nothing computes with heat today, which is why this is a gap
and not a defect.

### 3. Four corrosion-resistant cargo racks have no price at all

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

### 4. Two experimental effects exist in the game that no public dataset carries

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

### 5. Module identities exist that no outfitting registry lists

Reconciling against Frontier's module definitions surfaced 535 identities this
catalogue does not carry. **None of them appear in EDCD FDevIDs `outfitting.csv`**, so
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

### 6. No external ground truth for shields, armour or weapon DPS

A journal `Loadout` event never reports them, so the corpus validates mass, capacities,
jump range and credits against Frontier's own figures but checks the defence and weapon
metrics only against our own maths. An EDSY or Coriolis reading of a weaponed build
would close this — it is the largest remaining hole in the parity story.

### 7. The build corpus has no cargo-heavy hull

`fixtures/ships/` holds two real builds: an exploration Caspian Explorer (EDSY export)
and a combat Krait Phantom (journal capture). Nothing exercises a large cargo hold or
the laden-vs-unladen jump-range gap at scale; the Krait's 32 t is the maximum. A Type-9
or Cutter journal capture would help.

Acquisition constraint: the source must carry a licence that permits redistribution. A
Viper Mk IV capture from `UFO-Studios/EDDP` was checked and passed, but its repository
states no licence (`NOASSERTION`), so it was not committed.

## Ships — API

### 8. Journal-only fields do not survive an import

`LoadoutEvent` omits fields real journals carry: `timestamp`, `ShipID`, `HullHealth`,
`Hot`, module `AmmoInClip` / `AmmoInHopper`, and engineering `Engineer` / `EngineerID` /
`BlueprintID`. They pass `parseSlef` harmlessly — the validators allow-list rather than
key-close — but `cloneLoadoutModule` and `ShipLoadout.fromLoadout` drop them, so a
journal → `ShipLoadout` → SLEF round trip loses them.

Deliberately out of scope when SLEF export was added; the additions would all be
optional and backwards-compatible.

### 9. An export cannot report what a build actually cost

Credits are quoted at retail, so a source's own purchase record — the station discount
it was bought at, and any per-module `Value` — is dropped on the way out. That is the
intended behaviour, but it means a consumer wanting "what did this commander pay" has
nowhere to get it. If that turns out to be wanted, the honest shape is a separate
accessor for the source's stated figures rather than putting them back in the export,
where they would be indistinguishable from list prices.

### 10. The cosmetic slot families are a hand-maintained list

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

### 11. `modulesValue` and `rebuy` getters die on a no-op refit

`#adjustImportedFigures` deletes both from `#top` on any `setModule`, including
re-fitting the identical module, so the getters that report the *source's* figures start
returning `null`. Exports are unaffected — they never read those fields. Cheap fix: skip
the delete when `previous?.Item === next?.Item`.
