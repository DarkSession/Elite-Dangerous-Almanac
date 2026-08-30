# Localized game-name catalogues

These catalogues keep the canonical English display names already published by the
ships data domain and add only localized values carried explicitly by accepted sources.
They are deliberately sparse: absence means that no accepted source carried a value, and
the lookup API returns `null` for that locale rather than treating English as a
translation.

**Six locales are stored: `en`, `de`, `es`, `fr`, `pt` and `ru`.** Several accepted
sources publish more — Italian, Hungarian, Georgian and Simplified Chinese among them —
and those values are deliberately not carried: the project supports those six languages
and no others. That is a decision about this catalogue, not a gap in any source, so
re-deriving a catalogue from its source must drop the other columns again rather than
restore them. Every locale is stored under a bare language tag; a regional or script tag
resolves to its language.

**`pt` is Brazilian Portuguese.** Every accepted source publishes exactly one Portuguese
column and it is the Brazilian one: Odyssey Materials Helper's CSVs and EDSY's
`lang-pt.json` carry Brazilian spellings, EDDI's only populated Portuguese resource file
is `Modules.pt-BR.resx` (its `pt-PT` sibling is an empty stub), and Frontier's own
in-game localisation ships pt-BR and no European Portuguese. Storing it under the bare
tag follows the rule above, so `pt-PT` resolves to Brazilian Portuguese.

## `module-names.jsonc`

- **Acquired:** 2026-08-14 UTC.
- **EDDI revision:** commit `fdc1f47933bd930464610111fa11fc9dae264414`.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`.
- **Derivation:** all 1,199 current module symbols and English names come from the four
  `data/ships/modules-*.jsonc` catalogues. EDDI's `ModuleDefinitions.cs` joins a symbol
  to a resource key; `Properties/Modules.resx` and its localized siblings supply names.
  An EDDI value is accepted only when its base English resource exactly equals the
  Almanac's canonical English name. This prevents broad EDDI families such as
  `CargoRack`, `MissileRack` and `PlanetaryApproachSuite` from erasing the distinct Mk II,
  seeker and advanced names the Almanac carries. EDSY's module `fdname` and effective
  `namekey` fill a missing `de`, `es`, `fr` or `ru` value only when EDSY's English
  module name also exactly equals the canonical name. Values shared by modules with one
  canonical name are retained only when they agree, then stored once under that name.
- **Coverage:** English covers all 1,199 symbols. The explicit translations cover 1,120
  in German, 1,090 in Spanish, 1,088 in French, 1,155 in Brazilian Portuguese and 1,153
  in Russian. Portuguese comes from the same two joins, reading EDDI's
  `Modules.pt-BR.resx` and EDSY's `lang-pt.json`.
- **Manual corrections:** none.

## `blueprint-names.jsonc`

- **Acquired:** EDSY 2026-08-14 UTC; the in-game modification names 2026-08-23 UTC.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`.
- **In-game localisation revision:** none published; the game ships no immutable
  identifier for its localisation tables. The acquired table is the evidence.
- **Derivation:** each of the 107 current keys and its English name comes from
  `data/ships/blueprints.jsonc`. Names remain keyed per blueprint because a single
  English phrase can have different grammatical translations for different module
  families. The Frontier symbol joins case-insensitively to the in-game modification
  name table, which supplies every locale for the 90 recipes it names. The remaining 17
  are ids this repository keys separately because their numbers differ, where the game
  offers only the generic recipe's menu entry and so publishes only its name: each takes
  the locales of the generic id it shadows — `AFM_Shielded`, `Refineries_Shielded` and
  the four limpet-controller Shielded recipes from `Misc_Shielded`, the four
  `LightWeight` and four `Reinforced` limpet recipes from `Misc_LightWeight` and
  `Misc_Reinforced`, `MC_Overcharged` from `Weapon_Overcharged`, and `Scanner_LongRange`
  and `Scanner_WideAngle` from `Sensor_LongRange` and `Sensor_WideAngle`. The last three
  of those pairs are the same shadowing `blueprint-journal-names.jsonc` already records,
  where the game writes the generic id for a recipe this repository keys specifically.
  Only the English differs between a shadowing id and its generic: the Almanac's own
  canonical name is kept, as it is for every other blueprint. Where EDSY and the in-game
  table disagree the in-game value is kept, as everywhere else in this repository: it
  differs for ten values across four locales, all of them wording, none of them meaning.
