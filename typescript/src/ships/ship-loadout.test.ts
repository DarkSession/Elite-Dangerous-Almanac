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
import engineeringFixture from '../../../fixtures/ships/engineering.json' with { type: 'json' };
import inaraFixture from '../../../fixtures/ships/slef-inara-type-11.json' with { type: 'json' };
import lynxCapture from '../../../fixtures/ships/slef-inara-lynx-highliner.json' with { type: 'json' };
import lynxJournal from '../../../fixtures/ships/journal-lynx-highliner.json' with { type: 'json' };
import pantherCapture from '../../../fixtures/ships/slef-inara-panther-mkii.json' with { type: 'json' };
import cutterCapture from '../../../fixtures/ships/slef-inara-cutter-antixeno.json' with { type: 'json' };
import { ALL_MODULES } from './modules-all.js';
import { SHIPS } from './ships.js';
import type { DamageTypeValues } from './resistances.js';
import { damageFalloff } from './weapons.js';
import { getPreEngineeredVariants } from './pre-engineered.js';
import { getPreEngineeredStats } from './pre-engineered-stats.js';

const mod = (symbol: string, catalogue = CORE_MODULES) => getModuleBySymbol(symbol, catalogue)!;

const slefString = JSON.stringify(slefFixture);
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;
const modFor = (mods: readonly { Label: string; Value?: number }[], label: string) =>
    mods.find((modifier) => modifier.Label === label)?.Value;
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

test("re-fitting a lower-cased import's same module preserves its credit figures", () => {
    const build = ShipLoadout.fromSlef(slefString);
    const imported = build.moduleAt('FrameShiftDrive')!;
    const drive = mod(imported.Item);
    const modulesValue = build.modulesValue;
    const rebuy = build.rebuy;
    assert.notEqual(imported.Item, drive.symbol, 'fixture should exercise different casing');

    build.setModule('FrameShiftDrive', drive);

    assert.equal(build.modulesValue, modulesValue);
    assert.equal(build.rebuy, rebuy);
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

test('the power plant and fuel tank are found by `slot`, with the symbol as fallback', () => {
    // The readers outside the fit check. Each believes a record that names a mount and
    // consults the symbol only when none does. Both halves need a hand-made record to
    // show: a catalogue record carries both signals, so it cannot tell the rules apart.
    const plant = getModuleBySymbol('Int_PowerPlant_Size6_Class5', CORE_MODULES)!;
    assert.ok(
        ShipLoadout.empty('Anaconda').setModule('PowerPlant', plant).powerBudget().available > 0,
    );

    // The declared mount is authoritative even when the symbol suggests another family.
    const asThrusters: OutfittingModule = { ...plant, slot: 'thrusters' };
    const miswired = ShipLoadout.empty('Anaconda').setModule('MainEngines', asThrusters);
    assert.equal(miswired.powerBudget().available, 0);

    // The fallback: an `Item` no catalogue carries names no mount, so the symbol
    // identifies its family and its own engineering supplies the capacity.
    const unknownModule = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        UnladenMass: 400,
        Modules: [
            {
                Slot: 'PowerPlant',
                Item: 'int_powerplant_size9_class9_madeup',
                On: true,
                Engineering: { Modifiers: [{ Label: 'PowerCapacity', Value: 30 }] },
            },
        ],
    } as unknown as LoadoutEvent);
    assert.equal(unknownModule.powerBudget().available, 30);

    // Fuel capacity reads the same way: a cargo rack that declares the fuel-tank mount
    // is taken at its word and counted as a tank, which the symbol rule never did.
    const rack = getModuleBySymbol('Int_CargoRack_Size5_Class1', ALL_MODULES)!;
    const imported = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        UnladenMass: 400,
        FuelCapacity: { Main: 999, Reserve: 1.07 },
        Modules: [{ Slot: 'Slot05_Size5', Item: rack.symbol, On: true }],
    } as LoadoutEvent);
    assert.equal(imported.fuelCapacity.main, 999);
    imported.setModule('Slot05_Size5', { ...rack, slot: 'fuelTank' } as OutfittingModule);
    assert.equal(imported.fuelCapacity.main, 0);
});

test('the drive is found by `slot` too, wherever the module is mounted', () => {
    // Drive lookup scans every fitted module and trusts the declared mount.
    const laser = getModuleBySymbol('Hpt_PulseLaser_Fixed_Large', ALL_MODULES)!;
    const build = ShipLoadout.empty('Anaconda')
        .setModule('HugeHardpoint1', { ...laser, slot: 'frameShiftDrive' } as OutfittingModule)
        .setModule(
            'FrameShiftDrive',
            getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!,
        )
        .setModule('FuelTank', getModuleBySymbol('Int_FuelTank_Size5_Class3', CORE_MODULES)!);
    // A pulse laser carries no jump constants, so the build says so rather than
    // quietly answering with the real drive fitted alongside it.
    assert.throws(() => build.maxJumpRange(), /no jump constants/);

    // Left alone, the same build jumps on its actual drive.
    const sane = ShipLoadout.empty('Anaconda')
        .setModule('HugeHardpoint1', laser)
        .setModule(
            'FrameShiftDrive',
            getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!,
        )
        .setModule('FuelTank', getModuleBySymbol('Int_FuelTank_Size5_Class3', CORE_MODULES)!);
    assert.ok(sane.maxJumpRange() > 0);
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
    assert.equal(fsdSlot?.module?.symbol, 'Int_Hyperdrive_Size2_Class5');
    assert.equal(build.getFittedModule('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size2_Class5');
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
    // Core slots accept them: their records name a core `slot` even though the
    // registry files them under the `internal` category.
    assert.equal(gPlant.slot, 'powerPlant');
    assert.equal(gDist.slot, 'powerDistributor');
    assert.doesNotThrow(() => conda.setModule('PowerPlant', gPlant));
    assert.doesNotThrow(() => conda.setModule('PowerDistributor', gDist));
    // Optional slots reject them.
    assert.throws(() => conda.setModule('Slot02_Size6', gPlant), /core module only fits/);
    assert.throws(() => conda.setModule('Slot03_Size6', gDist), /core module only fits/);
    // ...but a fuel tank, the one module built for two kinds of mount, still fits an
    // optional slot as well as its own.
    assert.doesNotThrow(() => conda.setModule('Slot05_Size5', mod('Int_FuelTank_Size5_Class3')));
});

test('a core mount takes the module whose record names it, not one that looks the part', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const drive = mod('Int_Hyperdrive_Size6_Class5');
    assert.equal(drive.slot, 'frameShiftDrive');
    assert.doesNotThrow(() => conda.setModule('FrameShiftDrive', drive));
    // Right shape, wrong mount.
    assert.throws(() => conda.setModule('PowerPlant', drive), /not a powerPlant module/);
    // A record assembled by hand carries no `slot`, so it names no mount — and the fit
    // rule reads the record rather than classifying the symbol, so this core mount turns
    // it away, whatever the symbol looks like. The armour and optional mounts read the
    // record too; the hand-made record isolates that invariant.
    const handRolled: OutfittingModule = {
        symbol: drive.symbol,
        category: 'core',
        name: drive.name,
        class: drive.class,
        rating: drive.rating,
    };
    assert.throws(
        () => conda.setModule('FrameShiftDrive', handRolled),
        /not a frameShiftDrive module/,
    );
});

