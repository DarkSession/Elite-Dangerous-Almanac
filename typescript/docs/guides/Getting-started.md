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
package-wide root entry because it would load about 1 MiB in native ESM even without
the heaviest optional data.

**Heavy data-backed modules are reachable only by leaf import.** Exporting them from a
feature barrel would pull hundreds of kilobytes into native ESM and namespace consumers.
None of the following is on its feature-area barrel:

```ts
import { ALL_MODULES } from '@elite-dangerous-almanac/core/ships/modules-all';
import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
// …and INTERNAL_MODULES, HARDPOINT_MODULES, UTILITY_MODULES likewise.

import { ALL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-all';
import { PLANETARY_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-planetary';

import { findCodexRegionAt } from '@elite-dangerous-almanac/core/astro/codex-region-lookup';
```

`REAL_NEBULAE` and `PROCGEN_NEBULAE` are the nebula catalogues exported from the `astro`
barrel.

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
| `BodyScanEvent`, `BodyProperties` | `core/astro` |
| `bulkDensity`, `rocheLimits`, `hillRadius`, `primaryAngularDiameter` | `core/astro/body-physics` |
| `orbitExtents`, `classifyEccentricity`, `spinOrbitResonance`, `equatorialVelocity` | `core/astro/body-orbit` |
| `ringDynamics`, `ringSurfaceDensity`, `isInvisibleRing`, `ringParticleDensity` | `core/astro/body-rings` |
| `mainSequenceLifetime`, `schwarzschildRadius`, `assessMassStability`, `classifyNeutronStar` | `core/astro/star-physics` |
| `ShipLoadout` | `core/ships/ship-loadout` |
| `BuildMetrics` | `core/ships/build-metrics` |
| `parseSlef`, `inspectSlef`, `toSlef`, `LoadoutEvent` | `core/ships/slef` |
| `getShipBySymbol`, `getShipSlots`, `SHIPS` | `core/ships/ships` |
| `getModuleBySymbol`, `OutfittingModule` | `core/ships/modules` |
| `CORE_MODULES` / `INTERNAL_MODULES` / `HARDPOINT_MODULES` / `UTILITY_MODULES` / `ALL_MODULES` | `core/ships/modules-core` / `-internal` / `-hardpoint` / `-utility` / `-all` |
| `frameShiftDriveMassFactor`, `singleJumpRange`, `fuelPerJump`, `totalRange` | `core/ships/jump-range` |
| `powerBudget` / `shieldMetrics` / `shieldCapacitorMetrics` / `armourMetrics` / `weaponMetrics` / `distributorMetrics` / `weaponsCapacitorMetrics` | `core/ships/power` / `shields` / `shield-capacitor` / `armour` / `weapons` / `distributor` / `weapons-capacitor` |
| `mobilityMetrics` / `mobilityCapacitorMetrics` / `shieldRecovery` / `heatMetrics` | `core/ships/mobility` / `mobility-capacitor` / `shield-recovery` / `heat` |
| `computeModifiers`, `BLUEPRINTS`, `EXPERIMENTAL_EFFECTS` | `core/ships/engineering` / `blueprints` / `experimental-effects` |
| `getBlueprintCost`, `getExperimentalEffectCost` | `core/ships/blueprint-costs` / `experimental-effect-costs` |
| `getSuitBySymbol`, `getSuitByFamily`, `SUITS` | `core/equipment/suits` |
| `getPersonalWeaponBySymbol`, `PERSONAL_WEAPONS` | `core/equipment/weapons` |
| `getPersonalToolById`, `PERSONAL_TOOLS` | `core/equipment/tools` |
| `getSuitUpgradeCost`, `getPersonalWeaponUpgradeCost` | `core/equipment/upgrade-costs` |
| `getPersonalModification`, `PERSONAL_MODIFICATIONS` | `core/equipment/modifications` |
| `getPersonalModificationCost` | `core/equipment/modification-costs` |
| `applyPersonalModifiers`, `sumPersonalEngineeringIngredients` | `core/equipment/engineering` |
| `resolvePersonalModificationForWeapon` | `core/equipment/modification-journal` |
| `getModuleName` | `core/i18n/modules` |
| `getBlueprintName` | `core/i18n/blueprints` |
| `getExperimentalEffectName` | `core/i18n/experimental-effects` |
| `getMaterialName` | `core/i18n/materials` |
| `getMicroResourceName` | `core/i18n/micro-resources` |
| `getSuitName`, `getSuitDescription`, `getPersonalMountName` | `core/i18n/suits` |
| `getPersonalWeaponDescription` | `core/i18n/personal-weapons` |
| `getPersonalModificationName`, `getPersonalModificationDescription` | `core/i18n/personal-modifications` |
| `getMaterialByName`, `MaterialGrade` | `core/materials/materials` |
| `getMicroResourceByName` | `core/materials/micro-resources` |
| `getCommodityByName` | `core/commodities/commodities` |

