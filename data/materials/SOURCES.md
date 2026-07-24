# Data sources — `data/materials/`

**Library snapshot:** 2026-07-24. **Initial upstream revision:** not recorded. See `../SNAPSHOTS.md` for the update policy and known limitation.

Attribution for the engineering-materials data files in this directory. This file
is the long form; each data file also repeats its own credit in a comment header,
so the provenance meets you where you meet the data.

The data files are **JSONC** (`.jsonc`): attribution lives in a comment so it
documents the file without becoming part of the payload every consumer inlines
into their bundle. Comments are the only JSONC extension used — no trailing commas —
so stripping comments leaves strict JSON any language's standard parser accepts.
See AGENTS.md §Attribution for how to consume them.

## Materials — raw, manufactured, encoded

- **Files:** `materials-raw.jsonc`, `materials-manufactured.jsonc`,
  `materials-encoded.jsonc`, and `fixtures/materials/materials.json`.
- **Primary source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), the
  community-maintained registry of Frontier's internal ids and names
  (`material.csv`). It provides, for each material, the internal symbol, grade
  (`rarity` 1–5), type (raw / manufactured / encoded) and the in-game group.
  FDevIDs states no explicit licence; consult the repository terms before
  redistributing the raw identifiers.
- **Derivation:**
  - `symbol` is FDevIDs' internal id (e.g. `GridResistors`) — what the player journal
    reports (case-insensitively), the same field/meaning as on a ship or module.
    Frontier's numeric material id from the CSV is not carried.
    `name` is the human display name (`Grid Resistors`). For raw materials
    `elementSymbol` is the chemical element symbol (Fe, C, …); manufactured and
    encoded materials have none (`null`).
  - `grade` is FDevIDs' `rarity` (1 = Very Common … 5 = Very Rare) — the grade **is**
    the rarity, so no separate rarity is stored (the `MaterialGrade` enum's member
    names are the tiers). Raw materials only reach grade 4 (Rare) — there is no
    grade-5 raw element.
  - `line` is the in-game group. Manufactured and encoded materials keep FDevIDs'
    group name (Chemical, Emission Data, …). FDevIDs files Guardian and Thargoid
    materials under group `None`; here they are grouped `Guardian` or `Thargoid`
    from their symbol prefix (`Guardian_*` / `Ancient*` → Guardian; `TG_*` /
    `Unknown*` → Thargoid). Raw materials' seven numeric families (1–7) are named
    after their grade-1 element — **Carbon, Phosphorus, Sulphur, Iron, Nickel,
    Rhenium, Lead** — the convention the in-game raw grid columns follow.
  - The rarity is the `grade` itself, so no separate rarity is stored in JSON.

## Secondary source — newer Thargoid caustic / Titan materials

Frontier added several Thargoid caustic and Titan materials that FDevIDs' `material.csv`
has not yet catalogued. Their grade comes from
[INARA](https://inara.cz/elite/components/) (rarity tier mapped Very common → 1 …
Very rare → 5); their `symbol` is the identifier the player journal reports (e.g.
`tg_causticshard`, `unknowncorechip`), matched case-insensitively like every other
material.

| Material | Category | Grade | Symbol (journal) |
| --- | --- | --- | --- |
| Hardened Surface Fragments | Manufactured | 1 | `tg_abrasion03` |
| Caustic Shard | Manufactured | 2 | `tg_causticshard` |
| Tactical Core Chip | Manufactured | 2 | `unknowncorechip` |
| Corrosive Mechanisms | Manufactured | 3 | `tg_causticgeneratorparts` |
| Phasing Membrane Residue | Manufactured | 3 | `tg_abrasion02` |
| Caustic Crystal | Manufactured | 4 | `tg_causticcrystal` |
| Heat Exposure Specimen | Manufactured | 5 | `tg_abrasion01` |
| Massive Energy Surge Analytics | Encoded | 3 | `tg_shutdowndata` |
| Thargoid Interdiction Telemetry | Encoded | 3 | `tg_interdictiondata` |

INARA agreed with FDevIDs on every material the two share (e.g. Bio-Mechanical
Conduits = grade 3), which is why it is used to fill the gap.

## Odyssey micro resources — component, consumable, data, item

- **Files:** `micro-resources-component.jsonc`, `micro-resources-consumable.jsonc`,
  `micro-resources-data.jsonc`, `micro-resources-item.jsonc`, and
  `fixtures/materials/micro-resources.json`.
- **Primary source:** [EDCD FDevIDs](https://github.com/EDCD/FDevIDs)
  (`microresources.csv`), the community-maintained registry of Frontier's internal
  ids and names for the on-foot (Odyssey) micro resources. It provides, for each
  micro resource, the internal symbol, category (Component / Consumable / Data /
  Item) and English display name. FDevIDs states no explicit licence; consult the
  repository terms before redistributing the raw identifiers.
- **Derivation:**
  - `symbol` is FDevIDs' internal id (e.g. `graphene`) — what the player journal
    reports (case-insensitively), the same field/meaning as on a ship, module or
    material. Frontier's numeric micro-resource id from the CSV is **not** carried.
  - `name` is the English display name (`Graphene`).
  - `category` is FDevIDs' category, lower-cased to `component` / `consumable` /
    `data` / `item` (matching how ship modules and materials spell their category).
    Each of the four data files holds exactly one category.
  - Micro resources have **no grade and no line** — those belong to the ship-side
    engineering materials above; a micro resource is a plain `{ symbol, category,
    name }` registry record.
