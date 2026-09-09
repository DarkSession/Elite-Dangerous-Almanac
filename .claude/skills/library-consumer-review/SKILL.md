---
name: library-consumer-review
description: Review this project the way a would-be consumer sees it — an Elite Dangerous app developer who discovered the library and wants to use its features, not maintain it. Covers both shipped packages, the TypeScript one and the .NET one. Judges structure, discoverability, naming, docs, subpath and namespace ergonomics, and what is confusing or not self-explaining, using ONLY the public/shipped surface. Use for "review from a consumer/user perspective", "is the library well structured", "developer experience / DX review", "review the .NET or C# API", "would an app developer understand this", "what's confusing about the API".
---

# Library Consumer Review (developer-experience review)

Review Elite Dangerous Almanac as an **outside app developer who wants to *use*
it**, not as its maintainer. The reviewer is a competent ED community-app dev
(they know the game and terms like "system address" loosely) but has **never
seen this repo's internals** and does not know its private conventions.

The library ships **two packages**: `@elite-dangerous-almanac/core` for TypeScript
and `EliteDangerousAlmanac` for .NET. Review both, and judge each in the idiom of
its own language — the two deliberately do not share names. Unless the user names
one language, cover both and say which findings hit which package. Your job is to
answer three questions the user cares about:

1. **Is the library well structured?**
2. **What makes sense** (the strengths worth keeping)?
3. **What's confusing / not self-explaining** (the friction that would make a
   real consumer bounce or misuse it)?

## The one rule that makes this review different

Judge **only what a consumer can actually see and reach**:

- Package metadata a consumer reads first: `typescript/package.json`
  (`description`, `exports` subpath map, `types`, `sideEffects`, `files`) and
  `dotnet/src/EliteDangerousAlmanac/EliteDangerousAlmanac.csproj` (`Description`,
  `TargetFramework`, `PackageReadmeFile`, the dependencies it pulls in).
- The **public entry points** and what they carry: in TypeScript,
  `typescript/src/*/index.ts` and the leaf subpaths (there is no package-wide root
  entry); in .NET, the `public` types in each `EliteDangerousAlmanac.<Area>`
  namespace. The exported symbol names and types ARE the API.
- **Documentation** a consumer would rely on: the root `README.md`, both package
  READMEs, the guides under `typescript/docs/guides/` and `dotnet/docs/guides/`,
  TSDoc/JSDoc comments on exported symbols, XML documentation comments on public
  C# members, the generated wiki, and `@example` blocks.
- The **type surface** a consumer's editor would show (`.d.ts` / exported `type`s;
  public C# signatures and XML docs), including surprising types (e.g. `bigint`
  in TypeScript and its `ulong` counterpart in .NET).
- Any published examples / quickstart.

Do **not** grade internal implementation quality, test coverage, or private
helpers — that is a maintainer review, and a different skill (`/code-review`)
owns it. If an internal detail leaks into the consumer's experience (an
un-exported type they'd need, an undocumented required argument, a footgun with
no doc warning), that IS in scope — report it as an *externally visible* problem,
not as an implementation critique.

Stay in the consumer's shoes the whole time. "I'd expect X and got Y" beats "the
code should do X."

## How to run the review

Work top-down, the way a real evaluator adopts a library.

1. **Discover (30-second test).** From the package metadata + README alone — the
   `exports` map for TypeScript, the namespace list for .NET — can you tell what the
   library does, what features exist, and how to reach one? A .NET consumer also has
   to find out that the package is not on NuGet yet and is built from the repository;
   judge how fast they learn that. Note what a consumer would still not know after
   this pass.
2. **Map the public surface.** List every exported symbol and type per subpath
   (`typescript/src/astro/index.ts`, `typescript/src/ships/index.ts`, …) and every
   public type per namespace (`Astronomy`, `Ships`, …). This is the actual API.
   Group by feature area. Flag names whose purpose isn't obvious on their own, and
   flag a feature
   that one package exposes and the other does not — the packages promise the same
   behaviour, so a consumer who reads about a feature expects to find it in their
   language.
