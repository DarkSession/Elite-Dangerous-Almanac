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
- **Subpath exports** (`exports` map in `package.json`) per feature area (e.g. `almanac/ships`, `almanac/market`, `almanac/astro`) so consumers can import a slice without touching the root barrel.
- **Prefer pure functions over stateful classes**; when classes are used, avoid static registries or cross-class coupling that drags unrelated code into the bundle.
- **Static data is the biggest bundle risk**: never expose one monolithic data import. Split `data/` consumption into per-domain (and where sensible per-entity-group) modules so importing one ship's stats doesn't bundle the whole galaxy.
- **Nothing in a data payload that isn't data.** Prose a program never reads — attribution, notes, descriptions — is inlined into every consumer's bundle just like the records are. It belongs in the file's comment header (see §Data file format), where it stays next to the data and costs consumers nothing. On the small catalogues this is not a rounding error: `permit-locks` was 20% attribution by weight.
- **No packing or minification in the library source.** Keep the checked-in source and the shared `data/` / `fixtures/` as normal, readable, well-formatted code and JSON — never hand-minified, pre-bundled, or otherwise compacted. All bundling, minification, tree-shaking, dead-code elimination, and payload compaction belong to the per-language **build/dist step** (e.g. `tsup`/esbuild for TypeScript), never baked into source. This keeps the data reviewable and diff-able, and keeps the shared assets portable across language implementations that each pack differently.

Tree-shakeability is part of feature parity: other language implementations should mirror the same fine-grained module boundaries (e.g. Python subpackages matching the TS subpath exports).

## Testing Requirements

- **Validate against the shared fixtures.** Behavior is proven against the language-neutral fixtures in `fixtures/` (see Multi-Language Strategy), so every implementation demonstrates identical behavior on identical data.
- **Minimum coverage: ≥ 80%.** Each language implementation must keep automated-test coverage (lines and branches) at **80% or above**, and CI must enforce it — a drop below the threshold fails the build. Add genuine test cases for real behavior; do not chase the number with assertion-free tests or by excluding code from measurement.
  - **TypeScript**: measure with `node --test --experimental-test-coverage` (or c8/istanbul) and fail CI under 80%.
  - **Python (future)**: measure with `coverage.py` / `pytest --cov` and fail CI under 80%.

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
- **In `README.md`**: maintain a dedicated "Attributions" / "Credits" section listing every external data source, algorithm, and library, with author, link, and license. This is the human-facing summary and must stay in sync with the in-source credits.

Whenever you add or change data, port an algorithm, or introduce a dependency that warrants credit, update **both** the in-source attribution and the README section in the same change. Respect each source's license terms (attribution text, share-alike, etc.).

## Repository Layout

Monorepo with one subfolder per language implementation and shared, language-neutral assets at the top level:

```
data/          # shared static data (JSONC) — astrophysical, ships, characters, market
fixtures/      # shared test fixtures (JSON) — every implementation validates against these
schemas/       # shared JSON Schemas — language-neutral validation for data payloads
typescript/    # TypeScript library (package.json, src/, tests, typedoc.json)
python/        # (future) Python library — same features, same fixtures
```

`data/` and `fixtures/` are owned by no implementation; language folders consume them. Never copy shared data into a language folder.

## Repository Status

Greenfield — no source code yet. Only the dev container configuration, doc/CI scaffolding, and this layout exist so far.

## Environment

Development happens inside a dev container (`.devcontainer/devcontainer.json`) based on the TypeScript/Node 22 (bookworm) image, with Python 3.12 also installed. Runs as the `node` user. ESLint + Prettier for TypeScript; Pylance for Python.

## Notes for Future Updates

Once the project takes shape, update this file with:
- Build, lint, and test commands per language (including how to run a single test)
- The high-level architecture, especially how shared data/fixtures flow into each language implementation
