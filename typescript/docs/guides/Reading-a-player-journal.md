---
title: Reading a player journal
---

# Reading a player journal

Elite Dangerous writes a newline-delimited JSON journal. Two of its events carry most of
what this library is for: `Loadout` describes the ship the commander is flying, and
`FSDJump` (and `Location`, and `FSDTarget`) names the system they are in.

This guide turns both into library objects, and covers what to do when the game hands
you something the catalogues do not recognise.

## Reading the journal

Each line is one event. Read it, parse it, and switch on `event`.

```ts
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

declare const journalPath: string;

const lines = createInterface({ input: createReadStream(journalPath), crlfDelay: Infinity });

for await (const line of lines) {
    if (line.trim() === '') continue;
    const event = JSON.parse(line) as { event: string };

    switch (event.event) {
        case 'Loadout':
            // → a ShipLoadout, below
            break;
        case 'FSDJump':
        case 'Location':
            // → a ProceduralSystem, below
            break;
    }
}
```

## `Loadout` → a fitted ship

`ShipLoadout.fromLoadout` takes the event as the game wrote it.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';

declare const event: LoadoutEvent;

const build = ShipLoadout.fromLoadout(event);

build.shipSymbol; // -> 'krait_light'
build.shipName; // -> 'Jenny Longuet'
build.unladenMass; // -> 388.830017   tonnes

build.maxJumpRange(); // -> 60.5478    ly, best single jump
build.powerBudget().withinBudget; // -> true
build.shieldMetrics()?.strength; // -> 743.12     MJ
build.armourMetrics().hitPoints; // -> 307.8
```

Figures the event already stated — `UnladenMass`, `FuelCapacity` — are trusted verbatim
rather than recomputed, so what you read back matches what the player sees in game.
`MaxJumpRange` is the exception: it is recomputed from the drive rather than taken from
the event, so it may differ in the last decimal places from the number the capture
carried.

### Walking the modules

`slots()` gives every mount on the hull, occupied or not. Slot keys come from the game
and are not derivable from position, so read them rather than composing them.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
declare const build: ShipLoadout; // the `ShipLoadout.fromLoadout(event)` from above

for (const slot of build.slots()) {
    slot.key; // -> 'FrameShiftDrive', 'Slot01_Size6', 'LargeHardpoint1', …
    slot.name; // -> 'Frame Shift Drive'
    slot.module?.symbol; // -> undefined when the mount is empty
}

build.slots('hardpoint').length; // -> 4
```

These views are snapshots, not live handles. After `setModule` or `removeModule`, call
`slots()` again.

### What a capture paid, and what the build is worth

A journal states what one commander paid at one station — with their discounts, and
sometimes pricing only part of the build. That is provenance about the capture, not a
property of the fit, so it is kept separate and never edited.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
declare const build: ShipLoadout; // the `ShipLoadout.fromLoadout(event)` from above

const paid = build.sourcePurchase; // null for a build you assembled yourself

paid?.hullValue; // -> 37472252   as the capture stated it
paid?.valueForSlot('FrameShiftDrive'); // -> 4976355
paid?.valueForSlot('ShipCockpit'); // -> null — priced nothing, which is not "free"

build.toLoadoutEvent(); // retail: catalogue list prices
build.toLoadoutEvent({ credits: 'source' }); // the capture's own figures
```

Editing the build narrows the source export rather than staling it: a removed module
exports unpriced and takes `ModulesValue` and `Rebuy` with it, while `HullValue` stands.

## `FSDJump` → a system

`StarSystem` and `SystemAddress` come straight off the event.

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';

const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // -> 3309179996515n
system?.namingRegionName; // -> 'Synuefe'
```

`fromName` returns `null` rather than throwing when the name is not procedural — which
is the normal case for Sol, Shinrarta Dezhra and every other hand-named system. Treat
`null` as "this is a hand-named system", not as a failure.

Addresses accept a `bigint`, a safe-integer `number`, or a decimal string, and are
always returned as `bigint`. A journal parsed with `JSON.parse` yields a `number`, which
is exact for every real system address; a value above `2^53 - 1` is rejected rather than
silently rounded.

### Where is it?

`FSDJump` carries `StarPos` as `[x, y, z]` light-years. Reshape it before use — the
library takes `{x, y, z}` so the two coordinate spaces cannot be confused.

```ts
import { findHandAuthoredRegionAt } from '@elite-dangerous-almanac/core/astro/hand-authored-regions';
import { findCodexRegionAt } from '@elite-dangerous-almanac/core/astro/codex-region-lookup';
import { nearestNebulae } from '@elite-dangerous-almanac/core/astro/nebulae';
import { REAL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-real';

declare const starPos: readonly [number, number, number];

const position = { x: starPos[0], y: starPos[1], z: starPos[2] };

// Answered here for StarPos [-81.625, -151.3125, -376.0625], in the Pleiades:
findHandAuthoredRegionAt(position)?.name; // -> 'Pleiades Sector'
findCodexRegionAt(position)?.name; // -> 'Inner Orion Spur'
nearestNebulae(position, REAL_NEBULAE, 1)[0]?.name; // -> 'Pleiades'
```

### Permit locks

One lookup answers for both kinds of lock, from a name alone.

```ts
import { permitLockForSystemName } from '@elite-dangerous-almanac/core/astro/permit-locks';

permitLockForSystemName('Sol')?.kind; // -> 'system'
permitLockForSystemName('Col 70 Sector AB-C d1-23')?.kind; // -> 'region'
permitLockForSystemName('Synuefe EN-H d11-96'); // -> null
```

## When the game hands you something unknown

Journals outlive catalogues. A game update ships modules before this package knows about
them, so write the consumer to expect gaps rather than to assume completeness.

A lookup that finds nothing returns `null` — check it. An aggregate that depends on a
module the catalogue cannot classify is `null` too, with the matching `…Result` property
naming what was missing, and `build.validation` reports a fit the game would reject as an
`error`, against an `incomplete` for a build that does not add up — an empty core or
armour mount, or a hull or module newer than the catalogue. Only the second of those is
the library's own gap, so branch on the issue's `code` rather than its `severity`:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
declare const build: ShipLoadout; // the `ShipLoadout.fromLoadout(event)` from above

build.cargoCapacityResult; // -> names every rack it could not classify
build.validation.issues; // -> each with a stable code and a severity
```

[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
sets both patterns out in full — including which codes are the user's to fix and which
are the library's own gaps.

A journal line is one `Loadout` event, and it is taken whole or refused: bad JSON throws
`SyntaxError`, and a structurally impossible event — two slot keys differing only in
case, say — throws `TypeError` from `fromLoadout`. Catch both when the bytes come from
somewhere you do not control. A SLEF *file* holds several builds and can be part-good,
which is its own question —
[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Working-with-SLEF)
covers `parseSlef` against `inspectSlef` and what each does with a bad entry.

## Next

- [Getting started](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Getting-started)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
