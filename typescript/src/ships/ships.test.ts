import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHIPS, getShipBySymbol, getShipByName, getShipSlots } from './ships.js';
import shipsFixture from '../../../fixtures/ships/ships.jsonc' with { type: 'json' };
import statsFixture from '../../../fixtures/ships/ship-stats.jsonc' with { type: 'json' };
import slotsFixture from '../../../fixtures/ships/ship-slots.jsonc' with { type: 'json' };

/** A merged Ship record projected onto just the keys a subset fixture carries. */
const project = (obj: object, ref: object): Record<string, unknown> => {
    const source = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(ref)) out[key] = source[key];
    return out;
};

test(`the ship catalogue holds ${shipsFixture.count} hulls`, () => {
    assert.equal(SHIPS.length, shipsFixture.count);
});

test('fixture records resolve by symbol and name with the expected identity fields', () => {
    for (const expected of shipsFixture.records) {
        const bySymbol = getShipBySymbol(expected.symbol);
        assert.ok(bySymbol, `missing ${expected.symbol}`);
        assert.deepEqual(project(bySymbol, expected), expected);
        // Both lookups return the same record.
        assert.deepEqual(getShipByName(expected.name), bySymbol);
    }
});

test('ship display names match the installed English localisation exactly', () => {
    for (const expected of shipsFixture.displayNameCorrections) {
        const ship = getShipBySymbol(expected.symbol);
        assert.ok(ship, `missing ${expected.symbol}`);
        assert.deepEqual(project(ship, expected), expected);
        assert.deepEqual(getShipByName(expected.name), ship);
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

// ── Stats (merged into each Ship from coriolis-data) ─────────────────────────

test(`${statsFixture.count} hulls carry stats; getShipBySymbol reads them`, () => {
    assert.equal(SHIPS.filter((s) => s.hullMass !== undefined).length, statsFixture.count);
    assert.ok(SHIPS.every((ship) => ship.masslock > 0));
    assert.ok(SHIPS.every((ship) => ship.heatCapacity > 0));
    assert.equal(getShipBySymbol('anaconda')?.hullMass, 400);
    assert.equal(getShipBySymbol('anaconda')?.hullMass, getShipBySymbol('ANACONDA')?.hullMass);
});

test('ship-stats spot checks: each merged hull carries the expected stat values', () => {
    for (const expected of statsFixture.spot) {
        const ship = getShipBySymbol(expected.symbol);
        assert.ok(ship, `missing ${expected.symbol}`);
        assert.deepEqual(project(ship, expected), expected);
    }
});

test('ship stats carry the in-game audit corrections at their observed precision', () => {
    for (const expected of statsFixture.inGameCorrections) {
        const ship = getShipBySymbol(expected.symbol);
        assert.ok(ship, `missing ${expected.symbol}`);
        assert.deepEqual(project(ship, expected), expected);
    }
});

test('every hull carries the pinned maximum heat-dissipation figure', () => {
    const expected = statsFixture.heatDissipation;
    assert.equal(SHIPS.length, expected.values.length);
    assert.ok(
        SHIPS.every((ship) => ship.heatDissipation > 0),
        'every hull sheds something',
    );
    assert.deepEqual(
        SHIPS.map(({ symbol, heatDissipation }) => ({ symbol, heatDissipation })),
        expected.values,
    );
    for (const bound of [expected.minimum, expected.maximum]) {
        assert.equal(
            getShipBySymbol(bound.symbol)?.heatDissipation,
            bound.heatDissipation,
            bound.symbol,
        );
    }
    assert.equal(
        Math.min(...SHIPS.map((ship) => ship.heatDissipation)),
        expected.minimum.heatDissipation,
    );
    assert.equal(
        Math.max(...SHIPS.map((ship) => ship.heatDissipation)),
        expected.maximum.heatDissipation,
    );
});

test('every hull carries its installed minimum and maximum speed endpoints', () => {
    for (const expected of statsFixture.speedEndpoints) {
        const ship = getShipBySymbol(expected.symbol);
        assert.ok(ship, `missing ${expected.symbol}`);
        assert.deepEqual(project(ship, expected), expected);
    }
});

test('every hull carries its installed minimum and full angular-rate endpoints', () => {
    for (const expected of statsFixture.rotationEndpoints) {
        const ship = getShipBySymbol(expected.symbol);
        assert.ok(ship, `missing ${expected.symbol}`);
        assert.deepEqual(project(ship, expected), expected);
    }
});

test(`all ${statsFixture.pricedCount} hulls carry a hull and a retail price`, () => {
    assert.equal(SHIPS.filter((s) => s.hullCost !== undefined).length, statsFixture.pricedCount);
    for (const expected of statsFixture.prices) {
        const ship = getShipBySymbol(expected.symbol);
        assert.ok(ship, `missing ${expected.symbol}`);
        assert.equal(ship.hullCost, expected.hullCost);
        assert.equal(ship.retailCost, expected.retailCost);
    }
});

test('retail price covers the hull plus its default modules, so never undercuts it', () => {
    for (const s of SHIPS) {
        assert.ok(Number.isInteger(s.hullCost) && s.hullCost! >= 0, s.symbol);
        assert.ok(Number.isInteger(s.retailCost) && s.retailCost! >= 0, s.symbol);
        assert.ok(s.retailCost! >= s.hullCost!, `${s.symbol}: retail < hull`);
    }
});

// ── Slot layout (merged into each Ship; getShipSlots projects it back out) ────

test(`${slotsFixture.count} hulls carry a slot layout`, () => {
    assert.equal(SHIPS.filter((s) => getShipSlots(s.symbol) !== null).length, slotsFixture.count);
});

test('getShipSlots resolves case-insensitively and returns null for the unknown', () => {
    assert.equal(getShipSlots('anaconda')?.core.frameShiftDrive, 6);
    assert.deepEqual(getShipSlots('ANACONDA'), getShipSlots('Anaconda'));
    assert.equal(getShipSlots('not_a_ship'), null);
    // The Lynx Highliner carries a full slot layout.
    assert.equal(getShipSlots('MediumTransport01')?.core.frameShiftDrive, 5);
});

test('every hull with a layout declares seven core sizes and some optional slots', () => {
    for (const ship of SHIPS) {
        const layout = getShipSlots(ship.symbol);
        if (!layout) continue;
        assert.equal(Object.keys(layout.core).length, 7, `${ship.symbol} core`);
        assert.ok(layout.optional.length > 0, `${ship.symbol} optional slots`);
    }
});

test('ship-slots spot checks reproduce the full layout', () => {
    for (const expected of slotsFixture.spot) {
        assert.deepEqual(getShipSlots(expected.symbol), expected);
    }
});

test('a hull lookup names a wrong-typed key and answers a missing one', () => {
    for (const [call, label] of [
        [() => getShipBySymbol(42 as unknown as string), 'getShipBySymbol: symbol'],
        [() => getShipByName(42 as unknown as string), 'getShipByName: name'],
        // The slot facade delegates to the symbol lookup and still names itself.
        [() => getShipSlots(42 as unknown as string), 'getShipSlots: symbol'],
    ] as const) {
        assert.throws(call, {
            name: 'TypeError',
            message: `${label} must be a string, received number 42`,
        });
    }
    for (const missing of [null, undefined]) {
        assert.equal(getShipBySymbol(missing as unknown as string), null);
        assert.equal(getShipByName(missing as unknown as string), null);
        assert.equal(getShipSlots(missing as unknown as string), null);
    }
});