test('the armour mount reads `slot`, not the category the record claims', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const armour = mod('Anaconda_Armour_Grade2');
    assert.equal(armour.slot, 'armour');
    assert.doesNotThrow(() => conda.setModule('Armour', armour));

    // Named and filed like armour but declaring no armour mount: refused.
    const unnamed: OutfittingModule = {
        symbol: armour.symbol,
        category: 'core',
        name: armour.name,
        ship: 'Anaconda',
        class: armour.class,
        rating: armour.rating,
    };
    assert.throws(() => conda.setModule('Armour', unnamed), /not a ship armour module/);

    // The declared armour mount remains authoritative when category is mislabelled.
    const mislabelled: OutfittingModule = { ...armour, category: 'internal' };
    assert.doesNotThrow(() => conda.setModule('Armour', mislabelled));

    // A module that merely claims a hull is still not armour.
    const plant: OutfittingModule = { ...mod('Int_PowerPlant_Size6_Class5'), ship: 'Anaconda' };
    assert.throws(() => conda.setModule('Armour', plant), /not a ship armour module/);
});

test('an optional mount takes a fuel tank because its record says so, not its symbol', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const tank = mod('Int_FuelTank_Size5_Class3');
    assert.equal(tank.slot, 'fuelTank');
    // The one module built for two kinds of mount: its own, and any optional slot.
    assert.doesNotThrow(() => conda.setModule('Slot05_Size5', tank));
    assert.doesNotThrow(() => conda.setModule('FuelTank', tank));

    // The symbol alone does not earn the fuel-tank exception.
    const unnamed: OutfittingModule = {
        symbol: tank.symbol,
        category: 'core',
        name: tank.name,
        class: tank.class,
        rating: tank.rating,
    };
    assert.throws(
        () => ShipLoadout.empty('Anaconda').setModule('Slot05_Size5', unnamed),
        /not an optional-internal module/,
    );
});

