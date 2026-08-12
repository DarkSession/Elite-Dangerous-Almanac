# Elite Dangerous Almanac

Static Elite Dangerous data and calculations for community applications and
research. The repository currently provides an ESM TypeScript package backed by
shared JSONC data and fixtures, and JSON Schemas.

## Install

```bash
npm install @elite-dangerous-almanac/core
```

The package supports Node.js 22+ and modern browser bundlers. It is ESM-only and
marks every module as side-effect free.

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review [LICENSE](LICENSE) and
[ATTRIBUTIONS.md](ATTRIBUTIONS.md) before redistribution or commercial use.

## Feature areas

| Import                                      | Provides                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@elite-dangerous-almanac/core/astro`       | Procedural system names, id64 addresses, sectors, galactic regions, nebulae and permit locks       |
| `@elite-dangerous-almanac/core/ships`       | Hulls, modules, loadouts, SLEF, engineering, jump range, power, shields, armour and weapon metrics |
| `@elite-dangerous-almanac/core/materials`   | Ship engineering materials and Odyssey micro resources                                             |
| `@elite-dangerous-almanac/core/commodities` | Standard and rare market commodities                                                               |

Each public module is also available as a leaf subpath. Prefer leaf imports when
you do not need an entire feature area, especially in native ESM applications:

```ts
import { ProceduralSystem } from "@elite-dangerous-almanac/core/astro/procedural-system";
import { ShipLoadout } from "@elite-dangerous-almanac/core/ships/ship-loadout";
```

There is no package-wide root entry. Choose a feature area when a bundler will tree
shake it, or a leaf subpath when the import graph must be explicit.

## Quick start

### Systems and regions

```ts
import { ProceduralSystem } from "@elite-dangerous-almanac/core/astro/procedural-system";

const system = ProceduralSystem.fromName("Synuefe EN-H d11-96");
system?.systemAddress; // 3309179996515n
system?.namingRegionName; // "Synuefe"

ProceduralSystem.fromSystemAddress(3309179996515n).name;
// "Synuefe EN-H d11-96"
```

Address inputs accept `bigint`, a safe integer `number`, or a decimal string.
Addresses are returned as `bigint`. A JavaScript number above `2^53 - 1` is
rejected because it cannot represent the address exactly.

Most positions use `GalacticPosition`: `{x, y, z}` light-years from Sol.
Procedural-sector functions instead use `SectorGridPosition` with the distinct
axes `{sectorX, sectorY, sectorZ}`, so the two spaces cannot be mixed accidentally.
Use `sectorNameFromGalacticPosition` when starting from an ordinary galactic position.

Elite Dangerous uses “region” for several different concepts:

| Concept                           | Entry point                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Procedural sector name            | `sectorNameFromGalacticPosition`, `sectorNameFromGridPosition`                             |
| Naming-region origin used by id64 | `resolveNamingRegionOrigin`                                                                |
| Hand-authored named sector        | `findHandAuthoredRegionAt`                                                                 |
| Galactic codex region             | `findCodexRegionAt`, `findCodexRegionForBoxel` (direct `astro/codex-region-lookup` import) |
| Nebula catalogue entry            | `nearestNebulae`, `nebulaeWithin`, `getNebulaByName`                                       |

Nebula query functions require an explicit catalogue. Import `REAL_NEBULAE`,
`PROCGEN_NEBULAE`, `PLANETARY_NEBULAE`, or `ALL_NEBULAE` according to the data
you need from its `astro/nebulae-*` subpath; the heavyweight planetary and combined
catalogues are not exported by the general barrels.

The codex-region coordinate lookup likewise stays on its explicit
`astro/codex-region-lookup` subpath because its map geometry is large. Lightweight codex
metadata and id/name lookups remain on the general astro barrel.

### Ships and loadouts

```ts
import { ShipLoadout } from "@elite-dangerous-almanac/core/ships/ship-loadout";

const build = ShipLoadout.fromSlef(slefJsonString);

build.maxJumpRange();
build.powerBudget();
build.shieldMetrics();
build.armourMetrics();
build.weaponMetrics();

const exported = build.toSlefString({
  header: { appName: "MyApp", appVersion: "1.0.0" },
});
```

`ShipLoadout` resolves a whole build, applies its engineering and validates module
fits. It imports the complete ship and module catalogues. The calculation modules
under `ships/jump-range`, `ships/power`, `ships/shields`, `ships/armour`,
`ships/weapons`, `ships/ammunition` and `ships/resistances` are data-free alternatives
when only one calculation is needed.

`build.validation` distinguishes a structurally invalid fit from an operationally
incomplete one. Aggregate values that may depend on missing catalogue data expose both a
nullable convenience property and a diagnostic result: for example,
`build.cargoCapacity` is `number | null`, while `build.cargoCapacityResult` names every
unknown rack. `parseSlef` rejects any malformed entry; use `inspectSlef` when importing an
untrusted mixed file and you need valid entries plus indexed diagnostics.

Slot keys come from the game and are not reliably derivable from slot position.
Read them from `ShipLoadout.slots()` or `enumerateSlots(getShipSlots(symbol))`.
Some slots and modules also carry restrictions; `modulesForSlot` returns only the
modules that fit.

Credits come in two kinds and are kept apart. Everything the library computes is
catalogue **retail**, which is a property of the fit. What a capture states it **paid**
is provenance about that capture — it carries station discounts and can price only some
of the build — so it is preserved as supplied in a read-only source purchase record that
no edit changes, and it is exported only when asked for by name:

```ts
import { getSourceModuleValue } from "@elite-dangerous-almanac/core/ships/source-purchase";

