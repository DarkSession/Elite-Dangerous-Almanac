---
title: Home
---

# Elite Dangerous Almanac

Static Elite Dangerous data and calculations for community applications and research —
procedural system names and `id64` addresses, galactic regions and nebulae, ships and
outfitting with build metrics, personal equipment and engineering materials, localized
display text, and market commodities.

```bash
npm install @elite-dangerous-almanac/core
```

ESM-only, Node.js 22+ and modern browser bundlers, every module side-effect free.

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';

ProceduralSystem.fromName('Synuefe EN-H d11-96')?.systemAddress; // -> 3309179996515n

// One `Loadout` line from a player journal.
function jumpRangeOf(journalLine: string) {
    const event = JSON.parse(journalLine) as LoadoutEvent;
    return BuildMetrics.of(ShipLoadout.fromLoadout(event)).maxJumpRange(); // -> 60.5478
}
```

## Guides

- **[Getting started](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Getting-started)**
  — install, which import to use, and the symbol-to-subpath map.
- **[Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)**
  — turning `Loadout` and `FSDJump` events into library objects.
- **[Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Building-an-outfitting-screen)**
  — mounts, what fits, fitting it, and every metric a shipyard shows.
- **[Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Build-metrics)**
  — how power, shields, armour, weapons, ammunition and range are computed.
- **[Engineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Engineering)**
  — what a recipe may go on, what it rolls, and what a roll costs.
- **[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Working-with-SLEF)**
  — reading and writing loadout exports, and retail against captured credits.
- **[Systems and regions](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Systems-and-regions)**
  — the `id64` round trip, both coordinate spaces, and the four meanings of "region".
- **[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)**
  — `null` against the three errors, and diagnostic results for unavailable metrics.

## The six feature areas

| Area | Import | Provides |
| --- | --- | --- |
| [astro](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/astro) | `@elite-dangerous-almanac/core/astro` | Procedural system names, `id64` addresses, sectors, galactic regions, nebulae, permit locks |
| [ships](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/ships) | `@elite-dangerous-almanac/core/ships` | Hulls, modules, loadouts, SLEF, engineering, jump range, power, shields, armour, weapons |
| [equipment](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/equipment) | `@elite-dangerous-almanac/core/equipment` | Odyssey suits, handheld weapons, grade upgrades and engineer modifications |
| [i18n](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/i18n) | `@elite-dangerous-almanac/core/i18n` | Sparse localized module, blueprint, effect, material and micro-resource names |
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
