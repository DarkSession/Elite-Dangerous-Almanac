# Data sources — `data/materials/`

**Acquired:** 2026-07-24. **Upstream revision:** unavailable for both sources below.

## Materials — raw, manufactured, encoded

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
- **Source:** EDCD FDevIDs, `microresources.csv`. It provides, for each micro resource,
  the internal symbol, category (Component / Consumable / Data / Item) and English display
  name.
- **Derivation:**
  - `symbol` is FDevIDs' internal id (e.g. `graphene`) — what the player journal reports
    with the same field and meaning as on a ship, module or material.
    Frontier's numeric micro-resource id from the CSV is **not** carried.
  - `name` is the English display name (`Graphene`).
  - FDevIDs' category is lower-cased to `component` / `consumable` / `data` / `item`
    (matching how ship modules and materials spell their category). Each data file holds
    exactly one category, so the category is represented by the file rather than repeated
    on every record.
  - Micro resources have **no grade and no line** — those belong to the ship-side
    engineering materials above; each data-file record is a plain `{ symbol, name }`
    registry record.

- **Known gap:** Odyssey Materials Helper commit
  `23343c453938e724f317c56e9eb7db0dbfa71f78` carries 28 distinct non-placeholder
  micro-resource symbols beyond this FDevIDs-based snapshot, primarily Powerplay 2.0 and
  Spire resources. The current catalogues have no records for them;
  [#277](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/277) tracks acquiring
  and adding their identities, categories and English names.
