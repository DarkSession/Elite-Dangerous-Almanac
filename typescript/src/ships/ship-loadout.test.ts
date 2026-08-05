import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ShipLoadout } from './ship-loadout.js';
import type { LoadoutEvent } from './slef.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import { CORE_MODULES } from './modules-core.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import { UTILITY_MODULES } from './modules-utility.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.json' with { type: 'json' };
import expected from '../../../fixtures/ships/jump-range.json' with { type: 'json' };
import metrics from '../../../fixtures/ships/build-metrics.json' with { type: 'json' };
import slotsFixture from '../../../fixtures/ships/ship-slots.json' with { type: 'json' };
import { ALL_MODULES } from './modules-all.js';
import type { DamageTypeValues } from './resistances.js';
import { damageFalloff } from './weapons.js';
import { getPreEngineeredVariants } from './pre-engineered.js';
import { getPreEngineeredStats } from './pre-engineered-stats.js';
import { isStatUnknown } from './unknown-stats.js';

const mod = (symbol: string, catalogue = CORE_MODULES) => getModuleBySymbol(symbol, catalogue)!;

const slefString = JSON.stringify(slefFixture);
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;
/** Per-damage-type figures rounded to the six decimals the shared fixture stores. */
const rounded = (r: DamageTypeValues) => ({
    kinetic: Math.round(r.kinetic * 1e6) / 1e6,
    thermal: Math.round(r.thermal * 1e6) / 1e6,
    explosive: Math.round(r.explosive * 1e6) / 1e6,
    caustic: Math.round(r.caustic * 1e6) / 1e6,
});

test('fromSlef reads the ship identity and top-level figures', () => {
    const build = ShipLoadout.fromSlef(slefString);
    assert.equal(build.shipSymbol, 'explorer_nx');
    assert.equal(build.shipName, 'The Deep Black');
    assert.equal(build.shipIdent, 'ISAR');
    assert.equal(build.unladenMass, 1237.3);
    assert.deepEqual(build.fuelCapacity, { main: 128, reserve: 1.14 });
    assert.equal(build.cargoCapacity, 16);
    assert.equal(build.hullValue, 189326510);
    assert.equal(build.modules.length, slefFixture[0]!.data.Modules.length);
});

test('maxJumpRange reproduces the EDSY-exported MaxJumpRange', () => {
    const build = ShipLoadout.fromSlef(slefString);
    assert.ok(
        near(build.maxJumpRange(), expected.edsyMaxJumpRange, 5e-2),
        `got ${build.maxJumpRange()}`,
    );
});

test('the resolved frame shift drive folds in engineering and the booster', () => {
    const fsd = ShipLoadout.fromSlef(slefString).frameShiftDrive;
    assert.equal(fsd.optMass, expected.frameShiftDrive.optMass); // FSDOptimalMass modifier
    assert.equal(fsd.maxFuel, expected.frameShiftDrive.maxFuel);
    assert.equal(fsd.jumpBoost, expected.frameShiftDrive.jumpBoost); // Guardian booster size 5
});

test('unladen / laden / total range and per-jump fuel match the fixture', () => {
    const build = ShipLoadout.fromSlef(slefString);
    assert.ok(
        near(build.unladenJumpRange(), expected.unladenJumpRange),
        `unladen ${build.unladenJumpRange()}`,
    );
    assert.ok(
        near(build.ladenJumpRange(), expected.ladenJumpRange),
        `laden ${build.ladenJumpRange()}`,
    );
    assert.ok(near(build.totalRange(), expected.totalRange, 1e-2), `total ${build.totalRange()}`);
    assert.ok(
        near(build.fuelPerJump(50), expected.fuelPerJump50Ly),
        `fuel50 ${build.fuelPerJump(50)}`,
    );
});

test('jumpRange honours explicit fuel and cargo', () => {
    const build = ShipLoadout.fromSlef(slefString);
    // full main tank, no cargo == unladenJumpRange
    assert.ok(near(build.jumpRange({ fuel: 128, cargo: 0 }), build.unladenJumpRange()));
    // more cargo -> shorter jump
    assert.ok(build.jumpRange({ cargo: 100 }) < build.jumpRange({ cargo: 0 }));
});

test('fromLoadout works on a bare journal event', () => {
    const build = ShipLoadout.fromLoadout(slefFixture[0]!.data as unknown as LoadoutEvent);
    assert.equal(build.shipSymbol, 'explorer_nx');
    assert.ok(near(build.maxJumpRange(), expected.edsyMaxJumpRange, 5e-2));
});

