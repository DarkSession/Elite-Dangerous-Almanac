# EliteDangerousAlmanac

Static Elite Dangerous data and calculations for .NET applications.

## Project status

**This library is a work in progress.** Until version 1.0, backwards compatibility is
not ensured and breaking changes are very likely: type names, signatures, namespaces and
data shapes can change in any release. Pin an exact version if your application needs a
stable surface, and read the release notes before upgrading.

## Install

```bash
dotnet add package EliteDangerousAlmanac
```

The package targets .NET Standard 2.1, so it runs on .NET 10, on .NET Core 3.0 and
above, and on Mono 6.4 and above. It depends on `System.Text.Json` and nothing else.

The package carries game and community data under source-specific terms. Read
[LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) before you
redistribute it or use it commercially.

## Areas

Every area is one namespace under `EliteDangerousAlmanac`.

| Namespace      | Reads                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Astronomy`    | Procedural system names, system addresses, sectors, regions, nebulae, permit locks and the physics of a scanned body        |
| `Ships`        | Hulls, modules, builds, engineering, jump range, power, shields, armour and weapon figures                                  |
| `Equipment`    | Odyssey suits, handheld weapons, suit tools, grade upgrades, engineer modifications and the suit a journal reports          |
| `Localization` | Display names and descriptions for modules, blueprints, effects, materials, micro resources, commodities and equipment      |
| `Materials`    | Ship engineering materials and Odyssey micro resources                                                                     |
| `Commodities`  | Market commodities, standard and rare                                                                                      |

## Read a system

```csharp
using EliteDangerousAlmanac.Astronomy;

ProceduralSystem? system = ProceduralSystem.FromName("Synuefe EN-H d11-96");
ulong address = system!.SystemAddress;

// A journal event reports the address, and the position beside it names the region the
// game shows for a system inside a nebula.
ProceduralSystem again = ProceduralSystem.FromSystemAddress(
    address, new GalacticPosition(751, -179, -91));
```

## Fit a ship

```csharp
using EliteDangerousAlmanac.Ships;

ShipLoadout build = ShipLoadout.Default("Anaconda");
build.SetModule("Slot01_Size7", ModuleCatalogue.FindBySymbol("Int_CargoRack_Size7_Class1")!);

BuildMetrics metrics = BuildMetrics.Of(build);
JumpRangeSummary jump = metrics.JumpRangeSummary();
double laden = jump.Laden;
```

## Read a suit

```csharp
using EliteDangerousAlmanac.Equipment;

Suit maverick = SuitCatalogue.FindByName("Maverick Suit")!;
SuitGrade? best = SuitCatalogue.Grade(maverick, 5);
```

## Catalogues

Every catalogue loads from its shared data file on first use, and stays loaded. Each one
is a process-wide value shared by every caller, so a catalogue and every record inside it
refuses a change. A lookup takes a name or a symbol in any casing, with any surrounding
whitespace, and answers `null` for one no record carries.

## How a calculation answers

A calculation that reads figures a build or a scan may not state answers a
`CalculationResult<T>`, which carries either the figure or the reason it cannot be
worked out. A lookup answers `null` for a miss. An argument the call cannot use at all
raises `ArgumentNullException` or `ArgumentOutOfRangeException`, and wire data that
cannot be read raises `FormatException` or `JsonException`.

## Ship assets

The repository holds a gunsight, an illustration and two schematics for every catalogued
hull, under `assets/ships/<symbol>/`, where the symbol is the one the ships catalogue
answers with. They are not in this package, which would take it from a few megabytes to
tens of them for files no call reads. Copy them from the
[repository](https://github.com/DarkSession/Elite-Dangerous-Almanac/tree/main/assets/ships).

## Data provenance

[ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md)
names every source once, with its licence terms. Each data file names its own source in
a comment header. The code and the documentation are under the MIT licence. The game and
third-party data keeps its own terms, and the MIT licence does not extend to it.
