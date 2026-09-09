---
title: Building an outfitting screen
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / Building an outfitting screen

# Building an outfitting screen

Everything a shipyard screen shows, end to end: enumerate the hull's mounts, offer only
what fits, fit it, and report what the build now does. All of it hangs off
[ShipLoadout](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ShipLoadout).

## Start from a hull, or from a capture

```csharp
using EliteDangerousAlmanac.Ships;

// A hull on its stock bulkhead, core internals and cargo hatch, nothing else fitted…
ShipLoadout fresh = ShipLoadout.Empty("Anaconda");

// …or the build a commander is already flying.
ShipLoadout owned = ShipLoadout.FromLoadout(captured);
```

`ShipLoadout.Default` is the third start: the hull as the shipyard sells it, with a stock
article in every mount that ships filled.

## Enumerate the mounts

`Slots` answers every mount on the hull, occupied or not, in layout order. Pass a kind to
narrow it.

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.Empty("Anaconda");

int all = build.Slots().Count;                       // 39
int optional = build.Slots(SlotKind.Optional).Count; // 14
int hardpoints = build.Slots(SlotKind.Hardpoint).Count; // 8

LoadoutSlot slot = build.Slots(SlotKind.Optional)[0];
string key = slot.Key;              // the identifier every mutation takes
string label = slot.Name;           // the label to render
int size = slot.Size;               // the class of module it accepts
FittedModule? held = slot.Module;   // null while the mount is empty
```

**Mount keys come from the game and are not derivable from position.** Frontier writes
`FrameShiftDrive`, `Slot01_Size6`, `HugeHardpoint1`; a SLEF producer may lower-case them.
Read the key rather than composing one — matching is case-insensitive either way.

The views are snapshots. After an edit, call `Slots` again rather than re-reading a value
you captured earlier.

## Offer only what fits

`ModulesForSlot` filters the complete module catalogue down to the modules that mount will
actually accept, by size and by restriction.

```csharp
using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.Empty("Anaconda");

// Every drive that fits, largest class included.
IReadOnlyList<OutfittingModule> drives = build.ModulesForSlot("FrameShiftDrive");

IEnumerable<OutfittingModule> racks = build
    .ModulesForSlot("Slot01_Size7")
    .Where(module => module.FamilyId == OutfittingFamilyId.CargoRacks);
```

The method searches the whole module catalogue because some mounts accept modules from
more than one outfitting category: a fuel tank is a core module that also fits optional
mounts. `ShipLoadout` already carries the complete catalogue for whole-build operations.

What it never offers is the `GrantOnly` articles — the starter `*_free` fittings and the
bundle-granted Vessel Hangars — because each is a second identity for a module the game
already sells. Offer them and the thruster list shows "2E Thrusters" twice, the second one
unpriced. A build that arrived carrying one keeps it, and `ModuleCatalogue.FindBySymbol`
still resolves it; only the choices are filtered.

The Cargo Hatch is left out for a different reason: it is a built-in hull module. The
source registry files it with the optional internals, which is where
`ModuleCatalogue.Internal` carries it, but the hull is built with one and the fixed
`CargoHatch` mount is the only place it goes — so no mount your screen can edit offers or
accepts it. Fitting one anywhere else raises a
[LoadoutEditException](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.LoadoutEditException) whose `Constraint` is
`ModuleFitConstraint.BuiltInHullModule`.

## Group the offer into collapsible families

Every module carries a `FamilyId`, core modules included, so the whole result of
`ModulesForSlot` groups without a taxonomy of your own. Related variants share one family:
Bi-Weave and Prismatic generators are all `ShieldGenerators`, and a pre-engineered or
Powerplay weapon stays with its base weapon.

[OutfittingFamilies](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.OutfittingFamilies) gives the canonical English
heading for a family, as an extension method on the id itself.

```csharp
using System.Linq;
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.Empty("Anaconda");

foreach (IGrouping<OutfittingFamilyId, OutfittingModule> family in
    build.ModulesForSlot("Slot01_Size7").GroupBy(module => module.FamilyId))
{
    string heading = family.Key.DisplayName(); // "Shield Generators"
    int offered = family.Count();
}
```

[DisplayText](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Localization.Class.DisplayText) gives a localized heading, keyed
by the family's identifier as the shared data spells it. It answers `null` where the
sources carry no label for that locale, so your application chooses the fallback rather
than being handed English dressed up as a translation.

```csharp
using EliteDangerousAlmanac.Localization;
using EliteDangerousAlmanac.Ships;

