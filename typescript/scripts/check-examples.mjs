#!/usr/bin/env node

/**
 * Type-check every documented code snippet: each `@example` in the public source, and
 * each fenced block in the Markdown pages published to the wiki.
 *
 * A doc example is a promise that the code in it works. TypeDoc copies it into the wiki
 * verbatim and no other check ever reads it, so a snippet that names a symbol the API
 * dropped, or omits the import a reader needs, stays wrong indefinitely and is only
 * discovered by the consumer who pastes it.
 *
 * This extracts each ` ```ts ` fence into its own scratch file, resolves every
 * `@elite-dangerous-almanac/core/<subpath>` specifier through the package's own
 * `exports` map — so a snippet importing a private path fails rather than passing — and
 * runs `tsc --noEmit` over the set. Each snippet compiles as an isolated module, so
 * it must declare what it uses — that is the point, since a reader pastes it into an
 * empty file too. Use `declare const x: T` for an input the snippet receives rather than
 * builds, and a `// ->` comment for the value an expression evaluates to.
 *
 * Every documented snippet compiles today, so `npm run check` runs this with `--strict`
 * and a snippet that stops compiling fails the build. `--max-failures <n>` remains as a
 * ratchet for the case where a batch of new documentation lands mid-rewrite: it fails
 * only when the count rises above the agreed number.
 *
 * Usage:
 *   node scripts/check-examples.mjs                    # report, always exit 0
 *   node scripts/check-examples.mjs --max-failures 189 # exit 1 if it gets worse
 *   node scripts/check-examples.mjs --strict           # exit 1 on any failure
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = join(packageRoot, 'src');
const strict = process.argv.includes('--strict');
const maxFailuresFlag = process.argv.indexOf('--max-failures');
const maxFailures = maxFailuresFlag === -1 ? null : Number(process.argv[maxFailuresFlag + 1]);

/** The package's published entry points, as a consumer's resolver sees them. */
const exportsMap = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')).exports;

/** The package's public subpath prefix, as a consumer writes it. */
const PACKAGE = '@elite-dangerous-almanac/core';

/**
 * Every non-test TypeScript file under `src/`, excluding `internal/`.
 *
 * @param directory - Absolute directory to walk.
 * @returns Absolute file paths.
 */
async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'internal') continue;
            files.push(...(await sourceFiles(path)));
        } else if (
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.d.ts')
        ) {
            files.push(path);
        }
    }
    return files;
}

/**
 * Extract the fenced TypeScript snippets that follow an `@example` tag.
 *
 * @param source - TypeScript source text.
 * @returns One entry per snippet, with the 1-based line the fence opens on.
 */
