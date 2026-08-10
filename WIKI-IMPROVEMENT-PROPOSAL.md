# Wiki improvement proposal — worked samples for modules and classes

A review of the generated wiki against what a consumer needs when they land on it. The
headline finding: **the wiki explains symbols well and demonstrates them badly, and the
gap is worst exactly where the library is hardest** — the two large feature areas and
the classes.

Measured against `d5cace1` (`typescript/docs/wiki`, regenerated with `npm run docs`).
The measurement is named next to each claim so it can be re-run. Where a claim is about
prose rather than a count, it is marked as editorial rather than measured.

---

## 1. What the wiki looks like today

|                                         |                                                             |
| --------------------------------------- | ----------------------------------------------------------- |
| Total pages                             | 307 — `Home`, `_Sidebar`, 11 module pages, 294 symbol pages |
| Function pages with no example          | 24 of 127                                                   |
| Class/interface members with an example | 25 of 89                                                    |
| `@example` blocks in source             | 200                                                         |
| `@example` blocks that compile today    | 10 of 200                                                   |
| Hand-written guide pages                | 0                                                           |
| Task-oriented pages ("how do I…")       | 0                                                           |

Reproduce the page count from a clone of the wiki, or from `typescript/docs/wiki` after
`npm run docs`:

```bash
ls *.md | wc -l                                        # 307
for f in *.Function.*.md; do grep -q Example "$f" || echo "$f"; done | wc -l   # 24
```

A note on one metric that looks worse than it is: 140 of 307 pages contain no fenced code
block, but 105 of those are Interface, TypeAlias, Variable and Enumeration pages whose
entire content _is_ the signature, which the theme renders as blockquotes rather than
fences. "No fence" is not "no code". The diagnostic subset is the 24 example-less
function pages, the module pages and `Home` — roughly 30 pages, not 140. Earlier drafts
of this document led with the 46% figure; it is rhetoric, not evidence.

The generation pipeline is TypeDoc with `typedoc-plugin-markdown` and
`typedoc-github-wiki-theme`, run by `npm run docs` (TypeDoc, then
`scripts/postprocess-wiki.mjs`, which fails the build on any generated link to a missing
page) and published by `.github/workflows/publish-wiki.yml`. Everything proposed here is
authored in the repository and generated into the wiki, in keeping with `AGENTS.md`
("never hand-edit generated wiki pages").

**This is a convention gap, not only a nice-to-have.** `CONTRIBUTING.md:38` already
requires "inputs, result, units, failure behavior **and an example**" for every public
API, and `AGENTS.md:65` says the same. The 24 example-less function pages and the 64
example-less class members are existing violations of the repository's own stated rule.

---

## 2. The gaps, in priority order

### Gap 1 — The two hard module pages carry no code at all

`materials.md` and `commodities.md` — the two small, obvious feature areas — carry two
code blocks each. `astro.md` and `ships.md` — the two areas a consumer actually needs
help with — carry **zero**.

| Module page      | Total lines | Prose lines before the symbol index | Code blocks |
| ---------------- | ----------: | ----------------------------------: | ----------: |
| `ships.md`       |         257 |                                  64 |       **0** |
| `astro.md`       |         130 |                                  40 |       **0** |
| `materials.md`   |          75 |                                  37 |           2 |
| `commodities.md` |          51 |                                  32 |           2 |

The prose column is the honest one: most of a module page's length is its alphabetised
symbol index, so quoting total lines overstates the contrast roughly twofold. The real
contrast is 64 prose lines with no sample against 37 with two.

Both pages are dense orientation prose — `astro.md` untangles the four meanings of
"region", `ships.md` lays out the five layers of the area — and both ask the reader to
hold a paragraph of distinctions in their head with nothing to run.

**Fix.** Add `@example` blocks to the `@packageDocumentation` in `src/astro/index.ts` and
`src/ships/index.ts`. Both are TypeDoc entry points, so examples added there publish
directly to `astro.md` and `ships.md`. These are the highest-leverage samples in the
project: they are the first page after `Home` for anyone exploring an area. Each
distinction the prose draws should have a snippet under it — for `astro.md`, one worked
example per meaning of "region" and one showing `GalacticPosition` against
`SectorGridPosition`; for `ships.md`, one snippet per layer (whole-build facade,
catalogue lookup, data-free calculation, engineering) so the "drop to the pieces" advice
is demonstrated rather than asserted.

### Gap 2 — 16 module-level examples are written but never published

66 leaf modules carry a file-level `@packageDocumentation` block, and 16 of those blocks
contain an `@example`. **None of them reach the wiki**, because the leaf's own
documentation is dropped when its symbols are re-exported through a barrel that is the
entry point.

