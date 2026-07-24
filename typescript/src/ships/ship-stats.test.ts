import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHIP_STATS, getShipStats } from './ship-stats.js';
import { SHIPS } from './ships.js';
import fixture from '../../../fixtures/ships/ship-stats.json' with { type: 'json' };

test('SHIP_STATS holds the expected number of hulls', () => {
    assert.equal(SHIP_STATS.length, fixture.count);
});

test('every ship-stats symbol matches a real hull in the registry', () => {
    const known = new Set(SHIPS.map((s) => s.symbol.toLowerCase()));
    for (const s of SHIP_STATS) {
        assert.ok(known.has(s.symbol.toLowerCase()), `unknown ship symbol: ${s.symbol}`);
    }
});

test('getShipStats resolves case-insensitively', () => {
    assert.equal(getShipStats('anaconda')?.hullMass, 400);
    assert.equal(getShipStats('ANACONDA'), getShipStats('Anaconda'));
    assert.equal(getShipStats('not_a_ship'), null);
});

for (const expected of fixture.spot) {
    test(`ship-stats spot check: ${expected.symbol}`, () => {
        assert.deepEqual(getShipStats(expected.symbol), expected);
    });
}
