import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ShipLoadout } from './ship-loadout.js';
import type { LoadoutSlot } from './loadout-slot.js';
import { heatInputFor } from './internal/loadout-metrics.js';
import { loadoutSlotName } from './internal/loadout-views.js';
import type { EngineeringModifier, LoadoutEvent, LoadoutModule } from './slef.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import { CORE_MODULES } from './modules-core.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import { UTILITY_MODULES } from './modules-utility.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.jsonc' with { type: 'json' };
import expected from '../../../fixtures/ships/jump-range.jsonc' with { type: 'json' };
import metrics from '../../../fixtures/ships/build-metrics.jsonc' with { type: 'json' };
import slotsFixture from '../../../fixtures/ships/ship-slots.jsonc' with { type: 'json' };
import operationsFixture from '../../../fixtures/ships/operations.jsonc' with { type: 'json' };
import engineeringFixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };
import preEngineeredFixture from '../../../fixtures/ships/pre-engineered.jsonc' with { type: 'json' };
import heatFixture from '../../../fixtures/ships/heat.jsonc' with { type: 'json' };
import slapacondaJournal from '../../../fixtures/ships/journal-anaconda-slapaconda.jsonc' with { type: 'json' };
import inaraFixture from '../../../fixtures/ships/slef-inara-type-11.jsonc' with { type: 'json' };
import lynxCapture from '../../../fixtures/ships/slef-inara-lynx-highliner.jsonc' with { type: 'json' };
import lynxRescueJournal from '../../../fixtures/ships/journal-lynx-highliner-rescue.jsonc' with { type: 'json' };
import lynxJournal from '../../../fixtures/ships/journal-lynx-highliner-rescue01-current.jsonc' with { type: 'json' };
import corvetteBeamsJournal from '../../../fixtures/ships/journal-federation-corvette-beams.jsonc' with { type: 'json' };
import corvetteMixedJournal from '../../../fixtures/ships/journal-federation-corvette-mixed.jsonc' with { type: 'json' };
import corvetteMultiroleJournal from '../../../fixtures/ships/journal-federation-corvette-multirole.jsonc' with { type: 'json' };
import cobraMkVJournal from '../../../fixtures/ships/journal-cobra-mkv.jsonc' with { type: 'json' };
import corsairJournal from '../../../fixtures/ships/journal-corsair.jsonc' with { type: 'json' };
import kestrelMkIIJournal from '../../../fixtures/ships/journal-kestrel-mkii.jsonc' with { type: 'json' };
import pantherCapture from '../../../fixtures/ships/slef-inara-panther-mkii.jsonc' with { type: 'json' };
import pantherJournal from '../../../fixtures/ships/journal-panther-mkii-fat-arse.jsonc' with { type: 'json' };
import deepBlackJournal from '../../../fixtures/ships/journal-the-deep-black.jsonc' with { type: 'json' };
import spireOpsJournal from '../../../fixtures/ships/journal-python-mkii-spire-ops.jsonc' with { type: 'json' };
import cutterCapture from '../../../fixtures/ships/slef-inara-cutter-antixeno.jsonc' with { type: 'json' };
import { ALL_MODULES } from './modules-all.js';
import { SHIPS, getShipBySymbol } from './ships.js';
import type { DamageTypeValues } from './resistances.js';
import { damageFalloff, damagePerSecond } from './weapons.js';
import type { HeatState } from './heat.js';
import { powerBudget as calculatePowerBudget } from './power.js';
import { thrusterMassCurveMultiplier } from './mobility.js';
import { getPreEngineeredVariants } from './pre-engineered.js';
import { getPreEngineeredJournalModifiers, getPreEngineeredStats } from './pre-engineered-stats.js';

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

test('slot views state whether a mount can be emptied', () => {
    const slots = ShipLoadout.default('SideWinder').slots();
    assert.deepEqual(
        slots.find((slot) => slot.kind === 'cargoHatch'),
        {
            key: 'CargoHatch',
            kind: 'cargoHatch',
            size: 1,
            name: 'Cargo Hatch',
            module: slots.find((slot) => slot.kind === 'cargoHatch')?.module ?? null,
            removable: false,
            immovableReason: 'cargoHatch',
        },
    );
    const required = slots.filter((slot) => slot.kind === 'core' || slot.kind === 'armour');
    assert.equal(required.length, 8);
    assert.ok(required.every((slot) => !slot.removable && slot.immovableReason === 'requiredSlot'));
    assert.ok(
        slots
            .filter(
                (slot) =>
                    slot.kind !== 'cargoHatch' && slot.kind !== 'core' && slot.kind !== 'armour',
            )
            .every((slot) => slot.removable),
    );

    for (const ship of SHIPS) {
        const fixed = ShipLoadout.default(ship.symbol)
            .slots()
            .filter((slot) => slot.kind === 'core' || slot.kind === 'armour');
        assert.equal(fixed.length, 8, ship.symbol);
        assert.ok(
            fixed.every((slot) => !slot.removable && slot.immovableReason === 'requiredSlot'),
            ship.symbol,
        );
    }
});

test('one-per-ship modules are filtered, rejected on edit and diagnosed on import', () => {
    const generator = mod('Int_ShieldGenerator_Size6_Class3', INTERNAL_MODULES);
    const build = ShipLoadout.empty('Anaconda').setModule('Slot01_Size7', generator);
    assert.ok(
        build
            .modulesForSlot('Slot02_Size6')
            .every((candidate) => candidate.exclusionGroup !== 'shieldGenerator'),
    );
    assert.throws(
        () => build.setModule('Slot02_Size6', generator),
        /shieldGenerator is limited to one per ship/,
    );

    const imported = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [
            { Slot: 'Slot01_Size7', Item: generator.symbol },
            { Slot: 'Slot02_Size6', Item: generator.symbol },
        ],
    });
    assert.equal(imported.validation.valid, false);
    assert.ok(
        imported.validation.issues.some((issue) => issue.code === 'duplicateExclusiveModule'),
    );
});

test('experimental-weapon limits are filtered, enforced, increased and diagnosed', () => {
    const { catalogue } = operationsFixture.moduleLimits;
    const weapon = mod(catalogue.weapon, HARDPOINT_MODULES);
    const stabiliser3 = mod(catalogue.increases[0]!.symbol, INTERNAL_MODULES);
    const stabiliser5 = mod(catalogue.increases[1]!.symbol, INTERNAL_MODULES);
    const build = ShipLoadout.empty('Anaconda')
        .setModule('HugeHardpoint1', weapon)
        .setModule('LargeHardpoint1', weapon)
        .setModule('LargeHardpoint2', weapon)
        .setModule('LargeHardpoint3', weapon);

    assert.ok(
        build
            .modulesForSlot('MediumHardpoint1')
            .every((candidate) => candidate.limitGroup !== operationsFixture.moduleLimits.group),
    );
    assert.throws(
        () => build.setModule('MediumHardpoint1', weapon),
        /experimentalWeapon would have 5 modules but the ship allows 4/,
    );

    build.setModule('Slot05_Size5', stabiliser3).setModule('MediumHardpoint1', weapon);
    assert.throws(
        () => build.setModule('MediumHardpoint2', weapon),
        /experimentalWeapon would have 6 modules but the ship allows 5/,
    );
    build.setModule('Slot05_Size5', stabiliser5).setModule('MediumHardpoint2', weapon);
    assert.throws(
        () => build.setModule('Slot05_Size5', stabiliser3),
        /experimentalWeapon would have 6 modules but the ship allows 5/,
    );
    const stabiliserSlot = build.slots().find((slot) => slot.key === 'Slot05_Size5');
    assert.ok(stabiliserSlot);
    assert.deepEqual(
        {
            key: stabiliserSlot.key,
            removable: stabiliserSlot.removable,
            immovableReason: stabiliserSlot.immovableReason,
        },
        operationsFixture.moduleLimits.removal.expected,
    );
    assert.throws(
        () => build.removeModule('Slot05_Size5'),
        /experimentalWeapon would have 6 modules but the ship allows 4/,
    );
    assert.equal(
        build.validation.issues.some((issue) => issue.code === 'moduleLimitExceeded'),
        false,
    );
    build.removeModule('MediumHardpoint2').removeModule('MediumHardpoint1');
    assert.equal(build.slots().find((slot) => slot.key === 'Slot05_Size5')?.removable, true);
    assert.doesNotThrow(() => build.removeModule('Slot05_Size5'));

    const imported = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [
            'HugeHardpoint1',
            'LargeHardpoint1',
            'LargeHardpoint2',
            'LargeHardpoint3',
            'MediumHardpoint1',
        ].map((Slot) => ({ Slot, Item: weapon.symbol })),
    });
    assert.deepEqual(
        imported.validation.issues.find((issue) => issue.code === 'moduleLimitExceeded')?.params,
        { group: operationsFixture.moduleLimits.group, count: 5, limit: 4 },
    );
    assert.doesNotThrow(() => imported.removeModule('MediumHardpoint1'));
});

test('the facade reports loaded mobility, shield recovery and cell-bank pools', () => {
    const stock = ShipLoadout.default('SideWinder');
    const mobility = stock.mobilityMetrics();
    assert.ok(mobility);
    assert.ok(mobility.speed > 0);
    assert.ok(mobility.boost > mobility.speed);
    assert.ok(stock.mobilityMetrics({ enginesPips: 2 })!.speed < mobility.speed);

    const enhanced = ShipLoadout.default('SideWinder')
        .setModule('PowerPlant', mod('Int_PowerPlant_Size2_Class5', CORE_MODULES))
        .setModule('MainEngines', mod('Int_Engine_Size2_Class5_Fast', CORE_MODULES));
    const enhancedMobility = enhanced.mobilityMetrics()!;
    assert.notEqual(
        enhancedMobility.massCurveMultiplier,
        enhancedMobility.rotationMassCurveMultiplier,
    );
    const baseEnhanced = enhanced.fittedModuleAt('MainEngines')!.effectiveStats!;
    enhanced.applyBlueprint('MainEngines', 'Engine_Dirty', { grade: 1 });
    const engineeredEnhanced = enhanced.fittedModuleAt('MainEngines')!.effectiveStats!;
    const enhancedPerformanceRatio =
        engineeredEnhanced.optMultiplier! / baseEnhanced.optMultiplier!;
    assert.ok(
        near(
            engineeredEnhanced.optSpeedMultiplier!,
            baseEnhanced.optSpeedMultiplier! * enhancedPerformanceRatio,
        ),
    );
    assert.ok(
        near(
            engineeredEnhanced.maxRotationMultiplier!,
            baseEnhanced.maxRotationMultiplier! * enhancedPerformanceRatio,
        ),
    );
    assert.notEqual(enhanced.mobilityMetrics()!.speed, enhancedMobility.speed);

    const lynx = ShipLoadout.default('MediumTransport01');
    const lynxFourPips = lynx.mobilityMetrics({ enginesPips: 4 })!;
    const lynxZeroPips = lynx.mobilityMetrics({ enginesPips: 0 })!;
    assert.ok(lynxZeroPips.pitch < lynxFourPips.pitch);
    assert.ok(near(lynxZeroPips.pitch / lynxFourPips.pitch, 23 / 26));
    assert.equal(lynxZeroPips.roll, lynxFourPips.roll);
    assert.equal(lynxZeroPips.yaw, lynxFourPips.yaw);

    const tuned = ShipLoadout.fromSlef(slefString);
    const fittedThrusters = tuned.fittedModuleAt('MainEngines')!;
    const effectiveThrusters = fittedThrusters.effectiveStats!;
    const baseThrusters = getModuleBySymbol(fittedThrusters.symbol, ALL_MODULES)!;
    const performanceRatio = effectiveThrusters.optMultiplier! / baseThrusters.optMultiplier!;
    assert.ok(
        near(effectiveThrusters.minMultiplier!, baseThrusters.minMultiplier! * performanceRatio),
    );
    assert.ok(
        near(effectiveThrusters.maxMultiplier!, baseThrusters.maxMultiplier! * performanceRatio),
    );
    const tunedMainFuel = tuned.fuelCapacity!.main;
    assert.equal(
        tuned.mobilityMetrics()!.massCurveMultiplier,
        thrusterMassCurveMultiplier(tuned.unladenMass! + tunedMainFuel, {
            minMass: effectiveThrusters.minMass!,
            optMass: effectiveThrusters.optMass!,
            maxMass: effectiveThrusters.maxMass!,
            minMultiplier: effectiveThrusters.minMultiplier!,
            optMultiplier: effectiveThrusters.optMultiplier!,
            maxMultiplier: effectiveThrusters.maxMultiplier!,
        }),
    );

    const recovery = stock.shieldRecovery();
    assert.ok(recovery);
    assert.ok(recovery.recoveryTime >= 16);
    assert.ok(recovery.regenTime > 0);

    const bank = mod('Int_ShieldCellBank_Size6_Class3', INTERNAL_MODULES);
    const withoutPlant = ShipLoadout.empty('Anaconda').setModule('Slot01_Size7', bank).cellBanks();
    assert.deepEqual(
        withoutPlant.banks.map(({ powered }) => powered),
        [false],
    );
    assert.equal(withoutPlant.totalCells, 0);
    assert.equal(withoutPlant.totalRestorable, 0);

    const { powerDraw, ...bankWithoutPowerDraw } = bank;
    assert.ok(powerDraw !== undefined && powerDraw > 0);
    const unresolvedWithoutPlant = ShipLoadout.empty('Anaconda')
        .setModule('Slot01_Size7', bankWithoutPowerDraw)
        .cellBanks();
    assert.deepEqual(
        unresolvedWithoutPlant.banks.map(({ powered }) => powered),
        [false],
    );
    assert.equal(unresolvedWithoutPlant.totalCells, 0);
    assert.equal(unresolvedWithoutPlant.totalRestorable, 0);

    const banked = ShipLoadout.default('Anaconda')
        .setModule('Slot02_Size6', bank)
        .setModule('Slot01_Size7', bank);
    const cells = banked.cellBanks();
    assert.equal(cells.banks.length, 2);
    assert.deepEqual(
        cells.banks.map(({ slot }) => slot),
        ['Slot01_Size7', 'Slot02_Size6'],
    );
    assert.deepEqual(
        cells.banks.map(({ powered }) => powered),
        [true, true],
    );
    assert.ok(cells.totalCells > 0);
    assert.ok(cells.totalRestorable > 0);

    banked.setModuleEnabled('Slot02_Size6', false);
    const disabled = banked.cellBanks();
    assert.deepEqual(
        disabled.banks.map(({ slot, powered }) => ({ slot, powered })),
        [
            { slot: 'Slot01_Size7', powered: true },
            { slot: 'Slot02_Size6', powered: false },
        ],
    );
    assert.equal(disabled.totalCells, disabled.banks[0]!.cells);
    assert.equal(
        disabled.totalRestorable,
        disabled.banks[0]!.reinforcement * disabled.banks[0]!.cells,
    );

    const beamForSize = {
        1: 'Hpt_BeamLaser_Gimbal_Small',
        2: 'Hpt_BeamLaser_Gimbal_Medium',
        3: 'Hpt_BeamLaser_Gimbal_Large',
        4: 'Hpt_BeamLaser_Gimbal_Huge',
    } as const;
    const combat = ShipLoadout.default('Anaconda');
    for (const slot of combat.slots('hardpoint')) {
        const symbol = beamForSize[slot.size as keyof typeof beamForSize];
        assert.ok(symbol);
        combat.setModule(slot.key, mod(symbol, HARDPOINT_MODULES)).setModulePriority(slot.key, 0);
    }
    combat
        .setModule('Slot01_Size7', bank)
        .setModulePriority('Slot01_Size7', 4)
        .setModule('PowerPlant', mod('Int_PowerPlant_Size6_Class4', CORE_MODULES));
    const combatPower = combat.powerBudget();
    assert.equal(combatPower.bands[0]?.poweredDeployed, true);
    assert.equal(combatPower.bands[4]?.poweredRetracted, true);
    assert.equal(combatPower.bands[4]?.poweredDeployed, false);
    const shed = combat.cellBanks();
    assert.deepEqual(
        shed.banks.map(({ powered }) => powered),
        [false],
    );
    assert.equal(shed.totalCells, 0);
    assert.equal(shed.totalRestorable, 0);
});

test('mobility returns null before requiring mass when no thrusters are fitted', () => {
    const empty = ShipLoadout.empty('SideWinder');
    assert.equal(empty.mobilityMetrics(), null);
    assert.throws(() => empty.mobilityMetrics({ enginesPips: 5 }), RangeError);
});

test('explicit mobility fuel overrides the tank load and excludes reserve mass', () => {
    const fixture = operationsFixture.mobility.facadeFuelOverride;
    const build = ShipLoadout.fromLoadout(fixture.loadout);
    assert.deepEqual(build.fuelCapacity, { main: 4, reserve: 0.3 });
    const metrics = build.mobilityMetrics(fixture.options)!;
    for (const [field, expected] of Object.entries(fixture.expected)) {
        assert.ok(near(metrics[field as keyof typeof metrics], expected), field);
    }
    assert.ok(build.mobilityMetrics()!.speed < metrics.speed);
    for (const invalid of fixture.invalidLoads) {
        assert.throws(() => build.mobilityMetrics(invalid.options), {
            name: invalid.expectedError,
        });
    }
});

test('metric methods validate pips before build state and name their own scopes', () => {
    const empty = ShipLoadout.empty('SideWinder');
    assert.throws(() => empty.mobilityMetrics({ enginesPips: 5 }), {
        name: 'RangeError',
        message: 'ShipLoadout.mobilityMetrics: enginesPips must be a finite number from 0 to 4',
    });
    assert.throws(() => empty.mobilityMetricsResult({ enginesPips: 5 }), {
        name: 'RangeError',
        message:
            'ShipLoadout.mobilityMetricsResult: enginesPips must be a finite number from 0 to 4',
    });
    assert.throws(() => empty.shieldMetrics({ systemsPips: 5 }), {
        name: 'RangeError',
        message: 'ShipLoadout.shieldMetrics: systemsPips must be a finite number from 0 to 4',
    });
    assert.throws(() => empty.shieldMetricsResult({ systemsPips: 5 }), {
        name: 'RangeError',
        message: 'ShipLoadout.shieldMetricsResult: systemsPips must be a finite number from 0 to 4',
    });
    assert.equal(empty.shieldRecovery(), null);
    assert.throws(() => empty.shieldRecovery({ systemsPips: 5 }), {
        name: 'RangeError',
        message: 'ShipLoadout.shieldRecovery: systemsPips must be a finite number from 0 to 4',
    });
    assert.throws(() => empty.shieldRecoveryResult({ systemsPips: 5 }), {
        name: 'RangeError',
        message:
            'ShipLoadout.shieldRecoveryResult: systemsPips must be a finite number from 0 to 4',
    });
});

test('mobility and shield metrics stop when the power budget sheds their modules', () => {
    const disabled = ShipLoadout.default('SideWinder').setModuleEnabled('PowerPlant', false);
    assert.equal(disabled.powerBudget().available, 0);
    assert.equal(disabled.mobilityMetrics(), null);
    assert.equal(disabled.shieldRecovery(), null);

    const source = ShipLoadout.default('Anaconda').toLoadoutEvent();
    const overloaded = ShipLoadout.fromLoadout({
        ...source,
        Modules: source.Modules.map((module) => ({
            ...module,
            ...(module.Slot === 'PowerPlant' ? { Item: 'Int_Powerplant_Size2_Class1' } : {}),
            Priority:
                module.Slot === 'MainEngines' ||
                module.Item.toLowerCase().startsWith('int_shieldgenerator')
                    ? 4
                    : 0,
        })),
    });
    const budget = overloaded.powerBudget();
    assert.ok(budget.available > 0);
    assert.equal(budget.bands[4]?.poweredRetracted, false);
    assert.equal(overloaded.mobilityMetrics(), null);
    assert.equal(overloaded.shieldMetrics(), null);
    assert.equal(overloaded.shieldRecovery(), null);
    assert.equal(overloaded.mobilityMetricsResult().issues[0]?.reason, 'shed');
    assert.deepEqual(overloaded.shieldMetricsResult().issues[0], {
        field: 'shieldGenerator',
        reason: 'shed',
        slot: 'Slot03_Size6',
        symbol: 'int_shieldgenerator_size6_class1',
        message:
            'Slot03_Size6: int_shieldgenerator_size6_class1 is not powered with hardpoints retracted',
        params: {
            field: 'shieldGenerator',
            reason: 'shed',
            slot: 'Slot03_Size6',
            symbol: 'int_shieldgenerator_size6_class1',
        },
    });
    assert.equal(overloaded.shieldRecoveryResult().issues[0]?.reason, 'shed');
});

test('a resolved plant without usable capacity is diagnosed by metric results', () => {
    const incompletePlant = { ...mod('Int_Powerplant_Size8_Class5') };
    delete incompletePlant.powerCapacity;
    const build = ShipLoadout.default('Anaconda').setModule('PowerPlant', incompletePlant);

    assert.equal(build.validation.complete, true);
    assert.deepEqual(build.validation.issues, []);
    assert.equal(build.shieldMetrics(), null);
    assert.equal(build.shieldMetricsResult().issues[0]?.field, 'powerCapacity');
    assert.equal(build.shieldMetricsResult().issues[0]?.reason, 'unresolved');

    const assertInvalidPower = (invalid: ShipLoadout, budgetThrows: boolean): void => {
        assert.equal(invalid.mobilityMetrics(), null);
        assert.equal(invalid.shieldMetrics(), null);
        assert.equal(invalid.shieldRecovery(), null);
        for (const result of [
            invalid.mobilityMetricsResult(),
            invalid.shieldMetricsResult(),
            invalid.shieldRecoveryResult(),
        ]) {
            assert.equal(result.issues[0]?.field, 'powerCapacity');
            assert.equal(result.issues[0]?.reason, 'invalid');
        }
        if (budgetThrows) assert.throws(() => invalid.powerBudget(), RangeError);
    };
    for (const capacity of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
        const plant = { ...mod('Int_Powerplant_Size8_Class5'), powerCapacity: capacity };
        assertInvalidPower(
            ShipLoadout.default('Anaconda').setModule('PowerPlant', plant),
            capacity !== 0,
        );
    }

    const source = ShipLoadout.default('Anaconda').toLoadoutEvent();
    const journalInvalid = ShipLoadout.fromLoadout({
        ...source,
        Modules: source.Modules.map((module) =>
            module.Slot === 'PowerPlant'
                ? {
                      ...module,
                      Engineering: {
                          BlueprintName: 'PowerPlant_Overcharged',
                          Level: 1,
                          Quality: 1,
                          Modifiers: [{ Label: 'PowerCapacity', Value: -5 }],
                      },
                  }
                : module,
        ),
    });
    assertInvalidPower(journalInvalid, true);
});

test('metric results diagnose an invalid known power draw without weakening powerBudget', () => {
    const build = ShipLoadout.default('Anaconda');
    const utility = build.slots('utility')[0];
    assert.ok(utility);
    build.setModule(utility.key, {
        ...mod('Hpt_ShieldBooster_Size0_Class1', UTILITY_MODULES),
        powerDraw: -1,
    });

    assert.throws(() => build.powerBudget(), RangeError);
    assert.equal(build.mobilityMetrics(), null);
    assert.equal(build.shieldMetrics(), null);
    assert.equal(build.shieldRecovery(), null);
    for (const result of [
        build.mobilityMetricsResult(),
        build.shieldMetricsResult(),
        build.shieldRecoveryResult(),
    ]) {
        assert.deepEqual(result.issues[0], {
            field: 'powerDraw',
            reason: 'invalid',
            slot: utility.key,
            symbol: 'Hpt_ShieldBooster_Size0_Class1',
            message: `${utility.key}: Hpt_ShieldBooster_Size0_Class1 has invalid powerDraw`,
            params: {
                field: 'powerDraw',
                reason: 'invalid',
                slot: utility.key,
                symbol: 'Hpt_ShieldBooster_Size0_Class1',
            },
        });
    }
});