test('an optional mount turns away a core module because its record names a mount', () => {
    // "A core module only fits its core slot" reads the declared `slot`.
    const rack = mod('Int_CargoRack_Size4_Class1', INTERNAL_MODULES);
    assert.equal(rack.slot, undefined);
    assert.doesNotThrow(() => ShipLoadout.empty('Anaconda').setModule('Slot05_Size5', rack));

    // A cargo rack that claims a core mount is taken at its word and refused.
    const claimsCore: OutfittingModule = { ...rack, slot: 'powerPlant' };
    assert.throws(
        () => ShipLoadout.empty('Anaconda').setModule('Slot05_Size5', claimsCore),
        /a core module only fits its core slot/,
    );

    // A record with no declared core mount does not trigger the fixed-mount rule.
    const plant = mod('Int_PowerPlant_Size5_Class5');
    const unnamed: OutfittingModule = {
        symbol: plant.symbol,
        category: 'internal',
        name: plant.name,
        class: plant.class,
        rating: plant.rating,
    };
    assert.doesNotThrow(() => ShipLoadout.empty('Anaconda').setModule('Slot05_Size5', unnamed));
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

test("the Lynx Highliner's cabin mounts take cabins of either family and nothing else", () => {
    const lynx = ShipLoadout.empty('MediumTransport01');
    // Both symbol families count, at any class: the capture that pins these mounts
    // carries Mk II cabins, and the Mk I ones are the same module family.
    assert.doesNotThrow(() =>
        lynx.setModule(
            'Passenger01',
            mod('Int_MkII_PassengerCabin_Size6_Class2', INTERNAL_MODULES),
        ),
    );
    assert.doesNotThrow(() =>
        lynx.setModule('Passenger02', mod('Int_PassengerCabin_Size6_Class4', INTERNAL_MODULES)),
    );
    // A fuel tank fits every *other* optional mount, restricted or not; not this one.
    assert.throws(
        () => lynx.setModule('Passenger03', mod('Int_FuelTank_Size5_Class3')),
        /only takes passenger cabins/,
    );
    assert.throws(
        () => lynx.setModule('Passenger01', mod('Int_CargoRack_Size6_Class1', INTERNAL_MODULES)),
        /only takes passenger cabins/,
    );
    // The restriction is the mount's, not the module's: a cabin still fits the hull's
    // unrestricted optionals, which is how a Lynx carries more than three of them.
    assert.doesNotThrow(() =>
        lynx.setModule(
            'Slot01_Size6',
            mod('Int_MkII_PassengerCabin_Size6_Class2', INTERNAL_MODULES),
        ),
    );
});

test('a module reserved to one kind of mount fits no other mount on its own hull', () => {
    // The other half of a restriction. Both racks and the Mk II mining controller are
    // already `restrictedToShips`, so only the hull that can buy them gets this far —
    // and on that hull the game still sells them for one mount alone.
    const panther = ShipLoadout.empty('PantherMkII');
    const rack = mod('Int_LargeCargoRack_Size8_class1', INTERNAL_MODULES);
    assert.equal(rack.restrictedToSlot, 'cargo');
    assert.doesNotThrow(() => panther.setModule('Cargo01', rack));
    assert.throws(
        () => panther.setModule('Slot01_Size8', rack),
        /module only fits a mount that takes cargo racks and fuel tanks/,
    );
    // The size-7 rack is the same shape, and `Cargo02` is the Panther's *first* size-7
    // mount rather than one of the two largest — so this is not "the biggest mount".
    assert.doesNotThrow(() =>
        panther.setModule('Cargo02', mod('Int_LargeCargoRack_Size7_Class1', INTERNAL_MODULES)),
    );

    const miner = ShipLoadout.empty('LakonMiner');
    const controller = mod('Int_MultiDroneControl_MiningV2_Size5_Class5', INTERNAL_MODULES);
    assert.doesNotThrow(() => miner.setModule('LimpetController01', controller));
    assert.throws(
        () => miner.setModule('Slot05_Size5', controller),
        /module only fits a mount that takes limpet controllers/,
    );
    // An ordinary controller has no such reservation and fits either mount.
    const plain = mod('Int_DroneControl_Collection_Size5_Class5', INTERNAL_MODULES);
    assert.equal(plain.restrictedToSlot, undefined);
    assert.doesNotThrow(() => miner.setModule('Slot05_Size5', plain));
    assert.doesNotThrow(() => miner.setModule('LimpetController01', plain));

    // An outfitting UI must not offer what the fit check would refuse.
    assert.ok(
        !panther
            .modulesForSlot('Slot01_Size8', INTERNAL_MODULES)
            .some((m) => m.symbol === rack.symbol),
    );
    assert.ok(
        panther.modulesForSlot('Cargo01', INTERNAL_MODULES).some((m) => m.symbol === rack.symbol),
    );
});

test('the planetary approach suite states its own mount instead of being special-cased', () => {
    // The suite uses the same `restrictedToSlot` rule as racks and controllers.
    const suite = mod('Int_PlanetApproachSuite', INTERNAL_MODULES);
    assert.equal(suite.restrictedToSlot, 'planetaryApproachSuite');
    assert.equal(
        mod('Int_PlanetApproachSuite_Advanced', INTERNAL_MODULES).restrictedToSlot,
        'planetaryApproachSuite',
    );
    const conda = ShipLoadout.empty('Anaconda');
    assert.doesNotThrow(() => conda.setModule('PlanetaryApproachSuite', suite));
    assert.throws(
        () => conda.setModule('Slot14_Size1', suite),
        /module only fits a mount that takes planetary approach suites/,
    );
    // The mount's half still holds on its own: it refuses a module that never declared
    // a reservation, so neither half depends on the other being right.
    assert.throws(
        () =>
            conda.setModule(
                'PlanetaryApproachSuite',
                mod('Int_CargoRack_Size1_Class1', INTERNAL_MODULES),
            ),
        /slot only takes planetary approach suites/,
    );

    // Frontier's Lynx capture is the source for this hull's mount: it fits the advanced
    // suite under this exact key. Rebuilding that fit from an empty hull must therefore
    // accept the article the game states.
    const captured = lynxJournal.Modules.find((module) => module.Slot === 'PlanetaryApproachSuite');
    assert.ok(captured);
    assert.equal(captured.Item, 'int_planetapproachsuite_advanced');
    assert.doesNotThrow(() =>
        ShipLoadout.empty(lynxJournal.Ship).setModule(
            captured.Slot,
            mod(captured.Item, INTERNAL_MODULES),
        ),
    );
});

test('the restrictions accept what the game itself fitted in a real capture', () => {
    // The captures are the evidence these two rules rest on, so they are also the test
    // that matters most: the game sold each of these builds, and re-fitting one module
    // by module must not refuse a single mount. A rule drawn too tightly — a cabin
    // family left out of the passenger prefixes, say — fails here and nowhere else.
    // Between them the four cover `mining`, `cargo`, `limpetController`,
    // `vesselHangar`, `passenger` and — since the Cutter joined them — `military`, whose
    // two mounts it fills with hull reinforcement packages. The Frontier Lynx capture
    // exercises `planetaryApproachSuite` separately above; Inara omits that empty mount.
    const captures = [
        ['lynx-highliner', lynxCapture[0]!.data],
        ['panther-mkii', pantherCapture[0]!.data],
        ['cutter-antixeno', cutterCapture[0]!.data],
        ['type-11', inaraFixture[0]!.data],
    ] as const;
    for (const [name, data] of captures) {
        const build = ShipLoadout.empty(data.Ship);
        for (const fitted of data.Modules) {
            const record = getModuleBySymbol(fitted.Item, ALL_MODULES);
            assert.ok(record, `${name}: no module "${fitted.Item}"`);
            assert.doesNotThrow(
                () => build.setModule(fitted.Slot, record),
                `${name}: ${fitted.Item} → ${fitted.Slot}`,
            );
        }
    }
    // And the mounts the captures were acquired for, module by mount and spelled as
    // Inara writes them — sorted by key, since a capture lists its modules in no
    // particular order and which cabin sits in which mount is the whole point.
    const fittedIn = (capture: { Slot: string; Item: string }[], prefix: string) =>
        capture
            .filter((m) => m.Slot.startsWith(prefix))
            .map((m) => [m.Slot, m.Item])
            .sort();
    assert.deepEqual(fittedIn(lynxCapture[0]!.data.Modules, 'passenger'), [
        ['passenger01', 'int_mkii_passengercabin_size6_class1'],
        ['passenger02', 'int_mkii_passengercabin_size6_class1'],
        ['passenger03', 'int_mkii_passengercabin_size5_class1'],
    ]);
    // The Panther's Mk II racks are in its two cargo mounts, and its unrestricted
    // size-8 and size-7 carry ordinary racks — the build that proves the reservation
    // is about the mount rather than about size.
    assert.deepEqual(fittedIn(pantherCapture[0]!.data.Modules, 'cargo'), [
        ['cargo01', 'int_largecargorack_size8_class1'],
        ['cargo02', 'int_largecargorack_size7_class1'],
    ]);
    assert.deepEqual(fittedIn(pantherCapture[0]!.data.Modules, 'slot01'), [
        ['slot01_size8', 'int_cargorack_size8_class1'],
    ]);
    assert.deepEqual(fittedIn(pantherCapture[0]!.data.Modules, 'slot02'), [
        ['slot02_size7', 'int_cargorack_size7_class1'],
    ]);
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
    const conda = ShipLoadout.empty('Anaconda');
    const condaName = (key: string) => conda.slots().find((s) => s.key === key)?.name;
    assert.equal(condaName('Military01'), 'Military Slot 1');
    assert.equal(condaName('PlanetaryApproachSuite'), 'Planetary Approach Suite');
    assert.equal(condaName('HugeHardpoint1'), 'Huge Hardpoint 1');
    // Every mount a hull declares gets a label. Restricted mounts leave size to
    // `slot.size`, just as `Cargo02` does.
    const lynx = ShipLoadout.empty('MediumTransport01');
    const lynxName = (key: string) => lynx.slots().find((s) => s.key === key)?.name;
    assert.equal(lynxName('Passenger01'), 'Passenger Slot 1');
    assert.equal(lynxName('Passenger03'), 'Passenger Slot 3');
    assert.equal(lynxName('Slot02_Size5'), 'Optional Internal 2 (Size 5)');
    for (const ship of SHIPS) {
        let build;
        try {
            build = ShipLoadout.empty(ship.symbol);
        } catch {
            continue; // no slot layout for this hull
        }
        for (const slot of build.slots()) {
            // The armour mount is the one place where the label *is* the key.
            if (slot.kind === 'armour') continue;
            assert.notEqual(slot.name, slot.key, `${ship.symbol}: ${slot.key} has no label`);
        }
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
    assert.equal(conda.getFittedModule('Armour')?.symbol, 'Anaconda_Armour_Grade2');
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
    const engineered = build.getFittedModule('FrameShiftDrive')!.engineering!;
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
    // A recipe the drive's own menu does not list, and the menu is quoted back.
    assert.throws(
        () => build.applyBlueprint('FrameShiftDrive', 'Armour_HeavyDuty', { grade: 5 }),
        /is not offered blueprint "Armour_HeavyDuty"; it takes FSD_FastBoot, FSD_LongRange, FSD_Shielded/,
    );
    assert.throws(
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
                grade: 5,
                experimental: 'special_shieldbooster_toughened',
            }),
        /is not offered experimental effect "special_shieldbooster_toughened"/,
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
    const overcharged = weapon.getFittedModule('SmallHardpoint1')!.engineering!.Modifiers!;
    const damage = overcharged.find((m) => m.Label === 'Damage')!;
    assert.ok(damage.Value! > damage.OriginalValue!, 'Overcharged raises damage');

    // Armour's hull boost is a per-hull stat on the armour module, so Heavy Duty
    // resolves against it.
    const conda = ShipLoadout.empty('Anaconda').setModule('Armour', mod('Anaconda_Armour_Grade3'));
    conda.applyBlueprint('Armour', 'Armour_HeavyDuty', { grade: 5 });
    const boost = conda
        .getFittedModule('Armour')!
        .engineering!.Modifiers!.find((m) => m.Label === 'DefenceModifierHealthMultiplier')!;
    // The journal reports hull boost as a percentage, and it compounds on the armour
    // multiplier: a 250% bulkhead (x3.5 armour) at a full grade-5 roll (+32%) becomes
    // x4.62, i.e. 362%.
    assert.equal(boost.OriginalValue, 250);
    assert.equal(boost.Value, 362);
});

test('damage-converting experimentals replace the weapon split and export journal labels', () => {
    const cases = [
        {
            symbol: 'Hpt_Cannon_Fixed_Small',
            experimental: 'special_high_yield_shell',
        },
        {
            symbol: 'Hpt_PulseLaserBurst_Fixed_Small',
            experimental: 'special_distortion_field',
        },
        {
            symbol: 'Hpt_DumbfireMissileRack_Fixed_Small',
            experimental: 'special_overload_munitions',
        },
    ] as const;
    const expected = engineeringFixture.experimentalDamageDistributions.map;

    for (const { symbol, experimental } of cases) {
        const build = ShipLoadout.empty('Sidewinder').setModule(
            'SmallHardpoint1',
            mod(symbol, HARDPOINT_MODULES),
        );
        build.applyBlueprint('SmallHardpoint1', 'Weapon_Sturdy', {
            grade: 5,
            experimental,
        });

        const fitted = build.getFittedModule('SmallHardpoint1')!;
        assert.deepEqual(fitted.effectiveStats?.damageDistribution, expected[experimental]);
        const metrics = build.weaponMetrics().weapons[0]!.metrics;
        for (const [type, share] of Object.entries(expected[experimental])) {
            assert.ok(
                near(
                    metrics.damageByType[type as 'kinetic' | 'thermal' | 'explosive'],
                    metrics.damagePerSecond * share,
                    1e-6,
                ),
                `${experimental} ${type}`,
            );
        }

        const modifiers = fitted.engineering?.Modifiers ?? [];
        for (const type of Object.keys(expected[experimental])) {
            const label = `$${type[0]!.toUpperCase()}${type.slice(1)};`;
            assert.ok(
                modifiers.some((modifier) => modifier.Label === label),
                label,
            );
        }
    }
});

test('thermal plasma conversion blueprints expose their absolute damage split', () => {
    const conversion = engineeringFixture.thermalPlasmaConversions;
    const expected = conversion.grades['5'];
    for (const [blueprint, symbol] of Object.entries(conversion.blueprints)) {
        const build = ShipLoadout.empty('Sidewinder').setModule(
            'SmallHardpoint1',
            mod(symbol, HARDPOINT_MODULES),
        );
        build.applyBlueprint('SmallHardpoint1', blueprint, { grade: 5 });

        const fitted = build.getFittedModule('SmallHardpoint1')!;
        assert.deepEqual(fitted.effectiveStats?.damageDistribution, expected, blueprint);
        assert.equal(fitted.effectiveStats?.damageComponents, undefined, blueprint);

        const modifiers = fitted.engineering?.Modifiers ?? [];
        assert.equal(modFor(modifiers, '$Thermal;'), expected.thermal * 100, blueprint);
        assert.equal(modFor(modifiers, '$Absolute;'), expected.absolute * 100, blueprint);

        const weapon = build.weaponMetrics().weapons[0]!.metrics;
        assert.ok(
            near(weapon.damageByType.thermal, weapon.damagePerSecond * expected.thermal, 1e-6),
            `${blueprint} thermal`,
        );
        assert.ok(
            near(weapon.damageByType.absolute, weapon.damagePerSecond * expected.absolute, 1e-6),
            `${blueprint} absolute`,
        );
    }
});

test('a converting experimental supersedes a plasma-conversion blueprint split', () => {
    const build = ShipLoadout.empty('Sidewinder').setModule(
        'SmallHardpoint1',
        mod('Hpt_PulseLaserBurst_Fixed_Small', HARDPOINT_MODULES),
    );
    build.applyBlueprint('SmallHardpoint1', 'BurstLaser_ThermalPlasmaConversion', {
        grade: 5,
        experimental: 'special_distortion_field',
    });

    const fitted = build.getFittedModule('SmallHardpoint1')!;
    assert.deepEqual(
        fitted.effectiveStats?.damageDistribution,
        engineeringFixture.experimentalDamageDistributions.map.special_distortion_field,
    );
    assert.ok(!('absolute' in fitted.effectiveStats!.damageDistribution!));
    assert.equal(modFor(fitted.engineering?.Modifiers ?? [], '$Absolute;'), undefined);
});

test('a damage conversion supersedes exact stock damage components', () => {
    const stock = mod('Hpt_Cannon_Fixed_Small', HARDPOINT_MODULES);
    const withExactComponents: OutfittingModule = {
        ...stock,
        damageDistribution: { kinetic: 1 },
        damageComponents: { kinetic: stock.damage! },
    };
    const build = ShipLoadout.empty('Sidewinder').setModule('SmallHardpoint1', withExactComponents);
    build.applyBlueprint('SmallHardpoint1', 'Weapon_Sturdy', {
        grade: 5,
        experimental: 'special_high_yield_shell',
    });

    const effective = build.getFittedModule('SmallHardpoint1')!.effectiveStats!;
    assert.equal(effective.damageComponents, undefined);
    assert.deepEqual(
        effective.damageDistribution,
        engineeringFixture.experimentalDamageDistributions.map.special_high_yield_shell,
    );

    const metrics = build.weaponMetrics().weapons[0]!.metrics;
    assert.ok(near(metrics.damageByType.kinetic, metrics.damagePerSecond / 2, 1e-6));
    assert.ok(near(metrics.damageByType.explosive, metrics.damagePerSecond / 2, 1e-6));
});

test('a hull reinforcement package engineers a hull boost it never had', () => {
    // A reinforcement package carries no base hull boost, and unlike an ordinary stat
    // that absence is not "nothing to scale": a percentage-of-a-multiplier stat has a
    // real neutral value of 0% (a x1 multiplier), so the recipe's bonus *is* the result.
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_HullReinforcement_Size5_Class2', INTERNAL_MODULES),
    );
    const fitted = build.getFittedModule('Slot01_Size7')!;
    assert.ok(
        fitted
            .getAvailableBlueprints()
            .some((blueprint) => blueprint.fdname === 'HullReinforcement_Advanced'),
    );
    build.applyBlueprint('Slot01_Size7', 'HullReinforcement_Advanced', { grade: 5 });
    const boost = build
        .getFittedModule('Slot01_Size7')!
        .engineering!.Modifiers!.find((m) => m.Label === 'DefenceModifierHealthMultiplier')!;
    // Grade 5 Lightweight is +24% at a full roll, compounded on a x1 multiplier.
    assert.equal(boost.OriginalValue, 0);
    assert.equal(boost.Value, 24);
    // The Heavy Duty recipe, which moves the reinforcement itself, still works.
    build.applyBlueprint('Slot01_Size7', 'HullReinforcement_HeavyDuty', { grade: 5 });
    const added = build
        .getFittedModule('Slot01_Size7')!
        .engineering!.Modifiers!.find((m) => m.Label === 'DefenceModifierHealthAddition')!;
    assert.ok(added.Value! > added.OriginalValue!);
});

test('a recipe leg on a stat the module does not have is inert, not a rejection', () => {
    // Long Range scales a projectile's shot speed. A beam laser has no projectile, so no
    // registry publishes one and the game leaves the stat alone — the recipe still
    // applies, and simply emits no ShotSpeed modifier.
    const beam = getModuleBySymbol('Hpt_BeamLaser_Fixed_Medium', ALL_MODULES)!;
    assert.equal(beam.shotSpeed, undefined);

    const build = ShipLoadout.empty('Anaconda').setModule(
        'MediumHardpoint1',
        mod(beam.symbol, HARDPOINT_MODULES),
    );
    build.applyBlueprint('MediumHardpoint1', 'Weapon_LongRange', { grade: 5 });
    const modifiers = build.getFittedModule('MediumHardpoint1')!.engineering!.Modifiers!;
    assert.ok(!modifiers.some((m) => m.Label === 'ShotSpeed'));
    assert.ok(modifiers.some((m) => m.Label === 'MaximumRange' || m.Label === 'Range'));

    // A weapon that does fire a projectile gets the leg.
    const cannon = ShipLoadout.empty('Anaconda').setModule(
        'MediumHardpoint1',
        mod('Hpt_MultiCannon_Fixed_Medium', HARDPOINT_MODULES),
    );
    cannon.applyBlueprint('MediumHardpoint1', 'Weapon_LongRange', { grade: 5 });
    const shot = cannon
        .getFittedModule('MediumHardpoint1')!
        .engineering!.Modifiers!.find((m) => m.Label === 'ShotSpeed')!;
    assert.ok(shot.Value! > shot.OriginalValue!);
});

test('engineering accepts a sourced zero', () => {
    // A sourced zero is a real base value: Lightweight is offered and leaves it at zero.
    const siphon = getModuleBySymbol('Int_DroneControl_ResourceSiphon', ALL_MODULES)!;
    assert.equal(siphon.mass, 0);
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod(siphon.symbol, INTERNAL_MODULES),
    );
    assert.ok(
        build
            .getFittedModule('Slot01_Size7')!
            .getAvailableBlueprints()
            .some((blueprint) => blueprint.fdname === 'HatchBreakerLimpet_LightWeight'),
    );
    build.applyBlueprint('Slot01_Size7', 'HatchBreakerLimpet_LightWeight', { grade: 5 });
    assert.equal(
        build
            .getFittedModule('Slot01_Size7')!
            .engineering!.Modifiers!.find((modifier) => modifier.Label === 'Mass')?.Value,
        0,
    );
});

