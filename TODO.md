# TODO

Known gaps and follow-up work, newest first. Long-form provenance and the reasoning
behind a decision live in the relevant `data/<domain>/SOURCES.md`; this file is the
short, actionable list.

## Ships — data gaps

### 1. 106 modules are missing `powerDraw` that upstream carries

**`powerBudget()` understates draw for any build with a fuel scoop, refinery, AFM unit
or docking computer.**

`data/ships/modules-internal.jsonc` omits `powerDraw` for four families that
coriolis-data (commit `0db9234b`) records a `power` value for on **every** record:

| Family                              | Records | Upstream has `power`     |
| ----------------------------------- | ------- | ------------------------ |
| `Int_FuelScoop_*`                   | 40      | 40/40                    |
| `Int_Repairer_*` (AFMU)             | 40      | 40/40                    |
| `Int_Refinery_*`                    | 20      | 20/20                    |
| `Int_DockingComputer_*`             | 2       | 2/2                      |
| `Int_StellarBodyDiscoveryScanner_*` | 4       | 2/4 (the two live tiers) |

Measured impact on the one build we can check: the Deep Black's _powered_ affected
modules are a 7A fuel scoop (0.97 MW), one 6A AFMU (3.26 MW; its twin is switched off)
and an advanced docking computer (0.45 MW) — **4.68 MW unaccounted for**, against a
pinned `retracted` draw of 14.8159 MW. That is a ~32% understatement, and
`fixtures/ships/build-metrics.json` currently pins the wrong figures.

Fix: merge the upstream `power` values in, then re-pin `build-metrics.json`. Note the
Deep Black stays within budget either way (headroom 8.03 → ~3.35 MW), so no test fails
today — this is silently wrong, not loudly wrong.

Related: check whether the same families are missing `integrity`, which upstream also
carries.

### 2. Four corrosion-resistant cargo racks have no price at all

`Int_CorrosionProofCargoRack_Size{1_Class2,5_Class1,6_Class1}` read `cost: 0` in
coriolis-data itself — a gap upstream, not the duplicate-symbol defect fixed in this
change, so there is no first occurrence to fall back on; `_Size2_Class1` never carried a
price at all. They are not free: the size-4
record is priced at 94 330, and the E-rated rack family follows a ×3.25 curve, putting
sizes 5 and 6 near 306 000 and 996 000.

`cost` is now omitted on all four so a calculation can tell "free" from "unknown", and
they are pinned in `fixtures/ships/module-stats.json` under `unpriced`. Since credits are
quoted at retail, a build carrying one of these exports no `ModulesValue` or `Rebuy` at
all until real prices are sourced from EDSY or Inara.

### 3. Modules still missing `mass`, deliberately

17 records, left absent because absent means _unknown_ rather than zero — do not
"fix" these to `0` without a source:

- 10 `*_free` starter variants and `Int_Hyperdrive_Size8_Class{1..5}` — identity-only
  rows with no stats at all.
- `Int_ShieldGenerator_Size1_Class4` — a documented deliberate omission.
- `Int_DroneControl_ResourceSiphon` — limpet controllers **do** have mass, so this is a
  genuine gap worth filling.

## Ships — test coverage

### 4. No external ground truth for shields, armour or weapon DPS

A journal `Loadout` event never reports them, so the corpus validates mass, capacities,
jump range and credits against Frontier's own figures but checks the defence and weapon
metrics only against our own maths. An EDSY or Coriolis reading of a weaponed build
would close this — it is the largest remaining hole in the parity story.

### 5. The build corpus has no cargo-heavy hull

`fixtures/ships/` holds two real builds: an exploration Caspian Explorer (EDSY export)
and a combat Krait Phantom (journal capture). Nothing exercises a large cargo hold or
the laden-vs-unladen jump-range gap at scale; the Krait's 32 t is the maximum. A Type-9
or Cutter journal capture would help.

Acquisition constraint: the source must carry a licence that permits redistribution. A
Viper Mk IV capture from `UFO-Studios/EDDP` was checked and passed, but its repository
states no licence (`NOASSERTION`), so it was not committed.

## Ships — API

### 6. Journal-only fields do not survive an import

`LoadoutEvent` omits fields real journals carry: `timestamp`, `ShipID`, `HullHealth`,
`Hot`, module `AmmoInClip` / `AmmoInHopper`, and engineering `Engineer` / `EngineerID` /
`BlueprintID`. They pass `parseSlef` harmlessly — the validators allow-list rather than
key-close — but `cloneLoadoutModule` and `ShipLoadout.fromLoadout` drop them, so a
journal → `ShipLoadout` → SLEF round trip loses them.

Deliberately out of scope when SLEF export was added; the additions would all be
optional and backwards-compatible.

### 7. An export cannot report what a build actually cost

Credits are quoted at retail, so a source's own purchase record — the station discount
it was bought at, and any per-module `Value` — is dropped on the way out. That is the
intended behaviour, but it means a consumer wanting "what did this commander pay" has
nowhere to get it. If that turns out to be wanted, the honest shape is a separate
accessor for the source's stated figures rather than putting them back in the export,
where they would be indistinguishable from list prices.

### 8. The cosmetic slot families are a hand-maintained list

`COSMETIC_SLOT_PATTERNS` in `typescript/src/ships/ship-loadout.ts` names the journal slot
families that hold cosmetics rather than outfitting — cockpit, paint, decals, nameplates,
bobbles, ship kits, colours, voice packs, string lights — and
`fixtures/ships/slef-export.json` pins it under `classification` so a port draws the same
line.

Matching is **positive**, which is the safe direction: an article the catalogue can
identify counts whatever its slot is called, and anything neither the catalogue nor this
list recognises is unknown, so an export omits the figures rather than understating them.
The cost is that a cosmetic family Frontier adds later takes `ModulesValue`,
`UnladenMass`, `MaxJumpRange` and `Rebuy` off every build wearing it until the list is
extended. The Krait Phantom capture exercises 15 of the families; the rest rest on the
journal documentation. Worth re-checking whenever a capture joins the corpus.

### 9. `modulesValue` and `rebuy` getters die on a no-op refit

`#adjustImportedFigures` deletes both from `#top` on any `setModule`, including
re-fitting the identical module, so the getters that report the *source's* figures start
returning `null`. Exports are unaffected — they never read those fields. Cheap fix: skip
the delete when `previous?.Item === next?.Item`.