test('shield results distinguish an absent generator from a shed one', () => {
    const result = ShipLoadout.empty('Anaconda')
        .setModule('PowerPlant', mod('Int_Powerplant_Size8_Class5'))
        .shieldMetricsResult();
    assert.equal(result.complete, false);
    assert.equal(result.issues[0]?.field, 'shieldGenerator');
    assert.equal(result.issues[0]?.reason, 'missing');
});

test('retailCredits prices assembled builds directly and qualifies missing module prices', () => {
    const stock = ShipLoadout.default('Anaconda');
    const credits = stock.retailCredits();
    const event = stock.toLoadoutEvent();
    assert.equal(credits.hull, 142456440);
    assert.ok(credits.modules > 0);
    assert.equal(credits.rebuy, Math.trunc((credits.hull + credits.modules) * 0.05));
    assert.deepEqual(
        { hull: credits.hull, modules: credits.modules, rebuy: credits.rebuy },
        { hull: event.HullValue, modules: event.ModulesValue, rebuy: event.Rebuy },
    );
    assert.ok(Object.isFrozen(credits));
    assert.ok(Object.isFrozen(credits.unpriced));

    const unknown = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_CorrosionProofCargoRack_Size5_Class1', INTERNAL_MODULES),
    );
    assert.ok(unknown.retailCredits().unpriced.length > 0);
});

test('mercCoinCost totals the fitted purchases and follows live edits', () => {
    const expected = operationsFixture.mercCoinCost;
    const build = ShipLoadout.default(expected.ship);
    assert.equal(build.mercCoinCost(), 0);

    for (const module of expected.modules) {
        const variant = getPreEngineeredVariants(module.symbol).find(
            (candidate) => candidate.blueprint === module.blueprint,
        )!;
        build.setPreEngineeredVariant(module.slot, variant);
    }
    assert.equal(build.mercCoinCost(), expected.expected);

    const removed = expected.modules[0]!;
    build.setModule(removed.slot, getModuleBySymbol(removed.symbol, ALL_MODULES)!);
    assert.equal(build.mercCoinCost(), expected.expected - removed.cost);

    build.applyBlueprint(removed.slot, removed.blueprint, { grade: 5 });
    assert.equal(build.mercCoinCost(), expected.expected);
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
    assert.equal(build.fittedModules().length, slefFixture[0]!.data.Modules.length);
});

test('loadout validation makes empty builds explicit', () => {
    const captured = ShipLoadout.fromSlef(slefString);
    assert.equal(captured.validation.valid, true);
    assert.equal(captured.validation.complete, true);
    assert.deepEqual(captured.validation.issues, []);

    const empty = ShipLoadout.empty('SideWinder');
    assert.equal(empty.validation.valid, true);
    assert.equal(empty.validation.complete, false);
    assert.ok(empty.validation.issues.some((issue) => issue.code === 'missingRequiredSlot'));

    const drive = getModuleBySymbol('Int_Hyperdrive_Size2_Class5', CORE_MODULES)!;
    const disguised = ShipLoadout.fromLoadout({
        Ship: 'sidewinder',
        Modules: [{ Slot: 'PaintJob', Item: drive.symbol }],
    });
    assert.equal(disguised.validation.valid, false);
    assert.ok(disguised.validation.issues.some((issue) => issue.code === 'unknownSlot'));
});

test('fromLoadout restores a known hull cargo hatch when omitted or unresolved', () => {
    const source = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const defaultHatch = source.Modules.find(
        (module) => module.Slot.toLowerCase() === 'cargohatch',
    )!;
    const withoutHatch = source.Modules.filter(
        (module) => module.Slot.toLowerCase() !== 'cargohatch',
    );

    const omitted = ShipLoadout.fromLoadout({ ...source, Modules: withoutHatch });
    assert.equal(
        omitted.fittedModuleAt('CargoHatch')!.symbol.toLowerCase(),
        defaultHatch.Item.toLowerCase(),
    );
    // The one outcome shape real captures produce: third-party exports omit the hatch,
    // so this is what a consumer reading `importOutcomes` almost always sees. A `null`
    // `sourceSymbol` is what marks it as the mount import fills unasked.
    assert.deepEqual(omitted.importOutcomes, [
        {
            action: 'defaulted',
            slot: 'CargoHatch',
            sourceSymbol: null,
            // The hull default's own casing, not the capture's — nothing was captured.
            replacementSymbol: 'ModularCargoBayDoor',
        },
    ]);
    assert.deepEqual(omitted.validation, { valid: true, complete: true, issues: [] });
    assert.equal(omitted.modulesValue, source.ModulesValue);
    assert.equal(omitted.rebuy, source.Rebuy);
    const omittedSource = omitted.toLoadoutEvent({ credits: 'source' });
    assert.equal(omittedSource.ModulesValue, source.ModulesValue);
    assert.equal(omittedSource.Rebuy, source.Rebuy);

    const capturedMass = 55.6;
    const capturedCargo = 12;
    const unresolvedBuild = ShipLoadout.fromLoadout({
        ...source,
        UnladenMass: capturedMass,
        CargoCapacity: capturedCargo,
        Modules: [
            ...withoutHatch,
            {
                Slot: 'cargohatch',
                Item: 'FutureCargoHatch',
                On: false,
                Value: 999,
                Engineering: {
                    BlueprintName: 'FutureBlueprint',
                    Level: 5,
                    Quality: 1,
                    Modifiers: [{ Label: 'PowerDraw', Value: 999 }],
                },
            },
        ],
    });
    const unresolved = unresolvedBuild.fittedModuleAt('CargoHatch')!;
    assert.equal(unresolved.symbol.toLowerCase(), defaultHatch.Item.toLowerCase());
    // How the commander ran the mount survives the substitution; what the article was
    // does not.
    assert.equal(unresolved.on, false);
    assert.equal(unresolved.priority, undefined);
    assert.equal(unresolved.engineering, undefined);
    assert.equal(unresolved.effectiveStats!.powerDraw, 0.6);
    assert.equal(unresolved.raw.Value, undefined);
    assert.equal(unresolvedBuild.unladenMass, source.UnladenMass);
    assert.equal(unresolvedBuild.cargoCapacity, source.CargoCapacity);
    assert.equal(unresolvedBuild.modulesValue, null);
    assert.equal(unresolvedBuild.rebuy, null);

    // A hull-family hatch symbol is resolved rather than normalized: the catalogue
    // carries the article once, under the standard hatch, and every variant of it has
    // that record's zero mass, zero price and 0.6 MW draw. Replacing one would discard a
    // capture's power state and invalidate its credits over a free, weightless mount.
    const futureVariantBuild = ShipLoadout.fromLoadout({
        ...source,
        Modules: [
            ...withoutHatch,
            { Slot: 'cargohatch', Item: 'ModularCargoBayDoorUnknown', Value: 999 },
        ],
    });
    const futureVariant = futureVariantBuild.fittedModuleAt('CargoHatch')!;
    assert.equal(futureVariant.symbol, 'ModularCargoBayDoorUnknown');
    assert.equal(futureVariant.raw.Value, 999);
    assert.deepEqual(futureVariantBuild.importOutcomes, []);
    assert.equal(futureVariantBuild.modulesValue, source.ModulesValue);
    assert.equal(futureVariantBuild.rebuy, source.Rebuy);

    const fdl = ShipLoadout.default('FerDeLance').toLoadoutEvent();
    const wrongHatch = fdl.Modules.map((module) =>
        module.Slot.toLowerCase() === 'cargohatch'
            ? { ...module, Item: 'ModularCargoBayDoor', On: false }
            : module,
    );
    const capturedFdlBuild = ShipLoadout.fromLoadout({ ...fdl, Modules: wrongHatch });
    const capturedFdlHatch = capturedFdlBuild.fittedModuleAt('CargoHatch')!;
    assert.equal(capturedFdlHatch.symbol, 'ModularCargoBayDoor');
    assert.equal(capturedFdlHatch.on, false);
    assert.deepEqual(capturedFdlBuild.importOutcomes, []);

    // The Fer-de-Lance family states its own hatch symbol, which the module catalogue
    // does not carry: a symbol lookup alone would normalize the hatch of every capture
    // from those hulls, drop its power state and priority, and void the credit figures.
    const fdlRoundTrip = ShipLoadout.fromLoadout({
        ...fdl,
        Modules: fdl.Modules.map((module) =>
            module.Slot.toLowerCase() === 'cargohatch'
                ? { ...module, On: false, Priority: 4, Health: 1 }
                : module,
        ),
    });
    assert.deepEqual(fdlRoundTrip.importOutcomes, []);
    const fdlHatch = fdlRoundTrip.fittedModuleAt('CargoHatch')!;
    assert.equal(fdlHatch.symbol.toLowerCase(), 'modularcargobaydoorfdl');
    assert.equal(fdlHatch.on, false);
    assert.equal(fdlHatch.priority, 4);
    assert.equal(fdlHatch.effectiveStats!.powerDraw, 0.6);

    const lowerCaseModules = withoutHatch.map((module) => ({
        ...module,
        Slot: module.Slot.toLowerCase(),
    }));
    const lowerCase = ShipLoadout.fromLoadout({ ...source, Modules: lowerCaseModules });
    assert.equal(lowerCase.fittedModuleAt('CargoHatch')!.slot, 'cargohatch');
    assert.ok(
        lowerCase
            .toLoadoutEvent()
            .Modules.every((module) => module.Slot === module.Slot.toLowerCase()),
    );
});

test('fixed-mount repair distinguishes an unknown slot from an editable one', () => {
    const build = ShipLoadout.default('SideWinder');
    const before = build.toLoadoutEvent();
    assert.throws(() => build.repairFixedMount('NoSuchSlotAtAll'), {
        name: 'RangeError',
        message: 'ShipLoadout: hull "SideWinder" has no slot "NoSuchSlotAtAll"',
    });
    assert.throws(() => build.repairFixedMount(''), {
        name: 'RangeError',
        message: 'ShipLoadout: hull "SideWinder" has no slot ""',
    });
    assert.deepEqual(build.repairFixedMount('Slot01_Size2'), {
        status: 'refused',
        slot: 'Slot01_Size2',
        reason: 'notFixedMount',
    });
    assert.deepEqual(build.toLoadoutEvent(), before);

    const source = build.toLoadoutEvent();
    const unresolvedCore = ShipLoadout.fromLoadout({
        ...source,
        Modules: source.Modules.map((module) =>
            module.Slot === 'PowerPlant' ? { ...module, Item: 'FuturePowerPlant' } : module,
        ),
    });
    assert.deepEqual(unresolvedCore.repairFixedMount('PowerPlant'), {
        status: 'unchanged',
        slot: 'PowerPlant',
        symbol: 'Int_Powerplant_Size2_Class1',
    });

    // An oversized-but-resolvable core is not normalized at import — the catalogue knows
    // the article — so this is the path that actually repairs. The stock replacement
    // keeps how the mount was being run and none of what the article was.
    const oversized = ShipLoadout.fromLoadout({
        ...source,
        Modules: source.Modules.map((module) =>
            module.Slot === 'PowerPlant'
                ? {
                      ...module,
                      Item: 'Int_Powerplant_Size8_Class1',
                      On: false,
                      Priority: 4,
                      Health: 0.5,
                      Value: 999,
                  }
                : module,
        ),
    });
    assert.equal(oversized.repairFixedMount('PowerPlant').status, 'repaired');
    const repaired = oversized.fittedModuleAt('PowerPlant')!;
    assert.equal(repaired.symbol, 'Int_Powerplant_Size2_Class1');
    assert.equal(repaired.on, false);
    assert.equal(repaired.priority, 4);
    assert.equal(repaired.health, 0.5);
    assert.equal(repaired.value, undefined);
});

test('fitting a module resets the mount, while repairing one keeps how it was run', () => {
    // Two substitutions that look alike and are not: a module the player chose carries
    // no power state from the one it displaced, while a stock article standing in for one
    // that failed to resolve keeps the state the source recorded for that mount.
    const build = ShipLoadout.fromLoadout({
        ...ShipLoadout.default('SideWinder').toLoadoutEvent(),
        Modules: ShipLoadout.default('SideWinder')
            .toLoadoutEvent()
            .Modules.map((module) =>
                module.Slot === 'Slot01_Size2'
                    ? { Slot: module.Slot, Item: module.Item, On: false, Priority: 3, Health: 0.5 }
                    : module,
            ),
    });
    const before = build.fittedModuleAt('Slot01_Size2')!;
    assert.equal(before.on, false);
    assert.equal(before.priority, 3);

    build.setModule('Slot01_Size2', mod('Int_CargoRack_Size2_Class1', INTERNAL_MODULES));
    const after = build.fittedModuleAt('Slot01_Size2')!;
    assert.equal(after.symbol, 'Int_CargoRack_Size2_Class1');
    assert.equal(after.on, undefined);
    assert.equal(after.priority, undefined);
    assert.equal(after.health, undefined);
});