string shields = DisplayText.OutfittingFamilyName("shieldGenerators", "de")
    ?? OutfittingFamilyId.ShieldGenerators.DisplayName(); // "Schildgeneratoren"

string xeno = DisplayText.OutfittingFamilyName("xenoScanners", "de")
    ?? OutfittingFamilyId.XenoScanners.DisplayName(); // "Xeno Scanners", the fallback
```

A family is the heading, not the whole label: one family can hold two product lines the
game sells side by side. The `Fsd` family holds both drive lines, and which one a record
belongs to is a field on it rather than something to recover from its symbol:

```csharp
using System.Linq;
using EliteDangerousAlmanac.Ships;

var drives = ModuleCatalogue.Core
    .Where(module => module.Slot == ModuleSlot.FrameShiftDrive)
    .ToList();

bool sco = drives.Any(module => module.SupercruiseOvercharge);   // true, the SCO line
bool ordinary = drives.Any(module => !module.SupercruiseOvercharge); // true, the other
```

## Fit, remove, engineer

Mutations answer the build itself, so they chain. The build is mutable — this is the one
place in the library that is.

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.Empty("Anaconda");
OutfittingModule fsd = ModuleCatalogue.FindBySymbol("Int_Hyperdrive_Size6_Class5")!;

build
    .SetModule("FrameShiftDrive", fsd)
    .ApplyBlueprint("FrameShiftDrive", "FSD_LongRange", new ApplyBlueprintOptions(
        Grade: 5,
        ExperimentalEffectSymbol: "special_fsd_heavy"));

build.RemoveModule("Slot01_Size7");
build.SetModuleEnabled("FrameShiftDrive", true);
build.SetModulePriority("FrameShiftDrive", 1);
```

`AvailableBlueprints` answers candidate engineering routes for the fitted module symbol. A
candidate's `Route` is `BlueprintRoute.Ordinary` when the stock module can take it or
`BlueprintRoute.Mercenary` when it requires the matching Mercenary purchase. Stock and
Mercenary articles share a module symbol, so show that route in the UI and confirm the
purchase before treating a Mercenary candidate as applicable.
`AvailableExperimentalEffects` answers the stock module's ordinary experimental menu.

## Report what the build does

Each metric is one call on a [BuildMetrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.BuildMetrics) attached
to the build with `BuildMetrics.Of(build)`. The figures below are one build's — a Federal
Corvette.

```csharp
using EliteDangerousAlmanac.Ships;

PowerBudget power = metrics.PowerBudget();
double available = power.Available; // 50.4    MW the plant makes
double deployed = power.Deployed;   // 46.8597 MW drawn, hardpoints out
bool fits = power.WithinBudget;     // true
int groups = power.Bands.Count;     // 5       the five priority groups

double armour = metrics.ArmourMetrics().HitPoints; // 5062.6

metrics.ShieldMetricsResult().TryGetValue(out ShieldMetrics shields);
double strength = shields.Strength;            // 3940.4 MJ
double bare = shields.Resistances.Kinetic;     // the generator and boosters, no pips

metrics.ShieldCapacitorMetricsResult().TryGetValue(out ShieldCapacitorMetrics sys);
double piped = sys.EffectiveResistances.Kinetic; // with four pips to SYS

BuildWeaponMetrics weapons = metrics.WeaponMetrics();
double dps = weapons.Total.DamagePerSecond;             // 137.04
double sustained = weapons.Total.SustainedDamagePerSecond; // 133.98
int fittedWeapons = weapons.Weapons.Count;              // 7
```

Jump range comes in the loads that matter, so a screen does not have to compute them:

```csharp
using EliteDangerousAlmanac.Ships;

JumpRangeSummary jumps = metrics.JumpRangeSummary();
double best = jumps.Max;                    // one jump's fuel, empty hold
double unladen = jumps.Unladen;             // full tank, empty hold
double laden = jumps.Laden;                 // full tank, full hold
double bestTotal = jumps.TotalMax.Range;    // the same best jump as a one-jump total
int bestJumps = jumps.TotalMax.Jumps;       // one jump when the build carries fuel
double onATank = jumps.TotalUnladen.Range;  // every jump on one tank, empty
int tankJumps = jumps.TotalUnladen.Jumps;   // number of jumps on that tank
double ladenTank = jumps.TotalLaden.Range;  // every jump on one tank, full
```

Mass and mobility come as figures rather than as ingredients, so the panel's mass line and
its speed line are both one call:

