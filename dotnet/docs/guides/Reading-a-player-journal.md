---
title: Reading a player journal
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / Reading a player journal

# Reading a player journal

Elite Dangerous writes a newline-delimited JSON journal. Four of its events carry most of
what this library is for: `Loadout` describes the ship the commander is flying,
`SuitLoadout` (and `SwitchSuitLoadout`, and `CreateSuitLoadout`) describes the suit they
walk in, `FSDJump` (and `Location`, and `FSDTarget`) names the system they are in, and
`Scan` describes a body they have just resolved.

This guide turns all four into library objects, and covers what to do when the game hands
you something the catalogues do not recognise.

## Reading the journal

Each line is one event. Read it, parse it, and switch on `event`.

```csharp
using System.IO;
using System.Text.Json;

foreach (string line in File.ReadLines(journalPath))
{
    if (line.Trim().Length == 0) continue;

    using JsonDocument document = JsonDocument.Parse(line);
    string name = document.RootElement.GetProperty("event").GetString()!;

    switch (name)
    {
        case "Loadout":
            // → a ShipLoadout, below
            break;
        case "SuitLoadout":
        case "SwitchSuitLoadout":
        case "CreateSuitLoadout":
            // → a SuitLoadout, below
            break;
        case "FSDJump":
        case "Location":
            // → a ProceduralSystem, below
            break;
        case "Scan":
            // → a BodyScanEvent, below
            break;
    }
}
```

Every record the library reads from the wire carries the journal's own field names, so
`System.Text.Json` deserializes a line into one without a converter of your own.

## `Loadout` → a fitted ship

A bare journal `Loadout` event is one of the shapes
[Slef](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.Slef) accepts, so the line goes straight in.
`ShipLoadout.FromLoadout` takes the same event as a typed record, for a capture you
already read.

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.FromSlef(line);

string hull = build.ShipSymbol;  // "krait_light"
string? named = build.ShipName;  // "Jenny Longuet"
double mass = build.UnladenMass; // 388.830017, tonnes

BuildMetrics metrics = BuildMetrics.Of(build);
double jump = metrics.MaxJumpRange();               // 60.5478 ly, best single jump
bool powered = metrics.PowerBudget().WithinBudget;  // true
double armour = metrics.ArmourMetrics().HitPoints;  // 307.8

if (metrics.ShieldMetricsResult().TryGetValue(out ShieldMetrics shields))
{
    double strength = shields.Strength; // 743.12 MJ
}
```

Figures the event already stated — `UnladenMass`, `CargoCapacity`, `FuelCapacity` — are
trusted verbatim rather than recomputed, so what you read back matches what the player
sees in game — while the fit they describe survives import, which
[when the game hands you something unknown](#when-the-game-hands-you-something-unknown)
covers. `MaxJumpRange` is the exception either way: it is recomputed from the drive rather
than taken from the event, so it may differ in the last decimal places from the number the
capture carried.

### Walking the modules

`Slots` gives every mount on the hull, occupied or not. Mount keys come from the game and
are not derivable from position, so read them rather than composing them.

```csharp
using EliteDangerousAlmanac.Ships;

foreach (LoadoutSlot slot in build.Slots())
{
    string key = slot.Key;        // "FrameShiftDrive", "Slot01_Size6", "LargeHardpoint1", …
    string label = slot.Name;     // "Frame Shift Drive"
    string? fitted = slot.Module?.Symbol; // null when the mount is empty
}

int hardpoints = build.Slots(SlotKind.Hardpoint).Count; // 4
```

These views are snapshots, not live handles. After `SetModule` or `RemoveModule`, call
`Slots` again.

### What a capture paid, and what the build is worth

A journal's purchase figures remain separate from catalogue retail. For the source record,
export options and edit behaviour, see
[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Working-with-SLEF#credits-retail-against-what-a-capture-paid).

## `SuitLoadout` → a suit and its weapons

`SuitLoadout.Parse` takes the event as the game wrote it. The game writes the same payload
under three names — `SuitLoadout`, `SwitchSuitLoadout` and `CreateSuitLoadout` — so pass
any of the three.

```csharp
using System.Text.Json;
using EliteDangerousAlmanac.Equipment;

SuitLoadoutEvent captured = JsonSerializer.Deserialize<SuitLoadoutEvent>(line)!;
SuitLoadout loadout = SuitLoadout.Parse(captured);

string suit = loadout.Suit.Name; // "Dominator Suit"
int grade = loadout.Grade;       // 5
string? name = loadout.Name;     // "Double Trouble"

