#!/usr/bin/env node

/**
 * Check every documented TypeScript snippet: each `@example` in the public source and
 * each fenced block in the Markdown pages and READMEs consumers see.
 *
 * A doc example is a promise that the code works. This check catches invalid symbols,
 * private imports and missing imports before TypeDoc copies a snippet into the wiki.
 *
 * This extracts each ` ```ts ` fence into its own scratch file, resolves every
 * `@elite-dangerous-almanac/core/<subpath>` specifier through the package's own
 * `exports` map — so a snippet importing a private path fails rather than passing — and
 * compiles the set with the TypeScript compiler API. Each snippet is an isolated module,
 * so it must declare what it uses — that is the point, since a reader pastes it into an
 * empty file too. It then executes every machine-readable `expression; // -> value` claim that
 * needs no ambient `declare` input. Exact literals compare exactly, finite decimals are
 * rounded to their documented precision, and `0.667…` is a decimal-prefix assertion.
 * Prose and abbreviated values remain compile-only and are counted explicitly.
 *
 * Every documented snippet must compile. The executable and compile-only claim counts
 * are ratcheted below so examples cannot silently lose runtime coverage.
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { transformExampleClaims } from './example-claims.mjs';
import { runExampleEntries } from './example-runtime.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageRoot, '..');
const sourceRoot = join(packageRoot, 'src');
const MINIMUM_EXECUTABLE_CLAIMS = 308;
const MAXIMUM_COMPILE_ONLY_CLAIMS = 126;

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
    return (await readdir(directory, { recursive: true, withFileTypes: true }))
        .filter((entry) => {
            const path = relative(directory, join(entry.parentPath, entry.name));
            return (
                entry.isFile() &&
                entry.name.endsWith('.ts') &&
                !entry.name.endsWith('.test.ts') &&
                !entry.name.endsWith('.d.ts') &&
                !path.split(/[\\/]/).includes('internal')
            );
        })
        .map((entry) => join(entry.parentPath, entry.name));
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
    const dist = typeof entry === 'string' ? entry : entry.import;
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
 * Every Markdown page consumers see: the repository and package READMEs, the wiki Home
 * page and the guides.
 *
 * These become wiki pages exactly as the generated API pages do, so their snippets are
 * the same promise to a reader and get the same check. Their fences are plain Markdown,
 * with no `@example` tag and no ` * ` prefix.
 *
 * @returns Absolute file paths, or an empty list when the directory is absent.
 */
