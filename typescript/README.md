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

- `astro`: procedural names, id64 addresses, regions, nebulae and permit locks;
- `ships`: ships, modules, SLEF loadouts, engineering and build metrics;
- `equipment`: Odyssey suits, handheld weapons, grade upgrades and modifications;
- `i18n`: sparse localized catalogue names, descriptions, slot labels and structured
  diagnostic messages;
- `materials`: ship engineering materials and Odyssey micro resources;
- `commodities`: standard and rare market goods.

## Ship assets

Every catalogued hull includes three `1200 × 800` SVG files in the installed package:

```text
assets/ships/<symbol>/illustration.svg
assets/ships/<symbol>/schematic-top.svg
assets/ships/<symbol>/schematic-bottom.svg
```

`<symbol>` is the exact ship symbol returned by the ships catalogue. These are static
package files rather than JavaScript subpath exports, so applications can copy them from
the installed package into their own public or bundled asset directory.

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
- Drawing order, element IDs, `data-model-socket`, coordinates, colours, and other SVG
  details are presentation data, not stable identities. IDs repeat between asset files,
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
import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';

declare const slefJsonString: string;

const build = ShipLoadout.fromSlef(slefJsonString);
build.maxJumpRange();
build.powerBudget();
build.shieldMetrics();
build.armourMetrics();
build.weaponMetrics();
build.weaponsCapacitorMetrics({ weaponsPips: 2 });

build.toSlefString({
    header: { appName: 'MyApp', appVersion: '1.0.0' },
});
```

`ShipLoadout` imports every ship and module catalogue so it can resolve any build.
When only one calculation is required, use the data-free leaf modules under
`ships/jump-range`, `ships/power`, `ships/shields`, `ships/armour`, `ships/weapons`,
`ships/weapons-capacitor`, `ships/ammunition`, `ships/heat` or `ships/resistances`.

`build.validation` reports validity and operational completeness. Potentially incomplete
aggregates are nullable and have a diagnostic counterpart (`cargoCapacityResult`,
`fuelCapacityResult`, `unladenMassResult`). `parseSlef` is strict; `inspectSlef` is the
tolerant importer for mixed files and returns indexed diagnostics instead of silently
dropping entries.

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
    getEngineeringGroupName,
    getMaterialName,
    getMicroResourceName,
    getModuleName,
    getShipName,
} from '@elite-dangerous-almanac/core/i18n';

getModuleName('Int_Hyperdrive_Size6_Class5', 'de-DE'); // -> "Frameshiftantrieb"
getBlueprintName('FSD_LongRange', 'fr-FR'); // -> "Portée FSD améliorée"
getMaterialName('GridResistors', 'de'); // -> "Gitterwiderstände"
getMicroResourceName('graphene', 'fr'); // -> "Graphène"
getShipName('empire_trader', 'fr'); // -> "Imperial Clipper"
getEngineeringGroupName('frameShiftDrives', 'de'); // -> null
```

The functions return an explicit source value verbatim, so a source-backed spelling may
happen to equal English; the library itself never supplies an English fallback.
Unqualified `zh` selects the source's Simplified Chinese (`zh-CN`) names. Explicitly
different Chinese scripts or regions such as `zh-TW` do not fall back to Simplified
Chinese and return `null` unless a matching source is added.

The same contract covers ship manufacturers, pre-engineered variant names, engineering
group names, experimental-effect descriptions, loadout-slot and restriction labels, and
structured loadout, calculation, SLEF and edit messages. A family whose accepted source
currently supplies only English returns `null` for every non-English locale.

Registry lookups ignore case and surrounding whitespace. Material, commodity and
module lookups search their complete registry by default and accept an optional
catalogue to narrow the results. Nebula queries require an explicit catalogue so the
large combined dataset is never an implicit dependency.

`symbol` is Frontier's item id for a hull, module, suit, handheld weapon, material,
micro-resource or commodity. Ship engineering uses a separate identity space: `fdname` identifies a
blueprint recipe, experimental effect or fixed variant identity. The journal
normally writes that id in its `Engineering` block, but a few blueprint aliases
collide across module families; `resolveBlueprintForModule` resolves those journal
spellings. Recipe and effect lookups take that `fdname`. Pre-engineered variants instead
form a relation from the base module: after resolving a module by type or name,
`getPreEngineeredVariants` lists the fixed articles associated with its `symbol`, and the
caller can inspect each variant's `blueprint` identity. Those include the grade-5
`Decorative_*` launchers whose −99% damage modifier is part of the awarded article rather
than a generally applicable recipe. `ShipLoadout.setPreEngineeredVariant` fits the fixed
article and writes its corresponding journal block.

Personal-equipment modifications are keyed by their recipe symbol, just as ship
blueprints and experimental effects are keyed by `fdname`; there is no second synthetic
id. The journal omits the technology suffix from three weapon modification families, so
`resolvePersonalModificationForWeapon` resolves those spellings against the weapon before
joining to `PERSONAL_MODIFICATIONS` or `PERSONAL_MODIFICATION_COSTS`. Material shopping
lists live on the separate `equipment/modification-costs` subpath and consume the
micro-resource symbols from the `materials` feature area.

## Important behavior

- Exported catalogues are deeply frozen.
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
