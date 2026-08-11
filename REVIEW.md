# Library review — code and consumer perspective

A review of `@elite-dangerous-almanac/core` as it ships today, from two angles: an
outside Elite Dangerous app developer adopting it, and a maintainer looking for
optimisations, simplifications and code to delete.

Every number below was measured against a build of the current `main`
(`7a194b0`), and every consumer claim was checked by installing the packed
tarball into a scratch project and running it. `npm run check` is green
(99.67% lines, 94.23% branches).

**Headline:** there is almost nothing to delete. This is a disciplined codebase
with essentially no dead code and essentially no duplication. The available wins
are in **what gets shipped** (build output and data encoding) and in **one
vocabulary inconsistency**, not in removing source.

---

## 1. Verdict — is it well structured?

Yes, unusually so. The feature-area split is predictable, the leaf-subpath story
is real rather than aspirational (a leaf import bundles to 190 bytes, measured),
and the error contract, null-on-miss rule and "omit, never zero" rule hold
everywhere I probed. The barrel documentation does something most data libraries
skip: it teaches the domain before the API. I would adopt it as-is.

The friction that remains is not structural. It is that the package ships about
three times more bytes than it needs to, that one catalogue family (nebulae)
skips the project's own data-derivation convention, and that blueprints speak a
different dialect (`fdname`) from the rest of the library (`symbol`).

---

## 2. What makes sense — strengths worth protecting

**The error contract is exactly what the README promises.** Probed directly:

| Call | Result |
| --- | --- |
| `ProceduralSystem.fromName('Sol')` | `null` |
| `ProceduralSystem.fromSystemAddress(-1n)` | `RangeError: System address out of range…` |
| `toSystemAddress(2**53)` | `TypeError: Not a usable system address…` |
| `ShipLoadout.empty('NotAShip')` | `TypeError: no slot layout for hull "NotAShip"` |
| `build.setModule('Nope', m)` | `RangeError: hull "Anaconda" has no slot "Nope"` |

Lookups return `null`, malformed input throws `TypeError`, out-of-range throws
`RangeError` — as documented, with messages that name the offending value. This is
better than most libraries in this space manage.

**The documented values are true.** I executed 13 `// ->` claims drawn from the
README and the barrel docs — jump range, sector name, hand-authored region, codex
region, naming-region origin, nearest nebulae with distances, module counts,
material grades, commodity flags. All 13 matched, including
`singleJumpRange(...) // -> 89.4147` against an actual `89.41467782385232`.

**Tree-shaking is real, and `-all` catalogues cost nothing extra.** Measured with
esbuild against `dist/`:

- leaf import (`astro/mass-code`) → **190 B**
- feature barrel (`astro`) → **101.6 KB**

`ALL_MATERIALS`, `ALL_MODULES` and `ALL_NEBULAE`
(`src/materials/materials-all.ts`, `src/ships/modules-all.ts`,
`src/astro/nebulae-all.ts`) compose the split catalogues **by reference**, so the
combined view never duplicates the data.

**The barrel docs teach the domain.** `src/astro/index.ts:12-42` disambiguates the
four different things "region" means in this game before listing a single export;
`src/ships/index.ts:21-59` sorts 165 exports into five layers and says plainly
which one costs you the catalogues. `src/ships/engineering.ts:28-30, 68-69`
documents that capacity blueprints carry `BurstInterval` where the journal reports
`RateOfFire` — precisely the mismatch a consumer would otherwise waste a day on.

**Attribution ships in the package.** `THIRD_PARTY_NOTICES.md` is in `files`, and
the shipped README links to it above the fold. Non-commercial terms are findable
before someone depends on the library.

**Immutability is honest.** Catalogues are deeply frozen at load
(`src/internal/deep-freeze.ts`), and the snapshot types (`FittedModule`,
`LoadoutSlot`) document that they are detached point-in-time views rather than
live handles — with a worked example of the trap
(`src/ships/loadout-slot.ts:41-61`).

---

## 3. What is confusing or not self-explaining

No blockers. A consumer can get started and will not ship a wrong number.

### Friction

**F1 — No root entry, and it costs nothing to have one.** *(confusing, not wrong)*

`import { … } from '@elite-dangerous-almanac/core'` throws
`ERR_PACKAGE_PATH_NOT_EXPORTED`. It is the first thing a consumer types after the
install line, and there is no single place to browse the API.

