# @elite-dangerous-almanac/core

Tree-shakeable Elite Dangerous static data and calculations for TypeScript and
JavaScript applications.

## Project status

**This library is a work in progress.** Until version 1.0, backwards compatibility is
not ensured and breaking changes are very likely: exported names, signatures, subpath
exports and data shapes can change in any release. Pin an exact version if your
application needs a stable surface, and read the release notes before upgrading.

## Install

```bash
npm install @elite-dangerous-almanac/core
```

The package is ESM-only, supports Node.js 22+ and targets modern browser bundlers.
It is marked side-effect free.

The package includes game and community data under source-specific terms. Review
[LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) before
redistribution or commercial use.

## Imports

Use a feature barrel when a bundler will tree-shake it:

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro';
```

There is no package-wide root entry; choose one of the six feature areas or a leaf.

Use leaf subpaths to avoid evaluating unrelated data modules in native ESM:

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
```

The heavyweight module registries, planetary/combined nebula catalogues and codex-region
coordinate lookup are only exported from their leaf subpaths, not the feature barrels.

The package has six feature areas:

- `astro`: procedural names, id64 addresses, regions, nebulae, permit locks, and scanned
  bodies with their physics;
- `ships`: ships, modules, SLEF loadouts, engineering and build metrics;
- `equipment`: Odyssey suits, handheld weapons and their damage per second, suit tools,
  grade upgrades and modifications;
- `i18n`: sparse localized catalogue names, descriptions, slot labels and structured
  diagnostic messages;
- `materials`: ship engineering materials and Odyssey micro resources;
- `commodities`: standard and rare market goods.

## Ship assets

Every catalogued hull includes four SVG files in the installed package:

```text
assets/ships/<symbol>/gunsight.svg
assets/ships/<symbol>/illustration.svg
assets/ships/<symbol>/schematic-top.svg
assets/ships/<symbol>/schematic-bottom.svg
```

`<symbol>` is the exact ship symbol returned by the ships catalogue. These are static
package files rather than JavaScript subpath exports, so applications can copy them from
the installed package into their own public or bundled asset directory.

`gunsight.svg` is a `600 × 600` frontal plot of the fixed-weapon aim points at a nominal
1,000-metre target range. Each weapon group under `#weapon-dots` carries the same
`data-journal-slot` key used by the hull's hardpoint layout. The illustration and both
schematics use a `1200 × 800` canvas.

The two schematics expose a stable annotation contract for hull-anatomy interfaces:

- Each annotated feature is a `<g>` group carrying a `data-feature` category. The
  current categories are `canopy`, `cargo_hatch`, `engine`, `fighter_bay`, `hardpoint`,
  `heat_vent`, `landing_gear`, `thruster`, and `utility_mount`.
- A weapon mount has `data-feature="hardpoint"`; a utility mount has
  `data-feature="utility_mount"`. Both carry `data-journal-slot`, whose value is the
  exact journal-compatible slot key returned by `enumerateSlots`. Other feature
  categories do not carry a journal slot key.
- Every hardpoint and utility slot in the hull catalogue occurs on at least one of the
  two schematics. A slot occurs at most once per side, but the same slot may occur once
  on both sides. Treat those as two views of one game slot, not two mounts.
- Drawing order, element IDs, coordinates, colours, and other SVG details are
  presentation data, not stable identities. IDs repeat between asset files,
  so scope each schematic when inlining more than one. Select interactive geometry by
  `data-feature` and `data-journal-slot` only.

The schematic documents are safe to embed inline as supplied: they contain only static
`svg`, `g`, `path`, and `circle` elements; no scripts, styles, event-handler attributes,
foreign or media elements, links, external references, or CSS `url()` values. This
content guarantee applies to the unmodified package files; applications remain
responsible for any transformations or user-supplied replacements.

## Examples

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';

const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // -> 3309179996515n
ProceduralSystem.fromSystemAddress(3309179996515n).name;
// -> "Synuefe EN-H d11-96"
```

Address inputs accept `bigint`, safe integer `number` values and decimal strings.
Addresses are returned as `bigint`.

```ts
import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const slefJsonString: string;

const build = ShipLoadout.fromSlef(slefJsonString);
const metrics = BuildMetrics.of(build);
metrics.maxJumpRange();
metrics.powerBudget();
metrics.shieldMetricsResult().value;
metrics.armourMetrics();
metrics.weaponMetrics();
metrics.weaponsCapacitorMetrics({ weaponsPips: 2 });