## What it costs to import

Sizes below are what a module's import graph weighs once your bundler has minified it,
before any transport compression. The published package strips whitespace but does not
compress syntax or rename identifiers, so its own files on disk are larger. The heaviest
imports are:

- `ships/ship-loadout` is the complete editing facade, and `ships/build-metrics`
  the calculating half over it — importing one does not pull in the other. Resolving
  arbitrary journal module ids and engineering recipes needs the complete ship, module,
  blueprint-mechanics and experimental-effect-mechanics catalogues, and
  `BuildMetrics.buildCost` prices a build in materials and Merc Coin as well as credits, so
  the two shopping-list catalogues come with the metrics half. Import
  `ships/blueprint-costs` or `ships/experimental-effect-costs` on their own to price one
  recipe, or a data-free calculation module, when you need one answer rather than a whole
  ship.
- `astro/nebulae-all` is ~432 KiB. That is why the nebula query functions take an
  explicit catalogue argument rather than defaulting to the complete one — importing
  every record has to be your decision, not a default you did not notice. Almost all
  of that weight is `astro/nebulae-planetary` (~399 KiB); the sibling catalogues are
  small, `astro/nebulae-real` being ~16 KiB, so pick the one that answers your question.
- `astro/codex-region-lookup` is about 208 KiB. Its 42-region cell geometry answers
  coordinate and id64 lookups, while the separate `astro/codex-region` metadata module is
  about 9 KiB. The geometry-backed lookup therefore stays off the astro barrel.

`ships/modules` is ~337 KiB and `ships/modules-all` ~335 KiB — heavier than the codex
geometry above. It is also the one fallback that costs real weight: of the four
catalogues a lookup searches when you pass no argument, the other three are small —
materials ~17 KiB, micro resources ~13 KiB, commodities ~30 KiB.

## Published source maps

Every JavaScript file in the npm package has an external source map. Node, browser
devtools and downstream bundlers can therefore trace a failure in generated JavaScript
back to the TypeScript module that produced it. The maps are part of the published
package by design; they do not enter an application's import graph.

Whitespace compaction keeps function and variable names, so an unmapped stack trace still
identifies the frame that threw; run Node with `--enable-source-maps` to resolve its original
`src/**/*.ts` line and column. The compactor also preserves the package's
`/* @__PURE__ */` annotations, which let a downstream bundler discard unused catalogue
indexes instead of retaining their data.

Mappings into inlined JSONC data literals are omitted because a literal cannot produce a
consumer stack frame. The remaining TypeScript mappings cost about 234 KiB installed;
they contain original source paths but omit `sourcesContent`, so the package does not
carry a second copy of its source.

## What the package weighs on disk

`npm pack --dry-run` reports about 70 MB unpacked and about 18 MB as a compressed
npm archive. The ship art in `assets/` is about 67 MB of it: four SVG files per hull,
shipped as static package files rather than as subpath exports. Everything a bundler can
reach is the roughly 3 MB of
`dist/`, which is the JavaScript, the type declarations and the source maps above,
and no import of this package pulls an SVG into an application bundle.

So the install is large and the import graph is not, which is a poor trade for
applications that never render a hull. Moving the art into a package of its own is
tracked as
[issue #354](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/354).

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

```ts
import { getSuitBySymbol } from '@elite-dangerous-almanac/core/equipment/suits';
import { getPersonalModificationCost } from '@elite-dangerous-almanac/core/equipment/modification-costs';

getSuitBySymbol('utilitysuit_class3')?.grade; // -> 3
getPersonalModificationCost('suit_nightvision')?.[0]?.symbol; // -> 'surveillanceequipment'
```

Lookups ignore case and surrounding whitespace, so a symbol straight out of a journal
line works without normalizing it first.

## What happens when something is wrong

The one thing to know before your first call: **`null` is an ordinary answer, not an
error.** A lookup returns it when nothing matches, including a journal symbol absent from
the catalogues. Malformed and out-of-range input throw instead.

[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
sets out all four outcomes, the `try…` variants that convert a throw into a `null`, and
the diagnostic results returned by aggregate figures that may be unavailable.

## Next

- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
