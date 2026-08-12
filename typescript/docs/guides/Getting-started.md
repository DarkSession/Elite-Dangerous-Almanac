---
title: Getting started
---

# Getting started

```bash
npm install @elite-dangerous-almanac/core
```

The package is ESM-only and supports Node.js 22+ and modern browser bundlers. Every
module is marked side-effect free, so a bundler can drop whatever you do not use.

## Which import should I use?

There are two levels, and the difference is how much data you pull in.

**1. Feature area** — one domain's general API.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships';
```

**2. Leaf module** — exactly one module. Prefer this in native ESM apps.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
```

Both give you the same object. Prefer the leaf import when you know what you want: it is
unambiguous about what gets bundled and never depends on tree-shaking. There is no
package-wide root entry because importing it in native ESM loaded about 1.4 MiB even
after the heaviest optional data was excluded.

**Heavy data-backed modules are reachable only by leaf import.** They were deliberately
taken off the barrels, because a barrel that re-exported them would pull hundreds of
kilobytes into native ESM and namespace consumers. None of the following is on its
feature-area barrel:

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

Sizes below are what a module's import graph weighs once your bundler has minified it,
before any transport compression. The published package strips whitespace but does not
compress syntax or rename identifiers, so its own files on disk are larger. The heaviest
imports are all deliberate:

- `ships/ship-loadout` is about 632 KiB, the batteries-included facade. Resolving
  arbitrary journal module ids and engineering recipes needs the complete ship, module,
  blueprint-mechanics and experimental-effect-mechanics catalogues. Material shopping
  lists stay on the explicit `ships/blueprint-costs` and `ships/experimental-effect-costs`
  subpaths. Import a data-free calculation module instead when you need one answer rather
  than a whole ship.
- `astro/nebulae-all` is 682.3 KiB. That is why the nebula query functions take an
  explicit catalogue argument rather than defaulting to the complete one — importing
  all 5835 records has to be your decision, not a default you did not notice. Almost all
  of that weight is `astro/nebulae-planetary` (645.2 KiB); the sibling catalogues are
  small, `astro/nebulae-real` being 18.5 KiB, so pick the one that answers your question.
- `astro/codex-region-lookup` is about 208 KiB. Its 42-region cell geometry answers
  coordinate and id64 lookups, while the separate `astro/codex-region` metadata module is
  about 9 KiB. The geometry-backed lookup therefore stays off the astro barrel.

`ships/modules` is 311.9 KiB and `ships/modules-all` 310.8 KiB — heavier than the codex
geometry above. It is also the one fallback that costs real weight: of the four
catalogues a lookup searches when you pass no argument, the other three are small —
materials 16.9 KiB, micro resources 14.9 KiB, commodities 29.5 KiB.

## Published source maps

Every JavaScript file in the npm package has an external source map. Node, browser
devtools and downstream bundlers can therefore trace a failure in generated JavaScript
back to the TypeScript module or JSONC catalogue that produced it. The maps are part of
the published package by design; they do not enter an application's import graph.

Whitespace compaction keeps function and variable names, so an unmapped stack trace still
identifies the frame that threw; run Node with `--enable-source-maps` to resolve its original
`src/**/*.ts` line and column. The compactor also preserves the package's
`/* @__PURE__ */` annotations, which let a downstream bundler discard unused catalogue
indexes instead of retaining their data.

The maps cost about 1.6 MiB installed — roughly two fifths of the 4.0 MiB unpacked
package — while the complete compressed npm archive remains about 598 KiB. They contain
mappings and original source paths but omit `sourcesContent`, so the package does not
carry a second copy of its TypeScript and large catalogues. This keeps useful library
stack traces without paying the substantially larger cost of embedding original source
contents in the maps.

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

The one thing to know before your first call: **`null` is an ordinary answer, not an
error.** A lookup that finds nothing returns it, and journals outlive catalogues — a game
update ships modules before this package knows about them — so a consumer that treats
`null` as a crash will break on every game update. Malformed and out-of-range input throw
instead.

[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
sets out all four outcomes, the `try…` variants that convert a throw into a `null`, and
the nullable/diagnostic-result pairs the aggregate figures come in.

## Next

- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
