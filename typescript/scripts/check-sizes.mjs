#!/usr/bin/env node

/**
 * Check every documented byte-size figure: each `KiB`/`MiB` number in the public source
 * and in the Markdown pages and READMEs consumers see.
 *
 * A documented size is a promise about what an import costs, and it is the figure a
 * consumer weighs an entry point by before they ever install the package. Left
 * unchecked it rots silently — a data-adding change moves a catalogue by a few hundred
 * bytes and nothing says so — which is the same failure `check-examples.mjs` exists to
 * prevent for documented values. This is that check for sizes.
 *
 * The docs stay hand-written and the manifest holds no numbers: each entry in
 * `documented-sizes.json` names a claim's *location* (a literal slice of the sentence or
 * table row, with `{}` where the number sits) and the *measurement* it must equal, so a
 * figure lives in exactly one place — the prose a reader actually sees. Generating the
 * figures into the prose instead would need a marker in every sentence and would make
 * the wording the tooling's rather than the writer's.
 *
 * Two assertions run over that manifest:
 *
 * 1. **Every registered claim matches a fresh measurement.** Each bundle is measured by
 *    bundling its published entry point with esbuild (`bundle`, `minify`, ESM), which is
 *    what the docs say the figures are; the gzipped column is `zlib.gzipSync` at its
 *    default level. The entry points are taken from `dist/`, so what is weighed is the
 *    package a consumer installs — which is why the `check:sizes` script builds first.
 *    Measuring `src/` instead would need no build but would answer a different question:
 *    `dist/` is code-split, so a single named import pulls whole published chunks, and
 *    the two bases disagree by up to a kilobyte on exactly the entry points where that
 *    granularity is the point.
 * 2. **No size figure escapes the manifest.** Every `KiB`/`MiB`/`KB`/`MB` number in the
 *    checked files must fall inside a registered claim, so a new figure cannot be
 *    written without being registered — and a claim whose sentence was reworded fails
 *    rather than silently matching nothing.
 *
 * A figure is compared at **the precision it is written to**: `399.4 KiB` must equal the
 * measurement rounded to one decimal, `~399 KiB` to none. That is the same rule
 * `check-examples.mjs` applies to documented decimals, and it is what lets an
 * approximate figure stay approximate while an exact one stays exact. There is no
 * tolerance beyond it: esbuild is pinned to an exact version, the catalogues are checked
 * in, and the measurement is deterministic. A figure that proves too twitchy should be
 * written to fewer decimals — a doc edit — rather than checked more loosely.
 *
 * A handful of claims describe the package as a whole rather than one import graph — the
 * `npm pack` totals and the source-map payload. Reproducing those means packing a tarball
 * or walking the whole tree, so the manifest registers them as `unmeasured`, each with
 * the command that produced it. They are covered by assertion 2 and excluded from
 * assertion 1, and the run says how many are in each set.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as esbuild from 'esbuild';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageRoot, '..');
const sourceRoot = join(packageRoot, 'src');
const distRoot = join(packageRoot, 'dist');

/** Any byte size a reader could take as a measurement. */
const SIZE_FIGURE = /\b\d+(?:\.\d+)?\s*(?:KiB|MiB|GiB|KB|MB|GB)\b/g;

/** The unit every measured claim is written in. */
const UNIT = 'KiB';

/**
 * Bundle one entry point and weigh it.
 *
 * @param spec - Manifest bundle spec: `entry` is a public subpath under `dist/`, and an
 * optional `export` measures the graph a single named import pulls rather than the
 * module's complete runtime API.
 * @returns Minified and gzipped sizes in KiB.
 */
async function measure(spec) {
    const entry = join(distRoot, `${spec.entry}.js`);
    const input =
        spec.export === undefined
            ? { entryPoints: [entry] }
            : {
                  stdin: {
                      // Assigning the import to a global is what stops esbuild treating a
                      // bundled-but-unused binding as dead: without it the whole graph
                      // tree-shakes away and the measurement is meaningless.
                      contents:
                          `import { ${spec.export} } from ${JSON.stringify(entry)};\n` +
                          `globalThis.__measured = ${spec.export};\n`,
                      resolveDir: distRoot,
                      sourcefile: `${spec.entry}.measure.js`,
                  },
              };
    const built = await esbuild.build({
        ...input,
        bundle: true,
        minify: true,
        format: 'esm',
        platform: 'neutral',
        write: false,
        logLevel: 'silent',
    });
    const bytes = Buffer.from(built.outputFiles[0].contents);
    return { minified: bytes.length / 1024, gzipped: gzipSync(bytes).length / 1024 };
}

/**
 * Turn a claim template into a regular expression that captures each of its numbers.
 *
 * @param claim - A manifest claim: `text` is literal doc text with one `{}` per figure.
 * @returns A global regular expression over the file's text, with one capture group per
 * `{}`.
 */
