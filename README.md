# Elite Dangerous Almanac

Static Elite Dangerous data and calculations for community applications and
research. The repository currently provides an ESM TypeScript package backed by
shared JSONC data, JSON fixtures and JSON Schemas.

## Install

```bash
npm install @elite-dangerous-almanac/core
```

The package supports Node.js 18+ and modern browser bundlers. It is ESM-only and
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
import { StarSystem } from "@elite-dangerous-almanac/core/astro/star-system";
import { ShipLoadout } from "@elite-dangerous-almanac/core/ships/ship-loadout";
```

The root entry point re-exports every feature area and is intended for consumers
whose bundler performs tree shaking.

## Quick start

### Systems and regions

```ts
import { StarSystem } from "@elite-dangerous-almanac/core/astro/star-system";

const system = StarSystem.fromName("Synuefe EN-H d11-96");
system?.systemAddress; // 3309179996515n
system?.sectorName; // "Synuefe"

StarSystem.fromSystemAddress(3309179996515n).name;
// "Synuefe EN-H d11-96"
```

Address inputs accept `bigint`, a safe integer `number`, or a decimal string.
Addresses are returned as `bigint`. A JavaScript number above `2^53 - 1` is
rejected because it cannot represent the address exactly.

Most coordinates use `GalacticCoords`: light-years from Sol. Procedural-sector
functions that take `SectorCoords` instead use integer grid indices from 0 to 127.
Use `sectorNameFromGalacticCoords` when starting from an ordinary galactic
position.

Elite Dangerous uses “region” for several different concepts:

| Concept                    | Entry point                                            |
| -------------------------- | ------------------------------------------------------ |
| Procedural sector name     | `sectorNameFromGalacticCoords`, `sectorNameFromCoords` |
| Sector origin used by id64 | `resolveRegionOrigin`                                  |
| Hand-authored named sector | `handAuthoredRegionForCoords`                          |
| Galactic codex region      | `findRegionAt`, `findRegionForBoxel`                   |
| Nebula catalogue entry     | `nearestNebulae`, `nebulaeWithin`, `getNebulaByName`   |

Nebula query functions require an explicit catalogue. Import `REAL_NEBULAE`,
`PROCGEN_NEBULAE`, `PLANETARY_NEBULAE`, or `ALL_NEBULAE` according to the data
you need; the complete catalogue is intentionally not loaded by default.

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
const paid = build.sourcePurchase; // null for a build assembled here
paid?.modulesValue; // as the capture stated it
paid?.valueForSlot("PowerPlant"); // null where the capture priced nothing

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
- Shared fixtures in `fixtures/` define language-neutral expected behavior.

The generated [GitHub Wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki)
contains the complete API reference from source documentation.

## Repository layout

```text
data/        shared JSONC catalogues and per-domain provenance
fixtures/    shared plain-JSON behavioral fixtures
schemas/     shared JSON Schemas for catalogue payloads
scripts/     repository-only data tooling
typescript/  @elite-dangerous-almanac/core
```

`data/` is the single source of truth. Implementations strip comments while loading
JSONC; they do not generate or commit duplicate JSON files.

## Development

Run TypeScript commands from `typescript/`:

```bash
npm install
npm run check
npm run build
npm run test:package
npm run docs
```

`npm run check` runs linting, formatting checks, type checking and the coverage-gated
test suite. Changes to exports or consumer-facing modules also require the build and
package tests.

API documentation is generated from TSDoc. Catalogue provenance belongs in the
matching `data/<domain>/SOURCES.md`; open data gaps are tracked in
[GitHub issues](https://github.com/DarkSession/Elite-Dangerous-Almanac/issues).

## Data provenance and licensing

Each data file starts with a short attribution comment. Detailed sources, acquisition
dates, immutable revisions or checksums, derivation and manual corrections live in:

- [Astro sources](data/astro/SOURCES.md)
- [Ship sources](data/ships/SOURCES.md)
- [Material sources](data/materials/SOURCES.md)
- [Commodity sources](data/commodities/SOURCES.md)

[data/SNAPSHOTS.md](data/SNAPSHOTS.md) defines the required provenance metadata.
[ATTRIBUTIONS.md](ATTRIBUTIONS.md) is the canonical list of third-party credits and
licence terms.

The project's code and documentation are MIT-licensed. Bundled game and third-party
data remains under its source-specific terms; it is not relicensed under MIT.
