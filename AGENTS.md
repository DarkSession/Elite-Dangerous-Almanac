# AGENTS.md

This file provides guidance to AI coding agents (e.g. Claude Code) when working with code in this repository.

## Project Purpose

**Elite Dangerous Almanac** is a ready-to-go library for Elite Dangerous community app developers and researchers. It provides a comprehensive set of static data and calculations covering:

- Astrophysical data
- Ship data
- Character data
- Market data

## Multi-Language Strategy

The library starts in **TypeScript**, with **Python** (and potentially other languages/frameworks) planned for the future. Two hard requirements shape all design decisions:

1. **Feature parity** — every language implementation must expose the same features and behavior.
2. **Shared test fixtures** — all implementations are validated against the same language-agnostic test fixtures.

When adding features or data, keep them portable: prefer language-neutral formats (e.g. JSON) for static data and fixtures so every implementation can consume them without duplication.

Every data update must also follow `data/SNAPSHOTS.md`: record its acquisition date, immutable upstream revision when available, derivation method, and any manual corrections.

### Data file format: JSONC in `data/`, plain JSON in `fixtures/`

Files in **`data/`** are **JSONC** (`.jsonc`): JSON preceded by a comment header carrying the file's attribution (see §Attribution). Files in **`fixtures/`** stay plain `.json` — they are test-only, never bundled, so there is nothing to keep out of a payload.

Two rules keep `.jsonc` portable, and both are enforced by `typescript/src/astro/data-files.test.ts`:

1. **Comments are the only JSONC extension used.** No trailing commas, no unquoted keys, no single quotes. Strip the comments and what remains must be strict JSON that any language's standard parser accepts — Python's `json`, Go's `encoding/json`, and so on. A trailing comma is portable only in JSON5, which is a different format.
2. **Attribution lives in the header comment, never in the payload.** No top-level `attribution` or `description` key. Every payload byte is inlined into consumers' bundles; comment bytes are not.

Each implementation strips comments in its own loader — never by generating `.json` copies, which would break `data/`'s single-source-of-truth rule. TypeScript does it in `typescript/scripts/jsonc.mjs`, wired into the test runner (`scripts/register-jsonc.mjs`, via `--import` *after* tsx) and into the build (an esbuild `onLoad` plugin in `tsup.config.ts`), with `src/jsonc.d.ts` typing the import as `unknown` so each consumer casts to its own interface. Python would use the same one-function approach before `json.loads`.

> **Editors reformat `.jsonc`.** Some formatters treat the extension as JSON5 and add trailing commas, silently breaking rule 1. If a data file starts failing to parse, check what your editor did to it before suspecting the loader.

## Build & Tree-Shaking Requirements

Consumers (community apps, often web-based) must only pay for what they import. Build the library in small pieces and keep everything tree-shakeable:

- **Small modules**: one class/interface/feature area per file. No god-modules.
- **ESM output** with `"sideEffects": false` in `package.json`; no side effects at module top level (no registration-on-import, no mutable module state, no self-executing code).
- **Named exports only** — no default exports, no namespace-object re-export patterns (`export * as X`) that defeat tree-shaking.
- **Subpath exports** (`exports` map in `package.json`) per feature area, so consumers can import a slice without touching the root barrel. The published package is `@elite-dangerous-almanac/core`, exposing `./astro`, `./ships`, `./materials` and `./commodities` plus a wildcard for individual modules within each (`./ships/*`). A module that is an implementation detail is mapped to **`null`** in the same map, which makes deep-importing it a resolution error rather than a supported entry point — the pattern to follow for anything marked `@internal`.
- **Prefer pure functions over stateful classes**; when classes are used, avoid static registries or cross-class coupling that drags unrelated code into the bundle.
- **Static data is the biggest bundle risk**: never expose one monolithic data import. Split `data/` consumption into per-domain (and where sensible per-entity-group) modules so importing one ship's stats doesn't bundle the whole galaxy.
- **Usability outranks tree-shaking when the two collide.** A registry lookup takes an *optional* catalogue argument defaulting to the whole registry (`getMaterialByName('iron')`) — a journal line hands you a symbol and nothing else, so making the caller identify the category first was solving the library's problem with the user's time. The price is that a default is a static import: the data cannot be dropped even when an explicit catalogue is passed. Decide it by measuring, in the units the README defines (the shipped `dist/` files in the import graph): materials 15 KB, micro resources 14 KB, commodities 28 KB — noise; `ships/modules` 290 KB (30 KB gzipped) — worth naming in its own docs, which it does. **`astro/nebulae` is the counter-example**: `ALL_NEBULAE` is 682 KB, so its argument stays required. Default to the whole registry unless that would cost more than the rest of the library, say which way you went in the module's own docs, and do not reverse either decision without a fresh measurement.
- **Nothing in a data payload that isn't data.** Prose a program never reads — attribution, notes, descriptions — is inlined into every consumer's bundle just like the records are. It belongs in the file's comment header (see §Data file format), where it stays next to the data and costs consumers nothing. On the small catalogues this is not a rounding error: `permit-locks` was 20% attribution by weight.
- **No packing or minification in the library source.** Keep the checked-in source and the shared `data/` / `fixtures/` as normal, readable, well-formatted code and JSON — never hand-minified, pre-bundled, or otherwise compacted. All bundling, minification, tree-shaking, dead-code elimination, and payload compaction belong to the per-language **build/dist step** (e.g. `tsup`/esbuild for TypeScript), never baked into source. This keeps the data reviewable and diff-able, and keeps the shared assets portable across language implementations that each pack differently.

