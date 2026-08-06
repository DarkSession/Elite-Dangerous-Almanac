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

Each area has a barrel plus leaf subpaths for its data-heavy catalogues. The ship,
material, micro-resource, commodity and module lookups search their whole registry,
so finding something takes one import and one argument (nebulae are the exception —
see below):

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
import {
    getMaterialByName,
    MaterialGrade,
} from '@elite-dangerous-almanac/core/materials/materials';
import { getCommodityByName } from '@elite-dangerous-almanac/core/commodities/commodities';

const system = StarSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // 3309179996515n

getShipBySymbol('empire_trader')?.name; // 'Imperial Clipper'
getMaterialByName('iron')?.grade; // MaterialGrade.VeryCommon (1)
getCommodityByName('lavian brandy')?.rare; // true
```

Every lookup also takes an optional trailing argument that narrows the search to a
subset — one category's catalogue, or an array you have filtered yourself:

```ts
import { materialsByGrade, MaterialGrade } from '@elite-dangerous-almanac/core/materials';
import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';

materialsByGrade(MaterialGrade.Rare, RAW_MATERIALS).length; // 7, one per raw line
```

That argument narrows results, not bundle size: a lookup imports the full registry it
falls back to. The registries are small (~16 KB minified for all 146 materials, ~28 KB
for all 399 commodities) — with two exceptions. `ships/modules` pulls all four module
catalogues, about 288 KB minified (~31 KB gzipped); a build that must carry only one
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
- **Failure is split by cause.** Lookups return `null`; malformed input throws
  `TypeError`; out-of-range input throws `RangeError`. `StarSystem.fromName` returns
  `null` for any non-procedural name, including real hand-named systems like `Sol`.

Case and surrounding whitespace are ignored by every lookup — by symbol, name, category
or line — so journal values resolve as they arrive.

## Mounts that only take one family of modules

Some mounts are restricted, and the journal gives each one a **name of its own** — so
`slot.restriction` tells you what it takes, `modulesForSlot` lists exactly that, and
`setModule` throws rather than accept anything else. `PlanetaryApproachSuite` is on all
but one hull (the Lynx Highliner) and `Military01…` on 16 of the 48; three hulls add
more. The Type-11 Prospector's `LargeMiningHardpoint1`, `MediumMiningHardpoint1`,
`MediumMiningHardpoint2` and `SmallMiningHardpoint1` take **mining tools only** — its
other four mounts (`MediumHardpoint3`, `SmallHardpoint2…4`) take any weapon — while its
`LimpetController01` and `FighterBay01` take limpet controllers and vessel hangars. The
Panther Clipper Mk II's `Cargo01` and `Cargo02` take cargo racks and fuel tanks, and the
Lynx Highliner's `Passenger01`–`Passenger03` take passenger cabins alone.

A few modules are restricted the other way round — they fit one kind of mount and
nothing else, not even an unrestricted slot of the right size — and carry
`restrictedToSlot`, the mirror of `slot.restriction`: the two Mk II Cargo Racks and the
Mk II Mining Multi-Limpet Controller (which also name their hull in `restrictedToShips`;
a build must satisfy both), and the planetary approach suites. A plain cargo rack has no
such field: it fits a `cargo` mount **and** every unrestricted one.

## Enumerate slot keys — never compute them

The numbering looks regular and on 10 of the 48 hulls is not, so a key you build by
counting will name a mount the game does not have. The Anaconda's smallest optionals are
`Slot13_Size2` and `Slot14_Size1` — there is no 11 or 12; the Type-9 Heavy starts at
`Slot00_Size8`; the Type-7 Transporter uses the number `09` twice; the Type-8 Transporter
has no `SmallHardpoint3`; and the Caspian Explorer's medium hardpoints run 6, 5, 1, 2, 3,
4 in layout order, so the same key means a **different physical mount** than position
would suggest. Those names are the game's, carried on the mount itself —
`getShipSlots(symbol)?.optional[i].name` — and applied by `enumerateSlots`, so `slots()`
is the list to read. A mount without a `name` is one the rules get right.

A `_SizeN` suffix is part of the name, not a measurement: on the Keelback, Asp Scout and
Type-7 Transporter, Frontier's own key disagrees with the mount it names (the Keelback's
`Slot03_Size3` is a **size-4** mount). `slot.size` is always the mount's real size.

This matters for SLEF, not just for journals: **SLEF is the journal's `Loadout` event in
an envelope**, so `data.Modules[].Slot` carries these exact strings and an export under a
computed key names a mount the receiving app cannot match.

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

The bundled catalogues are a snapshot dated **2026-07-24**, revised since. The larger
passes: two on 2026-08-01, a completeness pass over the outfitting and engineering
catalogues against EDSY, and the defence, power and weapon stats the build calculations
need, from coriolis-data; two on 2026-08-02, one market commodity added
(`curatedcommodity`, from a player-journal observation rather than an upstream registry,
so its market category is a maintainer assignment) and a module-stat reconciliation that
left every outfitting module carrying at least one stat and corrected 40 records; one on
**2026-08-04**, every hull's mounts now recording any restriction they carry (see above),
with the modules limited to particular hulls gaining the `restrictedToShips` values that
were previously only documented; and five on **2026-08-05**, one changing no value — a
module whose missing stat is unknown rather than absent because it has none now says so
in its own `unknownStats` field — one pricing the 1F Corrosion Resistant Cargo Rack
from EDSY at 12 560, which coriolis-data carries as `0`, one giving 13 hulls the
journal's own slot keys, from EDSY, on 11 of which the numbering rules were wrong, one
taking the engineering-options catalogue from 428 modules in 22 groups to 1029 in 53,
and one storing two restricted-mount rules the catalogue could not express — the Lynx
Highliner's three passenger-cabin-only mounts, and the five module records that name
the mount they fit and no other (the Mk II Cargo Racks, the Mk II Mining Multi-Limpet
Controller and the planetary approach suites), both sourced from real Inara captures.
The last three are **behaviour-visible**: the keys `enumerateSlots` and
`ShipLoadout.slots()` return changed on those 11 hulls (see above), while no hull's
layout, mount count or size did; 601 more modules now answer an engineering group,
14 stop answering one because upstream denies them every blueprint, and the Guardian
power plants, distributors and hull reinforcement packages moved to groups of their own;
and `setModule`/`modulesForSlot` now refuse a reserved module on an unrestricted mount,
`OptionalRestriction` gained a member, and the Lynx's cabin mounts dropped the size
suffix from their label. One more on **2026-08-06**, also behaviour-visible: the game
writes `Sensor_LongRange` and `Sensor_WideAngle` for two different recipes — a sensor
suite's and a utility scanner's, which roll different stats in opposite directions — so
`Scanner_LongRange` and `Scanner_WideAngle` gained a `journalName` recording that. Those
two ids are now accepted on the 15 KWS, manifest and wake scanners where they were
refused, and on those modules they fold the scanner's recipe, so a wake scanner's Long
Range costs power draw rather than mass; `resolveBlueprintForModule`, in a new `ships/blueprint-journal`
module, is the lookup, and blueprint costs are unchanged. Smaller
corrections are not
listed here — each domain's `SOURCES.md` is the authoritative record
([ships](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md),
[commodities](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/commodities/SOURCES.md),
[materials](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md),
[astro](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md)).

A value no source publishes is left **absent rather than guessed** — a handful of
`integrity`, `powerDraw` and `mass` fields are `undefined` for that reason. The
[repository README](https://github.com/DarkSession/Elite-Dangerous-Almanac#data-freshness)
covers freshness in full,
the [issue tracker](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues)
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
