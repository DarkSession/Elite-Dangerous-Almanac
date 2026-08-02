#!/usr/bin/env node

/**
 * Copy the repository's canonical legal files into the package: `LICENSE` and
 * `ATTRIBUTIONS.md`, the latter under the name `THIRD_PARTY_NOTICES.md`.
 *
 * Both live at the repository root because they are language-neutral — the same
 * licence and the same credits cover every implementation, exactly as `data/` and
 * `fixtures/` do, so there is one copy to keep correct. npm can only pack files
 * inside the package directory, and several upstream licences (BSD 3-Clause most
 * explicitly) require their notice to accompany the distribution, so the package
 * needs its own copies under the filenames consumers and licence scanners look for.
 *
 * The copies are generated and git-ignored: edit the root files, never the copies.
 * `npm run build` runs this, and `prepublishOnly` runs the build, so a published
 * tarball always carries current terms. `package.test.mjs` asserts each copy is
 * byte-identical to its source.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const copies = [
    ['../../LICENSE', '../LICENSE'],
    ['../../ATTRIBUTIONS.md', '../THIRD_PARTY_NOTICES.md'],
];

for (const [from, to] of copies) {
    const source = new URL(from, import.meta.url);
    const target = new URL(to, import.meta.url);

    const text = await readFile(source, 'utf8');
    await writeFile(target, text);

    console.log(
        `copied ${fileURLToPath(source)} -> ${fileURLToPath(target)} (${text.length} bytes)`,
    );
}
