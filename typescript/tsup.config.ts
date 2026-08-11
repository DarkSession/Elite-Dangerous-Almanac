import { readFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';
import { stripJsonComments } from './scripts/jsonc.mjs';

interface PackageExportTarget {
    readonly types: string;
    readonly import: string;
}

const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8')) as {
    readonly exports: Readonly<Record<string, PackageExportTarget | null>>;
};

const entries = Object.entries(manifest.exports).flatMap(([subpath, target]) => {
    if (target === null) return [];
    const match = /^\.\/dist\/(.+)\.js$/.exec(target.import);
    if (!match?.[1]) {
        throw new Error(`Public export ${subpath} has an invalid import target: ${target.import}`);
    }
    return [`src/${match[1]}.ts`];
});

/**
 * Builds the library to `dist/` as tree-shakeable ESM with type declarations.
 *
 * **One entry per public runtime subpath**, not just per feature-area barrel. This is what makes
 * the tree-shaking promise real: if the four feature-area barrels were the only entries,
 * `splitting` would fuse every module and its inlined JSON into
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
    // package.json is the public API manifest. Deriving entries from its explicit
    // runtime targets prevents a new source file from becoming a build artifact until
    // its public subpath is deliberately added. Type-only implementation modules are
    // rolled into the declarations of the runtime entries that expose their types.
    entry: entries,
    format: ['esm'],
    dts: true,
    splitting: true, // dedupe shared modules into chunks; keeps per-module entries independent
    treeshake: true,
    clean: true,
    // Keep the library output readable. Applications can still minify their final
    // bundles, while stack traces and files opened from node_modules retain useful
    // function names and line numbers during development.
    minify: false,
    // Publish external maps deliberately: Node, browser devtools and downstream
    // bundlers can trace failures back to the TypeScript or JSONC source path instead
    // of stopping at generated JavaScript. Omitting sourcesContent keeps that debugging
    // value without duplicating the source and large catalogues in the package.
    sourcemap: true,
    esbuildOptions(options) {
        options.sourcesContent = false;
    },
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
