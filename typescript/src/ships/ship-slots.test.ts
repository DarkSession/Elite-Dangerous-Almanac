import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHIP_SLOTS, getShipSlots } from './ship-slots.js';
import { SHIPS } from './ships.js';
import fixture from '../../../fixtures/ships/ship-slots.json' with { type: 'json' };

test('SHIP_SLOTS holds the expected number of hulls', () => {
    assert.equal(SHIP_SLOTS.length, fixture.count);
});

test('every ship-slots symbol matches a real hull in the registry', () => {
    const known = new Set(SHIPS.map((s) => s.symbol.toLowerCase()));
    for (const s of SHIP_SLOTS) {
        assert.ok(known.has(s.symbol.toLowerCase()), `unknown ship symbol: ${s.symbol}`);
    }
});

test('every hull declares seven core sizes and its bulkhead options', () => {
    for (const s of SHIP_SLOTS) {
        assert.equal(Object.keys(s.core).length, 7, `${s.symbol} core`);
        // Every hull has at least the five standard alloys; the Python Mk II has six.
        assert.ok(s.bulkheads.length >= 5, `${s.symbol} bulkheads`);
        assert.equal(s.bulkheads[0]?.mass, 0, `${s.symbol} default alloy is zero-mass`);
    }
});

test('getShipSlots resolves case-insensitively', () => {
    assert.equal(getShipSlots('anaconda')?.core.frameShiftDrive, 6);
    assert.equal(getShipSlots('ANACONDA'), getShipSlots('Anaconda'));
    assert.equal(getShipSlots('not_a_ship'), null);
});

for (const expected of fixture.spot) {
    test(`ship-slots spot check: ${expected.symbol}`, () => {
        assert.deepEqual(getShipSlots(expected.symbol), expected);
    });
}
