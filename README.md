# Elite Dangerous Almanac

Ready-to-go static data and calculations for Elite Dangerous community apps and
researchers. Batteries-included, tree-shakeable, and validated against
language-neutral fixtures so every language port behaves identically.

The library is a monorepo with one folder per language implementation over shared
data. **TypeScript** is available today (`typescript/`); Python is planned.

## What's in it

Four feature areas, each its own import subpath, each with leaf modules so you
bundle only the catalogues you touch:

| Feature area                         | What it answers                                                                                                                         | Start with                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [`astro`](#quick-start)              | System name ⇄ `id64`, sectors, galactic regions, 5835 nebulae, permit locks                                                             | `StarSystem`                     |
| [`ships`](#ships-and-outfitting)     | 48 hulls and ~1200 modules with stats, slots and prices, SLEF builds, jump range, power, shields, armour, weapon DPS, engineering costs | `ShipLoadout`, `getShipBySymbol` |
| [`materials`](#materials)            | 146 engineering materials (grade = rarity) and 196 Odyssey micro resources                                                              | `getMaterialByName`              |
| [`commodities`](#market-commodities) | 256 standard and 142 rare market goods                                                                                                  | `getCommodityBySymbol`           |

Also here: [the four kinds of "region"](#the-four-kinds-of-region) (the one thing
that trips everyone up), [nebulae](#nebulae), [permit
locks](#permit-locks), [ship and module stats](#ship-and-module-stats), [SLEF and
jump range](#ship-builds-jump-range-and-slef), [build editing and
engineering](#building-and-engineering-a-loadout), [data
freshness](#data-freshness), [attributions](#attributions) and
[licensing](#license).

## Install (TypeScript)

```bash
npm install @elite-dangerous-almanac/core
```

Licensing note: the package bundles game and community data under
source-specific terms, including non-commercial terms. See [License](#license)
before redistribution or commercial use.

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
// The leaf entry is the cheap one: ~101 KB minified, against ~995 KB for the
// `/astro` barrel, which re-exports every catalogue in the area. A bundler will
// tree-shake the barrel down; Node evaluates whatever you import, so prefer leaves.
import { StarSystem } from "@elite-dangerous-almanac/core/astro/star-system";

// Name  ->  id64
const sys = StarSystem.fromName("Synuefe EN-H d11-96");
sys?.systemAddress; // 3309179996515n
sys?.sectorName; // 'Synuefe'
sys?.massCode; // 'd'

// id64  ->  name
StarSystem.fromSystemAddress(3309179996515n).name; // 'Synuefe EN-H d11-96'

// A journal address is a plain number after JSON.parse — that works too,
// as does a decimal string from a database or URL.
StarSystem.fromSystemAddress(event.SystemAddress).name;

// id64 + coordinates  ->  the name the game actually shows
// (a system inside a hand-authored region renders under that region's name)
const address = 2724879894859n;
const coords = { x: -80.625, y: -146.65625, z: -343.25 };

StarSystem.fromSystemAddress(address).name; // 'Synuefai XU-M d8-79'   <- procedural
StarSystem.fromSystemAddress(address, coords).name; // 'Pleiades Sector HR-W d1-79'  <- what the game shows
```

**Why `coords`?** An `id64` encodes only the boxel, not the exact position, so on
its own it can't tell whether a system sits inside a hand-authored region
(Pleiades, Coalsack, …) — as the two lines above show, the same address renders
under two different names. Pass the coordinates you already have alongside the
`id64` — from the player journal, [EDSM](https://www.edsm.net) or
[Spansh](https://spansh.co.uk), in light-years with Sol at the origin — to get the
name the game displays. Without them you get the procedural name.

**Which types an address accepts.** Every entry point that takes an `id64` —
`StarSystem.fromSystemAddress`, `decodeSystemAddress`, `findRegionForBoxel`,
`permitLockedSystemForAddress` — accepts a `bigint`, a `number` (a normally parsed
journal event), or a decimal string. A number beyond `2^53 - 1` has already been
rounded by `JSON.parse`, so it is rejected with a `TypeError` rather than resolving
the wrong system; convert those yourself with `toSystemAddress`. Addresses come
back as `bigint`, because the fields reach bit 55.

Prefer a single calculation? Skip the class and import the pure function:

```ts
import { sectorNameFromCoords } from "@elite-dangerous-almanac/core/astro/sector-name";
import { decodeSystemAddress } from "@elite-dangerous-almanac/core/astro/system-address";
import {
  findRegionForBoxel,
  findRegionAt,
} from "@elite-dangerous-almanac/core/astro/galactic-region-lookup";

sectorNameFromCoords({ x: 39, y: 30, z: 20 }); // 'Blae Eock' (sector indices, not light-years)
decodeSystemAddress(3309179996515n); // { sizeClass, sectorCoords, boxelCode, ... }
findRegionForBoxel(3309179996515n).region?.name; // 'Inner Orion Spur' (a system's codex region)
findRegionAt({ x: 0, z: 0 })?.name; // 'Inner Orion Spur' (codex region at coords, in light-years)
```

`findRegionAt` takes a flat `{ x, z }` — the region map is an X/Z projection, so the
vertical `y` is ignored. Coordinates you already hold as a `GalacticCoords` variable
pass straight through, but writing the `y` inline (`findRegionAt({ x, y, z })`) is a
compile error: TypeScript rejects excess properties on fresh object literals.

> **"Modulated" addresses.** Alongside the `id64`, a few community tools and data dumps
> use a _modulated_ address: the same system, a different bit layout. `decodeSystemAddress`
> and `StarSystem.fromSystemAddress` are for the ordinary `id64` that the journal, EDSM,
> EDDN and Spansh all report; reach for the `…Mod…` variants only when a source hands you
> the modulated form. They routinely exceed `2^53`, so keep them as `bigint`.

> **Codex region and bundle size.** `StarSystem` deliberately has no
> `galacticRegion` member: wiring the region lookup into the facade would pull the
> ~267 KB region-cell grid into _every_ `StarSystem` import (a class getter can't be
> tree-shaken away when unused). Get a system's region from its address with the
> standalone `findRegionForBoxel` instead, so only code that needs the grid pays for it.

### Error model

Failures are split by cause so you know what to catch:

| Call                                                                | On bad input                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StarSystem.fromName(name)`                                         | returns `null` when the string is not a **procedural** name — a real but hand-named system (`Sol`, `Maia`) also yields `null`, since it has no algorithmic address                                              |
| `StarSystem.fromSystemAddress(id64)` / `fromModSystemAddress(id64)` | throws `TypeError` when the value cannot be an address (non-integer, or a `number` past `2^53` that `JSON.parse` already rounded); throws `RangeError` when it is outside 64 bits or names an unnamed grid slot |
| `sys.systemAddress` / `sys.modSystemAddress`                        | throws on access — `Error` (unknown region) or `RangeError` (field out of range)                                                                                                                                |
| `sectorNameFromCoords(coords)`                                      | throws `RangeError` unless each axis is an integer 0–127 — those are **sector indices**, not light-years ([see below](#the-four-kinds-of-region))                                                               |

Reading `.name`, `.sectorName`, `.massCode`, `.coords` never throws. Every lookup in
the library returns `null` when there is nothing to return — including `sys.coords`,
which is `null` unless you supplied coordinates.

## The four kinds of "region"

Elite Dangerous overloads the word _region_. The API keeps them separate — this
table is the map:

| Concept                   | What it is                                              | Entry point                                                                                  | Takes                        |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------- |
| **Procedural sector**     | The boxel-grid name (`Synuefe`, `Blae Eock`)            | `sectorNameFromGalacticCoords` / `sectorNameFromCoords` / `sectorCoordsFromName`             | light-years / sector indices |
| **Region origin**         | A sector's corner, needed to encode a name to an `id64` | `resolveRegionOrigin`                                                                        | a sector name                |
| **Hand-authored region**  | A named nebula/cluster sector (Pleiades, Coalsack)      | `handAuthoredRegionForCoords` / `HAND_AUTHORED_REGIONS`                                      | light-years                  |
| **Galactic codex region** | One of the 42 codex zones (Inner Orion Spur, …)         | `findRegionAt` (a position) / `findRegionForBoxel` (an `id64`) / `getGalacticRegion` (an id) | light-years / `id64`         |

Note the shapes differ: `findRegionAt` hands back the region (or `null`), while
`findRegionForBoxel` hands back `{ x, y, z, region }` — the boxel corner **and** the
region there, because it had to compute the position to answer at all.

None of these is the _nebula catalogue_. A hand-authored region is a named **sector
volume** the game names systems after (some happen to be nebulae); if you want
nebulae themselves — where they are and what they're called — see
[Nebulae](#nebulae) below.

One sample of each:

```ts
import {
  sectorNameFromGalacticCoords, // procedural sector, from a position
  sectorNameFromCoords, // procedural sector, from a grid index
  resolveRegionOrigin, // region origin
  handAuthoredRegionForCoords, // hand-authored region
  findRegionAt, // galactic codex region
} from "@elite-dangerous-almanac/core/astro";

// Procedural sector — from a real position (light-years, Sol at origin)
sectorNameFromGalacticCoords({ x: 751, y: -179, z: -91 }); // 'Synuefe'

// …or from a sector index, if that is what you hold (integers 0–127, NOT light-years)
sectorNameFromCoords({ x: 39, y: 30, z: 20 }); // 'Blae Eock'

// Region origin — a sector's corner in internal units (32 per light-year, measured
// from the galaxy's corner), used to encode an id64
resolveRegionOrigin("Synuefe");
// { name: 'Synuefe', x0: 1597440, y0: 1269760, z0: 737280, sizeX: 40960, sizeY: 40960, sizeZ: 40960 }

// Hand-authored region — a named nebula/cluster sector, by galactic coordinates (light-years)
handAuthoredRegionForCoords({ x: -80.6, y: -146.7, z: -343.3 })?.name; // 'Pleiades Sector'

// Galactic codex region — one of the 42 codex zones, by a point on the galactic plane (light-years)
findRegionAt({ x: 0, z: 0 })?.name; // 'Inner Orion Spur'
```

> **Three coordinate conventions, one `{ x, y, z }` shape.** Light-years with Sol at
> the origin (`GalacticCoords`) is what the journal, EDSM and Spansh give you and what
> most functions here take. A **sector index** (`SectorCoords`) is a position on the
> 128³ grid of 1280 ly cubes — `sectorNameFromCoords` wants those, and TypeScript
> cannot tell the two apart, so convert with `sectorCoordsFromGalacticCoords` (or skip
> the step with `sectorNameFromGalacticCoords`). **Internal units** are 1/32 light-year
> from the galaxy's corner, and appear only in `RegionOrigin` and the boxel maths.
> `GALAXY_ORIGIN` and `SECTOR_EDGE_LY` are exported if you want to do the arithmetic
> yourself.

**Coordinates from an `id64`, approximately.** No `id64` carries an exact position, but
`findRegionForBoxel` returns the corner of the system's boxel in light-years — accurate
to one boxel edge (10 ly at mass code `a`, 1280 ly at `h`):

```ts
import { findRegionForBoxel } from "@elite-dangerous-almanac/core/astro/galactic-region-lookup";

const { x, y, z, region } = findRegionForBoxel(3309179996515n);
// { x: 735, y: -185, z: -105, region: … }   the real system is at (751, -179, -91)
```

## Nebulae

5835 catalogued nebulae, each with the system it is catalogued at, its galactic
coordinates and its codex region id. They ship as **one module per class**, so you
pay only for the catalogue you import (subpaths below are relative to
`@elite-dangerous-almanac/core`):

| Import                    | Export              | What's in it                                                          | Entries | Minified | Gzipped |
| ------------------------- | ------------------- | --------------------------------------------------------------------- | ------- | -------- | ------- |
| `astro/nebulae-real`      | `REAL_NEBULAE`      | Real-world nebulae and dark regions (Witch Head, Horsehead, Coalsack) | 180     | 19 KB    | 5 KB    |
| `astro/nebulae-procgen`   | `PROCGEN_NEBULAE`   | Procedurally generated nebulae (`Agnairt AA-A h36`)                   | 166     | 19 KB    | 6 KB    |
| `astro/nebulae-planetary` | `PLANETARY_NEBULAE` | Planetary nebulae, at the system each surrounds                       | 5489    | 645 KB   | 140 KB  |
| `astro/nebulae-all`       | `ALL_NEBULAE`       | All three, concatenated                                               | 5835    | 682 KB   | 151 KB  |

Every size in this README is the published **minified** ESM as npm ships it, measured
over a module and everything it imports; the gzipped figure is what a server sends.

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
(~267 KB lookup grid). Note that the catalogue stores one point per nebula — the
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
tells you which one applied (~4 KB minified).

Six lookups answer this question and their names are close together, so pick by what
you hold and what you want back:

| You have                                           | You want                              | Call                                   |
| -------------------------------------------------- | ------------------------------------- | -------------------------------------- |
| a system name                                      | either kind of lock, and which        | `permitLockForSystemName` ← start here |
| a system name                                      | just yes/no (either kind)             | `isPermitLockedSystemName`             |
| a system name                                      | only its _own_ lock, ignoring regions | `permitLockedSystemForName`            |
| an `id64` / journal address                        | the individually locked system        | `permitLockedSystemForAddress`         |
| a **region** name (e.g. resolved from coordinates) | whether that region is locked         | `isPermitLockedRegionName`             |
| a system name                                      | the locked region it sits in          | `permitLockedRegionForSystemName`      |

Note `isPermitLockedSystemName` is _not_ the boolean twin of
`permitLockedSystemForName`: it reports `true` for a region lock too, while
`permitLockedSystemForName` only ever consults the exact-system list.

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
the lower-cased symbol, so `getMaterialBySymbol` accepts either casing. Every lookup in
the library — by symbol, name, category or line — ignores case and surrounding
whitespace, so a value that arrived from a journal line or a dropdown resolves as it is. A
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

The `ships` feature area covers Frontier's 48 player-flyable **hulls** and the ~1200
fittable **modules** — each as **one record carrying identity, stats, price and (for
hulls) slot layout together** — plus **jump-range calculations** you can drive straight from
a [SLEF](#ship-builds-jump-range-and-slef) export. Modules stay split by outfitting
category for direct catalogue imports, so an app can avoid categories it does not
search. The high-level `ShipLoadout` facade is the deliberate exception: resolving
an arbitrary imported build and its engineering requires all four module catalogues.

Ships are one small catalogue, so the lookups carry the data. Each `Ship` carries the
hull's identity, its stats (`hullMass`, `speed`, …) and its slot layout (`core`,
`hardpoints`, …). Most mechanical data comes from coriolis-data; the Lynx Highliner's
equivalent fields come from EDSY and Frontier's update notes:

```ts
import {
  SHIPS,
  getShipBySymbol,
  getShipByName,
  getShipSlots,
} from "@elite-dangerous-almanac/core/ships/ships";

getShipBySymbol("empire_trader")?.name; // -> 'Imperial Clipper' (lookups accept either casing)
getShipBySymbol("anaconda")?.hullMass; // -> 400 (tonnes) — stats are on the record
getShipSlots("anaconda")?.hardpoints; // -> [4, 3, 3, 3, 2, 2, 1, 1] (slot layout, ready for the build editor)
getShipByName("Anaconda")?.symbol; // -> 'Anaconda'
SHIPS.length; // -> 48
```

The stored `symbol` is Frontier's own casing (`Empire_Trader`), while the journal's
`Ship` field carries it lower-cased (`empire_trader`). Every `*BySymbol` lookup here
matches case-insensitively, so either form resolves — but compare a record's `symbol`
to a journal value case-insensitively rather than with `===`.

Modules are split by Frontier's four outfitting **categories**, so you pay only
for the catalogue you import (subpaths below are relative to
`@elite-dangerous-almanac/core`). Each record carries the module's **identity and
its stats together** (see [Module stats](#ship-and-module-stats) below):

| Import                    | Export              | What's in it                                            | Entries |
| ------------------------- | ------------------- | ------------------------------------------------------- | ------- |
| `ships/modules-core`      | `CORE_MODULES`      | Core internals (armour, power plant, thrusters, FSD, …) | 521     |
| `ships/modules-internal`  | `INTERNAL_MODULES`  | Optional internals (cargo, shields, scoops, cabins, …)  | 483     |
| `ships/modules-hardpoint` | `HARDPOINT_MODULES` | Hardpoint weapons and tools                             | 159     |
| `ships/modules-utility`   | `UTILITY_MODULES`   | Utility-mount fittings (chaff, heat sinks, boosters, …) | 35      |
| `ships/modules-all`       | `ALL_MODULES`       | All four, concatenated                                  | 1198    |

The query functions live in `ships/modules` and hold no data — hand them whichever
catalogue you imported:

```ts
import {
  getModuleBySymbol,
  getModulesByName,
  getModulesForShip,
} from "@elite-dangerous-almanac/core/ships/modules";
import { HARDPOINT_MODULES } from "@elite-dangerous-almanac/core/ships/modules-hardpoint";
import { CORE_MODULES } from "@elite-dangerous-almanac/core/ships/modules-core";

getModuleBySymbol("Hpt_PulseLaser_Fixed_Small", HARDPOINT_MODULES)?.name; // -> 'Pulse Laser'
getModulesByName("Pulse Laser", HARDPOINT_MODULES).length; // every size/mount variant
getModulesForShip("Anaconda", CORE_MODULES).length; // -> 5 (its bulkhead set)
```

Each module carries a `class` (the module **size**, 0–8) and a `rating` (the grade
letter, A–I) — together the "5A" the outfitting screen shows. `mount`
(Fixed / Gimballed / Turreted) and `guidance` (Dumbfire / Seeker / Swarm) are
present only on the hardpoints that have them; `ship` is present only on armour,
the one hull-specific module (which is what `getModulesForShip` returns). Module
`name` is **not** unique — it repeats across sizes, ratings and hulls — so key on
`symbol`; `getModulesByName` returns every match.

### Ship and module stats

The numbers behind the catalogues — hull masses, module masses, power draw, FSD
constants, thruster/shield/distributor performance — are **fields on the very same
record**, so once you resolve a module or hull you already have its stats:

```ts
import { getModuleBySymbol } from "@elite-dangerous-almanac/core/ships/modules";
import { CORE_MODULES } from "@elite-dangerous-almanac/core/ships/modules-core";
import { getShipBySymbol } from "@elite-dangerous-almanac/core/ships/ships";

getShipBySymbol("anaconda")?.hullMass; // -> 400 (tonnes)
getModuleBySymbol("int_hyperdrive_size5_class5", CORE_MODULES)?.optMass; // -> 1050
```

The stat fields are **sparse** — a module carries only the ones its group uses.
`restrictedToShips` appears on the few non-armour modules limited to particular hulls
(e.g. the Python Mk II's MkII Gravity Optimised thrusters → `["Explorer_NX"]`);
armour's hull restriction stays in its `ship` field. Masses are tonnes, power
megawatts, jump ranges light-years, weapon ranges metres.

Alongside the mechanical stats, records carry what the [build
metrics](#build-metrics-power-shields-armour-and-firepower) need:

```ts
import { INTERNAL_MODULES } from "@elite-dangerous-almanac/core/ships/modules-internal";
import { HARDPOINT_MODULES } from "@elite-dangerous-almanac/core/ships/modules-hardpoint";

// Defence: resistances as fractions (negative is a weakness)
getModuleBySymbol("Int_ShieldGenerator_Size5_Class5", INTERNAL_MODULES)
  ?.thermalResistance; // -> -0.2
getModuleBySymbol("Int_HullReinforcement_Size3_Class2", INTERNAL_MODULES)
  ?.hullReinforcement; // -> 260

// Armour is a module too: each hull's variants carry that hull's mass and hull boost
getModuleBySymbol("Anaconda_Armour_Reactive", CORE_MODULES)?.hullBoost; // -> 2.5 (base armour x 3.5)

// Weapons: damage per round, its type split, and the rate that turns it into DPS
const mc = getModuleBySymbol("Hpt_MultiCannon_Fixed_Small", HARDPOINT_MODULES)!;
mc.damage; // -> 1.12   per round
mc.rateOfFire; // -> 7.69   shots per second, bursts and charge time folded in
mc.damageDistribution; // -> { kinetic: 1 }
```

A weapon's `damage` is per **round** and its `distributorDraw` and `thermalLoad` per
**shot** — the two differ on a weapon that fires several rounds at once, like a
fragment cannon. The continuous-fire beam and mining lasers carry no `rateOfFire`,
because all three stats are already per second on those.

#### Prices

Standard list prices in credits sit on the same records — no second lookup:

```ts
getModuleBySymbol("int_powerplant_size8_class1", CORE_MODULES)?.cost; // -> 1441233

getShipBySymbol("anaconda")?.hullCost; // -> 142456440  (bare hull)
getShipBySymbol("anaconda")?.retailCost; // -> 146969451  (hull + default modules)
```

These are the **undiscounted** list prices an outfitting screen quotes at 0%
discount — stations apply their own discount or markup on top, which is live market
state this library does not carry.

All 48 hulls are priced, and 1178 of 1198 modules. The rest — the starter `*_free`
variants, the size-8 frame shift drives, and a few reward-only internals — have no
published price, so **`cost` is `undefined` rather than `0`**. That distinction is
deliberate: `0` is a real price (the starter Lightweight Alloy bulkhead is free), so
treat `undefined` as _unknown_ and decide for yourself whether to skip it or fail:

```ts
const cost = getModuleBySymbol(symbol, ALL_MODULES)?.cost;
if (cost === undefined) {
  // no published price — don't silently add 0 to a build total
}
```

### Ship builds, jump range and SLEF

Give `ShipLoadout` a **SLEF** export (the community ship-loadout format — a journal
`Loadout` event wrapped in a `{ header, data }` envelope, as EDSY and Coriolis
produce) and it answers jump-range and fuel questions about the build:

```ts
import { ShipLoadout } from "@elite-dangerous-almanac/core/ships/ship-loadout";

const build = ShipLoadout.fromSlef(slefJsonString); // string or parsed value

build.shipName; // -> 'The Deep Black'
build.maxJumpRange(); // -> 89.41  best single jump (one jump's fuel, no cargo)
build.unladenJumpRange(); // full tank, no cargo
build.ladenJumpRange(); // full tank, full cargo
build.jumpRange({ fuel: 32, cargo: 16 }); // any partial load you like
build.totalRange(); // -> multi-jump range as the tank drains
build.fuelPerJump(50); // -> tonnes of fuel a 50 LY jump costs

build.jumpRangeSummary(); // all five at once:
// -> { max, unladen, laden, totalUnladen, totalLaden }
```

`ShipLoadout` resolves the drive's constants from the module stats and applies the
export's engineering (a Long Range blueprint's `FSDOptimalMass`, a Guardian FSD
Booster's bonus). Need just the maths? Skip the class and import the pure functions
from `ships/jump-range` (`singleJumpRange`, `fuelPerJump`, `totalRange`), or parse a
SLEF export yourself with `parseSlef` from `ships/slef`. The port is validated
against EDSY: it reproduces the sample build's exported `MaxJumpRange` of 89.414678.

> **Bundle size:** `ShipLoadout` is a batteries-included facade. Its leaf import
> currently reaches about 589 KB of minified JavaScript (~66 KB gzipped) because it
> must resolve any ship/module id plus blueprints and experimental effects. Prefer
> `ships/slef`, `ships/jump-range`, the [build-metric
> modules](#build-metrics-power-shields-armour-and-firepower) (1–3 KB each), and the
> individual catalogue modules when you only need parsing, maths, or one outfitting
> category.

#### Build metrics: power, shields, armour and firepower

The same handle answers the rest of what an outfitting screen shows. Every figure is
**post-engineering** — journal modifiers on the fitted modules are applied first — and
modules switched off in the build are left out:

```ts
const build = ShipLoadout.fromSlef(slefJsonString);

// Power: what the plant makes against what the build draws
const power = build.powerBudget();
power.available; // -> 22.85 MW generated
power.retracted; // -> draw with the hardpoints stowed
power.deployed; // -> draw with them out (weapons only draw deployed)
power.headroom; // -> available - deployed; negative means over budget
power.withinBudget; // -> true
power.bands[4]?.poweredDeployed; // -> is priority group 5 still lit?

// Shields: strength in MJ and what it is worth against each damage type
const shields = build.shieldMetrics(); // null when no generator is fitted
shields?.strength; // -> 230.65 MJ  (generator + boosters + Guardian reinforcement)
shields?.resistances.thermal; // -> -0.2  a stock generator is thermally weak
shields?.effectiveHitPoints.kinetic; // -> kinetic damage the shields can soak
build.shieldMetrics({ systemsPips: 4 })?.resistances.thermal; // -> with 4 pips to SYS

// Armour: hull hit points and the bulkhead's resistances
const hull = build.armourMetrics();
hull.hitPoints; // -> 819.72  (base armour x bulkhead, plus reinforcement packages)
hull.resistances.explosive; // -> -0.33
hull.effectiveHitPoints.thermal; // -> thermal damage the hull can soak

// Firepower: per weapon and totalled (this exploration build carries none, so its
// own totals are zero — the lines below are what an armed build reports)
const guns = build.weaponMetrics();
guns.total.damagePerSecond; // -> DPS while the trigger is held
guns.total.sustainedDamagePerSecond; // -> with reloads folded in
guns.total.energyPerSecond; // -> MW drawn from the WEP capacitor
guns.total.heatPerSecond; // -> heat generated
guns.total.powerDraw; // -> MW asked of the power plant when deployed
guns.total.damageByType.thermal; // -> the thermal share of that DPS
guns.weapons[0]; // -> { slot, symbol, name, enabled, metrics }
```

**Shields scale with the hull's mass, not the build's** — fitting more modules never
weakens them — and a generator will not engage at all around a hull heavier than its
maximum mass. Resistances **stack with diminishing returns**: two 20% sources leave 36%,
not 40%, and past a threshold each further point is worth half as much. Armour hit
points are `baseArmour × (1 + hullBoost)` plus each hull reinforcement package.

Need just the maths, without a build? Each calculation is a data-free module you can
import on its own:

| Import              | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `ships/power`       | `powerBudget(available, consumers)` — totals and the priority groups  |
| `ships/shields`     | `shieldMetrics`, `shieldStrength`, `shieldMassCurveMultiplier`        |
| `ships/armour`      | `armourMetrics` — hit points, reinforcement, resistances              |
| `ships/weapons`     | `weaponMetrics`, `damagePerSecond`, `damageFalloff`, `splitDamage`    |
| `ships/resistances` | `stackShieldResistance`, `stackArmourResistance`, `systemsResistance` |

```ts
import { weaponMetrics } from "@elite-dangerous-almanac/core/ships/weapons";
import { getModuleBySymbol } from "@elite-dangerous-almanac/core/ships/modules";
import { HARDPOINT_MODULES } from "@elite-dangerous-almanac/core/ships/modules-hardpoint";

// A catalogue record is already a valid weapon input
const mc = getModuleBySymbol("Hpt_MultiCannon_Fixed_Small", HARDPOINT_MODULES)!;
weaponMetrics(mc).damagePerSecond; // -> 8.62
weaponMetrics(mc).sustainedDamagePerSecond; // -> 6.64, with the 4 s reload
```

The models are ported from [Coriolis](https://github.com/EDCD/coriolis) and
cross-checked against [EDSY](https://github.com/taleden/EDSY); see
[`data/ships/SOURCES.md`](data/ships/SOURCES.md) for the exact functions and commits.

#### Building and engineering a loadout

The same class assembles a build from scratch. Start an **empty** hull, enumerate its
mounts (core, hardpoint, utility, optional and armour — occupied or empty, with size
and any restriction), fit and remove modules, and engineer supported modules with a
blueprint calculator. Armour fits are checked against the hull; the built-in cargo
hatch is fixed.
Mass, fuel and jump range are computed from the fitted modules and the hull's stats.
Editing an imported SLEF build adjusts its supplied mass and capacity aggregates by
the changed module's contribution. If a contribution is unknown, the affected
aggregate is discarded and recomputed rather than returned stale.

```ts
import {
  ShipLoadout,
  getModuleBySymbol,
  ALL_MODULES,
  CORE_MODULES,
} from "@elite-dangerous-almanac/core/ships";

const build = ShipLoadout.empty("Anaconda");

build.optionalModules(); // every optional mount as a live slot handle: { key, name, size, occupied, ... }
build.coreModules(); // the seven core mounts; also hardpoints(), utilityMounts()

build
  .setModule(
    "FrameShiftDrive",
    getModuleBySymbol("Int_Hyperdrive_Size6_Class5", CORE_MODULES)!,
  )
  // A fuel tank is what a jump draws from — without one, maxJumpRange() is 0.
  .setModule(
    "Slot01_Size7",
    getModuleBySymbol("Int_FuelTank_Size6_Class3", CORE_MODULES)!,
  )
  .applyBlueprint("FrameShiftDrive", "FSD_LongRange", {
    grade: 5,
    experimental: "special_fsd_heavy",
  });

build.maxJumpRange(); // -> ~76.9, reflecting the engineered optimal mass
```

**Or work fluently through the slot and module handles**, so you never repeat a slot
key. `coreModules()` / `hardpoints()` / `utilityMounts()` / `optionalModules()` (and the
general `slots()` / `slotsOfKind()`) return **live `LoadoutSlot` views** that know their
own key; each fits, lists candidates and reaches its module in place. `getFittedModule()`
and `slot.module` return a **live `FittedModule` handle** you engineer directly:

```ts
const conda = ShipLoadout.empty("Anaconda");
const drive = conda.coreModules().find((s) => s.core === "frameShiftDrive")!;

drive.modulesForSlot(CORE_MODULES); // what fits *this* slot — no key argument
drive
  .fit(getModuleBySymbol("Int_Hyperdrive_Size6_Class5", CORE_MODULES)!) // -> FittedModule
  .applyBlueprint("FSD_LongRange", { grade: 5 }); // engineer it, still no key

const fsd = conda.getFittedModule("FrameShiftDrive")!;
fsd.getAvailableBlueprints(); // -> [{ fdname: "FSD_LongRange", grades: [1,2,3,4,5] }, ...]
fsd.getAvailableExperimentalEffects(); // -> ["special_fsd_heavy", ...] valid for this family
fsd.clearEngineering(); // back to base stats; fsd.remove() empties the slot
```

`setModule` (and `slot.fit`) validates the fit (module size ≤ slot size, right category,
military / planetary-approach and hull restrictions) and throws otherwise. **Slot keys
are the journal names** (`FrameShiftDrive`, `MainEngines` for thrusters, `Radar` for
sensors, `HugeHardpoint1`, `Slot01_Size7`, `Military01`, …), so a SLEF-loaded build and
one assembled here share one vocabulary — enumerate them with `slots()` rather than
guessing. They are matched **exactly**, in the game's spelling.

Careful with the two names a _core_ mount has: `slot.key` is the journal slot
(`MainEngines`, `Radar`) and is what every `slotKey` argument takes, while `slot.core` is
the camelCase function (`thrusters`, `sensors`) you filter on. That is why the example
above matches `s.core === "frameShiftDrive"` but calls
`getFittedModule("FrameShiftDrive")`. Pass the camelCase form where a key is expected
and you get nothing: `getFittedModule` returns `null`, `setModule` throws a `RangeError`
naming the slot it could not find. A module lives in the catalogue for its outfitting **category**, which is not
always the slot it occupies — a fuel tank is in `CORE_MODULES` even though it fits
an optional slot — so pass `ALL_MODULES` to `modulesForSlot` when you want every
candidate.

**Two ways to reach a hull's mounts.** For an editable build, start a `ShipLoadout` and
use its live handles — `slots()`, `coreModules()`, `hardpoints()`, `utilityMounts()`,
`optionalModules()` — which is what most consumers want. If you only need the **raw,
read-only** layout (to drive your own outfitting UI), call `getShipSlots(symbol)` and
feed the result to `enumerateSlots`; the rest of the `ships/slots` exports
(`BuildSlot`, `CoreSlots`, `parseSlotName`, …) are that low-level model.

`applyBlueprint` also validates that the blueprint and experimental effect belong to
the fitted module's engineering family, that quality is a finite value from 0 to 1,
and that the catalogue carries every base stat the recipe changes. An armour recipe,
for example, cannot be applied to an FSD merely because both modify mass or integrity;
a recipe whose combat or armour base stats are not carried is rejected rather than
silently emitting a partial `Engineering.Modifiers` block.

**Blueprint and experimental ids are Frontier `fdname`s** — the same strings a journal
`Loadout` event carries in `Engineering.BlueprintName` / `ExperimentalEffect` (e.g.
`FSD_LongRange`, `special_fsd_heavy`). Enumerate them with `Object.keys(BLUEPRINTS)` and
`Object.keys(EXPERIMENTAL_EFFECTS)`. Need only the engineering maths? `computeModifiers`
from `ships/engineering` turns a blueprint grade (from `ships/blueprints`) and an
experimental effect (from `ships/experimental-effects`) into journal-style modifiers.
The calculator is validated against the real "Deep Black" export — its size-8 drive's
optimal mass 4670 → 7528.04 at G5 Long Range + Mass Manager.

**Material requirements** — what a roll _costs_ — sit alongside the modifiers in
`ships/blueprints`: every grade is `{ features, materials }`, so `getBlueprintGrade`
gives the modifiers and `getBlueprintGradeMaterials` the recipe. Each requirement is
`{ symbol, name, count }`; join `symbol` to the [`materials`](#materials) domain for the
material's own grade and category:

```ts
import { getBlueprintGradeMaterials } from "@elite-dangerous-almanac/core/ships/blueprints";

getBlueprintGradeMaterials("FSD_LongRange", 5);
// -> [{ symbol: "Arsenic", name: "Arsenic", count: 1 },
//     { symbol: "ChemicalManipulators", name: "Chemical Manipulators", count: 1 },
//     { symbol: "DataminedWake", name: "Datamined Wake Exceptions", count: 1 }]
```

`null` means the blueprint or grade is unknown; an empty array means a **known** recipe
that costs nothing (only `CargoRack_IncreasedCapacity` grade 5). Blueprints are keyed
only by the grades that have data, so iterating grades 1–5 can return `null` for a grade
a blueprint doesn't define.

Experimental (special) effects cost materials too, and carry them the same way: each
effect in `ships/experimental-effects` is `{ modifiers, materials }`, so
`getExperimentalEffect` gives the modifiers and `getExperimentalEffectMaterials` the
recipe. An experimental effect is a single application (one roll), so its `materials` is
the whole cost.

**Total cost to a grade** — engineering a blueprint to a grade means rolling up through
the grades: grade `g` takes `g` rolls (grade 1 → 1 roll … grade 5 → 5 rolls), and each
roll consumes that grade's materials. So a grade-5-only material like Datamined Wake
Exceptions (1 per roll) costs 5 to complete grade 5. `getBlueprintCost` totals it for you.
Pass a **current grade** to price only what is left from a module that already sits at a
grade (default `0`, unengineered); set it to `grade − 1` to price a single grade alone.
Fold in an experimental effect with `sumMaterials` for the grand total:

```ts
import { getBlueprintCost } from "@elite-dangerous-almanac/core/ships/blueprints";
import { getExperimentalEffectMaterials } from "@elite-dangerous-almanac/core/ships/experimental-effects";
import { sumMaterials } from "@elite-dangerous-almanac/core/ships/engineering";

// Every material to take an FSD to G5 Long Range from scratch (1+2+3+4+5 rolls):
getBlueprintCost("FSD_LongRange", 5);
// -> includes { symbol: "DataminedWake", name: "Datamined Wake Exceptions", count: 5 }, ...

// Only what is left when the drive is already at grade 3 (grades 4 and 5):
getBlueprintCost("FSD_LongRange", 5, 3);

// …plus the Mass Manager experimental (one application):
sumMaterials(
  getBlueprintCost("FSD_LongRange", 5)!,
  getExperimentalEffectMaterials("special_fsd_heavy")!,
);
```

The two data modules stay decoupled — `getBlueprintCost` never pulls in the experimental
catalogue — so combine them yourself with `sumMaterials` only when you need both.

#### What a module can be engineered with

Before you pick a blueprint, you usually need the menu. Availability is a property of
the **module**, not the blueprint — a Pulse Laser and a Rail Gun both take Efficient but
offer different experimental effects:

```ts
import {
  getBlueprintsForModule,
  getExperimentalsForModule,
  getExperimentalsForBlueprint,
} from "@elite-dangerous-almanac/core/ships/engineering-options";

getBlueprintsForModule("Int_Hyperdrive_Size5_Class5");
// -> ['FSD_FastBoot', 'FSD_LongRange', 'FSD_Shielded']

getExperimentalsForModule("Hpt_MultiCannon_Fixed_Medium").length; // -> 12
getExperimentalsForModule("Hpt_MultiCannon_Fixed_Small").length; // -> 11
```

That one-effect difference is not a bug: the small Multi-cannon cannot take Phasing
Sequence. 29 modules are exceptions like this, and they are applied for you.

`getExperimentalsForBlueprint` answers the blueprint-first question, but it returns the
**union** across every module group offering that blueprint — so it is a superset, not
the exact list for any one module. Once you know the module, use
`getExperimentalsForModule`.

A module that cannot be engineered at all returns `[]` from both. To tell that apart
from a module that _is_ engineerable but has no experimental slot (the mining tools),
ask `getEngineeringGroup` — it returns `null` only for the former.

#### Modules you can buy already engineered

Some modules arrive **already engineered** — the Mercenary shop's rail gun, missile racks
and power distributors, the modules awarded for community goals, and the tech-broker
unlocks (the "V1" drives, the Guardian weapons). These have **no symbol of their own**:
the game hands you an ordinary module with engineering already applied, so a journal
reports the base symbol plus an `Engineering` block. `ships/pre-engineered` supplies the
link the module and blueprint catalogues cannot: which stock modules come pre-engineered,
and with what.

```ts
import {
  getPreEngineeredVariants,
  getPreEngineeredByBlueprint,
  isPreEngineered,
} from "@elite-dangerous-almanac/core/ships/pre-engineered";

isPreEngineered("Hpt_Railgun_Fixed_Medium"); // -> true

// One module can carry several variants — here a Merc shop row and a CG reward…
getPreEngineeredVariants("Hpt_Railgun_Fixed_Medium");
// -> [{ blueprint: 'recipe_railgun_longshot', grade: 1, acquisition: 'mercenary' }, …
//     { blueprint: 'Weapon_HighCapacity', grade: 5, acquisition: 'communityGoal',
//       experimental: 'special_feedback_cascade_cooled' }]

// …and one blueprint on several modules, so both lookups return arrays.
getPreEngineeredByBlueprint("recipe_seekermissilerack_drag").map(
  (v) => v.symbol,
);
// -> ['Hpt_BasicMissileRack_Fixed_Medium', 'Hpt_BasicMissileRack_Fixed_Large']
```

`acquisition` tells the three kinds apart, and they behave differently:

|                  | `mercenary` (21)    | `communityGoal` (30)  | `techBroker` (21)     |
| ---------------- | ------------------- | --------------------- | --------------------- |
| Blueprint id     | Merc `recipe_*` key | ordinary journal name | ordinary journal name |
| Grade on arrival | always 1            | 28 of 30 at grade 5   | 14 of 21 at grade 5   |
| Experimental     | none                | 8 of 30 carry one     | 4 of 21 carry one     |
| Price            | `mercCoinCost`      | not bought            | not bought            |
| Stat block       | not published       | `modifiers`           | `modifiers`           |

A variant's identity is the **`(symbol, blueprint, grade, experimental)` quadruple** — no
narrower key holds. The medium Seeker Missile Rack has three High Capacity rewards that
differ only in the effect applied, and the medium Guardian Shard Cannon carries Long
Range with no experimental **twice**: grade 5 as a CG reward, grade 1 from a tech broker.

##### Building a ship with one

A reward variant carries `modifiers` — the hand-set stat changes it actually arrives
with, in the same vocabulary blueprints use. `ships/pre-engineered-stats` resolves those
against the base module so the result can be fitted and budgeted:

```ts
import { getPreEngineeredVariants } from "@elite-dangerous-almanac/core/ships/pre-engineered";
import {
  getPreEngineeredStats,
  unresolvedModifiers,
} from "@elite-dangerous-almanac/core/ships/pre-engineered-stats";

const [fsdV1] = getPreEngineeredVariants("Int_Hyperdrive_Size5_Class5");
getPreEngineeredStats(fsdV1); // -> { …, optMass: 1785, mass: 26, integrity: 84, … }
// the stock 5A drive has optMass 1050 — this is the "V1" drive's known 1785
```

> **Weapon stats are not resolvable.** The module catalogues carry core and
> optional-internal stats, not `Damage` or `AmmoClipSize`, so a weapon variant's
> damage-side modifiers have no base value to apply to. They are reported by
> `unresolvedModifiers` rather than dropped silently; mass, integrity and power draw
> still resolve, which is what a power-and-mass budget needs.

> **A reward variant is not reproducible by engineering.** Those hand-set modifiers are
> what make it a reward. The recorded blueprint/grade/experimental **identify** it; they
> are not a recipe that recreates it, and `getBlueprintCost` on one prices ordinary
> engineering instead.

The 21 Merc shop rows carry a `mercCoinCost` (300–950 MC) but no `modifiers`: no registry
publishes the grade-1 pre-engineering they arrive with, so the catalogue omits it rather
than guessing. Resolving one returns the stock record unchanged.

Merc rows arrive at **grade 1**, which is why those blueprints' own recipes start at
grade 2 — the first grade came with the module. Price the rest of the climb by passing the
grade you already have:

```ts
const bought = getPreEngineeredByBlueprint("recipe_railgun_longshot")[0];
getBlueprintCost(bought.blueprint, 5, bought.grade); // grades 2-5 only
```

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

getCommodityBySymbol("platinum", COMMODITIES)?.category; // -> 'Metals' (either casing resolves)
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
wiki. The language-neutral JSON Schemas in `schemas/` validate shared catalogue
records (currently all ship-domain payloads) before an implementation builds them
into a package.

## Attributions

Much of this data and several algorithms come from the Elite Dangerous community.
The same credit lives next to each data file — as a comment header on the file
itself, with the long form in its domain's `SOURCES.md` — and in the doc comment of
each ported module. (Attribution sits in a comment rather than an `attribution`
field so it documents the data without being inlined into your bundle.)

- **Procedural sector & system naming** — ported and restructured from the
  [EDTS](https://bitbucket.org/Esvandiary/edts) reference algorithm
  (`edtslib/pgdata.py` and `edtslib/pgnames.py`) by **Andy Martin** (Esvandiary),
  **BSD 3-Clause, © 2016 Andy Martin**, via the
  [canonn-signals](https://github.com/canonn-science/canonn-signals) TypeScript
  port (MIT). Original in-game algorithm reverse-engineered by the Elite Dangerous
  community. (EDTS lives on Bitbucket, not GitHub.)
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
- **Ship and module stats, slot layouts and blueprints** (hull/module masses, power,
  FSD constants, thruster/shield/distributor performance, damage resistances, hull and
  shield reinforcement, weapon damage and rate of fire, armour hull boost,
  ship-restriction flags, per-hull slot layouts, engineering blueprint modifiers) — from
  [EDCD/coriolis-data](https://github.com/EDCD/coriolis-data) (`ships/*.json`,
  `modules/**`, `modifications/**`). Coriolis-data releases only its code under MIT;
  the stat values are Elite Dangerous game data, property of Frontier Developments plc
  (see the Frontier notice below). Full provenance in `data/ships/SOURCES.md`.
- **Build-metric algorithms** (power budget and priority groups, shield strength and
  its mass curve, armour hit points, resistance stacking and its diminishing returns,
  weapon DPS/EPS/HPS) — ported as fact (our own implementation) from
  [EDCD/Coriolis](https://github.com/EDCD/coriolis) by the **Coriolis contributors**
  (application code MIT-licensed): `src/app/shipyard/Calculations.js`, `Ship.js` and
  `Module.js`. Cross-checked against [EDSY](https://github.com/taleden/EDSY) by
  **taleden** (CC BY-NC 4.0), whose reading of real journal data settles the percentage
  stats' units and compounding. Both cite the original Frontier-forum research; see
  `data/ships/SOURCES.md` for the exact functions, commits and threads.
- **Jump-range & fuel algorithm, experimental-effect modifiers** — the hyperspace
  formula is ported as fact (our own implementation) from
  [EDSY](https://github.com/taleden/EDSY) by **taleden** (code licensed CC BY-NC 4.0),
  derived from Frontier's "mass effect on hyperspace range" description. The numeric
  experimental (special) effect modifiers **and their material recipes**, which
  coriolis-data does not carry, also come from EDSY (`eddb.js`). **SLEF** parsing follows the
  [Inara Ship Loadout Export Format spec](https://inara.cz/elite/inara-impexp-slef/).
- **Elite Dangerous game data** — the ship and module stat values are the property of
  **Frontier Developments plc**, used under Frontier's
  [media-usage rules](https://forums.frontier.co.uk/threads/elite-dangerous-media-usage-rules.510879/):
  _"Elite Dangerous Almanac was created using assets and imagery from Elite Dangerous,
  with the permission of Frontier Developments plc, for non-commercial purposes. It is
  not endorsed by nor reflects the views or opinions of Frontier Developments and no
  employee of Frontier Developments was involved in the making of it."_ Projects that
  redistribute this data should include the same notice.
- **Market commodities** (standard and rare goods — names, symbols and market
  categories) — from [EDCD FDevIDs](https://github.com/EDCD/FDevIDs)
  (`commodity.csv`, `rare_commodity.csv`), the community-maintained registry of
  Frontier's internal ids (no explicit licence stated; check the repository terms).
  Full provenance in `data/commodities/SOURCES.md`.

If you add or change data, port an algorithm, or add a dependency that warrants
credit, update both the in-source attribution and this section in the same change.

## License

The project's own code and documentation are MIT-licensed. Bundled Elite Dangerous
and third-party data remains under its source-specific terms, including
non-commercial restrictions described in `LICENSE` and
`typescript/THIRD_PARTY_NOTICES.md`. Review those files before redistribution or
commercial use.