function templatePattern(claim) {
    const parts = claim.text.split('{}');
    // An `unmeasured` claim carries no `figures`, and exists only to account for the
    // figures it holds; a measured one must name a measurement for each `{}`.
    if (claim.figures !== undefined && parts.length - 1 !== claim.figures.length) {
        throw new Error(
            `claim template has ${parts.length - 1} "{}" for ${claim.figures.length} figures:` +
                ` ${claim.text}`,
        );
    }
    const quote = (part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(parts.map(quote).join('(\\d+(?:\\.\\d+)?)'), 'g');
}

/**
 * Every file whose size figures are checked: the public source, the repository and
 * package READMEs, the wiki Home page and the guides — the same set `check-examples.mjs`
 * harvests snippets from, for the same reason.
 *
 * @returns Absolute file paths.
 */
async function documentedFiles() {
    const sources = (await readdir(sourceRoot, { recursive: true, withFileTypes: true }))
        .filter((entry) => {
            const path = relative(sourceRoot, join(entry.parentPath, entry.name));
            return (
                entry.isFile() &&
                entry.name.endsWith('.ts') &&
                !entry.name.endsWith('.test.ts') &&
                !entry.name.endsWith('.d.ts') &&
                !path.split(/[\\/]/).includes('internal')
            );
        })
        .map((entry) => join(entry.parentPath, entry.name));

    const markdown = [join(repositoryRoot, 'README.md'), join(packageRoot, 'README.md')];
    for (const root of [join(packageRoot, 'docs'), join(packageRoot, 'docs', 'guides')]) {
        for (const entry of await readdir(root, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.md')) markdown.push(join(root, entry.name));
        }
    }
    return [...sources, ...markdown];
}

/**
 * Run the check.
 *
 * @returns The process exit code.
 */
async function main() {
    if (!existsSync(distRoot)) {
        console.error(
            'check-sizes: dist/ is missing — the documented figures describe the published\n' +
                'package, so run `pnpm run build` (or `pnpm run check:sizes`, which does) first.',
        );
        return 1;
    }
    const manifestPath = join(packageRoot, 'scripts', 'documented-sizes.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const claims = [...manifest.claims, ...manifest.unmeasured];

    const files = await documentedFiles();
    const text = new Map();
    for (const file of files) text.set(relative(packageRoot, file), await readFile(file, 'utf8'));

    const problems = [];
    // Character ranges a registered claim accounts for, so the sweep below can tell a
    // figure the manifest knows about from one nobody has registered.
    const covered = new Map(files.map((file) => [relative(packageRoot, file), []]));

    // Measure only what a claim asks for, so an orphaned bundle spec is an error rather
    // than a bundle nobody weighs.
    const wanted = new Set(
        manifest.claims.flatMap((claim) => claim.figures.map((figure) => figure.bundle)),
    );
    for (const name of Object.keys(manifest.bundles)) {
        if (!wanted.has(name)) problems.push(`documented-sizes.json: bundle ${name} has no claim`);
    }
    const sizes = new Map();
    for (const name of wanted) {
        const spec = manifest.bundles[name];
        if (spec === undefined) {
            problems.push(`documented-sizes.json: no bundle spec for ${name}`);
            continue;
        }
        sizes.set(name, await measure(spec));
    }

    let asserted = 0;
    for (const claim of claims) {
        const source = text.get(claim.file);
        if (source === undefined) {
            problems.push(`${claim.file}: claimed file is not in the checked set`);
            continue;
        }
        const found = [...source.matchAll(templatePattern(claim))];
        if (found.length !== 1) {
            problems.push(
                `${claim.file}: claim text matched ${found.length} times, expected exactly one` +
                    ` — ${JSON.stringify(claim.text)}`,
            );
            continue;
        }
        const [match] = found;
        covered.get(claim.file).push([match.index, match.index + match[0].length]);

        for (const [index, figure] of (claim.figures ?? []).entries()) {
            const documented = match[index + 1];
            const measured = sizes.get(figure.bundle)?.[figure.measure];
            if (measured === undefined) {
                problems.push(
                    `${claim.file}: no ${figure.measure} measurement for ${figure.bundle}`,
                );
                continue;
            }
            // Compare at the precision the figure is written to, so `~399 KiB` stays
            // approximate and `399.4 KiB` stays exact.
            const decimals = documented.includes('.') ? documented.split('.')[1].length : 0;
            const rounded = measured.toFixed(decimals);
            if (rounded !== Number(documented).toFixed(decimals)) {
                problems.push(
                    `${claim.file}: ${figure.bundle} ${figure.measure} is` +
                        ` ${measured.toFixed(2)} ${UNIT}, documented as ${documented} ${UNIT}` +
                        ` (expected ${rounded})`,
                );
                continue;
            }
            asserted += 1;
        }
    }

    let unregistered = 0;
    for (const [file, source] of text) {
        const ranges = covered.get(file);
        for (const figure of source.matchAll(SIZE_FIGURE)) {
            const start = figure.index;
            if (ranges.some(([from, to]) => start >= from && start + figure[0].length <= to)) {
                continue;
            }
            const line = source.slice(0, start).split('\n').length;
            problems.push(
                `${file}:${line}: ${figure[0]} is not registered in scripts/documented-sizes.json`,
            );
            unregistered += 1;
        }
    }

    const total = manifest.claims.reduce((sum, claim) => sum + claim.figures.length, 0);
    console.log(
        `\ncheck-sizes: ${asserted}/${total} documented figures match a fresh measurement of` +
            ` ${sizes.size} bundles`,
    );
    const unasserted = manifest.unmeasured.reduce(
        (sum, claim) => sum + claim.text.split('{}').length - 1,
        0,
    );
    console.log(
        `check-sizes: ${unasserted} figures are registered but not asserted — they describe` +
            ` the package as a whole rather than one import graph`,
    );
    if (unregistered === 0) {
        console.log('check-sizes: every size figure in the checked files is registered');
    }

    if (problems.length > 0) {
        console.error('');
        for (const problem of problems) console.error(`  error: ${problem}`);
        console.error(`\ncheck-sizes: ${problems.length} problem(s)`);
        return 1;
    }
    return 0;
}

process.exitCode = await main();
