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

- **Files:** `ships.jsonc` (48 player-flyable hulls) and `fixtures/ships/ships.json`.
- **Source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), the community-maintained
  registry of Frontier's internal ids and names (`shipyard.csv`, columns
  `id,symbol,name,entitlement`). FDevIDs states no explicit licence; consult the
  repository terms before redistributing the raw identifiers.
- **Derivation:** records are carried over in shipyard order (roughly the order
  hulls were introduced): internal `symbol` and display `name`. The CSV's numeric
  ship-type `id` column is dropped — hulls are keyed by `symbol`. `entitlement` is
  FDevIDs' DLC/grant token, kept only where the CSV gives one (28 of the 48 hulls
  carry no entitlement, so the field is omitted for them rather than stored empty).

## Modules (outfitting)

- **Files:** `modules-standard.jsonc`, `modules-internal.jsonc`,
  `modules-hardpoint.jsonc`, `modules-utility.jsonc`, and
  `fixtures/ships/modules.json`. Split along FDevIDs' four outfitting categories so
  an app that only wants weapons never bundles the 996 core and optional internals;
  see AGENTS.md §Build.
- **Source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), `outfitting.csv`
  (columns `id,symbol,category,name,mount,guidance,ship,class,rating,entitlement`),
  same licence note as above.
- **Derivation:** the 1190 modules are carried over in CSV order within each
  category file. The CSV's numeric `id` column is dropped — modules are keyed by
  `symbol`. `class` is FDevIDs' `class` — the module size (0–8) — and `rating`
  its grade letter (A–I); together they are the "5A" the outfitting screen shows.
  `mount` (Fixed / Gimballed / Turreted) and `guidance` (Dumbfire / Seeker / Swarm)
  are stored only on the hardpoints that carry them; `ship` names the hull an armour
  variant belongs to (armour is the one ship-specific module, so only the 241 armour
  records carry it); `entitlement` is kept only where it is a real DLC/grant token.
- **Kept as-is from the source (do not "fix" these back):**
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

## Ship and module stats

- **Files:** `ship-stats.jsonc` (per-hull stats) and `module-stats-standard.jsonc` /
  `-internal.jsonc` / `-hardpoint.jsonc` / `-utility.jsonc` (per-module stats),
  plus `fixtures/ships/ship-stats.json` and `fixtures/ships/module-stats.json`.
  These are the **numbers** behind the id/name registries above; each stats record
  is keyed by the same Frontier `symbol`, so the two join on `symbol`.
- **Source:** [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data),
  `ships/*.json` and `modules/**`, **commit `0db9234b5b9ce8c939ea84133d7ce336eea88e27`**
  (`master`, acquired 2026-07-24 UTC). Coriolis-data's `LICENSE.md` releases only its
  *code* under MIT; the JSON **stat values are Elite Dangerous game data, the property
  of Frontier Developments plc**, redistributed here under Frontier's media-usage
  terms (see the repository `LICENSE` and `README.md`).
- **Derivation:** a join script (kept out of the shipped package) reads each registry
  file, looks up the matching coriolis record by `symbol` (case-insensitively), and
  copies a fixed whitelist of fields under clearer names — e.g. coriolis `optmass`→
  `optMass`, `fuelmul`→`fuelMul`, `pgen`→`powerCapacity`, `wepcap`→`weaponsCapacity`.
  Ship stats join coriolis `ships/*.json` `properties` to the registry by display
  name (normalised; coriolis "Viper" ⇒ registry "Viper MkIII"). Masses are tonnes,
  power megawatts, ranges light-years.
- **Kept deliberately (do not "fix" back):**
  - **`name` is repeated** on every module-stats record (the registry's display
    name) so a stats record is legible on its own, even though the registry already
    carries it.
  - **`restrictedToShips`** carries the hull symbol(s) a non-armour module is limited
    to (coriolis's `ship` field: the MkII Gravity Optimised thrusters → `Explorer_NX`,
    the MkII Agile Boost thrusters → `SmallCombat01_NX` "Kestrel", the MkII Mining
    controller and Mining Volley Repeater → `LakonMiner`). **Armour's** hull
    restriction is *not* repeated here — it lives in the registry
    (`OutfittingModule.ship` / `getModulesForShip`).
  - **Only mechanical/engineering stats are carried; weapon combat stats** (damage,
    falloff, breach, thermal load, …) are intentionally left out — a separate domain
    no current calculation needs.
  - **Coverage is a subset of the registry:** ship-specific armour has no generic
    module stats (0 armour rows), and the Lynx Highliner (`MediumTransport01`) has no
    coriolis hull entry, so it has no ship-stats row.
  - **Pre-engineered/duplicate drives share a `symbol`** in coriolis (e.g. the V1
    FSDs); the first (primary) occurrence wins, and any baked engineering is expected
    to arrive as SLEF `Engineering.Modifiers` instead.

## Ship slot layouts

- **Files:** `ship-slots.jsonc` (per-hull mount layout) and
  `fixtures/ships/ship-slots.json`. Keyed by the same Frontier `symbol` as the
  registries above; the two join on `symbol`.
- **Source:** [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data),
  `ships/*.json` `slots` + `bulkheads`, same commit and Frontier media-usage terms
  as the stats above.
- **Derivation:** coriolis's fixed-order `slots.standard` seven-array becomes the
  seven named `core` sizes (power plant, thrusters, frame shift drive, life support,
  power distributor, sensors, fuel tank); `slots.hardpoints` splits into `hardpoints`
  (the non-zero weapon-mount sizes) and `utility` (the count of zero entries);
  `slots.internal` becomes `optional`, each entry a `{ size }` with an optional
  `restriction` ("military" or "planetaryApproachSuite"). `bulkheads` keeps each
  armour option's name and added mass (t) for later armour-mass computation (the
  default Lightweight Alloy is zero-mass). Present for the 47 hulls coriolis carries.
- **Slot keys** are journal-compatible (`FrameShiftDrive`, `HugeHardpoint1`,
  `TinyHardpoint2`, `Slot01_Size6`, `Military01`, `PlanetaryApproachSuite`), so a
  build assembled from an empty hull and one loaded from a SLEF export share one
  vocabulary. See `typescript/src/ships/slots.ts`.

## Engineering (blueprints and experimental effects)

- **Files:** `blueprints.jsonc` (per-blueprint, per-grade stat modifiers) and
  `experimental-effects.jsonc` (per special-effect stat modifiers), validated by
  `fixtures/ships/engineering.json`. Both are resolved to journal Modifier **Labels**
  so the computed modifiers read back like a real `Engineering.Modifiers` block.
- **Blueprint source:** [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data),
  `modifications/blueprints.json` (features) + `modifications.json` (apply method),
  same commit and Frontier media-usage terms as above. Each grade is a list of
  `{ label, method, min, max }`; the modifier value is bounded by the engineering
  quality roll (`v = min + (max − min)·quality`).
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