test('default builds fit every stock module and remain independently editable', () => {
    for (const ship of SHIPS) {
        const build = ShipLoadout.default(ship.symbol);
        assert.equal(build.shipSymbol, ship.symbol);
        assert.deepEqual(build.validation, { valid: true, complete: true, issues: [] });
        assert.ok(build.unladenMass !== null, `${ship.symbol}: mass`);
        assert.ok(build.fuelCapacity !== null, `${ship.symbol}: fuel`);
        assert.ok(build.maxJumpRange() !== null, `${ship.symbol}: jump range`);
        assert.equal(build.powerBudget().withinBudget, true, `${ship.symbol}: power`);
    }

    const first = ShipLoadout.default(' sidewinder ');
    const second = ShipLoadout.default('SideWinder');
    assert.equal(first.fittedModuleAt('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size2_Class1');
    first.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size2_Class2'));
    assert.equal(first.fittedModuleAt('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size2_Class2');
    assert.equal(second.fittedModuleAt('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size2_Class1');
});

test('default build factory names invalid arguments and unknown hulls', () => {
    assert.throws(() => ShipLoadout.default(42 as unknown as string), {
        name: 'TypeError',
        message: 'ShipLoadout.default: shipSymbol must be a string, received number 42',
    });
    assert.throws(() => ShipLoadout.default('NotAShip'), {
        name: 'TypeError',
        message: 'ShipLoadout.default: no default loadout for hull "NotAShip"',
    });
});

test('caller-supplied capacity fields classify custom modules', () => {
    const rack = getModuleBySymbol('Int_CargoRack_Size2_Class1', INTERNAL_MODULES)!;
    const build = ShipLoadout.empty('SideWinder').setModule('Slot01_Size2', {
        ...rack,
        symbol: 'CustomHold',
        engineeringGroup: null,
        cargoCapacity: 42,
    });
    assert.deepEqual(build.cargoCapacityResult, { value: 42, complete: true, issues: [] });

    const customTank: OutfittingModule = {
        name: 'Custom tank',
        symbol: 'CustomTank',
        category: 'internal',
        engineeringGroup: null,
        class: 2,
        rating: 'E',
        fuelCapacity: 7,
    };
    const withTank = ShipLoadout.empty('SideWinder').setModule('Slot01_Size2', customTank);
    assert.equal(withTank.fuelCapacityResult.value?.main, 7);
});

test('a figure an import stated is handed back in the same shape as a calculated one', () => {
    // The three accessors short-circuit when the capture already carries the figure.
    // They build the result through the same constructor the calculations use, so a
    // consumer cannot tell a stated answer from a summed one by its shape — and cannot
    // mutate either.
    const stock = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const imported = ShipLoadout.fromLoadout({
        ...stock,
        UnladenMass: 45,
        CargoCapacity: 4,
        FuelCapacity: { Main: 2, Reserve: 0.3 },
    });
    // The fourth site: a capture whose `Main` an edit discarded but whose `Reserve`
    // survived, so the main capacity is recalculated and merged with the stated
    // reserve. It is the one complete result built when there *was* something left to
    // calculate, and it takes two edits to reach — fitting a tank of unknown capacity
    // drops `Main`, and fitting a known one back makes the recalculation complete while
    // `Reserve` stays as captured (9.99, which no Sidewinder hull would give).
    const tank = getModuleBySymbol('Int_FuelTank_Size1_Class3', CORE_MODULES)!;
    // The same tank with no known capacity — a model the catalogue has not caught up
    // with, which is what makes the edit discard the captured `Main`.
    const mysteryTank: OutfittingModule = {
        name: 'Mystery tank',
        symbol: 'Int_MysteryTank',
        category: tank.category,
        engineeringGroup: tank.engineeringGroup,
        // `slot` is what marks it as a fuel tank; its engineering group is null too.
        ...(tank.slot === undefined ? {} : { slot: tank.slot }),
        class: tank.class,
        rating: tank.rating,
    };
    const merged = ShipLoadout.fromLoadout({
        ...stock,
        FuelCapacity: { Main: 8, Reserve: 9.99 },
    })
        .setModule('FuelTank', mysteryTank)
        .setModule('FuelTank', tank);
    const calculated = ShipLoadout.empty('SideWinder').cargoCapacityResult;

    // The figure itself survives the trip, not just the wrapper's shape.
    assert.equal(imported.unladenMassResult.value, 45);
    assert.equal(imported.cargoCapacityResult.value, 4);
    assert.deepEqual(imported.fuelCapacityResult.value, { main: 2, reserve: 0.3 });
    // Main recalculated from the refitted tank; reserve still the captured figure.
    assert.deepEqual(merged.fuelCapacityResult.value, { main: 2, reserve: 9.99 });

    // The mirror image, and the reason the merge reads the capture for *both* fields:
    // `fromLoadout` takes a journal line as parsed, so a producer that wrote only
    // `Main` — or any JavaScript caller, who has no types at all — reaches the same
    // branch with the halves swapped. A tankless Sidewinder computes `main: 0`, so a
    // merge that ignored the stated `Main` would silently zero the build's fuel and
    // with it its jump range.
    const mainOnly = ShipLoadout.fromLoadout({
        ...stock,
        FuelCapacity: { Main: 9 },
    } as unknown as LoadoutEvent);
    assert.deepEqual(mainOnly.fuelCapacityResult.value, { main: 9, reserve: 0.3 });

    for (const result of [
        imported.unladenMassResult,
        imported.cargoCapacityResult,
        imported.fuelCapacityResult,
        merged.fuelCapacityResult,
    ]) {
        assert.equal(result.complete, true);
        assert.equal(Object.isFrozen(result), true);
        assert.deepEqual(result.issues, []);
        // The one shared empty tuple, not a per-call copy that could arrive unfrozen.
        assert.equal(result.issues, calculated.issues);
    }
    // Both fuel sites hand back a frozen value object, not only the wrapper around it.
    assert.equal(Object.isFrozen(imported.fuelCapacityResult.value), true);
    assert.equal(Object.isFrozen(merged.fuelCapacityResult.value), true);
});

test('fromLoadout rejects duplicate slot keys before its map can overwrite one', () => {
    assert.throws(
        () =>
            ShipLoadout.fromLoadout({
                Ship: 'sidewinder',
                Modules: [
                    { Slot: 'PowerPlant', Item: 'a' },
                    { Slot: 'powerplant', Item: 'b' },
                ],
            }),
        /duplicate slot "powerplant"/,
    );

    const oversized = 'PowerPlant'.padEnd(20_000, 'x');
    assert.throws(
        () =>
            ShipLoadout.fromLoadout({
                Ship: 'sidewinder',
                Modules: [
                    { Slot: oversized, Item: 'a' },
                    { Slot: oversized, Item: 'b' },
                ],
            }),
        ({ message }: Error) => {
            assert.ok(message.length < 200, `duplicate message not shortened: ${message.length}`);
            assert.match(message, /duplicate slot "PowerPlantx+…"$/);
            return true;
        },
    );
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
    assert.ok(near(build.jumpRange(), expected.unladenJumpRange), `unladen ${build.jumpRange()}`);
    assert.ok(
        near(build.ladenJumpRange(), expected.ladenJumpRange),
        `laden ${build.ladenJumpRange()}`,
    );
    const total = build.totalRange();
    assert.ok(near(total.range, expected.totalRange, 1e-2), `total ${total.range}`);
    assert.equal(total.jumps, expected.totalJumps);
    assert.ok(
        near(build.frameShiftDriveMassFactor(), expected.massFactor, 1e-12),
        `factor ${build.frameShiftDriveMassFactor()}`,
    );
    assert.ok(
        near(build.fuelPerJump(50), expected.fuelPerJump50Ly),
        `fuel50 ${build.fuelPerJump(50)}`,
    );
});

test('jump calculations honour explicit fuel and cargo', () => {
    const build = ShipLoadout.fromSlef(slefString);
    // The default is a full main tank with no cargo.
    assert.ok(near(build.jumpRange({ fuel: 128, cargo: 0 }), build.jumpRange()));
    // more cargo -> shorter jump
    assert.ok(build.jumpRange({ cargo: 100 }) < build.jumpRange({ cargo: 0 }));
    const totalMax = build.totalRange({ fuel: build.frameShiftDrive.maxFuel });
    assert.equal(totalMax.jumps, 1);
    assert.ok(near(totalMax.range, build.maxJumpRange()));
    assert.ok(build.totalRange({ fuel: 64 }).range < build.totalRange().range);
    assert.throws(() => build.totalRange({ fuel: 1e7 }), /more than 100000 jumps/);

    const partial = expected.explicitFuel;
    const partialTank = ShipLoadout.fromLoadout(partial.loadout as unknown as LoadoutEvent);
    const partialTotal = partialTank.totalRange(partial.options);
    assert.equal(partialTotal.jumps, partial.expected.jumps);
    assert.ok(near(partialTotal.range, partial.expected.range));
    assert.ok(partialTank.totalRange().range > partialTotal.range);

    for (const invalid of operationsFixture.mobility.facadeFuelOverride.invalidLoads) {
        assert.throws(() => build.jumpRange(invalid.options), { name: invalid.expectedError });
        assert.throws(() => build.fuelPerJump(1, invalid.options), {
            name: invalid.expectedError,
        });
        assert.throws(() => build.totalRange(invalid.options), {
            name: invalid.expectedError,
        });
    }
});

test('fromLoadout works on a bare journal event', () => {
    const build = ShipLoadout.fromLoadout(slefFixture[0]!.data as unknown as LoadoutEvent);
    assert.equal(build.shipSymbol, 'explorer_nx');
    assert.ok(near(build.maxJumpRange(), expected.edsyMaxJumpRange, 5e-2));
});

test('loadout inputs and returned raw records cannot mutate internal state', () => {
    const sourceDrive = {
        Slot: 'FrameShiftDrive',
        Item: 'Int_Hyperdrive_Size6_Class5',
        Engineering: {
            BlueprintName: 'FSD_LongRange',
            Level: 1,
            Quality: 1,
            Modifiers: [{ Label: 'FSDOptimalMass', Value: 1980, OriginalValue: 1800 }],
        },
    };
    const source = {
        Ship: 'anaconda',
        UnladenMass: 500,
        Modules: [
            sourceDrive,
            ...ShipLoadout.default('Anaconda')
                .toLoadoutEvent()
                .Modules.filter((module) => module.Slot !== 'FrameShiftDrive'),
        ],
    };
    const build = ShipLoadout.fromLoadout(source);

    sourceDrive.Item = 'int_hyperdrive_size99_class9_madeup';
    sourceDrive.Engineering!.Modifiers![0]!.Value = 1;
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(build.frameShiftDrive.optMass, 1980);

    const exposed = build.fittedModuleAt('FrameShiftDrive')!.raw as unknown as {
        Item: string;
        Engineering?: { Modifiers: { Value?: number }[] };
    };
    assert.throws(() => {
        exposed.Item = 'int_hyperdrive_size99_class9_madeup';
    }, TypeError);
    assert.throws(() => {
        exposed.Engineering!.Modifiers[0]!.Value = 2;
    }, TypeError);
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(build.frameShiftDrive.optMass, 1980);

    const listed = build.fittedModules()[0]!.raw as { Item: string };
    assert.throws(() => {
        listed.Item = 'another_fake_module';
    }, TypeError);
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size6_Class5');
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

    build.setModule('FuelTank', mod('Int_FuelTank_Size6_Class3'));
    build.removeModule('Slot09_Size4');
    assert.deepEqual(build.fuelCapacity, { main: 64, reserve: 1.14 });
    assert.equal(build.cargoCapacity, 0);
    assert.equal(build.modulesValue, null);
    assert.equal(build.rebuy, null);
});

test("re-fitting a lower-cased import's same module preserves its credit figures", () => {
    const build = ShipLoadout.fromSlef(slefString);
    const imported = build.fittedModuleAt('FrameShiftDrive')!.raw;
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

test('a booster is identified by the bonus it supplies, not by its engineering menu', () => {
    const booster = mod('Int_GuardianFSDBooster_Size5', INTERNAL_MODULES);
    const withCatalogue = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .setModule('Slot02_Size6', booster);
    // `engineeringGroup` says which recipes may touch an article, not what it does, and
    // it is a field a caller-supplied record may legitimately leave null. Reading the
    // bonus itself stops such a record counting its mass while its boost goes uncounted.
    const withSupplied = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .setModule('Slot02_Size6', { ...booster, engineeringGroup: null });
    assert.equal(withSupplied.frameShiftDrive.jumpBoost, booster.jumpBoost);
    assert.equal(withSupplied.maxJumpRange(), withCatalogue.maxJumpRange());

    // A zero bonus is not evidence of a booster: the first match wins, so believing one
    // would let an unrelated record earlier in slot order shadow the real article.
    const shadowed = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .setModule('Slot01_Size7', {
            ...mod('Int_CargoRack_Size6_Class1', INTERNAL_MODULES),
            jumpBoost: 0,
        })
        .setModule('Slot02_Size6', booster);
    assert.equal(shadowed.frameShiftDrive.jumpBoost, booster.jumpBoost);
});

test('a build with no frame shift drive throws on a jump calculation', () => {
    const noFsd = ShipLoadout.empty('SideWinder');
    assert.throws(() => noFsd.maxJumpRange(), /no frame shift drive/);
    assert.throws(
        () => noFsd.jumpRangeSummary(),
        (error: Error) => {
            assert.equal(error.name, 'TypeError');
            assert.match(error.message, /FrameShiftDrive.*no frame shift drive is fitted/);
            return true;
        },
    );
});

test('standard load results expose the jump summary load conditions', () => {
    const build = ShipLoadout.default('SideWinder');
    const maximum = build.standardLoadResult('maximum');
    const unladen = build.standardLoadResult('unladen');
    const laden = build.standardLoadResult('laden');

    assert.deepEqual(maximum, {
        value: { fuel: 0.6, cargo: 0 },
        complete: true,
        issues: [],
    });
    assert.deepEqual(unladen, {
        value: { fuel: 2, cargo: 0 },
        complete: true,
        issues: [],
    });
    assert.deepEqual(laden, {
        value: { fuel: 2, cargo: 4 },
        complete: true,
        issues: [],
    });
    assert.equal(build.jumpRange(maximum.value!), build.jumpRangeSummary().max);
    assert.equal(build.jumpRange(unladen.value!), build.jumpRangeSummary().unladen);
    assert.equal(build.jumpRange(laden.value!), build.jumpRangeSummary().laden);
    assert.deepEqual(
        build.mobilityMetrics({ ...laden.value!, enginesPips: 2 }),
        build.mobilityMetrics({ fuel: 2, cargo: 4, enginesPips: 2 }),
    );
    assert.throws(
        () => build.standardLoadResult('other' as 'maximum'),
        /load must be 'maximum', 'unladen', or 'laden'/,
    );
});

test('standard maximum load reports invalid jump inputs', () => {
    const source = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const noFuel = ShipLoadout.fromLoadout({
        ...source,
        FuelCapacity: { Main: 0, Reserve: 0 },
    });
    assert.deepEqual(noFuel.standardLoadResult('maximum').value, { fuel: 0, cargo: 0 });

    const invalidDrive = ShipLoadout.fromLoadout({
        ...source,
        Modules: source.Modules.map((module) =>
            module.Slot === 'FrameShiftDrive'
                ? {
                      ...module,
                      Engineering: {
                          BlueprintName: 'FSD_LongRange',
                          Level: 5,
                          Quality: 1,
                          Modifiers: [{ Label: 'MaxFuelPerJump', Value: -1, OriginalValue: 0.6 }],
                      },
                  }
                : module,
        ),
    });
    const invalid = invalidDrive.standardLoadResult('maximum');
    assert.equal(invalid.complete, false);
    assert.equal(invalid.issues[0]?.field, 'frameShiftDrive');
    assert.match(invalid.issues[0]!.message, /fuel must be a finite non-negative number/);
});

test('the power plant and fuel tank are found by their declared slots', () => {
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

    // Fuel capacity reads the same way: a cargo rack that declares the fuel-tank mount
    // is taken at its word and counted as a tank. Because it carries no fuel-capacity
    // stat, the result becomes unknown rather than pretending the tank holds zero.
    const rack = getModuleBySymbol('Int_CargoRack_Size5_Class1', ALL_MODULES)!;
    const source = ShipLoadout.default('Anaconda').toLoadoutEvent();
    const imported = ShipLoadout.fromLoadout({
        ...source,
        UnladenMass: 400,
        FuelCapacity: { Main: 999, Reserve: 1.07 },
        Modules: [
            ...source.Modules.filter((module) => module.Slot !== 'Slot05_Size5'),
            { Slot: 'Slot05_Size5', Item: rack.symbol, On: true },
        ],
    } as LoadoutEvent);
    assert.equal(imported.fuelCapacity!.main, 999);
    imported.setModule('Slot05_Size5', { ...rack, slot: 'fuelTank' } as OutfittingModule);
    assert.equal(imported.fuelCapacity, null);
    assert.equal(imported.fuelCapacityResult.issues[0]?.field, 'fuelCapacity');
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
    assert.deepEqual(
        build.standardLoadResult('maximum').issues.map((issue) => issue.field),
        ['frameShiftDrive'],
    );

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

test('fromSlef rejects an unknown selected hull without poisoning another entry', () => {
    const input = [
        { Ship: 'SideWinder', Modules: [] },
        { Ship: 'FutureHull', Modules: [] },
    ];
    assert.equal(ShipLoadout.fromSlef(input, 0).shipSymbol, 'SideWinder');
    assert.throws(
        () => ShipLoadout.fromSlef(input, 1),
        /^TypeError: ShipLoadout\.fromSlef: unknown hull "FutureHull"$/,
    );
});

test('a build missing UnladenMass throws on a mass-dependent calculation', () => {
    const noMass: LoadoutEvent = {
        Ship: 'sidewinder',
        Modules: [{ Slot: 'FrameShiftDrive', Item: 'int_hyperdrive_size2_class1' }],
    };
    // sidewinder IS in the stats catalogue, so mass is computed, not null.
    assert.ok(ShipLoadout.fromLoadout(noMass).unladenMass! > 0);
});

test('fallback mass resolves bulkheads, stock fixed mounts and stripped modules', () => {
    const reactive: LoadoutEvent = {
        Ship: 'anaconda',
        Modules: [{ Slot: 'Armour', Item: 'anaconda_armour_reactive' }],
    };
    assert.equal(ShipLoadout.fromLoadout(reactive).unladenMass, 460);

    // An unresolved optional internal is stripped, so the hull and what remains still
    // add up rather than the whole figure going unknown.
    const unresolved: LoadoutEvent = {
        Ship: 'anaconda',
        Modules: [{ Slot: 'Slot01_Size7', Item: 'int_future_module_without_stats' }],
    };
    const unresolvedBuild = ShipLoadout.fromLoadout(unresolved);
    assert.equal(unresolvedBuild.unladenMass, 400);

    // An unresolved fixed mount is stocked instead, and the stock article's mass counts.
    const unresolvedCore = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [{ Slot: 'PowerPlant', Item: 'int_future_module_without_stats' }],
    });
    assert.equal(unresolvedCore.unladenMass, 560);
    // Mounts the capture never named stay empty rather than being invented.
    assert.equal(unresolvedCore.fittedModuleAt('MainEngines'), null);
    assert.equal(unresolvedCore.validation.complete, false);

    const stripped = ShipLoadout.fromLoadout({
        Ship: 'sidewinder',
        FuelCapacity: { Main: 2, Reserve: 0.3 },
        Modules: [
            { Slot: 'FrameShiftDrive', Item: 'int_hyperdrive_size2_class5' },
            { Slot: 'Slot01_Size2', Item: 'int_future_module_without_stats' },
        ],
    });
    assert.equal(stripped.fittedModuleAt('Slot01_Size2'), null);
});

// ── Build editor ────────────────────────────────────────────────────────────

test("empty starts a hull with only its built-in hatch and the hull's declared slots", () => {
    const conda = ShipLoadout.empty('Anaconda');
    assert.equal(conda.shipSymbol, 'Anaconda');
    assert.equal(conda.fittedModules().length, 1);
    assert.equal(conda.fittedModuleAt('CargoHatch')?.symbol, 'ModularCargoBayDoor');
    assert.equal(conda.slots('hardpoint').length, 8);
    assert.equal(conda.slots('utility').length, 8);
    assert.equal(conda.slots('core').length, 7);
    assert.equal(conda.slots('optional').length, 14);
    assert.ok(
        conda
            .slots()
            .filter((slot) => slot.kind !== 'cargoHatch')
            .every((slot) => slot.module === null),
    );
    assert.equal(conda.powerBudget().available, 0);
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
    assert.ok(fsdSlot?.module);
    assert.equal(fsdSlot?.module?.symbol, 'Int_Hyperdrive_Size2_Class5');
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.symbol, 'Int_Hyperdrive_Size2_Class5');
    assert.equal(build.fittedModules().length, 2);
});

test('setModule chains and removeModule clears', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .setModule('Slot01_Size7', mod('Int_FuelTank_Size6_Class3'));
    assert.equal(build.fittedModules().length, 3);
    build.removeModule('Slot01_Size7');
    assert.equal(build.fittedModuleAt('Slot01_Size7'), null);
    assert.equal(build.fittedModules().length, 2);
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

test('incompatible-module diagnostics carry every dynamic fitting value', () => {
    const imported = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            { Slot: 'FrameShiftDrive', Item: 'Int_Hyperdrive_Size8_Class5' },
            {
                Slot: 'MainEngines',
                Item: 'Int_Engine_Size7_Class5_GravityOptimised_MkII',
            },
        ],
    });
    const issues = imported.validation.issues.filter(
        (issue) => issue.code === 'incompatibleModule',
    );
    assert.deepEqual(issues[0]?.params, {
        slot: 'FrameShiftDrive',
        symbol: 'Int_Hyperdrive_Size8_Class5',
        constraint: 'oversized',
        moduleClass: 8,
        slotSize: 6,
    });
    assert.deepEqual(issues[1]?.params, {
        slot: 'MainEngines',
        symbol: 'Int_Engine_Size7_Class5_GravityOptimised_MkII',
        constraint: 'restrictedHull',
        allowedShipNames: ['Caspian Explorer'],
        allowedShipSymbols: ['Explorer_NX'],
        shipSymbol: 'Anaconda',
    });
    assert.ok(Object.isFrozen(issues[1]?.params?.allowedShipSymbols));
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
        engineeringGroup: null,
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
        engineeringGroup: null,
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
        engineeringGroup: null,
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
        engineeringGroup: null,
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
    const forMining = miner.modulesForSlot('MediumMiningHardpoint1');
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
    assert.ok(!panther.modulesForSlot('Slot01_Size8').some((m) => m.symbol === rack.symbol));
    assert.ok(panther.modulesForSlot('Cargo01').some((m) => m.symbol === rack.symbol));
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
        /restricted to Caspian Explorer \(Explorer_NX\), Panther Clipper Mk II \(Panth…/,
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
        const offered = new Set(build.modulesForSlot(rule.slot).map((m) => m.symbol));
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

test('a restricted mount labels an odd key without scanning it quadratically', () => {
    // The one test that constructs a slot directly: a hull's own layout can only
    // name a mount sanely, so a hostile key has to be handed straight to the
    // constructor. It reads the key and nothing else, so the loadout can be absent.
    const label = (key: string) =>
        loadoutSlotName({
            key,
            kind: 'optional',
            size: 4,
            restriction: 'military',
        });
    // Ship data can name a mount whatever it likes, so the trailing number is read
    // off any key shape — and an unnumbered one falls back to the key.
    assert.equal(label('Military01'), 'Military Slot 1');
    assert.equal(label('Slot02_Size5'), 'Military Slot 5');
    assert.equal(label('MilitaryReserve'), 'MilitaryReserve');
    assert.equal(label('42'), 'Military Slot 42'); // digits all the way to the start
    // Both long inputs are scanned linearly and must finish well under a second. Use
    // `ok` to keep a failure from printing an 80k-character diff.
    const trailing = `${'9'.repeat(80_000)}x`;
    const digits = '9'.repeat(80_000);
    const started = performance.now();
    assert.ok(label(trailing) === trailing, 'a long key ending in a non-digit lost its label');
    assert.ok(label(digits) === `Military Slot ${Number(digits)}`, 'a long digit key mislabelled');
    assert.ok(performance.now() - started < 1_000, 'labelling a long key took too long');
});

test('setModule throws a clear error when handed an undefined module', () => {
    const conda = ShipLoadout.empty('Anaconda');
    // The classic `getModuleBySymbol('typo', CAT)!` miss. Only a nullish module is
    // reported as one, so no other value gets sent looking at the lookup.
    for (const missing of [undefined, null]) {
        assert.throws(
            () => conda.setModule('FrameShiftDrive', missing as unknown as OutfittingModule),
            /no module supplied/,
        );
    }
});

test('setModule names a module argument that is not an outfitting module', () => {
    const conda = ShipLoadout.empty('Anaconda');
    // A journal fragment, a bare symbol or a number, rather than a catalogue record:
    // every fit rule reads `symbol`, so the value is named here instead. The falsy
    // values belong here too — none of them is a lookup that returned nothing.
    for (const bad of [
        {},
        42,
        'Int_Hyperdrive_Size6_Class5',
        { Item: 'int_hyperdrive_size6_class5' },
        0,
        '',
        false,
        Number.NaN,
    ]) {
        assert.throws(
            () => conda.setModule('FrameShiftDrive', bad as unknown as OutfittingModule),
            {
                name: 'TypeError',
                message:
                    /^ShipLoadout\.setModule: module for "FrameShiftDrive" must be an outfitting module, received /,
            },
        );
    }
    assert.throws(
        () => conda.setModule('FrameShiftDrive', {} as unknown as OutfittingModule),
        /received object \{\}$/,
    );
});

test('empty names a non-string hull argument instead of failing inside the lookup', () => {
    for (const bad of [42, null, undefined, { Ship: 'Anaconda' }]) {
        assert.throws(() => ShipLoadout.empty(bad as unknown as string), {
            name: 'TypeError',
            message: /^ShipLoadout\.empty: shipSymbol must be a string, received /,
        });
    }
    // A string that is not a hull still reports the layout miss, not a type error.
    assert.throws(() => ShipLoadout.empty('NotAShip'), /no slot layout for hull "NotAShip"/);

    // …and an oversized one is identified rather than quoted back in full: a caller who
    // passes a whole payload where a symbol belongs gets a message they can read.
    assert.throws(
        () => ShipLoadout.empty('x'.repeat(20_000)),
        ({ message }: Error) => {
            assert.ok(message.length < 200, `hull message not shortened: ${message.length}`);
            assert.match(message, /no slot layout for hull "x+…"$/);
            return true;
        },
    );
});

test('fromLoadout rejects absent and unrecognised hulls with bounded errors', () => {
    for (const ship of [undefined, null]) {
        assert.throws(
            () => ShipLoadout.fromLoadout({ Ship: ship, Modules: [] } as unknown as LoadoutEvent),
            /^TypeError: ShipLoadout\.fromLoadout: event\.Ship must be a string/,
        );
    }
    assert.throws(
        () => ShipLoadout.fromLoadout({ Ship: 'FutureHull', Modules: [] }),
        /^TypeError: ShipLoadout\.fromLoadout: unknown hull "FutureHull"$/,
    );
    const longHull = `FutureHull${'h'.repeat(20_000)}`;
    assert.throws(
        () => ShipLoadout.fromLoadout({ Ship: longHull, Modules: [] }),
        ({ message }: Error) => {
            assert.ok(message.length < 200, `hull message not shortened: ${message.length}`);
            assert.match(message, /FutureHullh+…/);
            return true;
        },
    );
});

test('slot errors abbreviate their caller-controlled values', () => {
    const longSlot = `FutureSlot${'s'.repeat(20_000)}`;
    assert.throws(
        () => ShipLoadout.empty('Anaconda').modulesForSlot(longSlot),
        ({ message }: Error) => {
            assert.ok(message.length < 200, `slot message not shortened: ${message.length}`);
            assert.match(message, /FutureSlots+…"$/);
            return true;
        },
    );
});

test('modulesForSlot lists only fitting modules', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const drives = conda.modulesForSlot('FrameShiftDrive');
    assert.ok(drives.length > 0);
    assert.ok(drives.every((m) => m.symbol.toLowerCase().startsWith('int_hyperdrive')));
    assert.ok(drives.every((m) => m.class <= 6));
    assert.throws(() => conda.modulesForSlot('NoSuchSlot'), RangeError);
});

test('fit checks use restrictions carried by caller-supplied module records', () => {
    const restricted: OutfittingModule = {
        symbol: 'CustomRestrictedLaser',
        category: 'hardpoint',
        engineeringGroup: null,
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

test('armour is hull-specific while fixed mounts cannot be emptied', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const armour = conda.modulesForSlot('Armour');
    assert.equal(armour.length, 5);
    assert.ok(armour.every((module) => module.ship === 'Anaconda'));
    conda.setModule(
        'Armour',
        armour.find((module) => module.symbol.endsWith('_Grade2'))!,
    );
    assert.equal(conda.fittedModuleAt('Armour')?.symbol, 'Anaconda_Armour_Grade2');
    assert.throws(
        () =>
            conda.setModule('Armour', getModuleBySymbol('SideWinder_Armour_Grade2', CORE_MODULES)!),
        /belongs to Sidewinder, not Anaconda/,
    );
    assert.throws(
        () => conda.setModule('CargoHatch', mod('Int_Hyperdrive_Size6_Class5')),
        /cargoHatch slot cannot be changed/,
    );
    assert.throws(() => conda.removeModule('Armour'), {
        name: 'TypeError',
        code: 'requiredSlot',
        params: { slot: 'Armour' },
    });
    assert.throws(() => conda.removeModule('powerplant'), {
        name: 'TypeError',
        code: 'requiredSlot',
        params: { slot: 'PowerPlant' },
    });
    assert.equal(conda.fittedModuleAt('Armour')?.symbol, 'Anaconda_Armour_Grade2');
    conda.setModule(
        'Armour',
        armour.find((module) => module.symbol.endsWith('_Grade3'))!,
    );
    assert.equal(conda.fittedModuleAt('Armour')?.symbol, 'Anaconda_Armour_Grade3');

    const imported = ShipLoadout.fromSlef(slefString);
    const cargoHatch = imported.fittedModuleAt('CargoHatch')?.raw;
    assert.ok(cargoHatch);
    assert.throws(() => imported.removeModule('CargoHatch'), /cargoHatch slot cannot be changed/);
    assert.deepEqual(imported.fittedModuleAt('CargoHatch')?.raw, cargoHatch);
    assert.ok(imported.slots().find((slot) => slot.key === 'CargoHatch')?.module);
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
    const engineered = build.fittedModuleAt('FrameShiftDrive')!.engineering!;
    assert.equal(engineered.BlueprintName, 'FSD_LongRange');
    assert.equal(engineered.Level, 5);
    assert.equal(engineered.ExperimentalEffect, 'special_fsd_heavy');
    const massMod = engineered.Modifiers!.find((m) => m.Label === 'Mass');
    assert.equal(massMod?.Value, 208);
});

test('applyBlueprint reconstructs captured journal modifier values', () => {
    const engineeredModules = corvetteMultiroleJournal.Modules.filter(
        (module) => module.Engineering !== undefined,
    );
    assert.equal(engineeredModules.length, 29);

    const numericShape = (modifiers: readonly EngineeringModifier[]) =>
        modifiers.map(({ Label, Value, OriginalValue, ValueStr }) => ({
            Label,
            ...(Value === undefined ? {} : { Value }),
            ...(OriginalValue === undefined ? {} : { OriginalValue }),
            ...(ValueStr === undefined ? {} : { ValueStr }),
        }));

    for (const module of engineeredModules) {
        const engineering = module.Engineering!;
        const rebuilt = ShipLoadout.fromLoadout({
            Ship: corvetteMultiroleJournal.Ship,
            Modules: [{ Slot: module.Slot, Item: module.Item }],
        });
        // The capture's SmallHardpoint2 states a partial Quality despite carrying the
        // complete grade-5 values; its own header records that source inconsistency.
        const quality = module.Slot === 'SmallHardpoint2' ? 1 : engineering.Quality;
        rebuilt.applyBlueprint(module.Slot, engineering.BlueprintName, {
            grade: engineering.Level,
            quality,
            ...(engineering.ExperimentalEffect === undefined
                ? {}
                : { experimental: engineering.ExperimentalEffect }),
        });

        const reconstructed = rebuilt.fittedModuleAt(module.Slot)!;
        assert.deepEqual(
            numericShape(reconstructed.engineering?.Modifiers ?? []),
            numericShape(engineering.Modifiers ?? []),
            `${module.Slot}: modifiers`,
        );
        assert.ok(reconstructed.effectiveStats, `${module.Slot}: effective stats`);
    }
});

test('stock cargo racks cannot acquire a fixed reward identity as engineering', () => {
    const build = ShipLoadout.default('Python');
    const slot = 'Slot01_Size6';
    assert.equal(build.fittedModuleAt(slot)?.effectiveStats?.cargoCapacity, 32);
    assert.equal(
        build
            .availableBlueprints(slot)
            .some(({ fdname }) => fdname === 'CargoRack_IncreasedCapacity'),
        false,
    );
    assert.throws(
        () => build.applyBlueprint(slot, 'CargoRack_IncreasedCapacity', { grade: 5 }),
        /not offered/,
    );

    const variant = getPreEngineeredVariants('Int_CargoRack_Size5_Class1').find(
        (candidate) => candidate.blueprint === 'CargoRack_IncreasedCapacity',
    )!;
    assert.equal(getPreEngineeredStats(variant)?.cargoCapacity, 43);
    const reward = ShipLoadout.empty('Python').setPreEngineeredVariant(slot, variant);
    assert.equal(reward.cargoCapacity, 43);
    assert.equal(reward.fittedModuleAt(slot)?.preEngineeredVariant?.acquisition, 'communityGoal');
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
        /is not offered blueprint "Armour_HeavyDuty"; available candidates are FSD_FastBoot \(ordinary\), FSD_LongRange \(ordinary\), FSD_Shielded \(ordinary\)/,
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

    for (const operation of [
        () => build.applyBlueprint('FrameShiftDrive', 'b'.repeat(20_000), { grade: 5 }),
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
                grade: 5,
                experimental: 'e'.repeat(20_000),
            }),
    ]) {
        assert.throws(operation, ({ message }: Error) => {
            assert.ok(message.length < 200, `engineering message not shortened: ${message.length}`);
            assert.match(message, /…/);
            return true;
        });
    }
});

test('a fixed event-reward identity cannot be applied as a blueprint', () => {
    const expected = preEngineeredFixture.festive;
    const build = ShipLoadout.empty('Anaconda').setModule(
        'MediumHardpoint1',
        mod(expected.symbol, HARDPOINT_MODULES),
    );
    assert.throws(
        () =>
            build.applyBlueprint('MediumHardpoint1', expected.blueprints[0]!, {
                grade: 1,
            }),
        /is a fixed pre-engineered identity, not a craftable blueprint; use setPreEngineeredVariant/,
    );
});

test('weapon and armour recipes engineer the stats the catalogue carries', () => {
    const weapon = ShipLoadout.empty('Sidewinder').setModule(
        'SmallHardpoint1',
        mod('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES),
    );
    assert.ok(
        weapon
            .availableBlueprints('SmallHardpoint1')
            .some((blueprint) => blueprint.fdname === 'Weapon_Overcharged'),
    );
    weapon.applyBlueprint('SmallHardpoint1', 'Weapon_Overcharged', { grade: 5 });
    const overcharged = weapon.fittedModuleAt('SmallHardpoint1')!.engineering!.Modifiers!;
    const damage = overcharged.find((m) => m.Label === 'Damage')!;
    assert.ok(damage.Value! > damage.OriginalValue!, 'Overcharged raises damage');

    // Armour's hull boost is a per-hull stat on the armour module, so Heavy Duty
    // resolves against it.
    const conda = ShipLoadout.empty('Anaconda').setModule('Armour', mod('Anaconda_Armour_Grade3'));
    conda.applyBlueprint('Armour', 'Armour_HeavyDuty', { grade: 5 });
    const boost = conda
        .fittedModuleAt('Armour')!
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

        const fitted = build.fittedModuleAt('SmallHardpoint1')!;
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

test('the first captured damage modifier remains authoritative when labels repeat', () => {
    const build = ShipLoadout.fromLoadout({
        Ship: 'Sidewinder',
        Modules: [
            {
                Slot: 'SmallHardpoint1',
                Item: 'Hpt_Cannon_Fixed_Small',
                Engineering: {
                    BlueprintName: 'Weapon_Sturdy',
                    Level: 1,
                    Quality: 1,
                    Modifiers: [
                        { Label: '$Kinetic;', Value: 25 },
                        { Label: '$Kinetic;', Value: 75 },
                    ],
                },
            },
        ],
    });

    assert.equal(
        build.fittedModuleAt('SmallHardpoint1')?.effectiveStats?.damageDistribution?.kinetic,
        0.25,
    );
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

        const fitted = build.fittedModuleAt('SmallHardpoint1')!;
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

    const fitted = build.fittedModuleAt('SmallHardpoint1')!;
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

    const effective = build.fittedModuleAt('SmallHardpoint1')!.effectiveStats!;
    assert.equal(effective.damageComponents, undefined);
    assert.deepEqual(
        effective.damageDistribution,
        engineeringFixture.experimentalDamageDistributions.map.special_high_yield_shell,
    );

    const metrics = build.weaponMetrics().weapons[0]!.metrics;
    assert.ok(near(metrics.damageByType.kinetic, metrics.damagePerSecond / 2, 1e-6));
    assert.ok(near(metrics.damageByType.explosive, metrics.damagePerSecond / 2, 1e-6));
});

test('effective fitted stats scale exact components with engineered damage', () => {
    const expected = engineeringFixture.damageComponentScaling.cases[0]!;
    const build = ShipLoadout.fromLoadout({
        Ship: 'CobraMkIII',
        Modules: [
            {
                Slot: 'MediumHardpoint1',
                Item: expected.symbol,
                Engineering: {
                    BlueprintName: 'Test',
                    Level: 1,
                    Quality: 1,
                    Modifiers: [
                        {
                            Label: 'Damage',
                            OriginalValue: expected.baseDamage,
                            Value: expected.effectiveDamage,
                        },
                    ],
                },
            },
        ],
    });

    const effective = build.fittedModuleAt('MediumHardpoint1')!.effectiveStats!;
    assert.equal(effective.damage, expected.effectiveDamage);
    assert.deepEqual(effective.damageComponents, expected.expectedComponents);
});

test('a hull reinforcement package engineers a hull boost it never had', () => {
    // A reinforcement package carries no base hull boost, and unlike an ordinary stat
    // that absence is not "nothing to scale": a percentage-of-a-multiplier stat has a
    // real neutral value of 0% (a x1 multiplier), so the recipe's bonus *is* the result.
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_HullReinforcement_Size5_Class2', INTERNAL_MODULES),
    );
    assert.ok(
        build
            .availableBlueprints('Slot01_Size7')
            .some((blueprint) => blueprint.fdname === 'HullReinforcement_Advanced'),
    );
    build.applyBlueprint('Slot01_Size7', 'HullReinforcement_Advanced', { grade: 5 });
    const boost = build
        .fittedModuleAt('Slot01_Size7')!
        .engineering!.Modifiers!.find((m) => m.Label === 'DefenceModifierHealthMultiplier')!;
    // Grade 5 Lightweight is +24% at a full roll, compounded on a x1 multiplier.
    assert.equal(boost.OriginalValue, 0);
    assert.equal(boost.Value, 24);
    // The Heavy Duty recipe, which moves the reinforcement itself, still works.
    build.applyBlueprint('Slot01_Size7', 'HullReinforcement_HeavyDuty', { grade: 5 });
    const added = build
        .fittedModuleAt('Slot01_Size7')!
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
    const modifiers = build.fittedModuleAt('MediumHardpoint1')!.engineering!.Modifiers!;
    assert.ok(!modifiers.some((m) => m.Label === 'ShotSpeed'));
    const loadoutRange = build
        .toLoadoutEvent()
        .Modules.find((m) => m.Slot === 'MediumHardpoint1')!
        .Engineering!.Modifiers!.find((m) => m.Label === 'MaximumRange');
    assert.ok(loadoutRange);
    const slefRange = build
        .toSlef({ header: { appName: 'Test', appVersion: '1.0.0' } })[0]!
        .data.Modules.find((m) => m.Slot === 'MediumHardpoint1')!
        .Engineering!.Modifiers!.find((m) => m.Label === 'MaximumRange');
    assert.deepEqual(slefRange, loadoutRange);

    // A weapon that does fire a projectile gets the leg.
    const cannon = ShipLoadout.empty('Anaconda').setModule(
        'MediumHardpoint1',
        mod('Hpt_MultiCannon_Fixed_Medium', HARDPOINT_MODULES),
    );
    cannon.applyBlueprint('MediumHardpoint1', 'Weapon_LongRange', { grade: 5 });
    const shot = cannon
        .fittedModuleAt('MediumHardpoint1')!
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
            .availableBlueprints('Slot01_Size7')
            .some((blueprint) => blueprint.fdname === 'HatchBreakerLimpet_LightWeight'),
    );
    build.applyBlueprint('Slot01_Size7', 'HatchBreakerLimpet_LightWeight', { grade: 5 });
    assert.equal(
        build
            .fittedModuleAt('Slot01_Size7')!
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
            build.availableBlueprints(slot).some(({ fdname }) => fdname === capability.offeredAs),
            `${symbol} is not offered the capability`,
        );
        build.applyBlueprint(slot, blueprint, { grade: capability.grade });
        const fitted = build.fittedModuleAt(slot)!;
        assert.deepEqual(fitted.engineering?.Modifiers, [capability.modifier], symbol);
        assert.equal(fitted.effectiveStats?.guardianZoneResistance, true, symbol);

        const imported = ShipLoadout.fromSlef(
            build.toSlefString({ header: { appName: 'Test', appVersion: '1.0.0' } }),
        ).fittedModuleAt(slot)!;
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
    } as unknown as LoadoutEvent).fittedModuleAt('PowerPlant')!;
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
        /is not offered blueprint "GuardianModule_Sturdy"/,
    );

    // A Guardian module still has no experimental slot. Its ordinary twin takes an
    // experimental normally; the capability changes neither menu.
    const plant = ShipLoadout.empty('Anaconda').setModule(
        'PowerPlant',
        mod('Int_GuardianPowerplant_Size7', INTERNAL_MODULES),
    );
    assert.throws(
        () =>
            plant.applyBlueprint('PowerPlant', 'GuardianModule_Sturdy', {
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
    const rolled = build.fittedModuleAt('TinyHardpoint1')!;
    const range = rolled.engineering!.Modifiers!.find((m) => m.Label === 'Range')!.Value!;
    assert.ok(range > 4000);
    assert.equal(rolled.effectiveStats?.scannerRange, range);
    assert.equal(rolled.effectiveStats?.maximumRange, undefined);

    // And that journal spelling reads back through a `Loadout` event.
    const event: LoadoutEvent = JSON.parse(JSON.stringify(build.toLoadoutEvent()));
    const slefEvent = build.toSlef({ header: { appName: 'Test', appVersion: '1.0.0' } })[0]!.data;
    const eventRange = event.Modules.find(
        (module) => module.Slot === 'TinyHardpoint1',
    )!.Engineering!.Modifiers!.find((modifier) => modifier.Label === 'Range');
    const slefRange = slefEvent.Modules.find(
        (module) => module.Slot === 'TinyHardpoint1',
    )!.Engineering!.Modifiers!.find((modifier) => modifier.Label === 'Range');
    assert.ok(eventRange);
    assert.deepEqual(slefRange, eventRange);
    const asJournal = ShipLoadout.fromLoadout(event).fittedModuleAt('TinyHardpoint1')!;
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
        (build.fittedModuleAt(slot)!.engineering!.Modifiers ?? [])
            .map((modifier) => modifier.Label)
            .sort();
    assert.deepEqual(labels('Radar'), ['Mass', 'Range', 'SensorTargetScanAngle']);
    assert.deepEqual(labels('TinyHardpoint1'), ['PowerDraw', 'Range', 'SensorTargetScanAngle']);

    // The block keeps the id the build declared, so it reads back the way it came in.
    assert.equal(
        build.fittedModuleAt('TinyHardpoint1')!.engineering!.BlueprintName,
        'Sensor_LongRange',
    );
    // The scanner's own menu spelling reaches the same recipe.
    const viaMenuId = ShipLoadout.empty('Anaconda')
        .setModule('TinyHardpoint1', mod('Hpt_CloudScanner_Size0_Class5', UTILITY_MODULES))
        .applyBlueprint('TinyHardpoint1', 'Scanner_LongRange', { grade: collision.grade });
    assert.deepEqual(
        build.fittedModuleAt('TinyHardpoint1')!.engineering!.Modifiers,
        viaMenuId.fittedModuleAt('TinyHardpoint1')!.engineering!.Modifiers,
    );
    // And the resolution does not run the other way: the suite is not offered the
    // scanner's id, and the error quotes the menu it checked.
    assert.throws(
        () => build.applyBlueprint('Radar', 'Scanner_LongRange', { grade: 3 }),
        /is not offered blueprint "Scanner_LongRange"; available candidates are Sensor_LightWeight \(ordinary\)/,
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
    const engineered = build.fittedModuleAt('Slot01_Size7')!.engineering!;
    assert.equal(engineered.BlueprintName, climb.blueprint);
    for (const [label, expected] of Object.entries(climb.expected)) {
        const modifier = engineered.Modifiers!.find((entry) => entry.Label === label);
        assert.equal(modifier?.OriginalValue, climb.base[label as keyof typeof climb.base], label);
        assert.ok(near(modifier!.Value!, expected), `${label}: ${modifier?.Value}`);
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

test('stock mining tools refuse ordinary engineering but keep their Mercenary climbs', () => {
    const cases = [
        {
            symbol: 'Hpt_MiningLaser_Fixed_Small',
            blueprint: 'MiningLaser_LongRange',
        },
        {
            symbol: 'Hpt_Mining_AbrBlstr_Fixed_Small',
            blueprint: 'AbrasionBlaster_FarReaching',
        },
    ] as const;

    for (const { symbol, blueprint } of cases) {
        const build = ShipLoadout.empty('Anaconda').setModule(
            'SmallHardpoint1',
            mod(symbol, HARDPOINT_MODULES),
        );
        assert.deepEqual(
            build.availableBlueprints('SmallHardpoint1'),
            [{ fdname: blueprint, grades: [2, 3, 4, 5], route: 'mercenary' }],
            symbol,
        );
        assert.throws(
            () =>
                build.applyBlueprint('SmallHardpoint1', 'Weapon_LongRange', {
                    grade: 5,
                    quality: 1,
                }),
            new RegExp(
                `module "${symbol}" is not offered blueprint "Weapon_LongRange"; available candidates are ${blueprint} \\(mercenary\\)`,
            ),
        );

        const mercenary = getPreEngineeredVariants(symbol).find(
            (variant) => variant.acquisition === 'mercenary',
        )!;
        assert.equal(mercenary.grade, 1, symbol);
        assert.equal(mercenary.blueprint, blueprint, symbol);
        build.applyBlueprint('SmallHardpoint1', blueprint, { grade: 5, quality: 1 });
        assert.equal(
            build.fittedModuleAt('SmallHardpoint1')?.engineering?.BlueprintName,
            blueprint,
            symbol,
        );
    }
});

test('a final pre-engineered Guardian weapon exposes no engineering', () => {
    const variant = getPreEngineeredVariants('Hpt_Guardian_GaussCannon_Fixed_Medium')[0]!;
    const resolved = getPreEngineeredStats(variant)!;
    const build = ShipLoadout.empty('Anaconda').setModule('MediumHardpoint1', resolved);
    assert.equal(resolved.engineeringLocked, true);
    assert.deepEqual(build.availableBlueprints('MediumHardpoint1'), []);
    assert.deepEqual(build.availableExperimentalEffects('MediumHardpoint1'), []);
    for (const blueprint of ['GuardianModule_Sturdy', variant.blueprint]) {
        assert.throws(
            () => build.applyBlueprint('MediumHardpoint1', blueprint, { grade: 1 }),
            /is a final pre-engineered article and accepts no further engineering/,
        );
    }
    assert.equal(build.fittedModuleAt('MediumHardpoint1')?.stats?.engineeringLocked, true);
});

test('fixed Enzyme and AX variants expose no engineering', () => {
    for (const [symbol, acquisition] of [
        ['Hpt_CausticMissile_Fixed_Medium', 'communityGoal'],
        ['Hpt_ATDumbfireMissile_Fixed_Medium', 'techBroker'],
        ['Hpt_ATMultiCannon_Gimbal_Medium', 'techBroker'],
    ] as const) {
        const variant = getPreEngineeredVariants(symbol).find(
            (candidate) => candidate.acquisition === acquisition,
        )!;
        const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
            'MediumHardpoint1',
            variant,
        );
        assert.equal(variant.engineeringLocked, true, symbol);
        assert.deepEqual(build.availableBlueprints('MediumHardpoint1'), [], symbol);
        assert.deepEqual(build.availableExperimentalEffects('MediumHardpoint1'), [], symbol);
        assert.throws(
            () => build.applyBlueprint('MediumHardpoint1', variant.blueprint, { grade: 5 }),
            /is a final pre-engineered article and accepts no further engineering/,
        );

        const event = build.toLoadoutEvent();
        if (symbol === 'Hpt_ATMultiCannon_Gimbal_Medium') {
            assert.equal(
                event.Modules.find((module) => module.Slot === 'MediumHardpoint1')?.Engineering
                    ?.BlueprintName,
                'Weapon_Overcharged',
            );
        }
        const imported = ShipLoadout.fromLoadout({
            ...event,
            Modules: event.Modules.map((module) => {
                if (module.Slot !== 'MediumHardpoint1') return module;
                const { Modifiers: omitted, ...identity } = module.Engineering!;
                void omitted;
                return { ...module, Engineering: identity };
            }),
        });
        assert.equal(
            imported.fittedModuleAt('MediumHardpoint1')?.stats?.engineeringLocked,
            true,
            symbol,
        );
        assert.throws(
            () => imported.clearEngineering('MediumHardpoint1'),
            /is a final pre-engineered article and its engineering cannot be removed/,
        );
    }
});

test('the modifier-less Inara AX capture restores its fixed articles', () => {
    const build = ShipLoadout.fromSlef(cutterCapture);
    const captured = cutterCapture[0]!.data.Modules.filter((module) =>
        module.Item.includes('atmulticannon'),
    );
    assert.equal(captured.length, 4);
    for (const module of captured) {
        assert.ok(module.Engineering);
        assert.equal('Modifiers' in module.Engineering, false, module.Slot);
        const fitted = build.fittedModuleAt(module.Slot)!;
        const variant = getPreEngineeredVariants(module.Item).find(
            (candidate) => candidate.acquisition === 'techBroker',
        )!;
        assert.equal(fitted.stats?.engineeringLocked, true, module.Slot);
        assert.equal(fitted.stats?.damage, getPreEngineeredStats(variant)?.damage, module.Slot);
        assert.equal(fitted.preEngineeredVariant, variant, module.Slot);
        assert.throws(
            () => build.clearEngineering(module.Slot),
            /is a final pre-engineered article and its engineering cannot be removed/,
        );
    }
    assert.equal(build.fittedModuleAt('mediumhardpoint3')?.stats?.damage, 1.232);
});

test('an imported legacy AX stock roll is not mistaken for a fixed reward', () => {
    const build = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            {
                Slot: 'MediumHardpoint1',
                Item: 'Hpt_ATDumbfireMissile_Fixed_Medium',
                Engineering: {
                    BlueprintName: 'Weapon_HighCapacity',
                    Level: 5,
                    Quality: 1,
                    Modifiers: [
                        { Label: 'AmmoMaximum', Value: 128, OriginalValue: 64 },
                        { Label: 'Mass', Value: 6.4, OriginalValue: 4 },
                    ],
                },
            },
        ],
    });
    const fitted = build.fittedModuleAt('MediumHardpoint1')!;
    assert.equal(fitted.stats?.engineeringLocked, undefined);
    assert.equal(fitted.stats?.damage, 27);
    assert.equal(fitted.stats?.ammoMaximum, 64);
    assert.equal(fitted.stats?.mass, 4);
    assert.equal(fitted.effectiveStats?.damage, 27);
    assert.equal(fitted.effectiveStats?.ammoMaximum, 128);
    assert.equal(fitted.effectiveStats?.mass, 6.4);
    build.clearEngineering('MediumHardpoint1');
    const cleared = build.fittedModuleAt('MediumHardpoint1')!;
    assert.equal(cleared.engineering, undefined);
    assert.equal(cleared.effectiveStats?.ammoMaximum, 64);
    assert.equal(cleared.effectiveStats?.mass, 4);
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
        const fitted = build.fittedModuleAt('MediumHardpoint1')!;
        assert.equal(fitted.stats?.engineeringLocked, true, article.symbol);
        assert.deepEqual(build.availableBlueprints('MediumHardpoint1'), [], article.symbol);
        assert.deepEqual(
            build.availableExperimentalEffects('MediumHardpoint1'),
            [],
            article.symbol,
        );
        assert.throws(
            () => build.applyBlueprint('MediumHardpoint1', 'GuardianModule_Sturdy', { grade: 1 }),
            /is a final pre-engineered article and accepts no further engineering/,
        );
        assert.throws(
            () => build.clearEngineering('MediumHardpoint1'),
            /is a final pre-engineered article and its engineering cannot be removed/,
        );
    }
});

test('a Guardian catalogue article with an added experimental keeps article stats', () => {
    const build = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            {
                Slot: 'MediumHardpoint1',
                Item: 'Hpt_Guardian_PlasmaLauncher_Fixed_Medium',
                Engineering: {
                    BlueprintName: 'Weapon_Overcharged',
                    Level: 1,
                    Quality: 1,
                    ExperimentalEffect: 'special_super_penetrator_cooled',
                },
            },
        ],
    });
    const fitted = build.fittedModuleAt('MediumHardpoint1')!;
    assert.equal(fitted.stats?.engineeringLocked, true);
    assert.equal(fitted.stats?.damage, 4.15);
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
    const fitted = build.fittedModuleAt('MediumHardpoint1')!;
    assert.equal(fitted.stats?.engineeringLocked, undefined);
    assert.deepEqual(
        build.availableBlueprints('MediumHardpoint1').map((blueprint) => blueprint.fdname),
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
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.engineering, undefined);
    assert.ok(build.frameShiftDrive.optMass < engineered); // back to base 1800
    assert.equal(build.frameShiftDrive.optMass, 1800);
});

test('clearing a fixed festive variant restores its stock module stats', () => {
    const expected = preEngineeredFixture.festive;
    const variant = getPreEngineeredVariants(expected.symbol).find(
        (candidate) => candidate.blueprint === expected.blueprints[0],
    )!;
    const stock = mod(expected.symbol, HARDPOINT_MODULES);
    const direct = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'MediumHardpoint1',
        variant,
    );
    const imported = ShipLoadout.fromLoadout(direct.toLoadoutEvent());

    for (const build of [direct, imported]) {
        assert.equal(build.fittedModuleAt('MediumHardpoint1')?.effectiveStats?.damage, 0.34);
        build.clearEngineering('MediumHardpoint1');
        const cleared = build.fittedModuleAt('MediumHardpoint1')!;
        assert.equal(cleared.engineering, undefined);
        assert.equal(cleared.stats?.damage, stock.damage);
        assert.equal(cleared.effectiveStats?.damage, stock.damage);
    }
});

test('resolved pre-engineered stats survive fitting and drive build calculations', () => {
    const variant = getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5').find(
        (candidate) => candidate.blueprint === 'FSD_LongRange',
    )!;
    const resolved = getPreEngineeredStats(variant)!;
    assert.equal(resolved.mass, 26);
    assert.equal(resolved.optMass, 1785);

    const build = ShipLoadout.empty('Anaconda').setModule('FrameShiftDrive', resolved);
    const fitted = build.fittedModuleAt('FrameShiftDrive')!;
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
        limitIncrease: { group: 'experimentalWeapon', amount: 1 },
        damageDistribution: { kinetic: 1 },
        damageComponents: { explosive: 4, unclassified: [1] },
        projectileRange: { maximumBoundary: 0, falloffBoundary: 100000 },
    };
    for (const input of [supplied, new Proxy(supplied, {})]) {
        const build = ShipLoadout.empty('Anaconda').setModule('Slot01_Size7', input);
        assert.equal(build.fittedModuleAt('Slot01_Size7')?.stats?.symbol, supplied.symbol);
        assert.equal(Object.isFrozen(supplied), false);
        assert.equal(Object.isFrozen(supplied.restrictedToShips), false);
        assert.equal(Object.isFrozen(supplied.limitIncrease), false);
        assert.equal(Object.isFrozen(supplied.damageDistribution), false);
        assert.equal(Object.isFrozen(supplied.damageComponents), false);
        assert.equal(Object.isFrozen(supplied.damageComponents?.unclassified), false);
        assert.equal(Object.isFrozen(supplied.projectileRange), false);
    }
    assert.doesNotThrow(() => (supplied.damageComponents!.unclassified as number[]).push(2));
});

