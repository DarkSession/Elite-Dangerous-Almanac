---
title: Engineering
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / Engineering

# Engineering

The engineering API answers two questions: **what can I put on this module**, and **what
does it do to the stats**. The menu is also the validation gate, so an editor and its menu
cannot give different answers.

## The menu is the gate

Availability is a property of the **module**, not of the blueprint. A Pulse Laser accepts
the Efficient blueprint and a Rail Gun does not, and two modules whose blueprints overlap
may still offer different experimental effects. So
[EngineeringOptions](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.EngineeringOptions) groups the modules and each
group lists what it offers.

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

// The recipes this weapon takes, and the effects it takes.
IReadOnlyList<string> recipes = EngineeringOptions.BlueprintsFor("Hpt_PulseLaser_Fixed_Small");
IReadOnlyList<string> effects = EngineeringOptions.ExperimentalsFor("Hpt_PulseLaser_Fixed_Small");
```

`ShipLoadout.ApplyBlueprint` reads that same catalogue and refuses a recipe it does not
list for that stock module, apart from the purchase-specific Mercenary climb described
below. That is the point: "what can I put on this?" and "may I put this on it?" are
answered from one source, so a menu that offers a recipe the editor would reject is not a
state this library can reach.

A group is one menu. Where the same kind of module comes in two flavours with different
menus, they are two groups: a Guardian power plant takes only Anti-Guardian Zone
Resistance and an ordinary one takes only the ordinary recipes.

**Not every stock module has an ordinary engineering menu.** The catalogue groups the ones
that do; the rest include whole families like fuel tanks, passenger cabins and limpet
controllers, plus individual modules denied every ordinary recipe. A few module symbols
keep a Mercenary upgrade route despite having no stock menu: the Enzyme Missile Rack,
fixed Mining Laser, fixed Abrasion Blaster, size-5 class-2 Module Reinforcement Package,
and size-5 and size-6 cargo racks. Qualifying Mercenary articles can be upgraded through
grades 2–5 of their bespoke recipes. Fixed Enzyme/AX variants and fixed community-goal
cargo racks remain final articles. A module with no group is therefore not a gap in the
data, and `BlueprintsFor` answers an empty list for one rather than `null`, so the result
is always safe to iterate.

### Why there is no family map

Inferring and comparing families from module and blueprint symbols refuses recipes the
game offers, and disagrees with the build corpus. The failures come from the inference
rather than the data — the Hatch Breaker Limpet Controller's symbol is
`Int_DroneControl_ResourceSiphon`, which no "hatchbreaker" prefix rule matches, and the
Caustic Sink Launcher's symbol says `causticsink` where its group is the heat sink
launchers'. A per-module menu has nothing to infer, and two hand-maintained answers to one
question can drift. The API therefore uses only the per-module menu.

## Rolling a recipe

A blueprint grade bounds each modifier, and the engineering **quality** roll picks a point
in that range: `v = min + (max − min) × quality`. An experimental effect adds a fixed
contribution on top. `Engineering.ComputeModifiers` folds every contribution onto base
values while preserving the recipe's primitive labels.

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

IReadOnlyList<EngineeringModifier> rolled = Engineering.ComputeModifiers(
    new Dictionary<string, double> { ["FSDOptimalMass"] = 4670 },
    BlueprintCatalogue.FindGrade("FSD_LongRange", 5)!,
    1, // quality: 0 is the worst roll, 1 the best
    ExperimentalEffectCatalogue.Find("special_fsd_heavy"));

// One modifier: Label "FSDOptimalMass", Value 7528.039551, OriginalValue 4670.
```

Each contribution names a modifier label and an apply method — multiplicative (the
percentages compound), additive (flat reinforcement) or overwrite (the value replaces the
base). Two behaviours apply on top of those methods:

- **Percentages of a multiplier.** Hull boost, shield boost and the four resistances
  compound on their multiplier rather than on the stat, whichever method the recipe names.
  [Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Build-metrics) works through what that does to a
  figure.
- **A capability rather than a number.** Anti-Guardian Zone Resistance produces a modifier
  whose `Label` is `GuardianModuleResistance` and whose `ValueStr` is `Active`; its
  displayed `+100%` is not folded as a value, and effective module stats expose the
  granted flag instead.

`ComputeModifiers` uses Frontier's 32-bit float arithmetic once. On a build,
`ApplyBlueprint` presents that same result under the module-specific labels a journal
writes; it does not run a second calculation. A `Range` recipe leg on a module carrying a
maximum range becomes `MaximumRange`, while a scanner's `ScannerRange` becomes `Range`.
High Capacity changes the internal fire interval, then the journal presentation exposes the
resulting `RateOfFire` and `DamagePerSecond` rather than storing `BurstInterval`.

