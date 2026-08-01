# Data sources — `data/ships/`

**Library snapshot:** 2026-07-24. **Initial upstream revision:** not recorded. See `../SNAPSHOTS.md` for the update policy and known limitation.

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
  `hardpoints` (the non-zero weapon-mount sizes) and `utility` (the count of zero
  entries); `slots.internal` becomes `optional`, each entry a `{ size }` with an
  optional `restriction` ("military" or "planetaryApproachSuite"). `bulkheads` keeps
  each armour option's name and added mass (t) for armour-mass computation (the
  default Lightweight Alloy is zero-mass). **Slot keys** are journal-compatible
  (`FrameShiftDrive`, `HugeHardpoint1`, `TinyHardpoint2`, `Slot01_Size6`, `Military01`,
  `PlanetaryApproachSuite`), so a build assembled from an empty hull and one loaded
  from a SLEF export share one vocabulary. See `typescript/src/ships/slots.ts`.
- **Lynx Highliner (`MediumTransport01`) — from EDSY + Frontier's Lynx update notes:**
  the Lynx has no coriolis hull entry, so its stats and slot layout are sourced instead
  from EDSY's ship data and Frontier's Lynx update notes (hull mass 260 t, 285/350 m/s,
  200/350 base shield/armour, hardness 55, 2 crew, rotation 26/60/19 deg/s, min thrust
  73.75%; core PP5/thr6/FSD5/LS6/dist5/sen3/tank5; hardpoints 1 large + 4 medium;
  4 utilities; optionals 6/6/6/5/5/4/4/3/2/1; five bulkheads at 0/26/53/53/53 t). Values
  the static catalogue does not expose are omitted rather than invented: `masslock`,
  `heatCapacity`, `pipSpeed`, acceleration, and the min-pitch / boost-energy figures.
  The two size-6 and one size-5 passenger-reserved optionals are stored as plain
  optional slots — the slot schema has no passenger-reservation restriction.

## Modules (outfitting)

Each module is **one record** carrying its identity and its stats — identity from
FDevIDs, stats from coriolis-data, joined on `symbol`.

- **Files:** `modules-standard.jsonc`, `modules-internal.jsonc`,
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
  megawatts, ranges light-years.
- **Stats kept deliberately (do not "fix" back):**
  - **`restrictedToShips`** carries the hull symbol(s) a non-armour module is limited
    to (coriolis's `ship` field: the MkII Gravity Optimised thrusters → `Explorer_NX`,
    the MkII Agile Boost thrusters → `SmallCombat01_NX` "Kestrel", the MkII Mining
    controller and Mining Volley Repeater → `LakonMiner`). **Armour's** hull
    restriction is _not_ repeated here — it lives in the `ship` field
    (`OutfittingModule.ship` / `getModulesForShip`).
  - **Only mechanical/engineering stats are carried; weapon combat stats** (damage,
    falloff, breach, thermal load, …) are intentionally left out — a separate domain
    no current calculation needs.
  - **Coverage is a subset of the registry:** ship-specific armour has no generic
    module stats (0 armour rows carry stats), so those records are identity-only.
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
- **Operations / Lynx additions — from EDSY, Inara and Frontier's update notes** (not
  in coriolis-data / FDevIDs at the acquired commit):
  - **Mk II Vessel Hangars** (`Int_FighterBayMk2_Size{5,6,7}_Class1`) — new internal
    records with the same operational stats as the Mk I bays at half the mass
    (10/20/30 t, integrity 60/80/120, power 0.25/0.35/0.35 MW). The three Mk I
    **Fighter Hangar** records were renamed to **Mk I Vessel Hangar** (same symbols and
    stats; the Operations update renamed them and let them deploy the Nomad). The Mk II
    bays' restriction to the Caspian Explorer / Panther Clipper Mk II / Type-11
    Prospector is documented but not stored — those hull symbols are not in the registry.
  - **Mk II passenger cabins** (`Int_MkII_PassengerCabin_Size{2..6}_Class{1,2}`) already
    existed as identity records; their mass was added (2.5/5/10/20/40 t by size) and the
    two size-6 records' `class` was corrected from 5 to 6.
  - **Corrosion Resistant Cargo Racks** `Int_CorrosionProofCargoRack_Size{2,5,6}_Class1`
    (capacity 4/32/64) and the built-in **Cargo Hatch** `ModularCargoBayDoor`
    (power 0.6 MW) were added — active EDSY records the FDevIDs join had omitted.
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
  - **All 48 hulls are priced. 1178 of 1198 modules are.** The 20 without a price are
    the starter `*_free` variants, the size-8 frame shift drives, the three Mk II Vessel
    Hangars, the size-2 Corrosion Resistant Cargo Rack and `Int_ShieldGenerator_Size1_Class4`
    — no registry publishes a figure for them. **`cost` is omitted, never set to 0**:
    `0` is a real price (the starter Lightweight Alloy bulkhead costs nothing), so a
    cost calculation must be able to tell "free" from "unknown".
  - **Still not modelled:** the **Merc-Coin** price of the pre-engineered variants (a
    separate currency, not credits), passenger capacity, and fighter-bay/rebuild counts.
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