// ── Immutable slot and fitted-module views ───────────────────────────────────

test('slots optionally filters the mounts by kind', () => {
    const conda = ShipLoadout.empty('Anaconda');
    assert.equal(conda.slots('core').length, 7);
    assert.equal(conda.slots('hardpoint').length, 8);
    assert.equal(conda.slots('utility').length, 8);
    assert.equal(conda.slots('optional').length, 14);
    // Each carries a human-readable name and the right kind.
    assert.ok(conda.slots('core').every((s) => s.kind === 'core' && s.name.length > 0));
    const fsd = conda.slots('core').find((s) => s.core === 'frameShiftDrive');
    assert.equal(fsd?.name, 'Frame Shift Drive');
    assert.equal(fsd?.key, 'FrameShiftDrive');
    assert.equal(conda.slots('hardpoint')[0]?.name, 'Huge Hardpoint 1');
    assert.equal(conda.slots('utility')[0]?.name, 'Utility Mount 1');
});

test('slot views are immutable point-in-time values', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const [drive] = conda.slots('core').filter((s) => s.core === 'frameShiftDrive');
    assert.ok(drive);
    assert.equal(drive.module, null);

    const drives = conda.modulesForSlot(drive.key);
    assert.ok(drives.length > 0 && drives.every((m) => m.class <= 6));

    conda.setModule(drive.key, mod('Int_Hyperdrive_Size6_Class5'));
    const fitted = conda.fittedModuleAt(drive.key)!;
    assert.equal(drive.module, null, 'the earlier snapshot does not change');
    assert.equal(
        conda.slots('core').find((slot) => slot.key === drive.key)?.module?.symbol,
        'Int_Hyperdrive_Size6_Class5',
    );
    assert.equal(fitted.symbol, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(fitted.slot, 'FrameShiftDrive');

    conda.setModule(drive.key, mod('Int_Hyperdrive_Size5_Class5'));
    assert.equal(
        fitted.symbol,
        'Int_Hyperdrive_Size6_Class5',
        'the earlier module snapshot stays readable',
    );
    assert.equal(conda.fittedModules().length, 2);
    assert.throws(() => Object.assign(drive, { name: 'changed' }), TypeError);
    assert.throws(() => Object.assign(fitted.raw, { Item: 'changed' }), TypeError);
});

