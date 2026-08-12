import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeValue, requireString, truncate } from './argument-guards.js';

test('requireString passes a string through', () => {
    assert.equal(requireString('Anaconda', 'X.y: z'), 'Anaconda');
    assert.equal(requireString('', 'X.y: z'), '');
});

test('requireString names the parameter and the value it received', () => {
    assert.throws(() => requireString(42, 'ShipLoadout.empty: shipSymbol'), {
        name: 'TypeError',
        message: 'ShipLoadout.empty: shipSymbol must be a string, received number 42',
    });
    assert.throws(() => requireString(undefined, 'X.y: z'), {
        message: 'X.y: z must be a string, received undefined',
    });
});

test('describeValue prints the value alongside its type', () => {
    assert.equal(describeValue(null), 'null');
    assert.equal(describeValue(undefined), 'undefined');
    assert.equal(describeValue('Sol'), 'string "Sol"');
    assert.equal(describeValue(42), 'number 42');
    assert.equal(describeValue(Number.NaN), 'number NaN');
    assert.equal(describeValue(false), 'boolean false');
    assert.equal(describeValue(7n), 'bigint 7');
    assert.equal(describeValue(Symbol('sym')), 'symbol Symbol(sym)');
    assert.equal(describeValue({ Slot: 'FrameShiftDrive' }), 'object {"Slot":"FrameShiftDrive"}');
    assert.equal(describeValue([1, 2]), 'object [1,2]');
});

test('describeValue falls back to the bare type when a value has no JSON rendering', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.equal(describeValue(cyclic), 'object');
    // `JSON.stringify` throws on a `bigint` anywhere inside.
    assert.equal(describeValue({ id: 1n }), 'object');
    // …and returns `undefined` for a function, rather than throwing.
    assert.equal(
        describeValue(() => 1),
        'function',
    );
});

test('describeValue truncates a long preview instead of quoting a whole payload', () => {
    const described = describeValue({ Modules: Array.from({ length: 40 }, (_, i) => i) });
    assert.ok(described.startsWith('object {"Modules":[0,1,2,'), described);
    assert.ok(described.endsWith('…'), described);
    assert.ok(described.length < 100, `preview not shortened: ${described.length} chars`);

    // A string argument is the likeliest oversized one — a whole SLEF payload handed
    // where a symbol belongs — so it is shortened on the same terms.
    const long = describeValue('x'.repeat(50_000));
    assert.ok(long.startsWith('string "xxx'), long);
    assert.ok(long.endsWith('…'), long);
    assert.ok(long.length < 100, `preview not shortened: ${long.length} chars`);
});

test('describeValue never cuts a surrogate pair in half', () => {
    // The two cases put the cut on either half of a pair: the string's own quote makes
    // its previews one character out of step with the object's.
    for (const value of ['🚀'.repeat(80), { a: '🚀'.repeat(80) }]) {
        const described = describeValue(value);
        assert.ok(/🚀…$/u.test(described), described);
        assert.ok(
            !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(described),
            `unpaired surrogate left in ${described}`,
        );
    }
});

test('truncate accepts unknown values without letting their rendering replace the diagnostic', () => {
    assert.equal(truncate(42), '42');
    assert.equal(truncate(Symbol('slot')), 'Symbol(slot)');
    assert.equal(truncate('x'.repeat(20_000)), `${'x'.repeat(60)}…`);
    assert.equal(
        truncate({
            toString() {
                throw new Error('conversion failed');
            },
        }),
        '<unprintable>',
    );
});
