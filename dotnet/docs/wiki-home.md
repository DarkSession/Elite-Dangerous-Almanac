[Elite Dangerous Almanac](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/Home) / .NET

# EliteDangerousAlmanac

Static Elite Dangerous data and calculations for .NET applications — procedural system
names and system addresses, galactic regions and nebulae, ships and outfitting with build
metrics, personal equipment and engineering materials, localized display text, and market
commodities.

The package is not on NuGet yet, so it is built from the repository:

```bash
cd dotnet
dotnet pack src/EliteDangerousAlmanac/EliteDangerousAlmanac.csproj --configuration Release
```

It targets .NET Standard 2.1, so it runs on .NET 10, on .NET Core 3.0 and above, and on
Mono 6.4 and above. It takes one direct dependency, `System.Text.Json`, and it carries the
shared catalogues inside the assembly.

```csharp
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Ships;

ProceduralSystem? system = ProceduralSystem.FromName("Synuefai XU-M d8-79");
ulong address = system!.SystemAddress;

ShipLoadout build = ShipLoadout.Default("Anaconda");
BuildMetrics metrics = BuildMetrics.Of(build);
JumpRangeSummary jump = metrics.JumpRangeSummary();
```

## Guides

- **[Getting started](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Getting-started)**
  — install, the namespaces, how a catalogue loads, and the first calls in each area.
- **[Reading a player journal](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Reading-a-player-journal)**
  — turning `Loadout`, `SuitLoadout`, `FSDJump` and `Scan` events into library objects.
- **[Building an outfitting screen](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Building-an-outfitting-screen)**
  — mounts, what fits, fitting it, and every metric a shipyard shows.
- **[Build metrics](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Build-metrics)**
  — how power, shields, armour, weapons, ammunition and range are computed.
- **[Engineering](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Engineering)**
  — what a recipe may go on, what it rolls, and what a roll costs.
- **[Working with SLEF](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Working-with-SLEF)**
  — reading and writing loadout exports, and retail against captured credits.
- **[Systems and regions](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.Systems-and-regions)**
  — the `id64` round trip, both coordinate spaces, and the four meanings of "region".
- **[The failure model](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Document.The-failure-model)**
  — `null` against the exceptions, and `CalculationResult<T>` for a build a metric cannot
  measure.

## The namespaces

Every area is one namespace under `EliteDangerousAlmanac`.

| Namespace | Provides |
| --- | --- |
| [Astronomy](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Astronomy) | Procedural system names, system addresses, sectors, galactic regions, nebulae, permit locks and the physics of a scanned body |
| [Ships](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Ships) | Hulls, modules, builds, SLEF, engineering, jump range, power, shields, armour and weapon figures |
| [Equipment](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Equipment) | Odyssey suits, handheld weapons, suit tools, grade upgrades, engineer modifications and the suit a journal reports |
| [Localization](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Localization) | Display names and descriptions for modules, blueprints, effects, materials, micro resources, commodities and personal equipment |
| [Materials](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Materials) | Ship engineering materials and Odyssey micro resources |
| [Commodities](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Commodities) | Market commodities, standard and rare |

**[Browse the complete API reference](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.API)**
— every namespace, type and member, generated from the source documentation.

## Ship assets

The repository holds a gunsight, an illustration and two schematics for every catalogued
hull, under `assets/ships/<symbol>/`, where the symbol is the one the ships catalogue
answers with. They are not in the package, which would take it from a few megabytes to
tens of them for files no call reads. Copy them from the
[repository](https://github.com/DarkSession/Elite-Dangerous-Almanac/tree/main/assets/ships).

## Licensing

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review
[LICENSE](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/LICENSE) and
[ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md)
before redistribution or commercial use.