test('keyed facade mutations produce new fitted-module snapshots', () => {
    const build = ShipLoadout.empty('Explorer_NX');
    const slot = build.slots('core').find((s) => s.core === 'frameShiftDrive')!;
    build.setModule(slot.key, mod('Int_Hyperdrive_Overcharge_Size8_Class5_OverchargeBooster_MkII'));
    const stock = build.fittedModuleAt(slot.key)!;

    build.applyBlueprint(slot.key, 'FSD_LongRange', {
        grade: 5,
        quality: 1,
        experimental: 'special_fsd_heavy',
    });
    const engineered = build.fittedModuleAt(slot.key)!;
    assert.ok(Math.abs(build.frameShiftDrive.optMass - 7528.04) < 1e-2);
    assert.equal(stock.engineering, undefined);
    assert.equal(engineered.engineering?.BlueprintName, 'FSD_LongRange');

    build.clearEngineering(slot.key);
    assert.equal(build.fittedModuleAt(slot.key)?.engineering, undefined);
    assert.equal(build.frameShiftDrive.optMass, 4670); // base
});

test('availableBlueprints / availableExperimentalEffects answer available engineering', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const blueprints = build.availableBlueprints('FrameShiftDrive');
    const longRange = blueprints.find((b) => b.fdname === 'FSD_LongRange');
    assert.ok(longRange, 'FSD_LongRange should be offered on an FSD');
    assert.deepEqual([...longRange!.grades], [1, 2, 3, 4, 5]);
    assert.equal(longRange!.route, 'ordinary');
    // No armour recipe leaks onto a frame shift drive.
    assert.ok(!blueprints.some((b) => b.fdname.toLowerCase().startsWith('armour_')));

    const experimentals = build.availableExperimentalEffects('FrameShiftDrive');
    assert.ok(experimentals.includes('special_fsd_heavy'));
    assert.ok(!experimentals.includes('special_shieldbooster_toughened'));
});

test('fittedModuleAt returns null for empty slots and fittedModules lists snapshots', () => {
    const build = ShipLoadout.empty('Anaconda');
    assert.equal(build.fittedModuleAt('Slot01_Size7'), null);
    build.setModule('Slot01_Size7', mod('Int_FuelTank_Size6_Class3'));
    const hatch = build.fittedModuleAt('CargoHatch')!;
    const snapshot = build.fittedModuleAt('Slot01_Size7')!;
    assert.deepEqual(build.fittedModules(), [hatch, snapshot]);
    build.removeModule(snapshot.slot);
    assert.equal(build.fittedModuleAt('Slot01_Size7'), null);
    assert.equal(snapshot.symbol, 'Int_FuelTank_Size6_Class3');
});

test('a fitted-module snapshot remains unchanged after replacement', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const before = build.fittedModuleAt('FrameShiftDrive')!;
    build.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size5_Class5'));
    const after = build.fittedModuleAt('FrameShiftDrive')!;
    assert.equal(before.symbol, 'Int_Hyperdrive_Size6_Class5');
    assert.equal(after.symbol, 'Int_Hyperdrive_Size5_Class5');
    assert.notEqual(before, after);
});

// ── Build metrics: power, shields, armour, weapons ───────────────────────────

/** Round the way the in-game statistics panel displays a calculated value. */
const displayed = (value: number, decimalPlaces: number): number =>
    Number(value.toFixed(decimalPlaces));

/** Read the in-game statistics panel's installed-module power semantics. */
const withAllModulesEnabled = (event: LoadoutEvent): ShipLoadout =>
    ShipLoadout.fromLoadout({
        ...event,
        Modules: event.Modules.map((module) => ({ ...module, On: true })),
    });

/** Read the statistics panel's combined hardpoint-and-utility offense totals. */
const offensePanelTotals = (build: ShipLoadout) => ({
    damagePerSecond:
        build.weaponMetrics().total.damagePerSecond +
        build
            .slots('utility')
            .reduce((total, slot) => total + damagePerSecond(slot.module?.effectiveStats ?? {}), 0),
    distributorDraw: [...build.slots('hardpoint'), ...build.slots('utility')].reduce(
        (total, slot) => total + (slot.module?.effectiveStats?.distributorDraw ?? 0),
        0,
    ),
    thermalLoad: [...build.slots('hardpoint'), ...build.slots('utility')].reduce(
        (total, slot) => total + (slot.module?.effectiveStats?.thermalLoad ?? 0),
        0,
    ),
});

test('all ten panel-audited builds reproduce their observed angular rates', () => {
    const cases = [
        ['beam Corvette', corvetteBeamsJournal, metrics.inGame.federalCorvetteBeams],
        ['Cobra Mk V', cobraMkVJournal, metrics.inGame.cobraMkV],
        ['Kestrel Mk II', kestrelMkIIJournal, metrics.inGame.kestrelMkII],
        ['The Deep Black', deepBlackJournal, metrics.inGame.deepBlack],
        ['Rescue', lynxRescueJournal, metrics.inGame.rescue],
        ['Rescue 01', lynxJournal, metrics.inGame.rescue01],
        ['Fat Arse', pantherJournal, metrics.inGame.fatArse],
        ['The Fixer', corsairJournal, metrics.inGame.theFixer],
        ['Spire Ops', spireOpsJournal, metrics.inGame.spireOps],
        ['Slapaconda', slapacondaJournal, metrics.inGame.slapaconda],
    ] as const;

    // The panel reports hundredths of a degree per second. Excluding reserve fuel puts
    // all 30 residuals within the half-hundredth rounding interval; the closest is Cobra
    // roll at 0.00491884°/s. Including reserve puts 21 outside it, with Cobra and Kestrel
    // roll the largest misses at 0.06348252°/s and 0.05896712°/s.
    const tolerance = 0.005;
    for (const [name, event, expected] of cases) {
        const actual = ShipLoadout.fromLoadout(event as LoadoutEvent).mobilityMetrics();
        assert.ok(actual, `${name}: missing mobility metrics`);
        for (const axis of ['pitch', 'roll', 'yaw'] as const) {
            const difference = Math.abs(actual[axis] - expected.speed[axis]);
            assert.ok(
                difference <= tolerance,
                `${name} ${axis}: calculated ${actual[axis]}, observed ${expected.speed[axis]}`,
            );
        }
    }
});

test('the beam Corvette reproduces the externally observed in-game build totals', () => {
    const expected = metrics.inGame.federalCorvetteBeams;
    const build = ShipLoadout.fromLoadout(corvetteBeamsJournal as LoadoutEvent);

    assert.equal(displayed(build.jumpRange(), 2), expected.jumpRange.fullTank);

    const installedPowerBuild = withAllModulesEnabled(corvetteBeamsJournal as LoadoutEvent);
    const power = installedPowerBuild.powerBudget();
    assert.equal(displayed(power.available, 1), expected.power.available);
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot01_Size7')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 3),
            thermal: displayed(armour.resistances.thermal, 3),
            explosive: displayed(armour.resistances.explosive, 3),
        },
        expected.armour.resistances,
    );
});

test('the Cobra Mk V reproduces the externally observed in-game build totals', () => {
    const expected = metrics.inGame.cobraMkV;
    const event = cobraMkVJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);

    // The in-game panel counts reserve fuel as mass but cannot use it for the jump.
    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = installedBuild.weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    assert.equal(displayed(weapons.total.thermalLoad, 1), expected.offense.thermalLoad);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 2), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot01_Size5')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 3),
            thermal: displayed(armour.resistances.thermal, 3),
            explosive: displayed(armour.resistances.explosive, 3),
        },
        expected.armour.resistances,
    );
});

test('the Kestrel Mk II reproduces the externally observed in-game build totals', () => {
    const expected = metrics.inGame.kestrelMkII;
    const event = kestrelMkIIJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(event.ShipName, '');
    assert.equal(expected.observedShipName, '[KDF] Slippery Fudge');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = installedBuild.weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot01_Size5')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 3),
            thermal: displayed(armour.resistances.thermal, 3),
            explosive: displayed(armour.resistances.explosive, 3),
        },
        expected.armour.resistances,
    );
});

test('The Deep Black reproduces every observed calculated total', () => {
    const expected = metrics.inGame.deepBlack;
    const event = deepBlackJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(build.shipName, 'The Deep Black');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 0), expected.power.retracted);
    assert.equal(displayed(power.deployed, 0), expected.power.deployed);

    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.damagePerSecond, 0), expected.offense.damagePerSecond);
    assert.equal(displayed(panel.distributorDraw, 0), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 0), expected.offense.thermalLoad);

    const mobility = build.mobilityMetrics()!;
    assert.equal(displayed(mobility.speed, 0), expected.speed.top);
    assert.equal(displayed(mobility.boost, 0), expected.speed.boost);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot04_Size5')!.effectiveStats!;
    assert.equal(generator.shieldRegenRate, expected.shields.regeneration.standard);
    // The catalogue's exact 3.75/s lies on the boundary displayed by the game as 3.7/s.
    assert.equal(generator.shieldBrokenRegenRate, 3.75);
    assert.ok(
        Math.abs(generator.shieldBrokenRegenRate - expected.shields.regeneration.broken) <= 0.05,
    );

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const thrusters = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.equal(displayed(thrusters.maxMass!, 1), expected.mass.maximum);
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 2),
            thermal: displayed(armour.resistances.thermal, 2),
            explosive: displayed(armour.resistances.explosive, 2),
        },
        expected.armour.resistances,
    );
});

test('the Rescue 01 Lynx Highliner reproduces every observed calculated total', () => {
    const expected = metrics.inGame.rescue01;
    const event = lynxJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(build.shipName, '[KPV] Rescue 01');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.damagePerSecond, 1), expected.offense.damagePerSecond);
    assert.equal(displayed(panel.distributorDraw, 2), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot02_Size5')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    const currentMass = build.unladenMass! + fuel.main + fuel.reserve;
    // Frontier's float32 total lies 0.000024 t over the half-tenth boundary but its
    // statistics panel displays the lower tenth.
    assert.ok(Math.abs(currentMass - expected.mass.current) <= 0.0501, `${currentMass}`);
    const thrusters = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.equal(thrusters.maxMass, expected.mass.maximum);
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 0), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 2),
            thermal: displayed(armour.resistances.thermal, 2),
            explosive: displayed(armour.resistances.explosive, 2),
        },
        expected.armour.resistances,
    );
});

test('the weaponless Rescue Lynx Highliner reproduces every observed calculated total', () => {
    const expected = metrics.inGame.rescue;
    const event = lynxRescueJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(build.shipName, '[KPV] Rescue');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = installedBuild.weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 0), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot04_Size4')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const thrusters = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.equal(thrusters.maxMass, expected.mass.maximum);
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 0), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 2),
            thermal: displayed(armour.resistances.thermal, 2),
            explosive: displayed(armour.resistances.explosive, 2),
        },
        expected.armour.resistances,
    );
});

test('Fat Arse reproduces every observed calculated total', () => {
    const expected = metrics.inGame.fatArse;
    const event = pantherJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(build.shipName, '[KLD] Fat Arse');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 1), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.damagePerSecond, 0), expected.offense.damagePerSecond);
    assert.equal(displayed(panel.distributorDraw, 0), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot03_Size6')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const thrusters = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.equal(thrusters.maxMass, expected.mass.maximum);
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 2),
            thermal: displayed(armour.resistances.thermal, 2),
            explosive: displayed(armour.resistances.explosive, 2),
        },
        expected.armour.resistances,
    );
});

test('the Corsair reproduces the externally observed in-game build totals', () => {
    const expected = metrics.inGame.theFixer;
    const event = corsairJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(build.shipName, '[KDF] The Fixer');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 1), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = installedBuild.weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot01_Size6')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const thrusters = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.equal(thrusters.maxMass, expected.mass.maximum);
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 2),
            thermal: displayed(armour.resistances.thermal, 2),
            explosive: displayed(armour.resistances.explosive, 2),
        },
        expected.armour.resistances,
    );
});

test('Spire Ops reproduces the observed totals', () => {
    const expected = metrics.inGame.spireOps;
    const event = spireOpsJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(build.shipName, '[KAXF] Spire Ops');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = installedBuild.weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = build.shieldMetrics()!;
    assert.equal(displayed(shields.strength, 1), expected.shields.strength);
    assert.deepEqual(
        {
            kinetic: displayed(shields.resistances.kinetic, 3),
            thermal: displayed(shields.resistances.thermal, 3),
            explosive: displayed(shields.resistances.explosive, 3),
        },
        expected.shields.resistances,
    );
    const generator = build.fittedModuleAt('Slot02_Size4')!.effectiveStats!;
    assert.equal(displayed(generator.shieldRegenRate!, 1), expected.shields.regeneration.standard);
    assert.equal(
        displayed(generator.shieldBrokenRegenRate!, 1),
        expected.shields.regeneration.broken,
    );

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const thrusters = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.equal(thrusters.maxMass, expected.mass.maximum);
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 3),
            thermal: displayed(armour.resistances.thermal, 3),
            explosive: displayed(armour.resistances.explosive, 3),
        },
        expected.armour.resistances,
    );
});

test('Slapaconda reproduces every observed calculated total', () => {
    const expected = metrics.inGame.slapaconda;
    const event = slapacondaJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const fuel = build.fuelCapacity;
    assert.ok(fuel);
    assert.equal(build.shipName, '[KAXF] Slapaconda');

    assert.equal(
        displayed(build.jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = installedBuild.powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = installedBuild.weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);
    const shard = build.fittedModuleAt('HugeHardpoint1')!.effectiveStats!;
    assert.equal(
        build.fittedModuleAt('HugeHardpoint1')!.preEngineeredVariant?.acquisition,
        'techBroker',
    );
    assert.equal(shard.damage, 3.7235);
    assert.equal(displayed(damagePerSecond(shard), 1), 74.5);
    assert.equal(shard.shotSpeed, 6299.208984);

    assert.equal(expected.shields.strength, 0);
    assert.equal(build.shieldMetrics(), null);

    assert.equal(
        displayed(build.unladenMass! + fuel.main + fuel.reserve, 1),
        expected.mass.current,
    );
    const thrusters = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.equal(thrusters.maxMass, expected.mass.maximum);
    const armour = build.armourMetrics()!;
    assert.equal(displayed(armour.hitPoints, 1), expected.armour.hitPoints);
    assert.deepEqual(
        {
            kinetic: displayed(armour.resistances.kinetic, 3),
            thermal: displayed(armour.resistances.thermal, 3),
            explosive: displayed(armour.resistances.explosive, 3),
        },
        expected.armour.resistances,
    );
});

test('an imported V1 drive is resolved before its added experimental is folded in', () => {
    const drive = ShipLoadout.fromLoadout(pantherJournal as LoadoutEvent).fittedModuleAt(
        'FrameShiftDrive',
    )!;
    assert.equal(drive.preEngineeredVariant?.acquisition, 'techBroker');
    assert.equal(drive.preEngineeredVariant?.experimental, undefined);
    assert.equal(drive.engineering?.ExperimentalEffect, 'special_fsd_heavy');
    assert.equal(drive.stats?.optMass, 5100);
    assert.equal(drive.effectiveStats?.optMass, 5304);
});

test('an identified reward supplies an omitted baked-experimental stat', () => {
    const expected = preEngineeredFixture.identification.omittedBakedExperimental;
    const source = corvetteMixedJournal as LoadoutEvent;
    const modules = source.Modules.map((module) =>
        module.Slot !== expected.slot
            ? module
            : {
                  ...module,
                  Engineering: {
                      ...module.Engineering!,
                      ExperimentalEffect: ` ${module.Engineering!.ExperimentalEffect!.toUpperCase()} `,
                      Modifiers: [
                          ...module.Engineering!.Modifiers!.filter(
                              (modifier) => modifier.Label !== expected.omitted,
                          ),
                          expected.reportedInstead,
                      ],
                  },
              },
    );
    const rail = ShipLoadout.fromLoadout({ ...source, Modules: modules }).fittedModuleAt(
        expected.slot,
    )!;
    assert.equal(rail.preEngineeredVariant?.experimental, 'special_feedback_cascade_cooled');
    assert.equal(rail.stats?.thermalLoad, expected.expectedThermalLoad);
    assert.equal(rail.effectiveStats?.thermalLoad, expected.expectedThermalLoad);
});

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
    const armour = build.armourMetrics()!;
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

    const armour = build.armourMetrics()!;
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
    assert.equal(
        weapons.total.thermalLoad,
        weapons.weapons.reduce((sum, weapon) => sum + weapon.metrics.thermalLoad, 0),
    );
    assert.ok(near(weapons.total.powerDraw, expectedBuild.weapons.powerDraw));
    assert.ok(
        near(weapons.total.damageByType.kinetic, expectedBuild.weapons.kineticDamagePerSecond),
    );
    assert.ok(
        near(weapons.total.damageByType.thermal, expectedBuild.weapons.thermalDamagePerSecond),
    );
});

test('weaponsCapacitorMetrics scales fitted distributor recharge by WEP pips', () => {
    const build = ShipLoadout.fromLoadout(corvetteBeamsJournal as LoadoutEvent);
    const rated = build.weaponsCapacitorMetrics();
    const halfPips = build.weaponsCapacitorMetrics({ weaponsPips: 2 });
    const distributor = build.fittedModuleAt('PowerDistributor')!.effectiveStats!;

    assert.equal(rated.capacity, distributor.weaponsCapacity);
    assert.equal(rated.rechargeRate, distributor.weaponsRecharge);
    assert.equal(
        rated.sustainedEnergyPerSecond,
        build.weaponMetrics().total.sustainedEnergyPerSecond,
    );
    assert.ok(halfPips.rechargeRate < rated.rechargeRate);
    assert.ok(halfPips.netDrainRate >= rated.netDrainRate);
    assert.throws(() => build.weaponsCapacitorMetrics({ weaponsPips: 5 }), {
        name: 'RangeError',
        message:
            'ShipLoadout.weaponsCapacitorMetrics: weaponsPips must be a finite number from 0 to 4',
    });
});

test('distributorMetrics reports every fitted capacitor at its selected pips', () => {
    const build = ShipLoadout.fromLoadout(corvetteBeamsJournal as LoadoutEvent);
    const distributor = build.fittedModuleAt('PowerDistributor')!.effectiveStats!;
    const rated = build.distributorMetrics()!;
    const halfPips = build.distributorMetrics({
        systemsPips: 2,
        enginesPips: 2,
        weaponsPips: 2,
    })!;

    assert.deepEqual(rated.pips, { systems: 4, engines: 4, weapons: 4 });
    for (const capacitor of ['systems', 'engines', 'weapons'] as const) {
        const capacity = `${capacitor}Capacity` as const;
        const recharge = `${capacitor}Recharge` as const;
        assert.equal(rated[capacitor].capacity, distributor[capacity]);
        assert.equal(rated[capacitor].ratedRecharge, distributor[recharge]);
        assert.equal(rated[capacitor].rechargeRate, distributor[recharge]);
        assert.ok(halfPips[capacitor].rechargeRate < rated[capacitor].rechargeRate);
    }
    assert.equal(
        halfPips.engines.rechargeRate,
        distributor.enginesRecharge! * Math.pow(2 / 4, 1.1),
    );
    assert.throws(() => build.distributorMetrics({ enginesPips: 5 }), {
        name: 'RangeError',
        message: 'ShipLoadout.distributorMetrics: enginesPips must be a finite number from 0 to 4',
    });
});

test('distributorMetrics returns null without a powered distributor', () => {
    assert.equal(ShipLoadout.empty('Anaconda').distributorMetrics(), null);

    const off = ShipLoadout.default('Anaconda').setModuleEnabled('PowerDistributor', false);
    assert.equal(off.distributorMetrics(), null);
});

test('weaponsCapacitorMetrics excludes modules shed with hardpoints deployed', () => {
    const starved = ShipLoadout.fromLoadout(corvetteBeamsJournal as LoadoutEvent).setModule(
        'PowerPlant',
        getModuleBySymbol(heatFixture.unpowered.powerPlant, CORE_MODULES)!,
    );
    assert.ok(starved.powerBudget().bands.every((band) => !band.poweredDeployed));
    assert.deepEqual(starved.weaponsCapacitorMetrics(), {
        weaponsPips: 4,
        capacity: 0,
        rechargeRate: 0,
        sustainedEnergyPerSecond: 0,
        netDrainRate: 0,
        timeToDrain: Infinity,
    });
    assert.equal(starved.distributorMetrics(), null);
});

test('a hull with no shield generator reports no shields', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'PowerPlant',
        mod('Int_Powerplant_Size8_Class5'),
    );
    assert.equal(build.shieldMetrics(), null);
    // ...but still has the armour it left the shipyard with.
    assert.equal(build.armourMetrics()!.hitPoints, 945);
});