- **Files:** `blueprints.jsonc` (per-blueprint, per-grade stat modifiers **and**
  material requirements) and `experimental-effects.jsonc` (per special-effect stat
  modifiers **and** material cost), validated by `fixtures/ships/engineering.json`.
  Modifiers are resolved to journal Modifier **Labels** so the computed modifiers read
  back like a real `Engineering.Modifiers` block. Each blueprint is `{ name, grades }`
  (each grade `{ features, materials }`); each experimental effect is
  `{ name, modifiers, materials, description? }`.
- **Display names:** each blueprint and experimental effect carries its in-game `name`.
  Effect names are EDSY `expeffect[].name` (all 87); blueprint names are coriolis
  `blueprint.name` for the 81 journal-keyed blueprints and the Operations dossier's
  display label for the 27 `recipe_*` ones. Read them with `getBlueprintName` /
  `getExperimentalEffectName`.
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
  `expeffect` — **coriolis-data carries neither the numeric experimental modifiers nor
  their recipes**, so both come from EDSY, whose code is (c) taleden under a
  **CC BY-NC 4.0** License (<http://creativecommons.org/licenses/by-nc/4.0/>). The
  underlying game logic is Elite Dangerous data, the property of Frontier Developments
  plc, under Frontier's media-usage terms. Each effect is `{ modifiers, materials }`:
  `modifiers` a list of `{ label, method, value }`, `materials` its `mats` map resolved
  from EDSY's material short-codes to Frontier material `symbol`s against the `materials`
  domain, emitting `{ symbol, name, count }` per requirement. An experimental effect is a
  single application (one roll), so its `materials` is the whole cost.
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
  `isPreEngineered` in `typescript/src/ships/pre-engineered.ts`.
- **Why it is a catalogue of its own.** A pre-engineered module has **no symbol of its
  own** — the game sells an ordinary module with engineering already applied, and a
  journal `Loadout` reports it as the base `symbol` plus an `Engineering` block. So the
  module catalogues already hold every one of these modules and `blueprints.jsonc`
  already holds every one of these blueprints; what was missing was the **link** saying
  which stock modules can be bought already engineered, and with what. Each record is a
  pairing — `{ symbol, name, blueprint, grade, acquisition }` — not a module, which is
  also why it is exempt from the "unique symbols per catalogue" rule the other
  array-shaped files follow.
- **Neither column is a key on its own.** One base module is sold in several
  pre-engineered flavours (the 2B Missile Rack has three), and one blueprint is sold on
  several base modules (the Drag seeker on both the medium and the large rack). The
  `(symbol, blueprint)` pair is what is unique, so both lookups return arrays.
- **`acquisition` says where a variant comes from.** 51 records: 21 `mercenary` and
  30 `communityGoal`.
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
- **A community-goal reward is not reproducible by engineering the same blueprint.**
  Alongside its blueprint and effect, each reward carries hand-set modifier overrides no
  blueprint grants — that is what makes it a reward rather than a shortcut. The
  `blueprint` / `grade` / `experimental` recorded here **identify** the variant; they are
  not a recipe that recreates it. `getBlueprintCost` on a community-goal row prices
  ordinary engineering, not the reward.
- **Two community-goal rewards are not stored:** the size-5 and size-6 Corrosion
  Resistant Cargo Racks carry no engineering at all. They already exist as ordinary
  module records (`Int_CorrosionProofCargoRack_Size{5,6}_Class1`), so there is no pairing
  to record.
- **The identity of a variant is the `(symbol, blueprint, experimental)` triple.** No
  narrower key holds: one module carries several variants, one blueprint appears on
  several modules, and even `(symbol, blueprint)` repeats — the medium Seeker Missile
  Rack has two High Capacity community-goal rewards that differ only in the effect
  applied.
- **Deliberately not stored:** the Merc-Coin price. Modules and hulls carry a credit
  price (`cost` / `hullCost` / `retailCost`, see the modules section), but Merc Coin is a
  separate currency with no credit equivalent, so a shop price in MC has nowhere
  meaningful to live.
- **Not included:** engineered modules that are one-off mission or salvage rewards rather
  than a repeatable outfitting row. Those arrive in a build as their base symbol plus an
  `Engineering.Modifiers` block, which `ShipLoadout` already applies directly; there is no
  stable catalogue row to point at.

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
  `Loadout` event wrapped in a `{ header, data }` envelope).
