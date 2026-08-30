---
title: Reading a player journal
---

# Reading a player journal

Elite Dangerous writes a newline-delimited JSON journal. Three of its events carry most
of what this library is for: `Loadout` describes the ship the commander is flying,
`FSDJump` (and `Location`, and `FSDTarget`) names the system they are in, and `Scan`
describes a body they have just resolved.

This guide turns all three into library objects, and covers what to do when the game
hands you something the catalogues do not recognise.

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
        case 'Scan':
            // → a BodyScanEvent, below
            break;
    }
}
```

## `Loadout` → a fitted ship

`ShipLoadout.fromLoadout` takes the event as the game wrote it.

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';

declare const event: LoadoutEvent;

const build = ShipLoadout.fromLoadout(event);

build.shipSymbol; // -> 'krait_light'
build.shipName; // -> 'Jenny Longuet'
build.unladenMass; // -> 388.830017   tonnes

const metrics = BuildMetrics.of(build);
metrics.maxJumpRange(); // -> 60.5478    ly, best single jump
metrics.powerBudget().withinBudget; // -> true
metrics.shieldMetricsResult().value?.strength; // -> 743.12     MJ
metrics.armourMetrics().hitPoints; // -> 307.8
```

Figures the event already stated — `UnladenMass`, `CargoCapacity`, `FuelCapacity` — are
trusted verbatim rather than recomputed, so what you read back matches what the player
sees in game — while the fit they describe survives import, which
[when the game hands you something unknown](#when-the-game-hands-you-something-unknown)
covers. `MaxJumpRange` is the exception either way: it is recomputed from the drive
rather than taken from the event, so it may differ in the last decimal places from the
number the capture carried.

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

## `Scan` → a body

There is nothing to convert. `BodyScanEvent` **is** the `Scan` event — the journal's own
field names, capitalisation and units — so a parsed line is already the right type.

```ts
import type { BodyScanEvent } from '@elite-dangerous-almanac/core/astro';

declare const line: string;

const scan = JSON.parse(line) as BodyScanEvent;
scan.BodyName; // the body's in-game name
scan.SystemAddress; // passes straight to every address entry point
```

One line describes a star, a planet, a moon or a belt cluster, and which one it is shows
in which fields it carries: `StarType` for a star, `PlanetClass` for a planet or moon,
neither for a belt cluster. Almost everything else is optional for the same reason, so
treat a missing field as "not written for this body", never as a zero.

### Working out what it means

The calculations take `BodyProperties` — the physical half of the event, with none of the
journal's bookkeeping required — so the scan goes straight in, and so does a record you
rebuilt from a database.

```ts
import { bulkDensity } from '@elite-dangerous-almanac/core/astro/body-physics';
import { orbitExtents, spinOrbitResonance } from '@elite-dangerous-almanac/core/astro/body-orbit';
import { classifyNeutronStar } from '@elite-dangerous-almanac/core/astro/star-physics';

const moon = { MassEM: 0.0123, Radius: 1_737_400, SemiMajorAxis: 3.844e8, Eccentricity: 0.0549 };

bulkDensity(moon); // -> 3343.7…      kg/m³
orbitExtents(moon)?.periapsis; // -> 363296440     metres, its closest approach
spinOrbitResonance({ RotationPeriod: 2_360_591.5, OrbitalPeriod: 2_360_591.5 });
// -> { rotations: 1, orbits: 1 }     tidally locked
classifyNeutronStar(moon); // -> null            not a neutron star
```

Every unit is the journal's: metres, seconds, kilograms, kelvin, pascals. They are not
the units the game's own UI shows — surface gravity is m/s² rather than g, pressure is
pascals rather than atmospheres, and `AxialTilt` is the one angle in radians rather than
degrees.

### A body and the one it orbits

A `Scan` names a body's parent only by `BodyID`, in its `Parents` chain, so a calculation
comparing the two takes both. Keep the scans you have already read, keyed by
`SystemAddress` and `BodyID`, and look the parent up when one arrives:

```ts
import type { BodyScanEvent } from '@elite-dangerous-almanac/core/astro';
import { hillRadius, rocheLimits } from '@elite-dangerous-almanac/core/astro/body-physics';
import { orbitExtents } from '@elite-dangerous-almanac/core/astro/body-orbit';

declare const bodies: Map<number, BodyScanEvent>; // by BodyID, within one system
declare const scan: BodyScanEvent;

const parentId = scan.Parents?.[0]?.Planet ?? scan.Parents?.[0]?.Star;
const primary = parentId === undefined ? undefined : bodies.get(parentId);

if (primary !== undefined) {
    const limits = rocheLimits(scan, primary);
    const closest = orbitExtents(scan)?.periapsis;
    // A breach is set by closest approach, not by the mean distance.
    const breached = limits !== null && closest !== undefined && closest < limits.rigid;
    hillRadius(scan, primary); // how far this body's own gravity reaches
}
```

Every calculation answers `null` when the scan did not write what it needs, so an
`AutoScan` that resolved little says so rather than guessing.

## When the game hands you something unknown

Journals can contain hulls or modules absent from the catalogues. A direct lookup that
finds nothing returns `null` — check it. `ShipLoadout` applies a narrower rule at import.
An entry is kept as the event stated it when the catalogue identifies its `Item` and the
mount can hold it, when its slot is a known cosmetic or hull-geometry key (`PaintJob`,
`ShipCockpit`, a numbered decal, …), or when it is a `ModularCargoBayDoor*` article in the
cargo-hatch mount — some hull families name their own symbol for the one built-in article
the catalogue carries.

Everything else is normalized: an unknown hull is refused; unknown modules in hardpoints,
utilities, optional internals and unrecognised slots are discarded; and a **stocked
mount** — armour, a core internal, the cargo hatch, the planetary approach suite — is
filled with that hull's stock article whenever the event did not leave a fitting one there
— one the catalogues cannot resolve, one the mount cannot hold (a cargo rack in `Armour`,
a size-8 plant in a size-2 mount, anything at all in the cargo hatch), or none at all.
Only those four kinds are corrected this way: every other optional, hardpoint or utility
mount may stand empty, so an article the catalogue resolves but the mount refuses is left
where
the event put it, for `validation` to report. A stock replacement carries the source's
`On`, `Priority` and `Health` across but none of its engineering or captured value.

The approach suite is on that list because a source silent about it is not a build that
sold one. Every hull leaves the shipyard carrying the advanced suite, which is weightless
and draws no power, so no build gains by shedding it — and an exporter that models no such
mount, as Inara does not, writes no entry for it either. So an event that names none
imports carrying the hull's own `Int_PlanetApproachSuite_Advanced`, reported as
`defaulted` like any other stocked mount. Unlike armour and the core internals it stays
removable, so a build that really does fly without one is a `removeModule` away.

When normalization changes the fitted set, the capture's aggregates are dropped: mass,
cargo and fuel capacity are recomputed from the fit that remains, while `modulesValue`
and `rebuy` read `null`, since nothing records what the discarded module cost;
`sourcePurchase` still reports the captured figures. A mount stocked from *absence* is the
exception — the bulkhead and the cargo hatch are weightless and free, and the approach
suite is weightless and costs 500 Cr, too little to drop a commander's whole purchase
record over — while an absent core internal stocked from the defaults invalidates them
like any other change. So on this account a capture's credit figures may understate an
imported fit by the price of one suite and no more; what a capture's own totals are worth
in the first place is its own business, and `sourcePurchase` reports them as stated.

`build.validation()` therefore reports the fit that remains: optional, hardpoint and
utility modules leave empty mounts and need no diagnostic, while required armour and core
mounts remain complete through their stock replacements. `build.importOutcomes` is the
frozen, machine-readable account of each change: the exact slot, the source module
where the capture named one, whether it was `emptied` or `defaulted`, and the replacement
symbol when one was fitted. It also reports what the import made of each module's stated
engineering: `rerolledEngineering`, where a stated modifier block moved no stat the module
carries and the recipe beside it was rolled in its place; `unresolvedEngineering`, for a
module whose source stated a recipe and no `Modifiers` that neither a craftable recipe nor
a catalogued article answers to — that module alone keeps the figures of an unengineered
one; and `ambiguousEngineering`, where such a block had two legitimate readings and the
roll was taken, carrying the catalogued article passed over so you can fit it instead.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
declare const build: ShipLoadout; // the `ShipLoadout.fromLoadout(event)` from above

build.validation().issues; // -> structural problems in the normalized fit
build.fittedModuleAt('Slot01_Size5'); // -> null if its imported symbol was unknown
build.importOutcomes; // exact import changes for display or logging
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