build.toSlefString({
    header: { appName: 'MyApp', appVersion: '1.0.0' },
});
```

`ShipLoadout` holds and edits a build; `BuildMetrics` calculates over one, so an
outfitting editor need not import the calculations. Both import every ship and module
catalogue so they can resolve any build. When only one calculation is required, use the
data-free leaf modules under `ships/jump-range`, `ships/power`, `ships/shields`,
`ships/shield-capacitor`, `ships/armour`, `ships/weapons`, `ships/weapons-capacitor`,
`ships/mobility`, `ships/mobility-capacitor`, `ships/ammunition`, `ships/heat` or
`ships/resistances`.

`build.validation()` reports validity and operational completeness. `cargoCapacity`,
`passengerCapacity`, `fuelCapacity` and `unladenMass` always have an answer, because no
article the catalogue cannot weigh reaches a build. The eight build-state methods
(`mobilityMetricsResult`, `mobilityCapacitorMetricsResult`, `shieldMetricsResult`,
`shieldCapacitorMetricsResult`, `shieldRecoveryResult`, `heatMetricsResult`,
`distributorMetricsResult` and `standardLoadResult`) return a diagnostic result whose
value is either complete or `null`, with issues naming what is missing, unresolved,
switched off, shed or invalid. `parseSlef`
is strict; `inspectSlef` is the tolerant importer for mixed files and returns indexed
diagnostics instead of silently dropping entries.

```ts
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
import { getMaterialByName } from '@elite-dangerous-almanac/core/materials/materials';
import { getCommodityByName } from '@elite-dangerous-almanac/core/commodities/commodities';
import { getPersonalWeaponByName } from '@elite-dangerous-almanac/core/equipment/weapons';

getShipBySymbol('empire_trader')?.name; // -> "Imperial Clipper"
getMaterialByName('iron')?.grade;
getCommodityByName('lavian brandy')?.rare; // -> true
getPersonalWeaponByName('Karma AR-50')?.grades['5'].damage; // -> 2.8
```

Localized game names live on their own subpath, so applications that use only English
do not bundle them. English names are complete; other locales return `null` where the
pinned sources carry no translation instead of silently substituting English:

```ts
import {
    getBlueprintName,
    getMaterialName,
    getMicroResourceName,
    getModuleName,
    getOutfittingFamilyName,
    getPersonalModificationName,
    getPersonalToolName,
    getSuitName,
} from '@elite-dangerous-almanac/core/i18n';

getModuleName('Int_Hyperdrive_Size6_Class5', 'de-DE'); // -> "Frameshiftantrieb"
getBlueprintName('FSD_LongRange', 'fr-FR'); // -> "Portée FSD améliorée"
getMaterialName('GridResistors', 'de'); // -> "Gitterwiderstände"
getMicroResourceName('graphene', 'fr'); // -> "Graphène"
getSuitName('explorationsuit_class3', 'de'); // -> "Artemis-Anzug"
getPersonalToolName('profile-analyser', 'es'); // -> "Analizador de perfiles"
getPersonalModificationName('suit_nightvision', 'fr'); // -> "Vision nocturne"
getOutfittingFamilyName('shieldGenerators', 'de'); // -> "Schildgeneratoren"
getOutfittingFamilyName('xenoScanners', 'de'); // -> null
```

Display prose the game shows a player — a suit's or a handheld weapon's blurb, what an
experimental effect or an engineer's modification does — has its own lookups in the same
`i18n` area, each on its own subpath, complete in all six locales:

```ts
import { getSuitDescription } from '@elite-dangerous-almanac/core/i18n/suits';

