# Localized game-name catalogues

These catalogues keep the canonical English display names already published by the
ships data domain and add only localized values carried explicitly by accepted sources.
They are deliberately sparse: absence means that no accepted source carried a value, and
the lookup API returns `null` for that locale rather than treating English as a
translation.

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
  `namekey` fill a missing `de`, `es`, `fr`, `pt` or `ru` value only when EDSY's English
  module name also exactly equals the canonical name. Values shared by modules with one
  canonical name are retained only when they agree, then stored once under that name.
- **Coverage:** English covers all 1,199 symbols. The explicit translations cover 1,120
  in German, 1,090 in Spanish, 1,088 in French, 767 in Hungarian, 1,028 in Italian,
  822 in Portuguese, 1,029 in Brazilian Portuguese, 1,153 in Russian and 1,028 in
  Simplified Chinese.
- **Manual corrections:** none.

## `blueprint-names.jsonc`

- **Acquired:** 2026-08-14 UTC.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`.
- **Derivation:** each of the 107 current keys and its English name comes from
  `data/ships/blueprints.jsonc`. The Frontier `fdname` joins directly to EDSY's
  `blueprint.fdname`; that record's id selects an explicit `blueprint-<id>` entry from
  each language file. Names remain keyed per blueprint because a single English phrase
  can have different grammatical translations for different module families.
- **Coverage:** English covers all 107 blueprints; EDSY covers 55 in German and 59 each
  in Spanish, French, Portuguese and Russian. The remaining recipes include Operations
  and other newer records EDSY does not identify or translate.
- **Manual corrections:** EDSY's French `FSD_FastBoot` value ends in one accidental
  ASCII space; the stored display name removes it so a successful lookup is already
  trimmed like every other catalogue name.

## `experimental-effect-names.jsonc`

- **Acquired:** 2026-08-14 UTC.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`.
- **Derivation:** each of the 86 current keys and its English name comes from
  `data/ships/experimental-effects.jsonc`. The Frontier `fdname` joins directly to
  EDSY's `expeffect.fdname`; that record's id selects an explicit `expeffect-<id>` entry
  from each language file.
- **Coverage:** English covers all 86 effects; EDSY covers 84 in German and 85 each in
  Spanish, French, Portuguese and Russian.
- **Manual corrections:** none.

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
  translations cover 128 in German, 140 in French, 140 in Portuguese and 28 in
  Georgian. Fourteen of the source's Georgian values are byte-for-byte equal to the
  canonical English spelling and are retained verbatim; they are explicit source values,
  not lookup-generated fallbacks. The pinned source carries no Simplified Chinese
  material names.
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
  German, Spanish, French, Brazilian Portuguese and Russian. The Brazilian Portuguese
  values are stored under `pt`, matching the existing catalogue values described below.
  In both cases the owning catalogue remains authoritative for canonical English names.
- **Coverage:** English, Spanish and Russian cover all 226 micro resources. The explicit
  translations cover 218 in German and Portuguese, 225 in French, 6 in Simplified Chinese
  and 10 in Georgian. Five of the source's Georgian values are byte-for-byte equal to the
  canonical English spelling and are retained verbatim; they are explicit source values,
  not lookup-generated fallbacks.
- **Manual corrections:** the 30 in-game values labelled Brazilian Portuguese are stored
  under `pt`, matching the 188 existing Portuguese entries because both sets contain the
  same Brazilian Portuguese game text. `pt-BR` lookups resolve these values through the
  regional-to-language fallback.

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
  entries filling locales absent from the CSV. The resulting source-backed coverage is
  48 ships in Spanish, 44 in French, 38 in Portuguese, 48 in Russian, 48 in
  Simplified Chinese and 47 in Georgian;
  no accepted source carries a German ship-name table.
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
  database version `424009901`, last-modified marker `20260810`; `lang-en.json`,
  `lang-pt.json` and `lang-ru.json` have Git blob ids
  `9b199db635f7b968b75c8e9a14bdce68e37e4120`,
  `493fa09c4d4a11f0282e1e4076a67fed8d7f317e` and
  `36496372d056754c34da03ca6836e27987c96b6a` respectively.
- **Derivation:** each of the 51 group ids and its canonical English name is projected
  from `data/ships/engineering-options.jsonc`. That catalogue derives its group menus
  from EDSY, with the supplemental sources and corrections recorded in
  `data/ships/SOURCES.md`. Where a canonical English name matches an EDSY `mtype-*`
  value in `lang-en.json` byte-for-byte and uniquely, explicit values with the same key
  are copied from `lang-pt.json` and `lang-ru.json`.
- **Coverage:** canonical English covers every engineering option group. Portuguese and
  Russian each cover 46 of 51. `guardianPowerPlants`, `guardianPowerDistributors` and
  `guardianHullReinforcements` have no distinct EDSY label, `experimentalWeapons` does not
  match EDSY's broader `Experimental` label, and EDSY carries no Portuguese or Russian
  value for `frameShiftDrivesSCO`. The `guardianGauss`, `guardianPlasma` and
  `guardianShard` weapon groups do carry distinct EDSY labels and are translated.
- **Manual corrections:** none.

## `experimental-effect-descriptions.jsonc`

- **Acquired:** 2026-08-18 UTC.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`.
- **Derivation:** the 29 effects with a `description` project that canonical English
  value from `data/ships/experimental-effects.jsonc`. Effects without a source-backed
  description remain absent rather than receiving generated prose.
- **Coverage:** canonical English covers 29 of 86 effects. The accepted sources carry no
  localized description table.
- **Manual corrections:** none.

## `pre-engineered-variant-names.jsonc`

- **Acquired:** 2026-08-18 UTC.
- **Derivation:** all 76 compound identities and English names come from
  `data/ships/pre-engineered.jsonc`. An identity combines the base module symbol,
  blueprint, optional experimental effect and acquisition route. When a variant name
  exactly matches its base module's canonical name, it reuses that record from
  `module-names.jsonc`; the 28 distinct display records are stored once. Fixed reward
  names such as the three `Decorative_*` festive launchers remain canonical English.
- **Coverage:** English covers every variant. Ordinary names inherit the explicit
  localized values available for their base module; fixed reward names have no accepted
  translation source.
- **Manual corrections:** none.

## Known gaps

Localized coverage follows the accepted sources and is not complete for every catalogue or
locale. The accepted sources carry only canonical English for some engineering-group labels,
slot and restriction labels, fixed reward names, and structured loadout, calculation, SLEF
and edit messages. Missing source-backed translations remain tracked by
[#320](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/320).
