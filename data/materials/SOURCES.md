# Data sources — `data/materials/`

## Materials — raw, manufactured, encoded

**Acquired:** 2026-07-24. **Upstream revision:** unavailable for both sources below.

- **Files:** `materials-raw.jsonc`, `materials-manufactured.jsonc`,
  `materials-encoded.jsonc`.
- **Primary source:** EDCD FDevIDs, `material.csv`. It provides, for each material, the
  internal symbol, grade (`rarity` 1–5), type (raw / manufactured / encoded) and the
  in-game group.
- **Derivation:**
  - `symbol` is FDevIDs' internal id (e.g. `GridResistors`) — what the player journal
    reports, with the same field and meaning as on a ship or module.
    Frontier's numeric material id from the CSV is not carried. `name` is the human
    display name (`Grid Resistors`). For raw materials `elementSymbol` is the chemical
    element symbol (Fe, C, …); manufactured and encoded materials have none (`null`).
  - `grade` is FDevIDs' `rarity` (1 = Very Common … 5 = Very Rare) — the grade **is** the
    rarity, so no separate rarity is stored. Raw materials only reach grade 4 (Rare) —
    there is no grade-5 raw element.
  - `line` is the in-game group. Manufactured and encoded materials keep FDevIDs' group
    name (Chemical, Emission Data, …). FDevIDs files Guardian and Thargoid materials under
    group `None`; here they are grouped `Guardian` or `Thargoid` from their symbol prefix
    (`Guardian_*` / `Ancient*` → Guardian; `TG_*` / `Unknown*` → Thargoid). Raw materials'
    seven numeric families (1–7) are named after their grade-1 element — **Carbon,
    Phosphorus, Sulphur, Iron, Nickel, Rhenium, Lead** — the convention the in-game raw
    grid columns follow.

### Manual correction — the three Guardian blueprint fragments

FDevIDs' `material.csv` names `Guardian_ModuleBlueprint`, `Guardian_WeaponBlueprint` and
`Guardian_VesselBlueprint` `… Blueprint Segment`. The game calls them **Fragment**, which
is the name carried here. The in-game localisation table confirmed by repository-owner
in-game verification (2026-08-30 UTC) says `Fragment` in every locale, and the French and
Russian columns Odyssey Materials Helper already supplied said `Fragment de plan …` and
`Фрагмент чертежа …` while its English, German, Spanish and Portuguese said Segment — the
disagreement was inside one source, not between the game and this repository.

### Manual correction — Guardian Wreckage Components has no Sentinel

FDevIDs names `Guardian_Sentinel_WreckageComponents` `Guardian Sentinel Wreckage
Components`; the game calls it **Guardian Wreckage Components**, which is the name
carried here. The symbol keeps Frontier's own `_Sentinel_` spelling, because that is what
the journal writes. Repository-owner in-game verification, 2026-08-30 UTC; the in-game
localisation table drops the word in German, Spanish, French and Brazilian Portuguese
too, and the Russian column Odyssey Materials Helper already supplied had no equivalent
of it either — `Обломки кораблекрушения Стражей`, against the `часовых Стражей` it uses
for `Guardian_Sentinel_WeaponParts`. That sibling **keeps** its Sentinel: the game names
it `Guardian Sentinel Weapon Parts`, so only the wreckage components are renamed.

### Secondary source — Thargoid caustic / Titan materials absent from FDevIDs

Several Thargoid caustic and Titan materials are absent from the pinned FDevIDs
`material.csv`. Their grade comes from Inara's component pages (rarity tier mapped Very
common → 1 … Very rare → 5); their `symbol` is the identifier the player journal reports
(e.g. `tg_causticshard`, `unknowncorechip`).

| Material                        | Category     | Grade | Symbol (journal)           |
| ------------------------------- | ------------ | ----- | -------------------------- |
| Hardened Surface Fragments      | Manufactured | 1     | `tg_abrasion03`            |
| Caustic Shard                   | Manufactured | 2     | `tg_causticshard`          |
| Tactical Core Chip              | Manufactured | 2     | `unknowncorechip`          |
| Corrosive Mechanisms            | Manufactured | 3     | `tg_causticgeneratorparts` |
| Phasing Membrane Residue        | Manufactured | 3     | `tg_abrasion02`            |
| Caustic Crystal                 | Manufactured | 4     | `tg_causticcrystal`        |
| Heat Exposure Specimen          | Manufactured | 5     | `tg_abrasion01`            |
| Massive Energy Surge Analytics  | Encoded      | 3     | `tg_shutdowndata`          |
| Thargoid Interdiction Telemetry | Encoded      | 3     | `tg_interdictiondata`      |

Inara agreed with FDevIDs on every material the two share (e.g. Bio-Mechanical Conduits =
grade 3), which is why it is used to fill the gap.

## Odyssey micro resources — component, consumable, data, item

- **Files:** `micro-resources-component.jsonc`, `micro-resources-consumable.jsonc`,
  `micro-resources-data.jsonc`, `micro-resources-item.jsonc`.
- **Sources:**
  - EDCD FDevIDs `microresources.csv`, acquired 2026-07-24; upstream revision
    unavailable. It provides 196 records, including each internal symbol,
    category (Component / Consumable / Data / Item) and English display name.
  - In-game verification, acquired 2026-08-16 UTC; immutable revision unavailable. It
    provides 30 player-facing identities absent from the FDevIDs snapshot, their internal
    identifiers and English display names, and player categories for 29 of them.
    `PowerMegashipData` is the exception documented under manual corrections.
  - Inara component pages, acquired 2026-08-16 UTC; immutable revision unavailable. Its
    six Power data pages independently classify Power Association Data, Power Classified
    Data, Power Industrial Data, Power Injection Malware, Power Megaship Data and Power
    Political Data as Odyssey data resources.
- **Derivation:**
  - `symbol` is the source's internal id (e.g. `graphene`) — what the player journal
    reports with the same field and meaning as on a ship, module or material. Frontier's
    numeric micro-resource id from the FDevIDs CSV is **not** carried.
  - `name` is the English display name (`Graphene`).
  - The source category is lower-cased to `component` / `consumable` / `data` / `item`
    (matching how ship modules and materials spell their category). In-game `assets` map
    to `component` and `goods` map to `item`. Each data file holds exactly one category,
    so the category is represented by the file rather than repeated on every record.
  - Micro resources have **no grade and no line** — those belong to the ship-side
    engineering materials above; each data-file record is a plain `{ symbol, name }`
    registry record.
  - Three registered identities are deliberately absent: `FlightData` and
    `Humanoid_ShieldGrenade_Bubble` have no localization and are not player-facing
    resources; `NOCData_Tutorial` is the tutorial-only duplicate of `NOCData` and has the
    same English display name. The localized, player-facing
    `SmallCapacityPowerRegulator` record is retained.
- **Manual corrections:** `PowerMegashipData` is assigned to `data`. The encoded-material
  classification attached to its in-game localization record is rejected: Inara
  classifies it alongside the other five Power data resources, establishing that it is an
  Odyssey micro resource with no material grade or line. The in-game English names are
  otherwise retained verbatim, including
  `Installation Intelligence Report`, `Personal Protective Equipment` and
  `Contaminated Spire Compound` where the community table differs.
