import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getModuleStats, type ModuleStats } from './module-stats.js';
import { STANDARD_MODULE_STATS } from './module-stats-standard.js';
import { INTERNAL_MODULE_STATS } from './module-stats-internal.js';
import { HARDPOINT_MODULE_STATS } from './module-stats-hardpoint.js';
import { UTILITY_MODULE_STATS } from './module-stats-utility.js';
import { ALL_MODULE_STATS } from './module-stats-all.js';
import { ALL_MODULES } from './modules-all.js';
import { SHIPS } from './ships.js';
import fixture from '../../../fixtures/ships/module-stats.json' with { type: 'json' };

const CATALOGUES: Record<string, readonly ModuleStats[]> = {
    standard: STANDARD_MODULE_STATS,
    internal: INTERNAL_MODULE_STATS,
    hardpoint: HARDPOINT_MODULE_STATS,
    utility: UTILITY_MODULE_STATS,
    all: ALL_MODULE_STATS,
};

for (const [name, expected] of Object.entries(fixture.counts)) {
    test(`the ${name} module-stats catalogue holds ${expected} rows`, () => {
        assert.equal(CATALOGUES[name]!.length, expected);
    });
}

test('ALL_MODULE_STATS is the four category catalogues concatenated', () => {
    assert.deepEqual(ALL_MODULE_STATS, [
        ...STANDARD_MODULE_STATS,
        ...INTERNAL_MODULE_STATS,
        ...HARDPOINT_MODULE_STATS,
        ...UTILITY_MODULE_STATS,
    ]);
});

test('module-stat symbols are unique across all four catalogues', () => {
    const symbols = ALL_MODULE_STATS.map((module) => module.symbol.toLowerCase());
    assert.equal(new Set(symbols).size, symbols.length);
});

test('every module-stats symbol matches a real module in the registry', () => {
    const known = new Set(ALL_MODULES.map((m) => m.symbol.toLowerCase()));
    for (const s of ALL_MODULE_STATS) {
        assert.ok(known.has(s.symbol.toLowerCase()), `unknown module symbol: ${s.symbol}`);
    }
});

test('getModuleStats resolves case-insensitively and reads FSD constants', () => {
    const fsd = getModuleStats('int_hyperdrive_size5_class5', STANDARD_MODULE_STATS);
    assert.equal(fsd?.name, 'Frame Shift Drive');
    assert.equal(fsd?.optMass, 1050);
    assert.equal(fsd?.fuelPower, 2.45);
    assert.equal(getModuleStats('nope', STANDARD_MODULE_STATS), null);
});

test('every stats record carries a display name', () => {
    for (const s of ALL_MODULE_STATS) {
        assert.equal(typeof s.name, 'string');
        assert.ok(s.name.length > 0, `empty name for ${s.symbol}`);
    }
});

test('ship-restricted modules name real hulls in the registry', () => {
    const hulls = new Set(SHIPS.map((s) => s.symbol.toLowerCase()));
    const restricted = ALL_MODULE_STATS.filter((s) => s.restrictedToShips);
    assert.ok(restricted.length > 0, 'expected at least one ship-restricted module');
    for (const s of restricted) {
        for (const ship of s.restrictedToShips!) {
            assert.ok(
                hulls.has(ship.toLowerCase()),
                `restriction ${ship} on ${s.symbol} is not a hull`,
            );
        }
    }
    // The Python Mk II's MkII gravity thrusters are restricted to that hull.
    const grav = getModuleStats(
        'Int_Engine_Size7_Class5_GravityOptimised_MkII',
        STANDARD_MODULE_STATS,
    );
    assert.deepEqual(grav?.restrictedToShips, ['Explorer_NX']);
});

for (const expected of fixture.spot) {
    test(`module-stats spot check: ${expected.symbol}`, () => {
        assert.deepEqual(getModuleStats(expected.symbol, ALL_MODULE_STATS), expected);
    });
}