```bash
cd typescript/src
grep -rl "@packageDocumentation" --include=*.ts . | wc -l          # 71, including 5 barrels
grep -c "slefJsonString" ../docs/wiki/*.md | grep -v ':0' | wc -l  # 0 — the block never lands
```

The unpublished blocks: `ships/ship-loadout`, `ships/power`, `ships/shields`,
`ships/armour`, `ships/weapons`, `ships/resistances`, `ships/ammunition`,
`ships/engineering`, `ships/modules`, `ships/module-capabilities`,
`ships/source-purchase`, `astro/nebulae`, `astro/permit-locks`, `materials/materials`,
`materials/micro-resources`, `commodities/commodities`.

The `ship-loadout` one is the best worked example in the codebase — read a build, then
assemble one, with imports and annotated results
(`typescript/src/ships/ship-loadout.ts:40`). It is invisible on the wiki.

**Fix.** Promote the orientation examples to a surface that publishes: up into the barrel
`@packageDocumentation` (Gap 1) or onto the class or function they describe (Gap 3), and
add the module walkthroughs as guide pages (Gap 5). **Not** by adding these leaves as
entry points — see section 4, which is a conditional rule, not a blanket one.

### Gap 3 — Class and view pages are the least sampled pages in the wiki

The classes and the two loadout views are the library's main entry points. Their
member-level sample coverage:

| Page                               | Members | Members with an example | Top-level example |
| ---------------------------------- | ------: | ----------------------: | ----------------- |
| `ships.Class.ShipLoadout`          |      48 |                      17 | **none**          |
| `ships.Interface.FittedModule`     |      12 |                   **0** | yes               |
| `astro.Class.ProceduralSystem`     |      13 |                       4 | yes               |
| `ships.Class.SourcePurchaseRecord` |       9 |                       4 | **none**          |
| `ships.Interface.LoadoutSlot`      |       7 |                   **0** | **none**          |
| **Total**                          |  **89** |            **25 (28%)** | 2 of 5            |

By contrast 103 of 127 function pages (81%) carry an example. The pattern is that a
function got documented as a unit and a class did not.

`FittedModule` and `LoadoutSlot` became immutable view interfaces in #117, so they are no
longer classes — but they are still what a consumer meets the moment they iterate a
build (`slots()` returns `readonly LoadoutSlot[]`; `FittedModule` arrives via
`fittedModules()`, `fittedModuleAt()` or `LoadoutSlot.module`). Between them: **19
members, zero member examples**, and `LoadoutSlot` has no example at any level.

Most pointed: **`ShipLoadout` — the flagship facade, a 1424-line page — has no
class-level `@example`.** It opens with remarks on how jump calculations resolve FSD
constants, then goes straight into 18 accessors and 30 methods. A consumer arriving from
`ships.md` gets no end-to-end sample of the object they were just told to start with.

**Fix.**

1. **A top-level `@example` on the three that lack one** — `ShipLoadout`,
   `SourcePurchaseRecord`, `LoadoutSlot` — showing the object's life cycle: construct →
   inspect → mutate → export. For `ShipLoadout` this is the highest-value single snippet
   in the library.
2. **Examples on the members that encode a design decision**, not on all 89. The priority
   members are the ones whose documentation already warns about something: the
   nullable-convenience / diagnostic-result pairs (`cargoCapacity` against
   `cargoCapacityResult`), `validation`, `sourcePurchase`, `frameShiftDrive` (which
   throws), `slots(kind?)` and `modulesForSlot` (slot keys are not derivable from
   position), and `toLoadoutEvent({ credits })`.
3. **`FittedModule` and `LoadoutSlot` need the most work per member** — 19 members, zero
   examples, and every consumer who walks a build meets them.

### Gap 4 — The existing samples do not compile

Of the 200 `@example` blocks:

- **182 (91%) contain no `import` line** — they cannot be copied and run.
- **148 (74%) are three code lines or fewer** — typically one call and a `// -> value`
  comment.
- **190 of 200 fail `tsc --noEmit` when extracted** (401 errors, overwhelmingly `TS2304:
Cannot find name` for bindings the snippet never declares: `build`, `slefJsonString`,
  `module`, `weapon`). Only **10 compile**.
- **None are compiled or executed by any check.** `typescript/scripts/` holds no
  example-extraction tooling, and `npm run check` is `lint && format:check && typecheck
&& test`.

A one-line `// -> 89.41` is a good _assertion_ about behaviour and a poor _sample_. It
tells a reader what a call returns; it does not tell them what to import or what to feed
it. The proposal's own exemplar — the `ship-loadout` block — is among the 190 that fail,
because `slefJsonString` is never declared.

