# Library review — code and consumer perspective

A review of `@elite-dangerous-almanac/core` as it ships today, from two angles: an
outside Elite Dangerous app developer adopting it, and a maintainer looking for
optimisations, simplifications and code to delete.

Every figure was measured against a build of `main` (`7a194b0`), and every consumer
claim was executed rather than inferred. A first draft of this review was then put
through five independent adversarial verification passes; the corrections they
produced are folded in below, and the claims they refuted have been rewritten or
removed rather than softened. `npm run check` is green on a clean tree: 1917/1917
tests, 99.67% lines, 94.23% branches.

**Headline:** the library is in good shape, and the wins are mostly in *what gets
shipped* rather than in the source. There is a little genuinely dead code — seven
unreachable default-parameter initializers, proven removable — but no large
duplication and nothing structurally wrong. The build output, by contrast, carries
about two and a half times the bytes it needs to.

---

## 1. Verdict — is it well structured?

Yes. The feature-area split is predictable, the leaf-subpath story is real (a
feature barrel costs a consumer exactly what the leaf costs, measured across six
functions from 190 B to 646 KB), and the error contract, null-on-miss rule and
"omit, never zero" rule hold nearly everywhere. The barrel documentation teaches
the domain before the API, which most data libraries skip. I would adopt it as-is.

The friction that remains is not structural: redundant bytes in the published
package, one catalogue family that skips the project's own data-derivation
convention, and a vocabulary problem around blueprint ids that is real but subtler
than it first looks.

---

## 2. What makes sense — strengths worth protecting

**Tree-shaking is genuinely free, and better than the first draft of this review
claimed.** Importing through a feature barrel costs *nothing* over importing the
leaf — byte-identical at every size, confirmed with both esbuild and rollup:

| function | leaf | feature barrel |
| --- | --- | --- |
| `massCodeToSizeClass` | 190 B | 190 B |
| `getMaterialBySymbol` | 15,300 B | 15,300 B |
| `ProceduralSystem` | 101,551 B | 101,551 B |
| `ShipLoadout` | 646,239 B | 646,239 B |

This holds for bundlers that honour `sideEffects: false`; see F1 for what happens
when one does not.

**The error contract holds for the paths a consumer walks first.** Verified by
execution:

| Call | Result |
| --- | --- |
| `ProceduralSystem.fromName('Sol')` | `null` |
| `ProceduralSystem.fromSystemAddress(-1n)` | `RangeError: System address out of range…` |
| `toSystemAddress(2**53)` | `TypeError: Not a usable system address…` |
| `ShipLoadout.empty('NotAShip')` | `TypeError: no slot layout for hull "NotAShip"` |
| `build.setModule('Nope', m)` | `RangeError: hull "Anaconda" has no slot "Nope"` |

Around 110 further probes found lookups returning `null` for `''`, `'   '`, `null`,
`NaN` and out-of-range ids across every registry; deep-freeze holding under `push`
and element assignment; duplicate SLEF slots diagnosed by name. The README's
*universal* phrasing of the rule does not survive contact, though — see F7.

**Documented values are almost all correct.** 281 `// ->` claims were extracted and
executed from `src/**` examples, `docs/**`, and both READMEs. **280 matched.** For a
library with this much worked documentation that is a strong result. The one
mismatch is a real shipped bug — see F5.