Tree-shakeability is part of feature parity: other language implementations should mirror the same fine-grained module boundaries (e.g. Python subpackages matching the TS subpath exports).

## Testing Requirements

- **Validate against the shared fixtures.** Behavior is proven against the language-neutral fixtures in `fixtures/` (see Multi-Language Strategy), so every implementation demonstrates identical behavior on identical data.
- **Minimum coverage: ≥ 80%.** Each language implementation must keep automated-test coverage at **80% or above** on **lines, branches and functions**, and CI must enforce it — a drop below the threshold fails the build. Add genuine test cases for real behavior; do not chase the number with assertion-free tests or by excluding code from measurement.
  - **TypeScript**: `npm test` runs `node --test --experimental-test-coverage` with `--test-coverage-lines/-branches/-functions=80`, scoped to `src/<area>/*.ts` and excluding `*.test.ts`. Adding a new feature area means adding its `--test-coverage-include` glob, or the area is silently unmeasured.
  - **Python (future)**: measure with `coverage.py` / `pytest --cov` and fail CI under 80%.

## Documentation Requirements

This is a library, so documentation is a first-class deliverable:

- **Every public class, function, type, and constant must be documented in detail** — description, parameters, return values, units (critical for astrophysical/market calculations), value ranges, and examples.
- **Follow each language's framework-standard doc format** so standard tooling can extract it:
  - TypeScript: TSDoc/JSDoc comments (`/** ... */` with `@param`, `@returns`, `@example`, `@remarks`).
  - Python (future): Google-style docstrings.
- **Docs must be convertible to GitHub Wiki format.** API documentation is generated from source comments and published to the repo wiki automatically — never hand-edit generated wiki pages.

### Doc-generation toolchain

- **TypeScript**: TypeDoc + `typedoc-plugin-markdown` + `typedoc-github-wiki-theme`. The wiki theme produces wiki-friendly file names, wiki-compatible internal links, and a `_Sidebar.md` for navigation. `typedoc.json` lists **one entry point per feature module** (`src/astro/index.ts`, `src/commodities/index.ts`, `src/materials/index.ts`, `src/ships/index.ts`) rather than the root barrel — this gives the wiki one section per module: `Home` links to each module, every module has its own index page (carrying its `@packageDocumentation` intro), and symbol pages are namespaced (e.g. `astro.Function.decodeSystemAddress`). Add a module here when you add one under `src/`.
- **Python (future)**: `mkdocstrings` (or `pydoc-markdown`) to render Google-style docstrings to Markdown for the same wiki.
- **Publishing**: a GitHub Actions workflow generates the Markdown docs and pushes them to the wiki's backing git repo (`<repo>.wiki.git`), e.g. via `Andrew-Chen-Wang/github-wiki-action`. The job needs `contents: write` permission. Note: the wiki must be initialized once manually (create any first page) before CI can push to it.

## Attribution Requirements

Much of the static data and many calculations derive from the Elite Dangerous community (e.g. EDCD, EDDN, EDSM, Spansh, forum research, individual authors) as well as third-party libraries. Proper credit is mandatory and must appear in **both** places:

- **In the source code**, next to the thing being attributed. Put the credit where a reader encounters the data or algorithm:
  - Data files (`data/`): open the file with a **comment header** giving origin, author, license/terms, and any derivation caveats, then point at the sibling `SOURCES.md` for the long form. Put it in a comment, not in an `attribution` field — see §Data file format for why, and copy the header of any existing `data/astro/*.jsonc` for the shape.
  - Code (calculations, ported algorithms): a doc comment on the function/module citing the original source, author, and license, with a link where possible.
- **In `ATTRIBUTIONS.md`** at the repository root: the single canonical list of every external data source, algorithm and library, with author, link and licence — including any licence text an upstream requires be reproduced in full. It lives at the root because it is language-neutral, exactly like `data/` and `fixtures/`.

Whenever you add or change data, port an algorithm, or introduce a dependency that warrants credit, update **both** the in-source attribution and `ATTRIBUTIONS.md` in the same change. Respect each source's license terms (attribution text, share-alike, etc.).

