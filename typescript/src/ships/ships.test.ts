import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHIPS, getShipBySymbol, getShipByName } from './ships.js';
import shipsFixture from '../../../fixtures/ships/ships.json' with { type: 'json' };

test(`the ship catalogue holds ${shipsFixture.count} hulls`, () => {
    assert.equal(SHIPS.length, shipsFixture.count);
});

test('fixture records resolve by symbol and name with the expected fields', () => {
    for (const expected of shipsFixture.records) {
        const bySymbol = getShipBySymbol(expected.symbol);
        assert.ok(bySymbol, `missing ${expected.symbol}`);
        assert.deepEqual(bySymbol, expected);
        // Both lookups return the same record.
        assert.deepEqual(getShipByName(expected.name), expected);
    }
});

test('symbol and name lookups are case-insensitive (journal gives lower-cased symbols)', () => {
    for (const { query, by, name, symbol } of shipsFixture.lookups) {
        const ship = by === 'symbol' ? getShipBySymbol(query) : getShipByName(query);
        assert.ok(ship, `missing ${query}`);
        if (name) assert.equal(ship.name, name);
        if (symbol) assert.equal(ship.symbol, symbol);
    }
});

test('entitlement is present only on gated hulls, absent otherwise', () => {
    assert.equal(getShipBySymbol('SideWinder')?.entitlement, undefined);
    assert.equal(getShipBySymbol('Python_NX')?.entitlement, 'ELITE_V_PYTHON_NX');
});

test('symbol and name lookups ignore surrounding whitespace', () => {
    assert.equal(getShipBySymbol('  empire_trader  ')?.name, 'Imperial Clipper');
    assert.equal(getShipByName('  Imperial Clipper\n')?.symbol, 'Empire_Trader');
});

test('missing hulls resolve to null on every lookup', () => {
    assert.equal(getShipBySymbol('NoSuchShip'), null);
    assert.equal(getShipByName('No Such Ship'), null);
});

test('symbols and names are unique across the catalogue', () => {
    const symbols = new Set(SHIPS.map((s) => s.symbol.toLowerCase()));
    const names = new Set(SHIPS.map((s) => s.name.toLowerCase()));
    assert.equal(symbols.size, SHIPS.length);
    assert.equal(names.size, SHIPS.length);
});
