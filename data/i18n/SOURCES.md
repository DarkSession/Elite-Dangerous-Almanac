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

- **Acquired:** 2026-08-30 UTC.
- **In-game localisation revision:** none published; the game ships no immutable
  identifier for its localisation tables. The acquired table is the evidence.
- **Derivation:** all 1,199 current module symbols and English names come from the four
  `data/ships/modules-*.jsonc` catalogues, which stay authoritative for canonical
  English. Each symbol joins case-insensitively to the in-game module localisation
  identity, which carries a `name`, a `longname` and an `info` string per locale. The
  join is exact and total: every one of the 1,199 resolves.
  - **`longname` is the name taken.** It is the outfitting list's full name and equals
    the canonical English on 1,041 of the 1,199, where `name` — the abbreviated panel
    form — equals it on 726. `name` is taken only where a longname is a template rather
    than a name, which is the cargo racks, fuel tanks and corrosion-resistant racks whose
    longname carries a capacity.
  - **Aliasing is followed.** A localisation value may be a `$Other_Key;` pointer rather
    than text; roughly three thousand of the keys are. Each is followed to the entry
    holding real text before anything is stored, and a value still carrying a `$` token
    after that is not a name and is rejected.
  - **The `(Free)` vessel-hangar grants have no name of their own** — theirs is a
    template wrapping the base hangar's. Their canonical English is already the base
    module's, so they share its record, exactly as they did before.
- **This table replaces the EDDI and EDSY joins the catalogue previously used**, and wins
  where they disagree, as in-game values do everywhere in this repository. It fills the
  349 values those joins left empty and restyles 3,135 they carried, across 324 distinct
  record-and-locale pairs: 73 differ only in letter case, 10 only in punctuation or
  accents, and 241 in wording. Many of the last are the game being specific where the
  registries were general — Russian `Двигатели` becomes `Маневровые двигатели`, Brazilian
  Portuguese `Propulsores` becomes `Propulsores de desempenho melhorado`.
- **Sixteen values are the outfitting panel's own abbreviations**, and are stored as the
  game renders them: French `Laser à impuls.`, Russian `Сист. жизнеобеспечения`, Spanish
  `Lanzamisiles g.` and thirteen more, reaching 185 symbols between them. They are the
  panel's shortened forms rather than different translations. Note that
  `material-names.jsonc` resolves the same situation the other way, keeping the
  unabbreviated value; the two catalogues do not currently follow one rule here.
- **Four names need more than one record.** The catalogue deduplicates modules sharing
  one name in every locale, which is finer than sharing one canonical English name,
  because the game distinguishes in other locales what English spells the same way:
  `Lightweight Alloy` and `Reinforced Alloy` are singular on 25 hulls and plural on the
  rest, `Hatch Breaker Limpet Controller` is generic on one symbol and specific on
  twenty, and one Corrosion Resistant Cargo Rack differs from its four siblings. A `#2`
  suffix separates the second record of such a pair; it is part of the key only, never of
  a displayed name.
- **Coverage:** complete. All 1,199 symbols carry all six locales.
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
  English values therefore omit the source's parenthetical Guardian and Thargoid
  category labels where the owning catalogue does; localized columns remain verbatim
  source values.
