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

## Repository Status

Greenfield — no source code yet. Only the dev container configuration exists so far.

## Environment

Development happens inside a dev container (`.devcontainer/devcontainer.json`) based on the TypeScript/Node 22 (bookworm) image, with Python 3.12 also installed. Runs as the `node` user. ESLint + Prettier for TypeScript; Pylance for Python.

## Notes for Future Updates

Once the project takes shape, update this file with:
- Build, lint, and test commands per language (including how to run a single test)
- The high-level architecture, especially how shared data/fixtures flow into each language implementation
