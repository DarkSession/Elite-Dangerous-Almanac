[Elite Dangerous Almanac](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/Home) / .NET

# EliteDangerousAlmanac

Static Elite Dangerous data and calculations for .NET applications — procedural system
names and system addresses, galactic regions and nebulae, ships and outfitting with build
metrics, personal equipment and engineering materials, localized display text, market
commodities, and the galaxy map's location markers.

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

- **[Getting started](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.Getting-started)**
  — install, the namespaces, how a catalogue loads, and the first calls in each area.
- **[Reading a player journal](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.Reading-a-player-journal)**
  — turning `Loadout`, `SuitLoadout`, `FSDJump` and `Scan` events into library objects.
- **[Building an outfitting screen](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.Building-an-outfitting-screen)**
  — mounts, what fits, fitting it, and every metric a shipyard shows.
- **[Build metrics](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.Build-metrics)**
  — how power, shields, armour, weapons, ammunition and range are computed.
- **[Engineering](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.Engineering)**
  — what a recipe may go on, what it rolls, and what a roll costs.
- **[Working with SLEF](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.Working-with-SLEF)**
  — reading and writing loadout exports, and retail against captured credits.
- **[Systems and regions](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.Systems-and-regions)**
  — the `id64` round trip, both coordinate spaces, and the four meanings of "region".
- **[The failure model](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Document.The-failure-model)**
  — `null` against the exceptions, and `CalculationResult<T>` for a build a metric cannot
  measure.

## The namespaces

Every area is one namespace under `EliteDangerousAlmanac`.

| Namespace | Provides |
| --- | --- |
| [Astronomy](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Astronomy) | Procedural system names, system addresses, sectors, galactic regions, nebulae, permit locks and the physics of a scanned body |
| [Ships](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Ships) | Hulls, modules, builds, SLEF, engineering, jump range, power, shields, armour and weapon figures |
| [Equipment](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Equipment) | Odyssey suits, handheld weapons, suit tools, grade upgrades, engineer modifications and the suit a journal reports |
| [Localization](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Localization) | Display names and descriptions for modules, blueprints, effects, materials, micro resources, commodities and personal equipment |
| [Materials](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Materials) | Ship engineering materials and Odyssey micro resources |
| [Commodities](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.Commodities) | Market commodities, standard and rare |
| [GalaxyMap](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.GalaxyMap) | The galaxy map's location markers and the colours the game draws them in |

**[Browse the complete API reference](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/DotNet.API)**
— every namespace, type and member, generated from the source documentation.

## Ship assets

The repository holds a gunsight, an illustration and two schematics for every catalogued
hull, under `assets/ships/<symbol>/`, where the symbol is the one the ships catalogue
answers with. They are not in the package, which would take it from a few megabytes to
tens of them for files no call reads. Copy them from the
[repository](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/tree/main/assets/ships).

## Galaxy-map marker assets

The package carries one SVG per galaxy-map marker, at `assets/galaxy-map/<symbol>.svg`,
where the symbol is the one `GalaxyMapMarkerCatalogue` answers with. NuGet extracts them
to `~/.nuget/packages/elitedangerousalmanac/<version>/assets/galaxy-map/`.
A `PackageReference` does not copy them into your build, so copy the ones you draw into
your application's own asset directory.

Every shape in an asset paints with `currentColor`, and the root `<svg>` carries the
marker's own colour. A host that embeds the file inline therefore recolours it with one
CSS `color` declaration, and one that loads it with `<img>` keeps the game's colour.
`front-line.svg` is the exception: its frame holds the frame colour as a literal, which
no `color` declaration reaches.

A marker is safe to embed inline as supplied: it holds only static `svg`, `title`,
`defs`, `mask`, `filter`, `feGaussianBlur`, `g`, `use`, `path`, `rect`, `circle` and
`ellipse` elements, and every `href`, `mask` and `filter` points inside the same file.
There are no scripts, styles, event-handler attributes, foreign or media elements,
links or external references. Every definition id is unique across the set, so a page
can inline all of them. This content guarantee applies to the unmodified package files.

## Licensing

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review
[LICENSE](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/blob/main/LICENSE) and
[ATTRIBUTIONS.md](https://github.com/Elite-Dangerous-Almanac/Almanac-Core/blob/main/ATTRIBUTIONS.md)
before redistribution or commercial use.
