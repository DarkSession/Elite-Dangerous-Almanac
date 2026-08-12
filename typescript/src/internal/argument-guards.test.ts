import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeValue, requireString } from './argument-guards.js';

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
    assert.equal(described.length, 'object '.length + 61);
    assert.ok(described.startsWith('object {"Modules":[0,1,2,'), described);
    assert.ok(described.endsWith('…'), described);
});