3. **Attempt a realistic task, using only the public surface.** Do it in both
   languages. Pick two or three concrete goals an ED app dev would have, at least
   one from `./ships` / `Ships` since that is the widest surface — e.g. "turn a
   system name the player typed into its id64", "find which galactic region a
   coordinate is in", "load a player's
   loadout from a journal or SLEF export and show its jump range", "work out
   whether this build has enough power", "show a weapon's DPS with its
   engineering applied". Trace how you'd do it from imports → calls → return
   value **reading only docs + types**, not the implementation. Record every
   point where you had to guess, open a source file, or would have gotten it
   wrong.
4. **Cross-check docs against reality.** Do the `@example` and `<example>` snippets
   actually run against the current surface? Do names match the docs? Are units,
   value ranges, and return types stated where they matter (astro/market math
   especially)? Is every public symbol documented per the project's own bar (see
   AGENTS.md: *every public class, function, type, and constant* documented with
   params, returns, units, ranges, examples)? Where both packages document the same
   behaviour, do they state the same units and the same failure behaviour?
5. **Score against the DX dimensions** below, then write the report.

Keep it grounded: cite `file:line` for each finding, and prefer showing the
exact export/name/signature over describing it.

## DX dimensions to evaluate

- **Structure & modularity.** Is the split into feature areas — subpath exports
  (`./astro`, …) in TypeScript, namespaces (`EliteDangerousAlmanac.Astronomy`, …)
  in .NET — clear and predictable? Could a consumer guess where a feature lives?
  In TypeScript, is the feature-barrel vs. leaf-subpath story obvious, and do the
  docs steer them to the tree-shakeable import? One coherent slice per subpath or
  namespace?
- **Discoverability.** README quickstart, feature list, install line, first
  working example. Can someone find the entry point for their task without
  reading source? (A missing/empty README is a top-tier consumer finding.)