A compact build reconstructed from blueprint, grade, quality and experimental effect
therefore writes the equivalent journal modifier block while retaining recipe-only values
for effective stats and build calculations. A later journal import can only recover what
the journal serialized; the live reconstructed build also knows the burst interval or burst
size the recipe changed:

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

OutfittingModule fsd = ModuleCatalogue.FindBySymbol("Int_Hyperdrive_Size6_Class5")!;
ShipLoadout build = ShipLoadout.Empty("Anaconda").SetModule("FrameShiftDrive", fsd);

// The ordinary menu for the fitted drive.
IReadOnlyList<AvailableBlueprint> menu = build.AvailableBlueprints("FrameShiftDrive");
IReadOnlyList<string> effects = build.AvailableExperimentalEffects("FrameShiftDrive");
```

## Festive pre-engineered variants

Decorative transformations occupy the journal's `Engineering` field at grade 5 but are not
craftable blueprint recipes: they have no material cost or applying engineer. They are
fixed variants of the awarded Remote Release Flak Launcher, not transformations a caller
may apply to any damage-bearing module. Find one in
[PreEngineeredCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.PreEngineeredCatalogue) and fit it with
`ShipLoadout.SetPreEngineeredVariant`. The emitted journal or SLEF block states the
blueprint name, `Level` 5, `Quality` 1 and the modifiers.

```csharp
using System.Linq;
using EliteDangerousAlmanac.Ships;

OutfittingModule launcher = ModuleCatalogue
    .FindByName("Remote Release Flak Launcher")
    .First(module => module.Mount == ModuleMount.Turreted);

PreEngineeredVariant red = PreEngineeredCatalogue
    .VariantsFor(launcher.Symbol)
    .First(variant => variant.BlueprintSymbol == "Decorative_Red");

ShipLoadout festive = ShipLoadout
    .Empty("Krait_MkII")
    .SetPreEngineeredVariant("MediumHardpoint1", red);

ModuleEngineering? block = festive
    .ToLoadoutEvent()
    .Modules.First(module => module.Slot == "MediumHardpoint1")
    .Engineering; // BlueprintName, Level 5, Quality 1 and Modifiers
```

[PreEngineeredStats](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.PreEngineeredStats) resolves the same record for
callers working with plain module data: `Resolve` for the fitted stats, `Modifiers` and
`JournalModifiers` for the two modifier readings, and `Identify` to recognise a fixed
article a capture named. The catalogue binds each `Decorative_*` identity to the only
module observed carrying it, preventing unsupported festive variants of unrelated weapons.

For a module symbol that has Mercenary variants, `AvailableBlueprints` appends every
bespoke Mercenary upgrade recipe after the ordinary menu and marks it `Route`
`BlueprintRoute.Mercenary`. Stock and Mercenary articles share a symbol, but each bespoke
blueprint is available only to its corresponding purchase. A fitted module carrying that
blueprint is therefore identified as the Mercenary article at its purchase grade or after a
later upgrade; its variant retains the original grade and Merc Coin price.

## The three accommodations

The gate makes exactly three allowances beyond the menu. They are applied in a fixed order
— journal spelling, then the pre-engineered route, then the generic spelling — and only the
first can change *which* recipe an accepted identifier names.

**The journal spelling of a menu entry.** Where the game writes one `BlueprintName` for two
different recipes, [BlueprintJournal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BlueprintJournal) reads that
identifier against the fitted module's menu and resolves it to the entry the menu lists:
`Sensor_LongRange` on a utility scanner becomes `Scanner_LongRange`, and
`Weapon_Overcharged` on a multi-cannon becomes `MC_Overcharged`. The map is pinned data in
`data/ships/blueprint-journal-names.jsonc`, not inference, because unlike the generic
spellings the two identifiers do not describe the same modification.

**The generic spelling.** Where a modification applies to several families, the game writes
a family-specific identifier and the catalogue lists that one — but a build authored
elsewhere may carry the generic `Misc_*` identifier. Both are accepted, because both name
the same recipe: their grades touch the same labels by the same methods.

The alias is **directional**, and that is what keeps it safe. A generic identifier stands
in for a family's identifier, never for another generic one. `Misc_ChaffCapacity` and
`Misc_HeatSinkCapacity` are both "Ammo capacity" over the same three labels, but they roll
different amounts of different ammunition, so neither may substitute for the other.

**The Mercenary route.** The Mercenary catalogue records describe modules bought already
engineered at grade 1, so no ordinary menu lists their bespoke recipes and the menu check
alone would refuse all of them everywhere. The pre-engineered catalogue names which module
each arrives on, and the gate accepts that bespoke recipe on the module sold carrying it
and nowhere else — `RailGun_LongShot` resolves on the medium rail gun, not on the small
one. A community-goal or tech-broker reward does not open the same route merely because its
record names an ordinary blueprint: that identifier identifies the fixed article.

This route covers the **climb, not the purchase**. A Mercenary module arrives at grade 1 and
its recipe publishes grades 2–5, the grades an engineer can still add; the grade it was sold
at cannot be reproduced through this route.

## What a roll costs

**Costs are a separate catalogue from mechanics**, so one can be priced without the other:
[BlueprintCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BlueprintCatalogue) answers what a recipe
*does*; [BlueprintCosts](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BlueprintCosts) answers what it *takes*.
`BuildMetrics` reads both, because it prices a whole fit — see
[Pricing a whole build](#pricing-a-whole-build).

```csharp
using EliteDangerousAlmanac.Ships;

