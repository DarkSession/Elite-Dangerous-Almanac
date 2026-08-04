# @elite-dangerous-almanac/core

Tree-shakeable Elite Dangerous static data and calculations for TypeScript and
JavaScript applications.

## Install

```bash
npm install @elite-dangerous-almanac/core
```

Licensing note: the package bundles game and community data under
source-specific terms, including non-commercial terms. See [License](#license)
before redistribution or commercial use.

The package is ESM-only. Browser bundlers may import a feature barrel:

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro';
```

Native ESM applications should use leaf entries to avoid evaluating unrelated
data modules:

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
```

## Feature areas

- `astro` supplies procedural naming, system-address conversion, regions,
  nebulae and permit locks.
- `ships` supplies ship/module registries, stats, journal `Loadout` and SLEF import
  **and export**, loadout editing, engineering, and the build metrics an outfitting
  screen shows — jump range, power budget, shield and armour strength with
  resistances, and weapon DPS.
- `materials` supplies ship engineering materials and Odyssey micro resources.
- `commodities` supplies standard and rare market-goods catalogues.

Each area has a barrel plus leaf subpaths for its data-heavy catalogues. The ship,
material, micro-resource, commodity and module lookups search their whole registry,
so finding something takes one import and one argument (nebulae are the exception —
see below):

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { getShip } from '@elite-dangerous-almanac/core/ships/ships';
import { getMaterial, MaterialGrade } from '@elite-dangerous-almanac/core/materials/materials';
import { getCommodity } from '@elite-dangerous-almanac/core/commodities/commodities';

const system = StarSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // 3309179996515n

getShip('empire_trader')?.name; // 'Imperial Clipper'
getMaterial('iron')?.grade; // MaterialGrade.VeryCommon (1)
getCommodity('lavian brandy')?.rare; // true
```

Every lookup also takes an optional trailing argument that narrows the search to a
subset — one category's catalogue, or an array you have filtered yourself:

```ts
import { materialsByGrade, MaterialGrade } from '@elite-dangerous-almanac/core/materials';
import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';

materialsByGrade(MaterialGrade.Rare, RAW_MATERIALS).length; // 7, one per raw line
```

That argument narrows results, not bundle size: a lookup imports the full registry it
falls back to. The registries are small (~15 KB minified for all 146 materials, ~28 KB
for all 399 commodities) — with two exceptions. `ships/modules` pulls all four module
catalogues, about 290 KB minified (~30 KB gzipped); a build that must carry only one
outfitting category should import that catalogue and search it with plain `Array`
methods instead. And `astro/nebulae` keeps its catalogue argument **required**:
`ALL_NEBULAE` is 682 KB, so there is no defensible default to fall back to.

## Working with a whole build

`ShipLoadout` is the batteries-included facade: give it a SLEF export or a journal
`Loadout` event and it answers what an outfitting screen shows. Every figure is
post-engineering — the build's own modifiers are applied first — and modules switched
off are left out.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const build = ShipLoadout.fromSlef(slefJsonString); // or .fromLoadout(journalEvent)

build.maxJumpRange(); // -> 89.41  best single jump (one jump's fuel, no cargo)

// …and back out to anything that reads SLEF, with every figure recomputed:
build.toSlefString({ header: { appName: 'MyApp', appVersion: '1.0.0' } });

const power = build.powerBudget();
power.available; // -> 22.85 MW generated
power.headroom; // -> available - deployed; negative means over budget
power.withinBudget; // -> true

build.shieldMetrics()?.strength; // -> 230.65 MJ (shieldMetrics() is null with no generator)
build.armourMetrics().hitPoints; // -> 819.72

// Weapons are totalled the same way. The figures above are a real exploration build,
// which carries no hardpoints, so its own weapon totals are 0 — an armed build reports:
build.weaponMetrics().total.damagePerSecond; // -> DPS, engineering applied
build.weaponMetrics().weapons; // -> the same figures per hardpoint
```

Resistances come back as **fractions**, not percentages: `-0.2` is a 20% weakness, and
they do not simply add — see `ships/resistances` for the stacking rules.

It also validates module fits and engineering compatibility. When an imported SLEF
build is edited, its supplied mass/capacity figures are adjusted when possible; an
aggregate that cannot be updated safely is discarded and recomputed.

`ShipLoadout` pulls in every catalogue (~606 KB minified, ~69 KB gzipped) because it
must resolve any module id. When you only need one answer, the calculations are also
data-free leaf modules of roughly 0.5–3 KB each: `ships/jump-range`, `ships/power`,
`ships/shields`, `ships/armour`, `ships/weapons`, `ships/resistances`, and
`ships/slef` for parsing alone.

## Four things worth knowing before you start

- **System addresses.** Anything taking an `id64` accepts a `bigint`, a `number` (a
  normally parsed journal `SystemAddress`), or a decimal string; addresses come back as
  `bigint`, since the fields reach bit 55. A `number` past `2^53 - 1` has already been
  rounded, so it is refused with a `TypeError` instead of resolving the wrong system.
- **Two `{ x, y, z }` conventions.** `GalacticCoords` is light-years with Sol at the
  origin (the journal/EDSM/Spansh frame) and is what nearly everything takes.
  `SectorCoords` is an integer sector index (0–127) on the 1280 ly naming grid, which is
  what `sectorNameFromCoords` takes. They are structurally identical, so TypeScript will
  not catch a mix-up — convert with `sectorCoordsFromGalacticCoords`, or call
  `sectorNameFromGalacticCoords` directly.
- **`symbol` vs. `fdname`.** Both are Frontier's own internal ids, and a journal carries
  both, but they key different catalogues. Ships and modules are looked up by **`symbol`**
  — the `Ship` / `Item` string, e.g. `'empire_trader'`, `'Int_Hyperdrive_Size6_Class5'`
  (`getShipBySymbol`, `getModuleBySymbol`). Blueprints and experimental effects are looked
  up by **`fdname`** — the `Engineering.BlueprintName` / `ExperimentalEffect` string, e.g.
  `'FSD_LongRange'`, `'special_fsd_heavy'` (`getBlueprint`, `getExperimentalEffect`).
  When you are not sure whether a string is a symbol or a display name, `getShip`,
  `getMaterial`, `getMicroResource` and `getCommodity` accept either.
- **Failure is split by cause.** Lookups return `null`; malformed input throws
  `TypeError`; out-of-range input throws `RangeError`. `StarSystem.fromName` returns
  `null` for any non-procedural name, including real hand-named systems like `Sol`.

Case and surrounding whitespace are ignored by every lookup — by symbol, name, category
or line — so journal values resolve as they arrive.

See the [repository README](https://github.com/DarkSession/Elite-Dangerous-Almanac#readme)
and [generated GitHub Wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki)
for the complete API guide. Report problems in the
[issue tracker](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues).

## Data freshness and credits

The bundled catalogues are a snapshot dated **2026-07-24**, with two updates made on
2026-08-02: one market commodity added (`curatedcommodity`, from a player-journal
observation rather than an upstream registry, so its market category is a maintainer
assignment), and a module-stat reconciliation that left every outfitting module
carrying at least one stat and corrected 40 records.

A value no source publishes is left **absent rather than guessed** — a handful of
`integrity`, `powerDraw` and `mass` fields are `undefined` for that reason. The
[repository README](https://github.com/DarkSession/Elite-Dangerous-Almanac#data-freshness)
covers freshness in full,
[TODO.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/TODO.md)
lists the open gaps, and
[data/SNAPSHOTS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/SNAPSHOTS.md)
records the provenance metadata every update must carry.

Third-party data and algorithm credits are included in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

The project's own code and documentation are MIT-licensed. Bundled Elite
Dangerous and third-party data is not relicensed under MIT and includes
non-commercial or otherwise source-specific terms. Review
[LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
before redistribution or commercial use.
