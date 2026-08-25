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
refuses a recipe it does not list for that stock module, apart from the purchase-specific
Mercenary climb described below. That is the point: "what can I put on this?" and "may I
put this on it?" are answered from one source, so a menu that offers a recipe the editor
would reject is not a state this library can reach.

`ShipLoadout` includes the menu catalogue whether or not a consumer calls these methods.
Using one catalogue keeps the editor and menu consistent.

**Not every stock module has an ordinary engineering menu.** The catalogue groups 1005 of
the 1199 modules; the rest include whole families like fuel tanks, passenger cabins and
limpet controllers, plus individual modules denied every ordinary recipe. Six module
symbols retain Mercenary upgrade routes despite no stock menu: the Enzyme Missile Rack,
fixed Mining Laser, fixed Abrasion Blaster, size-5 class-2 Module Reinforcement Package,
and size-5 and size-6 cargo racks. Qualifying Mercenary articles can be upgraded through
grades 2–5 of their bespoke recipes. Fixed Enzyme/AX variants and fixed community-goal
cargo racks remain final articles. A module with no group is therefore not a gap in the
data.

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
contribution onto base values while preserving the recipe's primitive labels.

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
// -> [{ Label: 'FSDOptimalMass', Value: 7528.039551, OriginalValue: 4670 }]
```

Each contribution names a modifier label and an apply method — `multiplicative` (the
percentages compound), `additive` (flat reinforcement) or `overwrite` (the value replaces
the base). Two behaviors apply on top of those methods:

- **Percentages of a multiplier.** Hull boost, shield boost and the four resistances
  compound on their multiplier rather than on the stat, whichever method the recipe names.
  [Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Build-metrics)
  works through what that does to a figure.
- **A capability rather than a number.** Anti-Guardian Zone Resistance produces
  `{ Label: 'GuardianModuleResistance', ValueStr: 'Active' }`; its displayed `+100%` is not
  folded as a value, and effective module stats expose the granted boolean instead.

`computeModifiers` uses Frontier's float32 arithmetic once. On a build,
`applyBlueprint` presents that same result under the module-specific labels a journal
writes; it does not run a second calculation. A `Range` recipe leg on a module carrying
`maximumRange` becomes `MaximumRange`, while a scanner's `ScannerRange` becomes `Range`.
High Capacity changes the internal fire interval, then the journal presentation exposes
the resulting `RateOfFire` and `DamagePerSecond` rather than storing `BurstInterval`.

A compact build reconstructed from blueprint, grade, quality and experimental effect
therefore writes the equivalent journal modifier block while retaining recipe-only values
for `effectiveStats` and build calculations. A later journal import can only recover what
the journal serialized; the live reconstructed build also knows the burst interval or
burst size the recipe changed:

```ts
import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!;
const build = ShipLoadout.empty('Anaconda').setModule('FrameShiftDrive', fsd);

build.availableBlueprints('FrameShiftDrive'); // ordinary menu for the fitted FSD
build.availableExperimentalEffects('FrameShiftDrive');
```

## Festive pre-engineered variants

Decorative transformations occupy the journal's `Engineering` field at grade 5 but are
not craftable blueprint recipes: they have no material cost or applying engineer. They are
fixed variants of the awarded Remote Release Flak Launcher, not transformations a caller
may apply to any damage-bearing module. Find one in `ships/pre-engineered` and fit it with
{@link ships!ShipLoadout.setPreEngineeredVariant | setPreEngineeredVariant}. The emitted
journal/SLEF block contains `BlueprintName`, `Level: 5`, `Quality: 1` and `Modifiers`.

```ts
import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
import { getModulesByName } from '@elite-dangerous-almanac/core/ships/modules';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const launcher = getModulesByName('Remote Release Flak Launcher')
    .find((module) => module.mount === 'Turreted')!;
const red = getPreEngineeredVariants(launcher.symbol)
    .find((variant) => variant.blueprint === 'Decorative_Red')!;
const festive = ShipLoadout.empty('Krait_MkII').setPreEngineeredVariant(
    'MediumHardpoint1',
    red,
);

