# Localized game-name catalogues

These catalogues keep the canonical English display names already published by the
ships data domain and add only localized values carried explicitly by the pinned community
sources. They are deliberately sparse: absence means that no accepted source carried a
value, and the lookup API returns `null` for that locale rather than treating English as
a translation.

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
  owning materials catalogues remain authoritative for canonical names. This also keeps
  the existing `Segment` spelling and omits the source's parenthetical Guardian and
  Thargoid category labels where the owning catalogue does.
- **Coverage:** English, Spanish and Russian cover all 146 materials. The explicit
  translations cover 128 in German, 140 in French, 140 in Portuguese and 28 in
  Georgian. The pinned source carries no Simplified Chinese material names.
- **Manual corrections:** none.

## `micro-resource-names.jsonc`

- **Acquired:** 2026-08-16 UTC.
- **Odyssey Materials Helper revision:** commit
  `23343c453938e724f317c56e9eb7db0dbfa71f78`.
- **Derivation:** each of the 196 current symbols and its canonical English name comes
  from the four `data/materials/micro-resources-*.jsonc` catalogues. The lower-cased
  symbol joins directly to the final component of Odyssey Materials Helper's message key
  in `locale/material/odyssey/{asset,consumable,data,good}.csv`; only that row's explicit
  localized columns are copied. The source's English column is not copied because the
  owning micro-resource catalogues remain authoritative for canonical names.
- **Coverage:** English, Spanish and Russian cover all 196 micro resources. The explicit
  translations cover 188 in German, 195 in French, 188 in Portuguese, 6 in Simplified
  Chinese and 10 in Georgian.
- **Manual corrections:** none.

## Deliberate absence: ship names

- **Acquired:** 2026-08-14 UTC.
- **Odyssey Materials Helper revision:** commit
  `23343c453938e724f317c56e9eb7db0dbfa71f78`;
  `application/src/main/resources/locale/ships/ships.csv` has SHA-256
  `6785f7cea00f36ca0a853091fd88f8ed5481a60f55c269643bff1ab0c3d6993d`.
- **EDSY revision:** commit `e446fbe6e4597dea7ab0bd3105b9a36642388040`;
  database version `424009901`, last-modified marker `20260810`.
- **Evaluation:** each of the 48 current ship symbols is joined to Odyssey Materials
  Helper's `ships.name.*` key after removing punctuation and folding case. EDSY's
  `eddb.js` `ship.fdname` supplies the second join, with explicit `ship-<id>` language
  entries filling locales absent from the CSV. The resulting source-backed coverage is
  44 ships in Spanish, 42 in French, 38 in Portuguese, 45 in Russian and 44 in Chinese;
  no accepted source carries a German ship-name table.
- **Standing conclusion:** all 213 resulting non-English values are byte-for-byte equal
  to the canonical English ship names. A ship-name localization catalogue would
  therefore publish no translated information and is deliberately absent. A source
  carrying at least one genuinely localized ship name would justify revisiting this
  conclusion.
- **Manual corrections:** none.

## Known gaps

Localized coverage follows the pinned sources and is not complete for every catalogue or
locale. Missing values are observable as `null`, never an English fallback. Expanding
source-backed coverage, localized slot labels and higher-level generated text remains
tracked by [#245](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/245).
