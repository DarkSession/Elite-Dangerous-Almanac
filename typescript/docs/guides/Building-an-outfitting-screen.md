---
title: Building an outfitting screen
---

# Building an outfitting screen

Everything a shipyard screen shows, end to end: enumerate the hull's mounts, offer only
what fits, fit it, and report what the build now does. All of it hangs off
{@link ships!ShipLoadout | ShipLoadout}.

## Start from a hull, or from a capture

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';

// A hull with only its built-in cargo hatch fitted…
const fresh = ShipLoadout.empty('Anaconda');

// …or the build a commander is already flying.
declare const event: LoadoutEvent;
const owned = ShipLoadout.fromLoadout(event);
```

## Enumerate the mounts

`slots()` returns every mount on the hull, occupied or not, in layout order. Pass a kind
to narrow it.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const build = ShipLoadout.empty('Anaconda');

build.slots().length; // -> 39
build.slots('optional').length; // -> 14
build.slots('hardpoint').length; // -> 8

const slot = build.slots('optional')[0];
slot?.key; // the identifier every mutation takes
slot?.name; // the label to render
slot?.size; // the class of module it accepts
slot?.module; // null while the mount is empty
```

**Slot keys come from the game and are not derivable from position.** Frontier writes
`FrameShiftDrive`, `Slot01_Size6`, `HugeHardpoint1`; a SLEF producer may lower-case them.
Read the key rather than composing one — matching is case-insensitive either way.

The views are snapshots. After an edit, call `slots()` again rather than re-reading a
value you captured earlier.

## Offer only what fits

`modulesForSlot` filters the complete module catalogue down to the modules that mount
will actually accept, by size and by restriction.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const build = ShipLoadout.empty('Anaconda');

const drives = build.modulesForSlot('FrameShiftDrive');
drives.map((m) => m.symbol); // every drive that fits, largest class included
```

The method searches all 1199 modules because some mounts accept modules from more than
one outfitting category: a fuel tank is a core module that also fits optional mounts.
`ShipLoadout` already carries the complete catalogue for whole-build operations.

## Fit, remove, engineer

Mutations return `this`, so they chain. The build is mutable — this is the one place in
the library that is.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';

const build = ShipLoadout.empty('Anaconda');
const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!;

build.setModule('FrameShiftDrive', fsd).applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
    grade: 5,
    experimental: 'special_fsd_heavy',
});

build.removeModule('Slot01_Size7');
build.setModuleEnabled('FrameShiftDrive', true);
build.setModulePriority('FrameShiftDrive', 1);
```

`availableBlueprints(slotKey)` returns candidate engineering routes for the fitted module
symbol. A candidate's `route` is `'ordinary'` when the stock module can take it or
`'mercenary'` when it requires the matching Mercenary purchase. Stock and Mercenary
articles share a module symbol, so show that route in the UI and confirm the purchase
before treating a Mercenary candidate as applicable. `availableExperimentalEffects`
continues to answer the stock module's ordinary experimental menu.

## Report what the build does

Each metric is one call. The figures below are one build's — a Federal Corvette.

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout; // a Federal Corvette

build.powerBudget().available; // -> 50.4     MW the plant makes
build.powerBudget().deployed; // -> 46.8597  MW drawn, hardpoints out
build.powerBudget().withinBudget; // -> true
build.powerBudget().bands.length; // -> 5        the five priority groups

build.shieldMetrics()?.strength; // -> 3940.4   MJ
build.armourMetrics().hitPoints; // -> 5062.6

build.weaponMetrics().total.damagePerSecond; // -> 137.04
build.weaponMetrics().total.sustainedDamagePerSecond; // -> 133.98
build.weaponMetrics().weapons.length; // -> 7
```

Jump range comes in the loads that matter, so a screen does not have to compute them:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

const jumps = build.jumpRangeSummary();
jumps.max; // best single jump: one jump's fuel, empty hold
jumps.unladen; // full tank, empty hold
jumps.laden; // full tank, full hold
jumps.totalMax.range; // the same best jump as a one-jump total
jumps.totalMax.jumps; // one jump when the build carries fuel
jumps.totalUnladen.range; // every jump on one tank, empty
jumps.totalUnladen.jumps; // number of jumps on that tank
jumps.totalLaden.range; // every jump on one tank, full
```

`powerBudget().bands` is what drives a priority-group table: a group is powered when its
running total — its own draw plus every higher-priority group's — fits in `available`.

## Tell the user what is wrong

Two different questions, deliberately kept apart, and both worth their own place on the
screen:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

build.validation.valid; // is the fit structurally legal?
build.validation.complete; // does it have every operational mount?
build.validation.issues; // what specifically, with a stable code per issue
```

Branch on each issue's `code`, not on its `severity` — the codes are the stable contract,
and one severity covers problems that belong in different places on the panel.
[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
lists the codes and covers the nullable/`…Result` pairs for mass, capacity, mobility,
shields and shield recovery. On a build imported rather than assembled here, read
`build.importOutcomes` alongside the issues: a mount the catalogues could not resolve is
already filled with the hull's stock article, and validation has nothing to say about it.

Two things follow for the panel itself. **An issue's `slot` is not a promise that the
mount exists**, so drive the placement off your own layout rather than off the code: look
the key up among the slots you are rendering, mark it there if it resolves, and fall
through to an off-panel list if it does not. That list is not an edge case — `unknownSlot`
carries a key that is by definition no mount on this hull. And an empty core or armour
mount arrives as an ordinary issue rather than as a special case — it is what your screen
exists to get filled, so render it as work to do, not as a fault.

## Next

- [Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Working-with-SLEF)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
