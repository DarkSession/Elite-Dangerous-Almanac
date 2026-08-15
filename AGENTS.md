# AGENTS.md

This file provides guidance to AI coding agents (e.g. Claude Code) when working with code in this repository.

## Project Purpose

**Elite Dangerous Almanac** is a ready-to-go library for Elite Dangerous community app developers and researchers. It provides a comprehensive set of static data and calculations covering:

- Astrophysical data
- Ship data
- Character data
- Market data

## Pre-1.0: breaking changes are acceptable

The library is a work in progress and has not reached version 1.0. **Backwards compatibility is not required at this point, and breaking changes are acceptable.** Until 1.0, get the API right rather than preserving what is already published: rename a symbol that is named badly, change a signature that takes the wrong arguments, move a module whose subpath is in the wrong place, reshape a catalogue whose structure fights its consumers.

What that rules out is compatibility scaffolding, which is the same clutter whether it is added out of habit or out of caution:

- **No deprecated aliases, re-exports or shims** kept alongside the new name, and no `@deprecated` symbols retained "for one more release".
- **No dual code paths** that accept both the old and the new shape of an argument, option object or data file.
- **No migration prose in the documentation.** Docs describe the current surface only (see §Documentation states the present, not the history); the change belongs in the pull request and the release notes, not in a TSDoc comment or a guide page.

A breaking change still has to be complete and visible: update every call site, test, fixture, documented example and guide in the same change, and say plainly in the PR description what breaks and what replaces it. The version stays below 1.0 while this holds (§Releasing to npm) and the README says so for consumers — do not describe the surface as stable anywhere until 1.0 is actually released.

## Multi-Language Strategy

The library starts in **TypeScript**, with **Python** (and potentially other languages/frameworks) planned for the future. Two hard requirements shape all design decisions:

1. **Feature parity** — every language implementation must expose the same features and behavior.
2. **Shared test fixtures** — all implementations are validated against the same language-agnostic test fixtures.

When adding features or data, keep them portable: prefer language-neutral formats (e.g. JSON) for static data and fixtures so every implementation can consume them without duplication.

Every data update must also follow `data/SNAPSHOTS.md`: record its acquisition date, immutable upstream revision when available, derivation method, and any manual corrections.

### Data file format: JSONC in `data/` and in `fixtures/`

Every shared file — a `data/` catalogue and a `fixtures/` fixture alike — is **JSONC** (`.jsonc`): JSON preceded by a comment header. What the header carries differs by directory: a catalogue's names its source and points at the credits (see §Attribution); a fixture's says what it pins and, for a capture, where it came from (see §Fixtures carry their own provenance).

Two rules keep `.jsonc` portable. Catalogues are checked by `typescript/src/<domain>/data-files.test.ts`, fixtures by `typescript/src/fixtures.test.ts`:

1. **Comments are the only JSONC extension used.** No trailing commas, no unquoted keys, no single quotes. Strip the comments and what remains must be strict JSON that any language's standard parser accepts — Python's `json`, Go's `encoding/json`, and so on. A trailing comma is portable only in JSON5, which is a different format.
2. **Prose lives in the header comment, never in the payload.** No top-level `attribution`, `description` or `comment` key. In `data/` that is also a bundle-size rule — every payload byte is inlined into consumers' bundles, and comment bytes are not — but it holds in `fixtures/` too, so a port's parser never has to skip fields that are not data.

Each implementation strips comments in its own loader — never by generating `.json` copies, which would break the single-source-of-truth rule. TypeScript does it in `typescript/scripts/jsonc.mjs`, wired into the test runner (`scripts/register-jsonc.mjs`, via `--import` *after* tsx) and into the build (an esbuild `onLoad` plugin in `tsup.config.ts`). `src/jsonc.d.ts` types a `data/` import as `unknown`, so each catalogue module casts to its own interface. For fixtures, `pnpm run generate:fixtures` derives the shared `schemas/fixtures.schema.json` and TypeScript's `src/fixtures.generated.d.ts`; run it in the same change that changes a fixture's shape.

> **Editors reformat `.jsonc`.** Some formatters treat the extension as JSON5 and add trailing commas, silently breaking rule 1. If a data file starts failing to parse, check what your editor did to it before suspecting the loader.

## Build & Tree-Shaking Requirements

Consumers (community apps, often web-based) must only pay for what they import. Build the library in small pieces and keep everything tree-shakeable:

