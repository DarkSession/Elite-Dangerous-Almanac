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
import { SHIPS } from './ships.js';
import modulesFixture from '../../../fixtures/ships/modules.json' with { type: 'json' };
import statsFixture from '../../../fixtures/ships/module-stats.json' with { type: 'json' };

const CATALOGUES: Record<string, readonly OutfittingModule[]> = {
    standard: STANDARD_MODULES,
    internal: INTERNAL_MODULES,
    hardpoint: HARDPOINT_MODULES,
    utility: UTILITY_MODULES,
    all: ALL_MODULES,
};

/** Identity fields — everything else on a merged record is a stat. */
const IDENTITY_KEYS = new Set([
    'symbol',
    'category',
    'name',
    'mount',
    'guidance',
    'ship',
    'class',
    'rating',
    'entitlement',
    // Price is commercial data, not a stat: ship-specific armour is priced but carries
    // no mass/integrity/power, and must still count as identity-only here.
    'cost',
]);

/** Whether a merged record carries any stats (vs. identity only, like armour). */
const hasStats = (m: OutfittingModule): boolean =>
    Object.keys(m).some((k) => !IDENTITY_KEYS.has(k));

/** A merged record projected onto just the keys a subset fixture carries. */
const project = (obj: object, ref: object): Record<string, unknown> => {
    const source = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(ref)) out[key] = source[key];
    return out;
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

test('module symbols are unique across all four catalogues', () => {
    const symbols = ALL_MODULES.map((module) => module.symbol.toLowerCase());
    assert.equal(new Set(symbols).size, symbols.length);
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

test('fixture records resolve by symbol with the expected identity fields', () => {
    for (const expected of modulesFixture.records) {
        const bySymbol = getModuleBySymbol(expected.symbol, ALL_MODULES);
        assert.ok(bySymbol, `missing ${expected.symbol}`);
        assert.deepEqual(project(bySymbol, expected), expected);
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

// ── Stats (merged into each record from coriolis-data) ───────────────────────

for (const [name, expected] of Object.entries(statsFixture.counts)) {
    test(`the ${name} catalogue holds ${expected} modules with stats`, () => {
        assert.equal(CATALOGUES[name]!.filter(hasStats).length, expected);
    });
}

test('stats spot checks: each merged record carries the expected stat values', () => {
    for (const expected of statsFixture.spot) {
        const record = getModuleBySymbol(expected.symbol, ALL_MODULES);
        assert.ok(record, `missing ${expected.symbol}`);
        assert.deepEqual(project(record, expected), expected);
    }
});

// ── Prices ───────────────────────────────────────────────────────────────────

for (const [name, expected] of Object.entries(statsFixture.priceCounts)) {
    test(`the ${name} catalogue prices ${expected} modules`, () => {
        assert.equal(CATALOGUES[name]!.filter((m) => m.cost !== undefined).length, expected);
    });
}

test('price spot checks: each record carries its standard purchase price', () => {
    for (const expected of statsFixture.prices) {
        const record = getModuleBySymbol(expected.symbol, ALL_MODULES);
        assert.ok(record, `missing ${expected.symbol}`);
        assert.equal(record.cost, expected.cost);
    }
});

test('an unpriced record omits cost rather than reporting it as free', () => {
    // 0 is a real price (a starter bulkhead); "no published price" must stay undefined
    // so a cost calculation can tell the two apart.
    for (const symbol of statsFixture.unpriced) {
        const record = getModuleBySymbol(symbol, ALL_MODULES);
        assert.ok(record, `missing ${symbol}`);
        assert.equal(record.cost, undefined, symbol);
    }
    assert.equal(getModuleBySymbol('Anaconda_Armour_Grade1', ALL_MODULES)!.cost, 0);
});

test('every price is a non-negative integer number of credits', () => {
    for (const m of ALL_MODULES) {
        if (m.cost === undefined) continue;
        assert.ok(Number.isInteger(m.cost) && m.cost >= 0, `${m.symbol}: ${String(m.cost)}`);
    }
});

test('FSD constants are readable straight off the module record', () => {
    const fsd = getModuleBySymbol('int_hyperdrive_size5_class5', STANDARD_MODULES);
    assert.equal(fsd?.name, 'Frame Shift Drive');
    assert.equal(fsd?.optMass, 1050);
    assert.equal(fsd?.fuelPower, 2.45);
});

test('ship-restricted modules name real hulls, armour excepted', () => {
    const hulls = new Set(SHIPS.map((s) => s.symbol.toLowerCase()));
    const restricted = ALL_MODULES.filter((m) => m.restrictedToShips);
    assert.ok(restricted.length > 0, 'expected at least one ship-restricted module');
    for (const m of restricted) {
        for (const ship of m.restrictedToShips!) {
            assert.ok(
                hulls.has(ship.toLowerCase()),
                `restriction ${ship} on ${m.symbol} is not a hull`,
            );
        }
    }
    // The Python Mk II's MkII gravity thrusters are restricted to that hull.
    const grav = getModuleBySymbol(
        'Int_Engine_Size7_Class5_GravityOptimised_MkII',
        STANDARD_MODULES,
    );
    assert.deepEqual(grav?.restrictedToShips, ['Explorer_NX']);
    // Ship-specific armour keeps its restriction in the registry, not restrictedToShips.
    const armour = getModuleBySymbol('Anaconda_Armour_Grade1', STANDARD_MODULES);
    assert.equal(armour?.restrictedToShips, undefined);
    assert.equal(armour?.ship, 'Anaconda');
});

test('modules without stats (ship-specific armour) carry identity only', () => {
    const armour = getModuleBySymbol('SideWinder_Armour_Grade1', STANDARD_MODULES);
    assert.ok(armour);
    assert.equal(hasStats(armour), false);
    assert.equal(armour.mass, undefined);
});
