# Wiki improvement proposal — worked samples for modules and classes

A review of the published wiki (288 pages, generated from
`typescript/src` by `npm run docs`) against what a consumer needs when they land on
it. The headline finding matches the concern that prompted this: **the wiki explains
symbols well and demonstrates them badly, and the gap is worst exactly where the
library is hardest** — the two large feature areas and the four classes.

Every number below was measured against the wiki at `e09fccf` and the sources that
produced it; the measurement is named next to each claim so it can be re-run.

---

## 1. What the wiki looks like today

|                                   |                                                            |
| --------------------------------- | ---------------------------------------------------------- |
| Total pages                       | 288 (`Home`, `_Sidebar`, 4 module pages, 282 symbol pages) |
| Pages containing no code at all   | 132 (46%)                                                  |
| `@example` blocks in source       | 195                                                        |
| Hand-written guide pages          | 0                                                          |
| Task-oriented pages ("how do I…") | 0                                                          |

Reproduce with:

````bash
git clone https://github.com/DarkSession/Elite-Dangerous-Almanac.wiki.git
cd wiki
ls *.md | wc -l
for f in *.md; do grep -q '```' "$f" || echo "$f"; done | wc -l
````

The generation pipeline is sound and should not change: TypeDoc with
`typedoc-plugin-markdown` and `typedoc-github-wiki-theme`, published by
`.github/workflows/publish-wiki.yml`. Everything proposed here is authored in the
repository and generated into the wiki, in keeping with `AGENTS.md` ("never hand-edit
generated wiki pages").

---

## 2. The five gaps, in priority order

### Gap 1 — The two hard module pages carry no code at all

`materials.md` and `commodities.md` — the two small, obvious feature areas — each carry
4 code fences. `astro.md` (133 lines) and `ships.md` (248 lines) — the two areas a
consumer actually needs help with — carry **zero**.

| Module page      | Lines of prose | Code fences |
| ---------------- | -------------: | ----------: |
| `ships.md`       |            248 |       **0** |
| `astro.md`       |            133 |       **0** |
| `materials.md`   |             75 |           4 |
| `commodities.md` |             51 |           4 |

Sample density is currently inversely proportional to difficulty. Both pages are
excellent orientation prose — `astro.md` untangles the four meanings of "region",
`ships.md` lays out the five layers of the area — and both ask the reader to hold a
paragraph of distinctions in their head with nothing to run.

**Fix.** Add `@example` blocks to the `@packageDocumentation` in `src/astro/index.ts`
and `src/ships/index.ts`. These are the highest-leverage samples in the project: they
are the first page after `Home` for anyone exploring an area. Each distinction the prose
draws should have a snippet immediately under it — for `astro.md`, one worked example
per meaning of "region" and one showing `GalacticPosition` vs `SectorGridPosition`
side by side; for `ships.md`, one snippet per layer (whole-build facade, catalogue
lookup, data-free calculation, engineering) so the "drop to the pieces" advice is
demonstrated rather than asserted.

### Gap 2 — 15 module-level examples are written but never published

65 leaf modules carry a file-level `@packageDocumentation` block, and 15 of those blocks
contain an `@example`. **None of them reach the wiki.** `typedoc.json` lists only the
four barrels as entry points, so a leaf module's own documentation is dropped when its
symbols are re-exported.

```bash
cd typescript/src && grep -rl "@packageDocumentation" --include=*.ts . | wc -l   # 65
```

The lost blocks are precisely the module-level orientation samples:

`ships/ship-loadout`, `ships/power`, `ships/shields`, `ships/armour`, `ships/weapons`,
`ships/resistances`, `ships/ammunition`, `ships/engineering`, `ships/modules`,
`ships/source-purchase`, `astro/nebulae`, `astro/permit-locks`, `materials/materials`,
`materials/micro-resources`, `commodities/commodities`.

The `ship-loadout` one is the best worked example in the codebase — read a build, then
assemble one, with imports and annotated results
(`typescript/src/ships/ship-loadout.ts:38`). It is invisible on the wiki. The build
already goes to some length to rescue these blocks for the _published declarations_
(`scripts/attach-barrel-docs.mjs`); the wiki has no equivalent rescue.

**Fix — and one route to reject.** Adding the leaf modules as TypeDoc entry points looks
like the obvious answer and is not. Measured: adding `src/ships/power.ts` and
`src/ships/ship-loadout.ts` as entry points **renames every symbol they own** —
`ships.Class.ShipLoadout` becomes `ships.ship-loadout.Class.ShipLoadout` — breaking every
existing wiki URL and producing 6 unresolved-cross-link warnings. Do not take that route.

Instead, promote the orientation examples to a surface that publishes: either up into the
barrel `@packageDocumentation` (Gap 1) or onto the class/function they describe (Gap 3),
and add the module walkthroughs as guide pages (Gap 5).

### Gap 3 — Class pages are the least sampled pages in the wiki

The four classes are the library's main entry points. Their member-level sample
coverage:

| Class page                         | Members | Members with an example |
| ---------------------------------- | ------: | ----------------------: |
| `ships.Class.ShipLoadout`          |      50 |                      13 |
| `ships.Class.FittedModule`         |      19 |                   **1** |
| `astro.Class.ProceduralSystem`     |      13 |                       3 |
| `ships.Class.LoadoutSlot`          |      11 |                   **1** |
| `ships.Class.SourcePurchaseRecord` |       9 |                       3 |
| **Total**                          | **102** |            **21 (21%)** |

By contrast 97 of 121 function pages (80%) carry an example. The pattern is that a
function got documented as a unit and a class did not: the class was documented as a
description of 50 members.

Worse, **`ShipLoadout` — the flagship class, the "batteries-included facade", a 1456-line
wiki page — has no class-level `@example` at all.** Its page opens with prose about how
jump calculations resolve FSD constants and then drops straight into 50 alphabetised
accessors. A consumer arriving from `ships.md` gets no end-to-end sample of the object
they were just told to start with.

**Fix.**

1. **A class-level `@example` on every class**, showing the object's whole life cycle:
   construct → inspect → mutate → export. For `ShipLoadout` this is the single most
   valuable snippet in the library.
2. **Examples on the members that encode a design decision**, not on all 102. The
   priority members are the ones whose _documentation already warns about something_:
   the nullable-convenience / diagnostic-result pairs (`cargoCapacity` vs
   `cargoCapacityResult`), `validation`, `sourcePurchase`, `frameShiftDrive` (which
   throws), `slots`/`slotsOfKind`/`modulesForSlot` (slot keys are not derivable),
   `toLoadoutEvent({credits})`. A warning without a snippet is a warning the reader has
   to simulate in their head.
3. **`FittedModule` and `LoadoutSlot` need the most work** — 1 example across 30 members
   between them, and they are what `ShipLoadout.slots()` hands back, so every consumer
   who iterates a build meets them.

### Gap 4 — Existing samples are assertions, not runnable code

Of the 195 `@example` blocks:

- **177 (91%) contain no `import` line** — they cannot be copied and run.
- **117 (60%) are three content lines or fewer** — typically one call and a `// -> value`
  comment.
- **0 are compiled or executed by any check.** There is no example-extraction tooling in
  `typescript/scripts/`, and `npm run check` never sees them.

A one-line `// -> 89.41` is a good _assertion_ about behaviour and a poor _sample_. It
tells a reader what a call returns; it does not tell them what to import, what to feed
it, or what to do with the result. `ships.Function.damagePerSecond` and its 23
example-less siblings show the far end of the same problem.

**Fix.**

1. **Adopt a house shape for a sample**: import line, realistic input, call, annotated
   result. Concretely, the sample on a symbol should be pasteable into a fresh file. The
   examples that already do this (`ship-loadout.ts:38`, `materials.md`) are the model.
2. **Compile the examples in CI.** Add `scripts/check-examples.mjs` that extracts every
   ` ```ts ` fence from an `@example` block into a scratch file per example, rewrites
   the package specifier to a relative source path, and runs `tsc --noEmit` over the
   set; wire it into `npm run check`. This is what stops 195 samples from drifting as
   the API moves, and it makes "add an import line" enforceable rather than aspirational.
   Examples that legitimately reference an undefined binding (`slefJsonString`, `id64`)
   declare it in the snippet — which is itself an improvement, since the reader currently
   has to guess what those are.
3. **Feed samples from `fixtures/`.** The repository already holds 15+ real journal
   captures (`fixtures/ships/journal-*.json`) whose values are pinned by tests. A sample
   that uses a named fixture ship gets a real number in its `// ->` comment and a test
   that keeps it true.

### Gap 5 — No task-oriented pages, and `Home` is five lines

`Home.md` is:

```md
# @elite-dangerous-almanac/core v0.1.0

## Modules

- [astro](../wiki/astro)
- [commodities](../wiki/commodities)
- [materials](../wiki/materials)
- [ships](../wiki/ships)
```

No install line, no first snippet, no orientation, no link back to the README. A
first-time visitor's only move is to guess a feature area.

The wiki is also 100% symbol-indexed. Every page answers "what is X". Nothing answers
"how do I read a player's journal", "how do I turn an id64 into a name and back", "how
do I diff two builds", "how do I show an outfitting screen's numbers". Those are the
questions consumers arrive with, and they are exactly the shape of documentation that a
reference generator does not produce.

**Fix — verified working with this toolchain.** TypeDoc 0.28's `projectDocuments`
option renders hand-written Markdown into the wiki as generated pages. Tested against
this repository's exact plugin stack:

```jsonc
// typescript/typedoc.json
"projectDocuments": ["docs/guides/*.md"]
```

produces `Document.<Name>.md` pages, links them from `Home.md` under a **Documents**
heading, adds them to `_Sidebar.md`, and resolves `{@link ships.ShipLoadout}` to the real
symbol page. The guide sources live in `typescript/docs/guides/` under review like any
other file, so nothing is hand-edited in the wiki and `AGENTS.md`'s rule holds.

Proposed initial guide set — one page per question a consumer actually arrives with:

| Guide                         | Covers                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Getting started               | install, ESM/leaf-import choice, first snippet per area, bundle-size guidance                                |
| Reading a player journal      | `Loadout` event → `ShipLoadout`, `FSDJump` → `ProceduralSystem`, what to do with unknown symbols             |
| Working with SLEF             | `parseSlef` vs `inspectSlef`, round-tripping, `credits: "source"` and what a capture does and does not price |
| Building an outfitting screen | slots → `modulesForSlot` → `setModule` → `powerBudget`/`shieldMetrics`/`weaponMetrics`, end to end           |
| Systems, sectors and regions  | the four meanings of "region", both coordinate spaces, id64 round-trip, permit locks                         |
| Failure model                 | `null` vs `TypeError` vs `RangeError`, the `…Result` diagnostic pairs, `validation` vs `complete`            |

`Home` should additionally carry the install command and one snippet. Either point
TypeDoc's `readme` option at a small `docs/wiki-home.md` (it is currently `"none"`), or
let the Getting started guide sit first under **Documents**.

---

## 3. Suggested sequence

Ordered by consumer impact per unit of work. Each step is independently shippable.

| #   | Change                                                                               | Where                                      |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| 1   | Class-level `@example` on all 5 classes, starting with `ShipLoadout`                 | `src/**/*.ts`                              |
| 2   | Code samples in `astro` and `ships` barrel `@packageDocumentation`                   | `src/astro/index.ts`, `src/ships/index.ts` |
| 3   | `Home` gains install + first snippet                                                 | `typedoc.json` (`readme`)                  |
| 4   | `projectDocuments` wired up; Getting started + Reading a player journal guides       | `typedoc.json`, `docs/guides/`             |
| 5   | Examples on the ~20 members that document a trap; fill the 24 example-less functions | `src/**/*.ts`                              |
| 6   | `check-examples.mjs` compiles every `@example` in `npm run check`                    | `scripts/`                                 |
| 7   | Remaining four guides                                                                | `docs/guides/`                             |
| 8   | Example imports and fixture-backed values across the existing 195 samples            | `src/**/*.ts`                              |

Steps 1–4 are the ones that address "extensive samples for modules and classes"
directly. Step 6 is what keeps the result from decaying.

## 4. Explicitly not proposed

- **Leaf modules as TypeDoc entry points.** Measured above: renames every symbol page and
  breaks cross-links. The leaf modules' documentation should be rescued via barrel
  examples and guides instead.
- **Hand-editing wiki pages.** The publish workflow syncs `typescript/docs/wiki` over the
  wiki repository; anything not generated is lost, and `AGENTS.md` forbids it regardless.
- **Changing the generator or theme.** The pipeline is not the problem; its input is.
