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
- `ships` supplies ship/module registries, stats, SLEF parsing, loadout editing,
  engineering, and jump-range calculations.
- `materials` supplies ship engineering materials and Odyssey micro resources.
- `commodities` supplies standard and rare market-goods catalogues.

Each area has a barrel plus leaf subpaths for its data-heavy catalogues:

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
import { getMaterialByName } from '@elite-dangerous-almanac/core/materials/materials';
import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';

const system = StarSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // 3309179996515n

getShipBySymbol('empire_trader')?.name; // 'Imperial Clipper'
getMaterialByName('iron', RAW_MATERIALS)?.grade; // 1
```

`ShipLoadout` validates module fits and engineering compatibility. When an imported
SLEF build is edited, its supplied mass/capacity figures are adjusted when possible;
an aggregate that cannot be updated safely is discarded and recomputed.

## Three things worth knowing before you start

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

The checked-in catalogues are snapshot **2026-07-24**. Provenance and the metadata
required for future updates are documented in
[data/SNAPSHOTS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/SNAPSHOTS.md).

Third-party data and algorithm credits are included in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

The project's own code and documentation are MIT-licensed. Bundled Elite
Dangerous and third-party data is not relicensed under MIT and includes
non-commercial or otherwise source-specific terms. Review
[LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
before redistribution or commercial use.
