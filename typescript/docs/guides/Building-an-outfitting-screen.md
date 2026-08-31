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

// A hull on its stock bulkhead, core internals and cargo hatch, nothing else fitted…
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

const optional = build.modulesForSlot('Slot01_Size7');
const cargoRacks = optional.filter((module) => module.familyId === 'cargoRacks');
```

The method searches all 1194 modules because some mounts accept modules from more than
one outfitting category: a fuel tank is a core module that also fits optional mounts.
`ShipLoadout` already carries the complete catalogue for whole-build operations.

What it never offers is the fifteen `grantOnly` articles — the starter `*_free` fittings
and the bundle-granted Vessel Hangars — because each is a second identity for a module
the game already sells. Offer them and the thruster list shows "2E Thrusters" twice, the
second one unpriced. A build that arrived carrying one keeps it, and `getModuleBySymbol`
still resolves it; only the choices are filtered.

The Cargo Hatch is left out for a different reason: it is hull furniture. The source
registry files it with the optional internals, which is where `INTERNAL_MODULES` carries
it, but the hull is built with one and the fixed `CargoHatch` mount is the only place it
goes — so no mount your screen can edit offers or accepts it.

## Group the offer into collapsible families

Every module carries a `familyId`, core modules included, so the whole result of
`modulesForSlot` groups without a taxonomy of your own. Related variants share one
family: Bi-Weave and Prismatic generators are all `shieldGenerators`, and a
pre-engineered or Powerplay weapon stays with its base weapon.

`OUTFITTING_FAMILIES` gives the canonical English heading for a family, and
`getOutfittingFamilyName` gives a localized one — `null` where the sources carry no
label for that locale, so your application chooses the fallback rather than being handed
English dressed up as a translation.

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import {
    OUTFITTING_FAMILIES,
    type OutfittingFamilyId,
} from '@elite-dangerous-almanac/core/ships/module-families';
import { getOutfittingFamilyName } from '@elite-dangerous-almanac/core/i18n/module-families';

const build = ShipLoadout.empty('Anaconda');

const byFamily = new Map<OutfittingFamilyId, string[]>();
for (const module of build.modulesForSlot('Slot01_Size7')) {
    byFamily.set(module.familyId, [...(byFamily.get(module.familyId) ?? []), module.symbol]);
}

const heading = (familyId: OutfittingFamilyId, locale: string) =>
    getOutfittingFamilyName(familyId, locale) ?? OUTFITTING_FAMILIES[familyId];

heading('shieldGenerators', 'de'); // -> 'Schildgeneratoren'
heading('xenoScanners', 'de'); // -> 'Xeno Scanners', the English fallback this app chose
```

A family is the heading, not the whole label: one family can hold two product lines the
game sells side by side. The `fsd` family holds both drive lines, and which one a record
belongs to is a field on it rather than something to recover from its symbol:

```ts
import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';

const drives = CORE_MODULES.filter((module) => module.slot === 'frameShiftDrive');
drives.length; // -> 67
drives.filter((module) => module.supercruiseOvercharge).length; // -> 36, the SCO line
```

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
    experimentalEffectSymbol: 'special_fsd_heavy',
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

Each metric is one call on a {@link ships!BuildMetrics | BuildMetrics} attached to the
build with `BuildMetrics.of(build)`. The figures below are one build's — a Federal
Corvette.

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics; // BuildMetrics.of(build), a Federal Corvette

metrics.powerBudget().available; // -> 50.4     MW the plant makes
metrics.powerBudget().deployed; // -> 46.8597  MW drawn, hardpoints out
metrics.powerBudget().withinBudget; // -> true
metrics.powerBudget().bands.length; // -> 5        the five priority groups

metrics.shieldMetricsResult().value?.strength; // -> 3940.4   MJ
metrics.shieldMetricsResult().value?.resistances.kinetic; // the generator and boosters, no pips
metrics.shieldCapacitorMetricsResult().value?.effectiveResistances.kinetic; // with four pips to SYS
metrics.armourMetrics().hitPoints; // -> 5062.6

metrics.weaponMetrics().total.damagePerSecond; // -> 137.04
metrics.weaponMetrics().total.sustainedDamagePerSecond; // -> 133.98
metrics.weaponMetrics().weapons.length; // -> 7
```

Jump range comes in the loads that matter, so a screen does not have to compute them:

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics;

const jumps = metrics.jumpRangeSummary();
jumps.max; // best single jump: one jump's fuel, empty hold
jumps.unladen; // full tank, empty hold
jumps.laden; // full tank, full hold
jumps.totalMax.range; // the same best jump as a one-jump total
jumps.totalMax.jumps; // one jump when the build carries fuel
jumps.totalUnladen.range; // every jump on one tank, empty
jumps.totalUnladen.jumps; // number of jumps on that tank
jumps.totalLaden.range; // every jump on one tank, full
```

