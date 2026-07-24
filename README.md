# Elite Dangerous Almanac

Ready-to-go static data and calculations for Elite Dangerous community apps and
researchers. Batteries-included, tree-shakeable, and validated against
language-neutral fixtures so every language port behaves identically.

The library is a monorepo with one folder per language implementation over shared
data. **TypeScript** is available today (`typescript/`); Python is planned.

## Install (TypeScript)

```bash
npm install @elite-dangerous-almanac/core
```

ESM-only, `"sideEffects": false`. Import the slice you need so bundlers drop the
rest. Native ESM applications can use leaf subpaths (for example,
`@elite-dangerous-almanac/core/astro/star-system`) to avoid evaluating unrelated
data modules:

```ts
import { StarSystem } from "@elite-dangerous-almanac/core/astro/star-system";
```

## Quick start

The `astro` feature area covers Elite Dangerous **procedural naming**, the
**`id64` system address**, the **galactic codex regions** and the **nebula
catalogues**. Start with `StarSystem` — one immutable handle that composes the
lower-level naming functions:

```ts
import { StarSystem } from "@elite-dangerous-almanac/core/astro";

// Name  ->  id64
const sys = StarSystem.fromName("Synuefe EN-H d11-96");
sys?.systemAddress; // 3309179996515n
sys?.sectorName; // 'Synuefe'
sys?.massCode; // 'd'

// id64  ->  name
StarSystem.fromSystemAddress(3309179996515n).name; // 'Synuefe EN-H d11-96'

// id64 + coordinates  ->  the name the game actually shows
// (a system inside a hand-authored region renders under that region's name)
StarSystem.fromSystemAddress(id64, { x, y, z }).name; // e.g. 'Pleiades Sector HR-W d1-79'
```