Blueprint? mechanics = BlueprintCatalogue.Find("FSD_LongRange");    // every grade's features
BlueprintCost? climb = BlueprintCosts.FindClimbCost("FSD_LongRange", 5);    // grades 1–5
BlueprintCost? last = BlueprintCosts.FindClimbCost("FSD_LongRange", 5, 4);  // grade 5 alone
```

A grade costs its recipe once per roll and grade *g* takes *g* rolls, so the climb is
weighted rather than a plain sum — which is what `FindClimbCost` folds in for you.
`FindGradeCost` answers one grade's own recipe, unweighted.

A cost is **both halves of the bill**: the `Materials` consumed and the `MercCoins` charged
beside them. A recipe that bills Merc Coin bills it per roll, under the same weighting;
every other recipe reports `0`, which is a real amount rather than a missing one. `null` is
reserved for "not catalogued", so it never has to be untangled from "charges nothing".

Most of those are the bespoke Mercenary recipes, which start at grade 2 because the article
was bought at grade 1, but some are ordinary menu recipes on stock modules, so do not read
a Merc Coin charge as meaning a Mercenary article:

```csharp
using EliteDangerousAlmanac.Ships;

// A Mercenary article: bought at grade 1, so price the climb from there.
int? merc = BlueprintCosts.FindClimbCost("RailGun_LongShot", 5, 1)?.MercCoins; // 415
// An ordinary menu recipe on a stock fuel scoop: the whole climb, grades 1–5.
int? scoop = BlueprintCosts.FindClimbCost("FuelScoop_Efficiency", 5)?.MercCoins; // 350
// A recipe that charges no currency at all.
int? drive = BlueprintCosts.FindClimbCost("FSD_LongRange", 5)?.MercCoins; // 0
```

An experimental effect is a separate single application, from its own catalogue again. It
costs materials alone, so only that half needs folding — `Engineering.SumMaterials` does
it:

```csharp
using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

IReadOnlyList<EngineeringMaterial> grand = Engineering.SumMaterials(
    BlueprintCosts.FindClimbCost("Weapon_LongRange", 5)?.Materials ?? Array.Empty<EngineeringMaterial>(),
    ExperimentalEffectCosts.Find("special_focused") ?? Array.Empty<EngineeringMaterial>());
```

The blueprint's `MercCoins` therefore stands as the whole currency bill for an upgrade.

Pricing the remaining upgrade on a module bought pre-engineered is `FindClimbCost` again,
with the grade it arrived at as the third argument. On a **reward** variant it is not:
those carry hand-set overrides no blueprint grants, so the ordinary material recipe prices
ordinary engineering rather than the reward.

## Pricing a whole build

`BuildMetrics.BuildCost` does the same folding for every module a build carries, including
the Merc Coin charged by ordinary engineering-menu recipes, and prices the hull and modules
in credits beside it:

```csharp
using System.Linq;
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.Default("Anaconda");
build.ApplyBlueprint("FrameShiftDrive", "FSD_LongRange", new ApplyBlueprintOptions(Grade: 5));

BuildCost cost = BuildMetrics.Of(build).BuildCost();
double total = cost.Credits.Total;   // 146978572
double rebuy = cost.Credits.Rebuy;   // 7348928
int arsenic = cost.Materials.First(material => material.Symbol == "Arsenic").Count; // 5
int coins = cost.MercCoins;          // 0
```

It charges only what a player still has to pay. A Mercenary article arrives at the grade it
was sold at, so its climb is priced from there and an effect it came with is free; a reward
article was never rolled from the recipe it names, so it costs no materials at all.

## Next

- [Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Build-metrics)
  — what these modifiers do to power, shields, armour, weapons and range.
- [Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Building-an-outfitting-screen)
- [Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Reading-a-player-journal)
- [API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)