test('Anti-Guardian Zone Resistance grants a capability to modules and weapons', () => {
    const capability = engineeringFixture.guardianZoneResistanceCapability;
    assert.equal(capability.field, 'guardianZoneResistance');
    for (const { slot, symbol, blueprint } of capability.cases) {
        const stock = mod(symbol, ALL_MODULES);
        assert.equal(stock.guardianZoneResistance, undefined, `${symbol} is stock`);
        const build = ShipLoadout.empty('Anaconda').setModule(slot, stock);
        assert.ok(
            build
                .getFittedModule(slot)!
                .getAvailableBlueprints()
                .some(({ fdname }) => fdname === capability.offeredAs),
            `${symbol} is not offered the capability`,
        );
        build.applyBlueprint(slot, blueprint, { grade: capability.grade });
        const fitted = build.getFittedModule(slot)!;
        assert.deepEqual(fitted.engineering?.Modifiers, [capability.modifier], symbol);
        assert.equal(fitted.effectiveStats?.guardianZoneResistance, true, symbol);

        const imported = ShipLoadout.fromSlef(build.toSlefString()).getFittedModule(slot)!;
        assert.equal(imported.effectiveStats?.guardianZoneResistance, true, `${symbol} round trip`);
    }

    // Producers that serialize the displayed +100% as a number still grant the same
    // boolean capability. The label is authoritative; its representation cannot leak a
    // number into the public module shape.
    const numericImport = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [
            {
                Slot: 'PowerPlant',
                Item: capability.cases[0]!.symbol,
                Engineering: {
                    BlueprintName: capability.offeredAs,
                    Level: capability.grade,
                    Quality: 1,
                    Modifiers: [capability.numericImportedModifier],
                },
            },
        ],
    } as unknown as LoadoutEvent).getFittedModule('PowerPlant')!;
    assert.equal(numericImport.effectiveStats?.guardianZoneResistance, true);
    assert.equal(typeof numericImport.effectiveStats?.guardianZoneResistance, 'boolean');

    // An ordinary plant still refuses the recipe at the menu boundary: representing the
    // capability does not widen which modules can receive it.
    const refused = capability.refused;
    assert.throws(
        () =>
            ShipLoadout.empty('Anaconda')
                .setModule(refused.slot, mod(refused.symbol))
                .applyBlueprint(refused.slot, refused.blueprint, { grade: capability.grade }),
        /is not offered blueprint "recipe_guardianmodule_sturdy"/,
    );

    // A Guardian module still has no experimental slot. Its ordinary twin takes an
    // experimental normally; the capability changes neither menu.
    const plant = ShipLoadout.empty('Anaconda').setModule(
        'PowerPlant',
        mod('Int_GuardianPowerplant_Size7', INTERNAL_MODULES),
    );
    assert.throws(
        () =>
            plant.applyBlueprint('PowerPlant', 'recipe_guardianmodule_sturdy', {
                grade: 1,
                experimental: 'special_powerplant_lightweight',
            }),
        /is not offered experimental effect "special_powerplant_lightweight"; it takes no experimental effect/,
    );
    assert.ok(
        ShipLoadout.empty('Anaconda')
            .setModule('PowerPlant', mod('Int_Powerplant_Size7_Class5'))
            .applyBlueprint('PowerPlant', 'PowerPlant_Armoured', {
                grade: 1,
                experimental: 'special_powerplant_lightweight',
            }),
    );
});

