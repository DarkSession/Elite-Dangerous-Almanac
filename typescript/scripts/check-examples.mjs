#!/usr/bin/env node

/**
 * Type-check every `@example` snippet in the public source.
 *
 * A doc example is a promise that the code in it works. TypeDoc copies it into the wiki
 * verbatim and no other check ever reads it, so a snippet that names a symbol the API
 * dropped, or omits the import a reader needs, stays wrong indefinitely and is only
 * discovered by the consumer who pastes it.
 *
 * This extracts each ` ```ts ` fence from an `@example` block into its own scratch file,
 * rewrites `@elite-dangerous-almanac/core/<subpath>` to the matching source module, and
 * runs one `tsc --noEmit` over the set. Each snippet compiles as an isolated module, so
 * it must declare what it uses — that is the point, since a reader pastes it into an
 * empty file too. Use `declare const x: T` for an input the snippet receives rather than
 * builds, and a `// ->` comment for the value an expression evaluates to.
 *
 * Report-only by default: it prints the failures and exits 0, so it can run while the
 * back catalogue is still being rewritten. Pass `--strict` (as `npm run check` does once
 * the catalogue is clean) to exit non-zero on any failure.
 *
 * Usage:
 *   node scripts/check-examples.mjs           # report, always exit 0
 *   node scripts/check-examples.mjs --strict  # exit 1 if any snippet fails
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
    return code.replaceAll(
        new RegExp(`(['"])${PACKAGE}(/[^'"]+)?\\1`, 'g'),
        (_match, quote, subpath) => {
            // A subpath naming a directory (the root barrel, or a feature area such as
            // `/ships`) resolves to that directory's `index`; anything else is a leaf.
            const path = subpath ?? '';
            const target = existsSync(join(sourceRoot, path, 'index.ts'))
                ? join(sourceRoot, path, 'index.js')
                : join(sourceRoot, `${path}.js`);
            return `${quote}${target}${quote}`;
        },
    );
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
            await writeFile(target, `export {};\n${localiseImports(snippet.code)}\n`);
            cases.push({ file: relativePath, line: snippet.line, target, name });
        }
    }

    if (cases.length === 0) {
        console.log('check-examples: no @example snippets found');
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

    const failures = new Map([...pass.diagnostics, ...broken]);

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

    return failed.length > 0 && strict ? 1 : 0;
}

try {
    process.exitCode = await main();
} finally {
    await rm(scratch, { recursive: true, force: true });
}