- **Small modules**: one class/interface/feature area per file. No god-modules.
- **ESM output** with `"sideEffects": false` in `package.json`; no side effects at module top level (no registration-on-import, no mutable module state, no self-executing code).
- **Named exports only** — no default exports, no namespace-object re-export patterns (`export * as X`) that defeat tree-shaking.
- **Subpath exports** (`exports` map in `package.json`) per feature area, so consumers can import only the slice they need. The published package is `@elite-dangerous-almanac/core`, exposing `./astro`, `./ships`, `./materials` and `./commodities` alongside the individual modules within each (`./ships/ship-loadout`, `./astro/nebulae-real`, …). **The public half of the map is enumerated, one subpath per runtime module** — there is no public wildcard — and `tsup.config.ts` derives its exact entry list from those `import` targets. A new module under `src/` is therefore unreachable and unbuilt until its entry is deliberately added with both `types` and `import`. Export a type-only module's symbols through the runtime entry that owns them rather than creating a declaration-only subpath; a package specifier should resolve consistently for ordinary and type-only imports. `pnpm run test:package` compares the built entries with the manifest and rejects any non-null export lacking either target. The only patterns in the map are the per-area `./<area>/internal/*` keys, each mapped to **`null`**; that makes every current and future internal deep import a resolution error without maintaining one manifest exception per file. Root-wide helpers belong in `src/internal/`, which has no entry at all. Follow that layout for anything marked `@internal`.
- **Prefer pure functions over stateful classes**; when classes are used, avoid static registries or cross-class coupling that drags unrelated code into the bundle.
- **Static data is the biggest bundle risk**: never expose one monolithic data import. Split `data/` consumption into per-domain (and where sensible per-entity-group) modules so importing one ship's stats doesn't bundle the whole galaxy.
- **Usability outranks tree-shaking when the two collide.** A registry lookup takes an *optional* catalogue argument defaulting to the whole registry (`getMaterialByName('iron')`) — a journal line hands you a symbol and nothing else, so making the caller identify the category first was solving the library's problem with the user's time. The price is that a default is a static import: the data cannot be dropped even when an explicit catalogue is passed. Decide it by measuring a module's import graph in `dist/` **as a consumer's bundler ships it** — that is, fully minified, while the library's own build only compacts whitespace (see §Commands): materials 16.9 KiB, micro resources 10.7 KiB, commodities 29.5 KiB — noise; `ships/modules` 311.9 KiB (30.5 KiB gzipped) — worth naming in its own docs, which it does. **`astro/nebulae` is the counter-example**: `ALL_NEBULAE` is 431.7 KiB, so its argument stays required. Default to the whole registry unless that would cost more than the rest of the library, say which way you went in the module's own docs, and do not reverse either decision without a fresh measurement.
- **Nothing in a data payload that isn't data.** Prose a program never reads — attribution, notes, descriptions — is inlined into every consumer's bundle just like the records are. It belongs in the file's comment header (see §Data file format), where it stays next to the data and costs consumers nothing. On the small catalogues this is not a rounding error: `permit-locks` was 20% attribution by weight.
- **No packing or minification in the library source.** Keep the checked-in source and the shared `data/` / `fixtures/` as normal, readable, well-formatted code and JSON — never hand-minified, pre-bundled, or otherwise compacted. All bundling, minification, tree-shaking, dead-code elimination, and payload compaction belong to the per-language **build/dist step** (e.g. `tsup`/esbuild for TypeScript) or to the consumer's bundler downstream of it, never baked into source. This keeps the data reviewable and diff-able, and keeps the shared assets portable across language implementations that each pack differently.

Tree-shakeability is part of feature parity: other language implementations should mirror the same fine-grained module boundaries (e.g. Python subpackages matching the TS subpath exports).

## Testing Requirements

- **Validate against the shared fixtures.** Behavior is proven against the language-neutral fixtures in `fixtures/` (see Multi-Language Strategy), so every implementation demonstrates identical behavior on identical data.
- **Minimum coverage: ≥ 80%.** Each language implementation must keep automated-test coverage at **80% or above** on **lines, branches and functions**, and CI must enforce it — a drop below the threshold fails the build. Add genuine test cases for real behavior; do not chase the number with assertion-free tests or by excluding code from measurement.
  - **TypeScript**: `pnpm test` runs `node --test --experimental-test-coverage` with `--test-coverage-lines/-branches/-functions=80`, scoped recursively to `src/internal/**/*.ts` and `src/<area>/**/*.ts`, and excluding `*.test.ts`. Adding a new feature area means adding its `--test-coverage-include` glob, or the area is silently unmeasured; nested `internal/` modules inside an existing area are measured automatically.
  - **Python (future)**: measure with `coverage.py` / `pytest --cov` and fail CI under 80%.

## Documentation Requirements

This is a library, so documentation is a first-class deliverable:

- **Every public class, function, type, and constant must be documented in detail** — description, parameters, return values, units (critical for astrophysical/market calculations), value ranges, and examples.
- **Follow each language's framework-standard doc format** so standard tooling can extract it:
  - TypeScript: TSDoc/JSDoc comments (`/** ... */` with `@param`, `@returns`, `@example`, `@remarks`).
  - Python (future): Google-style docstrings.
- **Docs must be convertible to GitHub Wiki format.** API documentation is generated from source comments and published to the repo wiki automatically — never hand-edit generated wiki pages.

### Documentation states the present, not the history

Documentation describes current behavior. Git and GitHub releases carry project history.
Edit or delete statements that a change makes false; do not append dated change logs,
migration stories, superseded behavior or comparisons with earlier implementations.

