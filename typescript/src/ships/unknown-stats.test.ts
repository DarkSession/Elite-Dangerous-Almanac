import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isStatUnknown, modulesWithUnknownStats } from './unknown-stats.js';
import { ALL_MODULES } from './modules-all.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { getModuleBySymbol, type ModuleStatField, type OutfittingModule } from './modules.js';
import statsFixture from '../../../fixtures/ships/module-stats.json' with { type: 'json' };

const FIXTURE = statsFixture.unknownStats;
/** The fixture's `unknownStats`, minus its prose, as field → symbols. */
const BY_FIELD: Readonly<Record<string, readonly string[]>> = {
    powerDraw: FIXTURE.powerDraw,
};

test('the catalogue declares exactly the gaps the fixture pins', () => {
    const declared: Record<string, string[]> = {};
    for (const module of modulesWithUnknownStats(ALL_MODULES)) {
        for (const field of module.unknownStats!) (declared[field] ??= []).push(module.symbol);
    }
    assert.deepEqual(
        Object.fromEntries(Object.entries(declared).map(([f, s]) => [f, [...s].sort()])),
        Object.fromEntries(Object.entries(BY_FIELD).map(([f, s]) => [f, [...s].sort()])),
    );
});

test('a declared stat is always absent from the record that declares it', () => {
    // The field only ever *explains* an absence. A stat that has a value is not
    // unknown, and leaving the name behind after sourcing one would say it is.
    for (const module of modulesWithUnknownStats(ALL_MODULES)) {
        assert.ok(module.unknownStats!.length > 0, `${module.symbol} declares nothing`);
        for (const field of module.unknownStats!) {
            assert.equal(module[field], undefined, `${module.symbol}.${field} has a value`);
        }
    }
});

test('the declarations name only fields the record shape has', () => {
    // A typo'd field would silently never match, so pin the names against the fields
    // the catalogue actually uses — minus the declaration itself, which is a statement
    // about the stats rather than one of them and can never be unknown.
    const fields = new Set(ALL_MODULES.flatMap((m) => Object.keys(m)) as ModuleStatField[]);
    fields.delete('unknownStats');
    for (const module of modulesWithUnknownStats(ALL_MODULES)) {
        for (const field of module.unknownStats!) {
            assert.ok(fields.has(field), `${module.symbol}: unknown field ${field}`);
        }
    }
});

test('the four withdrawn Discovery Scanners are the whole of the power-draw gap', () => {
    // They are the remainder of the old "106 modules are missing powerDraw" gap: no
    // registry carries a value, and the in-game function is built in now, so 0 would be
    // plausible and unsourced.
    const scanners = ALL_MODULES.filter((m) =>
        m.symbol.toLowerCase().startsWith('int_stellarbodydiscoveryscanner'),
    );
    assert.equal(scanners.length, 4);
    for (const scanner of scanners) {
        assert.equal(scanner.powerDraw, undefined);
        assert.ok(isStatUnknown(scanner, 'powerDraw'), scanner.symbol);
        // Their mass and integrity are sourced, and stay outside the gap.
        assert.equal(scanner.mass, 2);
        assert.equal(scanner.integrity, 40);
        assert.equal(isStatUnknown(scanner, 'mass'), false);
    }
});

test('every module mass is known, including the unsized Hatch Breaker controller', () => {
    const missing = ALL_MODULES.filter((m) => m.mass === undefined);
    assert.deepEqual(missing, []);
    const unsized = getModuleBySymbol('Int_DroneControl_ResourceSiphon', ALL_MODULES);
    assert.equal(unsized?.mass, 0);
    assert.equal(isStatUnknown(unsized, 'mass'), false);
    // The zero belongs only to the unsized record; every sized controller has a real,
    // non-zero mass.
    const sized = ALL_MODULES.filter((m) =>
        m.symbol.toLowerCase().startsWith('int_dronecontrol_resourcesiphon_size'),
    );
    assert.ok(sized.length > 0);
    assert.ok(sized.every((m) => typeof m.mass === 'number' && m.mass > 0));
});

test('a stat a module simply does not have is not reported as unknown', () => {
    // The distinction the field exists for: a cargo rack draws no power, and that is an
    // answer, not a gap.
    const rack = getModuleBySymbol('Int_CargoRack_Size4_Class1', ALL_MODULES);
    assert.equal(rack?.powerDraw, undefined);
    assert.equal(isStatUnknown(rack, 'powerDraw'), false);
    assert.equal(rack?.unknownStats, undefined);
});

test('an unidentifiable module, and an identity field, answer false', () => {
    assert.equal(isStatUnknown(null, 'mass'), false);
    assert.equal(isStatUnknown(undefined, 'powerDraw'), false);
    assert.equal(
        isStatUnknown(getModuleBySymbol('not_a_module_at_all', ALL_MODULES), 'mass'),
        false,
    );
    const siphon = getModuleBySymbol('Int_DroneControl_ResourceSiphon', ALL_MODULES);
    assert.equal(isStatUnknown(siphon, 'name'), false);
});

test('a caller-supplied record is taken at its word about its own gaps', () => {
    // The record has the last say, so a build that hands `setModule` its own stats for
    // one of the five is classified by what that record declares — not by its symbol.
    // Passing a bespoke record with a real draw is how a consumer says "I sourced it".
    const scanner = getModuleBySymbol('Int_StellarBodyDiscoveryScanner_Advanced', ALL_MODULES)!;
    const sourced: Record<string, unknown> = { ...scanner, powerDraw: 0.2 };
    delete sourced.unknownStats;
    assert.equal(isStatUnknown(sourced as unknown as OutfittingModule, 'powerDraw'), false);
    assert.ok(isStatUnknown(scanner, 'powerDraw'));
});

test('the declarations are reachable from the category catalogue alone', () => {
    // All four are internal modules, so a consumer that never imports ALL_MODULES still
    // sees them — the point of the field living on the record.
    assert.equal(modulesWithUnknownStats(INTERNAL_MODULES).length, 4);
    assert.deepEqual(modulesWithUnknownStats(ALL_MODULES).length, 4);
});