foreach (FittedPersonalWeapon fitted in loadout.Weapons)
{
    string mount = fitted.Mount;      // "PrimaryWeapon1", "PrimaryWeapon2", "SecondaryWeapon"
    string weapon = fitted.Weapon.Name; // "Karma L-6"
    double sustained = fitted.Metrics.SustainedDamagePerSecond; // what a long fight sees
}
```

A mount the event leaves empty holds no weapon, so read one by searching rather than by
position:

```csharp
using System.Linq;
using EliteDangerousAlmanac.Equipment;

string? secondary = loadout.Weapons
    .FirstOrDefault(fitted => fitted.Mount == "SecondaryWeapon")
    ?.Weapon.Name;
```

### What a modification changes

A loadout carries the recipes the game states, and the modifiers those recipes apply.
`PersonalEngineering.ApplyModifiers` folds them onto a catalogue base, one stat at a time,
naming the stat as a catalogue record spells it.

```csharp
using EliteDangerousAlmanac.Equipment;

double regeneration = PersonalEngineering.ApplyModifiers(
    "shieldRegeneration", loadout.Stats.ShieldRegeneration, loadout.Modifiers);

FittedPersonalWeapon fitted = loadout.Weapons[0];
double magazine = PersonalEngineering.ApplyModifiers(
    "magazineSize", fitted.Weapon.MagazineSize, fitted.Modifiers);
double reserve = PersonalEngineering.ApplyModifiers(
    "reserveAmmo", fitted.Weapon.ReserveAmmo, fitted.Modifiers);
```

A weapon's own list carries every modifier that acts on it, the suit's included: Extra
Ammo Capacity is fitted to the suit and multiplies a weapon's reserve ammunition, so the
line above is right whichever equipment carries the recipe. That is also why the two lists
are never joined: concatenating `loadout.Modifiers` and `fitted.Modifiers` multiplies such
a factor in twice, and reads 18 rounds where the weapon holds 12. Use the weapon's list
for a weapon stat, and the suit's for a suit or tool stat.

A recipe in `fitted.Modifications` need not appear in `fitted.Modifiers`. Reload Speed and
Scope carry no modifier because their whole effect is a second figure on the weapon
record, so they are reported as flags instead: `fitted.ReloadSpeed` selects the weapon's
upgraded reload time and `fitted.Scope` its upgraded magnification, and `fitted.Metrics`
already reads the reload. Stowed reloading carries none either — it switches a capability
on and moves no stat at all — and neither do Faster Handling, Stability and Improved Hip
Fire Accuracy, which change stats the catalogues hold no field for. None of those four
gets a flag: read `fitted.Modifications` to say what is on a weapon, and `fitted.Modifiers`
to compute what it does.

Greater Range, Headshot Damage and Improved Hip Fire Accuracy each carry a Kinetic, a
Laser and a Plasma recipe whose material costs differ, and the journal writes one symbol
for all three. The weapon at the mount settles which one, so each
[FittedPersonalModification](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment.Record.FittedPersonalModification)
reports both spellings: `JournalSymbol` as the event wrote it, and `Symbol` as the
modification and cost catalogues key it. Every symbol an event writes — a mount, a weapon,
a recipe — is matched with its case and surrounding whitespace ignored, and the loadout
reports the catalogue's own spelling.

## `FSDJump` → a system

`StarSystem` and `SystemAddress` come straight from the event.

```csharp
using EliteDangerousAlmanac.Astronomy;

ProceduralSystem? system = ProceduralSystem.FromName("Synuefe EN-H d11-96");
ulong? address = system?.SystemAddress;    // 3309179996515
string? region = system?.NamingRegionName; // "Synuefe"
```

`FromName` answers `null` rather than raising when the name is not procedural — which is
the normal case for Sol, Shinrarta Dezhra and every other hand-named system. Treat `null`
as "this is a hand-named system", not as a failure. A *missing* name is different: pass a
field that was not there and it raises `ArgumentNullException` naming the argument, so a
`StarSystem` your parser never found does not read back as a hand-named system.

An address is a `ulong` throughout, which is the range the game's own `id64` occupies. A
stored address that reaches you as text goes through `SystemAddress.Parse` or
`SystemAddress.TryParse` rather than through a conversion of your own.

### Where is it?

`FSDJump` carries `StarPos` as `[x, y, z]` light-years. Reshape it before use — the
library takes a
[GalacticPosition](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Record.GalacticPosition) so the two coordinate
spaces cannot be confused.

```csharp
using EliteDangerousAlmanac.Astronomy;

GalacticPosition position = new(starPos[0], starPos[1], starPos[2]);

