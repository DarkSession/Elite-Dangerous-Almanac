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
import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';

ProceduralSystem.fromName('Synuefe EN-H d11-96')?.systemAddress; // -> 3309179996515n

// One `Loadout` line from a player journal.
function jumpRangeOf(journalLine: string) {
    const event = JSON.parse(journalLine) as LoadoutEvent;
    return ShipLoadout.fromLoadout(event).maxJumpRange(); // -> 60.5478
}
```

## Start here

- **[Getting started](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Getting-started)**
  — install, which import to use, and the symbol-to-subpath map.
- **[Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)**
  — turning `Loadout` and `FSDJump` events into library objects.

## The four feature areas

| Area | Import | Provides |
| --- | --- | --- |
| [astro](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/astro) | `@elite-dangerous-almanac/core/astro` | Procedural system names, `id64` addresses, sectors, galactic regions, nebulae, permit locks |
| [ships](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/ships) | `@elite-dangerous-almanac/core/ships` | Hulls, modules, loadouts, SLEF, engineering, jump range, power, shields, armour, weapons |
| [materials](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/materials) | `@elite-dangerous-almanac/core/materials` | Ship engineering materials and Odyssey micro resources |
| [commodities](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/commodities) | `@elite-dangerous-almanac/core/commodities` | Standard and rare market commodities |

The bulk data catalogues live on their own subpaths and are listed in full on the
[API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules).

**[Browse the complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)**
— every module, class, function and type, generated from the source documentation.

## Licensing

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review
[LICENSE](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/LICENSE) and
[ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md)
before redistribution or commercial use.