**Catalogue composition shares records rather than copying them.** `ALL_MATERIALS`,
`ALL_MODULES` and `ALL_NEBULAE` (`src/materials/materials-all.ts`,
`src/ships/modules-all.ts`, `src/astro/nebulae-all.ts`) spread the split catalogues,
so every element is the *same frozen object* as in the source catalogue — verified
by reference identity across all 5835 nebula records. Only a new array of pointers
is allocated. (Importing `nebulae-all` still costs all three catalogues, as that
module's own doc says.)

**The barrel docs teach the domain.** `src/astro/index.ts:13-19` disambiguates the
four different things "region" means in this game before listing a single export;
`src/ships/index.ts:21-59` sorts 185 exports into five layers and says plainly which
one costs you the catalogues. `src/ships/engineering.ts:28-30, 68-69` documents that
capacity blueprints carry `BurstInterval` where the journal reports `RateOfFire` —
precisely the mismatch a consumer would otherwise waste a day on.

**Attribution ships in the package.** `THIRD_PARTY_NOTICES.md` is in `files`, the
shipped README links to it above the fold, and `package.test.mjs` enforces that
provenance links in the declarations are absolute URLs so a `node_modules` consumer
can follow them.

**Immutability is honest.** Catalogues are deeply frozen at load
(`src/internal/deep-freeze.ts`), and `FittedModule` / `LoadoutSlot` document that
they are detached point-in-time views, with a worked example of the trap
(`src/ships/loadout-slot.ts:41-61`).

---

## 3. What is confusing or not self-explaining

No blockers. A consumer can get started and will not ship a wrong number.

### Friction

**F1 — No root entry.** *(confusing, not wrong)*

`import { … } from '@elite-dangerous-almanac/core'` throws
`ERR_PACKAGE_PATH_NOT_EXPORTED`. It is the first thing a consumer types after the
install line, and there is no single place to browse the API.

A root entry costs bundler consumers nothing: importing `massCodeToSizeClass`
through a root barrel bundles to the same 190 B as the leaf, and the same holds up
to a 646 KB leaf, under esbuild and under rollup configured to honour
`sideEffects`. Total `dist` JS grows by 5.9 KiB.

**The caveat that decides it:** rollup *without* `@rollup/plugin-node-resolve`
never reads `sideEffects: false`, and then the root entry is catastrophic —
`massCodeToSizeClass` bundles to **788,830 B** instead of 188 B. The existing
feature barrels already carry this exposure (139 KB); a root entry raises the worst
case ~5.6×. So this is a judgement call about which consumers to optimise for, not
a free win.

*Fix if taken: restore a root entry re-exporting the four barrels, keep the
README's steer to leaf subpaths.* Reverses `7a194b0`, breaks **two** tests
(`package.test.mjs:518` "the package has no root entry" and #17 "every runtime
entry has one explicit public subpath"), and makes `/README.md:37` and
`/typescript/README.md:27` false.

**F2 — The recipe-id vocabulary, not `fdname` itself.** *(confusing)*

The first draft claimed `fdname` and `symbol` name the same concept and should be
unified. That is wrong: `symbol` is an *item* identity (ship, module, material,
commodity) while `fdname` is a *recipe* id from the journal's
`Engineering.BlueprintName`. They sit side by side in signatures that would collide
under a rename — `blueprintAvailableFor(item, fdname)`,
`getDecorativeModificationsForModule(symbol) → fdnames`,
`getBlueprintsForModule(symbol)` — and the upstream term is real
(`data/ships/SOURCES.md:1426-1431`).

What is genuinely wrong is smaller and fixable:

1. The library asserts a rule it does not keep. `src/materials/materials.ts:186` and
   `src/commodities/commodities.ts:120-121` both say `symbol` means Frontier's
   internal id **"in every catalogue"**. Blueprints are a catalogue and do not use it.
2. The two id spaces are never explained anywhere a consumer looks — `fdname`
   appears nowhere in `src/ships/index.ts` or either README.
3. The recipe id has **four** spellings across the public surface: `fdname`
   (`blueprints.ts:81`, `blueprint-costs.ts:72`, `ship-loadout.ts:262`),
   `blueprint` (`engineering-options.ts:335`), `blueprintName`
   (`ship-loadout.ts:971`) and `experimental` (`ship-loadout.ts:203`).

*Fix: narrow the materials/commodities sentence, add a short "two id spaces" note to
the ships barrel doc, and settle on one spelling for the recipe id.*

**F3 — Two catalogue shapes to learn.** *(confusing)*

Most catalogues are `readonly T[]` with a `getXBySymbol` lookup (22 of them). Seven
are `Readonly<Record<string, T>>` keyed by id: `BLUEPRINTS` (`blueprints.ts:62`),
`EXPERIMENTAL_EFFECTS` (`experimental-effects.ts:41`), `DECORATIVE_MODIFICATIONS`
(`decorative-modifications.ts:119`), `ENGINEERING_OPTION_GROUPS`
(`engineering-options.ts:170`, keyed by a literal union rather than `string`),
`BLUEPRINT_COSTS` (`blueprint-costs.ts:54`), `EXPERIMENTAL_EFFECT_COSTS`
(`experimental-effect-costs.ts:36`) and `SLOT_RESTRICTION_LABELS` (`slots.ts:103`).
So `.filter()`/`.find()` work on one half of the library and `Object.values()` is
needed for the other.

`findByRawKey` (`internal/registry-index.ts:60`) exists only to serve them, but has
five callers and `ENGINEERING_OPTION_GROUPS` is *not* among them — retiring it means
converting six catalogues, not four. *Fix: settle on `readonly T[]`, or state the
split as a deliberate rule in the ships barrel doc.*

**F4 — The package cannot state its own data currency offline.** *(gap)*

`typescript/THIRD_PARTY_NOTICES.md` carries no acquisition or snapshot date and no
version marker (it does carry upstream copyright years, so "zero dates" would be
too strong). Acquisition dates spanning **2026-07-24 … 2026-08-10** live in
`data/*/SOURCES.md`, which is not in `files`. No other route carries one: the
shipped README has no date string, no module exports a version constant, and
`package.json` is `0.1.0`.

A consumer is not cut off — the shipped README names `SOURCES.md` and the `.d.ts`
docs carry absolute GitHub links that `package.test.mjs` deliberately enforces. But
they cannot answer "how stale is this?" offline, or pin what snapshot a given
install contains. *Fix: `scripts/copy-notices.mjs` already runs at build time — have
it stamp a per-domain snapshot-date table into the shipped notices.*

**F5 — 313 documented value claims, ~280 of them unguarded — and one is already
wrong.** *(one real defect, plus maintenance risk)*

`scripts/check-examples.mjs` type-checks all 223 `@example` blocks in `src` (275
including `docs/`), but never evaluates them — its only child process is
`tsc --noEmit`. The hand-written test suite *does* pin about 30 documented values
deliberately, with comments saying so (`galaxy-grid.test.ts:48-56`,
`engineering-options.test.ts:379-383`, `system-name.test.ts:81-84`). So the gap is
~280 unpinned claims, not 313.

That gap has already produced a shipped bug. `src/ships/slef.ts:425` documents:

```ts
result.diagnostics[0]?.path; // -> 'entries[0]?.Modules[0]?.Item'
```

Executing that exact snippet returns `'entries[0].Modules[0].Item'`. The library
never emits `?.` in a diagnostic path; the expected value looks like a find/replace
that added optional chaining and struck the string literal too. `check-examples`
cannot catch it, because a string literal type-checks fine.

Note also that neither `/README.md` nor `/typescript/README.md` is type-checked at
all — `check-examples.mjs` covers `src/**` and `docs/**` only.

*Fix: execute snippets whose `// ->` line holds a literal and assert it, and extend
coverage to the two READMEs.*

**F6 — `ships` is 185 named exports on one barrel.** *(friction, mitigated)*

80 runtime values plus 105 types. The five-layer barrel doc
(`src/ships/index.ts:21-59`) is what makes this navigable, and it does the job. *Fix:
nothing urgent; if the surface grows, promote the layers to sub-barrels.*

**F7 — The README states an error contract the library does not universally keep.**
*(confusing; the code is mostly right, the blanket wording is not)*

Both READMEs say: *"Lookups return `null`; malformed inputs throw `TypeError`;
values outside a supported range throw `RangeError`."* Three classes of exception:

1. **`SyntaxError`, which is neither.** `parseSlef('')`, `parseSlef('not json')`,
   `inspectSlef('not json')` and `ShipLoadout.fromSlef('garbage')` all throw
   `SyntaxError`. This is the single most likely bad input a consumer has — a SLEF
   or journal string off disk — and a consumer writing
   `catch (e) { if (e instanceof TypeError) … }` will miss it. It *is* documented
   per-function (`@throws {SyntaxError}` on `inspectSlef`); the README is what
   over-promises.
2. **Out-of-range values that silently answer instead of throwing.**
   `lettersToBoxelCode(-1, 0, 0, 0)` returns `-1`; `lettersToBoxelCode(26, …)`
   returns `26`; `boxelCodeToLetters(-1)` returns an `l1` outside its own documented
   `0`–`25`. There is no guard in `astro/internal/system-name-code.ts:2`, while the
   immediate neighbour `sectorNameFromGridPosition` *does* throw `RangeError` on a
   bad index — so this is an inconsistency within one module, not a design stance.
3. **Unguarded internal `TypeError`s with unhelpful messages.**
   `ProceduralSystem.fromName(42)` → `s.toLowerCase is not a function`;
   `ShipLoadout.empty(42)` → `value?.trim is not a function`;
   `build.setModule(slot, {})` → `Cannot read properties of undefined`. The error
   *class* is right, so the contract's letter holds, but "messages that name the
   offending value" does not. (`setModule(slot, null)` is handled properly.)

*Fix: correct the README sentence to name `SyntaxError`; add a range guard to
`lettersToBoxelCode`/`boxelCodeToLetters`; add input guards on the string entry
points.*

### Polish

- **P1** — `SystemAddressInput` is re-exported from
  `src/astro/permit-locked-systems.ts:14` and again from `permit-locks.ts:64`, while
  `system-address.ts:24`, `procedural-system.ts:36` and `codex-region-lookup.ts:29`
  all take the type and do not re-export it. Partly load-bearing (it saves a second
  import on two leaf entries) but inconsistent.
- **P2** — `getShipBySymbol` (`src/ships/ships.ts:150`) has no optional narrowing
  catalogue argument, while `getModuleBySymbol` (`modules.ts:754`),
  `getMaterialBySymbol` (`materials.ts:201`), `getCommodityBySymbol`
  (`commodities.ts:136`) and `getMicroResourceBySymbol` (`micro-resources.ts:111`)
  all do. Justified (the hull catalogue is small) but unexplained.
- **P3** — `WeaponStats`'s header (`weapons.ts:53`) promises "a missing field takes
  the neutral default noted below", but 5 of its 19 fields state no default:
  `chargeTime`, `maximumRange`, `falloffRange`, `projectileRange`, `armourPiercing`.

---

## 4. Code perspective — optimisations and simplifications

### C1 — Keep the source maps; the redundancy is in what they map

**Keep `sourcemap: true`.** The maps earn their place. Under `--enable-source-maps`
against the shipped tarball:

```
without:  at #requireSlot (…/dist/chunk-WGJWNMGR.js:1914:13)
with:     at _ShipLoadout.#requireSlot (…/src/ships/ship-loadout.ts:1619:19)
```

`sourcesContent: false` costs only the inline code frame, not the remapping, so
this works even though `src/` is not published.

The finding is about *what* the 2.98 MiB of mappings describes. Decoding every map
in `dist` and attributing each segment to its source:

| Segments map into | Count | Mapping bytes |
| --- | --- | --- |
| `.jsonc` data literals | 574,129 (94%) | **2.79 MiB** |
| `.ts` source | 35,313 (6%) | **0.17 MiB** |

Every stack frame a consumer will ever see lands in the second row. A prototype
post-build pass that drops `.jsonc` sources and re-encodes the mappings (~25 lines,
using `@jridgewell/sourcemap-codec`, already a devDependency) took maps from 2.98
MiB to **0.27 MiB** with a byte-identical remapped frame, and unpacked size from 6.5
MB to 3.6 MB.

**But this conflicts with an explicit project decision.** `package.test.mjs:654`
is a test named *"engineering cost source maps retain TypeScript and JSONC source
paths"* — it requires `data/ships/blueprint-costs.jsonc` and
`data/ships/experimental-effect-costs.jsonc` to remain in `map.sources`. Someone
decided data provenance in the maps matters. So this is not a free win: it needs a
decision about why that test exists, and either an exemption for those two files or
a deliberate reversal.

### C2 — Stop pretty-printing the inlined data *(−33% of shipped JS)*

`tsup.config.ts:52-55` keeps `minify: false` so stack traces and files opened from
`node_modules` stay readable. That reasoning is right for code and wrong for the
inlined JSONC catalogues, which dominate the output and which nobody reads.

Measured across `dist`: **624,255 B of leading indentation (21.9%) plus 97,729 B of
newlines (3.4%)** — 25.4% combined. `dist/astro/codex-region-lookup.js` is 462,161 B,
of which 219,924 B (47.6%) is indentation.

Setting `minifyWhitespace: true` (identifiers and syntax intact, so stack-trace
names survive):

| | before | after |
| --- | --- | --- |
| `dist` JS | 2,847,423 B | **1,919,816 B** (−32.6%) |
| unpacked | 6.45 MB | 4.95 MB |

Behaviour identical: catalogue counts, error contract, and `--enable-source-maps`
still remapping to `ship-loadout.ts:1619:19`.

**One test breaks.** `package.test.mjs:301` asserts the reachable lookup graph
exceeds 400 KiB; whitespace-minified it is 215.5 KiB, so `test:package` goes 26/26 →
25/1. The threshold needs re-baselining — small, but it is not a zero-risk change.

### C3 — Nebula records carry ~37% redundancy, against a convention the project
already has

`data/astro/nebulae-planetary.jsonc` is the largest file in the repo (827,381 B,
5489 records). Two of its seven fields are derivable:

| Redundancy | Evidence | Share of compact JSON |
| --- | --- | --- |
| `type` is constant per file | 5489/5489 planetary, 180/180 real, 166/166 procgen | **14.1%** |
| `system` duplicates `name` | 5210/5489 planetary (94.9%); **0** in real and procgen | **22.9%** |
| combined | | **37.0%** |

On a real esbuild bundle the combined saving is **273 KB (36.5%)**, not the ~280 KB
first claimed. Note the `system` half is **planetary-only**, and that
`galaxy-grid.test.ts:80-86` genuinely parses `record.system` for real and procgen —
safe only because those files have no `system === name` records.

The project already solves this elsewhere: `module-catalogue.ts:32` stamps
`category` from the file a record came from, `commodity-catalogue.ts:13` stamps
`rare`, `material-catalogue.ts` stamps `category`. **Two** domains skip the helper
and cast raw JSON — the nebulae (`nebulae-real.ts:36` and siblings) *and*
micro-resources (`micro-resources-{component,consumable,data,item}.ts:29`, each with
a constant `category`; only 3.7 kB, but the same inconsistency).

*Fix: add stamping helpers for both.* Three things the first draft missed:
`schemas/astro/catalogues.schema.json` pins `type` in `required` with
`additionalProperties: false` and is validated by `src/astro/data-files.test.ts:38-40`,
so the schema must change too; `nebulae.test.ts:49` currently asserts `nebula.type`
per record and would become tautological, so the data's correctness needs a new
guard; and this saving is **not additive** with C2 — after `minifyWhitespace` it
drops from 273 KB to ~252 KB.

### C4 — Weapon stat fields declared twice

`OutfittingModuleStats` (`modules.ts:402-714`, weapons section `619-713`) and
`WeaponStats` (`weapons.ts:54-107`) declare **19** shared optional weapon fields
independently. `weapons.ts:44` already imports types from `./modules.js`, so no new
dependency is needed.

They are not identical: `OutfittingModuleStats` is a strict superset, carrying
`shotSpeed` (`modules.ts:711`) and `jitter` (`modules.ts:713`) besides — and
`powerDraw` sits at `modules.ts:411` in the *common* section, so a `Pick<>` list has
to reach outside the weapon block. A key-set-equality assertion over all 19 names
compiles clean, so `Pick<OutfittingModuleStats, …19…>` *is* an exact drop-in.

**The obvious fix contradicts itself, though.** A `Pick<>` has nowhere to hang
per-field JSDoc, so the 19 calculation-contract docs in `weapons.ts:56-105`
("Defaults to `0`", "Absent means the weapon never stops to reload") would be lost —
or restated, which reintroduces the list. Either accept losing them (documenting
defaults on `weaponMetrics` instead), or leave the duplication and add a test
asserting the two key sets stay equal.

There is **no live doc drift** between the two — the first draft claimed
`roundsPerShot` had drifted ("Absent means one round per shot" vs "Defaults to
`1`"), but those state the same fact in two phrasings, and a diff of all 19 pairs
found no factual contradiction. The argument for deduplicating is future drift risk,
not present damage.

### C5 — Dead code: seven unreachable defaults, proven removable

`src/ships/internal/loadout-metrics.ts` carries seven default-parameter
initializers, all `= builtInModuleBySymbol(module.Item)`, at lines **94, 221, 272,
313, 365, 440, 535** (as arrows at 313/365/440), plus the now-unneeded import at
**line 25**. Every one of the 26 call sites in the library and the tests passes the
argument explicitly, so no default is ever taken:

| function | line | call sites | min args supplied |
| --- | --- | --- | --- |
| `effectiveStat` | 91 | 14 | 3 (param #2) |
| `effectiveModule` | 219 | 4 | 2 (param #1) |
| `powerConsumerFor` | 270 | 1 | 2 (param #1) |
| `powerAvailable` | 310 | 1 | 2 (param #1) |
| `shieldInputFor` | 360 | 1 | 4 (param #3) |
| `armourInputFor` | 436 | 1 | 3 (param #2) |
| `weaponStatsFor` | 533 | 4 | 2 (param #1) |

Confirmed three ways: an AST call-site census flags exactly these seven; lcov
`FNDA:0` independently shows the three arrow initializers are never invoked; and a
removal experiment leaves `tsc --noEmit` clean with **1917/1917 tests passing** and
function coverage *rising* 98.91% → 99.45% — the removed initializers were the
uncovered functions.

This is worth more than the nine lines. The defaults quietly promise "omit `stats`
and I'll look up the built-in catalogue", which would silently discard a caller's own
catalogue or resolved pre-engineered stats. Making the parameter required is what
all 26 call sites already do. `ships/internal/*` is mapped to `null` in `exports`, so
there is no public API impact.

Also: `effectiveStat` (`loadout-metrics.ts:91`) is exported but imported by nothing,
not even a test — drop the `export`.

Everything else checked out clean: no unused non-exported symbols
(`noUnusedLocals` is on and `tsc` is clean), no transitively dead helper clusters,
no never-supplied optional parameters, and all 27 apparently-unread interface fields
are data-backed published catalogue attributes.

### C6 — Eight repeated lookup bodies, and why to leave them

Four domains hand-write the same shape:

```ts
return catalogue === DEFAULT
    ? findInKeyIndex(INDEX, wanted)
    : findByKey(catalogue, field, wanted);
```

**8 bodies, 24 lines, ~150 lines of attached docs** (`materials.ts:201, 223, 246`;
`micro-resources.ts:111, 135`; `commodities.ts:136, 159`; `modules.ts:754`).

**Leave it** — but for a better reason than "a factory would hurt editor hover",
which is a strawman (the natural refactor keeps the named function and swaps only
the body). The real reason: the `catalogue === ALL_X` check is an *identity* test,
and that identity is the safety invariant — it is what makes answering from the
prebuilt index sound, because a caller-supplied array must never be served from the
built-in index. A `createLookup(all, index, field)` factory takes three parameters
the type system cannot prove correspond; one mismatched pair silently returns wrong
records for a whole domain. Inline, the invariant is checkable in three lines.
Separately, `getModuleBySymbol` uses a different fast path
(`builtInModuleBySymbol`), so it would not fit a uniform factory anyway.

### C7 — Two real duplications inside `ship-loadout.ts`

Both are same-file and invisible to a cross-file duplicate detector.

- **The `#require*` triplet.** `ship-loadout.ts:1635 #requireMass`,
  `:1646 #requireFuelCapacity`, `:1657 #requireCargoCapacity` are three identical
  9-line unwrap-or-throw bodies differing only in the source getter and one noun,
  with the error format written out three times (`:1639`, `:1650`, `:1661`). A
  `#require<T>(result, what)` helper takes 27 lines to ~12 and makes the message
  format structural.
- **The fitted-module lookup idiom, repeated 6× verbatim** at `:772-773`,
  `:833-834`, `:857-858`, `:1006-1007`, `:1131-1132`, `:1203-1204`:
  ```ts
  const key = this.#fittedKey(slotKey);
  const module = key === null ? undefined : this.#modules.get(key);
  ```
  A one-line `#fittedModuleFor(slotKey)` private collapses 12 lines to 6.

Otherwise the "essentially no duplication" verdict holds: across 203 functions only
18 pairs exceed 0.60 similarity, and the rest are either data tables
(`astro/sector-name.ts` fragment strings), already-factored guard chains
(`slef.ts` `diagnose*`), or deliberately parallel domain helpers.

### C8 — Every JS artifact carries `//# sourceMappingURL=` twice

All 135 files (69 entries, 66 chunks), the second without a trailing newline.
Traced to `tsup` itself, not the post-build passes — the duplication is present
after `npx tsup` alone. Cosmetic, ~5 kB, but nobody has noticed it.

### C9 — Bespoke tooling is the real maintenance load

Roughly 2,400 lines of repository-only tooling support a 21,000-line library:
`package.test.mjs` (832), `check-examples.mjs` (430), `build-wiki-sidebar.mjs` (407),
`generate-schema-and-types.mjs` (373), plus three post-`tsup` passes. Each has a
defensible reason, and `package.test.mjs` in particular encodes bundle-graph
guarantees that would otherwise regress silently — as this review found repeatedly,
it is also where the project's decisions are recorded. But it is where a second
maintainer's time will go, and C1's proposed fix would add a fourth pass.

---

## 5. Recommendations, highest impact first

| # | Change | Effect | Risk |
| --- | --- | --- | --- |
| 1 | Fix the wrong documented value at `slef.ts:425` — **F5** | removes a shipped doc bug | none |
| 2 | Delete the seven dead defaults + the stray `export` in `loadout-metrics.ts` — **C5** | removes a silent-wrong-answer footgun; function coverage +0.54pp | none; proven with 1917/1917 |
| 3 | `minifyWhitespace: true` — **C2** | −33% shipped JS; 6.45 → 4.95 MB unpacked | re-baseline `package.test.mjs:301` |
| 4 | Stamp `type`/`system` for nebulae and `category` for micro-resources — **C3** | −273 KB (−252 KB after #3); makes five data domains consistent | schema + test changes needed |
| 5 | Correct the README error contract; guard `lettersToBoxelCode` — **F7** | stops a documented rule being wrong about `SyntaxError` | low |
| 6 | Execute `// ->` claims in `check-examples.mjs`, incl. both READMEs — **F5** | ~280 unpinned doc promises become tests | none |
| 7 | Stamp data snapshot dates into `THIRD_PARTY_NOTICES.md` — **F4** | package can answer its own currency offline | none |
| 8 | Narrow the "every catalogue" sentence; document the two id spaces; unify the recipe-id spelling — **F2** | removes a self-contradiction and three redundant spellings | low |
| 9 | Extract `#require<T>` and `#fittedModuleFor` in `ship-loadout.ts` — **C7** | −21 lines, one error format instead of three | none |
| 10 | Prune `.jsonc` mappings from the source maps — **C1** | maps 2.98 → 0.27 MiB; 6.5 → 3.6 MB unpacked | conflicts with `package.test.mjs:654`; adds a fourth build pass |
| 11 | Restore a root entry — **F1** | removes the first-five-minutes stumble | breaks 2 tests, 2 README lines; 5.6× worst case on bundlers ignoring `sideEffects` |
| 12 | Unify the engineering catalogues on `readonly T[]` — **F3** | one catalogue shape; retires `findByRawKey` | breaking; six catalogues |

Items 1, 2, 6, 7 and 9 are unambiguous and carry no trade-off. Item 3 is the largest
single byte win and costs one threshold update. Items 10, 11 and 12 each reverse a
decision the project made deliberately and tested for — they may still be right,
but they should be taken as decisions rather than cleanups.