test('loadout inputs and returned raw records cannot mutate internal state', () => {
    const source = {
        Ship: 'anaconda',
        UnladenMass: 500,
        Modules: [
            {
                Slot: 'FrameShiftDrive',
                Item: 'Int_Hyperdrive_Size6_Class5',
                Engineering: {
                    BlueprintName: 'FSD_LongRange',
                    Level: 1,
                    Quality: 1,
                    Modifiers: [{ Label: 'FSDOptimalMass', Value: 1980, OriginalValue: 1800 }],
                },
            },
        ],
    };
    const build = ShipLoadout.fromLoadout(source);

    source.Modules[0]!.Item = 'int_hyperdrive_size99_class9_madeup';
    source.Modules[0]!.Engineering.Modifiers[0]!.Value = 1;
    assert.equal(build.moduleAt('FrameShiftDrive')?.Item, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(build.frameShiftDrive.optMass, 1980);

    const exposed = build.moduleAt('FrameShiftDrive') as unknown as {
        Item: string;
        Engineering?: { Modifiers: { Value?: number }[] };
    };
    exposed.Item = 'int_hyperdrive_size99_class9_madeup';
    exposed.Engineering!.Modifiers[0]!.Value = 2;
    assert.equal(build.moduleAt('FrameShiftDrive')?.Item, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(build.frameShiftDrive.optMass, 1980);

    const listed = build.modules[0] as { Item: string };
    listed.Item = 'another_fake_module';
    assert.equal(build.moduleAt('FrameShiftDrive')?.Item, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(build.unladenMass, 500);
});

test('editing a SLEF build keeps imported aggregate figures coherent', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const originalMass = build.unladenMass!;

    // Replacing the engineered FSD with its stock registry entry removes the
    // engineering mass increase from the imported UnladenMass.
    build.setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Overcharge_Size8_Class5_OverchargeBooster_MkII'),
    );
    assert.equal(build.unladenMass, originalMass - 48);

    build.removeModule('FuelTank');
    build.removeModule('Slot09_Size4');
    assert.deepEqual(build.fuelCapacity, { main: 0, reserve: 1.14 });
    assert.equal(build.cargoCapacity, 0);
    assert.equal(build.modulesValue, null);
    assert.equal(build.rebuy, null);
});

test('an unpowered Guardian booster contributes no jump bonus', () => {
    const withBooster = ShipLoadout.fromSlef(slefString).frameShiftDrive.jumpBoost;
    const off: LoadoutEvent = {
        ...(slefFixture[0]!.data as unknown as LoadoutEvent),
        Modules: slefFixture[0]!.data.Modules.map((m) =>
            m.Item === 'int_guardianfsdbooster_size5' ? { ...m, On: false } : m,
        ),
    };
    assert.equal(withBooster, 10.5);
    assert.equal(ShipLoadout.fromLoadout(off).frameShiftDrive.jumpBoost, 0);
});

test('a build with no frame shift drive throws on a jump calculation', () => {
    const noFsd: LoadoutEvent = {
        Ship: 'sidewinder',
        UnladenMass: 50,
        Modules: [{ Slot: 'CargoHatch', Item: 'modularcargobaydoor' }],
    };
    assert.throws(() => ShipLoadout.fromLoadout(noFsd).maxJumpRange(), /no frame shift drive/);
});

test('a fitted drive with no stats-catalogue constants throws a distinct error', () => {
    const unknownFsd: LoadoutEvent = {
        Ship: 'sidewinder',
        UnladenMass: 50,
        Modules: [{ Slot: 'FrameShiftDrive', Item: 'int_hyperdrive_size99_class9_madeup' }],
    };
    assert.throws(() => ShipLoadout.fromLoadout(unknownFsd).frameShiftDrive, /no jump constants/);
});

test('fromSlef throws when the entry index is out of range', () => {
    assert.throws(() => ShipLoadout.fromSlef(slefString, 5), TypeError);
});

test('a build missing UnladenMass throws on a mass-dependent calculation', () => {
    const noMass: LoadoutEvent = {
        Ship: 'sidewinder',
        Modules: [{ Slot: 'FrameShiftDrive', Item: 'int_hyperdrive_size2_class1' }],
    };
    // sidewinder IS in the stats catalogue, so mass is computed, not null.
    assert.ok(ShipLoadout.fromLoadout(noMass).unladenMass! > 0);

    const unknownHull: LoadoutEvent = { Ship: 'not_a_real_hull', Modules: [] };
    assert.equal(ShipLoadout.fromLoadout(unknownHull).unladenMass, null);
});

test('fallback mass resolves bulkheads and rejects unknown module masses', () => {
    const reactive: LoadoutEvent = {
        Ship: 'anaconda',
        Modules: [{ Slot: 'Armour', Item: 'anaconda_armour_reactive' }],
    };
    assert.equal(ShipLoadout.fromLoadout(reactive).unladenMass, 460);

    const unresolved: LoadoutEvent = {
        Ship: 'anaconda',
        Modules: [{ Slot: 'Slot01_Size7', Item: 'int_future_module_without_stats' }],
    };
    assert.equal(ShipLoadout.fromLoadout(unresolved).unladenMass, null);
});

// ── Build editor ────────────────────────────────────────────────────────────

test("empty starts a hull with no modules and the hull's declared slots", () => {
    const conda = ShipLoadout.empty('Anaconda');
    assert.equal(conda.shipSymbol, 'Anaconda');
    assert.equal(conda.modules.length, 0);
    assert.equal(conda.slotsOfKind('hardpoint').length, 8);
    assert.equal(conda.slotsOfKind('utility').length, 8);
    assert.equal(conda.slotsOfKind('core').length, 7);
    assert.equal(conda.slotsOfKind('optional').length, 14);
    assert.ok(conda.slots().every((s) => !s.occupied));
});

test('empty rejects a hull with no known layout', () => {
    assert.throws(() => ShipLoadout.empty('not_a_real_hull'), TypeError);
});

test('empty case-normalises the hull symbol to its registry form', () => {
    assert.equal(ShipLoadout.empty('anaconda').shipSymbol, 'Anaconda');
});

test('setModule fits a module and slots() reflects occupancy', () => {
    const build = ShipLoadout.empty('Sidewinder');
    build.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size2_Class5'));
    const fsdSlot = build.slots().find((s) => s.key === 'FrameShiftDrive');
    assert.equal(fsdSlot?.occupied, true);
    assert.equal(fsdSlot?.module?.Item, 'Int_Hyperdrive_Size2_Class5');
    assert.equal(build.getFittedModule('FrameShiftDrive')?.Item, 'Int_Hyperdrive_Size2_Class5');
    assert.equal(build.modules.length, 1);
});

test('setModule chains and removeModule clears', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .setModule('Slot01_Size7', mod('Int_FuelTank_Size6_Class3'));
    assert.equal(build.modules.length, 2);
    build.removeModule('Slot01_Size7');
    assert.equal(build.getFittedModule('Slot01_Size7'), null);
    assert.equal(build.modules.length, 1);
    // removing an empty slot is a no-op
    assert.doesNotThrow(() => build.removeModule('Slot02_Size6'));
});

test('an assembled explorer build computes a sane jump range', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .setModule('Slot01_Size7', mod('Int_FuelTank_Size5_Class3'))
        .setModule('Slot02_Size6', mod('Int_GuardianFSDBooster_Size5', INTERNAL_MODULES));
    // Unladen mass = Anaconda hull (400) + FSD + tank + booster masses — well over the hull alone.
    assert.ok(build.unladenMass! > 400);
    // A stock class-5 size-6 drive with a +10.5 booster on an Anaconda-mass hull:
    // a positive, believable single-jump range.
    const range = build.maxJumpRange();
    assert.ok(range > 10 && range < 80, `got ${range}`);
    assert.ok(build.frameShiftDrive.jumpBoost === 10.5);
});

test('setModule rejects the wrong module kind, oversize, and hull-restricted fits', () => {
    const conda = ShipLoadout.empty('Anaconda');
    // A weapon into the FSD core slot
    assert.throws(
        () =>
            conda.setModule(
                'FrameShiftDrive',
                mod('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES),
            ),
        /not a frameShiftDrive module/,
    );
    // Too large for the slot (size-8 drive into a size-6 slot)
    assert.throws(
        () => conda.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size8_Class5')),
        /exceeds slot size/,
    );
    // Unknown slot key
    assert.throws(
        () => conda.setModule('NoSuchSlot', mod('Int_Hyperdrive_Size6_Class5')),
        RangeError,
    );
    // A module restricted to another hull (MkII Gravity Optimised thrusters → Explorer_NX)
    assert.throws(
        () => conda.setModule('MainEngines', mod('Int_Engine_Size7_Class5_GravityOptimised_MkII')),
        /restricted to Caspian Explorer \(Explorer_NX\)/,
    );
});

test('Guardian core modules fit their core slot and are barred from optional slots', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const gPlant = mod('Int_GuardianPowerplant_Size6', INTERNAL_MODULES);
    const gDist = mod('Int_GuardianPowerDistributor_Size6', INTERNAL_MODULES);
    // Core slots accept them (they are core modules despite the `internal` category).
    assert.doesNotThrow(() => conda.setModule('PowerPlant', gPlant));
    assert.doesNotThrow(() => conda.setModule('PowerDistributor', gDist));
    // Optional slots reject them.
    assert.throws(() => conda.setModule('Slot02_Size6', gPlant), /core module only fits/);
    assert.throws(() => conda.setModule('Slot03_Size6', gDist), /core module only fits/);
    // ...but a fuel tank (also core-prefixed) still fits an optional slot.
    assert.doesNotThrow(() => conda.setModule('Slot05_Size5', mod('Int_FuelTank_Size5_Class3')));
});