**Fix.**

1. **A house shape for a sample**: import line, declared inputs, call, annotated result —
   pasteable into a fresh file.
2. **Rewrite the samples first, then gate.** Add `scripts/check-examples.mjs` that
   extracts every ` ```ts ` fence from an `@example`, rewrites the package specifier to a
   relative source path, and runs `tsc --noEmit` over the set. **It cannot be wired into
   `npm run check` until the rewrite lands** — switching it on today turns CI red on 190
   of 200 examples. Ship it report-only with a ratchet on the failure count, and flip it
   to blocking when the count reaches zero.
3. **Feed samples from `fixtures/`.** 19 real journal captures live in
   `fixtures/ships/journal-*.json` and their values are pinned by tests, so a sample built
   on a named fixture gets a real number in its `// ->` comment and a test that keeps it
   true.

### Gap 5 — No task-oriented pages, no root-barrel page, and an unhelpful `Home`

**`Home.md` is a bare list of 11 module links** with no install line, no first snippet,
no orientation and no link back to the README. It got _less_ useful after #114: 7 of its
11 entries are now bulk data catalogues (`ships/modules-core`, `astro/nebulae-all`, …)
that a newcomer must specifically not start with.

**The root entry point has no wiki page at all.** `package.json` exports `"."`, and
`src/index.ts` carries a full `@packageDocumentation` ("Prefer a subpath import…"), but
it is not a TypeDoc entry point — so a consumer who writes
`import { … } from '@elite-dangerous-almanac/core'` finds nothing. Adding it as an entry
point is exactly the unsafe case in section 4 (it re-exports all four barrels), so this
has to be solved by a guide page.

**The wiki never names an import specifier.** Both `astro.md` and `ships.md` say "every
symbol is also reachable from its own module" and then name no module. There is no
symbol → subpath map anywhere in 307 pages. Post-#114 that is load-bearing rather than
cosmetic, because `ALL_NEBULAE` and the five module catalogues are _only_ reachable by
subpath.

**The seven new catalogue pages are orphans.** `_Sidebar.md` still lists exactly four
modules; the catalogue pages are linked only from `Home` and their own symbol page.
`astro.Function.nearestNebulae` tells you to pass `ALL_NEBULAE` as unlinked code text,
because it is no longer in `astro`'s link scope.

Finally, the wiki is 100% symbol-indexed. Every page answers "what is X". Nothing answers
"how do I read a player's journal", "how do I turn an id64 into a name and back", "how do
I show an outfitting screen's numbers".

**Fix — verified against this exact plugin stack.** TypeDoc 0.28's `projectDocuments`
renders hand-written Markdown into the wiki as generated pages:

```jsonc
// typescript/typedoc.json
"projectDocuments": ["docs/guides/*.md"]
```

Tested: it produces `Document.<Name>.md`, links them from `Home.md` under a **Documents**
heading, adds them to `_Sidebar.md`, and resolves `{@link ships.ShipLoadout}` to the real
symbol page, with zero broken links. Guide sources live in `typescript/docs/guides/` under
review like any other file, so nothing is hand-edited in the wiki.

Proposed initial guide set:

| Guide                         | Covers                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Getting started               | install, the root import against subpath imports, **the symbol → subpath map**, first snippet per area, bundle-size guidance |
| Reading a player journal      | `Loadout` event → `ShipLoadout`, `FSDJump` → `ProceduralSystem`, what to do with unknown symbols                             |
| Working with SLEF             | `parseSlef` against `inspectSlef`, round-tripping, `credits: "source"` and what a capture does and does not price            |
| Building an outfitting screen | slots → `modulesForSlot` → `setModule` → `powerBudget`/`shieldMetrics`/`weaponMetrics`, end to end                           |
| Systems, sectors and regions  | the four meanings of "region", both coordinate spaces, id64 round-trip, permit locks                                         |
| Failure model                 | `null` against `TypeError` against `RangeError`, the `…Result` diagnostic pairs, `validation` against `complete`             |

**Do not use TypeDoc's `readme` option to enrich `Home`.** An earlier draft proposed it;
testing shows it _replaces_ `Home` rather than adding to it — the module index moves to a
new orphan page `modules.md`, and the breadcrumb on **all 307 pages** is rewritten from
`../wiki/Home` to `../wiki/modules`. Let the Getting started guide sit first under
**Documents** instead.

### Gap 6 — Nothing fails when a cross-link breaks