- **Coverage:** complete. All 107 blueprints carry all six locales.
- **Manual corrections:** two values in the in-game table carry a stray leading or
  trailing ASCII space, marked in the acquired table and removed here so a successful
  lookup is already trimmed like every other catalogue name: French `FSD_FastBoot` (which
  EDSY carries with the same trailing space) and German `Railgun_LongShot`. The
  Portuguese `GuardianModule_Sturdy` and `GuardianWeapon_Sturdy` values carry a literal
  `<br>` line break for the in-game layout, which is stored as a single space.

## `experimental-effect-names.jsonc`

- **Acquired:** 2026-08-30 UTC.
- **In-game localisation revision:** none published; the game ships no immutable
  identifier for its localisation tables. The acquired table is the evidence.
- **Derivation:** each of the 86 current keys and its English name comes from
  `data/ships/experimental-effects.jsonc`, which stays authoritative for canonical
  English. The Frontier symbol joins to the in-game experimental-effect name table,
  which supplies every locale for all 86. The table replaces the EDSY join this
  catalogue previously used: where the two disagree the in-game value is kept, as
  everywhere else in this repository. It supplies six values EDSY did not carry — all
  five non-English `special_super_penetrator` names and the German
  `special_weapon_rateoffire` — and changes two EDSY already carried: German
  `special_regeneration_sequence` is "Regenerationssequenz" (EDSY
  "Regenerierungssequenz") and Brazilian Portuguese `special_lock_breaker` is "Quebra da
  Trava do Alvo" (EDSY "Quebra de Trava de Alvo"). Every other value agrees.
- **The three `_cooled` variants take their base effect's names.**
  `special_feedback_cascade_cooled`, `special_plasma_slug_cooled` and
  `special_super_penetrator_cooled` are pre-engineered rail-gun variants the game does
  not name separately, so the source marks them as carrying the base effect's entry.
  Each takes those values, exactly as a shadowing blueprint id takes its generic's.
- **Coverage:** complete. All 86 effects carry all six locales.
- **Manual corrections:** the source appends a `†` to every marked cell of the three
  `_cooled` variants above; it is the acquisition's own shadow marker rather than part of
  a name, and is removed here.

## `material-names.jsonc`

- **Acquired:** 2026-08-16 UTC.
- **Odyssey Materials Helper revision:** commit
  `23343c453938e724f317c56e9eb7db0dbfa71f78`.
- **Derivation:** each of the 146 current symbols and its canonical English name comes
  from the three `data/materials/materials-*.jsonc` catalogues. The lower-cased symbol
  joins directly to the final component of Odyssey Materials Helper's message key in
  `locale/material/horizons/{raw,manufactured,encoded}.csv`; only that row's explicit
  localized columns are copied. The source's English column is not copied because the
  owning materials catalogues remain authoritative for canonical names. The canonical
  English values therefore keep the existing `Segment` spelling and omit the source's
  parenthetical Guardian and Thargoid category labels where the owning catalogue does;
  localized columns remain verbatim source values.
- **Coverage:** English, Spanish and Russian cover all 146 materials. The explicit
  translations cover 128 in German, and 140 each in French and Brazilian Portuguese.
- **Manual corrections:** none.

## `micro-resource-names.jsonc`

- **Acquired:** 2026-08-16 UTC.
- **Odyssey Materials Helper revision:** commit
  `23343c453938e724f317c56e9eb7db0dbfa71f78`.
- **Supplemental source:** in-game verification, acquired 2026-08-16 UTC; immutable
  revision unavailable.
- **Derivation:** each of the 226 current symbols and its canonical English name comes
  from the four `data/materials/micro-resources-*.jsonc` catalogues. The 196 FDevIDs-backed
  records join directly to the final component of Odyssey Materials Helper's message key
  in `locale/material/odyssey/{asset,consumable,data,good}.csv`; only that row's explicit
  localized columns are copied. Twenty-eight of the 30 in-game-backed records also have
  rows in Odyssey Materials Helper, while `PowerVirus` and
  `SmallCapacityPowerRegulator` do not. All 30 take the explicit in-game `name` values for
  German, Spanish, French and Russian. In both cases the owning catalogue remains
  authoritative for canonical English names.