- **Naming & self-explaining API.** Would each exported name make sense to an ED
  dev with no repo context? Flag jargon that isn't defined for the consumer —
  in `astro`, terms like `boxel`, `mass code`, `hand-authored sector`, `id64`
  vs. `systemAddress`; in `ships`, terms like `blueprintSymbol` vs. the journal's
  own `BlueprintName`, "core" vs. "standard" modules, `BurstInterval` (this
  library's own label for a stat the journal reports as `RateOfFire`),
  pre-engineered *variant* vs. a blueprint you can apply, and Modifier `Label`
  strings generally. Distinguish "domain term they'd know" from "internal term
  they'd have to reverse-engineer", and be especially alert to a name this
  library chose that differs from the one the game writes — a consumer matching
  on journal fields will not find it.
- **Documentation completeness & accuracy.** TSDoc on every public symbol and an
  XML documentation comment on every public C# member; `@param`/`@returns`/
  `@example` and `<param>`/`<returns>`/`<example>`; **units and value ranges**
  stated; examples that actually work. Note undocumented exports and
  doc/behaviour mismatches.
- **Mental model / conceptual onboarding.** Does the library explain its domain
  enough to be usable — the relationship between names, `id64`, coordinates,
  regions? Or must the consumer already know the reverse-engineered scheme?
- **Import & tree-shaking ergonomics (a stated hard requirement).** Can a
  TypeScript consumer import one slice without dragging the galaxy in? Is
  `sideEffects: false` / named-exports-only honoured in a way the consumer benefits
  from? Do the docs tell them which import keeps their bundle small? .NET ships one
  assembly, so the equivalent question is what a call costs at run time: a consumer
  who reads a system name should not pay to parse the nebula catalogue. Judge
  whether the docs let them predict that.
- **Parity between the two packages.** A consumer reads one language's docs and
  expects the same behaviour their colleague gets in the other. Flag a feature, a
  default, a unit or a failure mode that differs, and flag a name that diverges
  further than the two languages' conventions require.
- **Type ergonomics & surprises.** Are the types a consumer touches exported and
  usable? Call out surprising-but-required types with no warning — `bigint`
  id64s (bitwise past 2^32), `coords`-required decode paths, and any
  parse-doesn't-canonicalize behaviour. In `ships`, watch for values whose
  **unit or convention** a consumer would guess wrong: percentages stored as
  fractions here but as whole numbers in a journal, resistances that do not
  simply add, an optional stat whose absence means "the game assumes a default"
  rather than "zero", and metrics returned `undefined` for a module that cannot
  have them. A number that looks plausible but is 100× out is the worst
  failure mode this library can hand someone — check the docs state the unit.
- **Errors & edge cases.** What happens on bad input (malformed name, out-of-range
  coords)? Is the failure mode documented, or will the consumer discover it in
  production?
- **Attribution & trust.** Community-derived data and algorithms: is credit
  visible to the consumer? Both packages ship `THIRD_PARTY_NOTICES.md` (a copy of
  the repository's root `ATTRIBUTIONS.md`) alongside `LICENSE`, and both package
  READMEs link to it — judge whether someone evaluating the library would
  actually find the non-commercial restrictions before depending on it. A
  researcher-facing library with no sourcing is a trust finding. Also judge
  whether a consumer can tell **how current and how complete** the data is — the
  snapshot date, and whether known gaps are discoverable from the shipped package
  rather than only from a `SOURCES.md` in the repository. The npm package packs a
  `PROVENANCE/` copy of every one; the NuGet package packs none.

## Severity lens (consumer impact, not code smell)

- **Blocker** — a consumer can't get started or will ship a wrong result
  (missing README/quickstart; undocumented required arg; silent footgun like
  needing `coords` to decode a hand-authored system).
- **Friction** — usable but they'll waste time or guess (unexplained jargon,
  missing units, no `@example`, unclear which import to use).
- **Polish** — minor naming/consistency nits that don't block use.

Always separate **"confusing to a newcomer"** from **"actually broken/wrong"** —
say which. And credit what genuinely works; the user explicitly asked what makes
sense, not only what's wrong.

## Output format

Answer the user's three questions directly, in this order:

1. **Verdict — is it well structured?** 2-4 sentences. Overall consumer
   impression and whether you'd adopt it as-is.
2. **What makes sense** — the strengths a real consumer benefits from (bullets,
   with `file:line`).
3. **What's confusing / not self-explaining** — findings grouped by severity
   (Blocker / Friction / Polish). Each: what a consumer expects, what they get,
   where (`file:line`), and the one-line fix. Mark whether it's *confusing* vs.
   *actually wrong*.
4. **Top recommendations** — a short prioritized list (highest consumer impact
   first) of concrete changes.

## What ships today

Two packages, six feature areas each, both backed by the same shared `data/` and
`fixtures/`. TypeScript publishes one subpath per area, .NET one namespace:
**`./astro`** / **`Astronomy`** (procedural names, id64 addresses, regions,
nebulae, permit locks, body physics), **`./ships`** / **`Ships`** (ship and
outfitting catalogues, engineering, loadouts, and build metrics — power, shields,
armour, resistances, weapons, jump range), **`./equipment`** / **`Equipment`**
(Odyssey suits, handheld weapons, upgrades, modifications), **`./i18n`** /
**`Localization`** (localized display text), **`./materials`** / **`Materials`**,
and **`./commodities`** / **`Commodities`**.

The TypeScript package is on npm; the .NET package is built from the repository and
targets .NET Standard 2.1. `python/` does not exist yet.

`./ships` / `Ships` is by far the largest surface and the one most worth reviewing
hard: it has the most exports, the deepest domain vocabulary, and the most places
a consumer can get a plausible-looking wrong number. Do not spend the whole review
on `astro` because it comes first alphabetically — weight attention by how much
API a consumer actually has to navigate.

A consumer-visible detail worth checking rather than assuming: every
`./<area>/internal/*` subpath is mapped to **`null`** in the `exports` map, so
deep-importing an internal module throws a resolution error, and .NET keeps the
same boundary by marking implementation-only types `internal`. Verify that
nothing a consumer would plausibly *want* lives only there — a type they need
to name, or a helper the docs mention, being unreachable is a real finding.

Offer to render the report as an Artifact only if the user wants a shareable
version; default to inline markdown.
