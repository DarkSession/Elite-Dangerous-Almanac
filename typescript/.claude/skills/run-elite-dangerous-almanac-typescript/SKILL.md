---
name: run-elite-dangerous-almanac-typescript
description: Build, run, smoke-test, and screenshot-free verify the Elite Dangerous Almanac TypeScript library. Use when asked to run, build, test, or confirm a change works in the @elite-dangerous-almanac/core package — it drives the real built dist/ against the shared fixtures.
---

# Run: Elite Dangerous Almanac (TypeScript)

`@elite-dangerous-almanac/core` is a **tree-shakeable ESM library** (no CLI, no
server, no UI) of static Elite Dangerous data and pure calculations. It has four
feature areas: `astro` (procedural system names, `id64` system addresses,
galactic/hand-authored region lookups, nebula catalogues), `ships` (hull and
module catalogues, loadouts, engineering, build metrics), `materials` and
`commodities`.

"Running" a library means importing it the way a consumer does and calling the
real functions. The driver here does exactly that: it imports the built
`dist/astro/index.js` via the package's `./astro` subpath and asserts its output
against the **shared, in-game-verified fixtures** in `../fixtures/astro/`. A green
run proves the shipped build computes correct values, not merely that it loads.
The driver covers `astro`; the other three areas are covered by `npm test` and by
`npm run test:package`, which imports every published subpath from `dist/`.

**All paths below are relative to `typescript/` (the unit root).** `cd` there first.
The fixtures live one level up at `../fixtures/`; the driver resolves that itself.

## Prerequisites

Node 22 + npm (already present in the dev container). No `apt-get` needed — this
is pure JS/TS with no native modules or system libraries.

```bash
npm install    # only if node_modules/ is missing
```

## Build

The driver imports from `dist/`, so build first (and rebuild after any `src/` edit):

```bash
npm run build      # tsup -> dist/, one entry per feature area and leaf (ESM + .d.ts)
```

## Run (agent path) — the smoke driver

This is the primary way to confirm the library works end-to-end:

```bash
node .claude/skills/run-elite-dangerous-almanac-typescript/driver.mjs
```

Expected output (exit 0 on all-pass, 1 on any failure):

```
[1] name<->id64 across 11 verified systems
[2] hand-authored region override across 6 systems
[3] galactic region lookup across 5 coords + 3 boxels
[4] direct function path: Synuefe EN-H d11-96 -> id64 3309179996515
[5] nebulae: 5835 catalogued, 6 nearest + 3 radius queries

✅ SMOKE PASS — 96 assertions
```

What it exercises (each block maps to one shared fixture):

1. **`name ⇄ id64`** — `StarSystem.fromName(name).systemAddress` and the reverse
   decode, across every entry in `system-addresses.json`.
2. **Hand-authored regions** — `fromSystemAddress(id64, coords)` reproduces the
   game name and permit flag; without coords it falls back to the procedural alias
   (`hand-authored-regions.json`).
3. **Galactic region map** — `findRegionAt({ x, z })` and `findRegionForBoxel(id64)`
   (`galactic-region.json`).
4. **Direct pure-function path** — `parseSystemName` / `encodeSystemAddress` /
   `decodeSystemAddress` without the `StarSystem` wrapper (what most internal PRs
   touch).
5. **Nebula catalogues** — catalogue sizes, `nearestNebulae` / `nebulaeWithin`
   distances and `getNebulaByName` lookups (`nebulae.json`).

When you change what the library computes, extend `driver.mjs` — it is the
committed harness, not scaffolding.

## Direct invocation (fast inner loop, no build)

For a PR that touches one internal function, skip the build and import `src/`
directly with `tsx` (the same runner the tests use). Two requirements: the probe
must sit **inside `typescript/`** so its relative import resolves, and it needs the
**`.jsonc` loader** as well as `tsx`, or importing any catalogue fails. Note the
**`.js` extension on `.ts` sources** — ESM/NodeNext requires it:

```bash
cat > probe.mts <<'EOF'
import { StarSystem } from './src/astro/index.js';   // .js, not .ts
console.log(StarSystem.fromName('blae eock kc-c d0')?.systemAddress);  // -> 10577693187n
EOF
node --import tsx --import ./scripts/register-jsonc.mjs probe.mts
rm probe.mts
```

## Test

```bash
npm test             # full suite with the enforced 80% coverage thresholds
npm run typecheck    # tsc --noEmit, must be clean
npm run check        # lint -> format:check -> typecheck -> test; run before finishing

# a single test file — both loaders, in this order
node --import tsx --import ./scripts/register-jsonc.mjs --test src/astro/system-address.test.ts
```

## Gotchas

- **Rebuild before running the driver.** It imports `dist/`, so `src/` edits are
  invisible until `npm run build`. For a no-build check, use the `tsx` src-import
  path above instead.
- **`tsx` alone cannot run the source.** Catalogues import `data/**/*.jsonc`
  directly, so every `node --import tsx` invocation also needs
  `--import ./scripts/register-jsonc.mjs`, after tsx. `npm test` wires both up.
- **`parseSystemName` does NOT canonicalize casing.** `formatSystemName(parseSystemName('synuefe en-h d11-96'))`
  is `'synuefe EN-H d11-96'` (region casing preserved). Canonical re-casing happens
  in `StarSystem.fromName(...).name` / `canonicalizeSystemName`.
- **Decoding a hand-authored system needs coords.** `fromSystemAddress(id64)`
  without coords yields the _procedural_ name (e.g. `Pru Euq SU-T b3-0`), not the
  game-displayed hand-authored name (`Col 285 Sector IB-X b30-0`). Two entries in
  `system-addresses.json` are hand-authored, so the driver only asserts the
  no-coords decode for procedural systems and covers the coords path via
  `hand-authored-regions.json`.
- **id64s are `BigInt`.** Fields reach bit 55, past JS's 32-bit bitwise range;
  fixtures store them as decimal strings — wrap with `BigInt(...)` and compare with `===`.
- **Import the `./astro` subpath, not the root barrel**, to keep bundles small.
  Everything is also reachable from `@elite-dangerous-almanac/core` but that drags
  the whole feature area in.

## Troubleshooting

| Symptom                                      | Fix                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ERR_MODULE_NOT_FOUND …/dist/astro/index.js` | Run `npm run build` first.                                                          |
| `Cannot find module './src/astro/index.ts'`  | Use the `.js` extension in the import, and run with `node --import tsx`.            |
| `ERR_UNKNOWN_FILE_EXTENSION ".jsonc"`        | Add `--import ./scripts/register-jsonc.mjs` after `--import tsx`.                   |
| Driver reports `decode … got "<procedural>"` | Expected for hand-authored fixtures without coords — see Gotchas; not a regression. |
| `node_modules` missing                       | `npm install`.                                                                      |