getSuitDescription('utilitysuit', 'en')?.slice(0, 20); // -> "The Maverick suit is"
```

The functions return an explicit source value verbatim, so a source-backed spelling may
happen to equal English; the library itself never supplies an English fallback. The
catalogues carry English, French, German, Portuguese, Russian and Spanish, each stored
under a bare language tag: a regional or script subtag is dropped (`de-DE` → `de`), and
any other language returns `null`.

The same contract covers pre-engineered variant names, experimental-effect names and
descriptions, loadout-slot and restriction labels, and structured loadout, calculation,
SLEF and edit messages. A family whose accepted source currently supplies only English
returns `null` for every non-English locale.

**Ship names, manufacturers and engineering groups have no lookup**, because the game
does not translate them. Hull names and manufacturers are proper nouns — every source
that publishes a localized ship column publishes the English spelling — so read them
from the ships catalogue (`getShipBySymbol(symbol)?.name` and `?.manufacturer`). An
engineering group has no in-game label at all: its menu is headed by the module's own
outfitting family, so name it with `getOutfittingFamilyName(module.familyId, locale)`.

Registry lookups ignore case and surrounding whitespace. The material, commodity and
module lookups that resolve one record by symbol or name search their complete registry
by default and accept an optional catalogue to narrow it; the filters that return a
subset (`materialsInCategory`, `commoditiesInCategory` and their siblings) take no
catalogue, since filtering their result costs nothing and passing one narrows nothing a
consumer could not narrow themselves. Nebula queries require an explicit catalogue so
the large combined dataset is never an implicit dependency.

`symbol` is Frontier's item id for a hull, module, suit, handheld weapon, material,
micro-resource or commodity. Ship engineering ids live in a space of their own: a
`blueprintSymbol` names a blueprint recipe, a fixed variant's identity included, and an
`experimentalEffectSymbol` names an experimental effect. The journal normally writes
both in its `Engineering` block, but a few blueprint aliases collide across module
families; `resolveBlueprintForModule` resolves those journal spellings. Pre-engineered
variants instead form a relation from the base module: after resolving a module by type
or name, `getPreEngineeredVariants` lists the fixed articles associated with its
`symbol`, and the caller can inspect each variant's `blueprintSymbol` identity. Those
include the grade-5 `Decorative_*` launchers whose −99% damage modifier is part of the
awarded article rather than a generally applicable recipe.
`ShipLoadout.setPreEngineeredVariant` fits the fixed article and writes its corresponding
journal block.

Personal-equipment modifications are keyed by their own recipe symbol, the way ship
blueprints and experimental effects are keyed by theirs; neither place invents a second
synthetic id. The journal omits the technology suffix from three weapon modification
families, so `resolvePersonalModificationForWeapon` resolves those spellings against the
weapon before joining to `PERSONAL_MODIFICATIONS` or `PERSONAL_MODIFICATION_COSTS`.
Material shopping lists live on the separate `equipment/modification-costs` subpath and
consume the
micro-resource symbols from the `materials` feature area. Suit tools are the one
personal-equipment record with no Frontier symbol — the journal never names a tool — so
`PersonalTool.id` is a library key such as `arc-cutter`, and `getPersonalToolName` takes
that same id.

## Important behavior

- Exported catalogues are deeply frozen, and so is every calculation result — nested
  records and lists included — so nothing a consumer does can mutate a shared singleton
  or a figure it handed back.
- Slot keys come from the game and are not reliably derivable from position. Enumerate
  them with `ShipLoadout.slots()` or `enumerateSlots`.
- Resistances are fractions, not percentages.
- Build credits are quoted at catalogue retail. What a capture says it paid is kept
  apart, unedited, as `ShipLoadout.sourcePurchase`, and is exported only when asked for
  by name with `{ credits: 'source' }`.
- Absent catalogue fields are omitted rather than represented by zero. Catalogue
  provenance records unresolved data gaps.
- Lookups return `null`; malformed inputs throw `TypeError`; unsupported ranges throw
  `RangeError`.
- `parseSlef`, `inspectSlef` and `ShipLoadout.fromSlef` throw `SyntaxError` when handed a
  string that is not valid JSON. Past that, a payload number outside its documented
  journal range counts as malformed rather than out of range: `parseSlef` and
  `ShipLoadout.fromSlef` throw `TypeError`, not `RangeError`, and `inspectSlef` reports it
  as a diagnostic.

The [repository README](https://github.com/DarkSession/Elite-Dangerous-Almanac#readme)
contains the project guide. The generated
[GitHub Wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki) contains the
complete API reference.

## Data and credits

The package's [provenance record](./PROVENANCE/SNAPSHOTS.md) includes every domain's
canonical `SOURCES.md` verbatim, recording each catalogue's source, acquisition date,
immutable revision or checksum, derivation and manual corrections. It travels with the
installed version, so its pinned data currency can be checked offline. Unknown values
are omitted rather than guessed.

Third-party credits and licence terms ship with the package in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

The project's code and documentation are MIT-licensed. Bundled game and third-party
data remains under its source-specific terms and is not relicensed under MIT.
