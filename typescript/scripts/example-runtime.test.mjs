import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runExampleEntries } from './example-runtime.mjs';

const runner = fileURLToPath(new URL('./run-example-claims.mjs', import.meta.url));

test('each snippet gets a fresh realm, so an intrinsic poison cannot validate a later claim', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-isolation-'));
    try {
        const poison = join(scratch, 'poison.mjs');
        const later = join(scratch, 'later.mjs');
        await writeFile(
            poison,
            [
                `Array.prototype.__almanacPoison = true;`,
                `globalThis.__almanacExampleClaim(() => true, 'poison:0');`,
            ].join('\n'),
        );
        await writeFile(
            later,
            `globalThis.__almanacExampleClaim(() => Array.prototype.__almanacPoison === true, 'later:0');\n`,
        );

        const entries = [
            entry('poison', poison, 'poison:0', true),
            // This expectation is deliberately wrong in a clean realm. It would pass if
            // the first snippet's Array.prototype mutation leaked into this one.
            entry('later', later, 'later:0', true),
        ];
        const manifestPath = join(scratch, 'manifest.json');
        await writeFile(manifestPath, JSON.stringify(entries));

        const result = runExampleEntries(entries, {
            manifestPath,
            runner,
            cwd: scratch,
            timeoutMs: 2_000,
        });

        assert.equal(result.checked, 2);
        assert.deepEqual(
            result.failures.map(({ name, claimId, code }) => ({ name, claimId, code })),
            [{ name: 'later', claimId: 'later:0', code: 'EXV001' }],
        );
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

test('a timed-out snippet fails locally and does not stop the next process', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-timeout-'));
    try {
        const hanging = join(scratch, 'hanging.mjs');
        const later = join(scratch, 'later.mjs');
        await writeFile(hanging, 'while (true) {}\n');
        await writeFile(later, `globalThis.__almanacExampleClaim(() => 2 + 2, 'later:0');\n`);

        const entries = [
            entry('hanging', hanging, 'hanging:0', true),
            entry('later', later, 'later:0', 4, 'number-exact'),
        ];
        const manifestPath = join(scratch, 'manifest.json');
        await writeFile(manifestPath, JSON.stringify(entries));

        const result = runExampleEntries(entries, {
            manifestPath,
            runner,
            cwd: scratch,
            timeoutMs: 1_000,
        });

        assert.equal(result.checked, 1);
        assert.ok(
            result.failures.some(({ name, code }) => name === 'hanging' && code === 'EXV006'),
        );
        assert.ok(
            result.failures.some(
                ({ name, claimId, code }) =>
                    name === 'hanging' && claimId === 'hanging:0' && code === 'EXV005',
            ),
        );
        assert.ok(!result.failures.some(({ name }) => name === 'later'));
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

function entry(name, target, claimId, value, kind = 'boolean') {
    return {
        name,
        file: `${name}.ts`,
        line: 1,
        target,
        claims: [
            {
                id: claimId,
                file: `${name}.ts`,
                line: 1,
                expected: String(value),
                spec: { kind, value },
            },
        ],
    };
}
