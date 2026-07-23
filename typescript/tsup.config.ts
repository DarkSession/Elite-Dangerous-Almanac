import { defineConfig } from 'tsup';

/**
 * Builds the library to `dist/` as tree-shakeable ESM with type declarations.
 *
 * **One entry per source module**, not just per subpath barrel. This is what makes
 * the tree-shaking promise real: if the two barrels (`src/index.ts`,
 * `src/astro/index.ts`) were the only entries, `splitting` would fuse every module
 * and its inlined JSON into one shared chunk, so a consumer importing a single leaf
 * function (e.g. `massCodeToSizeClass`) would still pull the whole galaxy. Emitting
 * each module as its own entry keeps the data-bearing modules in separate chunks, so
 * `"sideEffects": false` lets a downstream bundler drop everything the consumer does
 * not import. (Verified: a leaf import bundles to ~190 B, not ~260 KB.)
 *
 * esbuild inlines the shared `data/astro/*.json` payloads into the bundle, so the
 * published package is self-contained and the top-level `data/` directory stays the
 * single source of truth (never copied).
 */
export default defineConfig({
    // Each module is its own entry (tests excluded); the barrels re-export them.
    entry: ['src/index.ts', 'src/astro/*.ts', '!src/astro/*.test.ts'],
    format: ['esm'],
    dts: true,
    splitting: true, // dedupe shared modules into chunks; keeps per-module entries independent
    treeshake: true,
    clean: true,
    sourcemap: true,
    outDir: 'dist',
});