**Why `coords`?** An `id64` encodes only the boxel, not the exact position, so on
its own it can't tell whether a system sits inside a hand-authored region
(Pleiades, Coalsack, …). Pass the coordinates you already have alongside the
`id64` — from the player journal, [EDSM](https://www.edsm.net) or
[Spansh](https://spansh.co.uk), in light-years with Sol at the origin — to get the
name the game displays. Without them you get the procedural name.

Prefer a single calculation? Skip the class and import the pure function:

```ts
import {
  sectorNameFromCoords,
  decodeSystemAddress,
  findRegionForBoxel,
  findRegionAt,
} from "@elite-dangerous-almanac/core/astro";

sectorNameFromCoords({ x: 39, y: 30, z: 20 }); // 'Blae Eock'
decodeSystemAddress(3309179996515n); // { sizeClass, sectorCoords, boxelCode, ... }
findRegionForBoxel(3309179996515n).region?.name; // 'Inner Orion Spur' (a system's codex region)
findRegionAt({ x: 0, z: 0 })?.name; // 'Inner Orion Spur' (codex region at coords)
```

> **Codex region and bundle size.** `StarSystem` deliberately has no
> `galacticRegion` member: wiring the region lookup into the facade would pull the
> ~207 KB region-cell grid into _every_ `StarSystem` import (a class getter can't be
> tree-shaken away when unused). Get a system's region from its address with the
> standalone `findRegionForBoxel` instead, so only code that needs the grid pays for it.

### Error model

Failures are split by cause so you know what to catch:

| Call                                                                | On bad input                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `StarSystem.fromName(name)`                                         | returns `null` when the name is malformed                                                   |
| `StarSystem.fromSystemAddress(id64)` / `fromModSystemAddress(id64)` | throws `RangeError` when the address is outside 64 bits or resolves to an unnamed grid slot |
| `sys.systemAddress` / `sys.modSystemAddress`                        | throws on access — `Error` (unknown region) or `RangeError` (field out of range)            |

Reading `.name`, `.sectorName`, `.massCode`, `.coords` never throws.

## The four kinds of "region"

Elite Dangerous overloads the word _region_. The API keeps them separate — this
table is the map:

| Concept                   | What it is                                              | Entry point                                               |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| **Procedural sector**     | The boxel-grid name (`Synuefe`, `Blae Eock`)            | `sectorNameFromCoords` / `sectorCoordsFromName`           |
| **Region origin**         | A sector's corner, needed to encode a name to an `id64` | `resolveRegionOrigin`                                     |
| **Hand-authored region**  | A named nebula/cluster sector (Pleiades, Coalsack)      | `handAuthoredRegionForCoords` / `HAND_AUTHORED_REGIONS`   |
| **Galactic codex region** | One of the 42 codex zones (Inner Orion Spur, …)         | `findRegionAt` / `getGalacticRegion` / `GALACTIC_REGIONS` |

None of these is the _nebula catalogue_. A hand-authored region is a named **sector
volume** the game names systems after (some happen to be nebulae); if you want
nebulae themselves — where they are and what they're called — see
[Nebulae](#nebulae) below.

One sample of each:

```ts
import {
  sectorNameFromCoords, // procedural sector
  resolveRegionOrigin, // region origin
  handAuthoredRegionForCoords, // hand-authored region
  findRegionAt, // galactic codex region
} from "@elite-dangerous-almanac/core/astro";

// Procedural sector — the boxel-grid name for a grid position
sectorNameFromCoords({ x: 39, y: 30, z: 20 }); // 'Blae Eock'

// Region origin — a sector's corner in internal units, used to encode an id64
resolveRegionOrigin("Synuefe");
// { name: 'Synuefe', x0: 1597440, y0: 1269760, z0: 737280, sizeX: 40960, sizeY: 40960, sizeZ: 40960 }

// Hand-authored region — a named nebula/cluster sector, by galactic coordinates
handAuthoredRegionForCoords({ x: -80.6, y: -146.7, z: -343.3 })?.name; // 'Pleiades Sector'

// Galactic codex region — one of the 42 codex zones, by a point on the galactic plane
findRegionAt({ x: 0, z: 0 })?.name; // 'Inner Orion Spur'
```

## Nebulae

5835 catalogued nebulae, each with the system it is catalogued at, its galactic
coordinates and its codex region id. They ship as **one module per class**, so you
pay only for the catalogue you import (subpaths below are relative to
`@elite-dangerous-almanac/core`):

| Import                    | Export              | What's in it                                                          | Entries | ≈ bundled |
| ------------------------- | ------------------- | --------------------------------------------------------------------- | ------- | --------- |
| `astro/nebulae-real`      | `REAL_NEBULAE`      | Real-world nebulae and dark regions (Witch Head, Horsehead, Coalsack) | 180     | 19 KB     |
| `astro/nebulae-procgen`   | `PROCGEN_NEBULAE`   | Procedurally generated nebulae (`Agnairt AA-A h36`)                   | 166     | 19 KB     |
| `astro/nebulae-planetary` | `PLANETARY_NEBULAE` | Planetary nebulae, at the system each surrounds                       | 5489    | 645 KB    |
| `astro/nebulae-all`       | `ALL_NEBULAE`       | All three, concatenated                                               | 5835    | 682 KB    |

The query functions live in `astro/nebulae` and hold no data — hand them whichever
catalogue you imported:

```ts
import {
  nearestNebulae,
  nebulaeWithin,
  getNebulaByName,
} from "@elite-dangerous-almanac/core/astro/nebulae";
import { REAL_NEBULAE } from "@elite-dangerous-almanac/core/astro/nebulae-real";

nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 3).map((n) => n.name);
// -> [ 'Pleiades', 'R Cra', 'Lupus Dark Region B' ]   (nearest first)

nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 1)[0].distanceLy; // -> ≈383.31
nebulaeWithin({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 400).length; // -> 1
getNebulaByName("witch head nebula", REAL_NEBULAE)?.system; // -> 'Witch Head Sector RY-R b4-0'
```

Each record carries a `regionId` (1–42), so you can label a nebula's codex region
with `getGalacticRegion` (~9 KB of region metadata) instead of `findRegionAt`
(~207 KB lookup grid). Note that the catalogue stores one point per nebula — the
position of its catalogued system — not the nebula's extent, so `distanceLy` is
the distance to that system.

> **Not the same as a hand-authored region.** `REAL_NEBULAE` and friends are a
> _catalogue of nebulae and where they are_. A **hand-authored region** (previous
> section) is a _named sector volume_ the game names systems after — some are
> nebulae, some are clusters, and the two lists neither match nor line up
> one-to-one. `StarSystem` has no nebula member for the same reason it has no
> `galacticRegion` one: a class getter would drag a catalogue into every import.

## Permit locks

Which systems a commander cannot jump to without a permit. Nothing in the game's
data or in any API reports this — even Sol, permit-locked since launch, returns no
permit flag — so it is a community-maintained list with two halves:

| Import                        | Export                    | What's in it                                                                          | Entries |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------- | ------- |
| `astro/permit-locked-systems` | `PERMIT_LOCKED_SYSTEMS`   | Individually locked systems, each with its `id64` (Sol, Shinrarta Dezhra, Achenar, …) | 54      |
| `astro/permit-locked-regions` | `PERMIT_LOCKED_REGIONS`   | Whole regions behind one permit (Col 70 Sector, Bleia1, the Cone Sector, …)           | 28      |
| `astro/permit-locks`          | `permitLockForSystemName` | Combined exact-system and region-prefix lookup                                        | —       |

These modules are the **only** place permit state lives — `HandAuthoredRegion`
carries no permit flag. Import either leaf to avoid loading the other catalogue;
`permitLockForSystemName` checks both halves from a name alone and
tells you which one applied (~2.9 KB bundled):

```ts
import {
  permitLockForSystemName,
  isPermitLockedSystemName,
  permitLockedSystemForAddress,
} from "@elite-dangerous-almanac/core/astro/permit-locks";

permitLockForSystemName("sol"); // { kind: 'system', name: 'Sol', id64: 10477373803n }
permitLockForSystemName("Col 70 Sector AA-D b17-0"); // { kind: 'region', name: 'Col 70 Sector' }
permitLockForSystemName("Maia"); // null

isPermitLockedSystemName("Cone Sector GW-W c1-5"); // true

// A normally parsed journal address is a number; bigint and decimal strings work too
permitLockedSystemForAddress(event.SystemAddress); // PermitLockedSystem | null
```

Region membership comes from the **system name**, since no per-system
region-permit flag exists anywhere: the game names every system in a region after
it, so each entry of `PERMIT_LOCKED_REGIONS` is both the region's name and the
prefix to match. The match is whole-token, so `Col 70 Sector` never catches
`Col 700 Sector …` and `Horsehead Dark Region` never catches the unlocked
`Horsehead Sector …`.

**If you have coordinates, prefer them** — resolving a region from a position is
exact, where matching the start of a name is best-effort:

```ts
import { handAuthoredRegionForCoords } from "@elite-dangerous-almanac/core/astro/hand-authored-regions";
import { isPermitLockedRegionName } from "@elite-dangerous-almanac/core/astro/permit-locked-regions";

const region = handAuthoredRegionForCoords(coords);
const needsPermit = region !== null && isPermitLockedRegionName(region.name);
```

Both routes read the same 28 names, so they cannot drift; the test suite checks
they agree on real systems from EDSM.

Scope: systems only. Permit-locked _bodies_ in otherwise-open systems (Diso 5 C,
Lave 2, Sol's Moon and Triton) are deliberately excluded, since a system-level flag
would be wrong for them.

## Materials

The `materials` feature area covers the 146 engineering **materials** — raw,
manufactured and encoded — each with its grade (1–5, which **is** its rarity, from
Very Common to Very Rare) and in-game line. Guardian and Thargoid materials are
included. They ship as **one module per category**, so you pay only for what you
import (subpaths below are relative to `@elite-dangerous-almanac/core`):

| Import                             | Export                   | What's in it                                         | Entries |
| ---------------------------------- | ------------------------ | ---------------------------------------------------- | ------- |
| `materials/materials-raw`          | `RAW_MATERIALS`          | The 28 elements, seven lines of grades 1–4           | 28      |
| `materials/materials-manufactured` | `MANUFACTURED_MATERIALS` | Ten five-grade lines plus Guardian & Thargoid        | 71      |
| `materials/materials-encoded`      | `ENCODED_MATERIALS`      | Seven five-grade data lines plus Guardian & Thargoid | 47      |
| `materials/materials-all`          | `ALL_MATERIALS`          | All three, concatenated                              | 146     |

The query functions live in `materials` and hold no data — hand them whichever
catalogue you imported:

```ts
import {
  getMaterialBySymbol,
  getMaterialByName,
  materialsByGrade,
  materialsInLine,
  MaterialGrade,
  MaterialLine,
} from "@elite-dangerous-almanac/core/materials";
import { RAW_MATERIALS } from "@elite-dangerous-almanac/core/materials/materials-raw";
import { MANUFACTURED_MATERIALS } from "@elite-dangerous-almanac/core/materials/materials-manufactured";
import { ENCODED_MATERIALS } from "@elite-dangerous-almanac/core/materials/materials-encoded";

const iron = getMaterialByName("iron", RAW_MATERIALS);
iron?.grade; // -> MaterialGrade.VeryCommon
iron && MaterialGrade[iron.grade]; // -> 'VeryCommon' (rarity tier)
getMaterialBySymbol("temperedalloys", MANUFACTURED_MATERIALS)?.name; // -> 'Tempered Alloys'
materialsByGrade(MaterialGrade.Rare, RAW_MATERIALS).length; // -> 7 (one per raw line)
materialsInLine(MaterialLine.EmissionData, ENCODED_MATERIALS).length; // -> 5 (grades 1–5)
```

Each material carries a stable Frontier `symbol`; the journal names materials by
the lower-cased symbol, so `getMaterialBySymbol` accepts either casing. A
material's **grade is its rarity** — the `MaterialGrade` enum's member names are
the tiers (`VeryCommon` … `VeryRare`), so there is no separate rarity field; read
`MaterialGrade[grade]` if you need the tier as a string. Raw materials stop at
grade 4 — there is no grade-5 raw element.

> **Newest Thargoid materials.** The caustic/Titan materials are not yet in the
> community `material.csv` registry; their grade is sourced from INARA. They are
> catalogued here by their journal `symbol`, like every other material. See
> `data/materials/SOURCES.md` for the list.

### Odyssey micro resources

The same `materials` feature area also carries the 196 on-foot **micro resources**
introduced by Odyssey — the components, data, consumables and items a Commander
carries on foot. These are a separate registry from the ship-side engineering
materials above: a micro resource is a plain `{ symbol, category, name }` record
with **no grade and no line**. Like the materials, they ship as one module per
category:

| Import                                 | Export                       | What's in it                                | Entries |
| -------------------------------------- | ---------------------------- | ------------------------------------------- | ------- |
| `materials/micro-resources-component`  | `COMPONENT_MICRO_RESOURCES`  | Parts spent upgrading suits and weapons     | 33      |
| `materials/micro-resources-consumable` | `CONSUMABLE_MICRO_RESOURCES` | Deployable field tools (medkits, grenades…) | 6       |
| `materials/micro-resources-data`       | `DATA_MICRO_RESOURCES`       | Intel and files traded on foot              | 114     |
| `materials/micro-resources-item`       | `ITEM_MICRO_RESOURCES`       | Physical goods collected and traded on foot | 43      |
| `materials/micro-resources-all`        | `ALL_MICRO_RESOURCES`        | All four, concatenated                      | 196     |

```ts
import {
  getMicroResourceBySymbol,
  getMicroResourceByName,
  microResourcesInCategory,
} from "@elite-dangerous-almanac/core/materials";
import { COMPONENT_MICRO_RESOURCES } from "@elite-dangerous-almanac/core/materials/micro-resources-component";
import { ALL_MICRO_RESOURCES } from "@elite-dangerous-almanac/core/materials/micro-resources-all";

getMicroResourceBySymbol("graphene", COMPONENT_MICRO_RESOURCES)?.name; // -> 'Graphene'
getMicroResourceByName("circuit board", COMPONENT_MICRO_RESOURCES)?.symbol; // -> 'circuitboard'
microResourcesInCategory("consumable", ALL_MICRO_RESOURCES).length; // -> 6
```

## Ships and outfitting

The `ships` feature area is Frontier's shipyard and outfitting registries: the
48 player-flyable **hulls** and the ~1200 fittable **modules**, each a symbol/name
record (not a stats sheet — no hull mass or module cost, which the source registry
does not carry).

Ships are one small catalogue, so the lookups carry the data:

```ts
import {
  SHIPS,
  getShipBySymbol,
  getShipByName,
} from "@elite-dangerous-almanac/core/ships/ships";

getShipBySymbol("empire_trader")?.name; // -> 'Imperial Clipper' (journal-style lowercase symbol)
getShipByName("Anaconda")?.symbol; // -> 'Anaconda'
SHIPS.length; // -> 48
```

Modules are split by Frontier's four outfitting **categories**, so you pay only
for the catalogue you import (subpaths below are relative to
`@elite-dangerous-almanac/core`):

| Import                    | Export              | What's in it                                            | Entries | ≈ bundled |
| ------------------------- | ------------------- | ------------------------------------------------------- | ------- | --------- |
| `ships/modules-standard`  | `STANDARD_MODULES`  | Core internals (armour, power plant, thrusters, FSD, …) | 521     | 67 KB     |
| `ships/modules-internal`  | `INTERNAL_MODULES`  | Optional internals (cargo, shields, scoops, cabins, …)  | 475     | 64 KB     |
| `ships/modules-hardpoint` | `HARDPOINT_MODULES` | Hardpoint weapons and tools                             | 159     | 25 KB     |
| `ships/modules-utility`   | `UTILITY_MODULES`   | Utility-mount fittings (chaff, heat sinks, boosters, …) | 35      | 4 KB      |
| `ships/modules-all`       | `ALL_MODULES`       | All four, concatenated                                  | 1190    | 161 KB    |

The query functions live in `ships/modules` and hold no data — hand them whichever
catalogue you imported:

```ts
import {
  getModuleBySymbol,
  getModulesByName,
  getModulesForShip,
} from "@elite-dangerous-almanac/core/ships/modules";
import { HARDPOINT_MODULES } from "@elite-dangerous-almanac/core/ships/modules-hardpoint";
import { STANDARD_MODULES } from "@elite-dangerous-almanac/core/ships/modules-standard";

getModuleBySymbol("Hpt_PulseLaser_Fixed_Small", HARDPOINT_MODULES)?.name; // -> 'Pulse Laser'
getModulesByName("Pulse Laser", HARDPOINT_MODULES).length; // every size/mount variant
getModulesForShip("Anaconda", STANDARD_MODULES).length; // -> 5 (its bulkhead set)
```

Each module carries a `class` (the module **size**, 0–8) and a `rating` (the grade
letter, A–I) — together the "5A" the outfitting screen shows. `mount`
(Fixed / Gimballed / Turreted) and `guidance` (Dumbfire / Seeker / Swarm) are
present only on the hardpoints that have them; `ship` is present only on armour,
the one hull-specific module (which is what `getModulesForShip` returns). Module
`name` is **not** unique — it repeats across sizes, ratings and hulls — so key on
`symbol`; `getModulesByName` returns every match.

## Market commodities

The `commodities` feature area is Frontier's commodity-market registry: the 256
**standard** goods traded at station markets and the 142 **rare** goods each
produced at a single station. Every entry is a symbol/name/category record (not a
price sheet — no buy/sell price, supply or demand, which the source registry does
not carry). The two registries share a shape, so you pay only for the catalogue you
import (subpaths below are relative to `@elite-dangerous-almanac/core`):

| Import                             | Export             | What's in it                                     | Entries |
| ---------------------------------- | ------------------ | ------------------------------------------------ | ------- |
| `commodities/commodities-standard` | `COMMODITIES`      | Standard market goods, all sixteen market groups | 256     |
| `commodities/commodities-rare`     | `RARE_COMMODITIES` | Location-specific rare/luxury goods              | 142     |
| `commodities/commodities-all`      | `ALL_COMMODITIES`  | Both, standard then rare                         | 398     |

The query functions live in `commodities` and hold no data — hand them whichever
catalogue you imported:

```ts
import {
  getCommodityBySymbol,
  getCommodityByName,
  commoditiesInCategory,
} from "@elite-dangerous-almanac/core/commodities";
import { COMMODITIES } from "@elite-dangerous-almanac/core/commodities/commodities-standard";
import { RARE_COMMODITIES } from "@elite-dangerous-almanac/core/commodities/commodities-rare";

getCommodityBySymbol("platinum", COMMODITIES)?.category; // -> 'Metals' (journal-style lowercase symbol)
getCommodityByName("lavian brandy", RARE_COMMODITIES)?.rare; // -> true
commoditiesInCategory("Metals", COMMODITIES).length; // -> every metal on the market
```

Each commodity carries a stable Frontier `symbol` (the journal names commodities by
its lower-cased form, so `getCommodityBySymbol` accepts either casing), a display
`name`, and a `category` — the market group it sells under (`Metals`, `Foods`,
`Legal Drugs`, …). A `rare` flag distinguishes the two registries; it is derived
from which catalogue a record lives in, so it stays correct through
`ALL_COMMODITIES`. A rare's origin station is **not** carried — the source's
`market_id` is dropped, since the library has no station registry to resolve it
against.

## Data freshness

The checked-in catalogues are snapshot **2026-07-24**. `data/SNAPSHOTS.md` records the initial-snapshot limitation and the versioning metadata required for every future update.

## Development

```bash
cd typescript
npm install
npm test         # shared fixtures + enforced 80% line/branch/function coverage
npm run typecheck
npm run build    # tsup -> dist/ (ESM + d.ts, per-subpath)
npm run docs     # typedoc -> GitHub Wiki markdown
```

Full API documentation is generated from source and published to the repository
wiki.

## Attributions

Much of this data and several algorithms come from the Elite Dangerous community.
The same credit lives next to each data file — as a comment header on the file
itself, with the long form in `data/astro/SOURCES.md` — and in the doc comment of
each ported module. (Attribution sits in a comment rather than an `attribution`
field so it documents the data without being inlined into your bundle.)

- **Procedural sector & system naming** — ported and restructured from the
  [EDTS](https://github.com/Esvandiary/edts) reference algorithm (`pgdata.py`) by
  Alot (Esvandiary), via the canonn-signals TypeScript port. Original in-game
  algorithm reverse-engineered by the Elite Dangerous community.
- **Galactic codex regions** (the 42 regions, lookup grid, and boxel/coordinate
  region resolution) — from
  [EliteDangerousRegionMap](https://github.com/klightspeed/EliteDangerousRegionMap)
  by Ben Peddell ([klightspeed](https://github.com/klightspeed)), MIT. Per-region
  footprint figures (area, bounds, centroid) are derived by this project and are
  approximate. Original region-boundary research on the
  [Frontier forums](https://forums.frontier.co.uk/threads/determining-the-region-of-a-system.537845/).
- **Nebula catalogues** (names, catalogued systems, coordinates, classes and
  region ids) — from the EDAstro nebulae coordinates dataset by **CMDR Orvidius**
  ([EDAstro](https://edastro.com/mapcharts/)), obtained via
  [canonn-signals](https://github.com/canonn-science/canonn-signals) by the Canonn
  Research Group (MIT). EDAstro states no explicit licence for the dataset; check
  the site's terms before redistributing it.
- **Permit-locked systems and regions** — from the community-maintained "Elite
  Dangerous Permit Database" spreadsheet, obtained via
  [canonn-signals](https://github.com/canonn-science/canonn-signals) by the Canonn
  Research Group (MIT). Permit status is published in no game file or API, so the
  list is hand-maintained and best-effort; the region half is reconciled against
  this project's hand-authored region spheres and against
  [EDSM](https://www.edsm.net).
- **Hand-authored region spheres, named-region origins, and ground-truth `id64`
  fixtures** — factual records compiled and cross-checked against
  [EDSM](https://www.edsm.net) and [Spansh](https://spansh.co.uk). Detailed
  per-file derivations and source terms are recorded in `data/astro/SOURCES.md`
  and shipped to npm consumers in `THIRD_PARTY_NOTICES.md`.
- **Engineering materials** (raw, manufactured, encoded — names, ids, symbols,
  grades and groups) — from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), the
  community-maintained registry of Frontier's internal ids (no explicit licence
  stated; check the repository terms). The newest Thargoid caustic/Titan materials
  it does not yet list are filled in from [INARA](https://inara.cz/elite/components/).
  Full provenance in `data/materials/SOURCES.md`.
- **Odyssey micro resources** (on-foot components, data, consumables and items —
  names, symbols and categories) — from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs)
  (`microresources.csv`), the community-maintained registry of Frontier's internal
  ids (no explicit licence stated; check the repository terms). Full provenance in
  `data/materials/SOURCES.md`.
- **Ships and outfitting modules** (hull and module names, ids, symbols, sizes,
  ratings, mounts and entitlements) — from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs)
  (`shipyard.csv`, `outfitting.csv`), the community-maintained registry of
  Frontier's internal ids (no explicit licence stated; check the repository terms).
  Full provenance in `data/ships/SOURCES.md`.
- **Market commodities** (standard and rare goods — names, symbols and market
  categories) — from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs)
  (`commodity.csv`, `rare_commodity.csv`), the community-maintained registry of
  Frontier's internal ids (no explicit licence stated; check the repository terms).
  Full provenance in `data/commodities/SOURCES.md`.

If you add or change data, port an algorithm, or add a dependency that warrants
credit, update both the in-source attribution and this section in the same change.

## License

MIT.