test('a scanner has one range field and either journal label moves it', () => {
    // Utility scanners and sensor suites keep their distance only in `scannerRange`.
    // A recipe says `ScannerRange` while a journal may say `Range`; both must reach that
    // field without creating the separate `maximumRange` field.
    assert.equal(
        ALL_MODULES.filter(
            (record) =>
                typeof record.scannerRange === 'number' && typeof record.maximumRange === 'number',
        ).length,
        0,
    );

    // The recipe's own spelling, rolled rather than hand-written.
    const build = ShipLoadout.empty('Anaconda')
        .setModule('TinyHardpoint1', mod('Hpt_CargoScanner_Size0_Class5', UTILITY_MODULES))
        .applyBlueprint('TinyHardpoint1', 'Scanner_LongRange', { grade: 5 });
    const rolled = build.getFittedModule('TinyHardpoint1')!;
    const range = rolled.engineering!.Modifiers!.find((m) => m.Label === 'ScannerRange')!.Value!;
    assert.ok(range > 4000);
    assert.equal(rolled.effectiveStats?.scannerRange, range);
    assert.equal(rolled.effectiveStats?.maximumRange, undefined);

    // And the journal's spelling of the same modifier, read back through a `Loadout` event.
    const event: LoadoutEvent = JSON.parse(JSON.stringify(build.toLoadoutEvent()));
    for (const modifier of event.Modules[0]!.Engineering!.Modifiers!) {
        if (modifier.Label === 'ScannerRange') (modifier as { Label: string }).Label = 'Range';
    }
    const asJournal = ShipLoadout.fromLoadout(event).getFittedModule('TinyHardpoint1')!;
    assert.equal(asJournal.effectiveStats?.scannerRange, range);
    assert.equal(asJournal.effectiveStats?.maximumRange, undefined);
});