test('switched-off modules drop out of every metric', () => {
    const build = fixtureAnaconda();
    const lit = build.weaponMetrics().total.damagePerSecond;
    const shielded = build.shieldMetrics()!.strength;

    const off = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: build.fittedModules().map(({ raw }) => ({ ...raw, On: false })),
    });
    assert.equal(off.shieldMetrics(), null); // the generator is off
    assert.equal(off.powerBudget().available, 0); // so is the plant
    assert.equal(off.weaponMetrics().total.damagePerSecond, 0);
    assert.equal(off.weaponsCapacitorMetrics().capacity, 0);
    assert.equal(off.weaponsCapacitorMetrics().rechargeRate, 0);
    assert.equal(off.weaponsCapacitorMetrics().timeToDrain, Infinity);
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

    const bareArmour = build.armourMetrics()!.hitPoints;
    build.applyBlueprint('Armour', 'Armour_HeavyDuty', { grade: 5 });
    const heavyArmour = build.armourMetrics()!;
    // Heavy Duty compounds on the armour multiplier: x3.5 becomes x4.62.
    assert.ok(near(heavyArmour.bulkheads, 525 * 4.62));
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
    assert.ok(near(summary.unladen, build.jumpRange()));
    assert.ok(near(summary.laden, build.ladenJumpRange()));
    assert.equal(summary.totalMax.jumps, expected.totalMaxJumps);
    assert.ok(near(summary.totalMax.range, expected.totalMaxRange));
    assert.ok(near(summary.totalMax.range, summary.max));
    assert.deepEqual(summary.totalUnladen, build.totalRange());
    assert.deepEqual(summary.totalLaden, build.totalRange({ cargo: build.cargoCapacity! }));
    // Best single jump beats a full tank, which beats a full tank and a full hold.
    assert.ok(summary.max > summary.unladen);
    assert.ok(summary.unladen > summary.laden);
    assert.ok(summary.totalUnladen.range > summary.totalLaden.range);
    // A partial load sits between the two.
    const partial = build.jumpRange({ cargo: build.cargoCapacity! / 2 });
    assert.ok(partial < summary.unladen && partial > summary.laden);
});

test('a fitted module reports its stats before and after engineering', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Gimbal_Large', HARDPOINT_MODULES),
    );
    const gun = build.fittedModuleAt('LargeHardpoint1')!;
    // Stock: the effective record is the catalogue record itself.
    assert.deepEqual(gun.effectiveStats, gun.stats);

    build.applyBlueprint(gun.slot, 'Weapon_Overcharged', { grade: 5 });
    const after = build.fittedModuleAt('LargeHardpoint1')!;
    assert.ok(after.effectiveStats!.damage! > after.stats!.damage!);
    assert.equal(after.effectiveStats!.symbol, after.stats!.symbol);
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
    const hatch = build.fittedModuleAt('CargoHatch')!.effectiveStats!.powerDraw!;
    const booster = mod('Hpt_ShieldBooster_Size0_Class5', UTILITY_MODULES);
    const scanner = mod('Hpt_CrimeScanner_Size0_Class5', UTILITY_MODULES);
    // The shield booster is always powered; the kill warrant scanner is not.
    assert.ok(near(budget.retracted, hatch + booster.powerDraw!));
    assert.ok(near(budget.deployed, hatch + booster.powerDraw! + scanner.powerDraw!));
});

test('power budgets expose known and disabled fitted consumers', () => {
    const source = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const build = ShipLoadout.fromLoadout({
        ...source,
        Modules: [
            ...source.Modules.map((module) =>
                module.Slot === 'SmallHardpoint1'
                    ? { ...module, On: true, Priority: 4 }
                    : module.Slot === 'SmallHardpoint2'
                      ? { ...module, On: false, Priority: 2 }
                      : module,
            ),
        ],
    });
    const budget = build.powerBudget();
    const enabled = budget.consumers.find((consumer) => consumer.label === 'SmallHardpoint1');
    const disabled = budget.consumers.find((consumer) => consumer.label === 'SmallHardpoint2');

    assert.equal(enabled?.enabled, true);
    assert.equal(enabled?.priority, 5);
    assert.equal(enabled?.deployedOnly, true);
    assert.equal(disabled?.enabled, false);
    assert.equal(disabled?.priority, 3);
});

test("a build whose hull is beyond the generator's maximum mass has no shields", () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('PowerPlant', mod('Int_Powerplant_Size8_Class5'))
        .setModule('Slot01_Size7', mod('Int_ShieldGenerator_Size1_Class1', INTERNAL_MODULES));
    // A size-1 generator cannot cover a 400 t hull.
    assert.equal(build.shieldMetrics()!.strength, 0);
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
    const armour = build.armourMetrics()!;
    assert.equal(armour.reinforcement, 341 + 525 * 0.06);
    assert.equal(armour.hitPoints, 945 + 341 + 31.5);
});

test('engineering the burst pattern exposes the journal rate of fire', () => {
    // Double Shot is the fragment cannons' recipe — the only group whose menu lists it.
    const build = ShipLoadout.empty('Anaconda').setModule(
        'LargeHardpoint1',
        mod('Hpt_Slugshot_Gimbal_Large', HARDPOINT_MODULES),
    );
    const stockDamage = build.fittedModuleAt('LargeHardpoint1')!.stats!.damage!;
    const before = build.weaponMetrics().total.damagePerSecond;
    // Double Shot's primitive recipe gives the weapon a two-round burst. Frontier writes
    // only the resulting RateOfFire and DamagePerSecond to the journal. Effective stats
    // retain the primitive burst values so reload-cycle calculations remain exact.
    build.applyBlueprint('LargeHardpoint1', 'Weapon_DoubleShot', { grade: 5 });
    const fitted = build.fittedModuleAt('LargeHardpoint1')!;
    const engineered = fitted.effectiveStats!;
    assert.equal(engineered.burstRounds, 2);
    assert.equal(engineered.burstRateOfFire, 14);
    assert.equal(engineered.damage, stockDamage);
    assert.ok(
        fitted.engineering!.Modifiers!.every(
            (modifier) => modifier.Label !== 'BurstSize' && modifier.Label !== 'BurstRateOfFire',
        ),
    );
    const after = build.weaponMetrics();
    assert.ok(after.total.damagePerSecond > before);
    assert.ok(near(after.total.sustainedDamagePerSecond, 48.176470588, 1e-6));
    const expectedRate = modFor(fitted.engineering!.Modifiers!, 'RateOfFire')!;
    assert.ok(Math.abs(after.weapons[0]!.metrics.rateOfFire - expectedRate) < 1e-6);
    assert.ok(near(engineered.rateOfFire!, expectedRate, 1e-6));
});

test('a long-range weapon keeps its damage all the way out', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Gimbal_Large', HARDPOINT_MODULES),
    );
    build.applyBlueprint('LargeHardpoint1', 'Weapon_LongRange', { grade: 5 });
    const engineered = build.fittedModuleAt('LargeHardpoint1')!.effectiveStats!;
    assert.equal(engineered.falloffRange, engineered.maximumRange);
    assert.equal(damageFalloff(engineered, engineered.maximumRange! - 1), 1);
});

test('weapon metrics expose effective range, projectile boundaries and piercing', () => {
    const build = ShipLoadout.default('SideWinder');
    const stock = build.weaponMetrics().weapons[0]!;
    assert.equal(stock.maximumRange, 3000);
    assert.equal(stock.falloffRange, 500);
    assert.equal(stock.armourPiercing, 20);

    build.applyBlueprint(stock.slot, 'Weapon_LongRange', { grade: 5 });
    const engineered = build.weaponMetrics().weapons[0]!;
    assert.equal(engineered.maximumRange, 6000);
    assert.equal(engineered.falloffRange, 6000);

    const projectile = ShipLoadout.empty('Anaconda')
        .setModule('MediumHardpoint1', mod('Hpt_ATDumbfireMissile_Fixed_Medium', HARDPOINT_MODULES))
        .weaponMetrics().weapons[0]!;
    assert.deepEqual(projectile.projectileRange, {
        maximumBoundary: 0,
        falloffBoundary: 100000,
    });

    const laser = ShipLoadout.empty('SideWinder')
        .setModule('SmallHardpoint1', mod('Hpt_BeamLaser_Fixed_Small', HARDPOINT_MODULES))
        .weaponMetrics().weapons[0]!;
    assert.equal('projectileRange' in laser, false);
});

test('weapon metrics use hull slot order and append unmapped slots in source order', () => {
    const source = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const weapon = source.Modules.find((module) => module.Slot === 'SmallHardpoint1')!;
    const build = ShipLoadout.fromLoadout({
        ...source,
        Modules: [
            { ...weapon, Slot: 'FutureHardpointB' },
            ...[...source.Modules].reverse(),
            { ...weapon, Slot: 'FutureHardpointA' },
        ],
    });

    assert.deepEqual(
        build.weaponMetrics().weapons.map(({ slot }) => slot),
        ['SmallHardpoint1', 'SmallHardpoint2', 'FutureHardpointB', 'FutureHardpointA'],
    );
});

test('Rapid Fire applies to a plain weapon, adding the jitter it had none of', () => {
    const build = ShipLoadout.empty('Vulture').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Fixed_Medium', HARDPOINT_MODULES),
    );
    const gun = build.fittedModuleAt('LargeHardpoint1')!;
    assert.equal(gun.stats!.jitter, undefined);
    assert.ok(build.availableBlueprints(gun.slot).some((b) => b.fdname === 'Weapon_RapidFire'));

    build.applyBlueprint('LargeHardpoint1', 'Weapon_RapidFire', { grade: 5 });
    const fitted = build.fittedModuleAt('LargeHardpoint1')!;
    const engineered = fitted.effectiveStats!;
    assert.equal(engineered.jitter, 0.5); // additive, from an assumed zero
    // The primitive interval remains available to calculations while the journal exposes
    // only its resulting RateOfFire.
    assert.ok(near(engineered.burstInterval!, 0.14 * 0.56, 1e-6));
    assert.ok(
        near(engineered.rateOfFire!, modFor(fitted.engineering!.Modifiers!, 'RateOfFire')!, 1e-6),
    );
    assert.ok(build.weaponMetrics().total.damagePerSecond > 0);
});

test('a festive pre-engineered variant changes only its slot and round-trips', () => {
    const expected = preEngineeredFixture.festive;
    const variant = getPreEngineeredVariants(expected.symbol).find(
        (candidate) => candidate.blueprint === expected.blueprints[1],
    )!;
    const rapidFire = mod('Hpt_MultiCannon_Fixed_Medium', HARDPOINT_MODULES);
    const build = ShipLoadout.empty('Anaconda')
        .setModule('LargeHardpoint1', rapidFire)
        .applyBlueprint('LargeHardpoint1', 'Weapon_RapidFire', { grade: 5 });
    const otherBefore = build.fittedModuleAt('LargeHardpoint1')!;
    const intervalBefore = otherBefore.effectiveStats!.burstInterval;

    build.setPreEngineeredVariant('MediumHardpoint1', variant);

    const decorated = build.fittedModuleAt('MediumHardpoint1')!;
    const expectedModifiers = getPreEngineeredJournalModifiers(variant);
    assert.deepEqual(decorated.engineering, {
        BlueprintName: variant.blueprint,
        Level: expected.grade,
        Quality: 1,
        Modifiers: expectedModifiers,
    });
    assert.equal(decorated.symbol, expected.symbol);
    assert.ok(near(decorated.stats!.damage!, expected.resolved.damage, 1e-9));
    assert.ok(near(decorated.effectiveStats!.damage!, expected.resolved.damage, 1e-9));
    assert.equal(decorated.preEngineeredVariant, variant);

    const otherAfter = build.fittedModuleAt('LargeHardpoint1')!;
    assert.deepEqual(otherAfter.engineering, otherBefore.engineering);
    assert.equal(otherAfter.effectiveStats!.burstInterval, intervalBefore);

    const event: LoadoutEvent = build.toLoadoutEvent();
    const exported = event.Modules.find((module) => module.Slot === 'MediumHardpoint1')!;
    assert.deepEqual(exported.Engineering, decorated.engineering);
    const reimported = ShipLoadout.fromLoadout(event).fittedModuleAt('MediumHardpoint1')!;
    assert.ok(near(reimported.effectiveStats!.damage!, decorated.effectiveStats!.damage!, 1e-6));
    assert.equal(reimported.preEngineeredVariant?.blueprint, variant.blueprint);
});

test('a graded pre-engineered variant fits with its complete engineering state', () => {
    const expected = preEngineeredFixture.resolved.fsdV1Size5;
    const variant = getPreEngineeredVariants(expected.symbol).find(
        (candidate) =>
            candidate.blueprint === expected.blueprint && candidate.acquisition === 'techBroker',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('FrameShiftDrive', variant);

    const fitted = build.fittedModuleAt('FrameShiftDrive')!;
    assert.deepEqual(fitted.engineering, {
        BlueprintName: variant.blueprint,
        Level: variant.grade,
        Quality: 1,
        Modifiers: getPreEngineeredJournalModifiers(variant),
    });
    assert.equal(fitted.effectiveStats!.optMass, expected.engineered.optMass);
    assert.equal(fitted.stats!.optMass, expected.engineered.optMass);
    assert.equal(fitted.preEngineeredVariant, variant);

    const reimported = ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt(
        'FrameShiftDrive',
    )!;
    assert.equal(reimported.stats!.optMass, fitted.stats!.optMass);
    assert.equal(reimported.effectiveStats!.optMass, expected.engineered.optMass);
    assert.equal(reimported.preEngineeredVariant, variant);
});

test('a craftable blueprint replaces fixed variant engineering from stock stats', () => {
    const variant = getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5').find(
        (candidate) =>
            candidate.blueprint === 'FSD_LongRange' && candidate.acquisition === 'techBroker',
    )!;
    const fixed = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('FrameShiftDrive', variant);
    const imported = ShipLoadout.fromLoadout(fixed.toLoadoutEvent());
    const fromStock = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod(variant.symbol, CORE_MODULES))
        .applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
            grade: 5,
            experimental: 'special_fsd_heavy',
        });

    for (const replacement of [fixed, imported]) {
        replacement.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
            grade: 5,
            experimental: 'special_fsd_heavy',
        });
        assert.deepEqual(
            replacement.fittedModuleAt('FrameShiftDrive')?.effectiveStats,
            fromStock.fittedModuleAt('FrameShiftDrive')?.effectiveStats,
        );
        assert.equal(replacement.fittedModuleAt('FrameShiftDrive')?.preEngineeredVariant, null);
    }
});

test('setExperimentalEffect preserves fixed reward modifiers and identity', () => {
    const variant = getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5').find(
        (candidate) => candidate.acquisition === 'techBroker',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('FrameShiftDrive', variant);
    const fixedOptimalMass = build.fittedModuleAt('FrameShiftDrive')!.effectiveStats!.optMass!;

    const added = build.setExperimentalEffect('FrameShiftDrive', 'special_fsd_heavy');
    assert.deepEqual(added, {
        kind: 'updated',
        previousExperimental: null,
        experimental: 'special_fsd_heavy',
    });
    assert.ok(Object.isFrozen(added));
    assert.ok(
        near(
            build.fittedModuleAt('FrameShiftDrive')!.effectiveStats!.optMass!,
            fixedOptimalMass * 1.04,
        ),
    );
    assert.equal(build.fittedModuleAt('FrameShiftDrive')!.preEngineeredVariant, variant);

    assert.deepEqual(build.setExperimentalEffect('FrameShiftDrive', 'special_fsd_lightweight'), {
        kind: 'updated',
        previousExperimental: 'special_fsd_heavy',
        experimental: 'special_fsd_lightweight',
    });
    assert.equal(
        build.fittedModuleAt('FrameShiftDrive')!.effectiveStats!.optMass,
        fixedOptimalMass,
    );
    assert.equal(
        ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt('FrameShiftDrive')!
            .preEngineeredVariant,
        variant,
    );

    assert.deepEqual(build.setExperimentalEffect('FrameShiftDrive', null), {
        kind: 'updated',
        previousExperimental: 'special_fsd_lightweight',
        experimental: null,
    });
    assert.equal(
        build.fittedModuleAt('FrameShiftDrive')!.effectiveStats!.optMass,
        fixedOptimalMass,
    );
    assert.equal(build.fittedModuleAt('FrameShiftDrive')!.preEngineeredVariant, variant);
    assert.deepEqual(build.setExperimentalEffect('FrameShiftDrive', null), {
        kind: 'unchanged',
        experimental: null,
    });
});

test('fixed reward effect removal and replacement survive a loadout round trip', () => {
    const variant = getPreEngineeredVariants('Hpt_Slugshot_Gimbal_Large').find(
        (candidate) => candidate.experimental === 'special_screening_shell',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('LargeHardpoint1', variant);
    assert.equal(build.fittedModuleAt('LargeHardpoint1')!.effectiveStats!.reloadTime, 2.5);

    build.setExperimentalEffect('LargeHardpoint1', null);
    assert.equal(build.fittedModuleAt('LargeHardpoint1')!.effectiveStats!.reloadTime, 5);
    assert.equal(
        ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt('LargeHardpoint1')!
            .effectiveStats!.reloadTime,
        5,
    );

    build.setExperimentalEffect('LargeHardpoint1', 'special_blinding_shell');
    assert.equal(
        ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt('LargeHardpoint1')!
            .effectiveStats!.reloadTime,
        5,
    );
});

test('a fixed reward effect updates related stats before and after a round trip', () => {
    const variant = getPreEngineeredVariants('Int_ShieldGenerator_Size3_Class5').find(
        (candidate) => candidate.acquisition === 'communityGoal',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('Slot08_Size4', variant);
    build.setExperimentalEffect('Slot08_Size4', 'special_shield_efficient');

    const live = build.fittedModuleAt('Slot08_Size4')!.effectiveStats!.minMultiplier!;
    const roundTripped = ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt(
        'Slot08_Size4',
    )!.effectiveStats!.minMultiplier!;
    assert.ok(near(live, 0.686000035));
    assert.ok(near(roundTripped, live));
});

test('a fixed reward effect keeps recipe-only stats through a round trip', () => {
    const variant = getPreEngineeredVariants('Hpt_BasicMissileRack_Fixed_Medium').find(
        (candidate) => candidate.experimental === 'special_drag_munitions',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'MediumHardpoint1',
        variant,
    );
    build.setExperimentalEffect('MediumHardpoint1', 'special_fsd_interrupt');

    const live = build.fittedModuleAt('MediumHardpoint1')!.effectiveStats!;
    const roundTripped = ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt(
        'MediumHardpoint1',
    )!.effectiveStats!;
    assert.equal(live.burstInterval, 3.6);
    assert.equal(roundTripped.burstInterval, live.burstInterval);
    assert.ok(near(roundTripped.rateOfFire!, live.rateOfFire!, 1e-6));
});

test('a baked effect outside the module menu can be kept and restored', () => {
    const variant = getPreEngineeredVariants('Hpt_MiningLaser_Fixed_Small').find(
        (candidate) => candidate.experimental === 'special_incendiary_rounds',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('SmallHardpoint1', variant);

    assert.deepEqual(build.setExperimentalEffect('SmallHardpoint1', variant.experimental!), {
        kind: 'unchanged',
        experimental: variant.experimental,
    });
    assert.equal(build.setExperimentalEffect('SmallHardpoint1', null).kind, 'updated');
    assert.equal(
        build.setExperimentalEffect('SmallHardpoint1', variant.experimental!).kind,
        'updated',
    );
});
test('setExperimentalEffect recomputes ordinary and Mercenary engineering in place', () => {
    const ordinary = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5, quality: 0.42 });
    ordinary.setExperimentalEffect('FrameShiftDrive', 'special_fsd_heavy');
    assert.equal(ordinary.fittedModuleAt('FrameShiftDrive')!.engineering!.Quality, 0.42);
    assert.equal(
        ordinary.fittedModuleAt('FrameShiftDrive')!.engineering!.ExperimentalEffect,
        'special_fsd_heavy',
    );

    const converted = ShipLoadout.empty('Anaconda')
        .setModule('MediumHardpoint1', mod('Hpt_BasicMissileRack_Fixed_Medium', HARDPOINT_MODULES))
        .applyBlueprint('MediumHardpoint1', 'Weapon_HighCapacity', {
            grade: 5,
            experimental: 'special_overload_munitions',
        });
    assert.equal(converted.setExperimentalEffect('MediumHardpoint1', null).kind, 'updated');

    const variant = getPreEngineeredVariants('Int_PowerDistributor_Size6_Class5').find(
        (candidate) => candidate.acquisition === 'mercenary',
    )!;
    const mercenary = ShipLoadout.empty('Anaconda')
        .setPreEngineeredVariant('PowerDistributor', variant)
        .applyBlueprint('PowerDistributor', variant.blueprint, { grade: 2, quality: 0.5 });
    assert.equal(
        mercenary.setExperimentalEffect('PowerDistributor', 'special_powerdistributor_capacity')
            .kind,
        'updated',
    );
    assert.equal(mercenary.fittedModuleAt('PowerDistributor')!.engineering!.Quality, 0.5);
    assert.equal(mercenary.fittedModuleAt('PowerDistributor')!.preEngineeredVariant, variant);
    const rescue = ShipLoadout.fromLoadout(lynxRescueJournal as LoadoutEvent);
    assert.equal(
        rescue.setExperimentalEffect('PowerPlant', 'special_powerplant_cooled').kind,
        'updated',
    );
});

test('setExperimentalEffect returns structured refusals without changing the module', () => {
    const empty = ShipLoadout.empty('Anaconda');
    assert.deepEqual(empty.setExperimentalEffect('FrameShiftDrive', null), {
        kind: 'unsupported',
        code: 'emptySlot',
        params: { slot: 'FrameShiftDrive' },
    });

    const unengineered = ShipLoadout.default('Anaconda');
    const notEngineered = unengineered.setExperimentalEffect(
        'FrameShiftDrive',
        'special_fsd_heavy',
    );
    assert.equal(notEngineered.kind, 'unsupported');
    assert.equal(notEngineered.code, 'notEngineered');
    const engineered = unengineered.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
        grade: 5,
    });
    const before = engineered.fittedModuleAt('FrameShiftDrive')!.raw;
    for (const [experimental, code] of [
        ['NoSuchEffect', 'unknownExperimentalEffect'],
        ['special_incendiary_rounds', 'unsupportedExperimentalEffect'],
    ] as const) {
        const result = engineered.setExperimentalEffect('FrameShiftDrive', experimental);
        assert.equal(result.kind, 'unsupported');
        assert.equal(result.code, code);
        assert.ok(Object.isFrozen(result.params));
        assert.deepEqual(engineered.fittedModuleAt('FrameShiftDrive')!.raw, before);
    }

    const unsupported = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            {
                Slot: 'FrameShiftDrive',
                Item: 'Int_Hyperdrive_Size6_Class5',
                Engineering: { BlueprintName: 'FutureBlueprint', Level: 5, Quality: 0.5 },
            },
        ],
    });
    const unsupportedResult = unsupported.setExperimentalEffect(
        'FrameShiftDrive',
        'special_fsd_heavy',
    );
    assert.equal(unsupportedResult.kind, 'unsupported');
    assert.equal(unsupportedResult.code, 'unsupportedEngineering');

    for (const grade of [0, 7, 2.5, Number.NaN]) {
        const invalidGrade = ShipLoadout.fromLoadout({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'FrameShiftDrive',
                    Item: 'Int_Hyperdrive_Size6_Class5',
                    Engineering: {
                        BlueprintName: 'FSD_LongRange',
                        Level: grade,
                        Quality: 1,
                    },
                },
            ],
        });
        const result = invalidGrade.setExperimentalEffect('FrameShiftDrive', 'special_fsd_heavy');
        assert.equal(result.kind, 'unsupported');
        assert.equal(result.code, 'unsupportedEngineering');
    }

    const fixedVariant = getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5').find(
        (candidate) => candidate.acquisition === 'techBroker',
    )!;
    const fixed = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'FrameShiftDrive',
        fixedVariant,
    );
    const fixedEvent = fixed.toLoadoutEvent();
    const unidentified = ShipLoadout.fromLoadout({
        ...fixedEvent,
        Modules: fixedEvent.Modules.map((module) =>
            module.Slot === 'FrameShiftDrive'
                ? {
                      ...module,
                      Engineering: {
                          ...module.Engineering!,
                          ExperimentalEffect: 'future_effect',
                      },
                  }
                : module,
        ),
    });
    const unidentifiedBefore = unidentified.fittedModuleAt('FrameShiftDrive')!.raw;
    assert.deepEqual(unidentified.setExperimentalEffect('FrameShiftDrive', 'special_fsd_heavy'), {
        kind: 'unsupported',
        code: 'unidentifiedPreEngineeredVariant',
        params: {
            slot: 'FrameShiftDrive',
            symbol: fixedEvent.Modules.find((module) => module.Slot === 'FrameShiftDrive')!.Item,
            blueprint: fixedVariant.blueprint,
        },
    });
    assert.deepEqual(unidentified.fittedModuleAt('FrameShiftDrive')!.raw, unidentifiedBefore);

    const finalVariant = getPreEngineeredVariants('Hpt_Guardian_GaussCannon_Fixed_Medium')[0]!;
    const final = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'MediumHardpoint1',
        finalVariant,
    );
    const finalResult = final.setExperimentalEffect('MediumHardpoint1', 'special_weapon_damage');
    assert.equal(finalResult.kind, 'unsupported');
    assert.equal(finalResult.code, 'finalArticle');

    for (const invalid of [42, undefined]) {
        assert.throws(
            () => engineered.setExperimentalEffect('FrameShiftDrive', invalid as never),
            /experimental must be a string/,
        );
    }
});