- **Coverage:** English, Spanish and Russian cover all 226 micro resources. The explicit
  translations cover 218 in German, 225 in French and 188 in Brazilian Portuguese. The
  30 in-game-backed records take Portuguese from Odyssey Materials Helper where it has a
  row, because the in-game capture supplied no Portuguese; `PowerVirus` and
  `SmallCapacityPowerRegulator`, which the source does not carry at all, have none.
- **Manual corrections:** none.

## `ship-names.jsonc`

- **Acquired:** 2026-08-18 UTC.
- **Odyssey Materials Helper revision:** commit
  `23343c453938e724f317c56e9eb7db0dbfa71f78`;
  `application/src/main/resources/locale/ships/ships.csv` has SHA-256
  `6785f7cea00f36ca0a853091fd88f8ed5481a60f55c269643bff1ab0c3d6993d`.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`.
- **Derivation:** each of the 48 current ship symbols and canonical English names comes
  from `data/ships/ships.jsonc`. The symbol is joined to Odyssey Materials
  Helper's `ships.name.*` key after removing punctuation and folding case. EDSY's
  `eddb.js` `ship.fdname` supplies the second join, with explicit `ship-<id>` language
  entries filling locales absent from the CSV. The CSV keys a row by the ship's display
  name rather than its symbol, which differ for the four hulls whose name carries a mark
  the symbol omits (`Viper` is `ships.name.viper_mk_iii`), so the name is tried first and
  the symbol second. The resulting source-backed coverage is 48 ships in Spanish, 44 in
  French, 38 in Brazilian Portuguese and 48 in Russian; no accepted source carries a
  German ship-name table.
- **Standing conclusion:** every source-backed non-English value is byte-for-byte equal
  to the canonical English ship name. The explicit values remain in the catalogue so a
  lookup distinguishes a source-backed same spelling from an unavailable translation.
- **Manual corrections:** none.

## `ship-manufacturer-names.jsonc`

- **Acquired:** 2026-08-18 UTC.
- **Derivation:** all 48 symbol-to-manufacturer values are projected directly from
  `data/ships/ships.jsonc`, whose pinned sources and corrections are recorded in
  `data/ships/SOURCES.md`. Repeated manufacturer strings remain keyed by ship symbol so
  consumers need no separate manufacturer identity space.
- **Coverage:** canonical English covers every ship. The accepted sources carry no
  localized manufacturer labels.
- **Manual corrections:** none.

## `engineering-group-names.jsonc`

- **Acquired:** 2026-08-18 UTC.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`; `lang-en.json` and
  `lang-ru.json` have Git blob ids `9b199db635f7b968b75c8e9a14bdce68e37e4120` and
  `36496372d056754c34da03ca6836e27987c96b6a` respectively.
- **Derivation:** each of the 48 group ids and its canonical English name is projected
  from `data/ships/engineering-options.jsonc`. That catalogue derives its group menus
  from EDSY, with the supplemental sources and corrections recorded in
  `data/ships/SOURCES.md`. Where a canonical English name matches an EDSY `mtype-*`
  value in `lang-en.json` byte-for-byte and uniquely, explicit values with the same key
  are copied from `lang-ru.json`.
- **Coverage:** canonical English covers every engineering option group; Brazilian
  Portuguese and Russian each cover 44 of 48. The Guardian power-plant, power-distributor
  and hull-reinforcement groups have no distinct EDSY label, and EDSY carries no value in
  either language for `frameShiftDrivesSCO`.
- **Manual corrections:** none.

## `module-family-names.jsonc`

- **Acquired:** 2026-08-23 UTC.
- **In-game localisation revision:** none published; the game ships no immutable
  identifier for its localisation tables. The acquired table is the evidence.
- **Derivation:** each of the 77 family ids and its canonical English name is projected
  from `data/ships/module-families.jsonc`, whose own derivation is recorded in
  `data/ships/SOURCES.md`. 58 of them are named by an in-game outfitting category, and
  those categories' explicit German, Spanish, French, Brazilian Portuguese and Russian
  labels are copied verbatim. The join is on family identity rather than on English
  string equality, because the English column of the in-game table *is* the canonical
  English name the ships catalogue took from it.
