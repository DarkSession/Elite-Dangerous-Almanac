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

test('same-snippet intrinsic poisoning cannot redefine exact or recursive matches', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-pristine-'));
    try {
        const target = join(scratch, 'poisoned-assertions.mjs');
        await writeFile(
            target,
            [
                `globalThis.__almanacExampleClaim(() => (Object.is = () => true, 1), 'same:exact');`,
                `globalThis.__almanacExampleClaim(() => {`,
                `    Reflect.apply = () => '1.2';`,
                `    Number.isFinite = () => true;`,
                `    Number.prototype.toFixed = () => '1.2';`,
                `    return Infinity;`,
                `}, 'same:rounded');`,
                `globalThis.__almanacExampleClaim(() => (String.prototype.startsWith = () => true, 9.9), 'same:prefix');`,
                `globalThis.__almanacExampleClaim(() => (Array.isArray = () => true, { 0: 1, length: 1 }), 'same:array');`,
                `globalThis.__almanacExampleClaim(() => {`,
                `    Object.keys = () => ['x'];`,
                `    Array.prototype.entries = function* () {};`,
                `    Array.prototype.map = () => [];`,
                `    Array.prototype.push = () => 0;`,
                `    Array.prototype.some = () => false;`,
                `    Array.prototype.sort = () => [];`,
                `    JSON.stringify = () => '"poison"';`,
                `    return { x: 1, y: 2 };`,
                `}, 'same:object');`,
            ].join('\n'),
        );

        const claims = [
            claim('same:exact', '2', { kind: 'number-exact', value: 2 }),
            claim('same:rounded', '1.2', {
                kind: 'number-rounded',
                value: 1.2,
                text: '1.2',
                decimalPlaces: 1,
            }),
            claim('same:prefix', '1.…', { kind: 'number-prefix', prefix: '1.' }),
            claim('same:array', '[1]', {
                kind: 'array',
                items: [{ kind: 'number-exact', value: 1 }],
            }),
            claim('same:object', '{ x: 1 }', {
                kind: 'object',
                entries: [['x', { kind: 'number-exact', value: 1 }]],
            }),
        ];
        const entries = [entryWithClaims('same', target, claims)];
        const manifestPath = join(scratch, 'manifest.json');
        await writeFile(manifestPath, JSON.stringify(entries));

        const result = runExampleEntries(entries, {
            manifestPath,
            runner,
            cwd: scratch,
            timeoutMs: 2_000,
        });

        assert.equal(result.checked, claims.length);
        assert.deepEqual(
            result.failures.map(({ claimId, code }) => ({ claimId, code })),
            claims.map(({ id }) => ({ claimId: id, code: 'EXV001' })),
        );
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

test('SIGKILL promptly stops a SIGTERM-resistant snippet and the next process runs', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'almanac-example-timeout-'));
    try {
        const hanging = join(scratch, 'hanging.mjs');
        const later = join(scratch, 'later.mjs');
        await writeFile(
            hanging,
            [
                `process.on('SIGTERM', () => {});`,
                `setInterval(() => {}, 1_000);`,
                `await new Promise(() => {});`,
            ].join('\n'),
        );
        await writeFile(later, `globalThis.__almanacExampleClaim(() => 2 + 2, 'later:0');\n`);

        const entries = [
            entry('hanging', hanging, 'hanging:0', true),
            entry('later', later, 'later:0', 4, 'number-exact'),
        ];
        const manifestPath = join(scratch, 'manifest.json');
        await writeFile(manifestPath, JSON.stringify(entries));

        const started = Date.now();
        const result = runExampleEntries(entries, {
            manifestPath,
            runner,
            cwd: scratch,
            timeoutMs: 1_000,
        });
        const elapsed = Date.now() - started;

        assert.equal(result.checked, 1);
        assert.ok(elapsed < 3_000, `expected a prompt hard timeout, took ${elapsed} ms`);
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
    return entryWithClaims(name, target, [claim(claimId, String(value), { kind, value })]);
}

function entryWithClaims(name, target, claims) {
    return {
        name,
        file: `${name}.ts`,
        line: 1,
        target,
        claims: claims.map((value) => ({ ...value, file: `${name}.ts`, line: 1 })),
    };
}

function claim(id, expected, spec) {
    return { id, expected, spec };
}