test('completeEngineeringGrade recomputes imported ordinary and Mercenary rolls at quality one', () => {
    const partial = ShipLoadout.default('SideWinder').applyBlueprint(
        'FrameShiftDrive',
        'FSD_LongRange',
        { grade: 5, quality: 0.42, experimental: 'special_fsd_heavy' },
    );
    const imported = ShipLoadout.fromLoadout(partial.toLoadoutEvent());
    const expected = ShipLoadout.default('SideWinder').applyBlueprint(
        'FrameShiftDrive',
        'FSD_LongRange',
        { grade: 5, quality: 1, experimental: 'special_fsd_heavy' },
    );

    const result = imported.completeEngineeringGrade('FrameShiftDrive');
    assert.deepEqual(result, { kind: 'normalized', previousQuality: 0.42, quality: 1 });
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(
        imported.fittedModuleAt('FrameShiftDrive')!.effectiveStats,
        expected.fittedModuleAt('FrameShiftDrive')!.effectiveStats,
    );

    const variant = getPreEngineeredVariants('Int_PowerDistributor_Size6_Class5').find(
        (candidate) => candidate.acquisition === 'mercenary',
    )!;
    const mercenary = ShipLoadout.empty('Anaconda')
        .setPreEngineeredVariant('PowerDistributor', variant)
        .applyBlueprint('PowerDistributor', variant.blueprint, { grade: 2, quality: 0.5 });
    assert.equal(mercenary.completeEngineeringGrade('PowerDistributor').kind, 'normalized');
    assert.equal(mercenary.fittedModuleAt('PowerDistributor')!.engineering!.Quality, 1);
    assert.equal(mercenary.fittedModuleAt('PowerDistributor')!.preEngineeredVariant, variant);

    const converted = ShipLoadout.empty('Anaconda')
        .setModule('MediumHardpoint1', mod('Hpt_BasicMissileRack_Fixed_Medium', HARDPOINT_MODULES))
        .applyBlueprint('MediumHardpoint1', 'Weapon_HighCapacity', {
            grade: 5,
            quality: 0.42,
            experimental: 'special_overload_munitions',
        });
    const importedConverted = ShipLoadout.fromLoadout(converted.toLoadoutEvent());
    assert.equal(importedConverted.completeEngineeringGrade('MediumHardpoint1').kind, 'normalized');
    assert.equal(importedConverted.fittedModuleAt('MediumHardpoint1')!.engineering!.Quality, 1);
});

test('completeEngineeringGrade preserves an imported fixed reward', () => {
    const variant = getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5').find(
        (candidate) => candidate.acquisition === 'techBroker',
    )!;
    const loadout = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'FrameShiftDrive',
        variant,
    );
    loadout.setExperimentalEffect('FrameShiftDrive', 'special_fsd_heavy');
    const captured = loadout.toLoadoutEvent();
    const drive = captured.Modules.find((module) => module.Slot === 'FrameShiftDrive')!;
    const imported = ShipLoadout.fromLoadout({
        ...captured,
        Modules: captured.Modules.map((module) =>
            module === drive
                ? {
                      ...module,
                      Engineering: { ...module.Engineering!, Quality: 0.42 },
                  }
                : module,
        ),
    });
    const fixedOptimalMass = loadout.fittedModuleAt('FrameShiftDrive')!.effectiveStats!.optMass;

    assert.deepEqual(imported.completeEngineeringGrade('FrameShiftDrive'), {
        kind: 'normalized',
        previousQuality: 0.42,
        quality: 1,
    });
    const normalized = imported.fittedModuleAt('FrameShiftDrive')!;
    assert.equal(normalized.engineering!.ExperimentalEffect, 'special_fsd_heavy');
    assert.equal(normalized.effectiveStats!.optMass, fixedOptimalMass);
    assert.equal(normalized.preEngineeredVariant, variant);

    const shieldVariant = getPreEngineeredVariants('Int_ShieldGenerator_Size3_Class5').find(
        (candidate) => candidate.acquisition === 'communityGoal',
    )!;
    const shield = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'Slot08_Size4',
        shieldVariant,
    );
    shield.setExperimentalEffect('Slot08_Size4', 'special_shield_efficient');
    const shieldEvent = shield.toLoadoutEvent();
    const partialShield = ShipLoadout.fromLoadout({
        ...shieldEvent,
        Modules: shieldEvent.Modules.map((module) =>
            module.Slot === 'Slot08_Size4'
                ? { ...module, Engineering: { ...module.Engineering!, Quality: 0.42 } }
                : module,
        ),
    });
    assert.equal(partialShield.completeEngineeringGrade('Slot08_Size4').kind, 'normalized');
    const completedMultiplier =
        partialShield.fittedModuleAt('Slot08_Size4')!.effectiveStats!.minMultiplier!;
    assert.ok(near(completedMultiplier, 0.686000035));
    assert.ok(
        near(
            ShipLoadout.fromLoadout(partialShield.toLoadoutEvent()).fittedModuleAt('Slot08_Size4')!
                .effectiveStats!.minMultiplier!,
            completedMultiplier,
        ),
    );
});

test('completeEngineeringGrade returns lossless refusals and leaves the module unchanged', () => {
    const empty = ShipLoadout.empty('Anaconda');
    assert.deepEqual(empty.completeEngineeringGrade('FrameShiftDrive'), {
        kind: 'unsupported',
        code: 'emptySlot',
        params: { slot: 'FrameShiftDrive' },
    });
    assert.deepEqual(ShipLoadout.default('Anaconda').completeEngineeringGrade('FrameShiftDrive'), {
        kind: 'unsupported',
        code: 'notEngineered',
        params: {
            slot: 'FrameShiftDrive',
            symbol: 'Int_Hyperdrive_Size6_Class1',
        },
    });

    const unsupported = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            {
                Slot: 'FrameShiftDrive',
                Item: 'Int_Hyperdrive_Size6_Class5',
                Engineering: { BlueprintName: 'FutureBlueprint', Level: 5, Quality: 0.5 },
            },
        ],
    });
    const unsupportedResult = unsupported.completeEngineeringGrade('FrameShiftDrive');
    assert.equal(unsupportedResult.kind, 'unsupported');
    assert.equal(unsupportedResult.code, 'unsupportedEngineering');

    const partial = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            {
                Slot: 'FrameShiftDrive',
                Item: 'Int_Hyperdrive_Size6_Class5',
                Engineering: { Quality: 0.5 },
            },
        ],
    } as unknown as LoadoutEvent);
    assert.deepEqual(partial.completeEngineeringGrade('FrameShiftDrive'), {
        kind: 'unsupported',
        code: 'unsupportedEngineering',
        params: { slot: 'FrameShiftDrive', symbol: 'Int_Hyperdrive_Size6_Class5' },
    });

    for (const grade of [0, 7, 2.5, Number.NaN]) {
        const invalidGrade = ShipLoadout.fromLoadout({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'FrameShiftDrive',
                    Item: 'Int_Hyperdrive_Size6_Class5',
                    Engineering: {
                        BlueprintName: 'FSD_LongRange',
                        Level: grade,
                        Quality: 0.5,
                    },
                },
            ],
        });
        const result = invalidGrade.completeEngineeringGrade('FrameShiftDrive');
        assert.equal(result.kind, 'unsupported');
        assert.equal(result.code, 'unsupportedEngineering');
    }

    const fixedVariant = getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5').find(
        (candidate) => candidate.acquisition === 'techBroker',
    )!;
    const unidentified = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            {
                Slot: 'FrameShiftDrive',
                Item: fixedVariant.symbol,
                Engineering: {
                    BlueprintName: fixedVariant.blueprint,
                    Level: fixedVariant.grade,
                    Quality: 0.5,
                    Modifiers: getPreEngineeredJournalModifiers(fixedVariant).slice(0, 1),
                },
            },
        ],
    });
    const unidentifiedResult = unidentified.completeEngineeringGrade('FrameShiftDrive');
    assert.equal(unidentifiedResult.kind, 'unsupported');
    assert.equal(unidentifiedResult.code, 'unidentifiedPreEngineeredVariant');

    const miningLance = getPreEngineeredVariants('Hpt_MiningLaser_Fixed_Small').find(
        (candidate) => candidate.experimental === 'special_incendiary_rounds',
    )!;
    const lanceEvent = ShipLoadout.empty('Anaconda')
        .setPreEngineeredVariant('SmallHardpoint1', miningLance)
        .toLoadoutEvent();
    const partialLance = ShipLoadout.fromLoadout({
        ...lanceEvent,
        Modules: lanceEvent.Modules.map((module) =>
            module.Slot === 'SmallHardpoint1'
                ? { ...module, Engineering: { ...module.Engineering!, Quality: 0.5 } }
                : module,
        ),
    });
    assert.equal(partialLance.completeEngineeringGrade('SmallHardpoint1').kind, 'normalized');
    assert.equal(
        partialLance.fittedModuleAt('SmallHardpoint1')!.engineering!.ExperimentalEffect,
        miningLance.experimental,
    );
    assert.equal(partialLance.fittedModuleAt('SmallHardpoint1')!.preEngineeredVariant, miningLance);

    const fixed = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'FrameShiftDrive',
        fixedVariant,
    );
    const fixedEvent = fixed.toLoadoutEvent();
    const incompatible = ShipLoadout.fromLoadout({
        ...fixedEvent,
        Modules: fixedEvent.Modules.map((module) =>
            module.Slot === 'FrameShiftDrive'
                ? {
                      ...module,
                      Engineering: {
                          ...module.Engineering!,
                          Quality: 0.5,
                          ExperimentalEffect: 'special_weapon_damage',
                      },
                  }
                : module,
        ),
    });
    assert.deepEqual(incompatible.completeEngineeringGrade('FrameShiftDrive'), {
        kind: 'unsupported',
        code: 'unsupportedExperimentalEffect',
        params: {
            slot: 'FrameShiftDrive',
            symbol: fixedEvent.Modules.find((module) => module.Slot === 'FrameShiftDrive')!.Item,
            experimental: 'special_weapon_damage',
        },
    });

    const finalVariant = getPreEngineeredVariants('Hpt_Guardian_GaussCannon_Fixed_Medium')[0]!;
    const final = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'MediumHardpoint1',
        finalVariant,
    );
    const finalEvent = final.toLoadoutEvent();
    const partialFinal = ShipLoadout.fromLoadout({
        ...finalEvent,
        Modules: finalEvent.Modules.map((module) =>
            module.Slot === 'MediumHardpoint1'
                ? { ...module, Engineering: { ...module.Engineering!, Quality: 0.5 } }
                : module,
        ),
    });
    assert.deepEqual(partialFinal.completeEngineeringGrade('MediumHardpoint1'), {
        kind: 'unsupported',
        code: 'finalArticle',
        params: {
            slot: 'MediumHardpoint1',
            symbol: finalEvent.Modules.find((module) => module.Slot === 'MediumHardpoint1')!.Item,
        },
    });

    const oddlyEngineeredFinal = ShipLoadout.fromLoadout({
        ...finalEvent,
        Modules: finalEvent.Modules.map((module) =>
            module.Slot === 'MediumHardpoint1'
                ? {
                      ...module,
                      Engineering: {
                          ...module.Engineering!,
                          Quality: 0.5,
                          ExperimentalEffect: 'future_effect',
                      },
                  }
                : module,
        ),
    });
    const oddlyEngineeredResult = oddlyEngineeredFinal.completeEngineeringGrade('MediumHardpoint1');
    assert.equal(oddlyEngineeredResult.kind, 'unsupported');
    assert.equal(oddlyEngineeredResult.code, 'finalArticle');
});
test('a burst-pattern variant identifies before and after export', () => {
    const variant = getPreEngineeredVariants('Hpt_Slugshot_Gimbal_Large').find(
        (candidate) => candidate.acquisition === 'communityGoal',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('LargeHardpoint1', variant);

    assert.equal(build.fittedModuleAt('LargeHardpoint1')!.preEngineeredVariant, variant);
    assert.equal(
        ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt('LargeHardpoint1')!
            .preEngineeredVariant,
        variant,
    );
});

test('a Mercenary variant omits its unpublished modifier block', () => {
    const variant = getPreEngineeredVariants('Int_PowerDistributor_Size6_Class5').find(
        (candidate) => candidate.acquisition === 'mercenary',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'PowerDistributor',
        variant,
    );
    const fitted = build.fittedModuleAt('PowerDistributor')!;

    assert.deepEqual(fitted.engineering, {
        BlueprintName: variant.blueprint,
        Level: variant.grade,
        Quality: 1,
    });
    assert.ok(!Object.hasOwn(fitted.engineering!, 'Modifiers'));
    assert.equal(fitted.preEngineeredVariant, variant);

    build.clearEngineering('PowerDistributor');
    assert.equal(build.fittedModuleAt('PowerDistributor')!.preEngineeredVariant, null);
});

test('setPreEngineeredVariant validates the variant and preserves its module identity', () => {
    const variant = getPreEngineeredVariants(preEngineeredFixture.festive.symbol)[0]!;
    const build = ShipLoadout.empty('Anaconda');
    assert.throws(
        () => build.setPreEngineeredVariant('MediumHardpoint1', null as never),
        /variant must be a pre-engineered variant/,
    );
    assert.throws(
        () =>
            build.setPreEngineeredVariant('MediumHardpoint1', {
                ...variant,
                symbol: 'unknown_module',
            }),
        RangeError,
    );
    assert.throws(
        () =>
            build.setPreEngineeredVariant('MediumHardpoint1', {
                ...variant,
                symbol: 'Hpt_PulseLaser_Fixed_Small',
            }),
        /no catalogued variant/,
    );
    assert.throws(
        () => build.setPreEngineeredVariant('SmallHardpoint1', variant),
        /module size 2 exceeds slot size 1/,
    );
    assert.deepEqual(
        getPreEngineeredVariants('Hpt_PulseLaser_Fixed_Small').filter(
            (candidate) => candidate.acquisition === 'eventReward',
        ),
        [],
    );
});

test('journal weapon derivation retains stored-float and firing-cycle precision', () => {
    const multiCannon = ShipLoadout.empty('Viper')
        .setModule('MediumHardpoint1', mod('Hpt_MultiCannon_Gimbal_Medium', HARDPOINT_MODULES))
        .applyBlueprint('MediumHardpoint1', 'Weapon_HighCapacity', { grade: 5 });
    assert.equal(
        modFor(
            multiCannon.fittedModuleAt('MediumHardpoint1')!.engineering!.Modifiers!,
            'DamagePerSecond',
        ),
        14.017096,
    );

    const fragment = ShipLoadout.empty('Viper')
        .setModule('MediumHardpoint1', mod('Hpt_Slugshot_Fixed_Medium', HARDPOINT_MODULES))
        .applyBlueprint('MediumHardpoint1', 'Weapon_DoubleShot', { grade: 1 });
    const damagePerSecond = fragment
        .fittedModuleAt('MediumHardpoint1')!
        .engineering!.Modifiers!.find((modifier) => modifier.Label === 'DamagePerSecond');
    assert.equal(damagePerSecond?.OriginalValue, 179.099991);
});

test('journal DPS uses an engineered rounds-per-shot value', () => {
    const build = ShipLoadout.empty('Vulture').setModule(
        'LargeHardpoint1',
        mod('Hpt_MultiCannon_Fixed_Medium', HARDPOINT_MODULES),
    );
    build.applyBlueprint('LargeHardpoint1', 'MultiCannon_Rapid', { grade: 5 });

    const fitted = build.fittedModuleAt('LargeHardpoint1')!;
    const modifiers = fitted.engineering!.Modifiers!;
    const damage = modFor(modifiers, 'Damage')!;
    const damagePerSecond = modFor(modifiers, 'DamagePerSecond')!;
    const rounds = modFor(modifiers, 'Rounds')!;
    const rate = modFor(modifiers, 'RateOfFire')!;

    assert.equal(rounds, 3);
    assert.ok(near(fitted.effectiveStats!.damage!, damage, 1e-6));
    assert.equal(fitted.effectiveStats!.roundsPerShot, rounds);
    assert.ok(near(build.weaponMetrics().total.damagePerSecond, damagePerSecond, 1e-6));
    assert.ok(damagePerSecond > damage * rate);
});

test('blueprint and experimental aliases compound before journal presentation', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('Slot05_Size5', mod('Int_ShieldGenerator_Size5_Class5', INTERNAL_MODULES))
        .applyBlueprint('Slot05_Size5', 'ShieldGenerator_Reinforced', {
            grade: 5,
            experimental: 'special_shield_health',
        });

    const fitted = build.fittedModuleAt('Slot05_Size5')!;
    const energy = fitted.engineering!.Modifiers!.filter(
        (modifier) => modifier.Label === 'EnergyPerRegen',
    );
    assert.deepEqual(energy, [{ Label: 'EnergyPerRegen', Value: 0.84, OriginalValue: 0.6 }]);
    assert.equal(fitted.effectiveStats!.distributorDraw, 0.84);
    assert.equal(
        fitted.engineering!.Modifiers!.find((modifier) => modifier.Label === 'ShieldGenStrength')
            ?.OriginalValue,
        120.000008,
    );
    assert.deepEqual(
        fitted.engineering!.Modifiers!.map((modifier) => modifier.Label),
        [
            'PowerDraw',
            'ShieldGenStrength',
            'BrokenRegenRate',
            'EnergyPerRegen',
            'KineticResistance',
            'ThermicResistance',
            'ExplosiveResistance',
        ],
    );
});

test('shield cell modifiers follow journal order', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('Slot01_Size7', mod('Int_ShieldCellBank_Size7_Class5', INTERNAL_MODULES))
        .applyBlueprint('Slot01_Size7', 'ShieldCellBank_Rapid', { grade: 4 });
    assert.deepEqual(
        build
            .fittedModuleAt('Slot01_Size7')!
            .engineering!.Modifiers!.map((modifier) => modifier.Label),
        ['BootTime', 'ShieldBankSpinUp', 'ShieldBankDuration', 'ShieldBankReinforcement'],
    );
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
    assert.equal(build.fittedModuleAt('LargeHardpoint1')!.effectiveStats!.rateOfFire, 12.9);
    assert.equal(build.weaponMetrics().weapons[0]!.metrics.rateOfFire, 12.9);
});

test('a fitted module answers to the same word a catalogue record does', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const fitted = build.fittedModuleAt('FrameShiftDrive')!;
    // `symbol` is what every catalogue lookup takes, so a snapshot and a record agree.
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
    assert.equal(build.fittedModules().length, 28);
    assert.equal(build.slots().filter((s) => s.module !== null).length, 28);

    // ...reached by the journal's own spelling, which is not the one it wrote.
    assert.equal(
        build.fittedModuleAt('LargeMiningHardpoint1')?.symbol,
        'hpt_miningtoolv2_fixed_large',
    );
    assert.equal(
        build.fittedModuleAt('FrameShiftDrive')?.symbol,
        'int_hyperdrive_overcharge_size5_class5',
    );
    assert.equal(build.slots('hardpoint')[0]?.module?.symbol, 'hpt_miningtoolv2_fixed_large');
    assert.ok(build.slots('core').find((s) => s.core === 'powerPlant')?.module);

    // A snapshot reports the build's own spelling rather than the one it was asked with.
    assert.equal(build.fittedModuleAt('LargeMiningHardpoint1')?.slot, 'largemininghardpoint1');
    assert.equal(build.fittedModuleAt('LargeMiningHardpoint1')?.raw.Slot, 'largemininghardpoint1');

    // A key the hull genuinely has no mount for is still a miss, not a near-match.
    assert.equal(build.fittedModuleAt('HugeHardpoint1'), null);
    assert.equal(build.fittedModuleAt('Military01'), null);
});

test('editing a lower-cased slot replaces its module rather than adding one', () => {
    // The defect this pins: an unbound slot made `setModule` an *insert*, so the build
    // grew a second large mining hardpoint and its mass, draw and credits with it.
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    const before = { modules: build.fittedModules().length, mass: build.unladenMass! };

    build.setModule('LargeMiningHardpoint1', mod('Hpt_MiningLaser_Fixed_Medium', ALL_MODULES));
    assert.equal(build.fittedModules().length, before.modules);
    assert.equal(
        build.fittedModuleAt('largemininghardpoint1')?.symbol,
        'Hpt_MiningLaser_Fixed_Medium',
    );
    assert.equal(build.weaponMetrics().weapons.length, 5);
    // Replacing a 4 t mining tool with a 2 t laser takes 2 t off, rather than adding 2 t.
    assert.ok(build.unladenMass! < before.mass, `${build.unladenMass} !< ${before.mass}`);

    // The slot keeps the spelling the build already had, so the export stays uniform.
    assert.ok(
        build.toLoadoutEvent().Modules.every((m) => m.Slot === m.Slot.toLowerCase()),
        'editing renamed one of the import’s mounts',
    );

    build.removeModule('LARGEMININGHARDPOINT1');
    assert.equal(build.fittedModules().length, before.modules - 1);
    assert.equal(build.fittedModuleAt('largemininghardpoint1'), null);
});

