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
  **and export**, loadout editing (including the mounts that only take one family of
  modules — see below), engineering, and the build metrics an outfitting
  screen shows — jump range, power budget, shield and armour strength with
  resistances, and weapon DPS.
- `materials` supplies ship engineering materials and Odyssey micro resources.
- `commodities` supplies standard and rare market-goods catalogues.

Each area has a barrel plus leaf subpaths for its data-heavy catalogues:

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
import {
    getMaterialByName,
    MaterialGrade,
} from '@elite-dangerous-almanac/core/materials/materials';
import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';

const system = StarSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // 3309179996515n

getShipBySymbol('empire_trader')?.name; // 'Imperial Clipper'
getMaterialByName('iron', RAW_MATERIALS)?.grade; // MaterialGrade.VeryCommon (1)
```

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
- **Failure is split by cause.** Lookups return `null`; malformed input throws
  `TypeError`; out-of-range input throws `RangeError`. `StarSystem.fromName` returns
  `null` for any non-procedural name, including real hand-named systems like `Sol`.

Case and surrounding whitespace are ignored by every lookup — by symbol, name, category
or line — so journal values resolve as they arrive.

## Mounts that only take one family of modules

Some mounts are restricted, and the journal gives each one a **name of its own** — so
`slot.restriction` tells you what it takes, `modulesForSlot` lists exactly that, and
`setModule` throws rather than accept anything else. `PlanetaryApproachSuite` is on all
but one hull (the Lynx Highliner) and `Military01…` on 16 of the 48; two hulls add more.
The Type-11 Prospector's `LargeMiningHardpoint1`, `MediumMiningHardpoint1`,
`MediumMiningHardpoint2` and `SmallMiningHardpoint1` take **mining tools only** — its
other four mounts (`MediumHardpoint3`, `SmallHardpoint2…4`) take any weapon — while its
`LimpetController01` and `FighterBay01` take limpet controllers and vessel hangars. The
Panther Clipper Mk II's `Cargo01` and `Cargo02` take cargo racks and fuel tanks.

```ts
import {
    ShipLoadout,
    HARDPOINT_MODULES,
    SLOT_RESTRICTION_LABELS,
    getModuleBySymbol,
} from '@elite-dangerous-almanac/core/ships';

const miner = ShipLoadout.empty('LakonMiner');

const mount = miner.hardpoints()[0]!; // -> key 'LargeMiningHardpoint1'
mount.restriction; // -> 'mining'
SLOT_RESTRICTION_LABELS[mount.restriction!]; // -> 'mining tools' (what to show a user)
mount.modulesForSlot(HARDPOINT_MODULES); // -> the mining tools that fit, and only those

mount.fit(getModuleBySymbol('Hpt_PlasmaAccelerator_Fixed_Large', HARDPOINT_MODULES)!);
// throws TypeError: ShipLoadout.setModule: Hpt_PlasmaAccelerator_Fixed_Large
//   → LargeMiningHardpoint1: slot only takes mining tools
```

> **Upgrading from 0.0.1 to 0.1.0:** `ShipSlots.hardpoints` (and `Ship.hardpoints`) changed from
> `readonly number[]` to `readonly HardpointSlotSpec[]` — `{ size, restriction? }`
> entries, matching `optional`. Read `hardpoints[i].size` where you read
> `hardpoints[i]` before. TypeScript flags every site; **plain JavaScript will not**.

See the [repository README](https://github.com/DarkSession/Elite-Dangerous-Almanac#readme)
and [generated GitHub Wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki)
for the complete API guide. Report problems in the
[issue tracker](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues).

## Data freshness and credits

The bundled catalogues are a snapshot dated **2026-07-24**, with two updates made on
2026-08-02: one market commodity added (`curatedcommodity`, from a player-journal
observation rather than an upstream registry, so its market category is a maintainer
assignment), and a module-stat reconciliation that left every outfitting module
carrying at least one stat and corrected 40 records. A third followed on **2026-08-04**:
every hull's mounts now record any restriction they carry (see above), and the modules
limited to particular hulls gained the `restrictedToShips` values that were previously
only documented.

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
