import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getModuleBySymbol,
    getModulesByName,
    getModulesForShip,
    type OutfittingModule,
} from './modules.js';
import { STANDARD_MODULES } from './modules-standard.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import { UTILITY_MODULES } from './modules-utility.js';
import { ALL_MODULES } from './modules-all.js';
import modulesFixture from '../../../fixtures/ships/modules.json' with { type: 'json' };

const CATALOGUES: Record<string, readonly OutfittingModule[]> = {
    standard: STANDARD_MODULES,
    internal: INTERNAL_MODULES,
    hardpoint: HARDPOINT_MODULES,
    utility: UTILITY_MODULES,
    all: ALL_MODULES,
};

for (const [name, expected] of Object.entries(modulesFixture.counts)) {
    test(`the ${name} catalogue holds ${expected} modules`, () => {
        assert.equal(CATALOGUES[name]!.length, expected);
    });
}

test('ALL_MODULES is exactly the four category catalogues concatenated', () => {
    assert.deepEqual(ALL_MODULES, [
        ...STANDARD_MODULES,
        ...INTERNAL_MODULES,
        ...HARDPOINT_MODULES,
        ...UTILITY_MODULES,
    ]);
});

test('every module lands in the catalogue named by its own category', () => {
    for (const [name, catalogue] of Object.entries(CATALOGUES)) {
        if (name === 'all') continue;
        assert.ok(
            catalogue.every((m) => m.category === name),
            `${name} holds a foreign category`,
        );
    }
});

test('fixture records resolve by symbol with the expected fields', () => {
    for (const expected of modulesFixture.records) {
        const bySymbol = getModuleBySymbol(expected.symbol, ALL_MODULES);
        assert.ok(bySymbol, `missing ${expected.symbol}`);
        assert.deepEqual(bySymbol, expected);
    }
});

test('symbol lookup is case-insensitive (journal gives lower-cased symbols)', () => {
    assert.equal(
        getModuleBySymbol('hpt_pulselaser_fixed_small', HARDPOINT_MODULES)?.name,
        'Pulse Laser',
    );
    assert.equal(
        getModuleBySymbol('HPT_PULSELASER_FIXED_SMALL', HARDPOINT_MODULES)?.name,
        'Pulse Laser',
    );
});

test('mount and guidance appear only where they apply', () => {
    const dumbfire = getModuleBySymbol('Hpt_DumbfireMissileRack_Fixed_Medium', HARDPOINT_MODULES);
    assert.equal(dumbfire?.mount, 'Fixed');
    assert.equal(dumbfire?.guidance, 'Dumbfire');
    // A pulse laser has a mount but no guidance.
    assert.equal(
        getModuleBySymbol('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES)?.guidance,
        undefined,
    );
    // A cargo rack has neither.
    const rack = getModuleBySymbol('Int_HullReinforcement_Size1_Class1', INTERNAL_MODULES);
    assert.equal(rack?.mount, undefined);
    assert.equal(rack?.guidance, undefined);
    assert.equal(rack?.ship, undefined);
});

test('getModulesByName returns every size/rating variant, catalogue only', () => {
    // "Pulse Laser" exists at many sizes and mounts.
    const pulses = getModulesByName('pulse laser', HARDPOINT_MODULES);
    assert.ok(pulses.length > 1);
    assert.ok(pulses.every((m) => m.name === 'Pulse Laser'));
    // A hardpoint name is not found in a different catalogue.
    assert.deepEqual(getModulesByName('Pulse Laser', UTILITY_MODULES), []);
});

test('getModulesForShip returns a hull armour set, and nothing outside standard', () => {
    const { ship, count, names } = modulesFixture.shipArmour;
    const armour = getModulesForShip(ship, STANDARD_MODULES);
    assert.equal(armour.length, count);
    assert.deepEqual(
        armour.map((m) => m.name),
        names,
    );
    assert.ok(armour.every((m) => m.ship === ship && m.category === 'standard'));
    // Case-insensitive, and no ship-specific modules live outside standard.
    assert.equal(getModulesForShip(ship.toLowerCase(), STANDARD_MODULES).length, count);
    assert.deepEqual(getModulesForShip(ship, HARDPOINT_MODULES), []);
});

test('the removed Discovery Scanner is retained without a fabricated entitlement', () => {
    const scanner = getModuleBySymbol('Int_StellarBodyDiscoveryScanner_Advanced', INTERNAL_MODULES);
    assert.ok(scanner);
    assert.equal(scanner.name, 'Advanced Discovery Scanner');
    assert.equal(scanner.entitlement, undefined);
});

test('class is a 0-8 size and rating an A-I letter across the whole catalogue', () => {
    for (const module of ALL_MODULES) {
        assert.ok(Number.isInteger(module.class) && module.class >= 0 && module.class <= 8);
        assert.match(module.rating, /^[A-I]$/);
    }
});

test('lookups ignore surrounding whitespace', () => {
    assert.equal(
        getModuleBySymbol('  Hpt_ChaffLauncher_Tiny\t', UTILITY_MODULES)?.name,
        'Chaff Launcher',
    );
    assert.equal(getModulesByName('  Pulse Laser  ', HARDPOINT_MODULES).length > 1, true);
    assert.equal(getModulesForShip(' Anaconda ', STANDARD_MODULES).length, 5);
});

test('missing modules resolve to null', () => {
    assert.equal(getModuleBySymbol('NoSuchModule', ALL_MODULES), null);
});

test('symbols are unique across the whole catalogue', () => {
    const symbols = new Set(ALL_MODULES.map((m) => m.symbol.toLowerCase()));
    assert.equal(symbols.size, ALL_MODULES.length);
});
