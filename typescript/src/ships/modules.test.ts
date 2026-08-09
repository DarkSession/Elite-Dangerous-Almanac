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
import { SHIPS, getShipSlots } from './ships.js';
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
    // Which mount the module fills is identity, not performance: armour names one and
    // still carries no stats at all.
    'slot',
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
    // A statement *about* this record's stats rather than one of them: naming a stat
    // as unknown is the opposite of carrying it.
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
    // Category comes from the data file and is filled in at load. This asserts the
    // loader fills it in, and nothing
    // about the data — that a record sits in the right file is checked from the record
    // itself, in data-files.test.ts.
    for (const [name, catalogue] of Object.entries(CATALOGUES)) {
        if (name === 'all') continue;
        assert.ok(
            catalogue.every((m) => m.category === name),
            `${name} holds a foreign category`,
        );
    }
    assert.equal(new Set(ALL_MODULES.map((m) => m.category)).size, 4);
});

test('slot names the one fixed mount a module fills, and only there', () => {
    const counts: Record<string, number> = {};
    for (const module of ALL_MODULES)
        counts[module.slot ?? 'none'] = (counts[module.slot ?? 'none'] ?? 0) + 1;
    assert.deepEqual(counts, { ...modulesFixture.slotCounts });

    // Every core record names its mount; no weapon or utility fitting does, because
    // either fits any mount of its kind that is big enough.
    assert.ok(CORE_MODULES.every((m) => m.slot !== undefined));
    assert.ok(HARDPOINT_MODULES.every((m) => m.slot === undefined));
    assert.ok(UTILITY_MODULES.every((m) => m.slot === undefined));
    // In the internal catalogue it is the Guardian hybrids and nothing else: core
    // mounts that Frontier's registry files as optional internals.
    assert.deepEqual(
        INTERNAL_MODULES.filter((m) => m.slot !== undefined).map((m) => m.slot),
        [...Array<string>(8).fill('powerDistributor'), ...Array<string>(7).fill('powerPlant')],
    );
});