test('a wake scanner engineered Long Range gets the scanner recipe, not the sensor suite one', () => {
    // The game writes `Sensor_LongRange` on both, and the two roll different stats in
    // opposite directions: the suite's costs mass, the scanner's power draw. An
    // EDSY-authored build declares the scanner's that way, so `applyBlueprint` has to read
    // the id against the module it is fitted to.
    const collision = engineeringFixture.scannerIdCollision;
    const build = ShipLoadout.empty('Anaconda')
        .setModule('Radar', mod('Int_Sensors_Size8_Class5'))
        .setModule('TinyHardpoint1', mod('Hpt_CloudScanner_Size0_Class5', UTILITY_MODULES))
        .applyBlueprint('Radar', 'Sensor_LongRange', { grade: collision.grade })
        .applyBlueprint('TinyHardpoint1', 'Sensor_LongRange', { grade: collision.grade });

    const labels = (slot: string) =>
        (build.getFittedModule(slot)!.engineering!.Modifiers ?? [])
            .map((modifier) => modifier.Label)
            .sort();
    assert.deepEqual(labels('Radar'), ['Mass', 'ScannerRange', 'SensorTargetScanAngle']);
    assert.deepEqual(labels('TinyHardpoint1'), [
        'PowerDraw',
        'ScannerRange',
        'SensorTargetScanAngle',
    ]);

    // The block keeps the id the build declared, so it reads back the way it came in.
    assert.equal(
        build.getFittedModule('TinyHardpoint1')!.engineering!.BlueprintName,
        'Sensor_LongRange',
    );
    // The scanner's own menu spelling reaches the same recipe.
    const viaMenuId = ShipLoadout.empty('Anaconda')
        .setModule('TinyHardpoint1', mod('Hpt_CloudScanner_Size0_Class5', UTILITY_MODULES))
        .applyBlueprint('TinyHardpoint1', 'Scanner_LongRange', { grade: collision.grade });
    assert.deepEqual(
        build.getFittedModule('TinyHardpoint1')!.engineering!.Modifiers,
        viaMenuId.getFittedModule('TinyHardpoint1')!.engineering!.Modifiers,
    );
    // And the resolution does not run the other way: the suite is not offered the
    // scanner's id, and the error quotes the menu it checked.
    assert.throws(
        () => build.applyBlueprint('Radar', 'Scanner_LongRange', { grade: 3 }),
        /is not offered blueprint "Scanner_LongRange"; it takes Sensor_LightWeight/,
    );
    // Once the two spellings differ, an error names both — the id the caller passed, and
    // the recipe this module would have rolled. Reporting one as the other is how a
    // resolved failure reads as a failure of something the caller never asked for.
    assert.throws(
        () => build.applyBlueprint('TinyHardpoint1', 'Sensor_LongRange', { grade: 9 }),
        /no blueprint "Sensor_LongRange" \(Scanner_LongRange on this module\) grade 9/,
    );
    // ...and stays quiet when they do not.
    assert.throws(
        () => build.applyBlueprint('Radar', 'Sensor_LongRange', { grade: 9 }),
        /no blueprint "Sensor_LongRange" grade 9/,
    );
});

test('a module sold pre-engineered can be taken further, menu or no menu', () => {
    // The Mercenary Module Reinforcement Package has no engineering menu at all, so the
    // "no menu" refusal must not fire before the sold-with check: it arrives at grade 1 and
    // its recipe carries grades 2-5, which is the climb this route exists for. The ordering
    // of those two checks inside `applyBlueprint` is what this pins — the helper behind it
    // answers correctly either way round.
    const climb = engineeringFixture.preEngineeredClimb;
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod(climb.symbol, INTERNAL_MODULES),
    );
    // The variant is sold at grade 1, which is why its recipe starts at 2.
    const [sold] = getPreEngineeredVariants(climb.symbol);
    assert.equal(sold?.grade, climb.soldAtGrade);
    assert.equal(sold?.blueprint, climb.blueprint);
    build.applyBlueprint('Slot01_Size7', climb.blueprint, {
        grade: climb.grade,
        quality: climb.quality,
    });
    const engineered = build.getFittedModule('Slot01_Size7')!.engineering!;
    assert.equal(engineered.BlueprintName, climb.blueprint);
    for (const [label, expected] of Object.entries(climb.expected)) {
        const modifier = engineered.Modifiers!.find((entry) => entry.Label === label);
        assert.equal(modifier?.OriginalValue, climb.base[label as keyof typeof climb.base], label);
        assert.ok(Math.abs(modifier!.Value! - expected) < 1e-6, `${label}: ${modifier?.Value}`);
    }
    // Grade 1 is what the module was bought with, so the recipe does not define it.
    assert.throws(
        () =>
            build.applyBlueprint('Slot01_Size7', climb.blueprint, {
                grade: climb.gradeUnavailable,
            }),
        RangeError,
    );
    // The sale is per module: a size-3 package is not sold with it, and has no menu either.
    assert.throws(
        () =>
            ShipLoadout.empty('Anaconda')
                .setModule(
                    'Slot02_Size6',
                    mod('Int_ModuleReinforcement_Size3_Class2', INTERNAL_MODULES),
                )
                .applyBlueprint('Slot02_Size6', 'ModuleReinforcement_HeavyDuty', {
                    grade: 2,
                }),
        /no registry lists an engineering menu for module "Int_ModuleReinforcement_Size3_Class2"/,
    );
});

test('a final pre-engineered Guardian weapon exposes no engineering', () => {
    const variant = getPreEngineeredVariants('Hpt_Guardian_GaussCannon_Fixed_Medium')[0]!;
    const resolved = getPreEngineeredStats(variant)!;
    const build = ShipLoadout.empty('Anaconda').setModule('MediumHardpoint1', resolved);
    const fitted = build.getFittedModule('MediumHardpoint1')!;

    assert.equal(resolved.engineeringLocked, true);
    assert.deepEqual(fitted.getAvailableBlueprints(), []);
    assert.deepEqual(fitted.getAvailableExperimentalEffects(), []);
    for (const blueprint of ['GuardianModule_Sturdy', variant.blueprint]) {
        assert.throws(
            () => fitted.applyBlueprint(blueprint, { grade: 1 }),
            /is a final pre-engineered article and accepts no further engineering/,
        );
    }
});

test('imported Guardian purchase identities remain final articles', () => {
    // The first two identities occur in the build corpus but are not rows in the narrower
    // pre-engineered catalogue. The Engineering tuple itself still identifies a final
    // article because an ordinary recipe cannot be rolled onto a stock Guardian weapon.
    const articles = [
        {
            symbol: 'Hpt_Guardian_GaussCannon_Fixed_Medium',
            blueprint: 'Weapon_HighCapacity',
            grade: 5,
        },
        {
            symbol: 'Hpt_Guardian_ShardCannon_Fixed_Medium',
            blueprint: 'Weapon_LongRange',
            grade: 5,
            experimental: 'special_super_penetrator_cooled',
        },
        {
            symbol: 'Hpt_Guardian_PlasmaLauncher_Fixed_Medium',
            blueprint: 'Weapon_Overcharged',
            grade: 1,
        },
    ] as const;

    for (const article of articles) {
        const build = ShipLoadout.fromLoadout({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'MediumHardpoint1',
                    Item: article.symbol,
                    Engineering: {
                        BlueprintName: article.blueprint,
                        Level: article.grade,
                        Quality: 1,
                        ...('experimental' in article
                            ? { ExperimentalEffect: article.experimental }
                            : {}),
                    },
                },
            ],
        });
        const fitted = build.getFittedModule('MediumHardpoint1')!;
        assert.equal(fitted.stats?.engineeringLocked, true, article.symbol);
        assert.deepEqual(fitted.getAvailableBlueprints(), [], article.symbol);
        assert.deepEqual(fitted.getAvailableExperimentalEffects(), [], article.symbol);
        assert.throws(
            () => fitted.applyBlueprint('GuardianModule_Sturdy', { grade: 1 }),
            /is a final pre-engineered article and accepts no further engineering/,
        );
        assert.throws(
            () => fitted.clearEngineering(),
            /is a final pre-engineered article and its engineering cannot be removed/,
        );
    }
});

