import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getModuleBySymbol,
    getModulesByName,
    getModulesForShip,
    type OutfittingModule,
} from './modules.js';
import { CORE_MODULES } from './modules-core.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import { UTILITY_MODULES } from './modules-utility.js';
import { ALL_MODULES } from './modules-all.js';
import { combinedRateOfFire } from './weapons.js';
import { SHIPS } from './ships.js';
import modulesFixture from '../../../fixtures/ships/modules.json' with { type: 'json' };
import statsFixture from '../../../fixtures/ships/module-stats.json' with { type: 'json' };

const CATALOGUES: Record<string, readonly OutfittingModule[]> = {
    core: CORE_MODULES,
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
        ...CORE_MODULES,
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

test('getModulesForShip returns a hull armour set, and nothing outside core', () => {
    const { ship, count, names } = modulesFixture.shipArmour;
    const armour = getModulesForShip(ship, CORE_MODULES);
    assert.equal(armour.length, count);
    assert.deepEqual(
        armour.map((m) => m.name),
        names,
    );
    assert.ok(armour.every((m) => m.ship === ship && m.category === 'core'));
    // Case-insensitive, and no ship-specific modules live outside core.
    assert.equal(getModulesForShip(ship.toLowerCase(), CORE_MODULES).length, count);
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
    assert.equal(getModulesForShip(' Anaconda ', CORE_MODULES).length, 5);
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

test('only the modules that really are free are priced at 0', () => {
    // A zero cost is indistinguishable from a merge that dropped the price, and that is
    // exactly how 16 modules once ended up free. Pin the survivors so a new zero has to
    // be argued for. Ship-specific armour is excluded: a stock bulkhead is genuinely free.
    const free = ALL_MODULES.filter((m) => m.cost === 0 && !/_Armour_/i.test(m.symbol)).map(
        (m) => m.symbol,
    );
    assert.deepEqual(free.sort(), [...statsFixture.freeModules.symbols].sort());
});

test('every price is a non-negative integer number of credits', () => {
    for (const m of ALL_MODULES) {
        if (m.cost === undefined) continue;
        assert.ok(Number.isInteger(m.cost) && m.cost >= 0, `${m.symbol}: ${String(m.cost)}`);
    }
});

test('FSD constants are readable straight off the module record', () => {
    const fsd = getModuleBySymbol('int_hyperdrive_size5_class5', CORE_MODULES);
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
    const grav = getModuleBySymbol('Int_Engine_Size7_Class5_GravityOptimised_MkII', CORE_MODULES);
    assert.deepEqual(grav?.restrictedToShips, ['Explorer_NX']);
    // Ship-specific armour keeps its restriction in the registry, not restrictedToShips.
    const armour = getModuleBySymbol('Anaconda_Armour_Grade1', CORE_MODULES);
    assert.equal(armour?.restrictedToShips, undefined);
    assert.equal(armour?.ship, 'Anaconda');
});

test('ship armour carries its hull-specific bulkhead stats', () => {
    // Armour is the one ship-specific module, and its stats differ per hull: a
    // Sidewinder's reactive composite weighs 4 t against an Anaconda's 60 t. Both
    // share the grade's hull boost and resistances.
    const sidewinder = getModuleBySymbol('SideWinder_Armour_Reactive', CORE_MODULES);
    const anaconda = getModuleBySymbol('Anaconda_Armour_Reactive', CORE_MODULES);
    assert.ok(sidewinder && anaconda);
    assert.equal(sidewinder.mass, 4);
    assert.equal(anaconda.mass, 60);
    assert.equal(sidewinder.hullBoost, anaconda.hullBoost);
    assert.equal(anaconda.kineticResistance, 0.25);
    // The stock lightweight alloy is the zero-mass baseline every hull starts from.
    assert.equal(getModuleBySymbol('SideWinder_Armour_Grade1', CORE_MODULES)?.mass, 0);
});

test('every hull offers a full armour set, all of it priced and stat-bearing', () => {
    for (const ship of SHIPS) {
        const armour = getModulesForShip(ship.name, CORE_MODULES);
        assert.ok(armour.length >= 5, `${ship.symbol} armour set`);
        for (const variant of armour) {
            assert.equal(typeof variant.mass, 'number', variant.symbol);
            assert.equal(typeof variant.hullBoost, 'number', variant.symbol);
            assert.ok(hasStats(variant), variant.symbol);
        }
    }
});

test('a continuous-fire weapon carries damage per second and no rate of fire', () => {
    for (const symbol of statsFixture.continuousFire) {
        const weapon = getModuleBySymbol(symbol, ALL_MODULES);
        assert.ok(weapon, symbol);
        assert.equal(weapon.rateOfFire, undefined, symbol);
        assert.ok((weapon.damage ?? 0) > 0, symbol);
    }
});

test("a weapon's physical damage shares sum to one", () => {
    for (const weapon of HARDPOINT_MODULES) {
        const split = weapon.damageDistribution;
        if (!split) continue;
        const physical =
            (split.kinetic ?? 0) +
            (split.thermal ?? 0) +
            (split.explosive ?? 0) +
            (split.absolute ?? 0);
        assert.ok(Math.abs(physical - 1) < 1e-9, `${weapon.symbol}: ${String(physical)}`);
    }
});

test("every weapon's carried rate of fire agrees with its own firing cycle", () => {
    // `rateOfFire` is derived from the interval, burst pattern and charge time at
    // acquisition time; if the two ever disagree, an engineered build would jump.
    let checked = 0;
    for (const weapon of ALL_MODULES) {
        if (weapon.rateOfFire === undefined) continue;
        const derived = combinedRateOfFire(weapon);
        assert.ok(derived !== undefined, `${weapon.symbol}: no cycle to derive from`);
        assert.ok(
            Math.abs(derived - weapon.rateOfFire) < 1e-5,
            `${weapon.symbol}: carried ${weapon.rateOfFire} vs derived ${derived}`,
        );
        checked++;
    }
    assert.ok(checked > 140, `expected the whole weapon catalogue, checked ${checked}`);
});

test('every lookup searches all modules when no catalogue is given', () => {
    // A journal `Item` string does not say which outfitting category it belongs to,
    // so the default has to be all four.
    assert.equal(getModuleBySymbol('Hpt_PulseLaser_Fixed_Small')?.name, 'Pulse Laser');
    assert.equal(getModuleBySymbol('int_hyperdrive_size6_class5')?.category, 'core');
    assert.equal(getModuleBySymbol('hpt_chafflauncher_tiny')?.category, 'utility');
    assert.deepEqual(getModulesByName('pulse laser'), getModulesByName('pulse laser', ALL_MODULES));
    assert.deepEqual(
        getModulesForShip('Anaconda').map((m) => m.symbol),
        getModulesForShip('Anaconda', CORE_MODULES).map((m) => m.symbol),
    );
    // One record from every category resolves without naming its catalogue.
    for (const [category, catalogue] of Object.entries(CATALOGUES)) {
        const first = catalogue[0]!;
        assert.deepEqual(getModuleBySymbol(first.symbol), first, category);
    }
});

test('an explicit catalogue still narrows the search', () => {
    // A pulse laser is a hardpoint, so a utility-only search must not find it.
    assert.equal(getModuleBySymbol('Hpt_PulseLaser_Fixed_Small', UTILITY_MODULES), null);
    assert.equal(
        getModuleBySymbol('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES)?.name,
        'Pulse Laser',
    );
    assert.deepEqual(getModulesByName('pulse laser', INTERNAL_MODULES), []);
    // Armour is core-only, so any other category yields nothing for a hull.
    assert.deepEqual(getModulesForShip('Anaconda', HARDPOINT_MODULES), []);
});