test('slot is read off the record, not guessed from the symbol', () => {
    // The Python Mk II's thrusters share their prefix with no other module, so a
    // symbol-prefix rule had to carry a special case for them. The record just says.
    assert.equal(
        getModuleBySymbol('Int_MkIIAgileBoost_Engine_Size5_Class5', CORE_MODULES)?.slot,
        'thrusters',
    );
    assert.equal(
        getModuleBySymbol('Int_GuardianPowerplant_Size5', INTERNAL_MODULES)?.slot,
        'powerPlant',
    );
    // An ordinary optional internal fits any optional mount, so it names none.
    assert.equal(
        getModuleBySymbol('Int_CargoRack_Size4_Class1', INTERNAL_MODULES)?.slot,
        undefined,
    );
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

test('the records with no integrity match the fixture', () => {
    // Not a gap in the data: no registry publishes an integrity for these families and
    // the game's own module panel shows none, so the absence is the answer — which is
    // why they are pinned as a set here. Ship
    // armour is excluded: 241 records, a different shape, and counted with the hulls.
    const withoutIntegrity = ALL_MODULES.filter(
        (m) => m.integrity === undefined && m.ship === undefined,
    );
    assert.equal(withoutIntegrity.length, statsFixture.withoutIntegrity.count);
    assert.deepEqual(
        withoutIntegrity.map((m) => m.symbol).sort(),
        [...statsFixture.withoutIntegrity.symbols].sort(),
    );
});

test('stats spot checks: each merged record carries the expected stat values', () => {
    for (const expected of statsFixture.spot) {
        const record = getModuleBySymbol(expected.symbol, ALL_MODULES);
        assert.ok(record, `missing ${expected.symbol}`);
        assert.deepEqual(project(record, expected), expected);
    }
});

test('the verification audit accounts for every module and pins every corrected value', () => {
    const audit = statsFixture.inGameAudit;
    assert.equal(ALL_MODULES.length, audit.catalogueIdentities);
    assert.equal(audit.identityMatches + audit.registryOnlyIdentities, audit.catalogueIdentities);
    assert.equal(
        ALL_MODULES.filter((module) => module.ship !== undefined).length,
        audit.armourModulesOutsideNumericVerification,
    );
    assert.equal(
        audit.numericModulesVerified + audit.armourModulesOutsideNumericVerification,
        audit.identityMatches,
    );
    assert.equal(
        new Set([
            ...statsFixture.inGameVerifiedValues.map(({ symbol }) => symbol),
            ...statsFixture.inGameVerifiedAbsentFields.map(({ symbol }) => symbol),
        ]).size,
        audit.verifiedRecords,
    );
    assert.equal(
        statsFixture.inGameVerifiedValues.reduce(
            (count, expected) => count + Object.keys(expected).length - 1,
            0,
        ),
        audit.verifiedValueFields,
    );
    assert.equal(
        statsFixture.inGameVerifiedAbsentFields.reduce(
            (count, expected) => count + expected.fields.length,
            0,
        ),
        audit.verifiedAbsentFields,
    );
    assert.equal(audit.verifiedValueFields + audit.verifiedAbsentFields, audit.verifiedFields);
    for (const [field, expected] of Object.entries(audit.catalogueFieldCounts)) {
        assert.equal(
            ALL_MODULES.filter((module) => module[field as keyof OutfittingModule] !== undefined)
                .length,
            expected,
            field,
        );
    }
    for (const expected of statsFixture.inGameVerifiedValues) {
        const record = getModuleBySymbol(expected.symbol, ALL_MODULES);
        assert.ok(record, `missing ${expected.symbol}`);
        assert.deepEqual(project(record, expected), expected);
    }
    for (const expected of statsFixture.inGameVerifiedAbsentFields) {
        const record = getModuleBySymbol(expected.symbol, ALL_MODULES);
        assert.ok(record, `missing ${expected.symbol}`);
        for (const field of expected.fields) {
            assert.equal(
                record[field as keyof OutfittingModule],
                undefined,
                `${expected.symbol}.${field}`,
            );
        }
    }
});

test('the stats a blueprint needs are carried by every module of the family', () => {
    // A count here is a whole family, so a single record losing its value fails. These
    // are the base stats a recipe scales; without them a blueprint cannot be applied at
    // all.
    for (const [field, expected] of Object.entries(statsFixture.statCounts.counts)) {
        const carried = ALL_MODULES.filter(
            (module) => module[field as keyof OutfittingModule] !== undefined,
        );
        assert.equal(carried.length, expected, field);
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
    // Pin deliberate zeroes so an accidental one is visible. Ship-specific armour is
    // excluded because a stock bulkhead is genuinely free.
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

test('exactly five modules reserve themselves to one kind of mount', () => {
    // `restrictedToSlot` says a module fits *only* mounts carrying that restriction —
    // the narrow half of the rule, and wrong on any module the game sells for an
    // ordinary optional too (a plain cargo rack fits a `cargo` mount *and* every
    // unrestricted one). Pinned as a set, so widening it is a deliberate act.
    assert.deepEqual(
        ALL_MODULES.filter((m) => m.restrictedToSlot).map((m) => [m.symbol, m.restrictedToSlot]),
        [
            ['Int_PlanetApproachSuite', 'planetaryApproachSuite'],
            ['Int_PlanetApproachSuite_Advanced', 'planetaryApproachSuite'],
            ['Int_LargeCargoRack_Size7_Class1', 'cargo'],
            ['Int_LargeCargoRack_Size8_class1', 'cargo'],
            ['Int_MultiDroneControl_MiningV2_Size5_Class5', 'limpetController'],
        ],
    );
    // Every value names a restriction some hull's mount actually carries, or the module
    // would fit nowhere at all.
    const carried = new Set<string>(
        SHIPS.flatMap((s) => [
            ...(getShipSlots(s.symbol)?.optional ?? []),
            ...(getShipSlots(s.symbol)?.hardpoints ?? []),
        ])
            .map((mount) => mount.restriction)
            .filter((restriction) => restriction !== undefined),
    );
    for (const m of ALL_MODULES) {
        if (m.restrictedToSlot) {
            assert.ok(carried.has(m.restrictedToSlot), `${m.symbol}: no mount takes it`);
        }
    }
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

test("a weapon's conventional damage shares sum to one", () => {
    for (const weapon of HARDPOINT_MODULES) {
        const split = weapon.damageDistribution;
        if (!split) continue;
        const physical =
            (split.kinetic ?? 0) +
            (split.thermal ?? 0) +
            (split.explosive ?? 0) +
            (split.absolute ?? 0) +
            (split.unclassified ?? 0);
        assert.ok(Math.abs(physical - 1) < 1e-9, `${weapon.symbol}: ${String(physical)}`);
    }
});

test('verified damage components reproduce scalar damage and their compatibility projection', () => {
    let checked = 0;
    for (const weapon of HARDPOINT_MODULES) {
        const components = weapon.damageComponents;
        if (!components) continue;
        checked += 1;
        const unclassified = (components.unclassified ?? []).reduce((sum, value) => sum + value, 0);
        const conventional =
            (components.kinetic ?? 0) +
            (components.thermal ?? 0) +
            (components.explosive ?? 0) +
            (components.absolute ?? 0) +
            unclassified;
        assert.equal(weapon.damage, conventional, weapon.symbol);
        assert.ok(weapon.damageDistribution, weapon.symbol);
        for (const type of ['kinetic', 'thermal', 'explosive', 'absolute'] as const) {
            assert.ok(
                Math.abs(
                    (weapon.damageDistribution[type] ?? 0) * conventional - (components[type] ?? 0),
                ) < 1e-9,
                `${weapon.symbol}.${type}`,
            );
        }
        assert.ok(
            Math.abs((weapon.damageDistribution.unclassified ?? 0) * conventional - unclassified) <
                1e-9,
            `${weapon.symbol}.unclassified`,
        );
        assert.ok(
            Math.abs(
                (weapon.damageDistribution.antiXeno ?? 0) * conventional -
                    (components.antiXeno ?? 0),
            ) < 1e-9,
            weapon.symbol,
        );
    }
    assert.equal(checked, 34);
});

test('projectile boundary parameters appear on exactly the ten verified hardpoints', () => {
    assert.equal(
        HARDPOINT_MODULES.filter((module) => module.projectileRange !== undefined).length,
        10,
    );
});

test("every weapon's carried rate of fire agrees with its own firing cycle", () => {
    // `rateOfFire` is derived from the interval and burst pattern at acquisition time;
    // charge time delays impact but is not part of Frontier's reported cadence.
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
    // One record from each of the four categories resolves without naming its
    // catalogue (`all` is excluded — its first record is CORE_MODULES[0]).
    for (const category of ['core', 'internal', 'hardpoint', 'utility'] as const) {
        const first = CATALOGUES[category]![0]!;
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