test('a military slot only takes military-eligible modules', () => {
    const conda = ShipLoadout.empty('Anaconda');
    // A hull reinforcement package is military-eligible.
    assert.doesNotThrow(() =>
        conda.setModule('Military01', mod('Int_HullReinforcement_Size5_Class2', INTERNAL_MODULES)),
    );
    // A fuel scoop is not.
    const scoop = getModuleBySymbol('Int_FuelScoop_Size5_Class5', INTERNAL_MODULES);
    if (scoop) {
        assert.throws(
            () => conda.setModule('Military01', scoop),
            /only takes reinforcement packages and shield cell banks/,
        );
    }
});

test("the Type-11's mining hardpoints only take mining tools", () => {
    const miner = ShipLoadout.empty('LakonMiner');
    // Every mining family the mounts accept, at a size each mount can hold.
    for (const symbol of [
        'Hpt_MiningToolV2_Fixed_Large',
        'Hpt_MiningLaser_Fixed_Small_Advanced',
        'Hpt_Mining_AbrBlstr_Fixed_Small',
        'Hpt_Mining_SubSurfDispMisle_Fixed_Small',
    ]) {
        assert.doesNotThrow(
            () => miner.setModule('LargeMiningHardpoint1', mod(symbol, HARDPOINT_MODULES)),
            symbol,
        );
    }
    // An ordinary weapon of the right size is turned away.
    const plasma = mod('Hpt_PlasmaAccelerator_Fixed_Large', HARDPOINT_MODULES);
    assert.throws(
        () => miner.setModule('LargeMiningHardpoint1', plasma),
        /only takes mining tools/,
    );
    // ...and fits the unrestricted mounts, which take mining tools too.
    const cannon = mod('Hpt_MultiCannon_Fixed_Medium', HARDPOINT_MODULES);
    assert.doesNotThrow(() => miner.setModule('MediumHardpoint3', cannon));
    assert.doesNotThrow(() =>
        miner.setModule('MediumHardpoint3', mod('Hpt_MiningLaser_Fixed_Medium', HARDPOINT_MODULES)),
    );
    // The mounts are listable, so an outfitting UI can answer "what fits here?".
    const forMining = miner.modulesForSlot('MediumMiningHardpoint1', HARDPOINT_MODULES);
    assert.ok(forMining.length > 0);
    assert.ok(
        forMining.every((m) => /^hpt_(mining|human_extraction)/.test(m.symbol.toLowerCase())),
        forMining.map((m) => m.symbol).join(', '),
    );
});

test('the restricted optionals take their own family and nothing else', () => {
    const miner = ShipLoadout.empty('LakonMiner');
    assert.doesNotThrow(() =>
        miner.setModule(
            'LimpetController01',
            mod('Int_MultiDroneControl_MiningV2_Size5_Class5', INTERNAL_MODULES),
        ),
    );
    assert.doesNotThrow(() =>
        miner.setModule('FighterBay01', mod('Int_FighterBay_Size5_Class1', INTERNAL_MODULES)),
    );
    const rack = mod('Int_CargoRack_Size5_Class1', INTERNAL_MODULES);
    assert.throws(() => miner.setModule('LimpetController01', rack), /only takes limpet/);
    assert.throws(() => miner.setModule('FighterBay01', rack), /only takes vessel hangars/);

    const panther = ShipLoadout.empty('PantherMkII');
    assert.doesNotThrow(() =>
        panther.setModule('Cargo01', mod('Int_LargeCargoRack_Size8_class1', INTERNAL_MODULES)),
    );
    // A fuel tank counts as cargo here, as it does in every optional slot.
    assert.doesNotThrow(() => panther.setModule('Cargo02', mod('Int_FuelTank_Size7_Class3')));
    const shield = mod('Int_ShieldGenerator_Size8_Class3', INTERNAL_MODULES);
    assert.throws(() => panther.setModule('Cargo01', shield), /only takes cargo racks/);
});

test('the Mk II Vessel Hangars fit only the three hulls that carry them', () => {
    const bay = mod('Int_FighterBayMk2_Size5_Class1', INTERNAL_MODULES);
    assert.doesNotThrow(() => ShipLoadout.empty('LakonMiner').setModule('FighterBay01', bay));
    assert.doesNotThrow(() => ShipLoadout.empty('Explorer_NX').setModule('Slot04_Size5', bay));
    assert.doesNotThrow(() => ShipLoadout.empty('PantherMkII').setModule('Slot06_Size5', bay));
    assert.throws(
        () => ShipLoadout.empty('Anaconda').setModule('Slot05_Size5', bay),
        /restricted to Caspian Explorer \(Explorer_NX\), Panther Clipper MkII \(PantherMkII\), Type-11 Prospector \(LakonMiner\)/,
    );
});

test('every restricted mount accepts and refuses what the fixture pins', () => {
    // The rule is a fact about the game, not about TypeScript, so which module
    // families each restriction takes is pinned language-neutrally rather than left
    // to the prefix lists in this file.
    for (const rule of slotsFixture.restrictions) {
        const build = ShipLoadout.empty(rule.ship);
        const slot = build.slots().find((s) => s.key === rule.slot);
        assert.ok(slot, `${rule.ship} has no slot ${rule.slot}`);
        assert.equal(slot.restriction ?? null, rule.restriction, `${rule.slot} restriction`);
        // `assert.throws(fn, string)` treats the string as a *message*, so a typo in a
        // `rejects` symbol would pass on the undefined-module error instead. Resolve
        // every symbol first, so a fixture typo fails loudly rather than silently
        // retiring the case it was meant to test.
        for (const symbol of [...rule.accepts, ...rule.rejects]) {
            assert.ok(getModuleBySymbol(symbol, ALL_MODULES), `no module "${symbol}"`);
        }
        for (const symbol of rule.accepts) {
            assert.doesNotThrow(
                () => build.setModule(rule.slot, mod(symbol, ALL_MODULES)),
                `${rule.slot} should accept ${symbol}`,
            );
        }
        for (const symbol of rule.rejects) {
            assert.throws(
                () => build.setModule(rule.slot, mod(symbol, ALL_MODULES)),
                `${rule.slot} should reject ${symbol}`,
            );
        }
        // `modulesForSlot` and `setModule` must agree, or an outfitting UI offers a
        // module the fit check then refuses.
        const offered = new Set(build.modulesForSlot(rule.slot, ALL_MODULES).map((m) => m.symbol));
        for (const symbol of rule.accepts) assert.ok(offered.has(symbol), `not offered: ${symbol}`);
        for (const symbol of rule.rejects) assert.ok(!offered.has(symbol), `offered: ${symbol}`);
    }
});