// Answered here for StarPos [-81.625, -151.3125, -376.0625], in the Pleiades:
string? handAuthored = HandAuthoredRegions.FindAt(position)?.Name; // "Pleiades Sector"
string? codex = CodexRegionMap.FindAt(position)?.Name;             // "Inner Orion Spur"
string nearest = NebulaCatalogue.Nearest(position, NebulaCatalogue.Real, 1)[0].Name; // "Pleiades"
```

### Permit locks

Pass `StarSystem` to the permit-lock lookup described in
[Systems and regions](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Systems-and-regions#permit-locks).

## `Scan` → a body

There is nothing to convert.
[BodyScanEvent](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Record.BodyScanEvent) **is** the `Scan` event — the
journal's own field names, capitalisation and units — so a deserialized line is already
the right type.

```csharp
using System.Text.Json;
using EliteDangerousAlmanac.Astronomy;

BodyScanEvent scan = JsonSerializer.Deserialize<BodyScanEvent>(line)!;
string body = scan.BodyName;        // the body's in-game name
ulong id64 = scan.SystemAddress;    // passes straight to every address entry point
```

One line describes a star, a planet, a moon or a belt cluster, and which one it is shows
in which fields it carries: `StarType` for a star, `PlanetClass` for a planet or moon,
neither for a belt cluster. Almost everything else is optional for the same reason, so
treat a missing field as "not written for this body", never as a zero.

### Working out what it means

The calculations take a
[BodyProperties](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy.Record.BodyProperties) — the physical half of the
event, with none of the journal's bookkeeping required — and `BodyScanEvent` is one, so
the scan goes straight in, and so does a record you rebuilt from a database.

```csharp
using EliteDangerousAlmanac.Astronomy;

BodyProperties moon = new()
{
    MassEM = 0.0123,
    Radius = 1_737_400,
    SemiMajorAxis = 3.844e8,
    Eccentricity = 0.0549,
};

double? density = BodyPhysics.BulkDensity(moon);        // 3343.7…, kg/m³
double? closest = BodyOrbit.Extents(moon)?.Periapsis;   // 363296440 m, its closest approach
NeutronStarClass? star = StarPhysics.ClassifyNeutronStar(moon); // null, not a neutron star

SpinOrbitResonance? locked = BodyOrbit.Resonance(new BodyProperties
{
    RotationPeriod = 2_360_591.5,
    OrbitalPeriod = 2_360_591.5,
}); // Rotations 1, Orbits 1 — tidally locked
```

Every unit is the journal's: metres, seconds, kilograms, kelvin, pascals. They are not the
units the game's own UI shows — surface gravity is m/s² rather than g, pressure is pascals
rather than atmospheres, and `AxialTilt` is the one angle in radians rather than degrees.

### A body and the one it orbits

A `Scan` names a body's parent only by `BodyID`, in its `Parents` chain, so a calculation
comparing the two takes both. Keep the scans you have already read, keyed by
`SystemAddress` and `BodyID`, and look the parent up when one arrives:

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Astronomy;

// `bodies` holds the scans already read for this system, keyed by BodyID.
int? parentId = scan.Parents is { Count: > 0 } parents
    ? parents[0].Planet ?? parents[0].Star
    : null;

if (parentId is int id && bodies.TryGetValue(id, out BodyScanEvent primary))
{
    RocheLimits? limits = BodyPhysics.RocheLimits(scan, primary);
    double? periapsis = BodyOrbit.Extents(scan)?.Periapsis;

    // A breach is set by closest approach, not by the mean distance.
    bool breached = limits is not null && periapsis < limits.Rigid;

    double? reach = BodyPhysics.HillRadius(scan, primary); // how far its own gravity reaches
}
```

Every calculation answers `null` when the scan did not write what it needs, so an
`AutoScan` that resolved little says so rather than guessing.

## When the game hands you something unknown

Journals can contain hulls or modules absent from the catalogues. A direct lookup that
finds nothing answers `null` — check it. `ShipLoadout` applies a narrower rule at import.
An entry is kept as the event stated it when the catalogue identifies its `Item` and the
mount can hold it, when its mount is a known cosmetic or hull-geometry key (`PaintJob`,
`ShipCockpit`, a numbered decal, …), or when it is a `ModularCargoBayDoor*` article in the
cargo-hatch mount — some hull families name their own symbol for the one built-in article
the catalogue carries.