Mass and mobility come as figures rather than as ingredients, so the panel's mass line
and its speed line are both one call:

```ts
import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';

declare const metrics: BuildMetrics;

const mass = metrics.buildMass();
mass.hull; // the bare hull, in tonnes
mass.modules; // every fitted module, post-engineering
mass.total; // with a full main tank and an empty hold

const mobility = metrics.mobilityMetricsResult().value;
mobility?.speed; // m/s, at four ENG pips
mobility?.loadedMass; // the mass that speed was calculated at
metrics.mobilityCapacitorMetricsResult({ enginesPips: 2 }).value?.speed; // m/s, at two
metrics.thrusters()?.optMass; // rated performance at or below this mass
metrics.thrusters()?.maxMass; // past this the ship does not move at all
```

The three capacity lines sit on the build itself rather than on `BuildMetrics`, because
each is a property of what is fitted, not a calculation over it:

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const liner = ShipLoadout.default('Orca');

liner.cargoCapacity; // -> 24   tonnes, summed over the fitted racks
liner.passengerCapacity; // -> 40   berths, summed over the fitted cabins
liner.fuelCapacity.main; // -> 32   tonnes the drive can burn
```

`cargoCapacity` and `fuelCapacity` prefer a capture's own figure where it has one;
`passengerCapacity` is always the sum, because no capture states a passenger figure.

A passenger panel usually wants the split by class as well as the total, and no stat
field carries the class: group on the `_Class1`–`_Class4` suffix of each cabin's
`symbol`, which is economy, business, first and luxury on both cabin lines (the Mk II
line stops at business). Do not group on `rating` — the Mk II cabins run one rating
better than the Mk I cabins of the same class, so `D` is economy on one line and
business on the other.

The game's statistics panel counts the reserve tank in the current mass it displays;
nothing here does, so add `fuelCapacity.reserve` if you are reproducing that reading.
[Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Build-metrics)
covers the mass curve those three thruster figures describe.

`powerBudget().bands` is what drives a priority-group table: a group is powered when its
running total — its own draw plus every higher-priority group's — fits in `available`.

## Tell the user what is wrong

Two different questions, deliberately kept apart:

```ts
import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const build: ShipLoadout;

const validation = build.validation();
validation.valid; // is the fit structurally legal?
validation.complete; // legal *and* every operational mount filled
validation.issues; // what specifically, with a stable code per issue
```

Branch on each issue's `code`, not on its `severity` — the codes are the stable contract,
and one severity covers problems that belong in different places on the panel.
[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
explains the codes and covers the `…Result` methods for mobility, shields and
shield recovery. On an imported build, read `build.importOutcomes` alongside the issues:
validation says nothing about normalization, so an empty mount on your panel may be one
the player left empty or one import emptied for them.

Two things follow for the panel itself. **An issue's `slot` is not a promise that the
mount exists**, so drive the placement off your own layout rather than off the code: look
the key up among the slots you are rendering, mark it there if it resolves, and fall
through to an off-panel list if it does not. That list is not an edge case — `unknownSlot`
carries a key that is by definition no mount on this hull. And on a build `complete`
tracks `valid`: every build fills its core and armour mounts, so the `missingRequiredSlot`
half of the question only reaches you from `validateLoadout` on a list of your own.

One issue on this panel is not about where a module went: `thrusterMassExceeded` says the
thrusters the player just picked are rated below what the ship now weighs, and above that
rating the mass curve gives nothing back, so the ship does not move at all. It is the one
code that carries figures — `params.mass` and `params.maxMass`, in tonnes — so mark the
thruster mount with them rather than with the generic message. Reach for it when a swap
elsewhere on the panel adds mass too: a heavier module in an optional mount can invalidate
a thruster choice the player made ten edits ago, and re-reading `validation()` after every
edit is what surfaces that.

It also carries `params.load`, naming which of the ship's three loads the rating failed
at — `dry`, `unladen` (a full main tank) or `laden` (a full hold as well). The first two
are errors, and the third is the panel's one `warning` severity: a hauler that only
outgrows its thrusters with the hold full is still a legal build, so it stays `valid` and
`complete` and reaches you through `issues` alone. Put that one beside the cargo figure
rather than on the thruster mount — the fix is usually to carry less, not to refit.

## Next

- [Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Working-with-SLEF)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.The-failure-model)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
