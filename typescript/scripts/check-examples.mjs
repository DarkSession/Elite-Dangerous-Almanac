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
        (_match, quote, subpath) =>
            `${quote}${join(sourceRoot, `${subpath ?? '/index'}.js`)}${quote}`,
    );
}

const files = await sourceFiles(sourceRoot);
const scratch = await mkdtemp(join(tmpdir(), 'almanac-examples-'));
const cases = [];

try {
    await mkdir(join(scratch, 'snippets'), { recursive: true });

    for (const file of files) {
        const source = await readFile(file, 'utf8');
        const relativePath = relative(packageRoot, file);
        for (const [index, snippet] of exampleSnippets(source).entries()) {
            const name = `${relativePath.replaceAll('/', '__').replace(/\.ts$/, '')}__${index}.ts`;
            const target = join(scratch, 'snippets', name);
            await writeFile(target, `export {};\n${localiseImports(snippet.code)}\n`);
            cases.push({ file: relativePath, line: snippet.line, target, name });
        }
    }

    if (cases.length === 0) {
        console.log('check-examples: no @example snippets found');
        process.exit(0);
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
        include: ['snippets/**/*.ts'],
    };
    await writeFile(join(scratch, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    // Run from the scratch root so tsc reports `snippets/<name>.ts` rather than a path
    // relative to this process's cwd, which the parser below would silently miss.
    const result = spawnSync(
        process.execPath,
        [
            join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
            '--project',
            '.',
            '--pretty',
            'false',
        ],
        { encoding: 'utf8', cwd: scratch },
    );

    const output = `${result.stdout}${result.stderr}`;
    const failures = new Map();
    for (const line of output.split('\n')) {
        const match = /^snippets[/\\]([^(]+)\((\d+),\d+\): (error .+)$/.exec(line.trim());
        if (!match) continue;
        const [, name, row, message] = match;
        if (!failures.has(name)) failures.set(name, []);
        failures.get(name).push({ row: Number(row), message });
    }

    // A config or crash failure produces a non-zero exit with no parsable diagnostic.
    // Reporting "all snippets compile" in that case would be worse than reporting
    // nothing, so fail loudly instead.
    if (result.status !== 0 && failures.size === 0) {
        console.error('check-examples: tsc failed without a parsable diagnostic:\n');
        console.error(output.trim() || `(no output, exit ${result.status})`);
        process.exit(1);
    }

    const failed = cases.filter((entry) => failures.has(entry.name));
    for (const entry of failed) {
        console.log(`\n${entry.file}:${entry.line}`);
        for (const problem of failures.get(entry.name)) {
            console.log(`  ${problem.message}`);
        }
    }

    const passed = cases.length - failed.length;
    console.log(
        `\ncheck-examples: ${passed}/${cases.length} snippets compile` +
            (failed.length > 0 ? ` — ${failed.length} failing` : ''),
    );

    if (failed.length > 0 && strict) process.exit(1);
} finally {
    await rm(scratch, { recursive: true, force: true });
}