- **Second source, the in-game material localisation tables**, acquired 2026-08-30 UTC;
  the game publishes no immutable identifier for them, so the acquired table is the
  evidence. It covers all 146 materials in all six locales and, as everywhere else in
  this repository, wins where the two disagree. That fills the 30 values Odyssey
  Materials Helper did not carry and restyles 30 it did: 23 are the French apostrophe
  (the in-game tables use `'` throughout, as every other catalogue here does, where
  Odyssey Materials Helper uses `’`), five are Spanish names the helper title-cased
  (`Fragmento Caústico` against the game's `Fragmento cáustico`), and the rest are
  wording.
- **Coverage:** complete. All 146 materials carry all six locales.
- **Manual corrections:** six of the in-game values are the outfitting UI's own
  abbreviations, shortened to fit its widget rather than translated differently —
  `Comp. de destroços Guardian` against the helper's `Componentes de destroços Sentinela
  Guardian`, and likewise for `Guardian_Sentinel_WeaponParts` (French and Brazilian
  Portuguese), `Guardian_TechComponent` (French and Brazilian Portuguese) and
  `HeatConductionWiring` (Spanish). The unabbreviated value is kept in each.
- **`Guardian_Sentinel_WreckageComponents` drops `Sentinel` in every locale**, following
  the owning catalogue's rename (see `data/materials/SOURCES.md`). Its Brazilian
  Portuguese is the one value here taken from neither source verbatim: the in-game table
  abbreviates it to `Comp. de destroços Guardian` to fit the widget, so the whole word is
  kept as it is for the other abbreviated labels above, giving
  `Componentes de destroços Guardian`.

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
- **Second source, the in-game micro-resource localisation tables**, acquired
  2026-08-30 UTC; the game publishes no immutable identifier for them, so the acquired
  table is the evidence. It covers 225 of the 226 in all six locales and wins where the
  two disagree, on the same footing as the material tables above. That fills all 47
  remaining values — including the Brazilian Portuguese for `PowerVirus` and
  `SmallCapacityPowerRegulator`, which no registry carries — and restyles 46, of which 36
  are the French apostrophe and seven are the French Powerplay term, which the game
  lower-cases (`Données classifiées de puissance`).
  `PowerMegashipData` is absent from the micro-resource table and appears in the material
  one; its values are taken from there.
- **Coverage:** complete. All 226 micro resources carry all six locales.
- **Manual corrections:** five in-game values are layout, not names. Four German
  consumables carry a `<br>` inside a compound word that the UI wraps —
  `Energie-<br>zelle`, `Splitter-<br>granate`, `Schild-<br>unterbrecher` and
  `Schild-<br>generator` — and the French `Amm_Grenade_EMP` is abbreviated to
  `Neutralisat. de bouclier` to fit its widget. The whole word is kept in each:
  `Energiezelle`, `Splittergranate`, `Schildunterbrecher`, `Schildgenerator` and
  `Neutralisateur de bouclier`.

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
  their base module's record. All six locales are supplied by the repository owner from
  the in-game shop listing; no registry publishes them. The Brazilian Portuguese column
  was acquired 2026-08-30 UTC and agrees byte-for-byte with the five columns already
  stored, which it does not change.
- **A tech-broker unlock may carry an unlock marker**, and 19 of them do — see
  `data/ships/SOURCES.md`. Those names are not their base module's, so they do not reuse
  its record. Where the marker is a manufacturer (`Sirius`, `Azimuth`) or a version
  (`V1`) it is not a translatable word, so the localized value is that marker composed
  with the base module's own localized name: German `Suchraketenrampe V1`, Spanish
  `Sirius Lanzamisiles AX`. Composition can only reach as far as the base module does,
  which is why `Frame Shift Drive (SCO) V1` has Brazilian Portuguese and Russian only and
  `Azimuth Enhanced AX Multi-Cannon` lacks Spanish and French: those are the base
  modules' own gaps, not new ones.
- **Six records carry a translation composed in this repository rather than taken from a
  source, and are the only values in `data/i18n/` that are.** They are marked here
  because the rest of this directory is explicit source values, and a reader is entitled
  to know which is which. The game does not publish either phrase in a form this
  repository can join to:
  - The three `Modified` Guardian weapons. Unlike `Sirius`, `Azimuth` and `V1`, `Modified`
    is a translatable word, so it cannot simply be composed with the base module's
    localized name. Each locale's adjective agrees with the base noun it qualifies —
    German `Modifizierter Guardian-Plasmalader` against `Modifizierte Guardian-Gausskanone`,
    Russian `Модифицированная пушка Гаусса` against `Модифицированное осколочное орудие`.
  - The three `Decorative_*` festive launchers. The game does not translate their names,
    so `Festive` and the colour are rendered in each locale and qualify the base module's
    own localized name.

  Replace any of the twelve with a source-backed value the moment one is published.
- **Coverage:** English covers every variant, and Brazilian Portuguese and Russian now do
  too. Ordinary names inherit the explicit localized values available for their base
  module; the Merc-shop names carry all six locales. The German, Spanish and French gaps
  that remain are their base modules' own — the SCO drive and the Enhanced AX
  Multi-Cannon carry no value in those locales for composition to build on.
- **Manual corrections:** none.

## Names this repository deliberately does not localize

Three catalogues were removed rather than completed, because the game does not translate
what they held and storing English under five more keys said otherwise.

- **Ship names and manufacturers.** Odyssey Materials Helper and EDSY each publish a
  per-locale ship column, and every value either one publishes is byte-for-byte the
  canonical English name: a hull name is a proper noun the game leaves alone, and so is
  a manufacturer's. No source publishes a localized manufacturer label at all. A lookup
  that can only ever answer in English is not a translation lookup, so `getShipName` and
  `getShipManufacturer` are gone; `data/ships/ships.jsonc` carries both strings and stays
  the one place to read them.
- **Engineering-group labels.** An engineering group is this repository's own partition
  of the modules that share one menu; the game heads that menu with the module's
  outfitting family and publishes no group label of its own. The EDSY `mtype-*` values
  previously stored here were outfitting labels reached by a name join, which is why they
  disagreed with `module-family-names.jsonc` in 22 places on wording. A group therefore
  carries no name at all — see the header of `data/ships/engineering-options.jsonc` — and
  a consumer names one by joining a module's `familyId` to `module-family-names.jsonc`.

## Known gaps

Localized coverage follows the accepted sources and is not complete for every catalogue or
stored locale. A language absent from all eight catalogues is the locale decision
recorded above rather than a gap. The accepted sources carry only canonical English for
19 of the 77 outfitting-family labels, slot and restriction labels, fixed reward names,
and structured loadout, calculation, SLEF and edit messages. Missing source-backed
translations remain tracked by
[#320](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/320).