test('a restricted mount reports a human-readable name', () => {
    const miner = ShipLoadout.empty('LakonMiner');
    const named = (key: string) => miner.slots().find((s) => s.key === key)?.name;
    assert.equal(named('LargeMiningHardpoint1'), 'Large Mining Hardpoint 1');
    assert.equal(named('MediumHardpoint3'), 'Medium Hardpoint 3');
    assert.equal(named('LimpetController01'), 'Limpet Controller Slot 1');
    assert.equal(named('FighterBay01'), 'Vessel Hangar Slot 1');
    const panther = ShipLoadout.empty('PantherMkII');
    assert.equal(panther.slots().find((s) => s.key === 'Cargo02')?.name, 'Cargo Slot 2');
    // The military and approach-suite labels went through the same rewrite.
    const conda = ShipLoadout.empty('Anaconda');
    const condaName = (key: string) => conda.slots().find((s) => s.key === key)?.name;
    assert.equal(condaName('Military01'), 'Military Slot 1');
    assert.equal(condaName('PlanetaryApproachSuite'), 'Planetary Approach Suite');
    assert.equal(condaName('HugeHardpoint1'), 'Huge Hardpoint 1');
});

test('setModule throws a clear error when handed an undefined module', () => {
    const conda = ShipLoadout.empty('Anaconda');
    // The classic `getModuleBySymbol('typo', CAT)!` miss.
    assert.throws(
        () => conda.setModule('FrameShiftDrive', undefined as unknown as OutfittingModule),
        /no module supplied/,
    );
});

test('modulesForSlot lists only fitting modules', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const drives = conda.modulesForSlot('FrameShiftDrive', CORE_MODULES);
    assert.ok(drives.length > 0);
    assert.ok(drives.every((m) => m.symbol.toLowerCase().startsWith('int_hyperdrive')));
    assert.ok(drives.every((m) => m.class <= 6));
    assert.throws(() => conda.modulesForSlot('NoSuchSlot', CORE_MODULES), RangeError);
});

test('fit checks use restrictions carried by caller-supplied module records', () => {
    const restricted: OutfittingModule = {
        symbol: 'CustomRestrictedLaser',
        category: 'hardpoint',
        name: 'Custom Restricted Laser',
        class: 1,
        rating: 'A',
        restrictedToShips: ['Explorer_NX'],
    };
    assert.throws(
        () => ShipLoadout.empty('SideWinder').setModule('SmallHardpoint1', restricted),
        /restricted to Caspian Explorer \(Explorer_NX\)/,
    );
});

test('armour is hull-specific while the cargo hatch remains fixed', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const armour = conda.modulesForSlot('Armour', CORE_MODULES);
    assert.equal(armour.length, 5);
    assert.ok(armour.every((module) => module.ship === 'Anaconda'));
    conda.setModule(
        'Armour',
        armour.find((module) => module.symbol.endsWith('_Grade2'))!,
    );
    assert.equal(conda.getFittedModule('Armour')?.Item, 'Anaconda_Armour_Grade2');
    assert.throws(
        () =>
            conda.setModule('Armour', getModuleBySymbol('SideWinder_Armour_Grade2', CORE_MODULES)!),
        /belongs to Sidewinder, not Anaconda/,
    );
    assert.throws(
        () => conda.setModule('CargoHatch', mod('Int_Hyperdrive_Size6_Class5')),
        /cargoHatch slot cannot be changed/,
    );

    const imported = ShipLoadout.fromSlef(slefString);
    const cargoHatch = imported.moduleAt('CargoHatch');
    assert.ok(cargoHatch);
    assert.throws(() => imported.removeModule('CargoHatch'), /cargoHatch slot cannot be changed/);
    assert.deepEqual(imported.moduleAt('CargoHatch'), cargoHatch);
    assert.throws(
        () =>
            imported
                .slots()
                .find((slot) => slot.key === 'CargoHatch')!
                .clear(),
        /cargoHatch slot cannot be changed/,
    );
    assert.deepEqual(imported.moduleAt('CargoHatch'), cargoHatch);
    assert.throws(
        () => imported.getFittedModule('CargoHatch')!.remove(),
        /cargoHatch slot cannot be changed/,
    );
    assert.deepEqual(imported.moduleAt('CargoHatch'), cargoHatch);
});

// ── Engineering ─────────────────────────────────────────────────────────────

test('applyBlueprint reproduces the Deep Black FSD modifiers and lifts jump range', () => {
    const build = ShipLoadout.empty('Explorer_NX').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Overcharge_Size8_Class5_OverchargeBooster_MkII'),
    );
    const before = build.frameShiftDrive.optMass;
    assert.equal(before, 4670); // base optimal mass

    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
        grade: 5,
        quality: 1,
        experimental: 'special_fsd_heavy',
    });

    // The exact figures the real Deep Black export carries.
    const fsd = build.frameShiftDrive;
    assert.ok(Math.abs(fsd.optMass - 7528.04) < 1e-2, `optMass ${fsd.optMass}`);
    const engineered = build.getFittedModule('FrameShiftDrive')!.Engineering!;
    assert.equal(engineered.BlueprintName, 'FSD_LongRange');
    assert.equal(engineered.Level, 5);
    assert.equal(engineered.ExperimentalEffect, 'special_fsd_heavy');
    const massMod = engineered.Modifiers!.find((m) => m.Label === 'Mass');
    assert.equal(massMod?.Value, 208);
});

test('assembled builds include engineered cargo capacity in their aggregates', () => {
    const rack = mod('Int_CargoRack_Size5_Class1', INTERNAL_MODULES);
    const build = ShipLoadout.empty('Anaconda').setModule('Slot05_Size5', rack);
    assert.equal(build.cargoCapacity, 32);

    build.applyBlueprint('Slot05_Size5', 'CargoRack_IncreasedCapacity', { grade: 5 });
    assert.equal(build.cargoCapacity, 43.008);
    assert.equal(
        build
            .moduleAt('Slot05_Size5')
            ?.Engineering?.Modifiers?.find((modifier) => modifier.Label === 'CargoCapacity')?.Value,
        43.008,
    );
});

test('applyBlueprint validates the slot, blueprint and experimental', () => {
    const build = ShipLoadout.empty('Anaconda');
    // empty slot
    assert.throws(
        () => build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 }),
        RangeError,
    );
    build.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'));
    // unknown blueprint / grade
    assert.throws(() => build.applyBlueprint('FrameShiftDrive', 'Nope', { grade: 5 }), RangeError);
    assert.throws(
        () => build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 9 }),
        RangeError,
    );
    // unknown experimental
    assert.throws(
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
                grade: 5,
                experimental: 'special_nope',
            }),
        RangeError,
    );
    assert.throws(
        () => build.applyBlueprint('FrameShiftDrive', 'Armour_HeavyDuty', { grade: 5 }),
        /targets armour, not frameShiftDrive/,
    );
    assert.throws(
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
                grade: 5,
                experimental: 'special_shieldbooster_toughened',
            }),
        /targets shieldBooster, not frameShiftDrive/,
    );
    assert.throws(
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
                grade: 5,
                quality: 99,
            }),
        /quality/,
    );
});