festive.toLoadoutEvent().Modules.find((m) => m.Slot === 'MediumHardpoint1')?.Engineering;
// BlueprintName + Level: 5 + Quality: 1 + Modifiers
```

`getPreEngineeredStats`, `getPreEngineeredModifiers` and
`getPreEngineeredJournalModifiers` resolve the same record for callers working with plain
module data. The catalogue binds each `Decorative_*` identity to the only module observed
carrying it, preventing unsupported festive variants of unrelated weapons.

For a module symbol that has Mercenary variants, `availableBlueprints` appends every
bespoke Mercenary upgrade recipe after the ordinary menu and marks it with `route:
'mercenary'`. Stock and Mercenary articles share a symbol, but each bespoke blueprint is
available only to its corresponding purchase. A fitted module carrying that blueprint is
therefore identified as the Mercenary article at its purchase grade or after a later
upgrade; its `preEngineeredVariant` retains the original grade and Merc Coin price.

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

**The Mercenary route.** The 22 Mercenary catalogue records describe modules bought
already engineered at grade 1, so no ordinary menu lists their bespoke recipes and the
menu check alone would refuse all of them everywhere. `ships/pre-engineered` names which
module each arrives on, and the
gate accepts that bespoke recipe on the module sold carrying it and nowhere else —
`RailGun_LongShot` resolves on the medium rail gun, not on the small one. A community-goal
or tech-broker reward does not open the same route merely because its record names an
ordinary blueprint: that id identifies the fixed article.

This route covers the **climb, not the purchase**. A Mercenary module arrives at grade 1 and
its recipe publishes grades 2–5, the grades an engineer can still add; the grade it was sold
at cannot be reproduced through this route.

## Pre-engineered modules

Use `ships/pre-engineered` to find any fixed variant and
`ships/pre-engineered-stats` to resolve its fitted stats.

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

**Costs are a separate catalogue from mechanics**, on their own subpaths, so one can be
priced without the other: `ships/blueprints` answers what a recipe *does*;
`ships/blueprint-costs` answers what it *takes*. (`ShipLoadout` reads both, because
`buildCost` prices a whole fit — see [Pricing a whole build](#pricing-a-whole-build).)

```ts
import { getBlueprint } from '@elite-dangerous-almanac/core/ships/blueprints';
import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
import { rollsForGrade } from '@elite-dangerous-almanac/core/ships/engineering';

getBlueprint('FSD_LongRange'); // the mechanics: every grade's features
getBlueprintCost('FSD_LongRange', 5); // the whole climb, grades 1–5
getBlueprintCost('FSD_LongRange', 5, 4); // grade 5 alone, from a grade-4 module
rollsForGrade(5); // rolls to fill the grade's progress bar
```

A grade costs its recipe once per roll and grade `g` takes `g` rolls, so the climb is
weighted rather than a plain sum — which is what `getBlueprintCost` folds in for you.

A cost is **both halves of the bill**: the `materials` consumed and the `mercCoins`
charged beside them. Twenty-five recipes bill Merc Coin per roll, under the same
weighting; every other recipe reports `0`, which is a real amount rather than a missing
one. `null` is reserved for "not catalogued", so it never has to be untangled from
"charges nothing".

Most of the twenty-five are the bespoke Mercenary recipes, which start at grade 2 because
the article was bought at grade 1 — but four are ordinary menu recipes on stock modules,
so do not read a Merc Coin charge as meaning a Mercenary article:

```ts
import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';

// A Mercenary article: bought at grade 1, so price the climb from there.
getBlueprintCost('RailGun_LongShot', 5, 1)?.mercCoins; // -> 415
// An ordinary menu recipe on a stock fuel scoop: the whole climb, grades 1-5.
getBlueprintCost('FuelScoop_Efficiency', 5)?.mercCoins; // -> 350
// A recipe that charges no currency at all.
getBlueprintCost('FSD_LongRange', 5)?.mercCoins; // -> 0
```

An experimental effect is a separate single application, on its own subpath again. It
costs materials alone, so only that half needs folding — `sumMaterials` does it:

```ts
import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
import { getExperimentalEffectCost } from '@elite-dangerous-almanac/core/ships/experimental-effect-costs';
import { sumMaterials } from '@elite-dangerous-almanac/core/ships/engineering';

const grand = sumMaterials(
    getBlueprintCost('Weapon_LongRange', 5)?.materials ?? [],
    getExperimentalEffectCost('special_focused') ?? [],
);
grand.length;
```

The blueprint's `mercCoins` therefore stands as the whole currency bill for an upgrade.

Pricing the remaining upgrade on a module bought pre-engineered is `getBlueprintCost`
again, with the grade it arrived at as the third argument. On a **reward** variant it is
not: those carry hand-set overrides no blueprint grants, so the ordinary material recipe
prices ordinary engineering rather than the reward.

## Pricing a whole build

`BuildMetrics.buildCost` does the same folding for every module a build carries, including
the Merc Coin charged by ordinary engineering-menu recipes, and prices the hull and
modules in credits beside it:

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

const build = ShipLoadout.default('Anaconda');
build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });

const cost = BuildMetrics.of(build).buildCost();
cost.credits.total; // -> 146978572
cost.credits.rebuy; // -> 7348928
cost.materials.find((material) => material.symbol === 'Arsenic')?.count; // -> 5
cost.mercCoins; // -> 0
```

It charges only what a player still has to pay. A Mercenary article arrives at the grade
it was sold at, so its climb is priced from there and an effect it came with is free; a
reward article was never rolled from the recipe it names, so it costs no materials at all.

## Next

- [Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Build-metrics)
  — what these modifiers do to power, shields, armour, weapons and range.
- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Building-an-outfitting-screen)
- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Document.Reading-a-player-journal)
- [Complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/modules)
