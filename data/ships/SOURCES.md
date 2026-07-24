# Data sources — `data/ships/`

**Library snapshot:** 2026-07-24. **Initial upstream revision:** not recorded. See `../SNAPSHOTS.md` for the update policy and known limitation.

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
- **Kept deliberately (do not "fix" back):** the Lynx Highliner (`MediumTransport01`)
  has no coriolis hull entry, so it carries identity only — no stats and no slot
  layout. Stats and slots are present for the other 47 hulls.

## Modules (outfitting)

Each module is **one record** carrying its identity and its stats — identity from
FDevIDs, stats from coriolis-data, joined on `symbol`.

- **Files:** `modules-standard.jsonc`, `modules-internal.jsonc`,
  `modules-hardpoint.jsonc`, `modules-utility.jsonc`, and `fixtures/ships/modules.json`,
  `module-stats.json` (the stats half keeps its own parity fixture). Split along
  FDevIDs' four outfitting categories so an app that only wants weapons never bundles
  the 996 core and optional internals; see AGENTS.md §Build.
- **Identity source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), `outfitting.csv`
  (columns `id,symbol,category,name,mount,guidance,ship,class,rating,entitlement`),
  same licence note as above.
- **Identity derivation:** the 1190 modules are carried over in CSV order within each
  category file. The CSV's numeric `id` column is dropped — modules are keyed by
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

## Engineering (blueprints and experimental effects)

- **Files:** `blueprints.jsonc` (per-blueprint, per-grade stat modifiers **and**
  material requirements) and `experimental-effects.jsonc` (per special-effect stat
  modifiers), validated by `fixtures/ships/engineering.json`. Modifiers are resolved to
  journal Modifier **Labels** so the computed modifiers read back like a real
  `Engineering.Modifiers` block. Each blueprint grade is `{ features, materials }`.
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
- **Experimental-effect source:** [EDSY](https://github.com/taleden/EDSY) `eddb.js`
  `expeffect` — **coriolis-data does not carry the numeric experimental modifiers**,
  so these come from EDSY, whose code is (c) taleden under a **CC BY-NC 4.0** License
  (<http://creativecommons.org/licenses/by-nc/4.0/>). The underlying game logic is
  Elite Dangerous data, the property of Frontier Developments plc, under Frontier's
  media-usage terms. Each effect is a list of `{ label, method, value }`.
- **Journal Labels** for both sources are resolved via EDSY's own attribute table
  (`attr → fdattr`), the authority for the exact Label strings the game writes
  (e.g. coriolis `optmass` on an FSD → `FSDOptimalMass`, `maxfuel` → `MaxFuelPerJump`).
  Group-ambiguous keys (`optmass`, `optmul`, `thermload`) are disambiguated by the
  blueprint's target module group.
- **Kept deliberately (do not "fix" back):** weapon-combat-only experimental effects
  are dropped, matching the stats layer (which carries no weapon combat stats).
- **Calculator:** `typescript/src/ships/engineering.ts` (`computeModifiers`), wired
  into `ShipLoadout.applyBlueprint`. Validated to reproduce the real "Deep Black"
  export's engineered figures — `FSDOptimalMass` 4670 → **7528.04** at G5 Long Range
  with the Mass Manager (`special_fsd_heavy`) experimental.

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