test('weapon and armour recipes engineer the stats the catalogue carries', () => {
    const weapon = ShipLoadout.empty('Sidewinder').setModule(
        'SmallHardpoint1',
        mod('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES),
    );
    const fittedWeapon = weapon.getFittedModule('SmallHardpoint1')!;
    assert.ok(
        fittedWeapon
            .getAvailableBlueprints()
            .some((blueprint) => blueprint.fdname === 'Weapon_Overcharged'),
    );
    weapon.applyBlueprint('SmallHardpoint1', 'Weapon_Overcharged', { grade: 5 });
    const overcharged = weapon.getFittedModule('SmallHardpoint1')!.Engineering!.Modifiers!;
    const damage = overcharged.find((m) => m.Label === 'Damage')!;
    assert.ok(damage.Value! > damage.OriginalValue!, 'Overcharged raises damage');

    // Armour's hull boost is a per-hull stat on the armour module, so Heavy Duty
    // resolves against it.
    const conda = ShipLoadout.empty('Anaconda').setModule('Armour', mod('Anaconda_Armour_Grade3'));
    conda.applyBlueprint('Armour', 'Armour_HeavyDuty', { grade: 5 });
    const boost = conda
        .getFittedModule('Armour')!
        .Engineering!.Modifiers!.find((m) => m.Label === 'DefenceModifierHealthMultiplier')!;
    // The journal reports hull boost as a percentage, and it compounds on the armour
    // multiplier: a 250% bulkhead (x3.5 armour) at a full grade-5 roll (+32%) becomes
    // x4.62, i.e. 362%.
    assert.equal(boost.OriginalValue, 250);
    assert.equal(boost.Value, 362);
});

test('engineering rejects recipes whose base stats are not carried', () => {
    // A hull reinforcement package has no base hull boost — in game the modifier *is*
    // the bonus — so the Advanced recipe cannot be computed and says so rather than
    // quietly resolving it to nothing.
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_HullReinforcement_Size5_Class2', INTERNAL_MODULES),
    );
    const fitted = build.getFittedModule('Slot01_Size7')!;
    assert.ok(
        !fitted
            .getAvailableBlueprints()
            .some((blueprint) => blueprint.fdname === 'HullReinforcement_Advanced'),
    );
    assert.throws(
        () => build.applyBlueprint('Slot01_Size7', 'HullReinforcement_Advanced', { grade: 5 }),
        /missing base stats for DefenceModifierHealthMultiplier/,
    );
    // The Heavy Duty recipe, which only touches carried stats, still works.
    build.applyBlueprint('Slot01_Size7', 'HullReinforcement_HeavyDuty', { grade: 5 });
    const added = build
        .getFittedModule('Slot01_Size7')!
        .Engineering!.Modifiers!.find((m) => m.Label === 'DefenceModifierHealthAddition')!;
    assert.ok(added.Value! > added.OriginalValue!);
});

test('clearEngineering restores base stats', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
    const engineered = build.frameShiftDrive.optMass;
    build.clearEngineering('FrameShiftDrive');
    assert.equal(build.getFittedModule('FrameShiftDrive')?.Engineering, undefined);
    assert.ok(build.frameShiftDrive.optMass < engineered); // back to base 1800
    assert.equal(build.frameShiftDrive.optMass, 1800);
});

test('resolved pre-engineered stats survive fitting and drive build calculations', () => {
    const variant = getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5').find(
        (candidate) => candidate.blueprint === 'FSD_LongRange',
    )!;
    const resolved = getPreEngineeredStats(variant)!;
    assert.equal(resolved.mass, 26);
    assert.equal(resolved.optMass, 1785);

    const build = ShipLoadout.empty('Anaconda').setModule('FrameShiftDrive', resolved);
    const fitted = build.getFittedModule('FrameShiftDrive')!;
    assert.equal(fitted.stats?.mass, 26);
    assert.equal(fitted.effectiveStats?.optMass, 1785);
    assert.equal(build.unladenMass, 426); // 400 t hull + the fitted 26 t V1 drive
    assert.equal(build.frameShiftDrive.optMass, 1785);

    // Fitting snapshots the supplied record; later caller mutation cannot change a build.
    (resolved as { mass?: number }).mass = 999;
    assert.equal(build.unladenMass, 426);
});

// ── Fluent slot + fitted-module handles ─────────────────────────────────────

test('coreModules / hardpoints / utilityMounts / optionalModules list the mounts', () => {
    const conda = ShipLoadout.empty('Anaconda');
    assert.equal(conda.coreModules().length, 7);
    assert.equal(conda.hardpoints().length, 8);
    assert.equal(conda.utilityMounts().length, 8);
    assert.equal(conda.optionalModules().length, 14);
    // Each carries a human-readable name and the right kind.
    assert.ok(conda.coreModules().every((s) => s.kind === 'core' && s.name.length > 0));
    const fsd = conda.coreModules().find((s) => s.core === 'frameShiftDrive');
    assert.equal(fsd?.name, 'Frame Shift Drive');
    assert.equal(fsd?.key, 'FrameShiftDrive');
    assert.equal(conda.hardpoints()[0]?.name, 'Huge Hardpoint 1');
    assert.equal(conda.utilityMounts()[0]?.name, 'Utility Mount 1');
});

test('a slot handle is a live view and fits/lists/clears without repeating its key', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const [drive] = conda.coreModules().filter((s) => s.core === 'frameShiftDrive');
    assert.ok(drive);
    assert.equal(drive.occupied, false);
    assert.equal(drive.module === null, true);

    // modulesForSlot needs no slot key now.
    const drives = drive.modulesForSlot(CORE_MODULES);
    assert.ok(drives.length > 0 && drives.every((m) => m.class <= 6));

    // fit() returns a live FittedModule handle; the slot view updates in place.
    const fitted = drive.fit(mod('Int_Hyperdrive_Size6_Class5'));
    assert.equal(drive.occupied, true);
    assert.equal(drive.module !== null && drive.module.Item, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(fitted.Item, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(fitted.slot, 'FrameShiftDrive');

    drive.clear();
    assert.equal(drive.occupied, false);
    assert.equal(conda.modules.length, 0);
});

test('applyBlueprint / clearEngineering work straight on the fitted module', () => {
    const build = ShipLoadout.empty('Explorer_NX');
    const fsd = build
        .coreModules()
        .find((s) => s.core === 'frameShiftDrive')!
        .fit(mod('Int_Hyperdrive_Overcharge_Size8_Class5_OverchargeBooster_MkII'));

    fsd.applyBlueprint('FSD_LongRange', {
        grade: 5,
        quality: 1,
        experimental: 'special_fsd_heavy',
    });
    assert.ok(Math.abs(build.frameShiftDrive.optMass - 7528.04) < 1e-2);
    assert.equal(fsd.Engineering?.BlueprintName, 'FSD_LongRange');

    fsd.clearEngineering();
    assert.equal(fsd.Engineering, undefined);
    assert.equal(build.frameShiftDrive.optMass, 4670); // base
});

test('getAvailableBlueprints / getAvailableExperimentalEffects match the module family', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const fsd = build.getFittedModule('FrameShiftDrive')!;

    const blueprints = fsd.getAvailableBlueprints();
    const longRange = blueprints.find((b) => b.fdname === 'FSD_LongRange');
    assert.ok(longRange, 'FSD_LongRange should be offered on an FSD');
    assert.deepEqual([...longRange!.grades], [1, 2, 3, 4, 5]);
    // No armour recipe leaks onto a frame shift drive.
    assert.ok(!blueprints.some((b) => b.fdname.toLowerCase().startsWith('armour_')));

    const experimentals = fsd.getAvailableExperimentalEffects();
    assert.ok(experimentals.includes('special_fsd_heavy'));
    assert.ok(!experimentals.includes('special_shieldbooster_toughened'));
});

