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
  `hardpoints` (the non-zero weapon-mount sizes) and `utility` (the count of zero
  entries); `slots.internal` becomes `optional`, each entry a `{ size }` with an
  optional `restriction` ("military" or "planetaryApproachSuite"). Coriolis's per-hull
  `bulkheads` are **not** kept on the hull: they are joined onto that hull's armour
  modules instead (see "Modules"), because armour is a module and the catalogue keeps a
  module's stats with the module. **Slot keys** are journal-compatible
  (`FrameShiftDrive`, `HugeHardpoint1`, `TinyHardpoint2`, `Slot01_Size6`, `Military01`,
  `PlanetaryApproachSuite`), so a build assembled from an empty hull and one loaded
  from a SLEF export share one vocabulary. See `typescript/src/ships/slots.ts`.
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
  optional slots — the slot schema has no passenger-reservation restriction.

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
  - **Corrosion-resistant cargo racks are now *unpriced* rather than `0`.**
    `Int_CorrosionProofCargoRack_Size{1_Class2,5_Class1,6_Class1}` read `cost: 0`
    upstream — a gap in coriolis, not the duplicate-symbol defect above, so there is no
    first occurrence to fall back on. They are certainly not free: the size-4 record is
    priced, and the Deep Black's journal buys it at 82 775 = 94 330 less that export's
    12.25% discount. Carrying `0` made a build with one silently under-report instead of
    omitting the figure, so the field is now omitted, matching `_Size2_Class1`, which
    never had one. Real prices from EDSY or Inara would close this.
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
  - **All 48 hulls are priced. 1175 of 1198 modules are.** The 23 without a price are the
    ten starter `*_free` variants, the five size-8 frame shift drives, the three Mk II
    Vessel Hangars, **all four** Corrosion Resistant Cargo Racks and
    `Int_ShieldGenerator_Size1_Class4` — no registry publishes a figure for them. Three of
    the four racks joined the list in the 2026-08-02 revision described above, which is
    why this count moved from 1178/20. **`cost` is omitted, never set to 0**:
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

Two facts this build established that the EDSY export could not:

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
published price the total is omitted rather than under-reported — 23 catalogue records
can trigger that today: the four corrosion-resistant racks, the three Mk II vessel
hangars, `Int_ShieldGenerator_Size1_Class4`, `Int_Hyperdrive_Size8_Class{1..5}` and the
ten `*_free` starter variants.

Physical figures (`UnladenMass`, `CargoCapacity`, `FuelCapacity`, `MaxJumpRange`) are
recomputed too, and unlike the credits they **do** reproduce each source's own figures
exactly — which is what shows the recomputation is right rather than merely
self-consistent.

**Still missing external ground truth:** shields, armour and weapon DPS. A journal never
reports them, and the only builds in the corpus with weapons are checked against our own
maths. An EDSY or Coriolis reading of a weaponed build would close that gap, as would a
trade or mining hull — the corpus has an explorer, a combat multirole and a small
combat hull, but nothing cargo-heavy beyond the Krait's 32 t.
