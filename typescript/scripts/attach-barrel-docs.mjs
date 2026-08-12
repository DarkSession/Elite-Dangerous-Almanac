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
 * A barrel is a file of pure re-exports, so tsup's declaration rollup emits a flat list
 * of `export { … } from './leaf.js'` lines without the file-level comment. This script
 * copies that comment to the generated declaration file; per-symbol TSDoc remains on
 * the leaf declarations.
 *
 * TypeScript does not display `@packageDocumentation` on module hover. The attached
 * block is available through go-to-definition on an import or by reading the generated
 * `dist/<area>/index.d.ts`; per-symbol hover is unaffected.
 *
 * `pnpm run build` runs this after tsup. `package.test.mjs` asserts the shipped
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
        throw new Error(`${fileURLToPath(to)} is missing — run \`pnpm run build\``, { cause });
    });
    // Idempotent: a rebuild over a clean dist starts from tsup's output, but do not
    // double-prepend if this ever runs twice against the same file.
    if (declarations.startsWith('/**')) continue;

    await writeFile(to, `${comment}\n${declarations}`);
    attached++;
}

console.log(`attached ${attached} barrel documentation block(s) to dist/**/index.d.ts`);
