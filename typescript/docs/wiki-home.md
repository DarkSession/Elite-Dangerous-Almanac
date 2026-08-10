---
title: Home
---

# Elite Dangerous Almanac

Static Elite Dangerous data and calculations for community applications and research —
procedural system names and `id64` addresses, galactic regions and nebulae, ships and
outfitting with build metrics, engineering materials, and market commodities.

```bash
npm install @elite-dangerous-almanac/core
```

ESM-only, Node.js 18+ and modern browser bundlers, every module side-effect free.

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

ProceduralSystem.fromName('Synuefe EN-H d11-96')?.systemAddress; // -> 3309179996515n

const build = ShipLoadout.fromLoadout(journalLoadoutEvent);
build.maxJumpRange(); // -> 60.5478
```

## Start here

- **[Getting started](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Getting-started)**
  — install, which import to use, and the symbol-to-subpath map.
- **[Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)**
  — turning `Loadout` and `FSDJump` events into library objects.

## The four feature areas

| Import | Provides |
| --- | --- |
| `@elite-dangerous-almanac/core/astro` | Procedural system names, `id64` addresses, sectors, galactic regions, nebulae, permit locks |
| `@elite-dangerous-almanac/core/ships` | Hulls, modules, loadouts, SLEF, engineering, jump range, power, shields, armour, weapons |
| `@elite-dangerous-almanac/core/materials` | Ship engineering materials and Odyssey micro resources |
| `@elite-dangerous-almanac/core/commodities` | Standard and rare market commodities |

**[Browse the complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)**
— every module, class, function and type, generated from the source documentation.

## Licensing

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review
[LICENSE](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/LICENSE) and
[ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md)
before redistribution or commercial use.