Keep historical facts only when they explain the current state:

- **Provenance.** `data/<domain>/SOURCES.md` must record, per catalogue, the source, its immutable revision or checksum, the acquisition date, the derivation and every manual correction with the reasoning behind it — that is what `data/SNAPSHOTS.md` requires, and a date there is a fact about the *source*, not about this repository's history. Record it under the catalogue it describes, in the present tense ("`Int_Sensors_Size1_Class{1..5}` `integrity` is 36/32/40/48/44; coriolis-data's size-1 row is a verbatim copy of its size-2 row, so EDSY's figures are used"), never as a dated entry in a log at the top of the file.
- **A rejected alternative**, where writing it down stops it being rediscovered and reapplied — "these three values look wrong and are not", "storing it as a per-group alias map is worse, because …". State the standing conclusion, not the episode that produced it.
- **A deliberate absence**, what it means, and what would fill it — with a link to its issue (§Tracking known gaps).

### `SOURCES.md` documents the data, not the library

A provenance file answers "where did this value come from, and what was done to it". How the library computes, accepts or refuses something is documented on the symbol that does it — its TSDoc — and never in `SOURCES.md`: two homes for one explanation is how the last one grew to three thousand lines and buried the provenance inside it. The same goes for narrating the test suite ("`x.test.ts` asserts …", "pinned in `fixtures/…` under `counts`") and for listing a module's API. Naming the *evidence* for a value is provenance and belongs there; explaining the code that consumes it does not.

Where an explanation spans several symbols and has nowhere obvious to live, it becomes a guide page under `typescript/docs/guides/`, which `typedoc.json` already publishes to the wiki — `Build-metrics.md` and `Engineering.md` are the two the ships domain needed. Put it there rather than parking it in a provenance file or bloating one symbol's page with an argument that is not about it.

### Doc-generation toolchain

