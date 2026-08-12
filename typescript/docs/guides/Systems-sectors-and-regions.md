---
title: Systems and regions
---

# Systems and regions

Elite Dangerous uses the word "region" for four different things, and uses two
three-number coordinate shapes that are easy to confuse. This guide separates them, and
covers the `id64` round trip that most tools need first.

## Names and addresses

{@link astro!ProceduralSystem | ProceduralSystem} is the handle that ties a procedural name to its `id64`
and back.

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';

const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // -> 3309179996515n
system?.namingRegionName; // -> 'Synuefe'
system?.massCode; // -> 'd'

ProceduralSystem.fromSystemAddress(3309179996515n).name; // -> 'Synuefe EN-H d11-96'
```

**`fromName` returns `null` for a name that is not procedural.** Sol, Shinrarta Dezhra
and every other hand-named system fall outside this type by design, so `null` means "this
is hand-named", not "something went wrong". The two factories differ deliberately: a name
that does not parse is an ordinary answer, while an `id64` outside the unsigned 64-bit
range, or one whose grid slot has no procedural name, throws `RangeError`.

Addresses accept a `bigint`, a safe-integer `number`, or a decimal string, and always
come back as `bigint`. A journal parsed with `JSON.parse` yields a `number`, exact for
every real address; anything above `2^53 - 1` is rejected rather than silently rounded.

```ts
import { toSystemAddress, tryToSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address-input';

toSystemAddress('3309179996515'); // -> 3309179996515n
tryToSystemAddress('not an address'); // -> null, for input you do not control
```

To take an address apart without building a whole system:

```ts
import { decodeSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';

const decoded = decodeSystemAddress(3309179996515n);
decoded.sizeClass; // -> 3
decoded.sequence; // -> 96
decoded.sectorGridPosition; // -> { sectorX: 39, sectorY: 31, sectorZ: 18 }
```

## The two coordinate spaces

Both are three numbers. The axis names are what stop you mixing them up.

- **`GalacticPosition`** is `{x, y, z}` in **light-years**, Sol at the origin. This is
  what the journal's `StarPos`, EDSM and Spansh give you.
- **`SectorGridPosition`** is `{sectorX, sectorY, sectorZ}` — integer indices on the
  1280 ly naming grid.

```ts
import { sectorGridPositionFromGalacticPosition } from '@elite-dangerous-almanac/core/astro/galaxy-grid';
import { sectorNameFromGridPosition } from '@elite-dangerous-almanac/core/astro/sector-name';

const position = { x: -81.625, y: -151.3125, z: -376.0625 }; // light-years

const grid = sectorGridPositionFromGalacticPosition(position);
grid; // -> { sectorX: 38, sectorY: 31, sectorZ: 18 }

sectorNameFromGridPosition(grid); // -> 'Synuefai'
```

If you are starting from a real position and only want the name, go straight there with
`sectorNameFromGalacticPosition` rather than converting by hand.

## The four meanings of "region"

Answered here for one position — the Pleiades. They disagree, which is the point: each
names a different thing.

```ts
import { sectorNameFromGalacticPosition } from '@elite-dangerous-almanac/core/astro/galaxy-grid';
import { resolveNamingRegionOrigin } from '@elite-dangerous-almanac/core/astro/naming-region-origins';
import { findHandAuthoredRegionAt } from '@elite-dangerous-almanac/core/astro/hand-authored-regions';
import { findCodexRegionAt } from '@elite-dangerous-almanac/core/astro/codex-region-lookup';

const position = { x: -81.625, y: -151.3125, z: -376.0625 };

sectorNameFromGalacticPosition(position); // -> 'Synuefai'          procedural sector
findHandAuthoredRegionAt(position)?.name; // -> 'Pleiades Sector'   hand-authored region
findCodexRegionAt(position)?.name; // -> 'Inner Orion Spur'  codex region
resolveNamingRegionOrigin('Synuefai')?.x0; // -> 1556480             naming-region origin
```

| Concept | What it is | Entry point |
| --- | --- | --- |
| Procedural sector | The boxel-grid name a system inherits | `sectorNameFromGalacticPosition`, `sectorNameFromGridPosition` |
| Naming-region origin | A sector's corner, used to encode `id64` | `resolveNamingRegionOrigin` |
| Hand-authored region | Pleiades, Coalsack, … — named by Frontier | `findHandAuthoredRegionAt` |
| Codex region | One of the 42 galactic codex zones | `findCodexRegionAt`, `findCodexRegionForBoxel` |

`findCodexRegionAt` reads only `{x, z}`, because the codex map is an X/Z projection. It
takes a `GalacticPosition` as it comes and ignores the `y`.

A system inside a hand-authored region takes that region's name instead of the
procedural sector's — `ProceduralSystem.usesHandAuthoredRegion` tells you which happened.

## Nebulae are none of those

The nebula catalogue answers "what is near here", not "what is this called".

```ts
import { nearestNebulae, nebulaeWithin } from '@elite-dangerous-almanac/core/astro/nebulae';
import { REAL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-real';

const position = { x: -81.625, y: -151.3125, z: -376.0625 };

nearestNebulae(position, REAL_NEBULAE, 2).map((n) => [n.name, n.distanceLy]);
// -> [['Pleiades', 32.74…], ['Taurus Dark Region', 91.07…]]

nebulaeWithin(position, REAL_NEBULAE, 100).length;
```

**The catalogue argument is required, not defaulted.** `ALL_NEBULAE` is ~432 KiB, so
importing all 5835 records has to be your decision. Pick the narrowest catalogue that
answers your question: `REAL_NEBULAE` (~19 KiB) is the small, human-recognisable slice;
`PLANETARY_NEBULAE` is the heavy one at ~399 KiB.

## Permit locks

Two kinds, one lookup, from a name alone.

```ts
import { permitLockForSystemName } from '@elite-dangerous-almanac/core/astro/permit-locks';

permitLockForSystemName('Sol')?.kind; // -> 'system'   individually locked
permitLockForSystemName('Col 70 Sector AB-C d1-23')?.kind; // -> 'region'   the region is locked
permitLockForSystemName('Synuefe EN-H d11-96'); // -> null       not locked
```

There are five narrower lookups beneath it — by address, by region name, and the boolean
forms — but start here: it is the only one that answers for both kinds without you
knowing in advance which applies. Note that `ProceduralSystem.requiresRegionPermit` is a
region-level flag only; individually locked systems are hand-named and so never reach a
`ProceduralSystem` at all.

## Next

- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
