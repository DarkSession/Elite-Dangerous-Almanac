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

Tree-shakeability is part of feature parity: other language implementations should mirror the same fine-grained module boundaries (e.g. Python subpackages matching the TS subpath exports).

## Documentation Requirements

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