> **Do not write a second copy of the credits or the licence.** `README.md` carries a short pointer, not a list. `typescript/THIRD_PARTY_NOTICES.md` and `typescript/LICENSE` are **generated, git-ignored** verbatim copies of the root `ATTRIBUTIONS.md` and `LICENSE` — npm can only pack files inside the package directory, and several upstream licences require the notice to travel with the distribution. `npm run build` writes both (`typescript/scripts/copy-notices.mjs`), `prepublishOnly` runs the build, and `package.test.mjs` asserts each copy is byte-identical to its source. Edit the root files; never the copies. Because the root `LICENSE` is packed verbatim, keep its wording readable from inside a consumer's `node_modules` as well as from the repository.

## Repository Layout

Monorepo with one subfolder per language implementation and shared, language-neutral assets at the top level:

```
data/          # shared static data (JSONC), one folder per domain, each with a SOURCES.md
fixtures/      # shared test fixtures (JSON) — every implementation validates against these
schemas/       # shared JSON Schemas — language-neutral validation for data payloads
scripts/       # repository tooling for deriving data; never shipped in any package
typescript/    # TypeScript library (package.json, src/, tests, typedoc.json)
python/        # (future) Python library — same features, same fixtures
```

`data/` and `fixtures/` are owned by no implementation; language folders consume them. Never copy shared data into a language folder. `data/SNAPSHOTS.md` states the snapshot date and the metadata every update must record; each `data/<domain>/SOURCES.md` carries the long-form provenance for that domain — source, revision, derivation, manual corrections, and known gaps. **GitHub issues** are the short actionable list of those gaps — see §Tracking known gaps.

## Tracking known gaps

**Open gaps live in GitHub issues, not in a file in the repository.** There is no `TODO.md`; the list it used to hold was migrated to issues on `DarkSession/Elite-Dangerous-Almanac`, one per gap.

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

- **Catalogues are frozen.** Shared data is imported as a process-wide module singleton, so every exported catalogue is passed through `deepFreeze` (`src/deep-freeze.ts`) — otherwise one consumer's mutation changes another's lookups. `src/catalogue-immutability.test.ts` asserts this for every exported catalogue; add new ones to it.
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

Two related habits, for the same reason:

- **A captured source is scrubbed of the person, not of the game.** A journal capture, a SLEF export or a community build reaches you attached to whoever produced it — a commander name, an account id, an uploader, a home directory in a path, the link the build was shared from. That goes; the game data stays. `fixtures/ships/builds/` stores its 181 builds without author, name or link (`data/ships/SOURCES.md` records the choice and what it costs), while the Krait Phantom capture deliberately keeps its `ShipName`, `ShipIdent`, `ShipID` and `timestamp` — those describe a ship, they are what makes it ground truth, and none of them names a person.
- **Keep the model out of the repository.** The model identifier you run as belongs in chat, never in a commit message, PR body, code comment or data file.

## Commands

All TypeScript commands run from `typescript/`:

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run check`        | lint → format:check → typecheck → test. **Run this before finishing.** |
| `npm test`             | full suite with the coverage thresholds                             |
| `npm run typecheck`    | `tsc --noEmit`                                                      |
| `npm run lint`         | ESLint                                                              |
| `npm run format`       | Prettier over the package, root README, schemas and workflows       |
| `npm run build`        | `tsup` → `dist/` (minified, JSON catalogues inlined)                |
| `npm run test:package` | imports the **built** `dist/` and checks every export subpath        |
| `npm run docs`         | TypeDoc → `docs/wiki`, then `scripts/postprocess-wiki.mjs`           |

Run one test file with the same loaders the suite uses — plain `node --test` cannot resolve `.ts` or `.jsonc`:

```bash
node --import tsx --import ./scripts/register-jsonc.mjs --test src/ships/weapons.test.ts
```

`npm run check` does not build. When a change touches the export map, the bundler config, or anything a consumer imports, also run `npm run build && npm run test:package` — CI does, and `dist/` is what consumers actually get.

## How the shared assets flow into TypeScript

```
data/<domain>/*.jsonc ──(strip comments)──> src/<area>/<catalogue>.ts ──> deepFreeze ──> exported constant
fixtures/<domain>/*.json ────────────────────────────────────────────> src/<area>/*.test.ts
```

- A catalogue module imports its `.jsonc` directly. Comments are stripped by `scripts/jsonc.mjs`, wired into the test runner via `scripts/register-jsonc.mjs` (`--import` **after** tsx) and into the build by an esbuild `onLoad` plugin in `tsup.config.ts`. `src/jsonc.d.ts` types the import as `unknown`, so each catalogue casts to its own interface — that cast is the only place the data's shape is asserted, so keep the interface honest.
- Fixtures are imported by tests with `with { type: 'json' }` and hold the *expected* values. They are the parity contract: a fixture pins behaviour for every future language implementation, so prefer adding a fixture entry over an inline literal whenever the value is a fact about the game rather than a fact about TypeScript.
- `typedoc.json` lists **one entry point per feature area**. Add a new area there, to the `exports` map, to the coverage globs, and to `src/index.ts`.
