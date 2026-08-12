# Library review — code and consumer perspective

**Status: reviewed at `8d26a51`; four findings fixed on `main` and re-verified at
`542590d`.** Original measurements came from a `npm run build` of the review base;
verification figures in §4 come from a fresh install and build of `542590d`. Both bundled
with esbuild (`minify: true`, `format: 'esm'`, browser platform) and timed on Node 22.

Nobody consumes the package yet, so breaking changes are free where they are warranted.

> **Revision note.** The first draft of this review was substantially wrong, and its
> central recommendation — collapse the subpath surface — was a proposal to undo a
> deliberate, documented project decision. The cause was a methodological failure: I
> judged the package and source without reading `AGENTS.md` or the shipped guides under
> `typescript/docs/guides/`. Several findings asserted the absence of documentation that
> ships today. §5 records every withdrawn finding rather than deleting it, so the error is
> auditable.

---

## 1. Verdict

This is a well-built and unusually well-documented library. The data layering is honest,
catalogues are frozen with a test asserting it, units and error contracts are stated at
the point of use, and the documented examples are compile- and value-checked in CI.

After correcting the first draft, **one finding of real substance survived**:
`ShipLoadout.slots()` rebuilt and deep-froze on every call, in the hottest path a consumer
has. Everything else was a documentation nit, a small cleanup, or a test gap.