The README documents the absence, and the rationale (native-ESM consumers
evaluating unrelated data modules) is sound — but I tested whether a root entry
would damage bundler consumers, and it does not:

| Import | Bundled size |
| --- | --- |
| `dist/astro/mass-code.js` (leaf) | 190 B |
| `dist/index.js` → same function (root barrel) | **190 B** |

Adding a root entry grew total `dist` JS by 6 KB. The per-module entries are what
make tree-shaking work, and they stay. *Fix: restore a root entry that re-exports
the four feature barrels, and keep the README's steer to leaf subpaths for native
ESM.* This reverses `7a194b0` and would need
`package.test.mjs:518` ("the package has no root entry") updated.

**F2 — Blueprints speak `fdname`; everything else speaks `symbol`.** *(confusing)*

The library states its own rule twice — "`symbol` means Frontier's internal id in
every catalogue" (`src/materials/materials.ts:186`,
`src/commodities/commodities.ts:120-121`) — and then breaks it:

- `getBlueprint(fdname)` — `src/ships/blueprints.ts:81`
- `getExperimentalEffect(fdname)` — `src/ships/experimental-effects.ts:60`
- `getDecorativeModification(fdname)` — `src/ships/decorative-modifications.ts:136`
- `AvailableBlueprint.fdname` — `src/ships/ship-loadout.ts:262`

A consumer who learned `symbol` from ships, modules, materials and commodities
meets a fifth name for the same idea in the engineering layer. *Fix: rename to
`symbol` throughout; keep `fdname` only in prose where the EDCD source term is
being cited.*

**F3 — Two catalogue shapes to learn.** *(confusing)*

Most catalogues are `readonly T[]` plus a `getXBySymbol` lookup. The engineering
catalogues are `Readonly<Record<string, T>>` keyed by id:
`BLUEPRINTS` (`blueprints.ts:62`), `EXPERIMENTAL_EFFECTS`
(`experimental-effects.ts:41`), `DECORATIVE_MODIFICATIONS`
(`decorative-modifications.ts:119`), `ENGINEERING_OPTION_GROUPS`
(`engineering-options.ts:170`). So `.filter()`/`.find()` work on one half of the
library and `Object.values()` is needed for the other, and the shared
`registry-index` helpers have to carry a second lookup path (`findByRawKey`) just
for them. *Fix: settle on `readonly T[]` + indexed lookup, as the other four
domains already do — or state the split as a deliberate rule in the ships barrel
doc.*

**F4 — An npm consumer cannot tell how current the data is.** *(actually a gap)*

`THIRD_PARTY_NOTICES.md` contains **zero dates** (checked). The acquisition dates
(`2026-08-06` … `2026-08-10`) live only in `data/*/SOURCES.md`, which is not in
`files` and which an npm consumer never sees. For a library whose whole value is
static game data, "how stale is this?" is the first trust question and the package
cannot answer it. *Fix: `scripts/copy-notices.mjs` already runs at build time —
have it stamp a per-domain snapshot-date table into the shipped notices.*

**F5 — 313 documented value claims are compiled but never executed.**
*(maintenance risk, not currently wrong)*

`scripts/check-examples.mjs` type-checks all 223 `@example` blocks — good, and
unusual — but nothing evaluates the `// ->` comments. There are 313 of them. Every
one I spot-checked was correct, so this is a risk rather than a defect: a data
refresh that shifts a jump range or a catalogue count will silently falsify the
docs. *Fix: extend the harness to execute snippets whose `// ->` line holds a
literal, and assert it. This converts 313 doc promises into tests for roughly the
cost of the existing extraction code.*

**F6 — `ships` is 165 named exports on one barrel.** *(friction, mitigated)*

80 runtime values plus ~85 types. The five-layer barrel doc
(`src/ships/index.ts:21-59`) is what makes this navigable, and it does the job —
but the layering exists only in prose. *Fix: nothing urgent; if the surface grows
further, consider promoting the layers to sub-barrels (`ships/metrics`,
`ships/engineering`).*

### Polish

- **P1** — `SystemAddressInput` is re-exported from
  `src/astro/permit-locked-systems.ts:14` and again from `permit-locks.ts:64`. Its
  home is `astro/system-address-input`; the extra paths are noise in the type
  surface.
