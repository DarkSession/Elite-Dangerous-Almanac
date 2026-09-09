## Summary

Describe the consumer-visible result and why the change is needed.

## Packages

Shared behavior belongs in both packages. Tick what this change touches, and say below
why a gap is acceptable if it lands in one only.

- [ ] TypeScript — `typescript/`
- [ ] .NET — `dotnet/`
- [ ] Shared data, fixtures or schemas — reaches both packages
- [ ] Repository only — documentation, workflows or scripts

## Verification

Run the gate for every package this change touches. A change to shared data, fixtures or
schemas touches both.

TypeScript, from `typescript/`:

- [ ] `pnpm run check`
- [ ] `pnpm run build && pnpm run test:package` when package code or exports changed

.NET, from `dotnet/`:

- [ ] `dotnet restore EliteDangerousAlmanac.slnx --locked-mode`
- [ ] `dotnet build coverage.proj`

Both:

- [ ] `pnpm run docs`, from `typescript/`, when a public API or documentation changed —
      it builds the TypeScript and the .NET reference, so run it after a C# change too
- [ ] Shared fixtures cover game behavior; all coverage dimensions remain at least 80%
- [ ] Data provenance, attribution and schemas are updated where applicable
- [ ] Captures, commits and this pull request contain no unrelated private or player
      identity data; required attribution to published authors is preserved

## Remaining gaps

Link any existing issue for a known gap that this change intentionally leaves open — a
parity gap between the two packages included — or write “None.”
