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

## Build & Tree-Shaking Requirements

Consumers (community apps, often web-based) must only pay for what they import. Build the library in small pieces and keep everything tree-shakeable:

- **Small modules**: one class/interface/feature area per file. No god-modules.
- **ESM output** with `"sideEffects": false` in `package.json`; no side effects at module top level (no registration-on-import, no mutable module state, no self-executing code).
- **Named exports only** — no default exports, no namespace-object re-export patterns (`export * as X`) that defeat tree-shaking.
- **Subpath exports** (`exports` map in `package.json`) per feature area (e.g. `almanac/ships`, `almanac/market`, `almanac/astro`) so consumers can import a slice without touching the root barrel.
- **Prefer pure functions over stateful classes**; when classes are used, avoid static registries or cross-class coupling that drags unrelated code into the bundle.
- **Static data is the biggest bundle risk**: never expose one monolithic data import. Split `data/` consumption into per-domain (and where sensible per-entity-group) modules so importing one ship's stats doesn't bundle the whole galaxy.
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

- **TypeScript**: TypeDoc + `typedoc-plugin-markdown` + `typedoc-github-wiki-theme`. The wiki theme produces wiki-friendly file names, wiki-compatible internal links, and a `_Sidebar.md` for navigation.
- **Python (future)**: `mkdocstrings` (or `pydoc-markdown`) to render Google-style docstrings to Markdown for the same wiki.
- **Publishing**: a GitHub Actions workflow generates the Markdown docs and pushes them to the wiki's backing git repo (`<repo>.wiki.git`), e.g. via `Andrew-Chen-Wang/github-wiki-action`. The job needs `contents: write` permission. Note: the wiki must be initialized once manually (create any first page) before CI can push to it.

## Attribution Requirements

Much of the static data and many calculations derive from the Elite Dangerous community (e.g. EDCD, EDDN, EDSM, Spansh, forum research, individual authors) as well as third-party libraries. Proper credit is mandatory and must appear in **both** places:

- **In the source code**, next to the thing being attributed. Put the credit where a reader encounters the data or algorithm:
  - Data files (`data/`): include source/attribution metadata (e.g. a `source`, `attribution`, or `license` field, or a sibling `SOURCES.md`) identifying origin, author, and license/terms.
  - Code (calculations, ported algorithms): a doc comment on the function/module citing the original source, author, and license, with a link where possible.
- **In `README.md`**: maintain a dedicated "Attributions" / "Credits" section listing every external data source, algorithm, and library, with author, link, and license. This is the human-facing summary and must stay in sync with the in-source credits.

Whenever you add or change data, port an algorithm, or introduce a dependency that warrants credit, update **both** the in-source attribution and the README section in the same change. Respect each source's license terms (attribution text, share-alike, etc.).

## Repository Layout

Monorepo with one subfolder per language implementation and shared, language-neutral assets at the top level:

```
data/          # shared static data (JSON) — astrophysical, ships, characters, market
fixtures/      # shared test fixtures (JSON) — every implementation validates against these
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