test('getFittedModule returns null for an empty slot and a live handle otherwise', () => {
    const build = ShipLoadout.empty('Anaconda');
    assert.equal(build.getFittedModule('FrameShiftDrive'), null);
    build.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'));
    const handle = build.getFittedModule('FrameShiftDrive')!;
    handle.remove();
    assert.equal(build.getFittedModule('FrameShiftDrive'), null);
    // Reading a removed handle's live fields throws rather than lying.
    assert.throws(() => handle.Item, /no longer contains/);
});

test('a fitted-module handle cannot operate on a replacement module', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const oldHandle = build.getFittedModule('FrameShiftDrive')!;
    build.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size5_Class5'));
    assert.throws(() => oldHandle.Item, /no longer contains/);
    assert.throws(
        () => oldHandle.applyBlueprint('FSD_LongRange', { grade: 5 }),
        /no longer contains/,
    );
});

// ── Build metrics: power, shields, armour, weapons ───────────────────────────

/** The fixture's Anaconda, assembled from the catalogues. */
function fixtureAnaconda(): ShipLoadout {
    const build = ShipLoadout.empty('Anaconda');
    for (const [slot, symbol] of Object.entries(metrics.anaconda.modules)) {
        build.setModule(slot, getModuleBySymbol(symbol, ALL_MODULES)!);
    }
    return build;
}

test('the SLEF build reproduces the fixture power budget', () => {
    const budget = ShipLoadout.fromSlef(slefString).powerBudget();
    const expectedPower = metrics.deepBlack.power;
    assert.ok(near(budget.available, expectedPower.available), `${budget.available}`);
    assert.ok(near(budget.retracted, expectedPower.retracted), `${budget.retracted}`);
    assert.ok(near(budget.deployed, expectedPower.deployed), `${budget.deployed}`);
    assert.equal(budget.withinBudget, expectedPower.withinBudget);
    assert.ok(near(budget.headroom, expectedPower.headroom));
    // This build carries no weapons, so deploying the hardpoints changes nothing.
    assert.ok(near(budget.retracted, budget.deployed));
});

test('the SLEF build reproduces the fixture shield and armour metrics', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const shields = build.shieldMetrics()!;
    assert.ok(near(shields.strength, metrics.deepBlack.shields.strength), `${shields.strength}`);
    assert.ok(
        near(shields.massCurveMultiplier, metrics.deepBlack.shields.massCurveMultiplier),
        `${shields.massCurveMultiplier}`,
    );
    assert.deepEqual(rounded(shields.resistances), metrics.deepBlack.shields.resistances);
    assert.deepEqual(
        rounded(shields.effectiveHitPoints),
        metrics.deepBlack.shields.effectiveHitPoints,
    );

    // The armour is engineered: the journal reports its hull boost as 137.6%, so the
    // Caspian Explorer's 345 base armour becomes 345 x 2.376.
    const armour = build.armourMetrics();
    assert.ok(near(armour.hitPoints, metrics.deepBlack.armour.hitPoints), `${armour.hitPoints}`);
    assert.ok(near(armour.hitPoints, 345 * 2.376));
    assert.deepEqual(rounded(armour.resistances), metrics.deepBlack.armour.resistances);
    assert.deepEqual(
        rounded(armour.effectiveHitPoints),
        metrics.deepBlack.armour.effectiveHitPoints,
    );
    assert.equal(build.weaponMetrics().weapons.length, metrics.deepBlack.weaponCount);
});

test('an assembled Anaconda reproduces the fixture metrics', () => {
    const build = fixtureAnaconda();
    const expectedBuild = metrics.anaconda;

    const budget = build.powerBudget();
    assert.ok(near(budget.available, expectedBuild.power.available));
    assert.ok(near(budget.retracted, expectedBuild.power.retracted));
    assert.ok(near(budget.deployed, expectedBuild.power.deployed));
    // The two weapons only draw once the hardpoints are out.
    assert.ok(budget.deployed > budget.retracted);
    assert.deepEqual(
        budget.bands.map((band) => ({
            priority: band.priority,
            retracted: Math.round(band.retracted * 1e6) / 1e6,
            deployed: Math.round(band.deployed * 1e6) / 1e6,
            deployedTotal: Math.round(band.deployedTotal * 1e6) / 1e6,
            poweredDeployed: band.poweredDeployed,
        })),
        expectedBuild.power.bands,
    );

    const shields = build.shieldMetrics()!;
    assert.ok(near(shields.strength, expectedBuild.shields.strength));
    assert.ok(near(shields.generator, expectedBuild.shields.generator));
    assert.ok(near(shields.boosters, expectedBuild.shields.boosters));
    assert.ok(near(shields.boostMultiplier, expectedBuild.shields.boostMultiplier));
    assert.deepEqual(rounded(shields.resistances), expectedBuild.shields.resistances);
    assert.deepEqual(rounded(shields.effectiveHitPoints), expectedBuild.shields.effectiveHitPoints);
    assert.deepEqual(
        rounded(build.shieldMetrics({ systemsPips: 4 })!.resistances),
        expectedBuild.shields.resistancesAtFourPips,
    );

    const armour = build.armourMetrics();
    assert.ok(near(armour.hitPoints, expectedBuild.armour.hitPoints));
    assert.ok(near(armour.bulkheads, expectedBuild.armour.bulkheads));
    assert.ok(near(armour.reinforcement, expectedBuild.armour.reinforcement));
    assert.deepEqual(rounded(armour.resistances), expectedBuild.armour.resistances);
    assert.deepEqual(rounded(armour.effectiveHitPoints), expectedBuild.armour.effectiveHitPoints);
    // The module reinforcement package protects the modules, not the hull.
    assert.ok(near(armour.moduleArmour, expectedBuild.armour.moduleArmour));
    assert.ok(near(armour.moduleProtection, expectedBuild.armour.moduleProtection));

    const weapons = build.weaponMetrics();
    assert.equal(weapons.weapons.length, 2);
    assert.ok(near(weapons.total.damagePerSecond, expectedBuild.weapons.damagePerSecond));
    assert.ok(
        near(
            weapons.total.sustainedDamagePerSecond,
            expectedBuild.weapons.sustainedDamagePerSecond,
        ),
    );
    assert.ok(near(weapons.total.energyPerSecond, expectedBuild.weapons.energyPerSecond));
    assert.ok(near(weapons.total.heatPerSecond, expectedBuild.weapons.heatPerSecond));
    assert.ok(near(weapons.total.powerDraw, expectedBuild.weapons.powerDraw));
    assert.ok(
        near(weapons.total.damageByType.kinetic, expectedBuild.weapons.kineticDamagePerSecond),
    );
    assert.ok(
        near(weapons.total.damageByType.thermal, expectedBuild.weapons.thermalDamagePerSecond),
    );
});

