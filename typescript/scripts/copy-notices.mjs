#!/usr/bin/env node

/**
 * Copy the repository's canonical credits file into the package as
 * `THIRD_PARTY_NOTICES.md`.
 *
 * `ATTRIBUTIONS.md` lives at the repository root because it is language-neutral —
 * the same credits cover every implementation, exactly as `data/` and `fixtures/`
 * do. npm can only pack files inside the package directory, and several upstream
 * licences (BSD 3-Clause most explicitly) require their notice to accompany the
 * distribution, so the package needs its own copy under the filename consumers
 * and licence scanners look for.
 *
 * The copy is generated and git-ignored: edit `ATTRIBUTIONS.md`, never the copy.
 * `npm run build` runs this, and `prepublishOnly` runs the build, so a published
 * tarball always carries a current notice. `package.test.mjs` asserts the two are
 * byte-identical.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../../ATTRIBUTIONS.md', import.meta.url);
const target = new URL('../THIRD_PARTY_NOTICES.md', import.meta.url);

const notices = await readFile(source, 'utf8');
await writeFile(target, notices);

console.log(
    `copied ${fileURLToPath(source)} -> ${fileURLToPath(target)} (${notices.length} bytes)`,
);
