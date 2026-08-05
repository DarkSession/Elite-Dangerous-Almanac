import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    UNKNOWN_MODULE_STATS,
    isStatUnknown,
    unknownStatsFor,
    type ModuleStatField,
} from './unknown-stats.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol } from './modules.js';
import statsFixture from '../../../fixtures/ships/module-stats.json' with { type: 'json' };

const FIXTURE = statsFixture.unknownStats;
/** The fixture's `unknownStats`, minus its prose, as field → symbols. */
const BY_FIELD: Readonly<Record<string, readonly string[]>> = {
    powerDraw: FIXTURE.powerDraw,
    mass: FIXTURE.mass,
};

test('the registry holds exactly the gaps the fixture pins', () => {
    const registered: Record<string, string[]> = {};
    for (const entry of UNKNOWN_MODULE_STATS) {
        for (const field of entry.stats) (registered[field] ??= []).push(entry.symbol);
    }
    assert.deepEqual(
        Object.fromEntries(Object.entries(registered).map(([f, s]) => [f, [...s].sort()])),
        Object.fromEntries(Object.entries(BY_FIELD).map(([f, s]) => [f, [...s].sort()])),
    );
});

test('every registered symbol is a real module, and every registered stat is absent from it', () => {
    // The registry only ever *explains* an absence. A field that has a value is not
    // unknown, and leaving the entry behind after sourcing one would say it is.
    for (const entry of UNKNOWN_MODULE_STATS) {
        const record = getModuleBySymbol(entry.symbol, ALL_MODULES);
        assert.ok(record, `${entry.symbol} is not in the module catalogue`);
        assert.ok(entry.stats.length > 0, `${entry.symbol} registers no stat`);
        for (const field of entry.stats) {
            assert.equal(record[field], undefined, `${entry.symbol}.${field} has a value`);
        }
    }
});

test('no module is registered twice', () => {
    const symbols = UNKNOWN_MODULE_STATS.map((entry) => entry.symbol.toLowerCase());
    assert.equal(new Set(symbols).size, symbols.length);
});

test('the four withdrawn Discovery Scanners are the whole of the power-draw gap', () => {
    // They are the remainder of the old "106 modules are missing powerDraw" gap: no
    // registry carries a value, and the in-game function is built in now, so 0 would be
    // plausible and unsourced. Every other scanner-like fitting does carry one.
    const scanners = ALL_MODULES.filter((m) =>
        m.symbol.toLowerCase().startsWith('int_stellarbodydiscoveryscanner'),
    );
    assert.equal(scanners.length, 4);
    for (const scanner of scanners) {
        assert.equal(scanner.powerDraw, undefined);
        assert.ok(isStatUnknown(scanner.symbol, 'powerDraw'), scanner.symbol);
        // Their mass and integrity are sourced, and stay outside the gap.
        assert.equal(scanner.mass, 2);
        assert.equal(scanner.integrity, 40);
        assert.equal(isStatUnknown(scanner.symbol, 'mass'), false);
    }
});

test('the unsized Hatch Breaker Limpet Controller is the whole of the mass gap', () => {
    const missing = ALL_MODULES.filter((m) => m.mass === undefined);
    assert.deepEqual(
        missing.map((m) => m.symbol),
        ['Int_DroneControl_ResourceSiphon'],
    );
    assert.ok(isStatUnknown('Int_DroneControl_ResourceSiphon', 'mass'));
    // Every sized controller in the family has a real, non-zero mass — which is why the
    // absent one cannot be read as zero.
    const sized = ALL_MODULES.filter((m) =>
        m.symbol.toLowerCase().startsWith('int_dronecontrol_resourcesiphon_size'),
    );
    assert.ok(sized.length > 0);
    assert.ok(sized.every((m) => typeof m.mass === 'number' && m.mass > 0));
});

test('a stat a module simply does not have is not reported as unknown', () => {
    // The distinction the registry exists for: a cargo rack draws no power, and that is
    // an answer, not a gap.
    const rack = getModuleBySymbol('Int_CargoRack_Size4_Class1', ALL_MODULES);
    assert.equal(rack?.powerDraw, undefined);
    assert.equal(isStatUnknown(rack!.symbol, 'powerDraw'), false);
    assert.deepEqual(unknownStatsFor(rack!.symbol), []);
});

test('lookups take a journal-cased symbol and an unknown one', () => {
    assert.deepEqual(unknownStatsFor('int_stellarbodydiscoveryscanner_advanced'), ['powerDraw']);
    assert.deepEqual(unknownStatsFor('INT_DRONECONTROL_RESOURCESIPHON'), ['mass']);
    assert.deepEqual(unknownStatsFor('not_a_module_at_all'), []);
    assert.equal(isStatUnknown('not_a_module_at_all', 'mass'), false);
    // An identity field is never unknown, whatever the module.
    assert.equal(isStatUnknown('Int_DroneControl_ResourceSiphon', 'name'), false);
});

test('a narrower catalogue narrows the answer', () => {
    const onlyTheSiphon = UNKNOWN_MODULE_STATS.filter((entry) => entry.stats.includes('mass'));
    assert.equal(isStatUnknown('Int_DroneControl_ResourceSiphon', 'mass', onlyTheSiphon), true);
    assert.equal(
        isStatUnknown('Int_StellarBodyDiscoveryScanner_Advanced', 'powerDraw', onlyTheSiphon),
        false,
    );
    assert.deepEqual(
        unknownStatsFor('Int_StellarBodyDiscoveryScanner_Advanced', onlyTheSiphon),
        [],
    );
});

test('the registry names only fields the module record can carry', () => {
    // A typo'd field would silently never match, so pin the names against the fields
    // the catalogue actually uses — every one of them, not one record's handful.
    const fields = new Set(ALL_MODULES.flatMap((m) => Object.keys(m)) as ModuleStatField[]);
    for (const entry of UNKNOWN_MODULE_STATS) {
        for (const field of entry.stats) assert.ok(fields.has(field), `unknown field ${field}`);
    }
});
