import { readFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';
import { stripJsonComments } from './scripts/jsonc.mjs';

/**
 * Builds the library to `dist/` as tree-shakeable ESM with type declarations.
 *
 * **One entry per public source module**, not just per subpath barrel. This is what makes
 * the tree-shaking promise real: if the two barrels (`src/index.ts`,
 * `src/astro/index.ts`) were the only entries, `splitting` would fuse every module
 * and its inlined JSON into one shared chunk, so a consumer importing a single leaf
 * function (e.g. `massCodeToSizeClass`) would still pull the whole galaxy. Emitting
 * each module as its own entry keeps the data-bearing modules in separate chunks, so
 * `"sideEffects": false` lets a downstream bundler drop everything the consumer does
 * not import. (Verified: a leaf import bundles to ~190 B, not ~260 KB.)
 *
 * esbuild inlines the shared `data/astro/*.jsonc` payloads into the bundle, so the
 * published package is self-contained and the top-level `data/` directory stays the
 * single source of truth (never copied). Those files are JSONC — their attribution
 * is a comment header, so it documents the data without being inlined here — and
 * esbuild's `json` loader rejects comments, hence the `jsonc` plugin below.
 */
export default defineConfig({
    // Each public module is its own entry; tests and export-map-blocked implementation
    // details are excluded. The latter are still bundled into public modules that use
    // them, but do not get misleading standalone JavaScript/declaration artifacts.
    entry: [
        'src/index.ts',
        'src/astro/*.ts',
        '!src/astro/*.test.ts',
        'src/materials/*.ts',
        '!src/materials/*.test.ts',
        '!src/materials/material-catalogue.ts',
        'src/ships/*.ts',
        '!src/ships/*.test.ts',
        '!src/ships/engineering-compatibility.ts',
        '!src/ships/loadout-engineering.ts',
        '!src/ships/loadout-metrics.ts',
        '!src/ships/module-stat-labels.ts',
        'src/commodities/*.ts',
        '!src/commodities/*.test.ts',
        '!src/commodities/commodity-catalogue.ts',
    ],
    format: ['esm'],
    dts: true,
    splitting: true, // dedupe shared modules into chunks; keeps per-module entries independent
    treeshake: true,
    clean: true,
    // The data modules are the bulk of the package, and esbuild inlines their JSONC
    // payloads as object literals — so minification is what strips the whitespace and
    // shortens the keys in the shipped catalogues, not just in the hand-written code.
    // Public export names survive (they are named exports, not renameable locals), and
    // nothing here dispatches on a function or class `name` at runtime.
    minify: true,
    // The published package does not include the TypeScript/JSONC sources, so
    // external maps could not display their source and more than doubled the
    // unpacked package size. Keep the distributable focused on executable ESM and
    // declarations; repository builds remain directly debuggable from `src/`.
    sourcemap: false,
    outDir: 'dist',
    esbuildPlugins: [
        {
            // Serve `data/**/*.jsonc` through esbuild's `json` loader, which is
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
