# Proposal — where the library's behaviour gets documented

`data/<domain>/SOURCES.md` is the provenance record: what a catalogue was taken from,
when, from which revision, how it was derived, and every manual correction. It had also
become the place where the library's own behaviour was written down — how a metric is
calculated, which recipe a gate accepts, what each test asserts. That content is now out
of `data/ships/SOURCES.md`, and this proposes where it should live instead.

Nothing here is implemented yet. It is a decision to take, not a rule already in force.

## What was removed, and what it was

Three whole sections, plus the running narration inside the surviving ones:

| Removed section                       | Lines | What it documented                                                                                                    |
| ------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| Build-metric algorithms               | 129   | How power, shields, armour, resistances, weapon DPS and ammunition capacity are computed, and the rounding rules        |
| Jump-range and fuel algorithm         | 18    | The hyperspace model, and that the SLEF writer round-trips through the parser's own guards                              |
| Engineering compatibility             | 78    | Which recipe `applyBlueprint` accepts on which module, the three accommodations, and why a family map is not reintroduced |
| Narration inside the surviving sections | ~60 | "`x.test.ts` asserts …", "pinned in `fixtures/…` under `counts`", "read it with `getFoo` / `getBar`"                    |

(The two fixture sections that went in the same change — Ground-truth builds and the build
corpus — are a separate matter and are already re-homed: each fixture carries its own
provenance in its file header.)

Every one of them describes **this library**, not an upstream source. A reader who wants
to know what `damagePerSecond` does should not have to find it in a file about where
coriolis-data's stat tables came from, and a maintainer checking a value's provenance
should not have to read past an explanation of the power budget to reach it.

Three kinds of historical fact stay in `SOURCES.md`, because they explain the checked-in
data rather than the code (AGENTS.md §Documentation states the present): the **derivation**
of a value, a **rejected alternative** about the data, and a **deliberate absence**. Where
a capture settles a value — a journal that says Overcharged does not cut a cannon's clip —
naming that evidence is provenance and stays. What goes is the paragraph after it that
explains how the calculator folds the recipe.

The removed text is in git history — `git log -p -- data/ships/SOURCES.md` reaches it — and
this proposal is about where it should be re-authored, not about restoring it verbatim.

## What the repository already has

Both homes this content could want already exist and are already published:

- **TSDoc on every public symbol**, generated into the GitHub wiki by `npm run docs`
  (AGENTS.md §Documentation). This is where a caller looks first, and it already carries
  units, ranges and examples.
- **Hand-authored guide pages** in `typescript/docs/guides/` — `Getting-started`,
  `Building-an-outfitting-screen`, `Reading-a-player-journal`, `Working-with-SLEF`,
  `Systems-sectors-and-regions` and `The-failure-model` — pulled into the same wiki by
  `typedoc.json`'s `projectDocuments`. A cross-cutting subject has somewhere to go without
  any new infrastructure.

So nothing has to be built. What is missing is the rule about which of the two takes a
given paragraph, and the work of re-authoring the removed sections into them.

## The options

**A. TSDoc only.** Every removed paragraph is re-authored as `@remarks` on the symbol it
describes: the mass curve on `shieldStrength`, the clip rounding on `computeModifiers`,
the compatibility rules on `applyBlueprint`. Nothing new to maintain, and it lands in the
wiki automatically.
_Cost:_ some of the content is not about one symbol — "how ammunition is reported" spans
`ammunition.ts`, `engineering.ts` and the catalogues — and forcing it onto one symbol
either bloats that symbol's page or splits an argument across three.

**B. TSDoc, plus a guide page for each subject that spans modules.** Symbol-level detail
stays in TSDoc; the residue becomes a page under `typescript/docs/guides/` alongside the
six that already exist. The removed sections suggest two new ones — _Build metrics_ (power,
shields, armour, resistances, weapon output, ammunition and its rounding) and _Engineering_
(what a recipe may go on, the three accommodations, and why a family map is not
reintroduced) — with the jump-range model folded into the first or into
`Working-with-SLEF`.
_Cost:_ a second place to keep current, which is the cost the existing guides already
carry.

**C. A repository-only `docs/` note, not published.** Cheapest to write, but a consumer
never sees it, and this library's audience is consumers.

**Recommendation: B.** A is right for everything that belongs to one symbol and should be
used wherever it fits; the residue — two subjects, on the evidence of what was removed —
earns a guide page rather than a home in a provenance file. C solves the wrong problem: the
content was written for readers, and the wiki is where readers are.

## The rule this would settle on

> `SOURCES.md` answers "where did this value come from, and what was done to it".
> Everything about what the library computes, accepts or refuses is documented on the
> symbol that does it, or on a guide page when it spans several. A `SOURCES.md` entry may
> name the evidence for a value; it does not explain the code that consumes it.

If B is accepted, the follow-up work is: re-author the three removed sections as two guide
pages under `typescript/docs/guides/`, move the paragraphs that belong to one symbol into
its TSDoc, and state the rule above in AGENTS.md §Documentation. No tooling change is
needed — `typedoc.json` already publishes that directory.