test('imported Anti-Guardian Zone Resistance remains an engineerable stock article', () => {
    const build = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            {
                Slot: 'MediumHardpoint1',
                Item: 'Hpt_Guardian_GaussCannon_Fixed_Medium',
                Engineering: {
                    BlueprintName: 'GuardianModule_Sturdy',
                    Level: 1,
                    Quality: 1,
                },
            },
        ],
    });
    const fitted = build.getFittedModule('MediumHardpoint1')!;
    assert.equal(fitted.stats?.engineeringLocked, undefined);
    assert.deepEqual(
        fitted.getAvailableBlueprints().map((blueprint) => blueprint.fdname),
        ['GuardianModule_Sturdy'],
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
    assert.equal(build.getFittedModule('FrameShiftDrive')?.engineering, undefined);
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

test('fitting a caller-supplied record leaves the caller its own arrays', () => {
    // The snapshot is deep-frozen, so every nested value has to be *copied* first —
    // freezing one in place would make a caller's own array immutable behind its back,
    // and the next push would throw.
    const supplied: OutfittingModule = {
        ...mod('Int_CargoRack_Size7_Class1', INTERNAL_MODULES),
        restrictedToShips: ['Anaconda'],
        damageComponents: { explosive: 4, unclassified: [1] },
        projectileRange: { maximumBoundary: 0, falloffBoundary: 100000 },
    };
    ShipLoadout.empty('Anaconda').setModule('Slot01_Size7', supplied);

    assert.equal(Object.isFrozen(supplied), false);
    assert.equal(Object.isFrozen(supplied.restrictedToShips), false);
    assert.equal(Object.isFrozen(supplied.damageComponents), false);
    assert.equal(Object.isFrozen(supplied.damageComponents?.unclassified), false);
    assert.equal(Object.isFrozen(supplied.projectileRange), false);
    assert.doesNotThrow(() => (supplied.damageComponents!.unclassified as number[]).push(2));
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
    assert.equal(drive.module !== null && drive.module.symbol, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(fitted.symbol, 'Int_Hyperdrive_Size6_Class5');
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
    assert.equal(fsd.engineering?.BlueprintName, 'FSD_LongRange');

    fsd.clearEngineering();
    assert.equal(fsd.engineering, undefined);
    assert.equal(build.frameShiftDrive.optMass, 4670); // base
});

test('getAvailableBlueprints / getAvailableExperimentalEffects answer the module menu', () => {
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
    assert.throws(() => handle.symbol, /no longer contains/);
});

test('a fitted-module handle cannot operate on a replacement module', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const oldHandle = build.getFittedModule('FrameShiftDrive')!;
    build.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size5_Class5'));
    assert.throws(() => oldHandle.symbol, /no longer contains/);
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

test('a fitted zero-mass module contributes zero to unladen mass', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_DroneControl_ResourceSiphon', INTERNAL_MODULES),
    );
    assert.equal(build.unladenMass, 400);
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
    // Double Shot is the fragment cannons' recipe — the only group whose menu lists it.
    const build = ShipLoadout.empty('Anaconda').setModule(
        'LargeHardpoint1',
        mod('Hpt_Slugshot_Gimbal_Large', HARDPOINT_MODULES),
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
    assert.equal(fitted.raw.Item, fitted.symbol);
    assert.equal(fitted.raw.Slot, fitted.slot);
});

// ── Slot keys are matched case-insensitively ────────────────────────────────

test('a build imported from Inara binds every one of its lower-cased slots', () => {
    // Inara lower-cases every slot key, as the SLEF specification's own example does.
    // The build is otherwise ordinary, so every mount it names must bind.
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    assert.equal(build.modules.length, 27);
    assert.equal(build.slots().filter((s) => s.occupied).length, 27);

    // ...reached by the journal's own spelling, which is not the one it wrote.
    assert.equal(build.moduleAt('LargeMiningHardpoint1')?.Item, 'hpt_miningtoolv2_fixed_large');
    assert.equal(
        build.getFittedModule('FrameShiftDrive')?.symbol,
        'int_hyperdrive_overcharge_size5_class5',
    );
    assert.equal(build.hardpoints()[0]?.module?.symbol, 'hpt_miningtoolv2_fixed_large');
    assert.equal(build.coreModules().find((s) => s.core === 'powerPlant')?.occupied, true);

    // A handle reports the build's own spelling rather than the one it was asked with.
    assert.equal(build.getFittedModule('LargeMiningHardpoint1')?.slot, 'largemininghardpoint1');
    assert.equal(build.moduleAt('LargeMiningHardpoint1')?.Slot, 'largemininghardpoint1');

    // A key the hull genuinely has no mount for is still a miss, not a near-match.
    assert.equal(build.moduleAt('HugeHardpoint1'), null);
    assert.equal(build.getFittedModule('Military01'), null);
});

test('editing a lower-cased slot replaces its module rather than adding one', () => {
    // The defect this pins: an unbound slot made `setModule` an *insert*, so the build
    // grew a second large mining hardpoint and its mass, draw and credits with it.
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    const before = { modules: build.modules.length, mass: build.unladenMass! };

    build.setModule('LargeMiningHardpoint1', mod('Hpt_MiningLaser_Fixed_Medium', ALL_MODULES));
    assert.equal(build.modules.length, before.modules);
    assert.equal(build.moduleAt('largemininghardpoint1')?.Item, 'Hpt_MiningLaser_Fixed_Medium');
    assert.equal(build.weaponMetrics().weapons.length, 5);
    // Replacing a 4 t mining tool with a 2 t laser takes 2 t off, rather than adding 2 t.
    assert.ok(build.unladenMass! < before.mass, `${build.unladenMass} !< ${before.mass}`);

    // The slot keeps the spelling the build already had, so the export stays uniform.
    assert.ok(
        build.toLoadoutEvent().Modules.every((m) => m.Slot === m.Slot.toLowerCase()),
        'editing renamed one of the import’s mounts',
    );

    build.removeModule('LARGEMININGHARDPOINT1');
    assert.equal(build.modules.length, before.modules - 1);
    assert.equal(build.moduleAt('largemininghardpoint1'), null);
});

test('every editor and reader on the facade takes a lower-cased key', () => {
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));

    build.setModuleEnabled('FrameShiftDrive', false);
    assert.equal(build.moduleAt('frameshiftdrive')?.On, false);
    build.setModulePriority('FrameShiftDrive', 2);
    assert.equal(build.moduleAt('frameshiftdrive')?.Priority, 2);

    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
    assert.ok(build.moduleAt('frameshiftdrive')?.Engineering);
    build.clearEngineering('FrameShiftDrive');
    assert.equal(build.moduleAt('frameshiftdrive')?.Engineering, undefined);

    // ...and so does a slot the build has not filled, whose key comes from the layout.
    assert.ok(build.modulesForSlot('tinyhardpoint2', UTILITY_MODULES).length > 0);
    assert.equal(build.getFittedModule('TinyHardpoint2'), null);
    build.setModule('tinyhardpoint2', mod('Hpt_ShieldBooster_Size0_Class5', UTILITY_MODULES));
    // A fresh fit takes the layout's canonical key, having no existing one to keep.
    assert.equal(build.moduleAt('TinyHardpoint2')?.Slot, 'TinyHardpoint2');

    // The cargo hatch is protected however it is spelled.
    assert.throws(() => build.removeModule('cargohatch'), TypeError);
});