const paid = build.sourcePurchase; // null for a build assembled here
paid?.modulesValue; // as the capture stated it
paid && getSourceModuleValue(paid, "PowerPlant")?.value; // undefined when unpriced

build.toLoadoutEvent(); // retail: hull cost plus every module's list price
build.toLoadoutEvent({ credits: "source" }); // the capture's own figures
```

Each captured figure stays pinned to the article it was paid for, so editing narrows the
source export rather than staling it: a swapped or removed module exports unpriced and
takes `ModulesValue` and `Rebuy` with it, while engineering a module or filling an empty
mount leaves them standing. `HullValue` always stands, naming no slot for an edit to
narrow. What a capture never priced it also never explains, so removing an unpriced
module cannot be detected; `data/ships/SOURCES.md` records both limits.

Registry lookups ignore case and surrounding whitespace:

```ts
import {
  getModuleBySymbol,
  getShipBySymbol,
} from "@elite-dangerous-almanac/core/ships";

getShipBySymbol("empire_trader")?.name; // "Imperial Clipper"
getModuleBySymbol("Int_Hyperdrive_Size6_Class5")?.name;
```

`symbol` is Frontier's item id for a hull, module, material, micro-resource or
commodity. Engineering uses a separate identity space: `fdname` identifies a
blueprint recipe, experimental effect or decorative modification. The journal
normally writes that id in its `Engineering` block, but a few blueprint aliases
collide across module families; `resolveBlueprintForModule` resolves those journal
spellings. Functions that ask what engineering a module accepts therefore take the
module's `symbol`; functions that look up a recipe, effect or modification take its
`fdname`.

### Materials and commodities

```ts
import { getMaterialByName } from "@elite-dangerous-almanac/core/materials/materials";
import { getCommodityByName } from "@elite-dangerous-almanac/core/commodities/commodities";

getMaterialByName("iron")?.grade;
getCommodityByName("lavian brandy")?.rare; // true
```

These lookups search their complete registry by default and accept an optional
catalogue argument to narrow the search. The argument narrows results, not bundle
size, because the default registry remains a static import. Import a split catalogue
and use ordinary array operations when bundle size is the priority.

## Data behavior

- Exported catalogues are deeply frozen. Consumers cannot mutate the shared module
  singleton seen by later lookups.
- Units are documented on the exported types and functions. Resistances are fractions,
  masses are tonnes, power is megawatts, distances are light-years and shield strength
  is megajoules unless a symbol says otherwise.
- Absent catalogue fields are omitted rather than represented by zero. Catalogue
  provenance records unresolved data gaps.
- Lookups return `null` when no record matches. Malformed inputs throw `TypeError`, and
  values outside a supported range throw `RangeError`.
- The SLEF entry points that accept a string — `parseSlef`, `inspectSlef` and
  `ShipLoadout.fromSlef` — throw `SyntaxError` when the text is not valid JSON. Past
  that, a payload number outside its documented journal range counts as malformed rather
  than out of range: `parseSlef` and `ShipLoadout.fromSlef` throw `TypeError`, not
  `RangeError`, and `inspectSlef` reports it as a diagnostic on that entry.
- Shared fixtures in `fixtures/` define language-neutral expected behavior.

The generated [GitHub Wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki)
contains the complete API reference from source documentation.

## Repository layout

```text
data/        shared JSONC catalogues and per-domain provenance
fixtures/    shared JSONC behavioral fixtures, each carrying its own provenance
schemas/     shared JSON Schemas for catalogue payloads
scripts/     repository-only data tooling
typescript/  @elite-dangerous-almanac/core
```

`data/` is the single source of truth. Implementations strip comments while loading
JSONC; they do not generate or commit duplicate JSON files.

## Development

Run TypeScript commands from `typescript/`:

```bash
npm ci
npm run check
npm run build
npm run test:package
npm run docs
```

`npm run check` runs linting, formatting checks, type checking, the documented-example
compile and the coverage-gated test suite. Changes to exports or consumer-facing modules
also require the build and package tests.

API documentation is generated from TSDoc. Catalogue provenance belongs in the
matching `data/<domain>/SOURCES.md`; open data gaps are tracked in
[GitHub issues](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues).
See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete development and pull-request
guide. Report suspected vulnerabilities privately as described in
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

The project's code and documentation are MIT-licensed. Bundled game and third-party
data remains under its source-specific terms; it is not relicensed under MIT.