```csharp
using EliteDangerousAlmanac.Ships;

BuildMass mass = metrics.BuildMass();
double hull = mass.Hull;       // the bare hull, in tonnes
double modules = mass.Modules; // every fitted module, post-engineering
double total = mass.Total;     // with a full main tank and an empty hold

metrics.MobilityMetricsResult().TryGetValue(out MobilityMetrics mobility);
double speed = mobility.Speed;      // m/s, at four ENG pips
double loaded = mobility.LoadedMass; // the mass that speed was calculated at

metrics.MobilityCapacitorMetricsResult(enginesPips: 2)
    .TryGetValue(out MobilityCapacitorMetrics atTwo);
double slower = atTwo.Speed; // m/s, at two

double? rated = metrics.Thrusters()?.OptMass; // rated performance at or below this mass
double? ceiling = metrics.Thrusters()?.MaxMass; // past this the ship does not move at all
```

The three capacity lines sit on the build itself rather than on `BuildMetrics`, because
each is a property of what is fitted, not a calculation over it:

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout liner = ShipLoadout.Default("Orca");

double cargo = liner.CargoCapacity;      // 24  tonnes, summed over the fitted racks
double berths = liner.PassengerCapacity; // 40  berths, summed over the fitted cabins
double fuel = liner.FuelCapacity.Main;   // 32  tonnes the drive can burn
```

`CargoCapacity` and `FuelCapacity` prefer a capture's own figure where it has one;
`PassengerCapacity` is always the sum, because no capture states a passenger figure.

A passenger panel usually wants the split by class as well as the total, and no stat field
carries the class: group on the `_Class1`–`_Class4` suffix of each cabin's `Symbol`, which
is economy, business, first and luxury on both cabin lines (the Mk II line stops at
business). Do not group on `Rating` — the Mk II cabins run one rating better than the Mk I
cabins of the same class, so `D` is economy on one line and business on the other.

The game's statistics panel counts the reserve tank in the current mass it displays;
nothing here does, so add `FuelCapacity.Reserve` if you are reproducing that reading.
[Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Build-metrics) covers the mass curve those three
thruster figures describe.

`PowerBudget().Bands` is what drives a priority-group table: a group is powered when its
running total — its own draw plus every higher-priority group's — fits in `Available`.

## Tell the user what is wrong

Two different questions, deliberately kept apart:

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

LoadoutValidation validation = build.Validation();
bool legal = validation.Valid;      // is the fit structurally legal?
bool ready = validation.Complete;   // legal *and* every operational mount filled
IReadOnlyList<LoadoutIssue> issues = validation.Issues; // what, with a stable code each
```

Branch on each issue's `Code`, not on its `Severity` — the codes are the stable contract,
and one severity covers problems that belong in different places on the panel.
[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model) explains the codes and covers the
`…Result` methods for mobility, shields and shield recovery. On an imported build, read
`ImportOutcomes` alongside the issues: validation says nothing about normalization, so an
empty mount on your panel may be one the player left empty or one import emptied for them.

Two things follow for the panel itself. **An issue's `Slot` is not a promise that the mount
exists**, so drive the placement off your own layout rather than off the code: look the key
up among the slots you are rendering, mark it there if it resolves, and fall through to an
off-panel list if it does not. That list is not an edge case —
`LoadoutIssueCode.UnknownSlot` carries a key that is by definition no mount on this hull.
And on a build, `Complete` tracks `Valid`: every build fills its core and armour mounts, so
the `MissingRequiredSlot` half of the question only reaches you when you validate a list of
your own.

One issue on this panel is not about where a module went:
`LoadoutIssueCode.ThrusterMassExceeded` says the thrusters the player just picked are rated
below what the ship now weighs, and above that rating the mass curve gives nothing back, so
the ship does not move at all. It is the one code that carries figures — `Mass` and
`MaxMass`, in tonnes, on the issue itself — so mark the thruster mount with them rather than
with the generic message. Reach for it when a swap elsewhere on the panel adds mass too: a
heavier module in an optional mount can invalidate a thruster choice the player made ten
edits ago, and re-reading `Validation` after every edit is what surfaces that.

It also carries `Load`, naming which of the ship's three loads the rating failed at —
`ThrusterLoad.Dry`, `ThrusterLoad.Unladen` (a full main tank) or `ThrusterLoad.Laden` (a
full hold as well). The first two are errors, and the third is the panel's one
`LoadoutIssueSeverity.Warning`: a hauler that only outgrows its thrusters with the hold
full is still a legal build, so it stays valid and complete and reaches you through
`Issues` alone. Put that one beside the cargo figure rather than on the thruster mount —
the fix is usually to carry less, not to refit.

## Next

- [Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Working-with-SLEF)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model)
- [API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)
