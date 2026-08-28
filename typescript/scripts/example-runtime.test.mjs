import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { transformExampleClaims } from './example-claims.mjs';
import { runExampleEntries } from './example-runtime.mjs';

test('counts only claims that execute and preserves a claimed initializer value', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-runtime-'));
    try {
        const pass = join(scratch, 'pass.mjs');
        const skipped = join(scratch, 'skipped.mjs');
        const fail = join(scratch, 'fail.mjs');
        const passing = transformExampleClaims(
            [
                'const answer = 42; // -> 42',
                "if (answer !== 42) throw new Error('bound value was lost');",
            ].join('\n'),
        );
        const notReached = transformExampleClaims(
            ['if (false) {', '    1; // -> 1', '}'].join('\n'),
        );
        await writeFile(pass, passing.code);
        await writeFile(skipped, notReached.code);
        await writeFile(fail, 'throw new Error("nope");\n');
        const result = runExampleEntries(
            [
                {
                    name: 'pass',
                    file: 'docs.md',
                    line: 1,
                    target: pass,
                    claims: passing.claims,
                },
                {
                    name: 'skipped',
                    file: 'docs.md',
                    line: 2,
                    target: skipped,
                    claims: notReached.claims,
                },
                { name: 'fail', file: 'docs.md', line: 3, target: fail, claims: [] },
            ],
            { cwd: scratch },
        );
        assert.equal(result.checked, 1);
        assert.equal(result.matched, 1);
        assert.equal(result.failures.length, 2);
        assert.deepEqual(
            result.failures.map(({ name, line }) => ({ name, line })),
            [
                { name: 'skipped', line: 2 },
                { name: 'fail', line: 3 },
            ],
        );
        assert.equal(result.failures[0].message, 'documented expression did not execute');
        assert.match(result.failures[1].message, /nope/);
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

test('distinguishes a reached mismatch from a later claim that never runs', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-mismatch-'));
    try {
        const target = join(scratch, 'mismatch.mjs');
        const mismatch = transformExampleClaims(['1 + 1; // -> 99', '3 + 3; // -> 6'].join('\n'));
        await writeFile(target, mismatch.code);

        const result = runExampleEntries(
            [{ name: 'mismatch', file: 'docs.md', line: 1, target, claims: mismatch.claims }],
            { cwd: scratch },
        );

        assert.equal(result.checked, 1);
        assert.equal(result.matched, 0);
        assert.equal(result.failures.filter(({ code }) => code === 'EXV005').length, 1);
        assert.equal(result.failures.find(({ code }) => code === 'EXV005')?.line, 2);
        assert.match(
            result.failures.find(({ code }) => code === 'EXV001')?.message ?? '',
            /expected 99/,
        );
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

test('frames claim markers after stdout without a trailing newline', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-marker-'));
    try {
        const target = join(scratch, 'partial-output.mjs');
        const partialOutput = transformExampleClaims(
            ["process.stdout.write('prefix');", '1 + 1; // -> 2'].join('\n'),
        );
        await writeFile(target, partialOutput.code);

        const result = runExampleEntries(
            [
                {
                    name: 'partial-output',
                    file: 'docs.md',
                    line: 1,
                    target,
                    claims: partialOutput.claims,
                },
            ],
            { cwd: scratch },
        );

        assert.equal(result.checked, 1);
        assert.equal(result.matched, 1);
        assert.deepEqual(result.failures, []);
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

test('keeps claim markers after more than Node’s default output buffer', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-buffer-'));
    try {
        const target = join(scratch, 'chatty.mjs');
        const chatty = transformExampleClaims(
            ["console.log('x'.repeat(2 * 1024 * 1024));", '1 + 1; // -> 2'].join('\n'),
        );
        await writeFile(target, chatty.code);

        const result = runExampleEntries(
            [{ name: 'chatty', file: 'docs.md', line: 1, target, claims: chatty.claims }],
            { cwd: scratch },
        );

        assert.equal(result.checked, 1);
        assert.equal(result.matched, 1);
        assert.deepEqual(result.failures, []);
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

test('times out a stuck snippet', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-timeout-'));
    try {
        const target = join(scratch, 'stuck.mjs');
        await writeFile(target, 'await new Promise(() => {});\n');
        const result = runExampleEntries(
            [{ name: 'stuck', file: 'docs.md', line: 1, target, claims: [] }],
            { cwd: scratch, timeoutMs: 25 },
        );
        assert.equal(result.checked, 0);
        assert.equal(result.matched, 0);
        assert.match(result.failures[0].message, /timeout/);
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});
