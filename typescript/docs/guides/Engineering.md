---
title: Engineering
---

# Engineering

The engineering API answers two questions: **what can I put on this module**, and **what
does it do to the stats**. The menu is also the validation gate, so an editor and its menu
cannot give different answers.

## The menu is the gate

Availability is a property of the **module**, not of the blueprint. A Pulse Laser accepts
the Efficient blueprint and a Rail Gun does not, and two modules whose blueprints overlap
may still offer different experimental effects. So `ships/engineering-options` groups the
modules and each group lists what it offers.

```ts
import {
    getBlueprintsForModule,
    getExperimentalsForModule,
} from '@elite-dangerous-almanac/core/ships/engineering-options';

getBlueprintsForModule('Hpt_PulseLaser_Fixed_Small'); // the recipes this weapon takes
getExperimentalsForModule('Hpt_PulseLaser_Fixed_Small'); // the effects it takes
```

{@link ships!ShipLoadout.applyBlueprint | applyBlueprint} reads that same catalogue and
refuses a recipe it does not list for that module. That is the point: "what can I put on
this?" and "may I put this on it?" are answered from one source, so a menu that offers a
recipe the editor would reject is not a state this library can reach.

`ShipLoadout` includes the menu catalogue whether or not a consumer calls these methods.
Using one catalogue keeps the editor and menu consistent.

**Not every module engineers.** The catalogue groups 1028 of the 1199 modules; the rest
take nothing — whole families like fuel tanks, passenger cabins and limpet controllers,
plus individual modules upstream denies every recipe. A module with no group is not a gap
in the data.

### Why there is no family map

Inferring and comparing families from module and blueprint symbols refuses recipes on 52
modules and disagrees with 76 entries in a 1902-entry build corpus. The failures come from
the inference rather than the data — the Hatch Breaker
Limpet Controller's symbol is `Int_DroneControl_ResourceSiphon`, which no "hatchbreaker"
prefix rule matches, and the Caustic Sink Launcher's symbol says `causticsink` where its
group is the heat sink launchers'. A per-module menu has nothing to infer, and two
hand-maintained answers to one question can drift. The API therefore uses only the
per-module menu.

## Rolling a recipe

A blueprint grade bounds each modifier, and the engineering **quality** roll picks a point
in that range: `v = min + (max − min) × quality`. An experimental effect adds a fixed
contribution on top. {@link ships!computeModifiers | computeModifiers} folds every
contribution onto the module's base stats and hands back journal-style modifiers.

```ts
import { computeModifiers } from '@elite-dangerous-almanac/core/ships/engineering';
import { getBlueprintGrade } from '@elite-dangerous-almanac/core/ships/blueprints';
import { getExperimentalEffect } from '@elite-dangerous-almanac/core/ships/experimental-effects';

const mods = computeModifiers(
    { FSDOptimalMass: 4670 },
    getBlueprintGrade('FSD_LongRange', 5)!,
    1, // quality: 0 is the worst roll, 1 the best
    getExperimentalEffect('special_fsd_heavy')!,
);
// -> [{ Label: 'FSDOptimalMass', Value: 7528.04, OriginalValue: 4670 }]
```

Each contribution names a journal Label and an apply method — `multiplicative` (the
percentages compound), `additive` (flat reinforcement) or `overwrite` (the value replaces
the base). Two behaviors apply on top of those methods:

- **Percentages of a multiplier.** Hull boost, shield boost and the four resistances
  compound on their multiplier rather than on the stat, whichever method the recipe names.
  [Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Build-metrics)
  works through what that does to a figure.
- **A capability rather than a number.** Anti-Guardian Zone Resistance produces
  `{ Label: 'GuardianModuleResistance', ValueStr: 'Active' }`; its displayed `+100%` is not
  folded as a value, and effective module stats expose the granted boolean instead.

On a build, all of this is one call, and it recomputes the derived stats — a weapon's rate
of fire, for instance — that follow from what the recipe changed:

```ts
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const build = ShipLoadout.empty('Anaconda');

build.availableBlueprints('FrameShiftDrive'); // what this mount can take
build.availableExperimentalEffects('FrameShiftDrive');
```

## The three accommodations

