# Contributing

Thank you for improving Elite Dangerous Almanac. Bug reports, data corrections,
documentation fixes and implementation changes are welcome.

## Before opening a change

- Search the existing issues and pull requests. Open gaps are tracked one issue per
  gap; add evidence to an existing issue instead of duplicating it.
- For a bug, include the smallest input that reproduces it, the result you observed
  and the result you expected. Remove commander names, account identifiers, local
  paths and other personal details from captures.
- For a data correction, identify the upstream source and immutable revision or
  checksum. `data/SNAPSHOTS.md` defines the provenance required for shared data.

## Development setup

The repository devcontainer supplies Node.js 22 and Python 3.12. To work without the
container, install Node.js 22 and run:

```bash
cd typescript
npm ci
npm run check
```

The TypeScript package is the current implementation. Shared catalogues and fixtures
remain language-neutral so future implementations can prove the same behavior.

## Making a change

- Put reusable game data in `data/` as portable JSONC and behavioral expectations in
  `fixtures/` as plain JSON. Do not copy shared assets into `typescript/`.
- Update the matching `data/<domain>/SOURCES.md` and `ATTRIBUTIONS.md` when data,
  algorithms or dependencies require attribution.
- Add or update shared fixtures for game behavior. Keep line, branch and function
  coverage at or above 80%.
- Document every public API with its inputs, result, units, failure behavior and an
  example. Keep implementation-only modules in an `internal/` directory.
- Preserve named exports, side-effect-free ESM and fine-grained subpath imports.
- Use the identity already configured in Git. Do not put personal contact details or
  captured player identity into commits, fixtures or pull-request text.

Run the complete local gate before submitting:

```bash
cd typescript
npm run check
npm run build
npm run test:package
npm run docs
```

Changes to only prose outside the package may not exercise every command, but data,
source, schema, workflow and package changes should use the full gate.

## Pull requests

Keep a pull request focused on one coherent change. Explain its consumer-visible
effect, list the verification performed and call out any known gap that remains. A
reviewer should be able to reproduce a data derivation from the committed provenance
without relying on an uncommitted acquisition script.

By contributing, you agree that your code and documentation contributions are
licensed under the repository's MIT licence. Bundled data retains the source-specific
terms recorded in `ATTRIBUTIONS.md`.