async function documentFiles() {
    const roots = [join(packageRoot, 'docs'), join(packageRoot, 'docs', 'guides')];
    const found = [join(repositoryRoot, 'README.md'), join(packageRoot, 'README.md')];
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
    await mkdir(join(scratch, 'runtime'), { recursive: true });

    for (const file of [...files, ...documents]) {
        const source = await readFile(file, 'utf8');
        const relativePath = relative(packageRoot, file);
        const scratchPath = relative(repositoryRoot, file);
        const found = file.endsWith('.md') ? markdownSnippets(source) : exampleSnippets(source);
        for (const [index, snippet] of found.entries()) {
            const name = `${scratchPath.replaceAll('/', '__').replace(/\.(ts|md)$/, '')}__${index}.ts`;
            const target = join(scratch, 'snippets', name);
            const { code, problems } = localiseImports(snippet.code);
            const runtime = transformExampleClaims(code);
            await writeFile(target, `export {};\n${code}\n`);
            cases.push({
                file: relativePath,
                line: snippet.line,
                target,
                name,
                problems,
                runtimeCode: runtime.code,
                claims: runtime.claims.map((claim) => ({
                    ...claim,
                    file: relativePath,
                    line: snippet.line + claim.line,
                })),
                skipped: runtime.skipped.map((claim) => ({
                    ...claim,
                    file: relativePath,
                    line: snippet.line + claim.line,
                })),
            });
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
    const parsedConfig = ts.parseJsonConfigFileContent(tsconfig, ts.sys, scratch);
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    const diagnostics = [...parsedConfig.errors, ...ts.getPreEmitDiagnostics(program)];
    const failures = new Map();
    const foreign = [];
    for (const diagnostic of diagnostics) {
        const code = `TS${diagnostic.code}`;
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        if (diagnostic.file === undefined || diagnostic.start === undefined) {
            foreign.push(`error ${code}: ${message}`);
            continue;
        }
        const path = relative(scratch, diagnostic.file.fileName).replaceAll('\\', '/');
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        if (!path.startsWith('snippets/')) {
            foreign.push(`${path}(${line + 1},${character + 1}): error ${code}: ${message}`);
            continue;
        }
        const name = path.slice('snippets/'.length);
        if (!failures.has(name)) failures.set(name, []);
        failures.get(name).push({ row: line + 1, code, message });
    }
    for (const entry of cases) {
        if (entry.problems.length === 0) continue;
        failures.set(entry.name, [...(failures.get(entry.name) ?? []), ...entry.problems]);
    }

    // A diagnostic outside `snippets/` means the harness itself is wrong. Reporting a
    // pass count from a broken compile would be worse than reporting nothing, so fail
    // loudly instead.
    if (foreign.length > 0) {
        console.error('check-examples: TypeScript reported errors outside the snippet set:\n');
        console.error(foreign.slice(0, 10).join('\n'));
        return 1;
    }

    const compileFailed = cases.filter((entry) => failures.has(entry.name));
    const compiled = cases.length - compileFailed.length;
    console.log(
        `\ncheck-examples: ${compiled}/${cases.length} snippets compile` +
            (compileFailed.length > 0 ? ` — ${compileFailed.length} failing` : ''),
    );

    const executable = cases.filter(
        (entry) => !failures.has(entry.name) && entry.claims.length > 0,
    );
    const runtimeEntries = [];
    for (const entry of executable) {
        const target = join(scratch, 'runtime', entry.name.replace(/\.ts$/, '.mjs'));
        const emitted = ts.transpileModule(`export {};\n${entry.runtimeCode}\n`, {
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
            fileName: entry.name,
        }).outputText;
        await writeFile(target, emitted);
        runtimeEntries.push({
            name: entry.name,
            file: entry.file,
            line: entry.line,
            target,
            claims: entry.claims,
        });
    }

    let runtimeResult = { failures: [], checked: 0, matched: 0 };
    if (runtimeEntries.length > 0) {
        runtimeResult = runExampleEntries(runtimeEntries, {
            cwd: packageRoot,
            imports: ['tsx', join(packageRoot, 'scripts', 'register-jsonc.mjs')],
        });
        for (const problem of runtimeResult.failures) {
            failures.set(problem.name, [
                ...(failures.get(problem.name) ?? []),
                {
                    code: problem.code,
                    message: `${problem.file}:${problem.line}: ${problem.message}`,
                },
            ]);
        }
    }

    const executableClaims = runtimeEntries.flatMap((entry) => entry.claims);
    const matchedClaims = runtimeResult.matched;
    console.log(
        `check-examples: ${matchedClaims}/${executableClaims.length} executable value claims match`,
    );

    const skippedClaims = cases.flatMap((entry) => entry.skipped);
    const skippedByReason = new Map();
    for (const claim of skippedClaims) {
        skippedByReason.set(claim.reason, (skippedByReason.get(claim.reason) ?? 0) + 1);
    }
    const skipSummary = [...skippedByReason]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([reason, count]) => `${count} ${reason}`)
        .join('; ');
    console.log(
        `check-examples: ${skippedClaims.length} value claims remain compile-only` +
            (skipSummary === '' ? '' : ` — ${skipSummary}`),
    );
    let claimRatchetFailed = false;
    if (executableClaims.length < MINIMUM_EXECUTABLE_CLAIMS) {
        console.error(
            `check-examples: ${executableClaims.length} executable claims is below the required ` +
                `minimum of ${MINIMUM_EXECUTABLE_CLAIMS}`,
        );
        claimRatchetFailed = true;
    }
    if (skippedClaims.length > MAXIMUM_COMPILE_ONLY_CLAIMS) {
        console.error(
            `check-examples: ${skippedClaims.length} compile-only claims is above the allowed ` +
                `maximum of ${MAXIMUM_COMPILE_ONLY_CLAIMS}`,
        );
        claimRatchetFailed = true;
    }

    const failed = cases.filter((entry) => failures.has(entry.name));
    for (const entry of failed) {
        console.log(`\n${entry.file}:${entry.line}`);
        for (const problem of failures.get(entry.name)) {
            console.log(`  error ${problem.code}: ${problem.message}`);
        }
    }

    const passed = cases.length - failed.length;
    console.log(`\ncheck-examples: ${passed}/${cases.length} snippets pass all applicable checks`);

    return failed.length > 0 || claimRatchetFailed ? 1 : 0;
}

try {
    process.exitCode = await main();
} finally {
    await rm(scratch, { recursive: true, force: true });
}
