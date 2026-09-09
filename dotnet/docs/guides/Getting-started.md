---
title: Getting started
---

[.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) / Getting started

# Getting started

The package is not on NuGet yet, so it is built from the repository:

```bash
cd dotnet
dotnet pack src/EliteDangerousAlmanac/EliteDangerousAlmanac.csproj --configuration Release
```

`dotnet pack` writes `EliteDangerousAlmanac.<version>.nupkg` into
`src/EliteDangerousAlmanac/bin/Release/`. Add that directory as a package source to
reference it from your own project.

The package targets .NET Standard 2.1, so it runs on .NET 10, on .NET Core 3.0 and above,
and on Mono 6.4 and above. It takes one direct dependency, `System.Text.Json`. The XML
documentation ships with it, so your editor shows the same guidance these pages do.

## One namespace per area

There is no root namespace to import: every area is its own namespace under
`EliteDangerousAlmanac`, and you `using` the ones you actually call.

| Namespace | Reads |
| --- | --- |
| [Astronomy](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy) | Procedural system names, system addresses, sectors, regions, nebulae, permit locks and the physics of a scanned body |
| [Ships](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships) | Hulls, modules, builds, engineering, jump range, power, shields, armour and weapon figures |
| [Equipment](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment) | Odyssey suits, handheld weapons, suit tools, grade upgrades, engineer modifications and the suit a journal reports |
| [Localization](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Localization) | Display names and descriptions for modules, blueprints, effects, materials, micro resources, commodities and equipment |
| [Materials](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Materials) | Ship engineering materials and Odyssey micro resources |
| [Commodities](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Commodities) | Market commodities, standard and rare |

**Why the names differ from the TypeScript package.** Each implementation is written the
way its own language reads, so `astro` is `Astronomy` here and `i18n` is `Localization`.
What the two share is the behaviour, which the fixtures under `fixtures/` prove for both.

## Nothing loads until you ask for it

.NET ships one assembly, so you cannot drop a namespace you do not call the way a bundler
drops a module. What you can avoid is the parsing and the memory: every catalogue sits
behind a lazily-loaded value that reads its shared data file the first time something asks
for it. A program that reads system names never parses the nebula catalogue.

Each catalogue is a process-wide value shared by every caller, and it is immutable — a
catalogue and every record inside it refuses a change — so one part of your application
cannot alter another part's answers.

## Read a system

```csharp
using EliteDangerousAlmanac.Astronomy;

ProceduralSystem? system = ProceduralSystem.FromName("Synuefai XU-M d8-79");
ulong address = system!.SystemAddress;

// A journal event reports the address and the position together. Inside a hand-authored
// region the game shows that region's own name, and only the position identifies it.
ProceduralSystem named = ProceduralSystem.FromSystemAddress(
    address, new GalacticPosition(-80.625, -146.65625, -343.25));
string shown = named.Name; // "Pleiades Sector HR-W d1-79"
```

A system the game named outright, such as Sol, carries no procedural name and never
reaches this type.

## Fit a ship

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.Default("Anaconda");
build.SetModule(
    "Slot01_Size7", ModuleCatalogue.FindBySymbol("Int_CargoRack_Size7_Class1")!);

BuildMetrics metrics = BuildMetrics.Of(build);
JumpRangeSummary jump = metrics.JumpRangeSummary();
double laden = jump.Laden;
```

A build can also start empty, or be read from a journal `Loadout` event or a SLEF export.
[ShipLoadout](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships.Class.ShipLoadout)
has the whole set.

## Read a suit

```csharp
using EliteDangerousAlmanac.Equipment;

Suit maverick = SuitCatalogue.FindByName("Maverick Suit")!;
SuitGrade? best = SuitCatalogue.Grade(maverick, 5);
```

## Look something up

Every catalogue lookup takes a name or a symbol in any casing, with any surrounding
whitespace, and answers `null` for one no record carries.

```csharp
using EliteDangerousAlmanac.Commodities;
using EliteDangerousAlmanac.Materials;

Commodity? gold = CommodityCatalogue.FindByName("  gold  ");
Material? resistors = MaterialCatalogue.FindBySymbol("gridresistors");
```

## Show it in the player's language

```csharp
using EliteDangerousAlmanac.Localization;

string? name = DisplayText.MaterialName("GridResistors", "de-DE");
```

English is complete; every other language is sparse, and a lookup answers `null` where the
pinned source carries no translation. That leaves the fallback policy yours to choose
rather than having one imposed on you.

## Where to go next

- [The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model)
  — `null`, the exceptions, and `CalculationResult<T>`.
- [API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)
  — every namespace, type and member.
- The
  [TypeScript guides](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/TypeScript)
  explain the domain itself — build metrics, engineering, SLEF, the four meanings of
  "region" — once, for both packages. Only their examples are in the other language.
