# Elite Dangerous Almanac

Static Elite Dangerous data and calculations for community applications and research.
The repository provides an ESM TypeScript package and a .NET package, both backed by the
same shared JSONC data, fixtures and JSON Schemas.

## Project status

**This library is a work in progress.** Until version 1.0, backwards compatibility is
not ensured and breaking changes are very likely: exported names, signatures, module
paths, namespaces and data shapes can change in any release. Pin an exact version if
your application needs a stable surface, and read the release notes before upgrading.

The two packages do not carry the same names: each one is written the way its own
language reads. What they share is the behaviour, which the fixtures under `fixtures/`
prove for each of them.

## Feature areas

Both packages carry every one. The table names each area by its TypeScript subpath and
by its .NET namespace.

| Area          | .NET namespace | Provides                                                                                                                                                         |
| ------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `astro`       | `Astronomy`    | Procedural system names, id64 addresses, sectors, regions, nebulae, permit locks and scanned-body physics                                                        |
| `ships`       | `Ships`        | Hulls, modules, loadouts, SLEF, engineering, jump range, power, shields, armour and weapon metrics                                                               |
| `equipment`   | `Equipment`    | Odyssey personal suits, handheld weapons and their damage per second, suit tools, grade upgrades, engineer modifications and journal suit loadouts               |
| `i18n`        | `Localization` | Sparse localized names and descriptions for modules, blueprints, effects, materials, micro resources, commodities, personal equipment and galactic codex regions |
| `materials`   | `Materials`    | Ship engineering materials and Odyssey micro resources                                                                                                           |
| `commodities` | `Commodities`  | Standard and rare market commodities                                                                                                                             |

## TypeScript package

```bash
npm install @elite-dangerous-almanac/core
```

The package supports Node.js 22+ and modern browser bundlers. It is ESM-only and marks
every module as side-effect free.

See the [package README](typescript/README.md) for installation and import guidance,
the [Getting started guide](typescript/docs/guides/Getting-started.md) for first-use
examples, and the
[TypeScript wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/TypeScript)
for the guides and the complete API reference.

## .NET package

The package is not on NuGet yet, so build it from this repository:

```bash
cd dotnet
dotnet pack src/EliteDangerousAlmanac/EliteDangerousAlmanac.csproj --configuration Release
```

`dotnet pack` writes `EliteDangerousAlmanac.<version>.nupkg` into
`dotnet/src/EliteDangerousAlmanac/bin/Release/`. Add that directory as a package source
to reference it from your own project.

The package targets .NET Standard 2.1, so it runs on .NET 10, on .NET Core 3.0 and above,
and on Mono 6.4 and above. It takes one direct dependency, `System.Text.Json`, and it
carries the shared catalogues inside the assembly.

See the [package README](dotnet/src/EliteDangerousAlmanac/README.md) for the areas and
first-use examples, and the
[.NET wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet) for the
guides and the complete API reference. The XML documentation ships with the package, so
an editor shows the same guidance those pages do.

The ship assets are not in the package: they are a large body of SVG that no call reads.
Copy them from [`assets/ships/`](assets/ships) instead.

## Licensing of the bundled data

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review [LICENSE](LICENSE) and
[ATTRIBUTIONS.md](ATTRIBUTIONS.md) before redistribution or commercial use.

## Repository layout

```text
assets/      shared visual assets, keyed by catalogue symbol
data/        shared JSONC catalogues and per-domain provenance
fixtures/    shared JSONC behavioral fixtures, each carrying its own provenance
schemas/     shared JSON Schemas for catalogue payloads
docs/        the wiki's shared landing page
scripts/     repository-only data and wiki tooling
typescript/  @elite-dangerous-almanac/core
dotnet/      EliteDangerousAlmanac
```

`data/` is the single source of truth. Implementations strip comments while loading
JSONC; they do not generate or commit duplicate JSON files.

Ship gunsights, illustrations, and schematics live under `assets/ships/<symbol>/`, where
`<symbol>` is the exact Frontier ship symbol from the shared catalogue. The shared
directory is the single source of truth; the TypeScript build copies it into the npm
package under the same `assets/ships/` path.

## Development

### .NET

The SDK version comes from `dotnet/global.json`. Run .NET commands from `dotnet/`:

```bash
dotnet restore EliteDangerousAlmanac.slnx --locked-mode
dotnet build EliteDangerousAlmanac.slnx
dotnet build coverage.proj
```

`dotnet build` treats analyzer and code-style findings as errors, so it checks the source
as well as building it. `dotnet build coverage.proj` runs the test suite and fails under
the repository-wide coverage threshold.

### TypeScript

The package is managed with [pnpm](https://pnpm.io). Node 22 ships Corepack, which
installs the exact pnpm version pinned in `typescript/package.json`:

```bash
corepack enable pnpm
```

Run TypeScript commands from `typescript/`:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm run test:package
pnpm run docs
```

`pnpm run check` runs the fixture-schema and locale-coverage drift checks, linting,
formatting checks, type checking, documented-example compilation and value checks, and
the coverage-gated test suite. Changes to exports or consumer-facing modules also require
the build and package tests.

API documentation is generated from source comments — TSDoc for TypeScript, XML
documentation comments for C# — and `pnpm run docs` assembles both into the
[wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki), which is published
from `main`. It needs Node alone; the .NET pages are read from the C# source, not from a
compiled assembly. Catalogue provenance belongs in the matching
`data/<domain>/SOURCES.md`; open data gaps are tracked in
[GitHub issues](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues). See
[CONTRIBUTING.md](CONTRIBUTING.md) for the complete development and pull-request guide.
Report suspected vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).

## Data provenance and licensing

[ATTRIBUTIONS.md](ATTRIBUTIONS.md) describes every third-party source once — author,
link, licence terms and what the project uses it for. Each data file names its source in
a comment header and points there. Acquisition dates, immutable revisions or checksums,
derivation and manual corrections live with the data:

- [Astro sources](data/astro/SOURCES.md)
- [Ship sources](data/ships/SOURCES.md)
- [Personal-equipment sources](data/equipment/SOURCES.md)
- [Localized-name sources](data/i18n/SOURCES.md)
- [Material sources](data/materials/SOURCES.md)
- [Commodity sources](data/commodities/SOURCES.md)

[data/SNAPSHOTS.md](data/SNAPSHOTS.md) defines the required provenance metadata. A test
fixture is documented in its own header comment instead, which is where a captured build
records its origin, checksum and any scrubbing.

The project's code and documentation are MIT-licensed. Bundled game and third-party data
remains under its source-specific terms; it is not relicensed under MIT.