`typedoc.json` does not set `treatWarningsAsErrors`, so an unresolved `{@link}` prints a
warning and TypeDoc still exits 0. `postprocess-wiki.mjs` validates _generated_ links but
never sees unresolved ones. The current configuration produces **zero warnings**, so
turning the flag on is free today and permanently locks in cross-link integrity. One
line, no migration.

---

## 3. Suggested sequence

Ordered by consumer impact per unit of work. Every step is independently shippable except
where noted.

| #   | Change                                                                                         | Where                                      |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Top-level `@example` on `ShipLoadout`, `SourcePurchaseRecord`, `LoadoutSlot`                   | `src/**/*.ts`                              |
| 2   | Code samples in the `astro` and `ships` barrel `@packageDocumentation`                         | `src/astro/index.ts`, `src/ships/index.ts` |
| 3   | `treatWarningsAsErrors: true` (free today — zero warnings)                                     | `typedoc.json`                             |
| 4   | `projectDocuments` wired up; Getting started (with the subpath map) + Reading a player journal | `typedoc.json`, `docs/guides/`             |
| 5   | Examples on the ~20 members that document a trap; fill the 24 example-less functions           | `src/**/*.ts`                              |
| 6   | Give the 7 orphaned catalogue pages a route in from `astro.md`/`ships.md`                      | `src/astro/index.ts`, `src/ships/index.ts` |
| 7   | Rewrite the 190 non-compiling examples to declare their inputs                                 | `src/**/*.ts`                              |
| 8   | `check-examples.mjs` — report-only, then blocking once step 7 lands                            | `scripts/`                                 |
| 9   | Remaining four guides                                                                          | `docs/guides/`                             |

Steps 1, 2 and 4 address "extensive samples for modules and classes" directly. **Step 8
depends on step 7** and cannot ship before it; an earlier draft had them inverted and
claimed every step was independent, which would have turned CI red on 190 examples.

## 4. Adding leaf modules as TypeDoc entry points — a conditional rule

**A leaf module is safe as an entry point if and only if none of its exported symbols is
reachable from another entry point.** TypeDoc attributes each symbol to exactly one
owning module, and the declaring entry point beats a re-exporting one.

- `ALL_NEBULAE` is declared in `nebulae-all.ts` and, since #114, is _not_ exported by
  `astro/index.ts`. Adding that entry point creates a new page and moves nothing else.
  This is what `d5cace1` did, and it was correct.
- `ShipLoadout` is declared in `ship-loadout.ts` **and** re-exported by `ships/index.ts`.
  Adding `ship-loadout.ts` as an entry point relocates 15 pages to `ships.ship-loadout.*`
  and produces 6 unresolved `{@link}` warnings that CI does not fail on.

The decisive harm in the collision case is not the broken URLs — nothing outside
`docs/wiki` deep-links a symbol page, and `README.md` links only the wiki root. It is
that **`ships.md` loses `ShipLoadout` from its `## Classes` index entirely**, demoting it
to a `## References` footnote at the bottom of the page. Verified: baseline `ships.md`
lists `ShipLoadout` and `SourcePurchaseRecord` under Classes; with the leaf entry point it
lists only `SourcePurchaseRecord`. The first page a consumer reads stops naming the class
it tells them to start with.

So the Gap 2 examples must be rescued into the barrels and guides. That is an argument
about _collision_, not about entry points as such.

**Related repo defect, worth fixing regardless of this proposal:** `AGENTS.md:85` still
says `typedoc.json` lists "one entry point per feature module (`src/astro/index.ts`,
`src/commodities/index.ts`, `src/materials/index.ts`, `src/ships/index.ts`)". Since
`87d3e9c` it lists eleven. `AGENTS.md` was not updated by #113/#114 and now documents a
configuration that no longer exists.

## 5. Explicitly not proposed

- **Hand-editing wiki pages.** `AGENTS.md:69` forbids it, and the publish workflow
  regenerates the directory.
- **Changing the generator or theme.** Most of what is wrong is input, not pipeline —
  though the orphaned catalogue pages and the four-module `_Sidebar` are genuinely
  theme-side, so "the pipeline is not the problem" is too strong a claim to make.

## 6. Not verified

- Whether `Andrew-Chen-Wang/github-wiki-action@1bbb428` deletes wiki files absent from
  `path`. The workflow passes no `strategy` input. It does not affect any recommendation
  here, since nothing proposed is hand-written into the wiki.
- Whether the _published_ wiki currently matches `d5cace1`. All measurements above are
  against a local regeneration, not a fetch of `Elite-Dangerous-Almanac.wiki.git`.
- Whether `typedoc-github-wiki-theme` has an option to list non-barrel entry points in
  `_Sidebar.md`. It does not do so by default; the theme's options were not searched.
