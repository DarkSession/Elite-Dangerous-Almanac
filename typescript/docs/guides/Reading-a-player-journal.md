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

Figures the event already stated — `UnladenMass`, `CargoCapacity`, `FuelCapacity` — are
trusted verbatim rather than recomputed, so what you read back matches what the player
sees in game. `MaxJumpRange` is the exception: it is recomputed from the drive rather than
taken from the event, so it may differ in the last decimal places from the number the
capture carried.

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

A journal's purchase figures remain separate from catalogue retail. For the source record,
export options and edit behavior, see
[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Working-with-SLEF#credits-retail-against-what-a-capture-paid).

## `FSDJump` → a system

`StarSystem` and `SystemAddress` come straight from the event.

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';

const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // -> 3309179996515n
system?.namingRegionName; // -> 'Synuefe'
```

`fromName` returns `null` rather than throwing when the name is not procedural — which
is the normal case for Sol, Shinrarta Dezhra and every other hand-named system. Treat
`null` as "this is a hand-named system", not as a failure. A *missing* name is different:
pass a field that was not there and it throws `TypeError` naming the argument, so a
`StarSystem` your parser never found does not read back as a hand-named system.

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

Pass `StarSystem` to the permit-lock lookup described in
[Systems, sectors and regions](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Systems-and-regions#permit-locks).

## When the game hands you something unknown

Journals can contain hulls or modules absent from the catalogues. A direct lookup that
finds nothing returns `null` — check it. `ShipLoadout` applies a narrower rule at import:
an unknown hull is refused, unknown modules are discarded, and unknown armour or core
internals are replaced by that hull's stock modules. When the fitted set changes,
captured mass, capacity and credit aggregates are recomputed rather than trusted.

`build.validation` therefore reports the fit that remains: optional, hardpoint and
utility modules leave empty mounts and need no diagnostic, while the required core mounts
remain complete through their stock replacements.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
declare const build: ShipLoadout; // the `ShipLoadout.fromLoadout(event)` from above

build.validation.issues; // -> structural problems in the normalized fit
build.fittedModuleAt('Slot01_Size5'); // -> null if its imported symbol was unknown
```

[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
sets the validation and calculation patterns out in full.

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
