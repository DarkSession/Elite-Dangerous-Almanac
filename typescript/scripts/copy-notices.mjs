#!/usr/bin/env node

/**
 * Copy the repository's canonical legal and provenance files into the package.
 * `ATTRIBUTIONS.md` travels under the conventional name
 * `THIRD_PARTY_NOTICES.md`; the data snapshot policy and every domain's
 * `SOURCES.md` keep their repository layout under `PROVENANCE/`.
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
 * tarball always carries current terms and the exact provenance of its data.
 * `package.test.mjs` asserts each copy is byte-identical to its source and that
 * every data domain is represented.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

const dataRoot = new URL('../../data/', import.meta.url);
const provenanceRoot = new URL('../PROVENANCE/', import.meta.url);

await rm(provenanceRoot, { recursive: true, force: true });
await mkdir(provenanceRoot, { recursive: true });

const provenanceFiles = [['SNAPSHOTS.md', 'SNAPSHOTS.md']];
const domains = (await readdir(dataRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

for (const domain of domains) {
    await mkdir(new URL(`${domain}/`, provenanceRoot));
    provenanceFiles.push([`${domain}/SOURCES.md`, `${domain}/SOURCES.md`]);
}

for (const [from, to] of provenanceFiles) {
    const source = new URL(from, dataRoot);
    const target = new URL(to, provenanceRoot);
    const text = await readFile(source, 'utf8');
    await writeFile(target, text);
    console.log(
        `copied ${fileURLToPath(source)} -> ${fileURLToPath(target)} (${text.length} bytes)`,
    );
}
