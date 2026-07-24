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