test('every editor and reader on the facade takes a lower-cased key', () => {
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));

    build.setModuleEnabled('FrameShiftDrive', false);
    assert.equal(build.fittedModuleAt('frameshiftdrive')?.on, false);
    build.setModulePriority('FrameShiftDrive', 2);
    assert.equal(build.fittedModuleAt('frameshiftdrive')?.priority, 2);

    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
    assert.ok(build.fittedModuleAt('frameshiftdrive')?.engineering);
    build.clearEngineering('FrameShiftDrive');
    assert.equal(build.fittedModuleAt('frameshiftdrive')?.engineering, undefined);

    // ...and so does a slot the build has not filled, whose key comes from the layout.
    assert.ok(build.modulesForSlot('tinyhardpoint2').length > 0);
    assert.equal(build.fittedModuleAt('TinyHardpoint2'), null);
    build.setModule('tinyhardpoint2', mod('Hpt_ShieldBooster_Size0_Class5', UTILITY_MODULES));
    // A fresh fit takes the layout's canonical key, having no existing one to keep.
    assert.equal(build.fittedModuleAt('TinyHardpoint2')?.slot, 'TinyHardpoint2');

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
        return ShipLoadout.fromLoadout({ ...data, Modules: modules }).armourMetrics()!.hitPoints;
    };
    assert.equal(upgrade('Armour'), 1225);
    assert.equal(upgrade('armour'), upgrade('Armour'));
    // ...and the untouched fixture's stock-grade bulkhead is the 630 it should be.
    assert.equal(
        ShipLoadout.fromSlef(JSON.stringify(inaraFixture)).armourMetrics()!.hitPoints,
        630,
    );
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
    assert.equal(ordered.length, 28);
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
    assert.equal(build.fittedModuleAt('frameShiftDrive')?.symbol, 'Int_Hyperdrive_Size6_Class5');
    for (const core of ['powerPlant', 'lifeSupport', 'powerDistributor', 'fuelTank'] as const) {
        assert.doesNotThrow(() => build.modulesForSlot(core), core);
    }
    for (const core of ['thrusters', 'sensors'] as const) {
        assert.equal(build.fittedModuleAt(core), null, core);
        assert.throws(() => build.modulesForSlot(core), RangeError, core);
        assert.throws(
            () => build.setModule(core, mod('Int_Engine_Size6_Class5')),
            RangeError,
            core,
        );
    }
});

// ── Derived views
test('slot snapshots are cached until an edit and fitted-module snapshots are detached', () => {
    const build = ShipLoadout.default('Anaconda');
    const first = build.slots();
    const drive = build.fittedModuleAt('FrameShiftDrive')!;
    assert.throws(() => (first as LoadoutSlot[]).pop(), TypeError);
    assert.throws(() => Object.assign(first[0]!, { name: 'changed' }), TypeError);
    assert.equal(build.slots(), first);

    build.setModuleEnabled('FrameShiftDrive', !drive.on);
    const second = build.slots();
    const changedDrive = build.fittedModuleAt('FrameShiftDrive')!;
    assert.notEqual(second, first);
    assert.notEqual(second[0], first[0]);
    assert.notEqual(changedDrive, drive);
    assert.equal(changedDrive.on, !drive.on);
    assert.equal(drive.on, first.find((slot) => slot.key === 'FrameShiftDrive')?.module?.on);
});

test('validation issues are frozen', () => {
    const build = ShipLoadout.empty('Anaconda');
    const issue = build.validation.issues[0]!;
    assert.throws(() => Object.assign(issue, { message: 'rewritten' }), TypeError);
});

test('every slot-key method names a wrong-typed key rather than failing inside the build', () => {
    const build = ShipLoadout.empty('Anaconda');
    const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!;
    build.setModule('FrameShiftDrive', fsd);
    // `#requireSlot` and `#fittedKey` cover these between them, and
    // `removeModule` guards itself ahead of both. This list is the check that no method
    // reaches the build around all three — a new one has to appear here too.
    const calls: readonly ((key: string) => unknown)[] = [
        (key) => build.setModule(key, fsd),
        (key) => build.removeModule(key),
        (key) => build.setModuleEnabled(key, true),
        (key) => build.setModulePriority(key, 1),
        (key) => build.applyBlueprint(key, 'FSD_LongRange', { grade: 5 }),
        (key) => build.setExperimentalEffect(key, null),
        (key) => build.completeEngineeringGrade(key),
        (key) =>
            build.setPreEngineeredVariant(
                key,
                getPreEngineeredVariants(preEngineeredFixture.festive.symbol)[0]!,
            ),
        (key) => build.clearEngineering(key),
        (key) => build.fittedModuleAt(key),
        (key) => build.modulesForSlot(key),
        (key) => build.availableBlueprints(key),
        (key) => build.availableExperimentalEffects(key),
    ];
    for (const call of calls) {
        assert.throws(() => call(42 as unknown as string), {
            name: 'TypeError',
            message: 'ShipLoadout: slotKey must be a string, received number 42',
        });
    }
    // A string that is not a slot still reports the miss, not a type error.
    assert.throws(() => build.modulesForSlot('NoSuchSlot'), RangeError);
});

test('applyBlueprint names a wrong-typed recipe id before it asks about the slot', () => {
    const build = ShipLoadout.empty('Anaconda');
    const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!;
    build.setModule('FrameShiftDrive', fsd);
    assert.throws(
        () => build.applyBlueprint('FrameShiftDrive', 42 as unknown as string, { grade: 5 }),
        {
            name: 'TypeError',
            message: 'ShipLoadout.applyBlueprint: fdname must be a string, received number 42',
        },
    );
    assert.throws(
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
                grade: 5,
                experimental: 42 as unknown as string,
            }),
        {
            name: 'TypeError',
            message:
                'ShipLoadout.applyBlueprint: options.experimental must be a string, received number 42',
        },
    );
    assert.throws(
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', 5 as unknown as { grade: 5 }),
        {
            name: 'TypeError',
            message:
                'ShipLoadout.applyBlueprint: options must be an object with a grade, received number 5',
        },
    );
    // An empty slot is a state question, so the recipe id is named ahead of it.
    assert.throws(
        () => build.applyBlueprint('Slot01_Size7', 42 as unknown as string, { grade: 5 }),
        {
            message: /fdname must be a string/,
        },
    );
    // `options` belongs to the caller, so a property can answer differently on each
    // read. Each is taken once, before anything is checked, so a checked value cannot be
    // swapped for an unchecked one — into a message naming the catalogue lookup that
    // reached it, or into the build as a grade no check ever saw.
    const varying = <T>(...values: readonly T[]) => {
        let reads = 0;
        return () => values[Math.min(reads++, values.length - 1)]!;
    };
    const swapExperimental = varying<unknown>('special_fsd_heavy', 42);
    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
        grade: 5,
        get experimental() {
            return swapExperimental() as string;
        },
    });
    // The checked read is the one applied; the `42` returned by a second read never
    // reaches the catalogue lookup.
    assert.equal(
        build.fittedModuleAt('FrameShiftDrive')?.engineering?.ExperimentalEffect,
        'special_fsd_heavy',
    );
    const swapGrade = varying(5, 5, 5, 5, 99);
    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
        get grade() {
            return swapGrade();
        },
    });
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.engineering?.Level, 5);

    // Nullish consistently means that no experimental effect is present.
    assert.ok(
        build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
            grade: 5,
            experimental: null as unknown as string,
        }),
    );
    assert.equal(
        build.fittedModuleAt('FrameShiftDrive')?.engineering?.ExperimentalEffect,
        undefined,
    );
    // An absent experimental effect is not one of these — it is simply no effect.
    assert.ok(build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 }));
});

test('fromLoadout names the structure it needs instead of failing inside the walk', () => {
    for (const bad of [42, 'a Loadout event', null, undefined]) {
        assert.throws(() => ShipLoadout.fromLoadout(bad as unknown as LoadoutEvent), {
            name: 'TypeError',
            message: /^ShipLoadout\.fromLoadout: event must be a Loadout event, received /,
        });
    }
    assert.throws(
        () => ShipLoadout.fromLoadout({ Ship: 42, Modules: [] } as unknown as LoadoutEvent),
        {
            name: 'TypeError',
            message: 'ShipLoadout.fromLoadout: event.Ship must be a string, received number 42',
        },
    );
    assert.throws(() => ShipLoadout.fromLoadout({ Ship: 'Anaconda' } as unknown as LoadoutEvent), {
        name: 'TypeError',
        message: 'ShipLoadout.fromLoadout: event.Modules must be an array, received undefined',
    });
    // Past the two top-level fields, the walk names the ones every module must carry.
    for (const [modules, expected] of [
        [
            [42],
            'ShipLoadout.fromLoadout: event.Modules[] must hold module objects, received number 42',
        ],
        [
            [{ Slot: 42, Item: 'x' }],
            'ShipLoadout.fromLoadout: module.Slot must be a string, received number 42',
        ],
        [
            [{ Slot: 'FrameShiftDrive', Item: 42 }],
            'ShipLoadout.fromLoadout: module.Item must be a string, received number 42',
        ],
        [
            [
                {
                    Slot: 'FrameShiftDrive',
                    Item: 'Int_Hyperdrive_Size6_Class5',
                    Engineering: { BlueprintName: 42 },
                },
            ],
            'ShipLoadout.fromLoadout: module.Engineering.BlueprintName must be a string, received number 42',
        ],
        [
            [
                {
                    Slot: 'FrameShiftDrive',
                    Item: 'Int_Hyperdrive_Size6_Class5',
                    Engineering: { BlueprintName: 'FSD_LongRange', ExperimentalEffect: 42 },
                },
            ],
            'ShipLoadout.fromLoadout: module.Engineering.ExperimentalEffect must be a string, received number 42',
        ],
    ] as const) {
        assert.throws(
            () =>
                ShipLoadout.fromLoadout({
                    Ship: 'Anaconda',
                    Modules: modules,
                } as unknown as LoadoutEvent),
            { name: 'TypeError', message: expected },
        );
    }
    // A journal event is usually `JSON.parse` output, but nothing says it has to be.
    // Every field is read once, before any of it is checked, so an accessor cannot pass
    // the check on one read and poison the build on the next — at any depth.
    const vary = <T>(...values: readonly T[]) => {
        let reads = 0;
        return () => values[Math.min(reads++, values.length - 1)]!;
    };
    const fsd = () => ({ Slot: 'FrameShiftDrive', Item: 'Int_Hyperdrive_Size6_Class5' });
    const swapped: readonly (readonly [string, () => unknown])[] = [
        [
            'event.Modules',
            () => ({
                Ship: 'Anaconda',
                get Modules() {
                    return swapModules();
                },
            }),
        ],
        [
            'event.Ship',
            () => ({
                get Ship() {
                    return swapShip();
                },
                Modules: [fsd()],
            }),
        ],
        [
            'module.Slot',
            () => ({
                Ship: 'Anaconda',
                Modules: [
                    {
                        get Slot() {
                            return swapSlot();
                        },
                        Item: fsd().Item,
                    },
                ],
            }),
        ],
        [
            'module.Engineering.Modifiers[].Label',
            () => ({
                Ship: 'Anaconda',
                Modules: [
                    {
                        ...fsd(),
                        Engineering: {
                            BlueprintName: 'FSD_LongRange',
                            Modifiers: [
                                {
                                    get Label() {
                                        return swapLabel();
                                    },
                                    Value: 1,
                                },
                            ],
                        },
                    },
                ],
            }),
        ],
    ];
    const swapModules = vary<unknown>([fsd()], 42);
    const swapShip = vary<unknown>('Anaconda', 42);
    const swapSlot = vary<unknown>('FrameShiftDrive', 42);
    const swapLabel = vary<unknown>('FSDOptimalMass', 42);
    for (const [field, make] of swapped) {
        const swappedBuild = ShipLoadout.fromLoadout(make() as LoadoutEvent);
        // The build survives being read, which is what the single reading buys: a second
        // reading's `42` would surface as an internal message from whichever reader
        // reached it, a step away from the call that accepted it.
        assert.ok(swappedBuild.fittedModuleAt('FrameShiftDrive'), field);
        assert.ok(swappedBuild.validation, field);
        assert.ok(swappedBuild.toLoadoutEvent(), field);
    }

    // `Array.isArray` proves the exotic object, not the methods on it. The capture
    // copies by index, so a shadowed `map`, `entries` or iterator cannot put
    // `modules.map is not a function` in front of a caller either.
    const shadowedModules: unknown[] = [fsd()];
    const shadowedModifiers: unknown[] = [{ Label: 'FSDOptimalMass', Value: 1 }];
    for (const array of [shadowedModules, shadowedModifiers]) {
        const shadowed = array as unknown as Record<PropertyKey, unknown>;
        shadowed['map'] = 42;
        shadowed['entries'] = 42;
        shadowed[Symbol.iterator] = 42;
    }
    for (const event of [
        { Ship: 'Anaconda', Modules: shadowedModules },
        {
            Ship: 'Anaconda',
            Modules: [
                {
                    ...fsd(),
                    Engineering: { BlueprintName: 'FSD_LongRange', Modifiers: shadowedModifiers },
                },
            ],
        },
    ]) {
        const shadowedBuild = ShipLoadout.fromLoadout(event as unknown as LoadoutEvent);
        assert.ok(shadowedBuild.fittedModuleAt('FrameShiftDrive'));
        assert.ok(shadowedBuild.toLoadoutEvent());
    }

    // A relay that writes `null` for an absent block is named, not dereferenced: the
    // clone downstream tests only for `undefined`.
    for (const engineering of [null, 42]) {
        assert.throws(
            () =>
                ShipLoadout.fromLoadout({
                    Ship: 'Anaconda',
                    Modules: [
                        {
                            Slot: 'FrameShiftDrive',
                            Item: 'Int_Hyperdrive_Size6_Class5',
                            Engineering: engineering,
                        },
                    ],
                } as unknown as LoadoutEvent),
            {
                name: 'TypeError',
                message:
                    /^ShipLoadout\.fromLoadout: module\.Engineering must be an object, received /,
            },
        );
    }
    // Its `Modifiers` is the same hazard as the block: the clone maps whatever is there.
    for (const modifiers of [null, 42, 'FSDOptimalMass']) {
        assert.throws(
            () =>
                ShipLoadout.fromLoadout({
                    Ship: 'Anaconda',
                    Modules: [
                        {
                            Slot: 'FrameShiftDrive',
                            Item: 'Int_Hyperdrive_Size6_Class5',
                            Engineering: { BlueprintName: 'FSD_LongRange', Modifiers: modifiers },
                        },
                    ],
                } as unknown as LoadoutEvent),
            {
                name: 'TypeError',
                message:
                    /^ShipLoadout\.fromLoadout: module\.Engineering\.Modifiers must be an array, received /,
            },
        );
    }
    // A modifier is a labelled object, and the label is required rather than
    // checked-when-present: an entry without one imports fine and then breaks the build
    // it produced, because every reader of a modifier reads its label unconditionally.
    const withModifiers = (modifiers: unknown): LoadoutEvent =>
        ({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'FrameShiftDrive',
                    Item: 'Int_Hyperdrive_Size6_Class5',
                    Engineering: { BlueprintName: 'FSD_LongRange', Modifiers: modifiers },
                },
            ],
        }) as unknown as LoadoutEvent;
    for (const [modifiers, expected] of [
        [[42], 'module.Engineering.Modifiers[0] must be an object, received number 42'],
        [[null], 'module.Engineering.Modifiers[0] must be an object, received null'],
        [
            [{ Label: 42 }],
            'module.Engineering.Modifiers[0].Label must be a string, received number 42',
        ],
        [
            [{ Value: 1 }],
            'module.Engineering.Modifiers[0].Label must be a string, received undefined',
        ],
        [
            [{ Label: null }],
            'module.Engineering.Modifiers[0].Label must be a string, received null',
        ],
        [
            [{ Label: 'FSDOptimalMass', Value: 1 }, { Label: 42 }],
            'module.Engineering.Modifiers[1].Label must be a string, received number 42',
        ],
    ] as const) {
        assert.throws(() => ShipLoadout.fromLoadout(withModifiers(modifiers)), {
            name: 'TypeError',
            message: `ShipLoadout.fromLoadout: ${expected}`,
        });
    }
    // The value beside the label is a value, and values on this path are trusted — but
    // the build it produces has to survive being read, which is what the label buys.
    const loose = ShipLoadout.fromLoadout(
        withModifiers([{ Label: 'FSDOptimalMass', Value: 'lots' }]),
    );
    assert.ok(loose.fittedModuleAt('FrameShiftDrive'));
    // A partial engineering block is still read, not rejected: a capture may state
    // modifiers without naming the recipe.
    assert.ok(
        ShipLoadout.fromLoadout({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'FrameShiftDrive',
                    Item: 'Int_Hyperdrive_Size6_Class5',
                    Engineering: { Modifiers: [{ Label: 'FSDOptimalMass', Value: 1 }] },
                },
            ],
        } as unknown as LoadoutEvent),
    );
    assert.equal(ShipLoadout.fromLoadout({ Ship: 'Anaconda', Modules: [] }).shipSymbol, 'Anaconda');
});

// ── Build metrics: heat ─────────────────────────────────────────────────────

const HEAT_BUILDS: Record<string, LoadoutEvent> = {
    'journal-federation-corvette-beams.jsonc': corvetteBeamsJournal as LoadoutEvent,
    'journal-anaconda-slapaconda.jsonc': slapacondaJournal as LoadoutEvent,
};

const HEAT_SCENARIOS = [
    'idle',
    'thrusters',
    'fsdCharging',
    'firingSustained',
    'firingDrained',
] as const;

test('heatMetrics reproduces the pinned heat profile of each captured build', () => {
    for (const expected of heatFixture.builds) {
        const event = HEAT_BUILDS[expected.fixture];
        assert.ok(event, `no journal for ${expected.fixture}`);
        const build = ShipLoadout.fromLoadout(event);
        assert.equal(build.shipSymbol.toLowerCase(), expected.ship);
        const heat = build.heatMetrics();
        assert.ok(heat, expected.fixture);
        assert.equal(heat.heatEfficiency, expected.heatEfficiency);
        assert.equal(heat.hullHeatCapacity, expected.hullHeatCapacity);
        assert.equal(heat.hullHeatDissipation, expected.hullHeatDissipation);

        const power = build.powerBudget();
        assert.equal(displayed(power.retracted, 4), expected.retractedPowerDraw);
        assert.equal(displayed(power.deployed, 4), expected.deployedPowerDraw);

        for (const scenario of HEAT_SCENARIOS) {
            const want: {
                thermalLoad: number;
                overheats: boolean;
                gauge?: number;
                secondsToOverheat?: number;
            } = expected[scenario];
            const got: HeatState = heat[scenario];
            const where = `${expected.fixture} ${scenario}`;
            assert.ok(Math.abs(got.thermalLoad - want.thermalLoad) < 1e-9, where);
            assert.equal(got.overheats, want.overheats, where);
            if (want.gauge !== undefined) {
                assert.ok(Math.abs(got.gauge - want.gauge) < 1e-9, `${where} gauge`);
                assert.equal(got.secondsToOverheat, null, where);
            }
            if (want.secondsToOverheat !== undefined) {
                assert.equal(got.gauge, Infinity, `${where} gauge`);
                assert.ok(
                    Math.abs(got.secondsToOverheat! - want.secondsToOverheat) < 1e-9,
                    `${where} seconds`,
                );
            }
        }
    }
});

test('heat classifies caller-supplied core records from their fitted slots', () => {
    const custom = (
        base: string,
        symbol: string,
        values: Partial<OutfittingModule>,
    ): OutfittingModule => {
        const record = { ...mod(base), ...values, symbol };
        delete record.slot;
        return record;
    };
    const modules: LoadoutModule[] = [
        { Slot: 'PowerPlant', Item: 'CustomPlant' },
        { Slot: 'MainEngines', Item: 'CustomThrusters' },
        { Slot: 'FrameShiftDrive', Item: 'CustomDrive' },
    ];
    const stats = new Map<string, OutfittingModule>([
        [
            'CustomPlant',
            custom('Int_PowerPlant_Size2_Class5', 'CustomPlant', {
                powerCapacity: 10,
                heatEfficiency: 1,
            }),
        ],
        [
            'CustomThrusters',
            custom('Int_Engine_Size2_Class2', 'CustomThrusters', {
                powerDraw: 1,
                engineHeatRate: 2,
            }),
        ],
        [
            'CustomDrive',
            custom('Int_Hyperdrive_Size2_Class2', 'CustomDrive', {
                powerDraw: 1,
                fsdHeatRate: 3,
            }),
        ],
    ]);
    const ship = getShipBySymbol('SideWinder');
    assert.ok(ship);
    const input = heatInputFor(
        ship,
        modules,
        calculatePowerBudget(10, [
            { draw: 1, priority: 1 },
            { draw: 1, priority: 1 },
        ]),
        (module) => stats.get(module.Item) ?? null,
    );

    assert.equal(input?.thrusterHeatRate, 2);
    assert.equal(input?.deployedThrusterHeatRate, 2);
    assert.equal(input?.fsdHeatRate, 3);
});

test('the Lynx uses its pinned maximum dissipation in build heat metrics', () => {
    const build = ShipLoadout.fromLoadout(lynxJournal as LoadoutEvent);
    const expected = heatFixture.hulls.lynx;
    assert.equal(build.shipSymbol.toLowerCase(), expected.symbol.toLowerCase());
    assert.equal(getShipBySymbol(build.shipSymbol)?.heatDissipation, expected.heatDissipation);
    assert.equal(build.heatMetrics()?.hullHeatDissipation, expected.heatDissipation);
});

test('a build with no powered power plant has no heat profile', () => {
    assert.equal(ShipLoadout.empty('Anaconda').heatMetrics(), null, 'no plant fitted');
    const event = corvetteBeamsJournal as LoadoutEvent;
    const plantOff = ShipLoadout.fromLoadout({
        ...event,
        Modules: event.Modules.map((module) =>
            module.Slot === 'PowerPlant' ? { ...module, On: false } : module,
        ),
    });
    assert.equal(plantOff.heatMetrics(), null, 'plant switched off');
});

test('heat follows what the plant actually feeds, not what is fitted', () => {
    const event = corvetteBeamsJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const idle = build.heatMetrics()!.idle.thermalLoad;

    // Switching a drawing module off takes its heat with it.
    const boosterOff = ShipLoadout.fromLoadout({
        ...event,
        Modules: event.Modules.map((module) =>
            module.Slot === 'Slot01_Size7' ? { ...module, On: false } : module,
        ),
    });
    assert.ok(boosterOff.heatMetrics()!.idle.thermalLoad < idle);

    // And a group the plant cannot keep lit makes no heat either: dropping the plant to
    // its smallest rating unpowers the lower priorities rather than heating the hull.
    const weakPlant = build.setModule(
        'PowerPlant',
        getModuleBySymbol('Int_PowerPlant_Size2_Class1', CORE_MODULES)!,
    );
    const budget = weakPlant.powerBudget();
    assert.ok(!budget.withinBudget, 'the small plant must leave a group unpowered');
    const powered = budget.bands.reduce(
        (total, band) => (band.poweredRetracted ? total + band.retracted : total),
        0,
    );
    assert.ok(powered < budget.retracted, 'and some retracted draw must go unfed');
    assert.equal(
        weakPlant.heatMetrics()!.idle.thermalLoad,
        powered * weakPlant.heatMetrics()!.heatEfficiency,
    );
});

test('a build the plant cannot feed at all generates no heat anywhere', () => {
    // Every priority group unpowered: nothing is running, so nothing — thrusters, drive
    // or guns — has anything to make heat with, and the build cannot cook itself.
    const expected = heatFixture.unpowered;
    assert.equal(expected.fixture, 'journal-federation-corvette-beams.jsonc');
    const starved = ShipLoadout.fromLoadout(corvetteBeamsJournal as LoadoutEvent).setModule(
        'PowerPlant',
        getModuleBySymbol(expected.powerPlant, CORE_MODULES)!,
    );
    const bands = starved.powerBudget().bands;
    assert.ok(
        bands.every((band) => !band.poweredRetracted && !band.poweredDeployed),
        'the reproduction needs every band unpowered',
    );
    const heat = starved.heatMetrics();
    assert.ok(heat);
    for (const scenario of HEAT_SCENARIOS) {
        assert.equal(heat[scenario].thermalLoad, expected.thermalLoad, scenario);
        assert.equal(heat[scenario].overheats, expected.overheats, scenario);
        assert.equal(heat[scenario].heatLevel, expected.heatLevel, scenario);
    }
});
