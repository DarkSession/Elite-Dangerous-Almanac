# Elite Dangerous Almanac

Static Elite Dangerous data and calculations for community applications and research.
The repository provides an ESM TypeScript package backed by shared JSONC data, fixtures
and JSON Schemas.

## TypeScript package

```bash
npm install @elite-dangerous-almanac/core
```

The package supports Node.js 22+ and modern browser bundlers. It is ESM-only and marks
every module as side-effect free.

| Area          | Provides                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `astro`       | Procedural system names, id64 addresses, sectors, galactic regions, nebulae and permit locks       |
| `ships`       | Hulls, modules, loadouts, SLEF, engineering, jump range, power, shields, armour and weapon metrics |
| `materials`   | Ship engineering materials and Odyssey micro resources                                             |
| `commodities` | Standard and rare market commodities                                                               |

See the [package README](typescript/README.md) for installation and import guidance,
the [Getting started guide](typescript/docs/guides/Getting-started.md) for first-use
examples, and the
[generated wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki) for the
complete API reference.

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review [LICENSE](LICENSE) and
[ATTRIBUTIONS.md](ATTRIBUTIONS.md) before redistribution or commercial use.

## Repository layout

```text
assets/      shared visual assets, keyed by catalogue symbol
data/        shared JSONC catalogues and per-domain provenance
fixtures/    shared JSONC behavioral fixtures, each carrying its own provenance
schemas/     shared JSON Schemas for catalogue payloads
scripts/     repository-only data tooling
typescript/  @elite-dangerous-almanac/core
```

`data/` is the single source of truth. Implementations strip comments while loading
JSONC; they do not generate or commit duplicate JSON files.

Ship illustrations live at `assets/ships/<symbol>/illustration.svg`, where `<symbol>` is
the exact Frontier ship symbol from the shared catalogue. The assets remain outside the
language packages so every implementation can consume the same files.

## Development

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

`pnpm run check` runs linting, formatting checks, type checking, documented-example
compilation and value checks, and the coverage-gated test suite. Changes to exports or
consumer-facing modules also require the build and package tests.

API documentation is generated from TSDoc. Catalogue provenance belongs in the matching
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
- [Material sources](data/materials/SOURCES.md)
- [Commodity sources](data/commodities/SOURCES.md)

[data/SNAPSHOTS.md](data/SNAPSHOTS.md) defines the required provenance metadata. A test
fixture is documented in its own header comment instead, which is where a captured build
records its origin, checksum and any scrubbing.

The project's code and documentation are MIT-licensed. Bundled game and third-party data
remains under its source-specific terms; it is not relicensed under MIT.
