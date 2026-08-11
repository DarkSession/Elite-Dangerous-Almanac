---
title: Getting started
---

# Getting started

```bash
npm install @elite-dangerous-almanac/core
```

The package is ESM-only and supports Node.js 18+ and modern browser bundlers. Every
module is marked side-effect free, so a bundler can drop whatever you do not use.

## Which import should I use?

There are three levels, and the difference is how much data you pull in.

**1. Root** — every feature area's general API, but not the bulk catalogues.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core';
```

**2. Feature area** — one domain's general API.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships';
```

**3. Leaf module** — exactly one module. Prefer this in native ESM apps.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
```

All three give you the same object. Prefer the leaf import when you know what you want:
it is the only form that is unambiguous about what gets bundled, and it never depends on
tree-shaking working. The root barrel is the largest — about a 1.4 MiB native ESM import
graph even after its heaviest optional data is excluded.

**Heavy data-backed modules are reachable only by leaf import.** They were deliberately
taken off the barrels, because a barrel that re-exported them would pull hundreds of
kilobytes into native ESM and namespace consumers. None of the following is on the root
or feature-area barrel:

```ts
import { ALL_MODULES } from '@elite-dangerous-almanac/core/ships/modules-all';
import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
// …and INTERNAL_MODULES, HARDPOINT_MODULES, UTILITY_MODULES likewise.

import { ALL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-all';
import { PLANETARY_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-planetary';

import { findCodexRegionAt } from '@elite-dangerous-almanac/core/astro/codex-region-lookup';
```

`REAL_NEBULAE` and `PROCGEN_NEBULAE` are the exception among the nebula catalogues — both
are still on the `astro` barrel.

## Where does a symbol live?

The leaf module name is the second segment of the subpath. This is the map for the
symbols you are most likely to reach for first:

| You want | Import from |
| --- | --- |
| `ProceduralSystem` | `core/astro/procedural-system` |
| `decodeSystemAddress`, `encodeSystemAddress` | `core/astro/system-address` |
| `parseSystemName`, `isProceduralSystemName` | `core/astro/system-name` |
| `sectorGridPositionFromGalacticPosition` | `core/astro/galaxy-grid` |
| `sectorNameFromGridPosition` | `core/astro/sector-name` |
| `findHandAuthoredRegionAt` | `core/astro/hand-authored-regions` |
| `findCodexRegionAt` | `core/astro/codex-region-lookup` |
| `nearestNebulae`, `nebulaeWithin`, `getNebulaByName` | `core/astro/nebulae` |
| `REAL_NEBULAE` / `PLANETARY_NEBULAE` / `PROCGEN_NEBULAE` / `ALL_NEBULAE` | `core/astro/nebulae-real` / `-planetary` / `-procgen` / `-all` |
| `permitLockForSystemName` | `core/astro/permit-locks` |
| `ShipLoadout` | `core/ships/ship-loadout` |
| `parseSlef`, `inspectSlef`, `toSlef`, `LoadoutEvent` | `core/ships/slef` |
| `getShipBySymbol`, `getShipSlots`, `SHIPS` | `core/ships/ships` |
| `getModuleBySymbol`, `OutfittingModule` | `core/ships/modules` |
| `CORE_MODULES` / `INTERNAL_MODULES` / `HARDPOINT_MODULES` / `UTILITY_MODULES` / `ALL_MODULES` | `core/ships/modules-core` / `-internal` / `-hardpoint` / `-utility` / `-all` |
| `singleJumpRange`, `fuelPerJump`, `totalRange` | `core/ships/jump-range` |
| `powerBudget` / `shieldMetrics` / `armourMetrics` / `weaponMetrics` | `core/ships/power` / `shields` / `armour` / `weapons` |
| `computeModifiers`, `BLUEPRINTS`, `EXPERIMENTAL_EFFECTS` | `core/ships/engineering` / `blueprints` / `experimental-effects` |
| `getBlueprintCost`, `getExperimentalEffectCost` | `core/ships/blueprint-costs` / `experimental-effect-costs` |
| `getMaterialByName`, `MaterialGrade` | `core/materials/materials` |
| `getMicroResourceByName` | `core/materials/micro-resources` |
| `getCommodityByName` | `core/commodities/commodities` |

## What it costs to import

Three imports dominate everything else, and all are deliberate:

- `ships/ship-loadout` is the batteries-included facade. Resolving arbitrary journal
  module ids and engineering recipes needs the complete ship, module, blueprint-mechanics
  and experimental-effect-mechanics catalogues. Material shopping lists stay on the
  explicit `ships/blueprint-costs` and `ships/experimental-effect-costs` subpaths. Import a
  data-free calculation module instead when you need one answer rather than a whole ship.
- `astro/nebulae-all` is 682.3 KiB. That is why the nebula query functions take an
  explicit catalogue argument rather than defaulting to the complete one — importing
  all 5835 records has to be your decision, not a default you did not notice.
- `astro/codex-region-lookup` is about 473 KiB raw. Its 42-region cell geometry answers
  coordinate and id64 lookups, while the separate `astro/codex-region` metadata module is
  about 14 KiB. The geometry-backed lookup therefore stays off the root and astro barrels.

Everything else is small: materials 16.9 KiB, micro resources 14.9 KiB, commodities
29.5 KiB. `ships/modules` is 311.9 KiB raw, and `ships/modules-all` 310.8 KiB.

## First calls

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';

const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // -> 3309179996515n
system?.namingRegionName; // -> 'Synuefe'

ProceduralSystem.fromSystemAddress(3309179996515n).name; // -> 'Synuefe EN-H d11-96'
```

```ts
import { getMaterialByName } from '@elite-dangerous-almanac/core/materials/materials';
import { getCommodityByName } from '@elite-dangerous-almanac/core/commodities/commodities';

getMaterialByName('iron')?.grade;
getCommodityByName('lavian brandy')?.rare; // -> true
```

Lookups ignore case and surrounding whitespace, so a symbol straight out of a journal
line works without normalising it first.

## What happens when something is wrong

The library distinguishes four outcomes, and the distinction is deliberate:

- **`null`** — a lookup found no match, or a parse did not recognise the input. This is
  an ordinary answer, not an error.
- **`TypeError`** — the input was malformed.
- **`RangeError`** — the input was well-formed but outside a supported range.
- **`SyntaxError`** — the text was not JSON. `parseSlef` and `inspectSlef` call
  `JSON.parse` on the string you hand them, so this is what a bad file yields first.

Aggregate figures that may depend on missing catalogue data come in pairs: a nullable
convenience property, and a result object that names what was missing.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.cargoCapacity; // number | null
build.cargoCapacityResult; // names every rack it could not classify
```

## Next

- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
