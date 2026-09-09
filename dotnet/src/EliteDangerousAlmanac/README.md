# EliteDangerousAlmanac

Static Elite Dangerous data and calculations for .NET applications.

## Project status

**This library is a work in progress.** Until version 1.0, backwards compatibility is
not ensured and breaking changes are very likely: type names, signatures, namespaces and
data shapes can change in any release. Pin an exact version if your application needs a
stable surface, and read the release notes before upgrading.

## Install

The package is not on NuGet yet, so build it from the repository:

```bash
cd dotnet
dotnet pack src/EliteDangerousAlmanac/EliteDangerousAlmanac.csproj --configuration Release
```

`dotnet pack` writes `EliteDangerousAlmanac.<version>.nupkg` into
`src/EliteDangerousAlmanac/bin/Release/`. Add that directory as a package source to
reference it from your own project.

The package targets .NET Standard 2.1, so it runs on .NET 10, on .NET Core 3.0 and
above, and on Mono 6.4 and above. It takes one direct dependency, `System.Text.Json`.

The package carries game and community data under source-specific terms. Read
[LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) before you
redistribute it or use it commercially.

The
[.NET wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet)
carries the guides and the complete API reference: every namespace, type and member,
generated from the documentation comments in the C# source.

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

ProceduralSystem? system = ProceduralSystem.FromName("Synuefai XU-M d8-79");
ulong address = system!.SystemAddress;

// A journal event reports the address and the position together. Inside a hand-authored
// region the game shows that region's own name, and only the position identifies it.
ProceduralSystem named = ProceduralSystem.FromSystemAddress(
    address, new GalacticPosition(-80.625, -146.65625, -343.25));
string shown = named.Name; // "Pleiades Sector HR-W d1-79"
```

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

A build-state metric answers a `CalculationResult<T>`: the `BuildMetrics` methods whose
names end in `Result`. Each one carries either the figure or the reason the build
cannot be measured, such as a hull with no shield generator fitted.

Every other ship calculation answers a value. One that needs a part the build does not
carry raises `InvalidOperationException` instead, which is what a jump figure does on a
hull with no frame shift drive.

A body or star calculation answers `null` instead, because a scan states one line of
figures and a missing field has only one meaning: the scan did not write it.

A lookup answers `null` for a miss. An argument the call cannot use at all raises
`ArgumentNullException` or `ArgumentOutOfRangeException`, and wire data that cannot be
read raises `FormatException` or `JsonException`.

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