test('a hull with no shield generator reports no shields', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'PowerPlant',
        mod('Int_Powerplant_Size8_Class5'),
    );
    assert.equal(build.shieldMetrics(), null);
    // ...but still has the armour it left the shipyard with.
    assert.equal(build.armourMetrics().hitPoints, 945);
});

test('switched-off modules drop out of every metric', () => {
    const build = fixtureAnaconda();
    const lit = build.weaponMetrics().total.damagePerSecond;
    const shielded = build.shieldMetrics()!.strength;

    const off = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: build.modules.map((m) => ({ ...m, On: false })),
    });
    assert.equal(off.shieldMetrics(), null); // the generator is off
    assert.equal(off.powerBudget().available, 0); // so is the plant
    assert.equal(off.weaponMetrics().total.damagePerSecond, 0);
    // The weapons are still listed, with their own figures intact.
    assert.equal(off.weaponMetrics().weapons.length, 2);
    assert.ok(off.weaponMetrics().weapons.every((w) => !w.enabled));
    assert.ok(lit > 0 && shielded > 0);
});

test('engineering moves the metrics it should', () => {
    const build = fixtureAnaconda();
    const before = build.shieldMetrics()!;
    build.applyBlueprint('Slot01_Size7', 'ShieldGenerator_Reinforced', { grade: 5 });
    const after = build.shieldMetrics()!;
    assert.ok(after.strength > before.strength, `${before.strength} -> ${after.strength}`);

    const bareArmour = build.armourMetrics().hitPoints;
    build.applyBlueprint('Armour', 'Armour_HeavyDuty', { grade: 5 });
    const heavyArmour = build.armourMetrics();
    // Heavy Duty compounds on the armour multiplier: x3.5 becomes x4.62.
    assert.ok(near(heavyArmour.bulkheads, 525 * 4.62, 1e-6));
    assert.ok(heavyArmour.hitPoints > bareArmour);
    // It stiffens the resistances too.
    assert.ok(heavyArmour.resistances.kinetic > 0.26875);

    const weaponsBefore = build.weaponMetrics().total.damagePerSecond;
    build.applyBlueprint('LargeHardpoint1', 'Weapon_Overcharged', { grade: 5 });
    assert.ok(build.weaponMetrics().total.damagePerSecond > weaponsBefore);
});

test('jumpRangeSummary gathers the loads that matter', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const summary = build.jumpRangeSummary();
    assert.ok(near(summary.max, build.maxJumpRange()));
    assert.ok(near(summary.unladen, build.unladenJumpRange()));
    assert.ok(near(summary.laden, build.ladenJumpRange()));
    assert.ok(near(summary.totalUnladen, build.totalRange()));
    assert.ok(near(summary.totalLaden, build.totalRange({ cargo: build.cargoCapacity })));
    // Best single jump beats a full tank, which beats a full tank and a full hold.
    assert.ok(summary.max > summary.unladen);
    assert.ok(summary.unladen > summary.laden);
    assert.ok(summary.totalUnladen > summary.totalLaden);
    // A partial load sits between the two.
    const partial = build.jumpRange({ cargo: build.cargoCapacity / 2 });
    assert.ok(partial < summary.unladen && partial > summary.laden);
});

test('a fitted module reports its stats before and after engineering', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Gimbal_Large', HARDPOINT_MODULES),
    );
    const gun = build.getFittedModule('LargeHardpoint1')!;
    // Stock: the effective record is the catalogue record itself.
    assert.deepEqual(gun.effectiveStats, gun.stats);

    gun.applyBlueprint('Weapon_Overcharged', { grade: 5 });
    const after = build.getFittedModule('LargeHardpoint1')!;
    assert.ok(after.effectiveStats!.damage! > after.stats!.damage!);
    assert.equal(after.effectiveStats!.symbol, after.stats!.symbol);
});

test('a module the catalogues do not carry reports no stats', () => {
    const build = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        UnladenMass: 500,
        Modules: [{ Slot: 'Slot01_Size7', Item: 'int_future_module_without_stats' }],
    });
    const unknown = build.getFittedModule('Slot01_Size7')!;
    assert.equal(unknown.stats, null);
    assert.equal(unknown.effectiveStats, null);
    // It cannot claim any power either.
    assert.equal(build.powerBudget().deployed, 0);
});

test('a fitted module whose power draw is unknown is reported, not treated as free', () => {
    // The withdrawn Basic/Intermediate/Advanced Discovery Scanners: no registry carries
    // a power draw and the game's function is built in now, so the record has none.
    // Counting that as 0 MW would hand the build headroom it may not have.
    const build = ShipLoadout.empty('Anaconda')
        .setModule('PowerPlant', mod('Int_Powerplant_Size8_Class5'))
        .setModule(
            'Slot01_Size7',
            mod('Int_StellarBodyDiscoveryScanner_Advanced', INTERNAL_MODULES),
        )
        .setModule('Slot02_Size6', mod('Int_FuelScoop_Size6_Class5', INTERNAL_MODULES));
    const budget = build.powerBudget();
    assert.deepEqual(
        budget.unknownDraws.map((consumer) => consumer.label),
        ['Slot01_Size7'],
    );
    // The known draws are still added up, and the scanner adds nothing to them.
    assert.ok(
        near(budget.retracted, mod('Int_FuelScoop_Size6_Class5', INTERNAL_MODULES).powerDraw!),
    );

    // A cargo rack in the same slot draws nothing and is not a gap: the list stays empty.
    build.setModule('Slot01_Size7', mod('Int_CargoRack_Size7_Class1', INTERNAL_MODULES));
    assert.deepEqual(build.powerBudget().unknownDraws, []);
});