The gate makes exactly three allowances beyond the menu. They are applied in a fixed
order — journal spelling, then the pre-engineered route, then the generic spelling — and
only the first can change *which* recipe an accepted id names.

**The journal spelling of a menu entry.** Where the game writes one `BlueprintName` for two
different recipes, the module's own group carries the map from that id to the entry it
names. Only the three utility-scanner groups need one. This is pinned data rather than
inference, because unlike the generic spellings the two ids do not describe the same
modification.

**The generic spelling.** Where a modification applies to several families, the game writes
a family-specific id and the catalogue lists that one — but a build authored elsewhere may
carry the generic `Misc_*` id. Both are accepted, because both name the same recipe: their
grades touch the same labels by the same methods.

The alias is **directional**, and that is what keeps it safe. A generic id stands in for a
family's id, never for another generic one. `Misc_ChaffCapacity` and `Misc_HeatSinkCapacity`
are both "Ammo capacity" over the same three labels, but they roll different amounts of
different ammunition, so neither may substitute for the other.

**The pre-engineered route.** Most Operations keys belong to a module bought already
engineered, so no menu lists one and the menu check alone would refuse all of them
everywhere. `ships/pre-engineered` names which module each arrives on, and the gate accepts
such a recipe on the non-final module sold carrying it and nowhere else — `RailGun_LongShot`
resolves on the medium rail gun, not on the small one.

This route covers the **climb, not the purchase**. A Mercenary module arrives at grade 1 and
its recipe publishes grades 2–5, the grades an engineer can still add; the grade it was sold
at cannot be reproduced through this route, and a variant marked `engineeringLocked` never
takes it at all.

## Pre-engineered modules

Use `ships/pre-engineered` to find a variant and `ships/pre-engineered-stats` to resolve
its fitted stats.

```ts
import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
import { getPreEngineeredStats } from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';

const variants = getPreEngineeredVariants('Hpt_BasicMissileRack_Fixed_Medium');
const resolved = variants[0] ? getPreEngineeredStats(variants[0]) : null;
resolved?.symbol;
```

The API documentation owns the record and resolution semantics: see
{@link ships!PreEngineeredVariant | PreEngineeredVariant},
{@link ships!getPreEngineeredVariants | getPreEngineeredVariants}, and
{@link ships!getPreEngineeredStats | getPreEngineeredStats}.

## What a roll costs

**Costs are a separate catalogue from mechanics**, on their own subpaths, so a build
editor that never prices anything does not bundle the shopping lists. `ships/blueprints`
answers what a recipe *does*; `ships/blueprint-costs` answers what it *takes*.

```ts
import { getBlueprint } from '@elite-dangerous-almanac/core/ships/blueprints';
import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
import { rollsForGrade } from '@elite-dangerous-almanac/core/ships/engineering';

getBlueprint('FSD_LongRange'); // the mechanics: every grade's features
getBlueprintCost('FSD_LongRange', 5); // materials for the whole climb, grades 1–5
getBlueprintCost('FSD_LongRange', 5, 4); // grade 5 alone, from a grade-4 module
rollsForGrade(5); // rolls to fill the grade's progress bar
```

A grade costs its recipe once per roll and grade `g` takes `g` rolls, so the climb is
weighted rather than a plain sum — which is what `getBlueprintCost` folds in for you.

An experimental effect is a separate single application, on its own subpath again, and
`sumMaterials` folds the two bills into one:

```ts
import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
import { getExperimentalEffectCost } from '@elite-dangerous-almanac/core/ships/experimental-effect-costs';
import { sumMaterials } from '@elite-dangerous-almanac/core/ships/engineering';

const grand = sumMaterials(
    getBlueprintCost('Weapon_LongRange', 5) ?? [],
    getExperimentalEffectCost('special_focused') ?? [],
);
grand.length;
```

Pricing the remaining upgrade on a module bought pre-engineered is the same call with the
grade it arrived at as the third argument. On a **reward** variant it is not: those carry
hand-set overrides no blueprint grants, so the ordinary material recipe prices ordinary
engineering rather than the reward.

## Next

- [Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Build-metrics)
  — what these modifiers do to power, shields, armour, weapons and range.
- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Building-an-outfitting-screen)
- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