Everything else is normalized: an unknown hull is refused; unknown modules in hardpoints,
utilities, optional internals and unrecognised mounts are discarded; and a **stocked
mount** — armour, a core internal, the cargo hatch, the planetary approach suite — is
filled with that hull's stock article whenever the event did not leave a fitting one there
— one the catalogues cannot resolve, one the mount cannot hold (a cargo rack in `Armour`,
a size-8 plant in a size-2 mount, anything at all in the cargo hatch), or none at all.
Only those four kinds are corrected this way: every other optional, hardpoint or utility
mount may stand empty, so an article the catalogue resolves but the mount refuses is left
where the event put it, for validation to report. A stock replacement carries the source's
`On`, `Priority` and `Health` across but none of its engineering or captured value.

The approach suite is on that list because a source silent about it is not a build that
sold one. Every hull leaves the shipyard carrying the advanced suite, which is weightless
and draws no power, so no build gains by shedding it — and an exporter that models no such
mount, as Inara does not, writes no entry for it either. So an event that names none
imports carrying the hull's own `Int_PlanetApproachSuite_Advanced`, reported as a
[ModuleDefaulted](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.ModuleDefaulted) like any other stocked mount.
Unlike armour and the core internals it stays removable, so a build that really does fly
without one is a `RemoveModule` away.

When normalization changes the fitted set, the capture's aggregates are dropped: mass,
cargo and fuel capacity are recomputed from the fit that remains, while `ModulesValue` and
`Rebuy` answer `null`, since nothing records what the discarded module cost;
`SourcePurchase` still reports the captured figures. A bulkhead, cargo hatch or approach
suite stocked from *absence* is the exception and leaves the totals standing, while an
absent core internal stocked from the defaults invalidates them like any other change.
[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Working-with-SLEF#credits-retail-against-what-a-capture-paid)
covers why, and what the captured figures are worth.

`Validation` therefore reports the fit that remains: optional, hardpoint and utility
modules leave empty mounts and need no diagnostic, while required armour and core mounts
remain complete through their stock replacements. `ImportOutcomes` is the read-only,
machine-readable account of each change, one record per mount:
[ModuleEmptied](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.ModuleEmptied) where an unresolvable article was
discarded and `ModuleDefaulted` where a stock one was fitted, each naming the source
symbol the capture gave and, for the second, the replacement. It also reports what the
import made of each module's stated engineering:
[EngineeringRerolled](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringRerolled), where a stated modifier
block moved no stat the module carries and the recipe beside it was rolled in its place;
[EngineeringUnresolved](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringUnresolved), for a module whose
source stated a recipe and no modifiers that neither a craftable recipe nor a catalogued
article answers to — that module alone keeps the figures of an unengineered one; and
[EngineeringAmbiguous](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Record.EngineeringAmbiguous), where such a block had
two legitimate readings and the roll was taken, carrying the catalogued article passed over
so you can fit it instead.

```csharp
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

IReadOnlyList<LoadoutIssue> issues = build.Validation().Issues; // problems in the normalized fit
FittedModule? optional = build.FittedModuleAt("Slot01_Size5"); // null if its symbol was unknown
IReadOnlyList<LoadoutImportOutcome> changes = build.ImportOutcomes; // for display or logging
```

[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model) sets the validation and
calculation patterns out in full.

A journal line is one `Loadout` event, and it is taken whole or refused. Bad JSON raises
`JsonException`, and a hull the catalogue does not carry raises `FormatException`, from
`FromSlef` and `FromLoadout` alike. A structurally impossible event — two mount keys
differing only in case, say — is refused by whichever reader meets it first:
`FromLoadout` raises `ArgumentException` for the duplicate, while `FromSlef` reads the
text through `Slef.Parse` and so raises `FormatException` with a `DuplicateSlot`
diagnostic. Catch them when the bytes come from somewhere you do not control. A SLEF *file* holds several builds and can be part-good, which is its own
question — [Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Working-with-SLEF) covers `Slef.Parse`
against `Slef.Inspect` and what each does with a bad entry.

A suit loadout follows the same two rules. The suit itself has to resolve, because the
grade, the mounts and every stat come from it, so an unknown `SuitName` raises
`FormatException` — as does a structurally impossible event, two mounts differing only in
case among them. Everything else the catalogues cannot answer is left out of the loadout
and reported by `loadout.ImportOutcomes`: an unknown weapon, an unusable `Class`, a
`SlotName` the suit does not carry and a weapon the mount refuses each leave that mount
without a weapon, while an unknown recipe and a recipe fitted to the other equipment — a
suit recipe under `WeaponMods`, or the reverse — are not applied. Each outcome names the
mount the event wrote, or `null` for a modification on the suit itself.

## Next

- [Getting started](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Getting-started)
- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model)
- [API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)
