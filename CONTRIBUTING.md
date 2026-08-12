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
corepack enable pnpm
cd typescript
pnpm install --frozen-lockfile
pnpm run check
```

The package is managed with [pnpm](https://pnpm.io); `corepack enable pnpm` installs
the exact version pinned by the `packageManager` field in `typescript/package.json`, so
no global pnpm install is needed and everyone runs the same one. `--frozen-lockfile` is
the equivalent of `npm ci`: it installs what `pnpm-lock.yaml` pins and fails if the
lockfile and the manifest disagree.

New dependency versions serve a seven-day cooldown before they can be resolved
(`minimumReleaseAge` in `typescript/pnpm-workspace.yaml`), which keeps a release that
is withdrawn in its first week out of the tree. Adding a dependency whose newest
version is younger than that fails with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`; ask for
a version that has already served the cooldown rather than disabling the setting.

The TypeScript package consumes language-neutral shared catalogues and fixtures so
each language implementation can prove the same behavior.

## Making a change

- Put reusable game data in `data/` and behavioral expectations in `fixtures/`, both as
  portable JSONC with a comment header. Do not copy shared assets into `typescript/`.
- Credit a new source once, in `ATTRIBUTIONS.md`, and record what was taken from it in
  the matching `data/<domain>/SOURCES.md`. A fixture's provenance goes in its own header
  comment, not in a `SOURCES.md`.
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
pnpm run check
pnpm run build
pnpm run test:package
pnpm run docs
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