test('a lower-cased armour slot is the fitted bulkhead, not the stock alloy', () => {
    // The fixture's own bulkhead is grade 1, which *is* the Type-11's stock lightweight
    // alloy, so it cannot tell a bound slot from the fallback. Grade 3 — Military Grade
    // Composite — can: 1225 hull points against the 630 a build with no armour reports.
    const upgrade = (slot: string): number => {
        const data = structuredClone(inaraFixture[0]!.data) as unknown as LoadoutEvent;
        const modules = data.Modules.map((m) =>
            m.Slot === 'armour' ? { ...m, Slot: slot, Item: 'lakonminer_armour_grade3' } : m,
        );
        return ShipLoadout.fromLoadout({ ...data, Modules: modules }).armourMetrics().hitPoints;
    };
    assert.equal(upgrade('Armour'), 1225);
    assert.equal(upgrade('armour'), upgrade('Armour'));
    // ...and the untouched fixture's stock-grade bulkhead is the 630 it should be.
    assert.equal(ShipLoadout.fromSlef(JSON.stringify(inaraFixture)).armourMetrics().hitPoints, 630);
});

test('a lower-cased build exports in slot order', () => {
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    // Ordering by slot resolves the layout's keys against the build's own spelling, so
    // the hardpoints lead and nothing is left to the unrecognised-slot tail.
    const ordered = build.toLoadoutEvent({ moduleOrder: 'slots' }).Modules.map((m) => m.Slot);
    assert.deepEqual(ordered.slice(0, 5), [
        'largemininghardpoint1',
        'mediummininghardpoint1',
        'mediummininghardpoint2',
        'mediumhardpoint3',
        'smallmininghardpoint1',
    ]);
    // Nothing was left to that tail: the whole export follows the hull's layout order.
    const layoutOrder = ShipLoadout.empty('LakonMiner')
        .slots()
        .map((s) => s.key.toLowerCase())
        .filter((key) => ordered.includes(key));
    assert.deepEqual(ordered, layoutOrder);
    assert.equal(ordered.length, 27);
});

test("a core mount's function name reaches its slot only where casing is the difference", () => {
    // Five of the seven `CoreSlotType` values differ from their slot key by case alone,
    // so case-insensitive matching resolves them.
    // `thrusters` and `sensors` are different words — `MainEngines` and `Radar` — and
    // still miss. This is what the README promises a consumer; pin it so it cannot drift.
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    assert.equal(build.getFittedModule('frameShiftDrive')?.symbol, 'Int_Hyperdrive_Size6_Class5');
    for (const core of ['powerPlant', 'lifeSupport', 'powerDistributor', 'fuelTank'] as const) {
        assert.doesNotThrow(() => build.modulesForSlot(core, CORE_MODULES), core);
    }
    for (const core of ['thrusters', 'sensors'] as const) {
        assert.equal(build.getFittedModule(core), null, core);
        assert.throws(() => build.modulesForSlot(core, CORE_MODULES), RangeError, core);
        assert.throws(
            () => build.setModule(core, mod('Int_Engine_Size6_Class5')),
            RangeError,
            core,
        );
    }
});

test('two spellings of one mount resolve to the same entry everywhere', () => {
    // A producer writing both spellings is pathological, but it must not make the
    // readers and the editors disagree about which of the two they mean.
    const data = structuredClone(inaraFixture[0]!.data) as unknown as LoadoutEvent;
    const build = ShipLoadout.fromLoadout({
        ...data,
        // `tinyhardpoint1` (a shield booster) is already in there; this is the same
        // mount spelled the journal's way, added after it.
        Modules: [...data.Modules, { Slot: 'TinyHardpoint1', Item: 'hpt_chafflauncher_tiny' }],
    });
    assert.equal(build.modules.length, 28);

    // An exactly spelled key wins, so both of these name the journal-spelled entry.
    assert.equal(build.moduleAt('TinyHardpoint1')?.Item, 'hpt_chafflauncher_tiny');
    assert.equal(build.getFittedModule('TinyHardpoint1')?.slot, 'TinyHardpoint1');
    // Ordering for export picks that same entry — the loser keeps its own slot in the
    // export rather than being dropped, so no module is ever lost to a duplicate.
    const ordered = build.toLoadoutEvent({ moduleOrder: 'slots' }).Modules;
    const tiny = ordered.filter((m) => m.Slot.toLowerCase() === 'tinyhardpoint1');
    assert.deepEqual(
        tiny.map((m) => m.Slot),
        ['TinyHardpoint1', 'tinyhardpoint1'],
    );
    assert.equal(ordered.length, 28);

    // An exact spelling still addresses its own entry, so each of the two is
    // individually removable and neither is stranded.
    build.removeModule('tinyhardpoint1');
    assert.equal(build.modules.length, 27);
    assert.equal(build.moduleAt('TinyHardpoint1')?.Item, 'hpt_chafflauncher_tiny');
    // With the duplicate gone, the survivor answers to either spelling again.
    assert.equal(build.moduleAt('tinyhardpoint1')?.Item, 'hpt_chafflauncher_tiny');
});

test('when neither spelling of a duplicated mount is exact, the earlier one wins', () => {
    // The other half of the tie-break: with no exact match to prefer, insertion order
    // decides — and every part of the class has to decide the same way.
    const data = structuredClone(inaraFixture[0]!.data) as unknown as LoadoutEvent;
    const build = ShipLoadout.fromLoadout({
        ...data,
        // Both name the layout's `TinyHardpoint1`; neither is spelled the way it is.
        Modules: [...data.Modules, { Slot: 'TINYHARDPOINT1', Item: 'hpt_chafflauncher_tiny' }],
    });

    // `tinyhardpoint1` came first, so it is the entry the readers name...
    assert.equal(build.moduleAt('TinyHardpoint1')?.Item, 'hpt_shieldbooster_size0_class5');
    assert.equal(build.getFittedModule('TinyHardpoint1')?.slot, 'tinyhardpoint1');
    // ...the one the utility mount reports as fitted...
    const mount = build.utilityMounts().find((s) => s.key === 'TinyHardpoint1')!;
    assert.equal(mount.module?.symbol, 'hpt_shieldbooster_size0_class5');
    // ...and the one that takes the mount's place in a slot-ordered export, leaving the
    // later spelling in the tail rather than dropping it.
    const ordered = build.toLoadoutEvent({ moduleOrder: 'slots' }).Modules.map((m) => m.Slot);
    assert.deepEqual(
        ordered.filter((slot) => slot.toLowerCase() === 'tinyhardpoint1'),
        ['tinyhardpoint1', 'TINYHARDPOINT1'],
    );
    assert.equal(ordered.at(-1), 'TINYHARDPOINT1');
    assert.equal(ordered.length, 28);

    // The editors agree with the readers: this replaces, and does not add a third.
    build.setModule('TinyHardpoint1', mod('Hpt_ChaffLauncher_Tiny', UTILITY_MODULES));
    assert.equal(build.modules.length, 28);
    assert.equal(build.moduleAt('tinyhardpoint1')?.Item, 'Hpt_ChaffLauncher_Tiny');
});