function exampleSnippets(source) {
    const snippets = [];
    const lines = source.split('\n');
    let inExample = false;
    let fence = null;

    for (const [index, raw] of lines.entries()) {
        // Inside a block comment the snippet is prefixed with ` * `; strip it.
        const line = raw.replace(/^\s*\* ?/, '');
        const tag = line.trimStart();

        if (fence === null) {
            // The end of the comment block closes the example section too. Without this
            // an `@example` leaks into the next symbol, and a fence in that symbol's
            // description is harvested as if it were an example.
            if (raw.includes('*/')) {
                inExample = false;
                continue;
            }
            if (tag.startsWith('@example')) {
                inExample = true;
                continue;
            }
            // Any other block tag closes the example section.
            if (inExample && /^@[a-zA-Z]/.test(tag)) inExample = false;
            if (inExample && /^```(ts|typescript)\s*$/.test(tag)) {
                fence = { line: index + 1, body: [] };
            }
            continue;
        }

        if (tag.startsWith('```')) {
            snippets.push({ line: fence.line, code: fence.body.join('\n') });
            fence = null;
            continue;
        }
        fence.body.push(line);
    }
    return snippets;
}

/**
 * Rewrite public package specifiers to paths the scratch file can resolve.
 *
 * The scratch directory lives in the OS temp dir rather than under the package, so the
 * rewrite has to be absolute — a relative hop out of the scratch root lands nowhere.
 *
 * @param code - Snippet source.
 * @returns The snippet with every `@elite-dangerous-almanac/core…` specifier localised.
 */
function localiseImports(code) {
    const problems = [];
    const localised = code.replaceAll(
        new RegExp(`(['"])${PACKAGE}(/[^'"]+)?\\1`, 'g'),
        (match, quote, subpath) => {
            const specifier = `.${subpath ?? ''}`;
            const resolved = resolveExport(specifier);
            if (resolved === null) {
                // Resolving against `src/` rather than the `exports` map would let a
                // snippet import a path no consumer can reach — the private
                // `./internal/*` subpaths especially — and call it verified.
                problems.push({
                    code: 'TSX001',
                    message: `${match.slice(1, -1)} is not a published entry point (see package.json "exports")`,
                });
                return match;
            }
            return `${quote}${resolved}${quote}`;
        },
    );
    return { code: localised, problems };
}

/**
 * Resolve a public subpath through the package's own `exports` map.
 *
 * @param specifier - The subpath as `exports` spells it, e.g. `.` or `./ships/slef`.
 * @returns The absolute source path, or `null` when `exports` does not publish it.
 */
function resolveExport(specifier) {
    let best = null;
    for (const [pattern, target] of Object.entries(exportsMap)) {
        const star = pattern.indexOf('*');
        if (star === -1) {
            if (pattern === specifier) best = { pattern, target, fill: null, weight: Infinity };
            continue;
        }
        const head = pattern.slice(0, star);
        const tail = pattern.slice(star + 1);
        if (!specifier.startsWith(head) || !specifier.endsWith(tail)) continue;
        if (specifier.length < head.length + tail.length) continue;
        const fill = specifier.slice(head.length, specifier.length - tail.length || undefined);
        // Node picks the longest matching prefix, which is how `./ships/internal/*`
        // (explicitly `null`) wins over `./ships/*` for a private path.
        if (best === null || head.length > best.weight) {
            best = { pattern, target, fill, weight: head.length };
        }
    }
    if (best === null) return null;

    const entry = best.target;
    if (entry === null) return null;
    // A type-only entry point publishes `types` with no `import`; a consumer reaches it
    // with `import type`, so it is resolvable here even though it ships no runtime code.
    const dist = typeof entry === 'string' ? entry : (entry.import ?? entry.types);
    if (typeof dist !== 'string') return null;

    // Node expands **every** `*` in the target, not just the first — verified against
    // `import.meta.resolve` with a target of `./d/*/*.js`, which resolves to `./d/a/a.js`.
    // The replacement is a callback so a `$` in the subpath cannot be read as `$&` & co.
    const filled = best.fill === null ? dist : dist.replaceAll('*', () => best.fill);
    // `./dist/ships/index.js` → `<src>/ships/index.ts`
    const relativeToSrc = filled.replace(/^\.\/dist\//, '').replace(/\.d\.ts$|\.js$/, '');
    const asFile = join(sourceRoot, `${relativeToSrc}.ts`);
    if (existsSync(asFile)) return join(sourceRoot, `${relativeToSrc}.js`);
    const asIndex = join(sourceRoot, relativeToSrc, 'index.ts');
    if (existsSync(asIndex)) return join(sourceRoot, relativeToSrc, 'index.js');
    return null;
}

/**
 * Every Markdown page published to the wiki: the `Home` readme and the guides.
 *
 * These become wiki pages exactly as the generated API pages do, so their snippets are
 * the same promise to a reader and get the same check. Their fences are plain Markdown,
 * with no `@example` tag and no ` * ` prefix.
 *
 * @returns Absolute file paths, or an empty list when the directory is absent.
 */
async function documentFiles() {
    const roots = [join(packageRoot, 'docs'), join(packageRoot, 'docs', 'guides')];
    const found = [];
    for (const root of roots) {
        if (!existsSync(root)) continue;
        for (const entry of await readdir(root, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.md')) found.push(join(root, entry.name));
        }
    }
    return found;
}

/**
 * Extract the fenced TypeScript snippets from a Markdown page.
 *
 * @param source - Markdown text.
 * @returns One entry per snippet, with the 1-based line the fence opens on.
 */
function markdownSnippets(source) {
    const snippets = [];
    let fence = null;
    for (const [index, line] of source.split('\n').entries()) {
        if (fence === null) {
            if (/^```(ts|typescript)\s*$/.test(line.trim())) fence = { line: index + 1, body: [] };
            continue;
        }
        if (line.trim().startsWith('```')) {
            snippets.push({ line: fence.line, code: fence.body.join('\n') });
            fence = null;
            continue;
        }
        fence.body.push(line);
    }
    return snippets;
}

const scratch = await mkdtemp(join(tmpdir(), 'almanac-examples-'));
const cases = [];

/**
 * Run the check.
 *
 * @returns The process exit code.
 */
async function main() {
    const files = await sourceFiles(sourceRoot);
    const documents = await documentFiles();

    await mkdir(join(scratch, 'snippets'), { recursive: true });

    for (const file of [...files, ...documents]) {
        const source = await readFile(file, 'utf8');
        const relativePath = relative(packageRoot, file);
        const found = file.endsWith('.md') ? markdownSnippets(source) : exampleSnippets(source);
        for (const [index, snippet] of found.entries()) {
            const name = `${relativePath.replaceAll('/', '__').replace(/\.(ts|md)$/, '')}__${index}.ts`;
            const target = join(scratch, 'snippets', name);
            const { code, problems } = localiseImports(snippet.code);
            await writeFile(target, `export {};\n${code}\n`);
            cases.push({ file: relativePath, line: snippet.line, target, name, problems });
        }
    }

    if (cases.length === 0) {
        console.log('check-examples: no documented snippets found');
        return 0;
    }

    // `verbatimModuleSyntax` reads the nearest package.json to decide whether a file may
    // use ESM syntax; without this every snippet fails as a CommonJS file.
    await writeFile(join(scratch, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));

    // Compile against the package's own settings, but never emit and never let a
    // snippet's unused import fail it — a reader pastes imports they will go on to use.
    const tsconfig = {
        extends: resolve(packageRoot, 'tsconfig.json'),
        compilerOptions: {
            noEmit: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            typeRoots: [resolve(packageRoot, 'node_modules', '@types')],
        },
        // `src/jsonc.d.ts` types the catalogue `.jsonc` imports. Without it every
        // catalogue module in the library fails to resolve, and those diagnostics land
        // outside `snippets/` where the parser below would drop them.
        include: ['snippets/**/*.ts', resolve(sourceRoot, '**/*.d.ts')],
    };
    await writeFile(join(scratch, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    const tscBin = join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');

    /**
     * Compile the snippet set, skipping the named files.
     *
     * Run from the scratch root so tsc reports `snippets/<name>.ts` rather than a path
     * relative to this process's cwd, which the parser below would silently miss.
     *
     * @param skip - Snippet file names to exclude from this pass.
     * @returns The exit status, the diagnostics keyed by snippet, and any diagnostic
     *   that did not belong to a snippet at all.
     */
    function compile(skip) {
        const args = [tscBin, '--project', '.', '--pretty', 'false'];
        const result = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: scratch });
        const output = `${result.stdout}${result.stderr}`;

        const diagnostics = new Map();
        const foreign = [];
        for (const raw of output.split('\n')) {
            const line = raw.trim();
            if (!/error TS\d+:/.test(line)) continue;
            const match = /^snippets[/\\]([^(]+)\((\d+),\d+\): error (TS\d+): (.+)$/.exec(line);
            if (!match) {
                foreign.push(line);
                continue;
            }
            const [, name, row, code, message] = match;
            if (skip.has(name)) continue;
            if (!diagnostics.has(name)) diagnostics.set(name, []);
            diagnostics.get(name).push({ row: Number(row), code, message });
        }
        return { status: result.status, output, diagnostics, foreign };
    }

    // tsc abandons semantic checking for the whole program as soon as any file has a
    // syntactic error, so a single unparseable snippet silently hides every type error
    // in the run. Drop the unparseable ones and compile again until none remain; only
    // then are the semantic results trustworthy.
    const broken = new Map();
    const skip = new Set();
    let pass = compile(skip);
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const syntactic = [...pass.diagnostics].filter(([, problems]) =>
            problems.some((problem) => /^TS1\d{3}$/.test(problem.code)),
        );
        if (syntactic.length === 0) break;
        for (const [name, problems] of syntactic) {
            broken.set(name, problems);
            skip.add(name);
            await rm(join(scratch, 'snippets', name), { force: true });
        }
        pass = compile(skip);
    }

    // Convergence is judged from `pass.diagnostics`, which has already had `skip`
    // filtered out of it. If a snippet failed to delete, or the attempt cap were ever
    // exhausted, tsc would still be abandoning semantic checking while the filtered
    // view looked clean — and every pass count below would be unjustified. Ask the raw
    // output instead.
    if (/error TS1\d{3}:/.test(pass.output)) {
        console.error(
            'check-examples: tsc still reports a syntactic error after pruning, so semantic\n' +
                'results for this run are not trustworthy. Raw output:\n',
        );
        console.error(pass.output.trim());
        return 1;
    }

    const failures = new Map([...pass.diagnostics, ...broken]);
    for (const entry of cases) {
        if (entry.problems.length === 0) continue;
        failures.set(entry.name, [...(failures.get(entry.name) ?? []), ...entry.problems]);
    }

    // A diagnostic outside `snippets/`, or a non-zero exit with nothing parsable, means
    // the harness itself is wrong. Reporting a pass count from a broken compile would be
    // worse than reporting nothing, so fail loudly instead.
    if (pass.foreign.length > 0) {
        console.error('check-examples: tsc reported errors outside the snippet set:\n');
        console.error(pass.foreign.slice(0, 10).join('\n'));
        return 1;
    }
    if (pass.status !== 0 && failures.size === 0) {
        console.error('check-examples: tsc failed without a parsable diagnostic:\n');
        console.error(pass.output.trim() || `(no output, exit ${pass.status})`);
        return 1;
    }

    const failed = cases.filter((entry) => failures.has(entry.name));
    for (const entry of failed) {
        console.log(`\n${entry.file}:${entry.line}`);
        for (const problem of failures.get(entry.name)) {
            console.log(`  error ${problem.code}: ${problem.message}`);
        }
    }

    const passed = cases.length - failed.length;
    console.log(
        `\ncheck-examples: ${passed}/${cases.length} snippets compile` +
            (failed.length > 0 ? ` — ${failed.length} failing` : ''),
    );

    if (strict) return failed.length > 0 ? 1 : 0;

    if (maxFailures !== null) {
        if (!Number.isInteger(maxFailures) || maxFailures < 0) {
            console.error('check-examples: --max-failures needs a non-negative integer');
            return 1;
        }
        if (failed.length > maxFailures) {
            console.error(
                `\ncheck-examples: ${failed.length} failing snippets, above the agreed ` +
                    `ceiling of ${maxFailures}. Fix the new one, or lower the ceiling if you ` +
                    `have fixed others.`,
            );
            return 1;
        }
        if (failed.length < maxFailures) {
            console.log(
                `check-examples: ${failed.length} failing, below the ceiling of ` +
                    `${maxFailures} — lower it in package.json to lock the gain in.`,
            );
        }
    }
    return 0;
}

try {
    process.exitCode = await main();
} finally {
    await rm(scratch, { recursive: true, force: true });
}