- **P2** — `getShipBySymbol(symbol)` (`src/ships/ships.ts:150`) has no optional
  narrowing catalogue argument, while `getModuleBySymbol`, `getMaterialBySymbol`,
  `getCommodityBySymbol` and `getMicroResourceBySymbol` all do. Justified (the
  hull catalogue is small) but unexplained at the call site.
- **P3** — The weapon-stat docs have already drifted between the two places they
  are written (see C4 below): `roundsPerShot` is "Absent means one round per shot"
  in `modules.ts:638` and "Defaults to `1`" in `weapons.ts:61`.

---

## 4. Code perspective — optimisations and simplifications

### C1 — Ship no source maps *(3.05 MiB, 47% of the unpacked package)*

`tsup.config.ts:58` sets `sourcemap: true` with `sourcesContent: false`, and
`files` ships `dist` but neither `src/` nor `data/`. The maps therefore point at
files that are not in the package:

```
chunk-57TOTKOV.js.map  sources: ["../../data/astro/nebulae-planetary.jsonc",
                                 "../src/astro/nebulae-planetary.ts"]
                       sourcesContent: absent
```

No consumer can resolve them. They are 3.05 MiB of the 6.5 MB unpacked package —
for output that is deliberately unminified and readable as-is.

Measured, excluding `*.map` from `files`:

| | before | after |
| --- | --- | --- |
| unpacked | 6.5 MB | **3.3 MB** |
| tarball | 629.8 kB | **525.7 kB** |
| files | 345 | 210 |

*Fix: either drop `sourcemap`, or narrow `files` to `dist/**/*.js` and
`dist/**/*.d.ts`.* Note `package.test.mjs:620` currently asserts every artifact
references a map, so that test encodes the decision and would move with it.

### C2 — Stop pretty-printing the inlined data *(−33% of shipped JS)*

`tsup.config.ts:52-55` keeps `minify: false` so that "stack traces and files
opened from `node_modules` retain useful function names and line numbers". That
reasoning is right for code and wrong for the inlined JSONC catalogues, which
dominate the output and which nobody reads.

Measured across `dist`: **624 KB of leading indentation (22%) plus 98 KB of
newlines (3%)**. `dist/astro/codex-region-lookup.js` is 462 KB, of which 220 KB is
indentation.

Setting `minifyWhitespace: true` (keeping identifiers and syntax intact, so
stack-trace names survive):

| | before | after |
| --- | --- | --- |
| `dist` JS | 2.85 MB | **1.92 MB** (−33%) |
| unpacked | 6.5 MB | 5.0 MB |

I rebuilt and re-ran the consumer checks against this build: all documented values
still correct, import timings unchanged. **Combined with C1, the package goes from
6.5 MB to roughly 2.2 MB unpacked**, and every downstream bundler processes a
third less input.

### C3 — Nebula records carry 37% redundancy, against the project's own convention

`data/astro/nebulae-planetary.jsonc` is the largest data file in the repository
(827 KB source, a 759 KB bundled chunk). Two of its seven fields are derivable:

| Redundancy | Evidence | Share of payload |
| --- | --- | --- |
| `type` is constant per file | all 5489 planetary records are `"planetary"`; `nebulae-real.ts:24` even documents "Every record has `type: 'real'`" | **14.1%** |
| `system` duplicates `name` | identical in 5210 of 5489 planetary records (94.9%) | **22.9%** |
| combined | | **37.1%** |

This is exactly the pattern the project already solved elsewhere.
`src/ships/internal/module-catalogue.ts:32` stamps `category` from the file the
record came from — "the file a record came from is what decides its category" —
and `src/commodities/internal/commodity-catalogue.ts:13` stamps `rare` the same
way. Nebulae are the one domain with no such helper: `nebulae-real.ts:36` just
casts raw JSON (`deepFreeze(realNebulaeData as readonly Nebula[])`).

*Fix: add `astro/internal/nebula-catalogue.ts` mirroring the module and commodity
helpers — stamp `type` from the catalogue, and default `system` to `name` when the
file omits it. Public `Nebula` shape (`src/astro/nebulae.ts:74, 82`) is unchanged.
Saves roughly 280 KB from the planetary chunk and makes the four data domains
consistent.*

### C4 — The one real duplication: weapon stat fields declared twice

`OutfittingModuleStats` (`src/ships/modules.ts:619-660`) and `WeaponStats`
(`src/ships/weapons.ts:54-100`) declare the same ~18 optional weapon fields
independently. `weapons.ts:44` already imports types from `modules.ts`, so the
list can be derived rather than repeated:

```ts
export type WeaponStats = Pick<
    OutfittingModuleStats,
    'damage' | 'damageDistribution' | 'damageComponents' | 'roundsPerShot' | …
>;
```

The two doc sets serve different readers (catalogue semantics vs. calculation
defaults) and are worth keeping — but the *field list* should have one source, so
a new stat cannot be added to one and missed by the other. The docs have already
drifted (P3 above).

### C5 — Dead code: there is none worth removing

I scanned all 91 non-test source files for exports never referenced outside their
declaring module, then checked each hit by hand. Every one turned out to be a type
that appears in an exported signature and must therefore be exported
(`CatalogueDataTestOptions`/`CatalogueDataTestCase` in
`src/internal/catalogue-data-tests.ts:20,28`; `LoadoutExportShape`/
`LoadoutExportInput`; `ImportedLoadoutState`; `KeyIndex`).

**Nothing to delete.** For a 21,000-line library that is a genuinely good result
and worth recording rather than papering over.

### C6 — A repetition I recommend *keeping*

Four domains (`materials`, `micro-resources`, `commodities`, `ships/modules`) each
hand-write the same lookup shape:

```ts
return catalogue === DEFAULT
    ? findInKeyIndex(INDEX, wanted)
    : findByKey(catalogue, field, wanted);
```

Ten near-identical three-line bodies. A `createLookup(all, field)` factory in
`internal/registry-index.ts` would collapse them — and I do not think it should.
The bodies are ~30 lines in total; the docs attached to them are ~200, and they
are per-domain (`"GridResistors"` vs `"Lavian Brandy"` vs `"empire_trader"`).
Converting named function declarations to consts holding factory results also
degrades editor hover. **Leave it.**

### C7 — Bespoke tooling is the real maintenance load

Roughly 2,400 lines of repository-only tooling support a 21,000-line library:
`package.test.mjs` (832), `check-examples.mjs` (430), `build-wiki-sidebar.mjs`
(407), `generate-schema-and-types.mjs` (373), plus three post-`tsup` passes
(`prune-barrel-imports`, `strip-bare-imports`, `attach-barrel-docs`).

Each has a stated and defensible reason, and `package.test.mjs` in particular
encodes bundle-graph guarantees that would otherwise silently regress. This is not
a defect — but it is where a second maintainer's time will go, and two of the
passes are workarounds for bundler behaviour worth re-testing periodically:
`prune-barrel-imports.mjs` exists only to silence downstream warnings about
redundant bare imports esbuild emits.

---

## 5. Recommendations, highest impact first

| # | Change | Effect | Risk |
| --- | --- | --- | --- |
| 1 | Exclude `*.map` from `files` (or drop `sourcemap`) — **C1** | 6.5 → 3.3 MB unpacked; maps were unresolvable anyway | none; update `package.test.mjs:620` |
| 2 | `minifyWhitespace: true` in `tsup.config.ts` — **C2** | −33% shipped JS; verified behaviour-identical | none |
| 3 | Add `buildNebulaCatalogue`; drop `type` and redundant `system` from the data — **C3** | −280 KB on the largest chunk; makes the fourth data domain match the other three | low; public type unchanged |
| 4 | Rename `fdname` → `symbol` across the engineering catalogues — **F2** | one word for one concept across the whole API | breaking, and welcome per the brief |
| 5 | Restore a root entry — **F1** | removes the first-five-minutes stumble at zero bundle cost (measured 190 B either way) | reverses `7a194b0`; update `package.test.mjs:518` |
| 6 | Stamp data snapshot dates into `THIRD_PARTY_NOTICES.md` — **F4** | an npm consumer can finally judge data currency | none |
| 7 | Execute `// ->` claims in `check-examples.mjs` — **F5** | 313 doc promises become tests | none |
| 8 | Derive `WeaponStats` via `Pick<>` — **C4** | removes the library's only real duplication and its live doc drift | low |
| 9 | Unify the engineering catalogues on `readonly T[]` — **F3** | one catalogue shape to learn; retires `findByRawKey` | breaking |

Items 1–3 are pure wins and independent of each other: together they take the
published package from 6.5 MB to under 2 MB unpacked with no API change at all.
Items 4, 5 and 9 are the breaking changes worth taking now, while nobody depends
on the package.
