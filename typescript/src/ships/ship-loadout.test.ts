import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ShipLoadout } from './ship-loadout.js';
import type { LoadoutEvent } from './slef.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import { STANDARD_MODULES } from './modules-standard.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.json' with { type: 'json' };
import expected from '../../../fixtures/ships/jump-range.json' with { type: 'json' };

const mod = (symbol: string, catalogue = STANDARD_MODULES) => getModuleBySymbol(symbol, catalogue)!;

const slefString = JSON.stringify(slefFixture);
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

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
        /restricted to Explorer_NX/,
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
        assert.throws(() => conda.setModule('Military01', scoop), /military-eligible/);
    }
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
    const drives = conda.modulesForSlot('FrameShiftDrive', STANDARD_MODULES);
    assert.ok(drives.length > 0);
    assert.ok(drives.every((m) => m.symbol.toLowerCase().startsWith('int_hyperdrive')));
    assert.ok(drives.every((m) => m.class <= 6));
    assert.throws(() => conda.modulesForSlot('NoSuchSlot', STANDARD_MODULES), RangeError);
});

test('the armour and cargo-hatch slots cannot be edited', () => {
    const conda = ShipLoadout.empty('Anaconda');
    assert.throws(
        () => conda.setModule('CargoHatch', mod('Int_Hyperdrive_Size6_Class5')),
        /cargoHatch slot cannot be changed/,
    );
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
    const massMod = engineered.Modifiers.find((m) => m.Label === 'Mass');
    assert.equal(massMod?.Value, 208);
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

test('engineering rejects recipes whose base stats are not carried', () => {
    const weapon = ShipLoadout.empty('Sidewinder').setModule(
        'SmallHardpoint1',
        mod('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES),
    );
    const fittedWeapon = weapon.getFittedModule('SmallHardpoint1')!;
    assert.ok(
        !fittedWeapon
            .getAvailableBlueprints()
            .some((blueprint) => blueprint.fdname === 'Weapon_Overcharged'),
    );
    assert.throws(
        () => weapon.applyBlueprint('SmallHardpoint1', 'Weapon_Overcharged', { grade: 5 }),
        /missing base stats for Damage/,
    );

    const imported = ShipLoadout.fromSlef(slefString);
    assert.throws(
        () => imported.applyBlueprint('Armour', 'Armour_HeavyDuty', { grade: 5 }),
        /missing base stats/,
    );
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
    const drives = drive.modulesForSlot(STANDARD_MODULES);
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