test('a fitted module whose mass is unknown refuses to report a mass', () => {
    // The one record with no mass. Summing the rest and calling it the build's mass
    // would understate it, so the whole figure is withheld — and so is everything that
    // depends on it.
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_DroneControl_ResourceSiphon', INTERNAL_MODULES),
    );
    assert.equal(build.unladenMass, null);
    assert.ok(isStatUnknown('Int_DroneControl_ResourceSiphon', 'mass'));

    // Its sized siblings all carry one, so the same build with any of them answers.
    build.setModule(
        'Slot01_Size7',
        mod('Int_DroneControl_ResourceSiphon_Size1_Class1', INTERNAL_MODULES),
    );
    assert.ok(build.unladenMass! > 400);
});

test('always-powered utility modules draw with the hardpoints stowed', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('PowerPlant', mod('Int_Powerplant_Size8_Class5'))
        .setModule('TinyHardpoint1', mod('Hpt_ShieldBooster_Size0_Class5', UTILITY_MODULES))
        .setModule('TinyHardpoint2', mod('Hpt_CrimeScanner_Size0_Class5', UTILITY_MODULES));
    const budget = build.powerBudget();
    const booster = mod('Hpt_ShieldBooster_Size0_Class5', UTILITY_MODULES);
    const scanner = mod('Hpt_CrimeScanner_Size0_Class5', UTILITY_MODULES);
    // The shield booster is always powered; the kill warrant scanner is not.
    assert.ok(near(budget.retracted, booster.powerDraw!));
    assert.ok(near(budget.deployed, booster.powerDraw! + scanner.powerDraw!));
});

test("a build whose hull is beyond the generator's maximum mass has no shields", () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_ShieldGenerator_Size1_Class1', INTERNAL_MODULES),
    );
    // A size-1 generator cannot cover a 400 t hull.
    assert.equal(build.shieldMetrics()!.strength, 0);
});

test('metrics on an unrecognised hull stay defined rather than throwing', () => {
    const build = ShipLoadout.fromLoadout({ Ship: 'not_a_real_hull', Modules: [] });
    assert.equal(build.armourMetrics().hitPoints, 0);
    assert.equal(build.shieldMetrics(), null);
    assert.equal(build.powerBudget().available, 0);
    assert.deepEqual(build.weaponMetrics().weapons, []);
});

test('an engineered hull reinforcement package adds a share of the base armour', () => {
    // The journal reports the package's hull boost as a percentage; read as a fraction
    // it would add a hundred times too much armour.
    const build = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [
            { Slot: 'Armour', Item: 'anaconda_armour_grade1' },
            {
                Slot: 'Slot01_Size7',
                Item: 'int_hullreinforcement_size5_class2',
                Engineering: {
                    BlueprintName: 'HullReinforcement_Advanced',
                    Level: 5,
                    Quality: 1,
                    Modifiers: [
                        { Label: 'DefenceModifierHealthMultiplier', Value: 6, OriginalValue: 0 },
                        { Label: 'DefenceModifierHealthAddition', Value: 341, OriginalValue: 390 },
                    ],
                },
            },
        ],
    });
    const armour = build.armourMetrics();
    assert.equal(armour.reinforcement, 341 + 525 * 0.06);
    assert.equal(armour.hitPoints, 945 + 341 + 31.5);
});

test('engineering the burst pattern moves the rate of fire with it', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Gimbal_Large', HARDPOINT_MODULES),
    );
    const before = build.weaponMetrics().total.damagePerSecond;
    // Double Shot names no rate of fire, but a two-round burst fires faster.
    build.applyBlueprint('LargeHardpoint1', 'Weapon_DoubleShot', { grade: 5 });
    const engineered = build.getFittedModule('LargeHardpoint1')!.effectiveStats!;
    assert.equal(engineered.burstRounds, 2);
    const after = build.weaponMetrics();
    assert.ok(after.total.damagePerSecond > before);
    const expectedRate = 2 / (1 / 14 + engineered.burstInterval!);
    assert.ok(Math.abs(after.weapons[0]!.metrics.rateOfFire - expectedRate) < 1e-6);
    // The module handle's own view must agree with the metrics, not report the stock rate.
    assert.ok(Math.abs(engineered.rateOfFire! - expectedRate) < 1e-6, `${engineered.rateOfFire}`);
});

test('a long-range weapon keeps its damage all the way out', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Gimbal_Large', HARDPOINT_MODULES),
    );
    build.applyBlueprint('LargeHardpoint1', 'Weapon_LongRange', { grade: 5 });
    const engineered = build.getFittedModule('LargeHardpoint1')!.effectiveStats!;
    assert.equal(engineered.falloffRange, engineered.maximumRange);
    assert.equal(damageFalloff(engineered, engineered.maximumRange! - 1), 1);
});

test('Rapid Fire applies to a plain weapon, adding the jitter it had none of', () => {
    const build = ShipLoadout.empty('Vulture').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Fixed_Medium', HARDPOINT_MODULES),
    );
    const gun = build.getFittedModule('LargeHardpoint1')!;
    assert.equal(gun.stats!.jitter, undefined);
    assert.ok(gun.getAvailableBlueprints().some((b) => b.fdname === 'Weapon_RapidFire'));

    build.applyBlueprint('LargeHardpoint1', 'Weapon_RapidFire', { grade: 5 });
    const engineered = build.getFittedModule('LargeHardpoint1')!.effectiveStats!;
    assert.equal(engineered.jitter, 0.5); // additive, from an assumed zero
    assert.ok(Math.abs(engineered.burstInterval! - 0.14 * 0.56) < 1e-9);
    assert.ok(Math.abs(engineered.rateOfFire! - 7.142857 / 0.56) < 1e-4);
    assert.ok(build.weaponMetrics().total.damagePerSecond > 0);
});

test("a journal's own rate of fire wins over anything derived from the cycle", () => {
    const build = ShipLoadout.fromLoadout({
        Ship: 'vulture',
        Modules: [
            {
                Slot: 'LargeHardpoint1',
                Item: 'Hpt_MultiCannon_Fixed_Medium',
                Engineering: {
                    BlueprintName: 'Weapon_RapidFire',
                    Level: 5,
                    Quality: 1,
                    Modifiers: [
                        { Label: 'RateOfFire', Value: 12.9, OriginalValue: 7.142857 },
                        { Label: 'BurstInterval', Value: 0.0784, OriginalValue: 0.14 },
                    ],
                },
            },
        ],
    });
    // The game's own figure is authoritative, even though the cycle implies 12.755.
    assert.equal(build.getFittedModule('LargeHardpoint1')!.effectiveStats!.rateOfFire, 12.9);
    assert.equal(build.weaponMetrics().weapons[0]!.metrics.rateOfFire, 12.9);
});

test('a fitted module answers to the same word a catalogue record does', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const fitted = build.getFittedModule('FrameShiftDrive')!;
    // `symbol` is what every catalogue lookup takes, so a handle and a record agree.
    assert.equal(fitted.symbol, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(getModuleBySymbol(fitted.symbol, CORE_MODULES)?.class, 6);
    // The journal spelling is still there, as it is for slot / on / priority.
    assert.equal(fitted.Item, fitted.symbol);
    assert.equal(fitted.Slot, fitted.slot);
});
