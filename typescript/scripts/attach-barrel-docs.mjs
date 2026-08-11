#!/usr/bin/env node

/**
 * Re-attach each barrel's `@packageDocumentation` block to its generated
 * declaration file.
 *
 * The feature barrels (`src/astro/index.ts`, `src/ships/index.ts`, …) carry the library's
 * orientation documentation: what the feature area is for, which symbol to start
 * with, and the domain traps a consumer walks into otherwise (the four meanings of
 * "region", the two `{x, y, z}` conventions, what `ShipLoadout` costs to import).
 *
 * A barrel is a file of pure re-exports, so tsup's declaration rollup emits it as a
 * flat list of `export { … } from './leaf.js'` lines and drops the file-level
 * comment — the per-symbol TSDoc on the leaf modules survives, but the guide that
 * ties them together does not. The result is that the docs a consumer most needs
 * when they first type `from '@elite-dangerous-almanac/core/ships'` are the exact
 * docs the published package omits; they exist only in the repository and the
 * generated wiki. This script copies them back.
 *
 * What this does and does not buy: TypeScript does not surface
 * `@packageDocumentation` on module hover (measured — the language service returns
 * empty documentation for a module specifier, here and for leaf modules that have
 * always carried the block), so this is not about hover text. It is about the
 * declaration file a consumer actually opens: go-to-definition on the import, or
 * reading `node_modules/@elite-dangerous-almanac/core/dist/ships/index.d.ts`, now
 * lands on the area's guide instead of a bare export list. Per-symbol hover is
 * unaffected either way.
 *
 * `npm run build` runs this after tsup. `package.test.mjs` asserts the shipped
 * declarations carry the blocks, so a build that silently stops emitting them fails
 * before publication.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Barrels whose `@packageDocumentation` must reach the published declarations. */
const BARRELS = ['astro/index', 'ships/index', 'materials/index', 'commodities/index'];

/**
 * Read the leading block comment of a source file.
 *
 * @param source - The TypeScript source text.
 * @returns The comment including its delimiters, or `null` if the file does not
 *   open with one.
 */
function leadingBlockComment(source) {
    const trimmed = source.trimStart();
    if (!trimmed.startsWith('/**')) return null;
    const end = trimmed.indexOf('*/');
    return end === -1 ? null : trimmed.slice(0, end + 2);
}

let attached = 0;
for (const barrel of BARRELS) {
    const from = new URL(`../src/${barrel}.ts`, import.meta.url);
    const to = new URL(`../dist/${barrel}.d.ts`, import.meta.url);

    const comment = leadingBlockComment(await readFile(from, 'utf8'));
    if (!comment) {
        throw new Error(`${fileURLToPath(from)} has no leading /** */ block to attach`);
    }

    const declarations = await readFile(to, 'utf8').catch((cause) => {
        throw new Error(`${fileURLToPath(to)} is missing — run \`npm run build\``, { cause });
    });
    // Idempotent: a rebuild over a clean dist starts from tsup's output, but do not
    // double-prepend if this ever runs twice against the same file.
    if (declarations.startsWith('/**')) continue;

    await writeFile(to, `${comment}\n${declarations}`);
    attached++;
}

console.log(`attached ${attached} barrel documentation block(s) to dist/**/index.d.ts`);
