import { readFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';
import { stripJsonComments } from './scripts/jsonc.mjs';

/**
 * Builds the library to `dist/` as tree-shakeable ESM with type declarations.
 *
 * **One entry per public source module**, not just per subpath barrel. This is what makes
 * the tree-shaking promise real: if the root barrel and the four feature-area barrels
 * were the only entries, `splitting` would fuse every module and its inlined JSON into
 * one shared chunk, so a consumer importing a single leaf function (e.g.
 * `massCodeToSizeClass`) would still pull the whole galaxy. Emitting each module as its
 * own entry keeps the data-bearing modules in separate chunks, so `"sideEffects": false`
 * lets a downstream bundler drop everything the consumer does not import. (Verified: a
 * leaf import bundles to ~190 B, not ~260 KB.)
 *
 * esbuild inlines the shared `data/**\/*.jsonc` payloads into the bundle, so the
 * published package is self-contained and the top-level `data/` directory stays the
 * single source of truth (never copied). Those files are JSONC — their attribution
 * is a comment header, so it documents the data without being inlined here — and
 * esbuild's `json` loader rejects comments, hence the `jsonc` plugin below.
 */
export default defineConfig({
    // Each public module is its own entry. Tests are excluded, while implementation
    // details live below `src/**/internal/`; the top-level globs therefore cannot emit
    // misleading standalone JavaScript/declaration artifacts for them. They are still
    // bundled into the public modules that use them.
    entry: [
        'src/index.ts',
        'src/astro/*.ts',
        '!src/astro/*.test.ts',
        'src/materials/*.ts',
        '!src/materials/*.test.ts',
        'src/ships/*.ts',
        '!src/ships/*.test.ts',
        'src/commodities/*.ts',
        '!src/commodities/*.test.ts',
    ],
    format: ['esm'],
    dts: true,
    splitting: true, // dedupe shared modules into chunks; keeps per-module entries independent
    treeshake: true,
    clean: true,
    // Keep the library output readable. Applications can still minify their final
    // bundles, while stack traces and files opened from node_modules retain useful
    // function names and line numbers during development.
    minify: false,
    // External maps include the original TypeScript/JSONC in `sourcesContent`, so a
    // debugger can show the real source without publishing a second source tree.
    sourcemap: true,
    outDir: 'dist',
    esbuildPlugins: [
        {
            // Serve every `data/` catalogue through esbuild's `json` loader, which is
            // strict JSON, by blanking the attribution comments first.
            name: 'jsonc',
            setup(build) {
                build.onLoad({ filter: /\.jsonc$/ }, async ({ path }) => ({
                    contents: stripJsonComments(await readFile(path, 'utf8')),
                    loader: 'json',
                }));
            },
        },
    ],
});
