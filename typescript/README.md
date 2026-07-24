# @elite-dangerous-almanac/core

Tree-shakeable Elite Dangerous static data and calculations for TypeScript and
JavaScript applications.

## Install

```bash
npm install @elite-dangerous-almanac/core
```

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
- `ships` supplies the shipyard and outfitting registries.
- `materials` supplies raw, manufactured and encoded engineering materials.

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

MIT. See [LICENSE](./LICENSE).
