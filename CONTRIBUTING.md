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

The repository devcontainer supplies Node.js 22, the .NET 10 SDK, Python 3.12 and pnpm,
so inside it skip `corepack enable pnpm`.

### TypeScript

To work without the container, install Node.js 22 and run:

```bash
corepack enable pnpm
cd typescript
pnpm install --frozen-lockfile
pnpm run check
```

The package is managed with [pnpm](https://pnpm.io). `corepack enable pnpm` installs
the exact version pinned by the `packageManager` field in `typescript/package.json` and
verifies its integrity hash, so nobody needs a global pnpm. Corepack writes its shim next
to the `node` binary, so the command needs `sudo` wherever Node was installed as root;
the devcontainer runs it at image build time for that reason. Uninstall a globally
installed pnpm first: if it comes earlier on `PATH` it keeps winning, and it does not
verify the pinned hash. `command -v pnpm` should name the Corepack shim, next to `node`.
`--frozen-lockfile` is the equivalent of `npm ci`: it installs what `pnpm-lock.yaml` pins
and fails if the lockfile and the manifest disagree.

New dependency versions serve a seven-day cooldown before they can be resolved
(`minimumReleaseAge` in `typescript/pnpm-workspace.yaml`), which keeps a release that
is withdrawn in its first week out of the tree. Adding a dependency whose newest
version is younger than that fails with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`; ask for
a version that has already served the cooldown rather than disabling the setting.

### .NET

To work without the container, install the .NET SDK version that `dotnet/global.json`
pins and run:

```bash
cd dotnet
dotnet restore EliteDangerousAlmanac.slnx --locked-mode
dotnet build coverage.proj
```

`--locked-mode` installs what the `packages.lock.json` files pin and fails where a
lockfile and a project disagree. `dotnet build` treats analyzer and code-style findings
as errors, so a build checks the source as well as compiling it.

### Both packages

Each package consumes the language-neutral shared catalogues and fixtures, so each one
proves the same behavior. The two packages do not carry the same names: each one is
written the way its own language reads. A change to shared behavior belongs in both.

## Making a change

- Put reusable game data in `data/` and behavioral expectations in `fixtures/`, both as
  portable JSONC with a comment header. Do not copy a shared asset into a language
  directory.
- Credit a new source once, in `ATTRIBUTIONS.md`, and record what was taken from it in
  the matching `data/<domain>/SOURCES.md`. A fixture's provenance goes in its own header
  comment, not in a `SOURCES.md`.
- Add or update shared fixtures for game behavior. Keep line, branch and function
  coverage at or above 80%.
- Document every public API with its inputs, result, units, failure behavior and an
  example. Keep implementation-only modules in an `internal/` directory.
- In TypeScript, preserve named exports, side-effect-free ESM and fine-grained subpath
  imports. In .NET, keep the public surface inside the area namespaces, keep
  implementation-only types `internal`, and target .NET Standard 2.1.
- Use the identity already configured in Git. Do not put personal contact details or
  captured player identity into commits, fixtures or pull-request text.

Run the complete local gate for each package you changed before submitting:

```bash
cd typescript
pnpm run check
pnpm run build
pnpm run test:package
pnpm run docs
```

```bash
cd dotnet
dotnet build coverage.proj
```

A change to shared data, fixtures or schemas reaches both packages, so run both gates
for one. Changes to only prose outside a package may not exercise every command, but
data, source, schema, workflow and package changes should use the full gate.

## Pull requests

Keep a pull request focused on one coherent change. Explain its consumer-visible
effect, list the verification performed and call out any known gap that remains. A
reviewer should be able to reproduce a data derivation from the committed provenance
without relying on an uncommitted acquisition script.

By contributing, you agree that your code and documentation contributions are
licensed under the repository's MIT licence. Bundled data retains the source-specific
terms recorded in `ATTRIBUTIONS.md`.
