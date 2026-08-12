# @elite-dangerous-almanac/core

Tree-shakeable Elite Dangerous static data and calculations for TypeScript and
JavaScript applications.

## Install

```bash
npm install @elite-dangerous-almanac/core
```

The package is ESM-only, supports Node.js 22+ and targets modern browser bundlers.
It is marked side-effect free.

The package includes game and community data under source-specific terms. Review
[LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) before
redistribution or commercial use.

## Imports

Use a feature barrel when a bundler will tree-shake it:

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro';
```

There is no package-wide root entry; choose one of the four feature areas or a leaf.

Use leaf subpaths to avoid evaluating unrelated data modules in native ESM:

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
```

The heavyweight module registries, planetary/combined nebula catalogues and codex-region
coordinate lookup are only exported from their leaf subpaths, not the feature barrels.

The package has four feature areas:

- `astro`: procedural names, id64 addresses, regions, nebulae and permit locks;
- `ships`: ships, modules, SLEF loadouts, engineering and build metrics;
- `materials`: ship engineering materials and Odyssey micro resources;
- `commodities`: standard and rare market goods.

## Examples

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';

const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // -> 3309179996515n
ProceduralSystem.fromSystemAddress(3309179996515n).name;
// -> "Synuefe EN-H d11-96"
```

Address inputs accept `bigint`, safe integer `number` values and decimal strings.
Addresses are returned as `bigint`.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const slefJsonString: string;

const build = ShipLoadout.fromSlef(slefJsonString);
build.maxJumpRange();
build.powerBudget();
build.shieldMetrics();
build.armourMetrics();
build.weaponMetrics();

build.toSlefString({
    header: { appName: 'MyApp', appVersion: '1.0.0' },
});
```

`ShipLoadout` imports every ship and module catalogue so it can resolve any build.
When only one calculation is required, use the data-free leaf modules under
`ships/jump-range`, `ships/power`, `ships/shields`, `ships/armour`, `ships/weapons`,
`ships/ammunition` or `ships/resistances`.

`build.validation` reports validity and operational completeness. Potentially incomplete
aggregates are nullable and have a diagnostic counterpart (`cargoCapacityResult`,
`fuelCapacityResult`, `unladenMassResult`). `parseSlef` is strict; `inspectSlef` is the
tolerant importer for mixed files and returns indexed diagnostics instead of silently
dropping entries.

```ts
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
import { getMaterialByName } from '@elite-dangerous-almanac/core/materials/materials';
import { getCommodityByName } from '@elite-dangerous-almanac/core/commodities/commodities';

getShipBySymbol('empire_trader')?.name; // -> "Imperial Clipper"
getMaterialByName('iron')?.grade;
getCommodityByName('lavian brandy')?.rare; // -> true
```

Registry lookups ignore case and surrounding whitespace. Material, commodity and
module lookups search their complete registry by default and accept an optional
catalogue to narrow the results. Nebula queries require an explicit catalogue so the
large combined dataset is never an implicit dependency.

`symbol` is Frontier's item id for a hull, module, material, micro-resource or
commodity. Engineering uses a separate identity space: `fdname` identifies a
blueprint recipe, experimental effect or decorative modification. The journal
normally writes that id in its `Engineering` block, but a few blueprint aliases
collide across module families; `resolveBlueprintForModule` resolves those journal
spellings. Functions that ask what engineering a module accepts therefore take the
module's `symbol`; functions that look up a recipe, effect or modification take its
`fdname`.

## Important behavior

- Exported catalogues are deeply frozen.
- Slot keys come from the game and are not reliably derivable from position. Enumerate
  them with `ShipLoadout.slots()` or `enumerateSlots`.
- Resistances are fractions, not percentages.
- Build credits are quoted at catalogue retail. What a capture says it paid is kept
  apart, unedited, as `ShipLoadout.sourcePurchase`, and is exported only when asked for
  by name with `{ credits: 'source' }`.
- Absent catalogue fields are omitted rather than represented by zero. Catalogue
  provenance records unresolved data gaps.
- Lookups return `null`; malformed inputs throw `TypeError`; unsupported ranges throw
  `RangeError`.
- `parseSlef`, `inspectSlef` and `ShipLoadout.fromSlef` throw `SyntaxError` when handed a
  string that is not valid JSON. Past that, a payload number outside its documented
  journal range counts as malformed rather than out of range: `parseSlef` and
  `ShipLoadout.fromSlef` throw `TypeError`, not `RangeError`, and `inspectSlef` reports it
  as a diagnostic.

The [repository README](https://github.com/DarkSession/Elite-Dangerous-Almanac#readme)
contains the project guide. The generated
[GitHub Wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki) contains the
complete API reference.

## Data and credits

The package's [provenance record](./PROVENANCE/SNAPSHOTS.md) includes every domain's
canonical `SOURCES.md` verbatim, recording each catalogue's source, acquisition date,
immutable revision or checksum, derivation and manual corrections. It travels with the
installed version, so its data currency can be checked offline and remains pinned even
after the repository advances. Unknown values are omitted rather than guessed.

Third-party credits and licence terms ship with the package in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

The project's code and documentation are MIT-licensed. Bundled game and third-party
data remains under its source-specific terms and is not relicensed under MIT.