**That finding and three of the four smaller ones have since landed on `main`** (#220–#223)
and are verified in §4. `slots()` is now ~200× faster on repeat reads. One cleanup
(un-exporting four file-local types) and one deliberate feature question (whether slot
identifiers should tolerate whitespace) remain open.

The surface *is* large — 307 public symbols across 69 subpaths — but that is a stated
design requirement (`AGENTS.md:45`: "The public half of the map is enumerated, one subpath
per runtime module"), enforced by `npm run test:package`, and mirrored deliberately into
future language implementations. It is a cost the project has chosen with its eyes open,
not an accident to be cleaned up.

---

## 2. What makes sense

**The data layering is correct.** `ALL_MODULES`, `ALL_NEBULAE`, `ALL_MATERIALS` and
`ALL_COMMODITIES` are `Object.freeze([...A, ...B, ...C])` over the split catalogues
(`typescript/src/ships/modules-all.ts:43`, `typescript/src/astro/nebulae-all.ts:40`). No
record is emitted twice. Many data packages get this wrong and ship both.

**Bundle costs match the documented claims.** Measured minified ESM from `dist/`:

| Subpath | Measured | Doc claim |
| --- | --- | --- |
| `./ships` | 640.1 KiB | "pulls in every catalogue" ✓ |
| `./astro/nebulae-all` | 431.7 KiB | "~432 KiB bundled" ✓ |
| `./ships/modules-all` | 309.9 KiB | "310.8 KiB" ✓ |
| `./astro/codex-region-lookup` | 208.1 KiB | "map geometry is large" ✓ |
| `./ships/jump-range` | 1.5 KiB | "costs nothing but the function" ✓ |
| `./materials/materials` | 17.1 KiB | "16.9 KiB minified" ✓ |

`AGENTS.md:48` already carries these figures, including `ALL_NEBULAE`'s 431.7 KiB, with
the rule that neither the default-catalogue nor the required-catalogue decision may be
reversed without a fresh measurement. My numbers reproduce the project's own to 0.1 KiB —
which is a credit to the process, not a discovery.

**Tree-shaking works, and the docs already frame it correctly.** Across all 162 runtime
symbol/leaf pairs, importing from a barrel costs **at most 2 bytes** more than importing
from the leaf (160 identical in size; `decodeSystemAddress` +2 B and `ProceduralSystem`
+1 B are the only exceptions). `Getting-started.md:15` already distinguishes the bundler
case from native ESM, which is the case the leaf subpaths exist for. Recording the result
here as confirmation: the boundaries behave as designed.

**Discoverability is better than the export count suggests.** `Getting-started.md:54`
carries a "Where does a symbol live?" table for the symbols a consumer reaches for first,
and the generated wiki has hierarchical navigation via `_Sidebar.md`. A consumer is not
left to infer the map from 69 subpaths.

**Two identity spaces are named and kept apart.** `symbol` (item) vs `fdname` (recipe) is
explained in `typescript/src/ships/index.ts` and the README. `resolveBlueprintForModule`
exists for the three colliding journal spellings, with the collision table written out at
`typescript/src/ships/blueprint-journal.ts:29-40`.

**Units are stated at the point of use** — `optMass` in tonnes, `shieldRegenRate` in MJ/s,
resistances as fractions with the journal's `40`-vs-`0.4` scaling called out at
`typescript/src/ships/internal/loadout-metrics.ts:86-88`. This is the failure mode that
matters most in this domain, and it is handled well.

**The nullable-plus-diagnostic pair is a good pattern.** `cargoCapacity: number | null`
alongside `cargoCapacityResult` naming every unresolved rack
(`typescript/src/ships/ship-loadout.ts:630-636`) lets a consumer choose between a quick
number and an explainable one.

**Retail vs. source credits.** Keeping what a capture *paid* separate from what the build
is worth at *retail*, pinning each captured figure to the article it was paid for, and
exporting the capture's own figures only under `{ credits: 'source' }` is careful domain
modelling with its limits documented rather than hidden.

**Provenance ships with the package.** `copy-notices.mjs:43` copies `SNAPSHOTS.md` and
every domain's `SOURCES.md` into `PROVENANCE/`; `npm pack --dry-run` confirms
`PROVENANCE/SNAPSHOTS.md`, the four domain `SOURCES.md` files and
`THIRD_PARTY_NOTICES.md` are all in the tarball, and `README.md:136` links them. An npm
consumer can inspect data currency and licence terms without leaving the package.

---

## 3. Findings

### The one that matters — **fixed in #220**

**O1 — `ShipLoadout.slots()` rebuilt and deep-froze on every call.**
`typescript/src/ships/ship-loadout.ts:779-789` maps the layout, calls `fittedModuleAt` per
slot (which itself deep-freezes a fresh view), then deep-freezes the whole array.

```
build.slots() × 1000, four runs:  34.4 / 28.5 / 20.6 / 18.7 ms   (19–34 µs per call)
```

Confirmed uncached: `build.slots() === build.slots()` is `false`, and both the array and
its elements come back `Object.isFrozen`. An outfitting UI calls `slots()` on every render.

The class already had exactly the right machinery, twice over — `#validationCache` keyed on
`#version` and `#calculationCache`. Extending that pattern to `slots()` and
`fittedModuleAt` was contained, and did not touch the immutability guarantee: the values
were already frozen and documented as point-in-time, so sharing them between calls at the
same version is observationally identical.

**#220 went further than proposed, and correctly so.** Rather than reusing `#version`, it
introduced a separate `#viewVersion` alongside new `#fittedModuleCache` and `#slotCache`
(the latter keyed by `SlotKind`, so `slots('optional')` caches independently of `slots()`).
That separation matters: `#version` deliberately ignores `#patchModule`, but a
`LoadoutSlot` snapshot *does* expose `priority` and `on`, so a view cache keyed on
`#version` would have gone stale after `setModulePriority`. Verified below that it does
not.

### Documentation — **fixed in #221 and #223**

**F3 — an internal comment overclaimed.** `typescript/src/internal/registry-index.ts:24`
says "Every case-insensitive lookup in the library funnels through here". 71 ad-hoc
`.toLowerCase()` code sites outside that file do not (55 setting aside `sector-name.ts`'s
16 procedural-naming internals). *This is a documentation defect, not a broken contract* —
the README promises trimming for **registry lookups**, and the slot APIs document
case-insensitivity only. Behaviour, for the record:

```
getModuleBySymbol(' Int_Hyperdrive_Size6_Class5 ')  ->  'Frame Shift Drive'   (registry: trims)
build.setModule(' FrameShiftDrive ', fsd)           ->  RangeError            (slot: does not)
parseSlotName(' Slot01_Size6 ')                     ->  null
```

Two independent decisions: **narrow the comment** to what it governs, and separately decide
whether slot identifiers should become whitespace-tolerant. The second is a genuine open
question — a slot key arriving from a text field is plausible — but it is a feature call,
not a bug fix.

**#221 took the first and correctly left the second open.** The comment now scopes itself
to "the catalogue lookup helpers in this module" and names the exception explicitly:
"structural parsing and exact game slot identifiers … define their own normalization rules
at their public entry points." That is the accurate statement. Slot-key trimming remains
an open feature question, deliberately.

**Quote the figure in `pre-engineered-stats`'s header.** It cost 362.8 KiB and its header
said only that resolving stats "pulls in every module record" — qualitative, where
`materials.ts:30`, `nebulae-all.ts:6` and `ships/index.ts:142` all quote a number.
`AGENTS.md:48` asks for the measurement to be stated in the module's own docs.

**#223 did this and improved on the ask**, splitting the figure into the resolver alone
(334.4 KiB) and the subpath's complete runtime API (362.9 KiB) — a more useful distinction
than the single number I suggested, since most consumers import only the resolver.

### Cleanups

**Six file-local types carry a stray `export`** — `LoadoutExportShape`,
`LoadoutExportInput` (`internal/loadout-export.ts:18,25`), `ImportedLoadoutState`
(`internal/loadout-import.ts:32`), `KeyIndex` (`internal/registry-index.ts:12`),
`CatalogueDataTestOptions`/`CatalogueDataTestCase`
(`internal/catalogue-data-tests.ts:20,28`). Four can lose the keyword outright. `KeyIndex`
and `ImportedLoadoutState` cannot — they appear in exported function signatures
(`createKeyIndex`'s return, `findInKeyIndex`'s parameter, `normalizeLoadoutEvent`'s
return), so un-exporting them breaks declaration emit.

**A public getter with zero test coverage — fixed in #222.** `ProceduralSystem`'s
`massCode` was the only function the suite never executed, holding
`procedural-system.ts` at 94.44% function coverage while everything else sat at 100%. #222
added `procedural-system.test.ts`; that file now reports **100.00% function coverage**, as
does every other file in the project.

**There is no dead runtime code.** Four attempts to refute this failed:
`tsc --noUnusedLocals --noUnusedParameters` exits clean; a TypeScript-API scan of all 231
exported value declarations finds exactly one non-public export without a `src` consumer
(`registerCatalogueDataTests`, used by four test files); the suite passes 1972/1972 at
99.75% lines and 99.82% functions; and every uncovered line is a comment, an `import type`,
or an interface declaration.

### Nits, offered without a recommendation to act

**D1 — the index-or-scan branch appears eight times** (`commodities.ts:141,166`;
`materials.ts:206,230,255`; `micro-resources.ts:116,142`; `modules.ts:763`). Six are the
same shape; `materials.ts:255` is a multi-line variant and `modules.ts:763` already routes
through `builtInModuleBySymbol`. A factory would collapse them, but eight transparent
three-line branches are readable as they stand — this is a preference, not a defect.

**O3 — `findByRawKey` normalizes before its own fast path**
(`registry-index.ts:105-106`: `normalizeKey(wanted, label)` then
`Object.hasOwn(catalogue, wanted)` against the raw value). Reordering would skip the
normalize on hits — but the current order validates the argument before any property
access, which is a deliberate property worth more than an unmeasured micro-optimisation.
Not worth changing without a benchmark showing it matters.

---

## 4. Recommendations and status

| # | Recommendation | Status |
| --- | --- | --- |
| 1 | Cache `slots()` / `fittedModuleAt` per build version | **Landed — #220**, verified |
| 2 | Narrow the `registry-index.ts:24` comment to what it governs | **Landed — #221**, verified |
| 3 | Decide separately whether slot identifiers should trim | **Open by design** — a feature call, correctly left out of #221 |
| 4 | Add a `procedural-system.test.ts` covering `massCode` | **Landed — #222**, verified |
| 5 | Un-export the four safely un-exportable file-local types | **Open** — all six still carry `export` |
| 6 | Quote the bundle figure in `pre-engineered-stats`'s header | **Landed — #223**, verified |

### Verification at `542590d`

Fresh `npm ci` and `npm run build`, same method as the original measurements.

**#220 — slot snapshot caching.** Repeat reads are ~200× faster, and every correctness
property I would want holds:

| Check | Before (`8d26a51`) | After (`542590d`) |
| --- | --- | --- |
| `slots()` × 1000 | 18.7 – 34.4 ms | 1.4 ms cold, **0.1 ms warm** |
| `slots('optional')` × 1000 | — | 0.3 ms (cached independently) |
| `fittedModules()` × 1000 | 3.6 – 4.3 ms | 0.7 ms |
| `slots() === slots()` | `false` | `true` |
| `Object.isFrozen` on array and records | `true` | `true` — guarantee intact |
| New array after `setModule` | n/a | `true` — invalidates correctly |
| New array after `setModulePriority` | n/a | `true` — the `#viewVersion` split works |

That last row is the one worth calling out: had the cache been keyed on `#version` as I
originally suggested, a priority change would have served a stale snapshot, because
`LoadoutSlot` exposes `priority`. The implementation avoided that.

**#221 — normalization scope.** Comment now reads "The catalogue lookup helpers in this
module funnel consumer keys through here … structural parsing and exact game slot
identifiers define their own normalization rules at their public entry points." Accurate,
and it leaves the slot-trimming question open rather than pre-deciding it. Runtime
behaviour is unchanged, as intended for a docs-only fix.

**#222 — coverage.** Suite is **1973/1973 passing** (was 1972), and `procedural-system.ts`
reports **100.00% function coverage** (was 94.44%). Every file in the project is now at
100% functions.

**#223 — disclosed bundle cost.** Both figures reproduce exactly: resolver alone
**334.4 KiB**, full subpath API **362.8 KiB** against the stated 362.9. The gzip figure
needs a footnote — the header states 38.0 KiB, which is gzip level 9; at zlib's default
level 6 the same bundle is 39.3 KiB. Both are correct, but the level is worth stating
alongside the number if other headers use a different one.

**Still open (rec. 5).** All six file-local types retain their `export`:
`LoadoutExportShape`, `LoadoutExportInput` (`internal/loadout-export.ts`),
`ImportedLoadoutState` (`internal/loadout-import.ts`), `KeyIndex`
(`internal/registry-index.ts`), `CatalogueDataTestOptions` / `CatalogueDataTestCase`
(`internal/catalogue-data-tests.ts`). Four can drop the keyword outright; `KeyIndex` and
`ImportedLoadoutState` appear in exported function signatures and need the type inlined or
kept. Lowest-value item on the list, and the only one with no consumer-visible effect.

---

## 5. Withdrawn findings

Recorded so the errors are auditable rather than silently deleted.

| Withdrawn | Why it was wrong |
| --- | --- |
| "No map of which symbol lives where" | False. `Getting-started.md:54` has a "Where does a symbol live?" table; the wiki `_Sidebar.md` adds hierarchical navigation. I never opened `typescript/docs/guides/`. |
| "`Mod` is never expanded for the consumer" | False. `system-address.ts:8` calls it the "modulated" layout and `:278` explains what it is, who emits it, and when to prefer `decodeSystemAddress`. |
| "npm consumers cannot see data currency" | False. `PROVENANCE/SNAPSHOTS.md` and all four domain `SOURCES.md` ship in the tarball (`copy-notices.mjs:43`), linked from `README.md:136`. Confirmed via `npm pack --dry-run`. |
| "`SystemAddressInput` documented seven times" | Overstated. Seven subpaths re-export it, but TypeDoc owns it once — one wiki page. Re-exporting a parameter type beside the function that consumes it is good ergonomics, not duplication. |
| "Cut the surface to ~180 symbols / ~25 subpaths" | Conflicts with a documented requirement. `AGENTS.md:45` mandates one enumerated subpath per runtime module, enforced by `test:package` and mirrored into future languages. |
| "Rewrite the import guidance" | The guidance is already correct. `Getting-started.md:15` distinguishes bundler from native-ESM. My ≤2-byte result confirms bundlers work; it says nothing about whether native-ESM boundaries should exist. |
| "Drop the three `is*` predicates" | Boolean predicates are ergonomic API. Derivability is not redundancy. |
| "Eight weapon primitives duplicate `WeaponMetrics` fields" | Substantially false. `damageFalloff`, `armourPiercingFactor` and `splitDamage` are not fields at all — they take arguments (distance, hardness) the metrics object has no place for. The four DPS/energy/heat functions **are** the primitives `weaponMetrics` composes at `weapons.ts:473-496`. My "no internal callers" claim was an artifact of excluding the declaring file from the grep — which is exactly where the composition lives. |
| "Six permit-lock lookups where two would do" | They answer different input/output questions: exact system name, address, exact region name, region prefix. A decision table documenting a real distinction is not evidence of redundancy. |
| "Reduce the 20 exports on `./ships/slots`" | Type-only exports have no runtime cost, and named union members make narrowing and custom layouts easier than forcing `Extract<>` reconstruction. |
| "`getNebulaByName`'s required catalogue is inconsistent" | Intentional and mandated. `AGENTS.md:48` names `astro/nebulae` as the explicit counter-example to the default-catalogue rule, at the 431.7 KiB I independently measured. |
| "Weaken eager deep-freezing" | Not supported by the evidence I had. The cold-import figure (~51 ms for `./ships`) bundles parsing, module evaluation, index construction and freezing; it does not isolate `deepFreeze`. Catalogue immutability is an explicit guarantee (`AGENTS.md:167`) with `catalogue-immutability.test.ts` asserting it. An A/B profile is the prerequisite for reopening this. |