- **Coverage:** English covers all 77 families; the five other locales cover the same 58.
  The 19 without a source-backed label are the families the in-game outfitting screen
  does not name separately: `axMissileRacks`, `axMultiCannons`, `cargoHatches`,
  `causticSinkLaunchers`, `guardianGaussCannons`, `guardianHybridPowerDistributors`,
  `guardianHybridPowerPlants`, `guardianNaniteTorpedoPylons`, `guardianPlasmaChargers`,
  `guardianShardCannons`, `guardianShieldReinforcementPackages`,
  `miningMultiLimpetControllers`, `remoteReleaseFlakLaunchers`,
  `remoteReleaseFlechetteLaunchers`, `shockCannons`, `shutdownFieldNeutralisers`,
  `subSurfaceDisplacementMissiles`, `subSurfaceExtractionMissiles` and `xenoScanners`.
- **Manual corrections:** none.

## `experimental-effect-descriptions.jsonc`

- **Acquired:** 2026-08-30 UTC.
- **In-game localisation revision:** none published; the game ships no immutable
  identifier for its localisation tables. The acquired table is the evidence.
- **Derivation:** each of the 86 current keys comes from
  `data/ships/experimental-effects.jsonc`; the Frontier symbol joins to the in-game
  experimental-effect description table, which supplies every locale for all 86. All six
  values, English included, are the source's verbatim.
- **This catalogue no longer projects the ships catalogue's `description`.** The two
  answer different questions and are deliberately different strings. An effect's
  `description` in `data/ships/experimental-effects.jsonc` is a mechanical note that
  states what the `modifiers` list cannot — that High Yield Shell deals 50/50
  kinetic/explosive damage with module splash, say — and 57 of the 86 effects need no
  such note and carry none. What the game shows a player is display prose that names no
  magnitudes ("Modified munitions that convert a portion of damage to explosive …"), and
  it exists for every effect. Projecting one onto the other would have cost the
  mechanical notes their numbers; storing the display prose here keeps each field doing
  its own job, and the ships catalogue is unchanged.
- **Coverage:** complete. All 86 effects carry all six locales.
- **Manual corrections:** 26 of the source's descriptions begin with one or more
  bracketed tokens — `[ShieldRegen]`, and `[SnsrBlinding][Heat]` on
  `special_radiant_canister`. A token is byte-identical across all six locales and is
  left untranslated in each, so it is an identifier the game's client consumes rather
  than text meant for a player; the tokens are removed here. The `†` shadow marker
  described under `experimental-effect-names.jsonc` is removed from descriptions too.

## `pre-engineered-variant-names.jsonc`

- **Acquired:** 2026-08-18 UTC; the Merc-shop names 2026-08-22 UTC.
- **Derivation:** all 76 compound identities and English names come from
  `data/ships/pre-engineered.jsonc`. An identity combines the base module symbol,
  blueprint, optional experimental effect and acquisition route. When a variant name
  exactly matches its base module's canonical name, it reuses that record from
  `module-names.jsonc`; the 41 distinct display records are stored once. Fixed reward
  names such as the three `Decorative_*` festive launchers remain canonical English.
- **The 22 Merc-shop rows carry the shop's own names**, in 14 distinct records — the shop
  sells a "Far-Reaching Abrasion Blaster", not an Abrasion Blaster — so they do not reuse
  their base module's record. English and the German, Spanish, French and Russian values
  are supplied by the repository owner from the in-game shop listing; no registry
  publishes them.
- **Coverage:** English covers every variant. Ordinary names inherit the explicit
  localized values available for their base module, which now includes Brazilian
  Portuguese on 51 of the 76 variants; the Merc-shop names carry the five locales the
  repository owner supplied and no Portuguese; fixed reward names have no accepted
  translation source.
- **Manual corrections:** none.

## Known gaps

Localized coverage follows the accepted sources and is not complete for every catalogue or
stored locale. A language absent from all eleven catalogues is the locale decision
recorded above rather than a gap. The accepted sources carry only canonical English for
ship manufacturers, 19 of the 77 outfitting-family labels, some engineering-group labels,
slot and restriction labels, fixed reward names, and structured loadout, calculation,
SLEF and edit messages. Missing source-backed
translations remain tracked by
[#320](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/320).