- **TypeScript**: TypeDoc + `typedoc-plugin-markdown` + `typedoc-github-wiki-theme`. The wiki theme produces wiki-friendly file names, wiki-compatible internal links, and a `_Sidebar.md` for navigation — which `scripts/build-wiki-sidebar.mjs` then rewrites as a collapsible tree (guides, then each feature area, then its member kinds, then a class's own members), because the theme's own sidebar is a flat list of the guides and feature areas and leaves every symbol page a module-index walk away. The script groups generated pages into navigation-context subdirectories and writes a sidebar variant beside each group; Gollum selects the nearest `_Sidebar.md`, so only the current page's ancestry starts open. It reads the generated pages rather than the reflection tree, so titles, link targets and ordering stay the ones the module index pages show; it validates every anchor it emits, and `postprocess-wiki.mjs` then checks its page links like any other page's. `typedoc.json` lists **one entry point per feature area** (`src/astro/index.ts`, `src/commodities/index.ts`, `src/materials/index.ts`, `src/ships/index.ts`) rather than a package-wide barrel, **plus any leaf module the barrels deliberately do not re-export** — currently the split data-backed modules moved off the barrels for bundle size (`src/astro/codex-region-lookup.ts`, `src/astro/nebulae-all.ts`, `src/astro/nebulae-planetary.ts`, `src/ships/blueprint-costs.ts`, `src/ships/experimental-effect-costs.ts`, `src/ships/modules-{all,core,hardpoint,internal,utility}.ts`). This gives the wiki one section per entry point: `Home` links to each, every one has its own index page (carrying its `@packageDocumentation` intro), and symbol pages are namespaced (e.g. `astro.Function.decodeSystemAddress`). Add a feature area here when you add one under `src/`; add a leaf only under the rule below.
- **A leaf module may be an entry point only if no other entry point re-exports its symbols.** TypeDoc attributes each symbol to exactly one owning module and the *declaring* entry point wins, so a leaf that a barrel still re-exports does not gain a page — it **moves** the symbol out of the barrel's namespace. Adding `src/ships/ship-loadout.ts` while `src/ships/index.ts` re-exports `ShipLoadout` renames 15 pages to `ships.ship-loadout.*`, drops `ShipLoadout` from `ships.md`'s `## Classes` index into a flat `## References` list, and turns cross-references into unresolved `{@link}` warnings. That is why the split catalogues were removed from the barrels in the same change that added their entry points. Leaf `@packageDocumentation` on a re-exported module is therefore **not published**; put orientation prose and examples a reader needs on the barrel or on the symbol itself.
- **Python (future)**: `mkdocstrings` (or `pydoc-markdown`) to render Google-style docstrings to Markdown for the same wiki.
- **Publishing**: a GitHub Actions workflow generates the Markdown docs and pushes them to the wiki's backing git repo (`<repo>.wiki.git`), e.g. via `Andrew-Chen-Wang/github-wiki-action`. The job needs `contents: write` permission. Note: the wiki must be initialized once manually (create any first page) before CI can push to it.

## Attribution Requirements

Much of the static data and many calculations derive from the Elite Dangerous community (e.g. EDCD, EDDN, EDSM, Spansh, forum research, individual authors) as well as third-party libraries. Proper credit is mandatory — and **a source is described in exactly one place**, so a licence position cannot drift between copies of it.

- **`ATTRIBUTIONS.md`** at the repository root is that place: every external data source, algorithm and library, with its author, link, licence position and what the project uses it for — including any licence text an upstream requires be reproduced in full. It lives at the root because it is language-neutral, exactly like `data/` and `fixtures/`, and it ships to npm consumers as `THIRD_PARTY_NOTICES.md`.
- **Everywhere else names the source and points there.** Nothing repeats an author, a URL or a licence:
  - Data files (`data/`): open the file with a **comment header** saying what the file holds, naming the source in a line or two, and pointing at `ATTRIBUTIONS.md` for credit and at the sibling `SOURCES.md` for provenance. Put it in a comment, not in an `attribution` field — see §Data file format for why, and copy the header of any existing `data/astro/*.jsonc` for the shape.
  - `data/<domain>/SOURCES.md`: what was taken from a source, when, from which revision, how it was derived and every manual correction — referring to the source by name. Not who to credit, not the licence, and not how the library works (see §Documentation).
  - Code (calculations, ported algorithms): a doc comment on the function/module naming the original source and pointing at `ATTRIBUTIONS.md`.

Whenever you add or change data, port an algorithm, or introduce a dependency that warrants credit, add the source to `ATTRIBUTIONS.md` and record the provenance where the data lives, in the same change. Respect each source's license terms (attribution text, share-alike, etc.).

### Fixtures carry their own provenance

A fixture in `fixtures/` is documented **in its own header comment and nowhere else** — it gets no entry in any `SOURCES.md`. The header says what the fixture pins; a capture's also says where it came from, when it was acquired, its checksum, and anything scrubbed or corrected. The projects that published a capture are credited in `ATTRIBUTIONS.md` like any other source. `typescript/src/fixtures.test.ts` enforces that every fixture has a header, parses as strict JSON without it, and keeps prose out of its payload.

A `SOURCES.md` entry may still *name* a fixture as the evidence for a value ("a capture states the base reserve as 2"); what it must not do is document the fixture.

### A captured ship build is an exception to the redistribution test

A `Loadout` event, a SLEF export or a decoded share link is **Frontier game output** — which parts a player put in which slots — travelling through whatever project you found it in. It is not that project's work, and it carries no licence of its own beyond Frontier's media-usage terms below. So a build is **not** rejected because the repository holding it states no licence, or states one that forbids redistributing *that repository*: those terms cover the project's own code and assets, not a game capture sitting in its example data.

What still applies, every time:

- **Credit the source if we have one.** Name the project and its licence position in `ATTRIBUTIONS.md`, exactly as for any other source, and record the file, the revision and the checksum in the fixture's own header. Where a build reaches us with no traceable origin — the 181 in `fixtures/ships/builds/` — that is fine and already recorded; it is not a reason to leave the build out.
- **Scrub the person, keep the game** (see §Commit Identity), and store the capture verbatim otherwise, with its source checksum.
- **Builds only.** Code, stat tables and derived catalogues are held to the licence they ship under, unchanged.

> **Do not write a second copy of the credits or the licence.** `README.md` carries a short pointer, not a list. `typescript/THIRD_PARTY_NOTICES.md` and `typescript/LICENSE` are **generated, git-ignored** verbatim copies of the root `ATTRIBUTIONS.md` and `LICENSE` — npm can only pack files inside the package directory, and several upstream licences require the notice to travel with the distribution. `typescript/PROVENANCE/` is generated the same way from `data/SNAPSHOTS.md` and every `data/<domain>/SOURCES.md`, so an installed version carries its exact data currency offline. `pnpm run build` writes all three (`typescript/scripts/copy-notices.mjs`), `prepublishOnly` runs the build, and `package.test.mjs` asserts that the copies are complete and byte-identical to their sources. Edit the root files; never the copies. Because the root `LICENSE` is packed verbatim, keep its wording readable from inside a consumer's `node_modules` as well as from the repository.

## Repository Layout

Monorepo with one subfolder per language implementation and shared, language-neutral assets at the top level:

```
data/          # shared static data (JSONC), one folder per domain, each with a SOURCES.md
fixtures/      # shared test fixtures (JSONC) — every implementation validates against these
schemas/       # shared JSON Schemas — language-neutral validation for data payloads
scripts/       # repository tooling for deriving data; never shipped in any package
typescript/    # TypeScript library (package.json, src/, tests, typedoc.json)
python/        # (future) Python library — same features, same fixtures
```

`data/` and `fixtures/` are owned by no implementation; language folders consume them. Never copy shared data into a language folder. `data/SNAPSHOTS.md` defines the metadata every update must record; each `data/<domain>/SOURCES.md` carries the long-form provenance for that domain — source, revision, derivation, manual corrections, and known gaps — organised by catalogue and written in the present tense. **GitHub issues** are the short actionable list of those gaps — see §Tracking known gaps.

## Tracking known gaps

**Open gaps live in GitHub issues**, one issue per gap on
`DarkSession/Elite-Dangerous-Almanac`.

When a change uncovers a gap it cannot fix in scope:

1. **Open an issue** for it. Say what is missing, what a consumer sees today because of it, how it was measured (a fixture, a corpus count, a named record) and what would close it — a source that carries the value, or the shape the fix should take. State the area in the body (`ships — data gap`, `ships — API`, `ships — test coverage`, …) and label it `bug`, `enhancement`, `documentation` or `help wanted`. Search the open issues first: a gap that is already tracked gets a comment, not a second issue.
2. **Keep the reasoning in the domain's `SOURCES.md`** — why a value was left absent, which sources were checked, what was rejected and on what grounds. The issue is the short actionable list; `SOURCES.md` is the provenance record, and it outlives the issue.
3. **Cite the issue where a reader meets the gap** — the TSDoc on the function that returns the incomplete answer, the `SOURCES.md` bullet, the README paragraph. Link it as `#<number>` in Markdown; in TSDoc and code comments use the full URL, since TypeDoc output is read outside the repository. Do not paraphrase an issue's contents into a doc comment: name the symptom in one line and link.

Closing a gap means closing its issue in the same change that fixes it, and dropping the citations that pointed at it.

## Repository Status

Four feature areas exist in TypeScript, all under `typescript/src/`:

- **`astro/`** — procedural system names and id64 addresses, galactic regions, nebulae.
- **`ships/`** — ship and outfitting catalogues, engineering (blueprints, experimental effects, pre-engineered variants), loadouts, and build metrics: power, shields, armour, resistances, weapons, jump range.
- **`materials/`** — engineering materials and micro-resources.
- **`commodities/`** — market commodities.

`python/` does not exist yet. When it lands it consumes the same `data/` and `fixtures/` and must reach parity.

Two repo-wide conventions worth knowing before touching a catalogue:

- **Catalogues are frozen.** Shared data is imported as a process-wide module singleton, so every exported catalogue is passed through `deepFreeze` (`src/internal/deep-freeze.ts`) — otherwise one consumer's mutation changes another's lookups. `src/catalogue-immutability.test.ts` asserts this for every exported catalogue; add new ones to it.
- **Data files are hand-maintained artefacts.** `scripts/data/ships/merge-normalized-catalogues.mjs` joins normalized *local* arrays that a maintainer prepares; **no script in this repository reads, clones or fetches an upstream repository, and none should be added.** Fetching during acquisition is fine — write the throwaway script in a scratch directory outside the working tree, run it there, and commit only the derived data. What lands in the repo is the data plus its provenance in the domain's `SOURCES.md`, never the script that reached for it. The rule is about what ships and what CI runs, not about how a maintainer got the bytes.

## Environment

Development happens inside a dev container (`.devcontainer/devcontainer.json`) based on the TypeScript/Node 22 (bookworm) image, with Python 3.12 also installed. Runs as the `node` user. ESLint + Prettier for TypeScript; Pylance for Python.

## Commit Identity — no personal data in git metadata

**Commit as whoever git is already configured as. Never set an identity yourself.** The environment configures `user.name` / `user.email` (and, where signing is enabled, the signing key) before you start. Do not pass `-c user.name=…` / `-c user.email=…` to `git commit`, do not `git config` a different one, and do not use `--reset-author` to change *who* a commit is by. An agent that substitutes its own choice produces commits GitHub marks **Unverified**, because the identity no longer matches the key that signed them.

**An identity you did not get from git config is a personal detail, and commit metadata publishes it.** A maintainer's address may be in front of you — in the conversation, an issue, a profile, an earlier commit's author field — and none of that is permission to write it into this repository's history. The author and committer fields of a public repository are world-readable and permanent in a way ordinary files are not:

> A wrong address cannot be taken back by force-pushing over it. Rewriting the branch removes the *reference*; the old commit object survives on the remote, stays fetchable by its SHA, and the force-push event in a pull request timeline links to it by SHA. Only GitHub Support can purge unreachable objects. **Getting it right the first time is the only fix that works.**

Before pushing, confirm the whole branch carries one identity, the configured one:

```bash
git log --format='%an <%ae> | %cn <%ce>' origin/<default-branch>..HEAD | sort -u
```

The same rule covers everything else you author. Commit messages, PR titles and bodies, code comments, data files, fixtures and `SOURCES.md` entries carry **no personal data** — no email addresses, no real names, no handles, no machine or account names, and nothing identifying a private individual. This does **not** restrict §Attribution: crediting an upstream project and its published author is required, and a licence that must be reproduced is reproduced in full. The line is between citing work someone published under their own name and copying a person's contact details into a payload or a commit trailer.

A related habit, for the same reason:

- **A captured source is scrubbed of the person, not of the game.** A journal capture, a SLEF export or a community build reaches you attached to whoever produced it — a commander name, an account id, an uploader, a home directory in a path, the link the build was shared from. That goes; the game data stays. `fixtures/ships/builds/` stores its 181 builds without author, name or link (the corpus index's own header records the choice and what it costs), while the Krait Phantom capture deliberately keeps its `ShipName`, `ShipIdent`, `ShipID` and `timestamp` — those describe a ship, they are what makes it ground truth, and none of them names a person.

## Pull requests

**Before opening any PR, have a subagent re-review the complete change.** Address every actionable finding, then ask a subagent to review the updated change again. Repeat this review-and-fix cycle until the subagent reports no actionable findings; only then may the PR be opened.

## Commands

All TypeScript commands run from `typescript/`. The package manager is **pnpm** — see
§Dependencies below before adding or updating one.

| Command                          | What it does                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | installs exactly what `pnpm-lock.yaml` pins; fails on a lockfile that disagrees with the manifest                                                                                                                    |
| `pnpm run check`                 | lint → format:check → typecheck → check:examples → test. **Run this before finishing.**                                                                                                                              |
| `pnpm test`                      | full suite with the coverage thresholds                                                                                                                                                                              |
| `pnpm run typecheck`             | `tsc --noEmit`                                                                                                                                                                                                       |
| `pnpm run check:examples`        | type-checks every documented TS snippet and executes its machine-readable value claims                                                                                                                               |
| `pnpm run generate:fixtures`     | regenerates the shared fixture schema and TypeScript fixture import types                                                                                                                                            |
| `pnpm run lint`                  | ESLint                                                                                                                                                                                                               |
| `pnpm run audit`                 | `pnpm audit --audit-level=low`                                                                                                                                                                                       |
| `pnpm run format`                | Prettier over the package, root `README`/`CONTRIBUTING`/`SECURITY`, schemas and `.github`                                                                                                                            |
| `pnpm run build`                 | copy notices/provenance → `tsup` → source-map cleanup → `prune-barrel-imports` → `attach-barrel-docs` → `dist/` (JSON catalogues inlined; whitespace compacted, syntax and identifiers **not** minified — see below) |
| `pnpm run test:package`          | imports the **built** `dist/` and checks every export subpath                                                                                                                                                        |
| `pnpm run docs`                  | TypeDoc → `docs/wiki`, then `scripts/build-wiki-sidebar.mjs` and `scripts/postprocess-wiki.mjs`                                                                                                                      |

`check:examples` reads public `@example` fences, the guide pages and both READMEs. A
trailing `expression; // -> value` is executed when the snippet needs no ambient
`declare` input: literals compare exactly, a finite decimal is rounded to the number of
places shown recursively through arrays and objects, and `0.667…` asserts a decimal
prefix. Every executable fence runs in a fresh, time-limited Node process so examples
cannot share global, intrinsic or imported-module state. Prose, abbreviated values and
context-sensitive `await` or `yield` expressions remain compile-only and are counted
against a ratchet, so a claim cannot silently stop running. Keep every fence
self-contained and do not start subprocesses: the timeout hard-kills the snippet runner,
not an operating-system process tree. Use `declare const input: Type` only for a value
the reader supplies.

Run one test file with the same loaders the suite uses — plain `node --test` cannot resolve `.ts` or `.jsonc`:

```bash
node --import tsx --import ./scripts/register-jsonc.mjs --test src/ships/weapons.test.ts
```

`pnpm run check` does not build. When a change touches the export map, the bundler config, or anything a consumer imports, also run `pnpm run build && pnpm run test:package` — CI does, and `dist/` is what consumers actually get.

### What `pnpm run build` runs

Five steps, not just `tsup`. A change to any of them is a change to what consumers receive, so `package.test.mjs` checks each one's result against the built package — run it (`pnpm run test:package`) after touching any of them:

1. **`scripts/copy-notices.mjs`** writes the generated, git-ignored `THIRD_PARTY_NOTICES.md` and `LICENSE` copies that npm packs (see §Attribution), plus `PROVENANCE/SNAPSHOTS.md` and one verbatim `PROVENANCE/<domain>/SOURCES.md` for every shared data domain. The latter lets an installed package state its exact data currency without network access.
2. **`tsup`** bundles ESM to `dist/` — one entry per public module, declarations, source maps, and the shared `data/` JSONC inlined through the `jsonc` esbuild plugin. Terser then strips whitespace with compression and mangling disabled: real minification stays the consuming application's bundler's job, and that is why the size figures above are measured as §Build & Tree-Shaking Requirements describes rather than by reading `dist/` byte counts. Whitespace is compacted because esbuild's pretty-printed catalogue literals otherwise dominate the package; the compact JavaScript is about 1.65 MB while function names remain intact. `format.preserve_annotations` keeps every `/* @__PURE__ */` marker for downstream tree-shaking, and Terser's generated map is chained onto esbuild's map so `--enable-source-maps` can resolve compact output to its original source.
3. **`scripts/prune-sourcemap-sources.mjs`** removes the generated-code fallback segments that Terser's map names with tsup's absolute output path, then drops mappings into inlined JSONC data literals because those cannot produce consumer stack frames and otherwise dominate the maps. The remaining mappings point only at portable `src/**/*.ts` paths; package artifacts therefore retain TypeScript debugging without disclosing their build workspace or spending package weight on static-data positions.
4. **`scripts/prune-barrel-imports.mjs`** blanks the redundant bare imports esbuild leaves in per-module entry files — the package is side-effect-free, so downstream bundlers discard them but warn while doing so — and removes the now-unreachable zero-code shared chunks that declaration-only dependencies can produce. It blanks rather than deletes entry imports so tsup's source maps stay valid, using **`scripts/strip-bare-imports.mjs`**, the same helper `package.test.mjs` imports to assert the shipped entries carry no bare imports.
5. **`scripts/attach-barrel-docs.mjs`** re-attaches each barrel's `@packageDocumentation` block to its generated `.d.ts`, which tsup's declaration rollup drops when it flattens a file of pure re-exports. Without it, go-to-definition on an import lands on a bare export list instead of the feature area's orientation docs.

## Dependencies

The package manager is **pnpm**, pinned by the `packageManager` field in `typescript/package.json` together with the hash of that exact release. Corepack ships with Node 22, so `corepack enable pnpm` is the whole install: it fetches the pinned version, refuses a download whose hash does not match, and no contributor has to keep a global pnpm in step with the repository. It is `corepack enable pnpm` rather than a bare `corepack enable` because the release workflow still calls `npm publish` directly, and shimming every package manager would put Corepack between that call and npm.

pnpm's own settings live in `typescript/pnpm-workspace.yaml`, which is where npm's `overrides` field moved to, and it is the only place they can go: pnpm 11 stopped reading settings from a `pnpm` key in `package.json`, and reads only authentication and registry settings from `.npmrc`. Everything the repository sets is outside that subset, so a stray user-level `.npmrc` cannot weaken it — such a setting is not overridden, it is never read.

**New versions serve a seven-day cooldown.** `minimumReleaseAge: 10080` hides any release younger than that, so a package that is compromised or withdrawn in its first week never reaches the tree. Three consequences worth knowing before touching a dependency:

- **Every range floor in `package.json` is a version that has already served the cooldown.** A range whose lowest allowed version is younger fails outright with `ERR_PNPM_NO_MATURE_MATCHING_VERSION` — pnpm does not quietly fall back below the floor. Within a satisfiable range it does pick the newest *mature* version, so `^1.2.0` resolving to `1.2.7` while `1.2.9` exists is the setting working, not a stale lockfile.
- **It also audits the lockfile, `--frozen-lockfile` included.** Every install checks the pinned entries and fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` on one that was too young when it was written — the defence against a lockfile hand-edited to smuggle a fresh version past resolution. It reads publish dates from the metadata cache rather than the network, and entries only get older, so this never fails a lockfile that passed before.
- **`.github/dependabot.yml` carries the matching `cooldown: default-days: 7` on the npm entry only.** Without it Dependabot would propose versions pnpm then refuses to install, and the pull request would fail its own CI. It is not set on the `github-actions` or `devcontainers` entries: `cooldown` is documented per ecosystem, and Dependabot rejects a configuration file as a whole when an entry carries a key it does not support, which would stop every update in the file.

Do not disable either setting to land an update, and treat `minimumReleaseAgeExclude` the same way — it exempts named packages from the cooldown, and `pnpm audit --fix` can write entries into it. Take the newest version that has served the cooldown, or wait.

`onlyBuiltDependencies` is not used; `allowBuilds` names the packages permitted to run install scripts, and only `esbuild` is on it — its postinstall is what puts the platform binary in place. A postinstall appearing anywhere else in the tree fails the install rather than executing unnoticed, which is the point.

**TypeScript is held at 5.x.** TypeDoc 0.28 declares support through 6.0 only, so 7.x is out; 6.x additionally breaks `check:examples`, whose scratch `tsconfig.json` puts snippets under the system temporary directory while they import the library from `src/`, and 6.x rejects the resulting program with `TS6059` because no single `rootDir` covers both trees. Moving that scratch directory inside the package would be the fix, and is a change in its own right rather than something to fold into a dependency bump.

## Releasing to npm

Dependencies are installed with pnpm, but the publish step itself runs `npm publish`. `--provenance` is npm's own feature and `pnpm publish` does not document the flag; a client that silently ignored it would upload a tarball with no attestation and no error to say so. Everything else in the release workflow is pnpm.

`.github/workflows/publish-npm.yml` publishes `@elite-dangerous-almanac/core`. **Nobody publishes from a laptop** — a hand-run `npm publish` produces a tarball with no provenance, built from whatever happened to be in the working tree, and it cannot be undone once the version is taken.

Releasing is two steps:

1. Bump `version` in `typescript/package.json` and merge that to `main`.
2. Publish a GitHub release whose tag names the same version — `v1.2.3`, or `typescript-v1.2.3` for the day a second implementation releases on its own cadence. Both forms are accepted; the workflow strips the prefix and the leading `v` and refuses to publish if what is left disagrees with the manifest.

A tag in neither form leaves the job **unstarted**, rather than failing it. That is what keeps this workflow out of the way of a `python-v1.0.0` release: a foreign tag is not this package's release, and a red X on someone else's would be this workflow's bug. The cost is that a typo'd tag is silent, so read the release's checks rather than assuming a green repository means a publish happened.

What the workflow does with that:

- **Reruns everything.** `pnpm run audit`, then `pnpm run check && pnpm run build && pnpm run test:package` — lint, formatting, types, documented-example compilation and value checks, the coverage-gated suite, the full build and the built-`dist/` entry-point suite, all against the tagged commit. The release does not trust the CI run on the branch it came from.
- **Publishes only from a tag.** A release event names its tag; a manual run has to be sitting on one. A version number is permanent, so it is only ever taken from a ref that cannot move.
- **Refuses a version that already exists.** npm versions are immutable, so the check happens before the build rather than as a failed upload at the end. A registry that cannot be reached is not treated as a version that is free — only npm's own "no such package or version" passes.
- **Picks the dist-tag from the version.** A SemVer prerelease suffix (`1.2.3-rc.1`) publishes under `next`; everything else under `latest`. A prerelease must never be what `npm install` hands someone by default. The corollary, if the first release of a *new* package is ever a prerelease: it publishes under `next` only, and a bare `npm install` of it fails until a non-prerelease follows.
- **Attaches provenance.** `--provenance` needs `id-token: write`, and it is what puts the verified badge on the npm page linking the tarball to this commit and this workflow run. `--access public` is required because the package is scoped, and scoped packages default to restricted.

**The checks run in their own step, and the publish step passes `--ignore-scripts`.** This is the one place the workflow deliberately departs from the obvious shape. Letting `prepublishOnly` do the work would run ESLint, `tsc`, the whole test suite and esbuild — that is, arbitrary code from every devDependency in the tree — in the same process environment as `NODE_AUTH_TOKEN`, a credential that can publish to the scope. Splitting them costs nothing and means the token exists only for the upload. A `prepack` or `prepare` script added to the package later has to be wired into the explicit step, because `--ignore-scripts` will skip it.

Setup this needs once, in repository settings, **before the first release**:

1. Create an environment named `npm` (Settings → Environments). The workflow would create it on first run, but an auto-created environment has no secrets and no protection rules, and that run then fails at the token check.
2. Add `NPM_TOKEN` to **that environment**, not to the repository: an npm automation token with publish rights on the `@elite-dangerous-almanac` scope.
3. Restrict the environment's deployment branches and tags to release tags, and add required reviewers if a release should need a human. Environment scoping alone does not isolate the secret — any job declaring `environment: npm` can read it — so the protection rules are what make it true that only a release can spend the token.

`workflow_dispatch` runs the same job with **dry-run on by default**: the checks, the real build, and `npm publish --dry-run`, which prints the file list the tarball would carry without taking the version. Use it to rehearse a release, or to see what `files` currently packs. Two things a dry run does **not** cover: the token and already-published checks are skipped, and provenance is never generated — npm only mints an attestation on a real publish, so OIDC and the registry's own validation of it are first exercised for real. Unticking the input publishes for real, and is then subject to the same tag requirement as a release.

## How the shared assets flow into TypeScript

```
data/<domain>/*.jsonc ──(strip comments)──> src/<area>/<catalogue>.ts ──> deepFreeze ──> exported constant
fixtures/<domain>/*.jsonc ──(strip comments)──────────────────────────> src/<area>/*.test.ts
```

- A catalogue module imports its `.jsonc` directly. Comments are stripped by `scripts/jsonc.mjs`, wired into the test runner via `scripts/register-jsonc.mjs` (`--import` **after** tsx) and into the build by an esbuild `onLoad` plugin in `tsup.config.ts`. `src/jsonc.d.ts` types the import as `unknown`, so each catalogue casts to its own interface — that cast is the only place the data's shape is asserted, so keep the interface honest.
- Fixtures are imported by tests with `with { type: 'json' }` — the same loader strips their header comments — and hold the *expected* values. `pnpm run generate:fixtures` groups compatible captures into fixture families, generates the language-neutral `schemas/fixtures.schema.json`, and generates `src/fixtures.generated.d.ts` for typed TypeScript imports; `pnpm run check:fixtures` detects stale output. They are the parity contract: a fixture pins behaviour for every future language implementation, so prefer adding a fixture entry over an inline literal whenever the value is a fact about the game rather than a fact about TypeScript. The build corpus is the one fixture a test reads from disk rather than importing.
- `typedoc.json` lists **one entry point per feature area**, plus any leaf module the barrels do not re-export (see the doc-generation toolchain section for the rule). Add a new area there, to the `exports` map and to the coverage globs.
