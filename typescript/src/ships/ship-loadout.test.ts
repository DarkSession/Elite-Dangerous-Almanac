import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

import { BuildMetrics } from './build-metrics.js';
import { LoadoutEditError, ShipLoadout } from './ship-loadout.js';
import type { LoadoutSlot } from './loadout-slot.js';
import { heatInputResultFor } from './internal/loadout-metrics.js';
import { loadoutSlotName } from './internal/loadout-views.js';
import type { EngineeringModifier, LoadoutEvent, LoadoutModule } from './slef.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import { getDefaultLoadout } from './default-loadouts.js';
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
import caspianJournal from '../../../fixtures/ships/journal-caspian-explorer.jsonc' with { type: 'json' };
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
import edsyAnacondaCapture from '../../../fixtures/ships/slef-edsy-anaconda-funny-hull.jsonc' with { type: 'json' };
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
import { getPreEngineeredVariants, PRE_ENGINEERED_MODULES } from './pre-engineered.js';
import { getBlueprintCost } from './blueprint-costs.js';
import { getExperimentalEffectCost } from './experimental-effect-costs.js';
import { sumMaterials } from './engineering.js';
import { getPreEngineeredJournalModifiers, getPreEngineeredStats } from './pre-engineered-stats.js';

const mod = (symbol: string, catalogue = CORE_MODULES) => getModuleBySymbol(symbol, catalogue)!;

/**
 * Every capture in `fixtures/ships/`, split by who wrote it.
 *
 * Read from disk rather than imported so a capture added later joins the corpus without
 * a new `import` line, exactly as `builds.test.ts` reads the build corpus. A `journal-`
 * file is a bare `Loadout` event; a SLEF file is an array of entries, which is what
 * separates the captures from the expectation fixtures sharing the directory.
 */
const readCaptureFixtures = (): {
    journals: [string, LoadoutEvent][];
    exports: [string, LoadoutEvent][];
} => {
    const dir = fileURLToPath(new URL('../../../fixtures/ships/', import.meta.url));
    const journals: [string, LoadoutEvent][] = [];
    const exports: [string, LoadoutEvent][] = [];
    for (const file of readdirSync(dir).sort()) {
        if (!file.endsWith('.jsonc')) continue;
        const parsed: unknown = JSON.parse(
            stripJsonComments(readFileSync(join(dir, file), 'utf8')),
        );
        if (file.startsWith('journal-')) {
            journals.push([file, parsed as LoadoutEvent]);
        } else if (file.startsWith('slef-') && Array.isArray(parsed)) {
            for (const [index, entry] of (parsed as { data?: LoadoutEvent }[]).entries()) {
                if (entry?.data === undefined) continue;
                exports.push([`${file}[${index}]`, entry.data]);
            }
        }
    }
    return { journals, exports };
};

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
    assert.equal(imported.validation().valid, false);
    assert.ok(
        imported.validation().issues.some((issue) => issue.code === 'duplicateExclusiveModule'),
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
        build.validation().issues.some((issue) => issue.code === 'moduleLimitExceeded'),
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
        imported.validation().issues.find((issue) => issue.code === 'moduleLimitExceeded')?.params,
        { group: operationsFixture.moduleLimits.group, count: 5, limit: 4 },
    );
    assert.doesNotThrow(() => imported.removeModule('MediumHardpoint1'));
});

test('a build too heavy for its own thrusters is an error, and the error follows the fit', () => {
    const { input } = operationsFixture.thrusterMass;
    const build = ShipLoadout.default('SideWinder');
    const hangar = mod('Int_BuggyBay_Size2_Class1', INTERNAL_MODULES);
    // Dirty Drive Tuning buys thrust with rated mass: the 2E drops from 72 t to 63 t,
    // and two Planetary Vehicle Hangars then put the hull over what is left.
    build.applyBlueprint('MainEngines', 'Engine_Dirty', { grade: 5, quality: 1 });
    build.setModule('Slot01_Size2', hangar).setModule('Slot02_Size2', hangar);

    const maxMass = BuildMetrics.of(build).thrusters()?.maxMass;
    assert.ok(maxMass !== undefined && build.unladenMass > maxMass);
    const validation = build.validation();
    assert.equal(validation.valid, false);
    const issue = validation.issues.find((item) => item.code === 'thrusterMassExceeded');
    assert.equal(issue?.severity, 'error');
    assert.deepEqual(issue?.params, {
        slot: input.slot,
        symbol: input.symbol,
        // Too heavy before a drop of fuel is aboard, so the lightest load is the finding.
        load: 'dry',
        mass: build.unladenMass,
        maxMass,
    });
    // Past the rating the curve gives nothing back, which is what makes this an error
    // rather than a slow ship.
    assert.equal(BuildMetrics.of(build).mobilityMetricsResult().value?.speed, 0);

    // The rating is the engineered one, and the weighing is the current fit: unfit one
    // hangar and the same build is legal again.
    build.removeModule('Slot02_Size2');
    assert.ok(build.unladenMass + build.fuelCapacity.main < maxMass);
    assert.equal(build.validation().valid, true);
    assert.equal(
        ShipLoadout.default('SideWinder').validation().issues.length,
        0,
        'a stock hull is within its own thrusters',
    );
});

test('a ship that only cannot move once fuelled is an error, not a footnote', () => {
    // A tank's own mass is in the fit, but the fuel it holds is not, so a build can sit
    // under its rating dry and still be immobile on the pad — where the tank is always
    // full. This is a real capture with its main tank doubled.
    const build = ShipLoadout.fromLoadout(caspianJournal as LoadoutEvent);
    assert.equal(build.validation().valid, true, 'the capture as flown is within its rating');

    build.setModule('Slot01_Size7', mod('Int_FuelTank_Size7_Class3'));
    const maxMass = BuildMetrics.of(build).thrusters()?.maxMass;
    assert.ok(maxMass !== undefined);
    assert.ok(build.unladenMass < maxMass, 'the fit alone still fits the rating');
    assert.ok(build.unladenMass + build.fuelCapacity.main > maxMass);

    const issue = build.validation().issues.find((item) => item.code === 'thrusterMassExceeded');
    assert.equal(build.validation().valid, false);
    assert.equal(issue?.severity, 'error');
    assert.equal(issue?.params?.load, 'unladen');
    assert.equal(issue?.params?.mass, build.unladenMass + build.fuelCapacity.main);
    // `mobilityMetricsResult` weighs a full main tank by default, and agrees.
    assert.equal(BuildMetrics.of(build).mobilityMetricsResult().value?.speed, 0);
});

test('a ship that only cannot move with a full hold is a warning, and still a legal build', () => {
    // How much cargo to take is the one load a pilot chooses, so a hauler that outgrows
    // its thrusters only when the hold is full stays both valid and complete.
    const build = ShipLoadout.default('Type9');
    build.applyBlueprint('MainEngines', 'Engine_Dirty', { grade: 5, quality: 1 });
    for (const slot of build.slots('optional')) {
        const rack = build
            .modulesForSlot(slot.key)
            .filter((module) => module.symbol.startsWith('Int_CargoRack_'))
            .sort((left, right) => right.class - left.class)[0];
        if (rack) build.setModule(slot.key, rack);
    }

    const maxMass = BuildMetrics.of(build).thrusters()?.maxMass;
    assert.ok(maxMass !== undefined);
    assert.ok(build.unladenMass + build.fuelCapacity.main < maxMass);
    assert.ok(build.unladenMass + build.fuelCapacity.main + build.cargoCapacity > maxMass);

    const validation = build.validation();
    const issue = validation.issues.find((item) => item.code === 'thrusterMassExceeded');
    assert.equal(issue?.severity, 'warning');
    assert.equal(issue?.params?.load, 'laden');
    assert.equal(
        issue?.params?.mass,
        build.unladenMass + build.fuelCapacity.main + build.cargoCapacity,
    );
    assert.equal(validation.valid, true);
    assert.equal(validation.complete, true);
    // It flies as loaded by default, and stops at the load the warning names.
    assert.ok(BuildMetrics.of(build).mobilityMetricsResult().value!.speed > 0);
    assert.equal(
        BuildMetrics.of(build).mobilityMetricsResult({ cargo: build.cargoCapacity }).value?.speed,
        0,
    );
});

test('a capture stating a mass nobody can weigh is reported, not refused', () => {
    // An import copies `UnladenMass` and every modifier verbatim, so a report has to
    // survive figures a calculation would throw on: `validation()` describes a build,
    // and a build that cannot be weighed still has a structure worth describing.
    const stated = { ...(slapacondaJournal as LoadoutEvent), UnladenMass: -5 };
    const imported = ShipLoadout.fromLoadout(stated);
    assert.equal(imported.unladenMass, -5);
    const report = imported.validation();
    assert.equal(report.valid, true);
    assert.equal(
        report.issues.some((issue) => issue.code === 'thrusterMassExceeded'),
        false,
        'an unweighable mass leaves the rule with nothing to weigh',
    );

    // The rating can be the unweighable half instead: a modifier drives it below zero,
    // and the ship is still structurally a ship.
    const rated = ShipLoadout.fromLoadout({
        Ship: 'sidewinder',
        Modules: [
            {
                Slot: 'MainEngines',
                Item: 'Int_Engine_Size2_Class1',
                Engineering: {
                    BlueprintName: 'Engine_Dirty',
                    Level: 5,
                    Quality: 1,
                    Modifiers: [{ Label: 'EngineOptimalMass', Value: -500_000, OriginalValue: 72 }],
                },
            },
        ],
    } as LoadoutEvent);
    assert.doesNotThrow(() => rated.validation());
    assert.equal(
        rated.validation().issues.some((issue) => issue.code === 'thrusterMassExceeded'),
        false,
    );
});

test('the outfitting offer holds one identity per article a station sells', () => {
    const build = ShipLoadout.empty('SideWinder');
    const offered = build.modulesForSlot('MainEngines');
    // The 2E Thrusters exist twice in the catalogues: the article a station sells, and
    // the grant-only twin a hull arrives with. A picker offers the first alone.
    assert.deepEqual(
        offered
            .filter((module) => module.class === 2 && module.rating === 'E')
            .map((m) => m.symbol),
        ['Int_Engine_Size2_Class1'],
    );
    assert.equal(
        offered.some((module) => module.grantOnly),
        false,
    );
    assert.ok(ALL_MODULES.some((module) => module.grantOnly));

    // Filtering the offer does not hide the article: it still resolves, still fits, and
    // an imported build keeps the one it arrived with.
    const granted = mod('Int_Engine_Size2_Class1_free');
    assert.equal(granted.grantOnly, true);
    assert.equal(build.setModule('MainEngines', granted).validation().valid, true);
    assert.equal(
        ShipLoadout.fromLoadout({
            Ship: 'sidewinder',
            Modules: [{ Slot: 'MainEngines', Item: granted.symbol }],
        })
            .fittedModules()
            .find((fitted) => fitted.slot === 'MainEngines')?.symbol,
        granted.symbol,
    );
});

test('the facade reports loaded mobility, shield recovery and cell-bank pools', () => {
    const stock = ShipLoadout.default('SideWinder');
    const mobility = BuildMetrics.of(stock).mobilityMetricsResult().value;
    assert.ok(mobility);
    assert.ok(mobility.speed > 0);
    assert.ok(mobility.boost > mobility.speed);
    assert.ok(
        BuildMetrics.of(stock).mobilityCapacitorMetricsResult({ enginesPips: 2 }).value!.speed <
            mobility.speed,
    );
    // Four pips is the pip-free baseline, so the capacitor's default reproduces it.
    assert.equal(
        BuildMetrics.of(stock).mobilityCapacitorMetricsResult().value!.speed,
        mobility.speed,
    );

    const enhanced = ShipLoadout.default('SideWinder')
        .setModule('PowerPlant', mod('Int_PowerPlant_Size2_Class5', CORE_MODULES))
        .setModule('MainEngines', mod('Int_Engine_Size2_Class5_Fast', CORE_MODULES));
    const enhancedMobility = BuildMetrics.of(enhanced).mobilityMetricsResult().value!;
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
    assert.notEqual(
        BuildMetrics.of(enhanced).mobilityMetricsResult().value!.speed,
        enhancedMobility.speed,
    );

    const lynx = ShipLoadout.default('MediumTransport01');
    const lynxFourPips = BuildMetrics.of(lynx).mobilityCapacitorMetricsResult({
        enginesPips: 4,
    }).value!;
    const lynxZeroPips = BuildMetrics.of(lynx).mobilityCapacitorMetricsResult({
        enginesPips: 0,
    }).value!;
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
        BuildMetrics.of(tuned).mobilityMetricsResult().value!.massCurveMultiplier,
        thrusterMassCurveMultiplier(tuned.unladenMass! + tunedMainFuel, {
            minMass: effectiveThrusters.minMass!,
            optMass: effectiveThrusters.optMass!,
            maxMass: effectiveThrusters.maxMass!,
            minMultiplier: effectiveThrusters.minMultiplier!,
            optMultiplier: effectiveThrusters.optMultiplier!,
            maxMultiplier: effectiveThrusters.maxMultiplier!,
        }),
    );

    const recovery = BuildMetrics.of(stock).shieldRecoveryResult().value;
    assert.ok(recovery);
    assert.ok(recovery.recoveryTime >= 16);
    assert.ok(recovery.regenTime > 0);

    // A bank with no plant behind it is not a state a build can reach: every hull mounts
    // its stock plant from the first factory. An unpowered bank is still reachable by
    // outdrawing the plant, which the `shed` case below pins.
    const bank = mod('Int_ShieldCellBank_Size6_Class3', INTERNAL_MODULES);

    const banked = ShipLoadout.default('Anaconda')
        .setModule('Slot02_Size6', bank)
        .setModule('Slot01_Size7', bank);
    const cells = BuildMetrics.of(banked).cellBanks();
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
    const disabled = BuildMetrics.of(banked).cellBanks();
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
    const combatPower = BuildMetrics.of(combat).powerBudget();
    assert.equal(combatPower.bands[0]?.poweredDeployed, true);
    assert.equal(combatPower.bands[4]?.poweredRetracted, true);
    assert.equal(combatPower.bands[4]?.poweredDeployed, false);
    const shed = BuildMetrics.of(combat).cellBanks();
    assert.deepEqual(
        shed.banks.map(({ powered }) => powered),
        [false],
    );
    assert.equal(shed.totalCells, 0);
    assert.equal(shed.totalRestorable, 0);
});

test('mobility returns null before requiring mass when the thrusters are unpowered', () => {
    // Every build mounts thrusters — no factory leaves a core mount empty — so the
    // absent-curve path is reached by shedding them: a plant this Anaconda outdraws
    // leaves the mount in an unpowered band.
    const shed = ShipLoadout.empty('Anaconda')
        .setModule('PowerPlant', mod('Int_PowerPlant_Size2_Class1', CORE_MODULES))
        .setModulePriority('MainEngines', 4);
    assert.equal(BuildMetrics.of(shed).powerBudget().withinBudget, false);
    assert.equal(BuildMetrics.of(shed).mobilityMetricsResult().value, null);
    assert.equal(BuildMetrics.of(shed).mobilityCapacitorMetricsResult().value, null);
    assert.throws(
        () => BuildMetrics.of(shed).mobilityCapacitorMetricsResult({ enginesPips: 5 }).value,
        RangeError,
    );
});

test('explicit mobility fuel overrides the tank load and excludes reserve mass', () => {
    const fixture = operationsFixture.mobility.facadeFuelOverride;
    const build = ShipLoadout.fromLoadout(fixture.loadout);
    assert.deepEqual(build.fuelCapacity, { main: 4, reserve: 0.25 });
    const metrics = BuildMetrics.of(build).mobilityMetricsResult(fixture.options).value!;
    for (const [field, expected] of Object.entries(fixture.expected)) {
        assert.ok(near(metrics[field as keyof typeof metrics], expected), field);
    }
    assert.ok(BuildMetrics.of(build).mobilityMetricsResult().value!.speed < metrics.speed);
    for (const invalid of fixture.invalidLoads) {
        assert.throws(() => BuildMetrics.of(build).mobilityMetricsResult(invalid.options).value, {
            name: invalid.expectedError,
        });
    }
});

test('metric methods validate pips before build state and name their own scopes', () => {
    const metrics = BuildMetrics.of(ShipLoadout.empty('SideWinder'));
    const pipScopes: readonly (readonly [string, () => unknown, string])[] = [
        [
            'mobilityCapacitorMetricsResult',
            () => metrics.mobilityCapacitorMetricsResult({ enginesPips: 5 }),
            'enginesPips',
        ],
        [
            'shieldCapacitorMetricsResult',
            () => metrics.shieldCapacitorMetricsResult({ systemsPips: 5 }),
            'systemsPips',
        ],
        [
            'shieldRecoveryResult',
            () => metrics.shieldRecoveryResult({ systemsPips: 5 }),
            'systemsPips',
        ],
        [
            'distributorMetricsResult',
            () => metrics.distributorMetricsResult({ weaponsPips: 5 }),
            'weaponsPips',
        ],
        [
            'weaponsCapacitorMetrics',
            () => metrics.weaponsCapacitorMetrics({ weaponsPips: 5 }),
            'weaponsPips',
        ],
    ];
    for (const [method, call, option] of pipScopes) {
        assert.throws(call, {
            name: 'RangeError',
            message: `BuildMetrics.${method}: ${option} must be a finite number from 0 to 4`,
        });
    }

    for (const [method, call] of [
        ['mobilityMetricsResult', () => metrics.mobilityMetricsResult({ fuel: -1 })],
        ['buildMass', () => metrics.buildMass({ fuel: -1 })],
    ] as const) {
        assert.throws(call, {
            name: 'RangeError',
            message: `BuildMetrics.${method}: fuel must be a finite non-negative number`,
        });
    }

    assert.throws(() => metrics.standardLoadResult('half' as 'laden'), {
        name: 'RangeError',
        message: "BuildMetrics.standardLoadResult: load must be 'maximum', 'unladen', or 'laden'",
    });

    assert.equal(metrics.shieldRecoveryResult().value, null);
});

test('BuildMetrics.of names its own parameter when handed something else', () => {
    assert.throws(() => BuildMetrics.of({ shipSymbol: 'Anaconda' } as unknown as ShipLoadout), {
        name: 'TypeError',
        message:
            'BuildMetrics.of: build must be a ShipLoadout, received object {"shipSymbol":"Anaconda"}',
    });
    assert.throws(() => BuildMetrics.of(undefined as unknown as ShipLoadout), {
        name: 'TypeError',
        message: 'BuildMetrics.of: build must be a ShipLoadout, received undefined',
    });
});

test('a metrics view reads the build it was attached to, not a snapshot of it', () => {
    const build = ShipLoadout.default('Anaconda');
    const metrics = BuildMetrics.of(build);
    assert.equal(metrics.loadout(), build);
    const before = metrics.buildMass().modules;
    build.removeModule('Slot03_Size6');
    assert.ok(metrics.buildMass().modules < before);
});

test('mobility and shield metrics stop when the power budget sheds their modules', () => {
    const disabled = ShipLoadout.default('SideWinder').setModuleEnabled('PowerPlant', false);
    assert.equal(BuildMetrics.of(disabled).powerBudget().available, 0);
    assert.equal(BuildMetrics.of(disabled).mobilityMetricsResult().value, null);
    assert.equal(BuildMetrics.of(disabled).shieldRecoveryResult().value, null);

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
    const budget = BuildMetrics.of(overloaded).powerBudget();
    assert.ok(budget.available > 0);
    assert.equal(budget.bands[4]?.poweredRetracted, false);
    assert.equal(BuildMetrics.of(overloaded).mobilityMetricsResult().value, null);
    assert.equal(BuildMetrics.of(overloaded).shieldMetricsResult().value, null);
    assert.equal(BuildMetrics.of(overloaded).shieldRecoveryResult().value, null);
    assert.equal(BuildMetrics.of(overloaded).mobilityMetricsResult().issues[0]?.reason, 'shed');
    assert.deepEqual(BuildMetrics.of(overloaded).shieldMetricsResult().issues[0], {
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
    assert.equal(BuildMetrics.of(overloaded).shieldRecoveryResult().issues[0]?.reason, 'shed');

    // A mount switched off is diagnosed before anything downstream of it: the plant
    // first, since nothing runs without it, then the generator itself.
    const plantOff = ShipLoadout.default('SideWinder').setModuleEnabled('PowerPlant', false);
    assert.deepEqual(
        BuildMetrics.of(plantOff)
            .shieldMetricsResult()
            .issues.map((issue) => [issue.field, issue.reason]),
        [['powerCapacity', 'disabled']],
    );
    const generatorOff = ShipLoadout.default('SideWinder').setModuleEnabled('Slot01_Size2', false);
    assert.deepEqual(
        BuildMetrics.of(generatorOff)
            .shieldMetricsResult()
            .issues.map((issue) => [issue.field, issue.reason]),
        [['shieldGenerator', 'disabled']],
    );
});

test('a resolved plant without usable capacity is diagnosed by metric results', () => {
    const incompletePlant = { ...mod('Int_Powerplant_Size8_Class5') };
    delete incompletePlant.powerCapacity;
    const build = ShipLoadout.default('Anaconda').setModule('PowerPlant', incompletePlant);

    assert.equal(build.validation().complete, true);
    assert.deepEqual(build.validation().issues, []);
    assert.equal(BuildMetrics.of(build).shieldMetricsResult().value, null);
    assert.equal(BuildMetrics.of(build).shieldMetricsResult().issues[0]?.field, 'powerCapacity');
    assert.equal(BuildMetrics.of(build).shieldMetricsResult().issues[0]?.reason, 'unresolved');
    assert.equal(
        BuildMetrics.of(build).shieldMetricsResult().issues[0]?.message,
        'PowerPlant: power capacity unavailable for Int_Powerplant_Size8_Class5',
    );

    // The thruster reader answers the same way: a supplied record missing part of its
    // mass curve leaves mobility unavailable rather than curving off whatever remains.
    const incompleteThrusters = { ...mod('Int_Engine_Size7_Class5') };
    delete incompleteThrusters.minMass;
    const noCurve = ShipLoadout.default('Anaconda').setModule('MainEngines', incompleteThrusters);
    assert.equal(BuildMetrics.of(noCurve).mobilityMetricsResult().value, null);
    assert.equal(BuildMetrics.of(noCurve).mobilityMetricsResult().issues[0]?.field, 'thrusters');
    assert.equal(BuildMetrics.of(noCurve).mobilityMetricsResult().issues[0]?.reason, 'unresolved');
    assert.equal(
        BuildMetrics.of(noCurve).mobilityMetricsResult().issues[0]?.message,
        'MainEngines: thruster stats unavailable for Int_Engine_Size7_Class5',
    );

    // The aggregates do not read that way, because there is no supplied record they
    // could read it from: a fit that drops one of the four figures a build sums is
    // refused outright rather than counted as 0 or reported as unknown.
    for (const field of ['mass', 'cargoCapacity'] as const) {
        const dropped = { ...mod('Int_CargoRack_Size6_Class1', INTERNAL_MODULES) };
        delete dropped[field];
        assert.throws(
            () => ShipLoadout.default('Anaconda').setModule('Slot01_Size7', dropped),
            new TypeError(
                `ShipLoadout.setModule: the supplied record for "Int_CargoRack_Size6_Class1" has no ${field}`,
            ),
        );
    }
    const cabinless = { ...mod('Int_PassengerCabin_Size6_Class1', INTERNAL_MODULES) };
    delete cabinless.cabinCapacity;
    assert.throws(
        () => ShipLoadout.default('BelugaLiner').setModule('Slot01_Size6', cabinless),
        new TypeError(
            'ShipLoadout.setModule: the supplied record for "Int_PassengerCabin_Size6_Class1" has no cabinCapacity',
        ),
    );

    // A figure stated as anything but a finite number is that same defect wearing a
    // value — `null` off a JSON round-trip, a string off a form — and would be summed
    // as 0 or concatenated onto the total rather than counted.
    for (const stated of [null, '64', Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () =>
                ShipLoadout.default('Anaconda').setModule('Slot01_Size7', {
                    ...mod('Int_CargoRack_Size6_Class1', INTERNAL_MODULES),
                    cargoCapacity: stated as unknown as number,
                }),
            /ShipLoadout\.setModule: the supplied record for "Int_CargoRack_Size6_Class1" states a cargoCapacity of /,
        );
    }

    const assertInvalidPower = (invalid: ShipLoadout, budgetThrows: boolean): void => {
        assert.equal(BuildMetrics.of(invalid).mobilityMetricsResult().value, null);
        assert.equal(BuildMetrics.of(invalid).shieldMetricsResult().value, null);
        assert.equal(BuildMetrics.of(invalid).shieldRecoveryResult().value, null);
        for (const result of [
            BuildMetrics.of(invalid).mobilityMetricsResult(),
            BuildMetrics.of(invalid).shieldMetricsResult(),
            BuildMetrics.of(invalid).shieldRecoveryResult(),
        ]) {
            assert.equal(result.issues[0]?.field, 'powerCapacity');
            assert.equal(result.issues[0]?.reason, 'invalid');
        }
        if (budgetThrows) assert.throws(() => BuildMetrics.of(invalid).powerBudget(), RangeError);
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

    assert.throws(() => BuildMetrics.of(build).powerBudget(), RangeError);
    assert.equal(BuildMetrics.of(build).mobilityMetricsResult().value, null);
    assert.equal(BuildMetrics.of(build).shieldMetricsResult().value, null);
    assert.equal(BuildMetrics.of(build).shieldRecoveryResult().value, null);
    for (const result of [
        BuildMetrics.of(build).mobilityMetricsResult(),
        BuildMetrics.of(build).shieldMetricsResult(),
        BuildMetrics.of(build).shieldRecoveryResult(),
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
    const result = BuildMetrics.of(
        ShipLoadout.empty('Anaconda').setModule('PowerPlant', mod('Int_Powerplant_Size8_Class5')),
    ).shieldMetricsResult();
    assert.equal(result.complete, false);
    assert.equal(result.issues[0]?.field, 'shieldGenerator');
    assert.equal(result.issues[0]?.reason, 'missing');

    // A cosmetic entry keeps whatever symbol the capture spelled and has no catalogue
    // record, so one spelled as a generator is the reader's only unresolved case — and
    // it is diagnosed rather than answered with a zero curve.
    const stock = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const noRecord = ShipLoadout.fromLoadout({
        ...stock,
        Modules: [
            ...stock.Modules.filter(
                (module) => !module.Item.toLowerCase().startsWith('int_shieldgenerator'),
            ),
            { Slot: 'Decal1', Item: 'Int_ShieldGenerator_Size9_Class9_MadeUp' },
        ],
    });
    assert.equal(BuildMetrics.of(noRecord).shieldMetricsResult().value, null);
    assert.equal(
        BuildMetrics.of(noRecord).shieldMetricsResult().issues[0]?.field,
        'shieldGenerator',
    );
    assert.equal(BuildMetrics.of(noRecord).shieldMetricsResult().issues[0]?.reason, 'unresolved');
    assert.equal(
        BuildMetrics.of(noRecord).shieldMetricsResult().issues[0]?.message,
        'Decal1: shield-generator stats unavailable for Int_ShieldGenerator_Size9_Class9_MadeUp',
    );
});

test('buildCost prices assembled builds directly and qualifies missing module prices', () => {
    const expected = operationsFixture.buildCost.credits;
    const stock = ShipLoadout.default(expected.ship);
    const credits = BuildMetrics.of(stock).buildCost().credits;
    const event = stock.toLoadoutEvent();
    assert.deepEqual(
        {
            total: credits.total,
            hull: credits.hull,
            modules: credits.modules,
            rebuy: credits.rebuy,
        },
        expected.expected,
    );
    assert.equal(credits.total, credits.hull + credits.modules);
    assert.equal(credits.rebuy, Math.trunc(credits.total * 0.05));
    assert.deepEqual(
        { hull: credits.hull, modules: credits.modules, rebuy: credits.rebuy },
        { hull: event.HullValue, modules: event.ModulesValue, rebuy: event.Rebuy },
    );
    assert.ok(Object.isFrozen(credits));
    assert.ok(Object.isFrozen(credits.unpriced));
    assert.deepEqual(BuildMetrics.of(stock).buildCost().materials, []);

    const unknown = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_CorrosionProofCargoRack_Size5_Class1', INTERNAL_MODULES),
    );
    assert.ok(BuildMetrics.of(unknown).buildCost().credits.unpriced.length > 0);
});

test('buildCost totals the engineering a build still has to pay for', () => {
    const build = ShipLoadout.default('Anaconda');
    assert.deepEqual(BuildMetrics.of(build).buildCost().materials, []);

    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
    const blueprintOnly = BuildMetrics.of(build).buildCost().materials;
    assert.equal(blueprintOnly.find((material) => material.symbol === 'Arsenic')?.count, 5);
    assert.deepEqual(blueprintOnly, getBlueprintCost('FSD_LongRange', 5)!.materials);
    assert.ok(Object.isFrozen(blueprintOnly));

    build.setExperimentalEffect('FrameShiftDrive', 'special_fsd_heavy');
    assert.deepEqual(
        BuildMetrics.of(build).buildCost().materials,
        sumMaterials(blueprintOnly, getExperimentalEffectCost('special_fsd_heavy')!),
    );

    // A festive reward identifies a recipe it was never rolled from, so it costs nothing.
    const festive = ShipLoadout.default('Python');
    const reward = getPreEngineeredVariants('Hpt_FlakMortar_Turret_Medium').find(
        (candidate) => candidate.acquisition === 'eventReward',
    )!;
    festive.setPreEngineeredVariant('MediumHardpoint1', reward);
    assert.deepEqual(BuildMetrics.of(festive).buildCost().materials, []);
    assert.equal(BuildMetrics.of(festive).buildCost().mercCoins, 0);

    const ordinary = operationsFixture.buildCost.ordinaryEngineering;
    const fuelScoop = ShipLoadout.empty(ordinary.ship).setModule(
        ordinary.slot,
        getModuleBySymbol(ordinary.symbol, ALL_MODULES)!,
    );
    fuelScoop.applyBlueprint(ordinary.slot, ordinary.blueprint, { grade: ordinary.grade });
    assert.equal(BuildMetrics.of(fuelScoop).buildCost().mercCoins, ordinary.mercCoins);
});

test('buildCost prices only the engineering the catalogues carry', () => {
    // A capture states its own blueprint and grade. An id no registry lists, and a grade
    // outside the catalogued 1-5, are both priced as nothing rather than thrown at a
    // consumer reading a total.
    const stock = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const engineered = (engineering: Record<string, unknown>) =>
        BuildMetrics.of(
            ShipLoadout.fromLoadout({
                ...stock,
                Modules: stock.Modules.map((module) =>
                    module.Slot === 'FrameShiftDrive'
                        ? { ...module, Engineering: engineering }
                        : module,
                ),
            } as LoadoutEvent),
        ).buildCost();

    const unknownRecipe = engineered({
        BlueprintName: 'Totally_Made_Up',
        Level: 5,
        Quality: 1,
        ExperimentalEffect: 'special_totally_made_up',
    });
    assert.deepEqual(unknownRecipe.materials, []);
    assert.equal(unknownRecipe.mercCoins, 0);
    assert.equal(unknownRecipe.credits.unpriced.length, 0);

    const impossibleGrade = engineered({ BlueprintName: 'FSD_LongRange', Level: 9, Quality: 1 });
    assert.deepEqual(impossibleGrade.materials, []);
});

test('buildCost totals Merc Coin purchases and the climbs above them', () => {
    const expected = operationsFixture.buildCost.mercenary;
    const build = ShipLoadout.default(expected.ship);
    assert.equal(BuildMetrics.of(build).buildCost().mercCoins, 0);

    for (const module of expected.modules) {
        const variant = getPreEngineeredVariants(module.symbol).find(
            (candidate) => candidate.blueprintSymbol === module.blueprint,
        )!;
        build.setPreEngineeredVariant(module.slot, variant);
    }
    // Bought at grade 1: the purchase price alone, with nothing rolled on top of it.
    assert.equal(BuildMetrics.of(build).buildCost().mercCoins, expected.expected);
    assert.deepEqual(BuildMetrics.of(build).buildCost().materials, []);

    const removed = expected.modules[0]!;
    build.setModule(removed.slot, getModuleBySymbol(removed.symbol, ALL_MODULES)!);
    assert.equal(BuildMetrics.of(build).buildCost().mercCoins, expected.expected - removed.cost);

    build.applyBlueprint(removed.slot, removed.blueprint, { grade: expected.climbed.grade });
    const climbed = BuildMetrics.of(build).buildCost();
    assert.equal(climbed.mercCoins, expected.climbed.mercCoins);
    assert.deepEqual(climbed.materials, expected.climbed.materials);
});

test('buildMass weighs a build the way buildCost prices one', () => {
    const build = ShipLoadout.default('Anaconda');
    const tank = build.fuelCapacity.main;
    const mass = BuildMetrics.of(build).buildMass();
    assert.deepEqual(mass, {
        hull: getShipBySymbol('Anaconda')!.hullMass,
        modules: build.unladenMass - getShipBySymbol('Anaconda')!.hullMass,
        unladen: build.unladenMass,
        fuel: tank,
        cargo: 0,
        total: build.unladenMass + tank,
    });
    assert.equal(mass.hull + mass.modules, mass.unladen);
    assert.ok(Object.isFrozen(mass));

    // The load is the caller's, and defaults match the jump and mobility calls: a full
    // main tank, an empty hold, and the reserve tank in neither.
    const laden = BuildMetrics.of(build).buildMass({ fuel: 8, cargo: build.cargoCapacity });
    assert.deepEqual(
        { fuel: laden.fuel, cargo: laden.cargo, total: laden.total },
        {
            fuel: 8,
            cargo: build.cargoCapacity,
            total: build.unladenMass + 8 + build.cargoCapacity,
        },
    );
    assert.deepEqual(
        { hull: laden.hull, modules: laden.modules, unladen: laden.unladen },
        { hull: mass.hull, modules: mass.modules, unladen: mass.unladen },
    );
    assert.equal(BuildMetrics.of(build).buildMass({ fuel: 0 }).total, build.unladenMass);
    assert.equal(
        BuildMetrics.of(build).buildMass().total,
        BuildMetrics.of(build).standardLoadResult('unladen').value!.mass,
    );
    assert.throws(() => BuildMetrics.of(build).buildMass({ fuel: -1 }), RangeError);
    assert.throws(
        () => BuildMetrics.of(build).buildMass({ cargo: Number.POSITIVE_INFINITY }),
        RangeError,
    );

    // Every module figure is post-engineering, so a roll that moves a module's mass
    // moves the modules total and the unladen mass with it.
    const heavier = ShipLoadout.default('Anaconda');
    heavier.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
    const rolled = BuildMetrics.of(heavier).buildMass();
    assert.equal(rolled.hull, mass.hull);
    assert.ok(rolled.modules > mass.modules);
    assert.equal(rolled.hull + rolled.modules, heavier.unladenMass);

    // A hull with only its stock fixed-mount articles still weighs them, and with no
    // fuel aboard its total is exactly the decomposition.
    const bare = BuildMetrics.of(ShipLoadout.empty('Anaconda')).buildMass({ fuel: 0 });
    assert.equal(bare.hull, mass.hull);
    assert.equal(bare.total, bare.hull + bare.modules);
    assert.ok(bare.modules < mass.modules);
});

test("buildMass reports the capture's own unladen mass, decomposed from the catalogues", () => {
    // An import's `UnladenMass` stands while its fit survives, and it is the figure the
    // jump and mobility calculations use — so it is what `unladen` and `total` report,
    // while `hull` and `modules` say what the catalogues make that mass out of.
    const build = ShipLoadout.fromLoadout(deepBlackJournal as LoadoutEvent);
    const mass = BuildMetrics.of(build).buildMass();
    assert.equal(mass.unladen, build.unladenMass);
    assert.equal(mass.total, build.unladenMass + build.fuelCapacity.main);
    assert.equal(mass.hull, getShipBySymbol(build.shipSymbol)!.hullMass);
    assert.ok(near(mass.hull + mass.modules, mass.unladen, 0.5));
});

test('the thrusters getter publishes the fitted curve without a mobility calculation', () => {
    const build = ShipLoadout.default('Anaconda');
    const curve = BuildMetrics.of(build).thrusters()!;
    const fitted = build.fittedModuleAt('MainEngines')!.effectiveStats!;
    assert.deepEqual(curve, {
        minMass: fitted.minMass,
        optMass: fitted.optMass,
        maxMass: fitted.maxMass,
        minMultiplier: fitted.minMultiplier,
        optMultiplier: fitted.optMultiplier,
        maxMultiplier: fitted.maxMultiplier,
    });

    // The curve and the metrics agree: the multiplier the build reports is the one the
    // exported curve function gives for the loaded mass the build reports.
    const mobility = BuildMetrics.of(build).mobilityMetricsResult().value!;
    assert.equal(mobility.loadedMass, BuildMetrics.of(build).buildMass().total);
    assert.equal(
        thrusterMassCurveMultiplier(mobility.loadedMass, curve),
        mobility.massCurveMultiplier,
    );

    // Post-engineering, like every other figure the facade reports.
    const engineered = ShipLoadout.default('Anaconda');
    engineered.applyBlueprint('MainEngines', 'Engine_Dirty', { grade: 5 });
    assert.notEqual(BuildMetrics.of(engineered).thrusters()!.optMultiplier, curve.optMultiplier);

    // Enhanced-performance thrusters carry their two refining curves.
    const enhanced = ShipLoadout.default('SideWinder').setModule(
        'MainEngines',
        mod('Int_Engine_Size2_Class5_Fast', CORE_MODULES),
    );
    assert.equal(
        BuildMetrics.of(enhanced).thrusters()!.speedCurve!.optMultiplier,
        enhanced.fittedModuleAt('MainEngines')!.effectiveStats!.optSpeedMultiplier,
    );
    assert.equal(
        BuildMetrics.of(enhanced).thrusters()!.rotationCurve!.maxMultiplier,
        enhanced.fittedModuleAt('MainEngines')!.effectiveStats!.maxRotationMultiplier,
    );

    // It is the article's curve, not the build's power state: a switched-off thruster
    // still has one, though the mobility it feeds is unavailable.
    const stock = ShipLoadout.default('Anaconda').toLoadoutEvent();
    const off = ShipLoadout.fromLoadout({
        ...stock,
        Modules: stock.Modules.map((module) =>
            module.Slot === 'MainEngines' ? { ...module, On: false } : module,
        ),
    });
    assert.deepEqual(BuildMetrics.of(off).thrusters(), curve);
    assert.equal(BuildMetrics.of(off).mobilityMetricsResult().value, null);
    assert.equal(BuildMetrics.of(off).mobilityMetricsResult().issues[0]?.reason, 'disabled');

    // A record that cannot supply a whole curve answers null rather than throwing — the
    // jump equation cannot do without a drive, a flight model can do without thrusters.
    // (An import with no thrusters at all does not reach this: `fromLoadout` fills the
    // empty core mount with the hull's stock article.)
    const noCurve: Record<string, unknown> = { ...mod('Int_Engine_Size6_Class5', CORE_MODULES) };
    delete noCurve.maxMass;
    const unresolved = ShipLoadout.empty('Anaconda').setModule(
        'MainEngines',
        noCurve as unknown as OutfittingModule,
    );
    assert.equal(BuildMetrics.of(unresolved).thrusters(), null);
    assert.equal(
        BuildMetrics.of(unresolved).mobilityMetricsResult().issues[0]?.reason,
        'unresolved',
    );
});

test('passenger capacity sums the fitted cabins and follows every edit', () => {
    // A liner leaves the yard with cabins fitted, so the stock build already carries
    // berths: two size-6 and two size-4 business class cabins on the Beluga.
    const beluga = ShipLoadout.default('BelugaLiner');
    assert.equal(beluga.passengerCapacity, 16 + 16 + 6 + 6);

    // A hull with no cabin reports a genuine zero rather than an unknown.
    assert.equal(ShipLoadout.default('Anaconda').passengerCapacity, 0);
    assert.equal(ShipLoadout.empty('BelugaLiner').passengerCapacity, 0);

    // Unlike the mass and the cargo and fuel capacities, no capture states a passenger
    // figure to prefer, so an import reports the cabins it lists — a Lynx Highliner in
    // rescue trim, three size-6, two size-5 and one each of size-4, -3 and -2 Mk II
    // economy cabins.
    const rescue = ShipLoadout.fromLoadout(lynxRescueJournal as LoadoutEvent);
    assert.equal(rescue.passengerCapacity, 48 * 3 + 24 * 2 + 12 + 6 + 3);

    // The same hull's later capture, which has traded a size-5 and the two smallest
    // cabins for a second size-4, reproduces identically from a journal and from the
    // SLEF export of it.
    const current = ShipLoadout.fromLoadout(lynxJournal as LoadoutEvent);
    assert.equal(current.passengerCapacity, 48 * 3 + 24 + 12 * 2);
    assert.equal(
        ShipLoadout.fromSlef(JSON.stringify(lynxCapture)).passengerCapacity,
        current.passengerCapacity,
    );

    // The figure is live, not a snapshot. `ShipLoadout` edits in place, so each step
    // below reads the build the step before it left.
    const build = ShipLoadout.empty('Dolphin');
    assert.equal(build.passengerCapacity, 0);

    build.setModule('Slot01_Size5', mod('Int_PassengerCabin_Size5_Class1', INTERNAL_MODULES));
    assert.equal(build.passengerCapacity, 16);

    // A Mk II cabin of the same size and class carries half again as many berths.
    build.setModule('Slot01_Size5', mod('Int_MkII_PassengerCabin_Size5_Class1', INTERNAL_MODULES));
    assert.equal(build.passengerCapacity, 24);

    // A rack in the mount takes the berths back off, as removing the cabin outright does.
    build.setModule('Slot01_Size5', mod('Int_CargoRack_Size5_Class1', INTERNAL_MODULES));
    assert.equal(build.passengerCapacity, 0);
    assert.equal(build.cargoCapacity, 32);

    build.setModule('Slot01_Size5', mod('Int_PassengerCabin_Size5_Class3', INTERNAL_MODULES));
    assert.equal(build.passengerCapacity, 6);
    assert.equal(build.removeModule('Slot01_Size5').passengerCapacity, 0);
});

test('a stated CabinCapacity modifier is what the berths are counted from', () => {
    // No blueprint in the game moves this stat today, so nothing in the catalogues
    // exercises the label. The mapping still has to hold: a capture that states a
    // `CabinCapacity` modifier is stating the cabin's real capacity, and a build that
    // ignored it would total the catalogue's figure and read as measured. This is the
    // same rule `CargoCapacity` follows, and the only test that pins it for berths.
    const modified = ShipLoadout.fromLoadout({
        Ship: 'Dolphin',
        Modules: [
            {
                Slot: 'Slot01_Size5',
                Item: 'Int_PassengerCabin_Size5_Class1',
                Engineering: {
                    BlueprintName: 'Misc_LightWeight',
                    Level: 1,
                    Quality: 1,
                    Modifiers: [
                        { Label: 'CabinCapacity', Value: 20, OriginalValue: 16, LessIsGood: 0 },
                    ],
                },
            },
        ],
    } as LoadoutEvent);
    assert.equal(modified.fittedModuleAt('Slot01_Size5')?.effectiveStats?.cabinCapacity, 20);
    // The same import without the modifier is the baseline: the articles `fromLoadout`
    // restores — bulkhead, core internals, cargo hatch — carry no berths, so both builds
    // hold exactly the one stated cabin.
    const stock = ShipLoadout.fromLoadout({
        Ship: 'Dolphin',
        Modules: [{ Slot: 'Slot01_Size5', Item: 'Int_PassengerCabin_Size5_Class1' }],
    } as LoadoutEvent);
    assert.equal(stock.fittedModuleAt('Slot01_Size5')?.effectiveStats?.cabinCapacity, 16);
    assert.equal(modified.passengerCapacity, stock.passengerCapacity + 4);
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
    // One more than the export listed: it names no approach-suite mount, so import
    // stocks the hull's own advanced suite there.
    assert.equal(build.fittedModules().length, slefFixture[0]!.data.Modules.length + 1);
});

test('loadout validation makes empty builds explicit', () => {
    const captured = ShipLoadout.fromSlef(slefString);
    assert.equal(captured.validation().valid, true);
    assert.equal(captured.validation().complete, true);
    assert.deepEqual(captured.validation().issues, []);

    // A fresh build flies: its fixed mounts carry the hull's stock articles, and only
    // the mounts a commander outfits are open. `missingRequiredSlot` is reported by
    // `validateLoadout` on a layout a build did not come from — see its own suite.
    const empty = ShipLoadout.empty('SideWinder');
    assert.equal(empty.validation().valid, true);
    assert.equal(empty.validation().complete, true);
    assert.deepEqual(empty.validation().issues, []);

    const drive = getModuleBySymbol('Int_Hyperdrive_Size2_Class5', CORE_MODULES)!;
    const disguised = ShipLoadout.fromLoadout({
        Ship: 'sidewinder',
        Modules: [{ Slot: 'PaintJob', Item: drive.symbol }],
    });
    assert.equal(disguised.validation().valid, false);
    assert.ok(disguised.validation().issues.some((issue) => issue.code === 'unknownSlot'));
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
    // and a `null` `sourceSymbol` is what marks the mount import fills unasked.
    assert.deepEqual(omitted.importOutcomes, [
        {
            action: 'defaulted',
            slot: 'CargoHatch',
            sourceSymbol: null,
            // The hull default's own casing, not the capture's — nothing was captured.
            replacementSymbol: 'ModularCargoBayDoor',
        },
    ]);
    assert.deepEqual(omitted.validation(), { valid: true, complete: true, issues: [] });
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
    assert.deepEqual(unresolvedBuild.importOutcomes, [
        {
            action: 'defaulted',
            slot: 'cargohatch',
            sourceSymbol: 'FutureCargoHatch',
            replacementSymbol: 'ModularCargoBayDoor',
        },
    ]);

    // A hull-family hatch symbol resolves through the standard hatch's record rather
    // than being normalized, so a capture keeps its own article and its credit figures.
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

    // An oversized-but-resolvable core does not survive import either: a fixed mount
    // takes the hull's own article whenever the capture did not leave one it can hold.
    // The stock replacement keeps how the mount was being run and none of what the
    // article was, so repair finds nothing left to do.
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
    const stocked = oversized.fittedModuleAt('PowerPlant')!;
    assert.equal(stocked.symbol, 'Int_Powerplant_Size2_Class1');
    assert.equal(stocked.on, false);
    assert.equal(stocked.priority, 4);
    assert.equal(stocked.health, 0.5);
    assert.equal(stocked.value, undefined);
    assert.deepEqual(oversized.repairFixedMount('PowerPlant'), {
        status: 'unchanged',
        slot: 'PowerPlant',
        symbol: 'Int_Powerplant_Size2_Class1',
    });

    // Nor does a fresh build leave one open: `empty` stocks every fixed mount from the
    // same hull defaults repair would draw on, so there is nothing left for it to fix.
    const bare = ShipLoadout.empty('SideWinder');
    assert.deepEqual(bare.repairFixedMount('PowerPlant'), {
        status: 'unchanged',
        slot: 'PowerPlant',
        symbol: 'Int_Powerplant_Size2_Class1',
    });
});

test('a fixed mount takes the hull article when the capture names one it cannot hold', () => {
    // Every one of these resolves in the catalogue, so nothing but the mount itself can
    // refuse it: the wrong kind of article, the right kind in the wrong size, armour off
    // another hull, and the hatch, which takes nothing but its own built-in door.
    const build = ShipLoadout.fromLoadout({
        Ship: 'SideWinder',
        Modules: [
            { Slot: 'Armour', Item: 'Int_CargoRack_Size2_Class1' },
            { Slot: 'MainEngines', Item: 'Int_CargoRack_Size1_Class1' },
            { Slot: 'PowerPlant', Item: 'Int_Powerplant_Size8_Class5' },
            { Slot: 'CargoHatch', Item: 'Int_CargoRack_Size2_Class1' },
            { Slot: 'Slot01_Size2', Item: 'Int_Powerplant_Size2_Class1' },
        ],
    });
    assert.equal(build.fittedModuleAt('Armour')!.symbol, 'SideWinder_Armour_Grade1');
    assert.equal(build.fittedModuleAt('MainEngines')!.symbol, 'Int_Engine_Size2_Class1');
    assert.equal(build.fittedModuleAt('PowerPlant')!.symbol, 'Int_Powerplant_Size2_Class1');
    assert.equal(build.fittedModuleAt('CargoHatch')!.symbol, 'ModularCargoBayDoor');
    assert.deepEqual(
        build.importOutcomes.filter((outcome) => outcome.sourceSymbol !== null),
        [
            {
                action: 'defaulted',
                slot: 'Armour',
                sourceSymbol: 'Int_CargoRack_Size2_Class1',
                replacementSymbol: 'SideWinder_Armour_Grade1',
            },
            {
                action: 'defaulted',
                slot: 'MainEngines',
                sourceSymbol: 'Int_CargoRack_Size1_Class1',
                replacementSymbol: 'Int_Engine_Size2_Class1',
            },
            {
                action: 'defaulted',
                slot: 'PowerPlant',
                sourceSymbol: 'Int_Powerplant_Size8_Class5',
                replacementSymbol: 'Int_Powerplant_Size2_Class1',
            },
            {
                action: 'defaulted',
                slot: 'CargoHatch',
                sourceSymbol: 'Int_CargoRack_Size2_Class1',
                replacementSymbol: 'ModularCargoBayDoor',
            },
        ],
    );

    // A removable mount is not corrected: it may legally stand empty, so the article the
    // capture put there stays for the caller to see and remove.
    assert.equal(build.fittedModuleAt('Slot01_Size2')!.symbol, 'Int_Powerplant_Size2_Class1');
    assert.equal(build.validation().valid, false);
    assert.deepEqual(
        build.validation().issues.map((issue) => [issue.code, issue.slot]),
        [['incompatibleModule', 'Slot01_Size2']],
    );

    // Armour belonging to another hull is refused the same way.
    const wrongArmour = ShipLoadout.fromLoadout({
        Ship: 'SideWinder',
        Modules: [{ Slot: 'Armour', Item: 'Eagle_Armour_Grade1' }],
    });
    assert.equal(wrongArmour.fittedModuleAt('Armour')!.symbol, 'SideWinder_Armour_Grade1');
});

test('fitting a module resets the mount, unlike repairing one', () => {
    // A module the player chose carries no power state from the one it displaced; a stock
    // article standing in for one that failed to resolve keeps what the source recorded.
    const stock = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const build = ShipLoadout.fromLoadout({
        ...stock,
        Modules: stock.Modules.map((module) =>
            module.Slot === 'Slot01_Size2'
                ? { ...module, On: false, Priority: 3, Health: 0.5 }
                : module,
        ),
    });
    assert.equal(build.fittedModuleAt('Slot01_Size2')!.on, false);

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
        assert.deepEqual(build.validation(), { valid: true, complete: true, issues: [] });
        assert.ok(build.unladenMass !== null, `${ship.symbol}: mass`);
        assert.ok(build.fuelCapacity !== null, `${ship.symbol}: fuel`);
        assert.ok(BuildMetrics.of(build).maxJumpRange() !== null, `${ship.symbol}: jump range`);
        assert.equal(
            BuildMetrics.of(build).powerBudget().withinBudget,
            true,
            `${ship.symbol}: power`,
        );
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

test("a fit takes a record's own figures, but only for a catalogued article", () => {
    const rack = getModuleBySymbol('Int_CargoRack_Size2_Class1', INTERNAL_MODULES)!;
    // Whatever the catalogue says the article holds, the supplied record is what is
    // summed — that is how an engineered or newly rebalanced capacity gets counted.
    const roomier = ShipLoadout.empty('SideWinder').setModule('Slot01_Size2', {
        ...rack,
        cargoCapacity: 42,
    });
    assert.equal(roomier.cargoCapacity, 42);

    // The article itself has to be one the catalogue carries, though. A hold nothing
    // knows about has no mass, no price and no fit rules, so it is refused outright
    // rather than fitted and left out of every figure it should be in.
    assert.throws(
        () =>
            ShipLoadout.empty('SideWinder').setModule('Slot01_Size2', {
                ...rack,
                symbol: 'CustomHold',
            }),
        new TypeError('ShipLoadout.setModule: no module is catalogued as "CustomHold"'),
    );

    // The record is read once, before any of it is checked, so an accessor cannot
    // answer the checks one way and the fit that gets stored another.
    let reads = 0;
    const shifty = { ...rack };
    Object.defineProperty(shifty, 'cargoCapacity', {
        enumerable: true,
        get: () => (++reads === 1 ? 4 : undefined),
    });
    const once = ShipLoadout.empty('SideWinder').setModule('Slot01_Size2', shifty);
    assert.equal(once.cargoCapacity, 4);
    assert.equal(reads, 1);
});

test('a figure an import stated is handed back as stated, whole or half', () => {
    // The three accessors short-circuit when the capture already carries the figure,
    // and hand back the frozen value rather than a copy a consumer could mutate.
    const stock = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const imported = ShipLoadout.fromLoadout({
        ...stock,
        UnladenMass: 45,
        CargoCapacity: 512,
        FuelCapacity: { Main: 2, Reserve: 0.3 },
    });
    assert.equal(imported.unladenMass, 45);
    assert.equal(imported.cargoCapacity, 512);
    assert.deepEqual(imported.fuelCapacity, { main: 2, reserve: 0.3 });
    assert.equal(Object.isFrozen(imported.fuelCapacity), true);

    // Fuel has a fourth site the other two do not: half a stated capacity, merged with
    // the half that had to be calculated. `fromLoadout` takes a journal line as parsed,
    // so a producer that wrote only one of the pair — or any JavaScript caller, who has
    // no types at all — reaches it. A Sidewinder's own tank is 2 t and its reserve 0.3,
    // so a merge that ignored the stated half would quietly answer with that instead.
    const half = (FuelCapacity: { Main?: number; Reserve?: number }): ShipLoadout =>
        ShipLoadout.fromLoadout({ ...stock, FuelCapacity } as unknown as LoadoutEvent);
    assert.deepEqual(half({ Main: 9 }).fuelCapacity, { main: 9, reserve: 0.3 });
    assert.deepEqual(half({ Reserve: 9.99 }).fuelCapacity, { main: 2, reserve: 9.99 });
    assert.equal(Object.isFrozen(half({ Main: 9 }).fuelCapacity), true);
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
        near(BuildMetrics.of(build).maxJumpRange(), expected.edsyMaxJumpRange, 5e-2),
        `got ${BuildMetrics.of(build).maxJumpRange()}`,
    );
});

test('the resolved frame shift drive folds in engineering and the booster', () => {
    const fsd = BuildMetrics.of(ShipLoadout.fromSlef(slefString)).frameShiftDrive();
    assert.equal(fsd.optMass, expected.frameShiftDrive.optMass); // FSDOptimalMass modifier
    assert.equal(fsd.maxFuel, expected.frameShiftDrive.maxFuel);
    assert.equal(fsd.jumpBoost, expected.frameShiftDrive.jumpBoost); // Guardian booster size 5
});

test('unladen / laden / total range and per-jump fuel match the fixture', () => {
    const build = ShipLoadout.fromSlef(slefString);
    assert.ok(
        near(BuildMetrics.of(build).jumpRange(), expected.unladenJumpRange),
        `unladen ${BuildMetrics.of(build).jumpRange()}`,
    );
    assert.ok(
        near(BuildMetrics.of(build).ladenJumpRange(), expected.ladenJumpRange),
        `laden ${BuildMetrics.of(build).ladenJumpRange()}`,
    );
    const total = BuildMetrics.of(build).totalRange();
    assert.ok(near(total.range, expected.totalRange, 1e-2), `total ${total.range}`);
    assert.equal(total.jumps, expected.totalJumps);
    assert.ok(
        near(BuildMetrics.of(build).frameShiftDriveMassFactor(), expected.massFactor, 1e-12),
        `factor ${BuildMetrics.of(build).frameShiftDriveMassFactor()}`,
    );
    assert.ok(
        near(BuildMetrics.of(build).fuelPerJump(50), expected.fuelPerJump50Ly),
        `fuel50 ${BuildMetrics.of(build).fuelPerJump(50)}`,
    );
});

test('jump calculations honour explicit fuel and cargo', () => {
    const build = ShipLoadout.fromSlef(slefString);
    // The default is a full main tank with no cargo.
    assert.ok(
        near(
            BuildMetrics.of(build).jumpRange({ fuel: 128, cargo: 0 }),
            BuildMetrics.of(build).jumpRange(),
        ),
    );
    // more cargo -> shorter jump
    assert.ok(
        BuildMetrics.of(build).jumpRange({ cargo: 100 }) <
            BuildMetrics.of(build).jumpRange({ cargo: 0 }),
    );
    const totalMax = BuildMetrics.of(build).totalRange({
        fuel: BuildMetrics.of(build).frameShiftDrive().maxFuel,
    });
    assert.equal(totalMax.jumps, 1);
    assert.ok(near(totalMax.range, BuildMetrics.of(build).maxJumpRange()));
    assert.ok(
        BuildMetrics.of(build).totalRange({ fuel: 64 }).range <
            BuildMetrics.of(build).totalRange().range,
    );
    assert.throws(() => BuildMetrics.of(build).totalRange({ fuel: 1e7 }), /more than 100000 jumps/);

    const partial = expected.explicitFuel;
    const partialTank = ShipLoadout.fromLoadout(partial.loadout as unknown as LoadoutEvent);
    const partialTotal = BuildMetrics.of(partialTank).totalRange(partial.options);
    assert.equal(partialTotal.jumps, partial.expected.jumps);
    assert.ok(near(partialTotal.range, partial.expected.range));
    assert.ok(BuildMetrics.of(partialTank).totalRange().range > partialTotal.range);

    for (const invalid of operationsFixture.mobility.facadeFuelOverride.invalidLoads) {
        assert.throws(() => BuildMetrics.of(build).jumpRange(invalid.options), {
            name: invalid.expectedError,
        });
        assert.throws(() => BuildMetrics.of(build).fuelPerJump(1, invalid.options), {
            name: invalid.expectedError,
        });
        assert.throws(() => BuildMetrics.of(build).totalRange(invalid.options), {
            name: invalid.expectedError,
        });
    }
});

test('fromLoadout works on a bare journal event', () => {
    const build = ShipLoadout.fromLoadout(slefFixture[0]!.data as unknown as LoadoutEvent);
    assert.equal(build.shipSymbol, 'explorer_nx');
    assert.ok(near(BuildMetrics.of(build).maxJumpRange(), expected.edsyMaxJumpRange, 5e-2));
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
    assert.equal(BuildMetrics.of(build).frameShiftDrive().optMass, 1980);

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
    assert.equal(BuildMetrics.of(build).frameShiftDrive().optMass, 1980);

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
    const withBooster = BuildMetrics.of(ShipLoadout.fromSlef(slefString)).frameShiftDrive()
        .jumpBoost;
    const off: LoadoutEvent = {
        ...(slefFixture[0]!.data as unknown as LoadoutEvent),
        Modules: slefFixture[0]!.data.Modules.map((m) =>
            m.Item === 'int_guardianfsdbooster_size5' ? { ...m, On: false } : m,
        ),
    };
    assert.equal(withBooster, 10.5);
    assert.equal(BuildMetrics.of(ShipLoadout.fromLoadout(off)).frameShiftDrive().jumpBoost, 0);
});

test('a booster is identified by the bonus it supplies, not by its engineering menu', () => {
    const booster = mod('Int_GuardianFSDBooster_Size5', INTERNAL_MODULES);
    const conda = () =>
        ShipLoadout.empty('Anaconda').setModule(
            'FrameShiftDrive',
            mod('Int_Hyperdrive_Size6_Class5'),
        );
    // `engineeringGroup` says which recipes may touch an article, not what it does, and a
    // caller-supplied record may legitimately leave it null — which would otherwise count
    // the booster's mass while its boost went uncounted.
    const supplied = conda().setModule('Slot02_Size6', { ...booster, engineeringGroup: null });
    assert.equal(BuildMetrics.of(supplied).frameShiftDrive().jumpBoost, booster.jumpBoost);
    assert.equal(
        BuildMetrics.of(supplied).maxJumpRange(),
        BuildMetrics.of(conda().setModule('Slot02_Size6', booster)).maxJumpRange(),
    );

    // A zero bonus is not evidence of a booster: the first match wins, so believing one
    // would let an unrelated record earlier in slot order shadow the real article.
    const shadowed = conda()
        .setModule('Slot01_Size7', {
            ...mod('Int_CargoRack_Size6_Class1', INTERNAL_MODULES),
            jumpBoost: 0,
        })
        .setModule('Slot02_Size6', booster);
    assert.equal(BuildMetrics.of(shadowed).frameShiftDrive().jumpBoost, booster.jumpBoost);

    // A record that claims the menu but carries no bonus is a fault, not a zero.
    const menuOnly = { ...booster };
    delete menuOnly.jumpBoost;
    assert.throws(
        () => BuildMetrics.of(conda().setModule('Slot02_Size6', menuOnly)).frameShiftDrive(),
        /has no jumpBoost/,
    );
});

test('standard load results expose the jump summary load conditions', () => {
    const build = ShipLoadout.default('SideWinder');
    const maximum = BuildMetrics.of(build).standardLoadResult('maximum');
    const unladen = BuildMetrics.of(build).standardLoadResult('unladen');
    const laden = BuildMetrics.of(build).standardLoadResult('laden');

    // Each load also reports what the ship weighs carrying it, so a caller never has to
    // reassemble `unladenMass + fuel + cargo` — the reserve tank is excluded, exactly as
    // the jump and mobility calculations exclude it.
    const mass = build.unladenMass;
    assert.deepEqual(maximum, {
        value: { fuel: 0.6, cargo: 0, mass: mass + 0.6 },
        complete: true,
        issues: [],
    });
    assert.deepEqual(unladen, {
        value: { fuel: 2, cargo: 0, mass: mass + 2 },
        complete: true,
        issues: [],
    });
    assert.deepEqual(laden, {
        value: { fuel: 2, cargo: 4, mass: mass + 6 },
        complete: true,
        issues: [],
    });
    assert.equal(laden.value!.mass, BuildMetrics.of(build).buildMass({ fuel: 2, cargo: 4 }).total);
    assert.equal(
        BuildMetrics.of(build).mobilityMetricsResult(laden.value!).value!.loadedMass,
        laden.value!.mass,
    );
    assert.equal(
        BuildMetrics.of(build).jumpRange(maximum.value!),
        BuildMetrics.of(build).jumpRangeSummary().max,
    );
    assert.equal(
        BuildMetrics.of(build).jumpRange(unladen.value!),
        BuildMetrics.of(build).jumpRangeSummary().unladen,
    );
    assert.equal(
        BuildMetrics.of(build).jumpRange(laden.value!),
        BuildMetrics.of(build).jumpRangeSummary().laden,
    );
    assert.deepEqual(
        BuildMetrics.of(build).mobilityCapacitorMetricsResult({ ...laden.value!, enginesPips: 2 })
            .value,
        BuildMetrics.of(build).mobilityCapacitorMetricsResult({ fuel: 2, cargo: 4, enginesPips: 2 })
            .value,
    );
    assert.throws(
        () => BuildMetrics.of(build).standardLoadResult('other' as 'maximum'),
        /load must be 'maximum', 'unladen', or 'laden'/,
    );
});

test('standard maximum load reports invalid jump inputs', () => {
    const source = ShipLoadout.default('SideWinder').toLoadoutEvent();
    const noFuel = ShipLoadout.fromLoadout({
        ...source,
        FuelCapacity: { Main: 0, Reserve: 0 },
    });
    assert.deepEqual(BuildMetrics.of(noFuel).standardLoadResult('maximum').value, {
        fuel: 0,
        cargo: 0,
        mass: noFuel.unladenMass,
    });

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
    const invalid = BuildMetrics.of(invalidDrive).standardLoadResult('maximum');
    assert.equal(invalid.complete, false);
    assert.equal(invalid.issues[0]?.field, 'frameShiftDrive');
    assert.match(invalid.issues[0]!.message, /fuel must be a finite non-negative number/);

    // A drive whose supplied record has no jump constants reports that, rather than the
    // "no frame shift drive is fitted" message a build without one gets.
    const noConstants = { ...mod('Int_Hyperdrive_Size2_Class1') };
    delete noConstants.fuelMul;
    const unusable = BuildMetrics.of(
        ShipLoadout.default('SideWinder').setModule('FrameShiftDrive', noConstants),
    ).standardLoadResult('maximum');
    assert.equal(unusable.issues[0]?.field, 'frameShiftDrive');
    assert.match(unusable.issues[0]!.message, /has no jump constants/);
});

test('the power plant and fuel tank are found by their declared slots', () => {
    // The readers outside the fit check believe a record that names a mount, whatever
    // family its symbol suggests. It takes a hand-made record to show: a catalogue
    // record carries both signals, so it cannot tell the rules apart.
    const stock = ShipLoadout.empty('Anaconda');
    const plant = getModuleBySymbol('Int_PowerPlant_Size6_Class5', CORE_MODULES)!;
    assert.ok(BuildMetrics.of(stock).powerBudget().available > 0);
    assert.notEqual(
        BuildMetrics.of(ShipLoadout.empty('Anaconda').setModule('PowerPlant', plant)).powerBudget()
            .available,
        BuildMetrics.of(stock).powerBudget().available,
    );

    // The declared mount is authoritative even when the symbol suggests another family:
    // this plant sits in the thruster mount, so the hull's own plant is still the only
    // capacity the build has.
    const asThrusters: OutfittingModule = { ...plant, slot: 'thrusters' };
    const miswired = ShipLoadout.empty('Anaconda').setModule('MainEngines', asThrusters);
    assert.equal(
        BuildMetrics.of(miswired).powerBudget().available,
        BuildMetrics.of(stock).powerBudget().available,
    );

    // Capacity does not read that way and no longer has to: a fitted record states the
    // figures it contributes, so this rack is summed as cargo whatever mount it claims,
    // and no symbol has to be read to guess which of the two it meant.
    const rack = getModuleBySymbol('Int_CargoRack_Size5_Class1', ALL_MODULES)!;
    const misdeclared = ShipLoadout.empty('Anaconda').setModule('Slot05_Size5', {
        ...rack,
        slot: 'fuelTank',
    } as OutfittingModule);
    assert.equal(misdeclared.cargoCapacity, rack.cargoCapacity);
    assert.equal(misdeclared.fuelCapacity.main, stock.fuelCapacity.main);
});

test('the drive mount answers ahead of a hardpoint record claiming to be one', () => {
    // Drive lookup scans every fitted module and trusts the declared mount, so a
    // hand-made record claiming `frameShiftDrive` from a hardpoint is a candidate. The
    // hull's own drive is fitted from the first build, and it is the one that answers.
    const laser = getModuleBySymbol('Hpt_PulseLaser_Fixed_Large', ALL_MODULES)!;
    const build = ShipLoadout.empty('Anaconda')
        .setModule('HugeHardpoint1', { ...laser, slot: 'frameShiftDrive' } as OutfittingModule)
        .setModule(
            'FrameShiftDrive',
            getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!,
        )
        .setModule('FuelTank', getModuleBySymbol('Int_FuelTank_Size5_Class3', CORE_MODULES)!);
    assert.ok(BuildMetrics.of(build).maxJumpRange() > 0);
    assert.deepEqual(BuildMetrics.of(build).standardLoadResult('maximum').issues, []);
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
    // The named bulkhead plus the seven cores, the hatch and the approach suite import
    // stocks it for; the last two are weightless, so the figure is the cores'.
    assert.equal(ShipLoadout.fromLoadout(reactive).unladenMass, 1080);

    // An unresolved optional internal is stripped, so the hull and what remains still
    // add up rather than the whole figure going unknown.
    const unresolved: LoadoutEvent = {
        Ship: 'anaconda',
        Modules: [{ Slot: 'Slot01_Size7', Item: 'int_future_module_without_stats' }],
    };
    const unresolvedBuild = ShipLoadout.fromLoadout(unresolved);
    assert.equal(unresolvedBuild.unladenMass, 1020);
    assert.equal(unresolvedBuild.fittedModuleAt('Armour')?.symbol, 'Anaconda_Armour_Grade1');

    // An unresolved fixed mount is stocked instead, and the stock article's mass counts.
    const unresolvedCore = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [{ Slot: 'PowerPlant', Item: 'int_future_module_without_stats' }],
    });
    assert.equal(unresolvedCore.unladenMass, 1020);
    // A mount the capture never named is stocked on the same terms as an unresolved one,
    // and every hull carries a default for all ten, so an import is never short one.
    assert.equal(unresolvedCore.fittedModuleAt('MainEngines')?.symbol, 'Int_Engine_Size7_Class1');
    assert.equal(unresolvedCore.validation().complete, true);

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

test('empty starts a hull on its stock fixed mounts and nothing else', () => {
    const conda = ShipLoadout.empty('Anaconda');
    const stock = getDefaultLoadout('Anaconda')!;
    assert.equal(conda.shipSymbol, 'Anaconda');
    assert.equal(conda.slots('hardpoint').length, 8);
    assert.equal(conda.slots('utility').length, 8);
    assert.equal(conda.slots('core').length, 7);
    assert.equal(conda.slots('optional').length, 14);

    // Armour, the seven core internals and the hatch come from the hull's own defaults;
    // every mount a commander outfits is left open.
    assert.equal(conda.fittedModules().length, 9);
    assert.equal(conda.fittedModuleAt('CargoHatch')?.symbol, 'ModularCargoBayDoor');
    for (const fitted of conda.fittedModules()) {
        assert.equal(
            fitted.symbol,
            stock.modules.find((module) => module.slot === fitted.slot)?.symbol,
            fitted.slot,
        );
    }
    assert.ok(
        conda
            .slots()
            .filter((slot) => slot.kind === 'hardpoint' || slot.kind === 'utility')
            .concat(conda.slots('optional'))
            .every((slot) => slot.module === null),
    );
    // The build flies: it draws on the hull's own plant, and validation finds no hole.
    assert.ok(BuildMetrics.of(conda).powerBudget().available > 0);
    assert.equal(conda.validation().complete, true);
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
    // The stock drive was replaced, not added to: nine fixed mounts, still nine modules.
    assert.equal(build.fittedModules().length, 9);
});

test('setModule chains and removeModule clears', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod('Int_Hyperdrive_Size6_Class5'))
        .setModule('Slot01_Size7', mod('Int_FuelTank_Size6_Class3'));
    assert.equal(build.fittedModules().length, 10);
    build.removeModule('Slot01_Size7');
    assert.equal(build.fittedModuleAt('Slot01_Size7'), null);
    assert.equal(build.fittedModules().length, 9);
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
    const range = BuildMetrics.of(build).maxJumpRange();
    assert.ok(range > 10 && range < 80, `got ${range}`);
    assert.ok(BuildMetrics.of(build).frameShiftDrive().jumpBoost === 10.5);
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
        () => conda.setModule('FrameShiftDrive', mod('Int_Hyperdrive_Overcharge_Size8_Class5')),
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
    // Removable mounts, because a fixed one no longer keeps an article it cannot hold:
    // import stocks it from the hull defaults, and the diagnostic never reaches a caller.
    const imported = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [
            { Slot: 'Slot02_Size6', Item: 'Int_CargoRack_Size8_Class1' },
            {
                Slot: 'Slot03_Size6',
                Item: 'Int_Engine_Size7_Class5_GravityOptimised_MkII',
            },
        ],
    });
    const issues = imported
        .validation()
        .issues.filter((issue) => issue.code === 'incompatibleModule');
    assert.deepEqual(issues[0]?.params, {
        slot: 'Slot02_Size6',
        symbol: 'Int_CargoRack_Size8_Class1',
        constraint: 'oversized',
        moduleClass: 8,
        slotSize: 6,
    });
    assert.deepEqual(issues[1]?.params, {
        slot: 'Slot03_Size6',
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
        familyId: 'fsd',
        name: drive.name,
        class: drive.class,
        rating: drive.rating,
        mass: drive.mass!,
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
        familyId: 'armour',
        name: armour.name,
        ship: 'Anaconda',
        class: armour.class,
        rating: armour.rating,
        mass: armour.mass!,
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
        familyId: 'fuelTanks',
        name: tank.name,
        class: tank.class,
        rating: tank.rating,
        mass: tank.mass!,
        fuelCapacity: tank.fuelCapacity!,
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
        familyId: 'guardianHybridPowerPlants',
        name: plant.name,
        class: plant.class,
        rating: plant.rating,
        mass: plant.mass!,
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

test('an import with no approach-suite mount is stocked with the advanced suite', () => {
    // Exporters that do not model the mount write no entry for it, and every hull leaves
    // the shipyard carrying the advanced suite, so an absent mount is filled rather than
    // read as a suite the commander sold.
    const build = ShipLoadout.fromLoadout({
        Ship: 'sidewinder',
        Modules: [{ Slot: 'PowerPlant', Item: 'int_powerplant_size2_class1' }],
    });
    const fitted = build.fittedModuleAt('PlanetaryApproachSuite');
    assert.equal(fitted?.symbol.toLowerCase(), 'int_planetapproachsuite_advanced');
    assert.equal(fitted?.effectiveStats?.mass, 0);
    assert.deepEqual(
        build.importOutcomes.find((outcome) => outcome.slot === 'PlanetaryApproachSuite'),
        {
            action: 'defaulted',
            slot: 'PlanetaryApproachSuite',
            sourceSymbol: null,
            replacementSymbol: 'int_planetapproachsuite_advanced',
        },
    );

    // The mount is stocked, not fixed: what the import put there can be sold or swapped.
    assert.equal(
        build.slots().find((slot) => slot.restriction === 'planetaryApproachSuite')?.removable,
        true,
    );
    build.removeModule('PlanetaryApproachSuite');
    assert.equal(build.fittedModuleAt('PlanetaryApproachSuite'), null);
    assert.equal(build.validation().complete, true);

    // `empty` is the bare hull and leaves every optional mount open, the suite's included,
    // while `default` is the shipyard fit and carries one. So a build from `empty` gains a
    // suite on its way through the importer: the asymmetry is deliberate, and pinned here
    // because `empty` is the factory most likely to be round-tripped in a consumer test.
    const bare = ShipLoadout.empty('sidewinder');
    assert.equal(bare.fittedModuleAt('PlanetaryApproachSuite'), null);
    assert.equal(
        ShipLoadout.default('sidewinder')
            .fittedModuleAt('PlanetaryApproachSuite')
            ?.symbol.toLowerCase(),
        'int_planetapproachsuite_advanced',
    );
    assert.equal(
        ShipLoadout.fromLoadout(bare.toLoadoutEvent())
            .fittedModuleAt('PlanetaryApproachSuite')
            ?.symbol.toLowerCase(),
        'int_planetapproachsuite_advanced',
    );
});

test('an approach suite the source did state is the one imported', () => {
    // Stocking fills silence; it never overrides a suite the source named. The basic
    // suite is a legitimate fit, and a capture that spells it out keeps it.
    const stated = ShipLoadout.fromLoadout({
        Ship: 'sidewinder',
        Modules: [
            { Slot: 'PlanetaryApproachSuite', Item: 'int_planetapproachsuite' },
            { Slot: 'PowerPlant', Item: 'int_powerplant_size2_class1' },
        ],
    });
    assert.equal(
        stated.fittedModuleAt('PlanetaryApproachSuite')?.symbol.toLowerCase(),
        'int_planetapproachsuite',
    );
    assert.equal(
        stated.importOutcomes.some((outcome) => outcome.slot === 'PlanetaryApproachSuite'),
        false,
    );

    // An article the mount cannot hold is the hull's to correct, as in any stocked mount —
    // and unlike a mount stocked from silence, that substitution does void the capture's
    // own figures: it swapped out an article whose mass and price nothing records.
    //
    // The two events differ in that one entry alone. Every other mount is named, so
    // nothing else is stocked and nothing else can be what voids the figures — which is
    // the whole of the asymmetry this change turns on, and it is invisible on a capture
    // thin enough for the stocked core internals to void them anyway.
    const capture = (suite: string): LoadoutEvent => ({
        Ship: 'sidewinder',
        ModulesValue: 5000,
        Rebuy: 1000,
        UnladenMass: 25,
        Modules: [
            { Slot: 'PowerPlant', Item: 'int_powerplant_size2_class1' },
            { Slot: 'MainEngines', Item: 'int_engine_size2_class1' },
            { Slot: 'FrameShiftDrive', Item: 'int_hyperdrive_size2_class1' },
            { Slot: 'LifeSupport', Item: 'int_lifesupport_size1_class1' },
            { Slot: 'PowerDistributor', Item: 'int_powerdistributor_size1_class1' },
            { Slot: 'Radar', Item: 'int_sensors_size1_class1' },
            { Slot: 'FuelTank', Item: 'int_fueltank_size1_class3' },
            { Slot: 'Armour', Item: 'sidewinder_armour_grade1' },
            { Slot: 'PlanetaryApproachSuite', Item: suite },
        ],
    });
    const wrong = ShipLoadout.fromLoadout(capture('int_cargorack_size1_class1'));
    assert.deepEqual(
        wrong.importOutcomes.find((outcome) => outcome.slot === 'PlanetaryApproachSuite'),
        {
            action: 'defaulted',
            slot: 'PlanetaryApproachSuite',
            sourceSymbol: 'int_cargorack_size1_class1',
            replacementSymbol: 'int_planetapproachsuite_advanced',
        },
    );
    assert.equal(wrong.modulesValue, null);
    assert.equal(wrong.rebuy, null);
    // The recomputed figure, not merely a moved one: the 25 t hull plus 11.4 t of core
    // internals, the bulkhead, tank, hatch and suite each adding nothing.
    assert.ok(near(wrong.unladenMass!, 36.4));

    // The same fit with a suite the mount accepts keeps every figure the capture stated,
    // so it is the refusal that voids them and not the import.
    const accepted = ShipLoadout.fromLoadout(capture('int_planetapproachsuite'));
    assert.equal(accepted.modulesValue, 5000);
    assert.equal(accepted.rebuy, 1000);
    assert.equal(accepted.unladenMass, 25);
});

test('import stocks the approach suite for exactly the sources that model no such mount', () => {
    // The evidence the rule rests on, read off the captures themselves: Frontier's own
    // journals always name the mount, so import never overrides a real one, while every
    // third-party export in the corpus names none, so what it fills is silence rather
    // than a suite anybody sold.
    const captures = readCaptureFixtures();
    assert.ok(captures.journals.length >= 19, 'journal captures');
    assert.ok(captures.exports.length >= 6, 'third-party exports');
    for (const [name, event] of captures.journals) {
        assert.ok(
            event.Modules.some((module) => module.Slot.toLowerCase() === 'planetaryapproachsuite'),
            `${name}: a Frontier journal names the approach-suite mount`,
        );
        assert.equal(
            ShipLoadout.fromLoadout(event).importOutcomes.some(
                (outcome) => outcome.slot.toLowerCase() === 'planetaryapproachsuite',
            ),
            false,
            `${name}: nothing is stocked over it`,
        );
    }
    for (const [name, event] of captures.exports) {
        assert.equal(
            event.Modules.some((module) => module.Slot.toLowerCase() === 'planetaryapproachsuite'),
            false,
            `${name}: a third-party export names no approach-suite mount`,
        );
        const outcome = ShipLoadout.fromLoadout(event).importOutcomes.find(
            (entry) => entry.slot.toLowerCase() === 'planetaryapproachsuite',
        );
        assert.equal(outcome?.action, 'defaulted', `${name}: the mount is stocked`);
        assert.equal(outcome?.sourceSymbol, null, `${name}: stocked from silence`);
    }
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
    // The lookup itself, rather than its result — named as the function it is, not as
    // the plain object the snapshot below the check would have flattened it into.
    assert.throws(
        () => conda.setModule('FrameShiftDrive', getModuleBySymbol as unknown as OutfittingModule),
        /received function$/,
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

test('the cargo hatch is a built-in hull module, never an optional-internal choice', () => {
    // The registry files the hatch under the `internal` category, which an unrestricted
    // optional mount would otherwise accept. It arrives with the hull, no station sells
    // it, and the fixed `CargoHatch` mount is the only one that holds it — so no mount
    // an editor can set accepts it.
    const hatch = mod('ModularCargoBayDoor', INTERNAL_MODULES);
    assert.equal(hatch.familyId, 'cargoHatches');
    for (const ship of ['SideWinder', 'Anaconda', 'PantherMkII']) {
        const build = ShipLoadout.empty(ship);
        for (const slot of build.slots()) {
            assert.ok(
                !build.modulesForSlot(slot.key).some((m) => m.symbol === hatch.symbol),
                `${ship} ${slot.key} offers the cargo hatch`,
            );
            assert.throws(
                () => build.setModule(slot.key, hatch),
                LoadoutEditError,
                `${ship} ${slot.key} accepts the cargo hatch`,
            );
        }
    }
    // A mount that offers nothing would satisfy the loop above, so pin that the offer it
    // was filtered out of is still a full one.
    assert.ok(ShipLoadout.empty('Anaconda').modulesForSlot('Slot01_Size7').length > 100);
    // The rule is the article's identity, not a field a caller can restate: `setModule`
    // checks the symbol against the catalogue, so reading the symbol is what makes the
    // refusal hold for an adjusted record too.
    assert.throws(
        () =>
            ShipLoadout.empty('Anaconda').setModule('Slot01_Size7', {
                ...hatch,
                familyId: 'cargoRacks',
            }),
        LoadoutEditError,
    );
    assert.doesNotThrow(() =>
        ShipLoadout.empty('Anaconda').setModule('Slot01_Size7', {
            ...mod('Int_CargoRack_Size7_Class1', INTERNAL_MODULES),
            familyId: 'cargoHatches',
        }),
    );
    // The refusal names the article rather than the mount, so an editor can say why.
    try {
        ShipLoadout.empty('Anaconda').setModule('Slot01_Size7', hatch);
        assert.fail('expected the cargo hatch to be refused');
    } catch (error) {
        assert.ok(error instanceof LoadoutEditError);
        assert.equal(error.code, 'incompatibleModule');
        assert.equal(error.constraint, 'builtInHullModule');
        assert.match(error.message, /part of the hull, not an outfitting module/);
    }
    // The hull's own hatch is untouched by the rule that refuses the article elsewhere,
    // hull-specific hatch symbols included: `isBuiltInHullModule` short-circuits the
    // whole import walk for the hatch mount, and the fit rules never see it.
    for (const ship of ['Anaconda', 'FerDeLance']) {
        const stock = ShipLoadout.default(ship);
        assert.equal(stock.validation().valid, true, ship);
        assert.ok(stock.fittedModuleAt('CargoHatch')?.symbol.startsWith('ModularCargoBayDoor'));
        assert.equal(stock.repairFixedMount('CargoHatch').status, 'unchanged', ship);
    }
});

test('a capture that puts the cargo hatch in an optional mount is reported, not silently kept', () => {
    // The hatch resolves, so import leaves it where the capture put it: an optional mount
    // can legally stand empty, which makes a bad article there the caller's to see and
    // remove. Validation is what says the ship cannot exist.
    const build = ShipLoadout.fromLoadout({
        event: 'Loadout',
        Ship: 'Anaconda',
        Modules: [
            { Slot: 'CargoHatch', Item: 'ModularCargoBayDoor' },
            { Slot: 'Slot01_Size7', Item: 'ModularCargoBayDoor' },
        ],
    } as unknown as LoadoutEvent);
    // The capture names two mounts, so every other stocked mount is defaulted; what
    // matters here is that the optional mount is left exactly as the capture had it.
    assert.deepEqual(
        build.importOutcomes.filter((outcome) => outcome.slot === 'Slot01_Size7'),
        [],
    );
    assert.equal(build.fittedModuleAt('Slot01_Size7')?.symbol, 'ModularCargoBayDoor');
    const validation = build.validation();
    assert.equal(validation.valid, false);
    const issue = validation.issues.find((candidate) => candidate.code === 'incompatibleModule');
    assert.equal(issue?.params?.constraint, 'builtInHullModule');
    assert.equal(issue?.slot, 'Slot01_Size7');
    // The mount is ordinary, so the article comes out and the build is valid again.
    assert.equal(build.removeModule('Slot01_Size7').validation().valid, true);

    // The same capture under a hull family's own hatch symbol is emptied on import
    // instead, as an uncatalogued symbol rather than as a hatch; `operations.jsonc` pins
    // both halves language-neutrally.
});

test('fit checks use restrictions carried by caller-supplied module records', () => {
    // The laser is catalogued and fits a Sidewinder; the supplied record's restriction
    // is what turns it away, so the rule is reading the record and not the catalogue.
    const restricted: OutfittingModule = {
        ...mod('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES),
        restrictedToShips: ['Explorer_NX'],
    };
    assert.doesNotThrow(() =>
        ShipLoadout.empty('SideWinder').setModule(
            'SmallHardpoint1',
            mod('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES),
        ),
    );
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
    const before = BuildMetrics.of(build).frameShiftDrive().optMass;
    assert.equal(before, 4670); // base optimal mass

    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
        grade: 5,
        quality: 1,
        experimentalEffectSymbol: 'special_fsd_heavy',
    });

    // The exact figures the real Deep Black export carries.
    const fsd = BuildMetrics.of(build).frameShiftDrive();
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
                : { experimentalEffectSymbol: engineering.ExperimentalEffect }),
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
            .some(({ blueprintSymbol }) => blueprintSymbol === 'CargoRack_IncreasedCapacity'),
        false,
    );
    assert.throws(
        () => build.applyBlueprint(slot, 'CargoRack_IncreasedCapacity', { grade: 5 }),
        /not offered/,
    );

    const variant = getPreEngineeredVariants('Int_CargoRack_Size5_Class1').find(
        (candidate) => candidate.blueprintSymbol === 'CargoRack_IncreasedCapacity',
    )!;
    assert.equal(getPreEngineeredStats(variant)?.cargoCapacity, 43);
    const reward = ShipLoadout.empty('Python').setPreEngineeredVariant(slot, variant);
    assert.equal(reward.cargoCapacity, 43);
    assert.equal(reward.fittedModuleAt(slot)?.preEngineeredVariant?.acquisition, 'communityGoal');
});

test('applyBlueprint validates the slot, blueprint and experimental', () => {
    const build = ShipLoadout.empty('Anaconda');
    // empty slot — a fresh build's open mounts are the ones a commander outfits
    assert.throws(
        () => build.applyBlueprint('Slot01_Size7', 'FSD_LongRange', { grade: 5 }),
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
                experimentalEffectSymbol: 'special_nope',
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
                experimentalEffectSymbol: 'special_shieldbooster_toughened',
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
                experimentalEffectSymbol: 'e'.repeat(20_000),
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
            .some((blueprint) => blueprint.blueprintSymbol === 'Weapon_Overcharged'),
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
            experimentalEffectSymbol: 'special_high_yield_shell',
        },
        {
            symbol: 'Hpt_PulseLaserBurst_Fixed_Small',
            experimentalEffectSymbol: 'special_distortion_field',
        },
        {
            symbol: 'Hpt_DumbfireMissileRack_Fixed_Small',
            experimentalEffectSymbol: 'special_overload_munitions',
        },
    ] as const;
    const expected = engineeringFixture.experimentalDamageDistributions.map;

    for (const { symbol, experimentalEffectSymbol } of cases) {
        const build = ShipLoadout.empty('Sidewinder').setModule(
            'SmallHardpoint1',
            mod(symbol, HARDPOINT_MODULES),
        );
        build.applyBlueprint('SmallHardpoint1', 'Weapon_Sturdy', {
            grade: 5,
            experimentalEffectSymbol,
        });

        const fitted = build.fittedModuleAt('SmallHardpoint1')!;
        assert.deepEqual(
            fitted.effectiveStats?.damageDistribution,
            expected[experimentalEffectSymbol],
        );
        const metrics = BuildMetrics.of(build).weaponMetrics().weapons[0]!.metrics;
        for (const [type, share] of Object.entries(expected[experimentalEffectSymbol])) {
            assert.ok(
                near(
                    metrics.damageByType[type as 'kinetic' | 'thermal' | 'explosive'],
                    metrics.damagePerSecond * share,
                    1e-6,
                ),
                `${experimentalEffectSymbol} ${type}`,
            );
        }

        const modifiers = fitted.engineering?.Modifiers ?? [];
        for (const type of Object.keys(expected[experimentalEffectSymbol])) {
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

        const weapon = BuildMetrics.of(build).weaponMetrics().weapons[0]!.metrics;
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
        experimentalEffectSymbol: 'special_distortion_field',
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
        experimentalEffectSymbol: 'special_high_yield_shell',
    });

    const effective = build.fittedModuleAt('SmallHardpoint1')!.effectiveStats!;
    assert.equal(effective.damageComponents, undefined);
    assert.deepEqual(
        effective.damageDistribution,
        engineeringFixture.experimentalDamageDistributions.map.special_high_yield_shell,
    );

    const metrics = BuildMetrics.of(build).weaponMetrics().weapons[0]!.metrics;
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
            .some((blueprint) => blueprint.blueprintSymbol === 'HullReinforcement_Advanced'),
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
            .some((blueprint) => blueprint.blueprintSymbol === 'HatchBreakerLimpet_LightWeight'),
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
            build
                .availableBlueprints(slot)
                .some(({ blueprintSymbol }) => blueprintSymbol === capability.offeredAs),
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
                experimentalEffectSymbol: 'special_powerplant_lightweight',
            }),
        /is not offered experimental effect "special_powerplant_lightweight"; it takes no experimental effect/,
    );
    assert.ok(
        ShipLoadout.empty('Anaconda')
            .setModule('PowerPlant', mod('Int_Powerplant_Size7_Class5'))
            .applyBlueprint('PowerPlant', 'PowerPlant_Armoured', {
                grade: 1,
                experimentalEffectSymbol: 'special_powerplant_lightweight',
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
    assert.equal(sold?.blueprintSymbol, climb.blueprint);
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
            [{ blueprintSymbol: blueprint, grades: [2, 3, 4, 5], route: 'mercenary' }],
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
        assert.equal(mercenary.blueprintSymbol, blueprint, symbol);
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
    for (const blueprint of ['GuardianModule_Sturdy', variant.blueprintSymbol]) {
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
            () => build.applyBlueprint('MediumHardpoint1', variant.blueprintSymbol, { grade: 5 }),
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
        build.availableBlueprints('MediumHardpoint1').map((blueprint) => blueprint.blueprintSymbol),
        ['GuardianModule_Sturdy'],
    );
});

test('clearEngineering restores base stats', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
    const engineered = BuildMetrics.of(build).frameShiftDrive().optMass;
    build.clearEngineering('FrameShiftDrive');
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.engineering, undefined);
    assert.ok(BuildMetrics.of(build).frameShiftDrive().optMass < engineered); // back to base 1800
    assert.equal(BuildMetrics.of(build).frameShiftDrive().optMass, 1800);
});

test('clearing a fixed festive variant restores its stock module stats', () => {
    const expected = preEngineeredFixture.festive;
    const variant = getPreEngineeredVariants(expected.symbol).find(
        (candidate) => candidate.blueprintSymbol === expected.blueprints[0],
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
        (candidate) => candidate.blueprintSymbol === 'FSD_LongRange',
    )!;
    const resolved = getPreEngineeredStats(variant)!;
    assert.equal(resolved.mass, 26);
    assert.equal(resolved.optMass, 1785);

    const build = ShipLoadout.empty('Anaconda').setModule('FrameShiftDrive', resolved);
    const fitted = build.fittedModuleAt('FrameShiftDrive')!;
    assert.equal(fitted.stats?.mass, 26);
    assert.equal(fitted.effectiveStats?.optMass, 1785);
    // 1020 t stock Anaconda, less its 40 t stock drive, plus the fitted 26 t V1.
    assert.equal(build.unladenMass, 1006);
    assert.equal(BuildMetrics.of(build).frameShiftDrive().optMass, 1785);

    // Fitting snapshots the supplied record; later caller mutation cannot change a build.
    (resolved as { mass?: number }).mass = 999;
    assert.equal(build.unladenMass, 1006);
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
    assert.equal(drive.module?.symbol, 'Int_Hyperdrive_Size6_Class1');

    const drives = conda.modulesForSlot(drive.key);
    assert.ok(drives.length > 0 && drives.every((m) => m.class <= 6));

    conda.setModule(drive.key, mod('Int_Hyperdrive_Size6_Class5'));
    const fitted = conda.fittedModuleAt(drive.key)!;
    assert.equal(
        drive.module?.symbol,
        'Int_Hyperdrive_Size6_Class1',
        'the earlier snapshot does not change',
    );
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
    assert.equal(conda.fittedModules().length, 9);
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
        experimentalEffectSymbol: 'special_fsd_heavy',
    });
    const engineered = build.fittedModuleAt(slot.key)!;
    assert.ok(Math.abs(BuildMetrics.of(build).frameShiftDrive().optMass - 7528.04) < 1e-2);
    assert.equal(stock.engineering, undefined);
    assert.equal(engineered.engineering?.BlueprintName, 'FSD_LongRange');

    build.clearEngineering(slot.key);
    assert.equal(build.fittedModuleAt(slot.key)?.engineering, undefined);
    assert.equal(BuildMetrics.of(build).frameShiftDrive().optMass, 4670); // base
});

test('availableBlueprints / availableExperimentalEffects answer available engineering', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'FrameShiftDrive',
        mod('Int_Hyperdrive_Size6_Class5'),
    );
    const blueprints = build.availableBlueprints('FrameShiftDrive');
    const longRange = blueprints.find((b) => b.blueprintSymbol === 'FSD_LongRange');
    assert.ok(longRange, 'FSD_LongRange should be offered on an FSD');
    assert.deepEqual([...longRange!.grades], [1, 2, 3, 4, 5]);
    assert.equal(longRange!.route, 'ordinary');
    // No armour recipe leaks onto a frame shift drive.
    assert.ok(!blueprints.some((b) => b.blueprintSymbol.toLowerCase().startsWith('armour_')));

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
    const listed = build.fittedModules();
    assert.equal(listed.length, 10); // the nine stock fixed mounts and the fitted tank
    assert.deepEqual(
        listed.filter((module) => module.slot === 'CargoHatch' || module.slot === 'Slot01_Size7'),
        [hatch, snapshot],
    );
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
        BuildMetrics.of(build).weaponMetrics().total.damagePerSecond +
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
        const actual = BuildMetrics.of(
            ShipLoadout.fromLoadout(event as LoadoutEvent),
        ).mobilityMetricsResult().value;
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

    assert.equal(displayed(BuildMetrics.of(build).jumpRange(), 2), expected.jumpRange.fullTank);

    const installedPowerBuild = withAllModulesEnabled(corvetteBeamsJournal as LoadoutEvent);
    const power = BuildMetrics.of(installedPowerBuild).powerBudget();
    assert.equal(displayed(power.available, 1), expected.power.available);
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = BuildMetrics.of(installedBuild).weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    assert.equal(displayed(weapons.total.thermalLoad, 1), expected.offense.thermalLoad);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 2), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = BuildMetrics.of(installedBuild).weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 0), expected.power.retracted);
    assert.equal(displayed(power.deployed, 0), expected.power.deployed);

    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.damagePerSecond, 0), expected.offense.damagePerSecond);
    assert.equal(displayed(panel.distributorDraw, 0), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 0), expected.offense.thermalLoad);

    const mobility = BuildMetrics.of(build).mobilityMetricsResult().value!;
    assert.equal(displayed(mobility.speed, 0), expected.speed.top);
    assert.equal(displayed(mobility.boost, 0), expected.speed.boost);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    assert.equal(displayed(BuildMetrics.of(build).thrusters()!.maxMass, 1), expected.mass.maximum);
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.damagePerSecond, 1), expected.offense.damagePerSecond);
    assert.equal(displayed(panel.distributorDraw, 2), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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

    const currentMass = BuildMetrics.of(build).buildMass().total + fuel.reserve;
    // Frontier's float32 total lies 0.000024 t over the half-tenth boundary but its
    // statistics panel displays the lower tenth.
    assert.ok(Math.abs(currentMass - expected.mass.current) <= 0.0501, `${currentMass}`);
    assert.equal(BuildMetrics.of(build).thrusters()!.maxMass, expected.mass.maximum);
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = BuildMetrics.of(installedBuild).weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    assert.equal(BuildMetrics.of(build).thrusters()!.maxMass, expected.mass.maximum);
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 1), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.damagePerSecond, 0), expected.offense.damagePerSecond);
    assert.equal(displayed(panel.distributorDraw, 0), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    assert.equal(BuildMetrics.of(build).thrusters()!.maxMass, expected.mass.maximum);
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 1), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = BuildMetrics.of(installedBuild).weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    assert.equal(BuildMetrics.of(build).thrusters()!.maxMass, expected.mass.maximum);
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = BuildMetrics.of(installedBuild).weaponMetrics();
    assert.equal(displayed(weapons.total.damagePerSecond, 1), expected.offense.damagePerSecond);
    const panel = offensePanelTotals(installedBuild);
    assert.equal(displayed(panel.distributorDraw, 1), expected.offense.distributorDraw);
    assert.equal(displayed(panel.thermalLoad, 1), expected.offense.thermalLoad);

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    assert.equal(BuildMetrics.of(build).thrusters()!.maxMass, expected.mass.maximum);
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
        displayed(BuildMetrics.of(build).jumpRange({ fuel: fuel.main, cargo: fuel.reserve }), 2),
        expected.jumpRange.fullTank,
    );

    const installedBuild = withAllModulesEnabled(event);
    const power = BuildMetrics.of(installedBuild).powerBudget();
    assert.equal(expected.power.includesDisabledModules, true);
    assert.equal(displayed(power.available, 2), expected.power.available);
    assert.equal(displayed(power.retracted, 2), expected.power.retracted);
    assert.equal(displayed(power.deployed, 2), expected.power.deployed);

    const weapons = BuildMetrics.of(installedBuild).weaponMetrics();
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
    assert.equal(BuildMetrics.of(build).shieldMetricsResult().value, null);

    assert.equal(
        displayed(BuildMetrics.of(build).buildMass().total + fuel.reserve, 1),
        expected.mass.current,
    );
    assert.equal(BuildMetrics.of(build).thrusters()!.maxMass, expected.mass.maximum);
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
    assert.equal(drive.preEngineeredVariant?.experimentalEffectSymbol, undefined);
    assert.equal(drive.engineering?.ExperimentalEffect, 'special_fsd_heavy');
    assert.equal(drive.stats?.optMass, 5100);
    assert.equal(drive.effectiveStats?.optMass, 5304);
});

test('a re-derived export resolves its V1 drive, so the editor can still engineer it', () => {
    // EDSY stores each modifier and recomputes the value from the stock stat, so this
    // capture's figures miss Frontier's own by more than a float32 does: 2.000122 s of
    // boot time against 2. Unresolved, the drive reads as an ordinary Long Range roll and
    // every engineering edit on it is refused.
    const build = ShipLoadout.fromSlef(edsyAnacondaCapture);
    const drive = build.fittedModuleAt('FrameShiftDrive')!;
    assert.equal(drive.preEngineeredVariant?.acquisition, 'techBroker');
    assert.equal(drive.stats?.optMass, 3400);
    assert.equal(drive.effectiveStats?.optMass, 3536.025391);
    assert.ok(
        near(
            BuildMetrics.of(build).maxJumpRange(),
            edsyAnacondaCapture[0]!.data.MaxJumpRange,
            1e-5,
        ),
        `got ${BuildMetrics.of(build).maxJumpRange()}`,
    );
    assert.equal(
        build.setExperimentalEffect('FrameShiftDrive', 'special_fsd_fuelcapacity').kind,
        'updated',
    );
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
    assert.equal(
        rail.preEngineeredVariant?.experimentalEffectSymbol,
        'special_feedback_cascade_cooled',
    );
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
    const budget = BuildMetrics.of(ShipLoadout.fromSlef(slefString)).powerBudget();
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
    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
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
    const armour = BuildMetrics.of(build).armourMetrics()!;
    assert.ok(near(armour.hitPoints, metrics.deepBlack.armour.hitPoints), `${armour.hitPoints}`);
    assert.ok(near(armour.hitPoints, 345 * 2.376));
    assert.deepEqual(rounded(armour.resistances), metrics.deepBlack.armour.resistances);
    assert.deepEqual(
        rounded(armour.effectiveHitPoints),
        metrics.deepBlack.armour.effectiveHitPoints,
    );
    assert.equal(
        BuildMetrics.of(build).weaponMetrics().weapons.length,
        metrics.deepBlack.weaponCount,
    );
});

test('an assembled Anaconda reproduces the fixture metrics', () => {
    const build = fixtureAnaconda();
    const expectedBuild = metrics.anaconda;

    const budget = BuildMetrics.of(build).powerBudget();
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

    const shields = BuildMetrics.of(build).shieldMetricsResult().value!;
    assert.ok(near(shields.strength, expectedBuild.shields.strength));
    assert.ok(near(shields.generator, expectedBuild.shields.generator));
    assert.ok(near(shields.boosters, expectedBuild.shields.boosters));
    assert.ok(near(shields.boostMultiplier, expectedBuild.shields.boostMultiplier));
    assert.deepEqual(rounded(shields.resistances), expectedBuild.shields.resistances);
    assert.deepEqual(rounded(shields.effectiveHitPoints), expectedBuild.shields.effectiveHitPoints);
    assert.deepEqual(
        rounded(BuildMetrics.of(build).shieldCapacitorMetricsResult().value!.effectiveResistances),
        expectedBuild.shields.resistancesAtFourPips,
    );

    const armour = BuildMetrics.of(build).armourMetrics()!;
    assert.ok(near(armour.hitPoints, expectedBuild.armour.hitPoints));
    assert.ok(near(armour.bulkheads, expectedBuild.armour.bulkheads));
    assert.ok(near(armour.reinforcement, expectedBuild.armour.reinforcement));
    assert.deepEqual(rounded(armour.resistances), expectedBuild.armour.resistances);
    assert.deepEqual(rounded(armour.effectiveHitPoints), expectedBuild.armour.effectiveHitPoints);
    // The module reinforcement package protects the modules, not the hull.
    assert.ok(near(armour.moduleArmour, expectedBuild.armour.moduleArmour));
    assert.ok(near(armour.moduleProtection, expectedBuild.armour.moduleProtection));

    const weapons = BuildMetrics.of(build).weaponMetrics();
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
    const rated = BuildMetrics.of(build).weaponsCapacitorMetrics();
    const halfPips = BuildMetrics.of(build).weaponsCapacitorMetrics({ weaponsPips: 2 });
    const distributor = build.fittedModuleAt('PowerDistributor')!.effectiveStats!;

    assert.equal(rated.capacity, distributor.weaponsCapacity);
    assert.equal(rated.rechargeRate, distributor.weaponsRecharge);
    assert.equal(
        rated.sustainedEnergyPerSecond,
        BuildMetrics.of(build).weaponMetrics().total.sustainedEnergyPerSecond,
    );
    assert.ok(halfPips.rechargeRate < rated.rechargeRate);
    assert.ok(halfPips.netDrainRate >= rated.netDrainRate);
    assert.throws(() => BuildMetrics.of(build).weaponsCapacitorMetrics({ weaponsPips: 5 }), {
        name: 'RangeError',
        message:
            'BuildMetrics.weaponsCapacitorMetrics: weaponsPips must be a finite number from 0 to 4',
    });
});

test('distributorMetricsResult reports every fitted capacitor at its selected pips', () => {
    const build = ShipLoadout.fromLoadout(corvetteBeamsJournal as LoadoutEvent);
    const distributor = build.fittedModuleAt('PowerDistributor')!.effectiveStats!;
    const rated = BuildMetrics.of(build).distributorMetricsResult().value!;
    const halfPips = BuildMetrics.of(build).distributorMetricsResult({
        systemsPips: 2,
        enginesPips: 2,
        weaponsPips: 2,
    }).value!;

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
    assert.throws(() => BuildMetrics.of(build).distributorMetricsResult({ enginesPips: 5 }).value, {
        name: 'RangeError',
        message:
            'BuildMetrics.distributorMetricsResult: enginesPips must be a finite number from 0 to 4',
    });
});

test('distributorMetricsResult returns a null value without a powered distributor', () => {
    // Every build mounts a distributor, so only switching it off answers `null`.
    const off = ShipLoadout.default('Anaconda').setModuleEnabled('PowerDistributor', false);
    assert.equal(BuildMetrics.of(off).distributorMetricsResult().value, null);
});

test('weaponsCapacitorMetrics excludes modules shed with hardpoints deployed', () => {
    const starved = ShipLoadout.fromLoadout(corvetteBeamsJournal as LoadoutEvent).setModule(
        'PowerPlant',
        getModuleBySymbol(heatFixture.unpowered.powerPlant, CORE_MODULES)!,
    );
    assert.ok(
        BuildMetrics.of(starved)
            .powerBudget()
            .bands.every((band) => !band.poweredDeployed),
    );
    assert.deepEqual(BuildMetrics.of(starved).weaponsCapacitorMetrics(), {
        weaponsPips: 4,
        capacity: 0,
        rechargeRate: 0,
        sustainedEnergyPerSecond: 0,
        netDrainRate: 0,
        timeToDrain: Infinity,
    });
    assert.equal(BuildMetrics.of(starved).distributorMetricsResult().value, null);
});

test('a hull with no shield generator reports no shields', () => {
    const build = ShipLoadout.empty('Anaconda').setModule(
        'PowerPlant',
        mod('Int_Powerplant_Size8_Class5'),
    );
    assert.equal(BuildMetrics.of(build).shieldMetricsResult().value, null);
    // ...but still has the armour it left the shipyard with.
    assert.equal(BuildMetrics.of(build).armourMetrics()!.hitPoints, 945);
});

test('switched-off modules drop out of every metric', () => {
    const build = fixtureAnaconda();
    const lit = BuildMetrics.of(build).weaponMetrics().total.damagePerSecond;
    const shielded = BuildMetrics.of(build).shieldMetricsResult().value!.strength;

    const off = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: build.fittedModules().map(({ raw }) => ({ ...raw, On: false })),
    });
    assert.equal(BuildMetrics.of(off).shieldMetricsResult().value, null); // the generator is off
    assert.equal(BuildMetrics.of(off).powerBudget().available, 0); // so is the plant
    assert.equal(BuildMetrics.of(off).weaponMetrics().total.damagePerSecond, 0);
    assert.equal(BuildMetrics.of(off).weaponsCapacitorMetrics().capacity, 0);
    assert.equal(BuildMetrics.of(off).weaponsCapacitorMetrics().rechargeRate, 0);
    assert.equal(BuildMetrics.of(off).weaponsCapacitorMetrics().timeToDrain, Infinity);
    // The weapons are still listed, with their own figures intact.
    assert.equal(BuildMetrics.of(off).weaponMetrics().weapons.length, 2);
    assert.ok(
        BuildMetrics.of(off)
            .weaponMetrics()
            .weapons.every((w) => !w.enabled),
    );
    assert.ok(lit > 0 && shielded > 0);
});

test('engineering moves the metrics it should', () => {
    const build = fixtureAnaconda();
    const before = BuildMetrics.of(build).shieldMetricsResult().value!;
    build.applyBlueprint('Slot01_Size7', 'ShieldGenerator_Reinforced', { grade: 5 });
    const after = BuildMetrics.of(build).shieldMetricsResult().value!;
    assert.ok(after.strength > before.strength, `${before.strength} -> ${after.strength}`);

    const bareArmour = BuildMetrics.of(build).armourMetrics()!.hitPoints;
    build.applyBlueprint('Armour', 'Armour_HeavyDuty', { grade: 5 });
    const heavyArmour = BuildMetrics.of(build).armourMetrics()!;
    // Heavy Duty compounds on the armour multiplier: x3.5 becomes x4.62.
    assert.ok(near(heavyArmour.bulkheads, 525 * 4.62));
    assert.ok(heavyArmour.hitPoints > bareArmour);
    // It stiffens the resistances too.
    assert.ok(heavyArmour.resistances.kinetic > 0.26875);

    const weaponsBefore = BuildMetrics.of(build).weaponMetrics().total.damagePerSecond;
    build.applyBlueprint('LargeHardpoint1', 'Weapon_Overcharged', { grade: 5 });
    assert.ok(BuildMetrics.of(build).weaponMetrics().total.damagePerSecond > weaponsBefore);
});

test('jumpRangeSummary gathers the loads that matter', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const summary = BuildMetrics.of(build).jumpRangeSummary();
    assert.ok(near(summary.max, BuildMetrics.of(build).maxJumpRange()));
    assert.ok(near(summary.unladen, BuildMetrics.of(build).jumpRange()));
    assert.ok(near(summary.laden, BuildMetrics.of(build).ladenJumpRange()));
    assert.equal(summary.totalMax.jumps, expected.totalMaxJumps);
    assert.ok(near(summary.totalMax.range, expected.totalMaxRange));
    assert.ok(near(summary.totalMax.range, summary.max));
    assert.deepEqual(summary.totalUnladen, BuildMetrics.of(build).totalRange());
    assert.deepEqual(
        summary.totalLaden,
        BuildMetrics.of(build).totalRange({ cargo: build.cargoCapacity! }),
    );
    // Best single jump beats a full tank, which beats a full tank and a full hold.
    assert.ok(summary.max > summary.unladen);
    assert.ok(summary.unladen > summary.laden);
    assert.ok(summary.totalUnladen.range > summary.totalLaden.range);
    // A partial load sits between the two.
    const partial = BuildMetrics.of(build).jumpRange({ cargo: build.cargoCapacity! / 2 });
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
    const stockMass = ShipLoadout.empty('Anaconda').unladenMass!;
    const build = ShipLoadout.empty('Anaconda').setModule(
        'Slot01_Size7',
        mod('Int_DroneControl_ResourceSiphon', INTERNAL_MODULES),
    );
    assert.equal(build.unladenMass, stockMass);
    // Its sized siblings all carry one, so the same build with any of them answers.
    build.setModule(
        'Slot01_Size7',
        mod('Int_DroneControl_ResourceSiphon_Size1_Class1', INTERNAL_MODULES),
    );
    assert.ok(build.unladenMass! > stockMass);
});

test('always-powered utility modules draw with the hardpoints stowed', () => {
    const bare = ShipLoadout.empty('Anaconda').setModule(
        'PowerPlant',
        mod('Int_Powerplant_Size8_Class5'),
    );
    const build = ShipLoadout.empty('Anaconda')
        .setModule('PowerPlant', mod('Int_Powerplant_Size8_Class5'))
        .setModule('TinyHardpoint1', mod('Hpt_ShieldBooster_Size0_Class5', UTILITY_MODULES))
        .setModule('TinyHardpoint2', mod('Hpt_CrimeScanner_Size0_Class5', UTILITY_MODULES));
    const budget = BuildMetrics.of(build).powerBudget();
    const stock = BuildMetrics.of(bare).powerBudget().retracted;
    const booster = mod('Hpt_ShieldBooster_Size0_Class5', UTILITY_MODULES);
    const scanner = mod('Hpt_CrimeScanner_Size0_Class5', UTILITY_MODULES);
    // The shield booster is always powered; the kill warrant scanner is not.
    assert.ok(near(budget.retracted, stock + booster.powerDraw!));
    assert.ok(near(budget.deployed, stock + booster.powerDraw! + scanner.powerDraw!));
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
    const budget = BuildMetrics.of(build).powerBudget();
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
    assert.equal(BuildMetrics.of(build).shieldMetricsResult().value!.strength, 0);
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
    const armour = BuildMetrics.of(build).armourMetrics()!;
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
    const before = BuildMetrics.of(build).weaponMetrics().total.damagePerSecond;
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
    const after = BuildMetrics.of(build).weaponMetrics();
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
    const stock = BuildMetrics.of(build).weaponMetrics().weapons[0]!;
    assert.equal(stock.maximumRange, 3000);
    assert.equal(stock.falloffRange, 500);
    assert.equal(stock.armourPiercing, 20);

    build.applyBlueprint(stock.slot, 'Weapon_LongRange', { grade: 5 });
    const engineered = BuildMetrics.of(build).weaponMetrics().weapons[0]!;
    assert.equal(engineered.maximumRange, 6000);
    assert.equal(engineered.falloffRange, 6000);

    const projectile = BuildMetrics.of(
        ShipLoadout.empty('Anaconda').setModule(
            'MediumHardpoint1',
            mod('Hpt_ATDumbfireMissile_Fixed_Medium', HARDPOINT_MODULES),
        ),
    ).weaponMetrics().weapons[0]!;
    assert.deepEqual(projectile.projectileRange, {
        maximumBoundary: 0,
        falloffBoundary: 100000,
    });

    const laser = BuildMetrics.of(
        ShipLoadout.empty('SideWinder').setModule(
            'SmallHardpoint1',
            mod('Hpt_BeamLaser_Fixed_Small', HARDPOINT_MODULES),
        ),
    ).weaponMetrics().weapons[0]!;
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
        BuildMetrics.of(build)
            .weaponMetrics()
            .weapons.map(({ slot }) => slot),
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
    assert.ok(
        build.availableBlueprints(gun.slot).some((b) => b.blueprintSymbol === 'Weapon_RapidFire'),
    );

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
    assert.ok(BuildMetrics.of(build).weaponMetrics().total.damagePerSecond > 0);
});

test('a festive pre-engineered variant changes only its slot and round-trips', () => {
    const expected = preEngineeredFixture.festive;
    const variant = getPreEngineeredVariants(expected.symbol).find(
        (candidate) => candidate.blueprintSymbol === expected.blueprints[1],
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
        BlueprintName: variant.blueprintSymbol,
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
    assert.equal(reimported.preEngineeredVariant?.blueprintSymbol, variant.blueprintSymbol);
});

test('a graded pre-engineered variant fits with its complete engineering state', () => {
    const expected = preEngineeredFixture.resolved.fsdV1Size5;
    const variant = getPreEngineeredVariants(expected.symbol).find(
        (candidate) =>
            candidate.blueprintSymbol === expected.blueprintSymbol &&
            candidate.acquisition === 'techBroker',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('FrameShiftDrive', variant);

    const fitted = build.fittedModuleAt('FrameShiftDrive')!;
    assert.deepEqual(fitted.engineering, {
        BlueprintName: variant.blueprintSymbol,
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
            candidate.blueprintSymbol === 'FSD_LongRange' && candidate.acquisition === 'techBroker',
    )!;
    const fixed = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('FrameShiftDrive', variant);
    const imported = ShipLoadout.fromLoadout(fixed.toLoadoutEvent());
    const fromStock = ShipLoadout.empty('Anaconda')
        .setModule('FrameShiftDrive', mod(variant.symbol, CORE_MODULES))
        .applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
            grade: 5,
            experimentalEffectSymbol: 'special_fsd_heavy',
        });

    for (const replacement of [fixed, imported]) {
        replacement.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
            grade: 5,
            experimentalEffectSymbol: 'special_fsd_heavy',
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
        previousExperimentalEffectSymbol: null,
        experimentalEffectSymbol: 'special_fsd_heavy',
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
        previousExperimentalEffectSymbol: 'special_fsd_heavy',
        experimentalEffectSymbol: 'special_fsd_lightweight',
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
        previousExperimentalEffectSymbol: 'special_fsd_lightweight',
        experimentalEffectSymbol: null,
    });
    assert.equal(
        build.fittedModuleAt('FrameShiftDrive')!.effectiveStats!.optMass,
        fixedOptimalMass,
    );
    assert.equal(build.fittedModuleAt('FrameShiftDrive')!.preEngineeredVariant, variant);
    assert.deepEqual(build.setExperimentalEffect('FrameShiftDrive', null), {
        kind: 'unchanged',
        experimentalEffectSymbol: null,
    });
});

test('fixed reward effect removal and replacement survive a loadout round trip', () => {
    const variant = getPreEngineeredVariants('Hpt_Slugshot_Gimbal_Large').find(
        (candidate) =>
            candidate.experimentalEffectSymbol === 'special_screening_shell' &&
            candidate.acquisition === 'communityGoal',
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
        (candidate) =>
            candidate.experimentalEffectSymbol === 'special_drag_munitions' &&
            candidate.acquisition !== 'mercenary',
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
        (candidate) =>
            candidate.experimentalEffectSymbol === 'special_incendiary_rounds' &&
            candidate.acquisition === 'techBroker',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('SmallHardpoint1', variant);

    assert.deepEqual(
        build.setExperimentalEffect('SmallHardpoint1', variant.experimentalEffectSymbol!),
        {
            kind: 'unchanged',
            experimentalEffectSymbol: variant.experimentalEffectSymbol,
        },
    );
    assert.equal(build.setExperimentalEffect('SmallHardpoint1', null).kind, 'updated');
    assert.equal(
        build.setExperimentalEffect('SmallHardpoint1', variant.experimentalEffectSymbol!).kind,
        'updated',
    );
});
test('a Merc article at its purchase grade refuses an effect edit losslessly', () => {
    // The counterpart of the test above: the same Mining Laser effect, on the Merc row
    // that is sold carrying it rather than the tech-broker article. Grade 1 is what the
    // purchase contains and the bespoke recipe starts at grade 2, so there is no recipe
    // to recompute from and the edit is refused — with the baked effect left intact.
    const merc = getPreEngineeredVariants('Hpt_MiningLaser_Fixed_Small').find(
        (candidate) => candidate.acquisition === 'mercenary',
    )!;
    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant('SmallHardpoint1', merc);
    const before = build.fittedModuleAt('SmallHardpoint1')!.effectiveStats!.thermalLoad;

    const removal = build.setExperimentalEffect('SmallHardpoint1', null);
    assert.equal(removal.kind, 'unsupported');
    assert.equal(removal.code, 'unsupportedEngineering');
    assert.equal(
        build.fittedModuleAt('SmallHardpoint1')!.engineering!.ExperimentalEffect,
        merc.experimentalEffectSymbol,
    );
    assert.equal(build.fittedModuleAt('SmallHardpoint1')!.effectiveStats!.thermalLoad, before);
    // Re-stating the effect it already carries is still the ordinary no-op.
    assert.deepEqual(
        build.setExperimentalEffect('SmallHardpoint1', merc.experimentalEffectSymbol!),
        { kind: 'unchanged', experimentalEffectSymbol: merc.experimentalEffectSymbol },
    );
});

test('a climbed Merc article refuses its out-of-menu baked effect, and does not throw', () => {
    // The Merc Mining Laser is sold carrying Incendiary Rounds, which its own module menu
    // does not offer. Above the purchase grade both entry points recompute through
    // `applyBlueprint`, which refuses an out-of-menu effect by throwing — so the baked
    // effect must not be waved past the menu gate here. Ordinary captured data reaches
    // this: a lossless refusal is the contract, an exception is not.
    const merc = getPreEngineeredVariants('Hpt_MiningLaser_Fixed_Small').find(
        (candidate) => candidate.acquisition === 'mercenary',
    )!;
    for (const level of [2, 3, 5]) {
        const build = ShipLoadout.fromLoadout({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'SmallHardpoint1',
                    Item: merc.symbol,
                    Engineering: {
                        BlueprintName: merc.blueprintSymbol,
                        Level: level,
                        Quality: 0.5,
                        ExperimentalEffect: merc.experimentalEffectSymbol!,
                    },
                },
            ],
        });
        const normalized = build.completeEngineeringGrade('SmallHardpoint1');
        assert.equal(normalized.kind, 'unsupported', `grade ${level}`);
        assert.equal(normalized.code, 'unsupportedExperimentalEffect', `grade ${level}`);

        // And the same effect asked for outright rather than reached by normalization.
        // The module's menu is empty, so there is no effect to step away to first: the
        // capture that reaches this states the climb without the effect, which is what a
        // player who dropped it on the way to grade 2 exports.
        const dropped = ShipLoadout.fromLoadout({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'SmallHardpoint1',
                    Item: merc.symbol,
                    Engineering: {
                        BlueprintName: merc.blueprintSymbol,
                        Level: level,
                        Quality: 0.5,
                    },
                },
            ],
        });
        const restated = dropped.setExperimentalEffect(
            'SmallHardpoint1',
            merc.experimentalEffectSymbol!,
        );
        assert.equal(restated.kind, 'unsupported', `grade ${level}`);
        assert.equal(restated.code, 'unsupportedExperimentalEffect', `grade ${level}`);
    }
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
            experimentalEffectSymbol: 'special_overload_munitions',
        });
    assert.equal(converted.setExperimentalEffect('MediumHardpoint1', null).kind, 'updated');

    const variant = getPreEngineeredVariants('Int_PowerDistributor_Size6_Class5').find(
        (candidate) => candidate.acquisition === 'mercenary',
    )!;
    const mercenary = ShipLoadout.empty('Anaconda')
        .setPreEngineeredVariant('PowerDistributor', variant)
        .applyBlueprint('PowerDistributor', variant.blueprintSymbol, { grade: 2, quality: 0.5 });
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
    assert.deepEqual(empty.setExperimentalEffect('Slot01_Size7', null), {
        kind: 'unsupported',
        code: 'emptySlot',
        params: { slot: 'Slot01_Size7' },
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

    // A cosmetic entry survives import as the capture stated it and has no catalogue
    // record, so it is the one fitted module engineering cannot reason about.
    const noRecord = ShipLoadout.fromLoadout({
        Ship: 'Anaconda',
        Modules: [{ Slot: 'PaintJob', Item: 'paintjob_anaconda_future' }],
    });
    for (const result of [
        noRecord.setExperimentalEffect('PaintJob', null),
        noRecord.completeEngineeringGrade('PaintJob'),
    ]) {
        assert.equal(result.kind, 'unsupported');
        assert.equal(result.code, 'unsupportedEngineering');
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
            blueprint: fixedVariant.blueprintSymbol,
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
        { grade: 5, quality: 0.42, experimentalEffectSymbol: 'special_fsd_heavy' },
    );
    const imported = ShipLoadout.fromLoadout(partial.toLoadoutEvent());
    const expected = ShipLoadout.default('SideWinder').applyBlueprint(
        'FrameShiftDrive',
        'FSD_LongRange',
        { grade: 5, quality: 1, experimentalEffectSymbol: 'special_fsd_heavy' },
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
        .applyBlueprint('PowerDistributor', variant.blueprintSymbol, { grade: 2, quality: 0.5 });
    assert.equal(mercenary.completeEngineeringGrade('PowerDistributor').kind, 'normalized');
    assert.equal(mercenary.fittedModuleAt('PowerDistributor')!.engineering!.Quality, 1);
    assert.equal(mercenary.fittedModuleAt('PowerDistributor')!.preEngineeredVariant, variant);

    const converted = ShipLoadout.empty('Anaconda')
        .setModule('MediumHardpoint1', mod('Hpt_BasicMissileRack_Fixed_Medium', HARDPOINT_MODULES))
        .applyBlueprint('MediumHardpoint1', 'Weapon_HighCapacity', {
            grade: 5,
            quality: 0.42,
            experimentalEffectSymbol: 'special_overload_munitions',
        });
    const importedConverted = ShipLoadout.fromLoadout(converted.toLoadoutEvent());
    assert.equal(importedConverted.completeEngineeringGrade('MediumHardpoint1').kind, 'normalized');
    assert.equal(importedConverted.fittedModuleAt('MediumHardpoint1')!.engineering!.Quality, 1);
});

test('an import rolls a completed roll that states no modifiers', () => {
    // The defect this pins: Inara states engineering identity only, and writes `Quality: 1`
    // for a finished roll. Left as stated, an armoured G5 plant kept its stock draw, so
    // the import rolls the recipe and completing the grade then finds nothing to do.
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    const stock = mod('Int_Powerplant_Size6_Class5');
    assert.ok(build.fittedModuleAt('PowerPlant')!.engineering!.Modifiers!.length > 0);
    assert.notEqual(build.fittedModuleAt('PowerPlant')!.effectiveStats!.integrity, stock.integrity);

    const expected = ShipLoadout.empty('LakonMiner')
        .setModule('PowerPlant', stock)
        .applyBlueprint('PowerPlant', 'PowerPlant_Armoured', {
            grade: 5,
            quality: 1,
            experimentalEffectSymbol: 'special_powerplant_cooled',
        });
    assert.deepEqual(
        build.fittedModuleAt('PowerPlant')!.effectiveStats,
        expected.fittedModuleAt('PowerPlant')!.effectiveStats,
    );
    assert.deepEqual(build.completeEngineeringGrade('PowerPlant'), { kind: 'unchanged' });

    // A stated array is the module's own record, so a completed roll keeps it untouched.
    const stated = ShipLoadout.fromLoadout(
        ShipLoadout.default('SideWinder')
            .applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5, quality: 1 })
            .toLoadoutEvent(),
    );
    assert.deepEqual(stated.completeEngineeringGrade('FrameShiftDrive'), { kind: 'unchanged' });
});

test('an article resolved from a bare identity is an article, not a new base', () => {
    // A community-goal cargo rack states its blueprint and no modifiers, and no ordinary
    // recipe of that rack answers to it, so the import fits the article. Every reader has
    // to see the same article: taken as the module's own base instead, its fixed capacity
    // would survive clearing the engineering and be folded in twice by the next recipe.
    const imported = (): ShipLoadout =>
        ShipLoadout.fromLoadout({
            Ship: 'PantherMkII',
            Modules: [
                {
                    Slot: 'Slot04_Size6',
                    Item: 'int_cargorack_size6_class1',
                    Engineering: {
                        BlueprintName: 'cargorack_increasedcapacity',
                        Level: 5,
                        Quality: 1,
                    },
                },
            ],
        });
    const build = imported();
    const fitted = build.fittedModuleAt('Slot04_Size6')!;
    assert.equal(fitted.preEngineeredVariant?.blueprintSymbol, 'CargoRack_IncreasedCapacity');
    assert.equal(fitted.preEngineeredVariant?.acquisition, 'communityGoal');
    assert.equal(fitted.effectiveStats?.cargoCapacity, 86);

    const cleared = imported();
    cleared.clearEngineering('Slot04_Size6');
    assert.equal(cleared.fittedModuleAt('Slot04_Size6')?.effectiveStats?.cargoCapacity, 64);

    // The Mercenary recipe this rack does offer rolls from the stock 64 t either way.
    const stock = ShipLoadout.fromLoadout({
        Ship: 'PantherMkII',
        Modules: [{ Slot: 'Slot04_Size6', Item: 'int_cargorack_size6_class1' }],
    }).applyBlueprint('Slot04_Size6', 'CargoRackS6C1_Extended', { grade: 2 });
    const rerolled = imported().applyBlueprint('Slot04_Size6', 'CargoRackS6C1_Extended', {
        grade: 2,
    });
    assert.deepEqual(
        rerolled.fittedModuleAt('Slot04_Size6')!.effectiveStats,
        stock.fittedModuleAt('Slot04_Size6')!.effectiveStats,
    );
    assert.equal(rerolled.fittedModuleAt('Slot04_Size6')?.effectiveStats?.cargoCapacity, 72);
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
    assert.deepEqual(empty.completeEngineeringGrade('Slot01_Size7'), {
        kind: 'unsupported',
        code: 'emptySlot',
        params: { slot: 'Slot01_Size7' },
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
                    BlueprintName: fixedVariant.blueprintSymbol,
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
        (candidate) =>
            candidate.experimentalEffectSymbol === 'special_incendiary_rounds' &&
            candidate.acquisition === 'techBroker',
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
        miningLance.experimentalEffectSymbol,
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
        BlueprintName: variant.blueprintSymbol,
        Level: variant.grade,
        Quality: 1,
    });
    assert.ok(!Object.hasOwn(fitted.engineering!, 'Modifiers'));
    assert.equal(fitted.preEngineeredVariant, variant);

    build.clearEngineering('PowerDistributor');
    assert.equal(build.fittedModuleAt('PowerDistributor')!.preEngineeredVariant, null);
});

test('a fitted Mercenary article publishes what its baked effect moves', () => {
    // Ten Merc-shop rows are sold carrying an experimental effect. Seven of those effects
    // move at least one stat, and a fitted article has to say so: reading the purchase
    // through `setPreEngineeredVariant` and reading the same catalogue row through
    // `getPreEngineeredJournalModifiers` describe one article, so they must agree.
    let withMovedStats = 0;
    for (const variant of PRE_ENGINEERED_MODULES.filter(
        (candidate) => candidate.acquisition === 'mercenary',
    )) {
        const build = ShipLoadout.empty('Anaconda');
        const slot = build
            .slots()
            .find((candidate) =>
                build
                    .modulesForSlot(candidate.key)
                    .some((module) => module.symbol.toLowerCase() === variant.symbol.toLowerCase()),
            )!.key;
        const expected = getPreEngineeredJournalModifiers(variant);
        const fitted = build.setPreEngineeredVariant(slot, variant).fittedModuleAt(slot)!;
        const label = `${variant.symbol} ${variant.blueprintSymbol}`;

        assert.equal(fitted.preEngineeredVariant, variant, label);
        if (expected.length === 0) {
            // No stat block and no effect that moves one: the article carries no
            // `Modifiers` key at all rather than an empty array claiming it changes none.
            assert.ok(!Object.hasOwn(fitted.engineering!, 'Modifiers'), label);
        } else {
            withMovedStats++;
            assert.deepEqual(fitted.engineering!.Modifiers, expected, label);
        }
    }
    assert.equal(withMovedStats, 7);
});

test('a fitted article resolves the rate of fire its own block states', () => {
    // `RateOfFire` is the one weapon figure no recipe names: the game derives it from the
    // firing cycle, and so does this library — once for the block a fitted module
    // publishes, and once for the stats it resolves. Deriving it twice is how one article
    // came to state one rate of fire and resolve another, so pin that the two are one
    // figure for every catalogued article, and that an article whose cycle nothing moved
    // keeps its catalogue cadence rather than acquiring a recomputed one.
    let stated = 0;
    let fittedCount = 0;
    for (const variant of PRE_ENGINEERED_MODULES) {
        const build = ShipLoadout.empty('Anaconda');
        const slot = build
            .slots()
            .find((candidate) =>
                build
                    .modulesForSlot(candidate.key)
                    .some((module) => module.symbol.toLowerCase() === variant.symbol.toLowerCase()),
            )?.key;
        if (slot === undefined) continue;
        fittedCount++;
        const fitted = build.setPreEngineeredVariant(slot, variant).fittedModuleAt(slot)!;
        const label = `${variant.symbol} ${variant.blueprintSymbol}`;
        const rate = fitted.engineering?.Modifiers?.find(
            (modifier) => modifier.Label === 'RateOfFire',
        );

        if (rate === undefined) {
            assert.equal(fitted.effectiveStats?.rateOfFire, fitted.stats?.rateOfFire, label);
            continue;
        }
        stated++;
        assert.equal(fitted.effectiveStats!.rateOfFire, rate.Value, label);
        // The resolved catalogue record answers the same, so a consumer that fits the
        // article and one that only asks the catalogue for it read one cadence.
        assert.equal(fitted.stats!.rateOfFire, rate.Value, label);
    }
    // Every catalogued article but one, whose hull class the Anaconda does not carry.
    assert.equal(fittedCount, PRE_ENGINEERED_MODULES.length - 1);
    assert.equal(stated, 15);
});

test('an applied burst recipe resolves the rate of fire its own block states', () => {
    // The same agreement on the ordinary route: Double Shot moves the burst interval and
    // never names a rate, so the block states a derived one and the stats beside it have
    // to land on that exact figure rather than on a second derivation of it.
    const build = ShipLoadout.empty('Anaconda')
        .setModule('LargeHardpoint1', getModuleBySymbol('Hpt_Slugshot_Gimbal_Large')!)
        .applyBlueprint('LargeHardpoint1', 'Weapon_DoubleShot', { grade: 5, quality: 1 });
    const fitted = build.fittedModuleAt('LargeHardpoint1')!;
    const rate = fitted.engineering!.Modifiers!.find(
        (modifier) => modifier.Label === 'RateOfFire',
    )!;

    assert.ok(rate.Value !== undefined);
    assert.notEqual(rate.Value, fitted.stats!.rateOfFire);
    assert.equal(fitted.effectiveStats!.rateOfFire, rate.Value);
    assert.equal(BuildMetrics.of(build).weaponMetrics().weapons[0]!.metrics.rateOfFire, rate.Value);
});

test('a partial capture cannot invent a rate of fire the weapon has no cycle for', () => {
    // A third-party block that moves a stat the module carries is kept as written, so a
    // burst label can arrive beside a weapon that has no firing cycle to rebuild. There
    // is nothing to derive there, and a beam laser fires continuously — so the rate stays
    // absent rather than becoming a number the capture never claimed.
    const beam = ShipLoadout.fromLoadout({
        Ship: 'krait_mkii',
        Modules: [
            {
                Slot: 'LargeHardpoint1',
                Item: 'Hpt_BeamLaser_Fixed_Large',
                Engineering: {
                    BlueprintName: 'Weapon_LightWeight',
                    Level: 1,
                    Quality: 1,
                    Modifiers: [
                        { Label: 'Mass', Value: 6.4, OriginalValue: 8 },
                        { Label: 'BurstSize', Value: 2, OriginalValue: 1 },
                    ],
                },
            },
        ],
    }).fittedModuleAt('LargeHardpoint1')!;

    assert.equal(beam.effectiveStats!.rateOfFire, undefined);

    // A within-burst rate of zero is no rate at all, so it falls back to one shot a
    // second exactly as `combinedRateOfFire` does — the two never disagree about the
    // same weapon.
    const rateFor = (burstRateOfFire: number): number | undefined =>
        ShipLoadout.fromLoadout({
            Ship: 'krait_mkii',
            Modules: [
                {
                    Slot: 'LargeHardpoint1',
                    Item: 'Hpt_Slugshot_Gimbal_Large',
                    Engineering: {
                        BlueprintName: 'Weapon_LightWeight',
                        Level: 1,
                        Quality: 1,
                        Modifiers: [
                            { Label: 'BurstInterval', Value: 0.1974, OriginalValue: 0.21 },
                            { Label: 'BurstSize', Value: 2, OriginalValue: 1 },
                            { Label: 'BurstRateOfFire', Value: burstRateOfFire, OriginalValue: 1 },
                        ],
                    },
                },
            ],
        }).fittedModuleAt('LargeHardpoint1')!.effectiveStats!.rateOfFire;

    assert.equal(rateFor(0), rateFor(1));
    assert.equal(rateFor(0), 1.670286);
});

test('completing a Merc article turns on whether it has a block to state', () => {
    // A completed roll that states its modifiers is already whole, and one that states
    // none is rolled from its recipe — but a Merc purchase grade is not in any recipe.
    // So the two halves of the shop answer differently, and each answer is the honest
    // one: the rows whose baked effect moves a stat arrive at quality 1 already stating
    // everything they move, while the rows that state nothing have nothing to roll.
    for (const variant of PRE_ENGINEERED_MODULES.filter(
        (candidate) => candidate.acquisition === 'mercenary',
    )) {
        const build = ShipLoadout.empty('Anaconda');
        const slot = build
            .slots()
            .find((candidate) =>
                build
                    .modulesForSlot(candidate.key)
                    .some((module) => module.symbol.toLowerCase() === variant.symbol.toLowerCase()),
            )!.key;
        build.setPreEngineeredVariant(slot, variant);
        const before = build.fittedModuleAt(slot)!.engineering;
        const result = build.completeEngineeringGrade(slot);
        const label = `${variant.symbol} ${variant.blueprintSymbol}`;

        if (getPreEngineeredJournalModifiers(variant).length > 0) {
            assert.deepEqual(result, { kind: 'unchanged' }, label);
        } else {
            assert.equal(result.kind, 'unsupported', label);
            assert.equal(result.code, 'unsupportedEngineering', label);
        }
        // Either way the article is left exactly as it was bought.
        assert.deepEqual(build.fittedModuleAt(slot)!.engineering, before, label);
        assert.equal(build.fittedModuleAt(slot)!.preEngineeredVariant, variant, label);
    }
});

test('a Mercenary article resolves the same through both of its reading paths', () => {
    // The fitted article and the same article reconstructed from its own exported block
    // must describe one module — including the published figure itself, which the
    // capture states and the import must not re-derive a hair away from.
    const variant = getPreEngineeredVariants('Hpt_Railgun_Fixed_Medium').find(
        (candidate) => candidate.acquisition === 'mercenary',
    )!;
    const fixture = preEngineeredFixture.mercenaryBakedEffects.resolved;
    assert.equal(variant.blueprintSymbol, fixture.blueprintSymbol);

    const build = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'MediumHardpoint1',
        variant,
    );
    const fitted = build.fittedModuleAt('MediumHardpoint1')!;
    assert.deepEqual(fitted.engineering!.Modifiers, fixture.journalModifiers);
    assert.equal(fitted.effectiveStats!.damage, fixture.engineered.damage);

    const reimported = ShipLoadout.fromLoadout(build.toLoadoutEvent()).fittedModuleAt(
        'MediumHardpoint1',
    )!;
    assert.equal(reimported.preEngineeredVariant, variant);
    assert.deepEqual(reimported.engineering!.Modifiers, fixture.journalModifiers);
    assert.equal(reimported.effectiveStats!.damage, fixture.engineered.damage);
});

test('a stated Damage wins over the DamagePerSecond derived beside it', () => {
    // A weapon capture states both figures. `Damage` is the published one; dividing
    // `DamagePerSecond` back out by the firing rate re-derives it through two more
    // float32 steps and lands beside it. Frontier omits `Damage` for a continuous
    // weapon, and that reading still derives from the per-second figure.
    const railgun = mod('Hpt_Railgun_Fixed_Medium', HARDPOINT_MODULES);
    const stated = (modifiers: EngineeringModifier[]) =>
        ShipLoadout.fromLoadout({
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'MediumHardpoint1',
                    Item: railgun.symbol,
                    Engineering: {
                        BlueprintName: 'Weapon_HighCapacity',
                        Level: 1,
                        Quality: 1,
                        Modifiers: modifiers,
                    },
                },
            ],
        }).fittedModuleAt('MediumHardpoint1')!.effectiveStats!.damage;

    assert.equal(
        stated([
            { Label: 'DamagePerSecond', Value: 40.028915, OriginalValue: 50.036144 },
            { Label: 'Damage', Value: 33.223999, OriginalValue: 41.529999 },
        ]),
        33.223999,
    );
    // Nor does a block whose per-second figure is explained by a stated firing rate:
    // High Capacity moves the rate and not the damage, so dividing its DPS back out
    // re-derives the stock figure a float32 step away from 40.
    const rateOnly = getPreEngineeredVariants('Hpt_BasicMissileRack_Fixed_Medium').find(
        (candidate) =>
            candidate.acquisition === 'communityGoal' &&
            candidate.blueprintSymbol === 'Weapon_HighCapacity',
    )!;
    const rack = ShipLoadout.empty('Anaconda').setPreEngineeredVariant(
        'MediumHardpoint1',
        rateOnly,
    );
    const rackBlock = rack.fittedModuleAt('MediumHardpoint1')!.engineering!;
    assert.equal(modFor(rackBlock.Modifiers!, 'Damage'), undefined);
    assert.ok(modFor(rackBlock.Modifiers!, 'RateOfFire'));
    assert.equal(rack.fittedModuleAt('MediumHardpoint1')!.effectiveStats!.damage, 40);
    assert.equal(
        ShipLoadout.fromLoadout(rack.toLoadoutEvent()).fittedModuleAt('MediumHardpoint1')!
            .effectiveStats!.damage,
        40,
    );

    // A continuous weapon states no `Damage` at all — its per-second figure *is* the
    // damage stat, and nothing else in the block accounts for it — so that reading still
    // comes from `DamagePerSecond`.
    const beam = ShipLoadout.empty('Anaconda');
    beam.setModule('MediumHardpoint1', mod('Hpt_BeamLaser_Fixed_Medium', HARDPOINT_MODULES));
    beam.applyBlueprint('MediumHardpoint1', 'Weapon_Efficient', { grade: 5, quality: 1 });
    const beamBlock = beam.fittedModuleAt('MediumHardpoint1')!.engineering!;
    assert.equal(modFor(beamBlock.Modifiers!, 'Damage'), undefined);
    assert.equal(
        ShipLoadout.fromLoadout(beam.toLoadoutEvent()).fittedModuleAt('MediumHardpoint1')!
            .effectiveStats!.damage,
        modFor(beamBlock.Modifiers!, 'DamagePerSecond'),
    );
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
    assert.ok(
        near(BuildMetrics.of(build).weaponMetrics().total.damagePerSecond, damagePerSecond, 1e-6),
    );
    assert.ok(damagePerSecond > damage * rate);
});

test('blueprint and experimental aliases compound before journal presentation', () => {
    const build = ShipLoadout.empty('Anaconda')
        .setModule('Slot05_Size5', mod('Int_ShieldGenerator_Size5_Class5', INTERNAL_MODULES))
        .applyBlueprint('Slot05_Size5', 'ShieldGenerator_Reinforced', {
            grade: 5,
            experimentalEffectSymbol: 'special_shield_health',
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
    assert.equal(BuildMetrics.of(build).weaponMetrics().weapons[0]!.metrics.rateOfFire, 12.9);
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

test('a slot key is matched with surrounding whitespace ignored, everywhere', () => {
    // The documented rule is "matched case-insensitively, with surrounding whitespace
    // ignored", and only the case half held: a padded key missed the mount silently, so
    // `removeModule` reported success having emptied nothing.
    const build = ShipLoadout.default('Anaconda');

    assert.equal(
        build.fittedModuleAt('  FrameShiftDrive  ')?.symbol,
        build.fittedModuleAt('FrameShiftDrive')?.symbol,
    );
    assert.equal(build.fittedModuleAt('\tframeshiftdrive\n')?.slot, 'FrameShiftDrive');
    assert.deepEqual(
        build.availableBlueprints(' FrameShiftDrive '),
        build.availableBlueprints('FrameShiftDrive'),
    );
    assert.deepEqual(
        build.availableExperimentalEffects(' FrameShiftDrive '),
        build.availableExperimentalEffects('FrameShiftDrive'),
    );
    assert.equal(
        build.modulesForSlot(' Slot04_Size6 ').length,
        build.modulesForSlot('Slot04_Size6').length,
    );
    assert.equal(build.repairFixedMount(' CargoHatch ').status, 'unchanged');

    build.setModuleEnabled(' FrameShiftDrive ', false);
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.on, false);
    build.setModulePriority(' FrameShiftDrive ', 3);
    assert.equal(build.fittedModuleAt('FrameShiftDrive')?.priority, 3);

    build.setModule(' Slot04_Size6 ', mod('Int_CargoRack_Size6_Class1', INTERNAL_MODULES));
    assert.equal(build.fittedModuleAt('Slot04_Size6')?.symbol, 'Int_CargoRack_Size6_Class1');
    // A fresh fit still takes the layout's canonical spelling, not the padded request.
    assert.equal(build.fittedModuleAt('Slot04_Size6')?.slot, 'Slot04_Size6');

    build.removeModule(' Slot04_Size6 ');
    assert.equal(build.fittedModuleAt('Slot04_Size6'), null);

    // Padding is still not a wildcard: an unknown mount stays unknown.
    assert.throws(
        () =>
            build.setModule('  NoSuchMount  ', mod('Int_CargoRack_Size6_Class1', INTERNAL_MODULES)),
        {
            name: 'RangeError',
        },
    );
    assert.equal(build.fittedModuleAt('  NoSuchMount  '), null);
});

test('a build imported from Inara binds every one of its lower-cased slots', () => {
    // Inara lower-cases every slot key, as the SLEF specification's own example does.
    // The build is otherwise ordinary, so every mount it names must bind. Its 27 entries
    // reach 29 fitted mounts: Inara writes neither the cargo hatch nor an approach-suite
    // mount, and import stocks both.
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    assert.equal(build.fittedModules().length, 29);
    assert.equal(build.slots().filter((s) => s.module !== null).length, 29);

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
    assert.equal(BuildMetrics.of(build).weaponMetrics().weapons.length, 5);
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
    // Composite — can. Both figures carry the bulkhead's own heavy-duty G2 roll, which
    // the source states without modifiers and the import rolls from the recipe.
    const upgrade = (slot: string): number => {
        const data = structuredClone(inaraFixture[0]!.data) as unknown as LoadoutEvent;
        const modules = data.Modules.map((m) =>
            m.Slot === 'armour' ? { ...m, Slot: slot, Item: 'lakonminer_armour_grade3' } : m,
        );
        return BuildMetrics.of(
            ShipLoadout.fromLoadout({ ...data, Modules: modules }),
        ).armourMetrics()!.hitPoints;
    };
    assert.equal(upgrade('Armour'), 1433.2498914999999);
    assert.equal(upgrade('armour'), upgrade('Armour'));
    // ...and the untouched fixture's stock-grade bulkhead is the 737.1 it should be.
    assert.equal(
        BuildMetrics.of(ShipLoadout.fromSlef(JSON.stringify(inaraFixture))).armourMetrics()!
            .hitPoints,
        737.0999685,
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
    assert.equal(ordered.length, 29);
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
    const issue = build.validation().issues[0]!;
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
            message:
                'ShipLoadout.applyBlueprint: blueprintSymbol must be a string, received number 42',
        },
    );
    assert.throws(
        () =>
            build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
                grade: 5,
                experimentalEffectSymbol: 42 as unknown as string,
            }),
        {
            name: 'TypeError',
            message:
                'ShipLoadout.applyBlueprint: options.experimentalEffectSymbol must be a string, received number 42',
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
            message: /blueprintSymbol must be a string/,
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
        get experimentalEffectSymbol() {
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
            experimentalEffectSymbol: null as unknown as string,
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
        assert.ok(swappedBuild.validation(), field);
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

test('heatMetricsResult reproduces the pinned heat profile of each captured build', () => {
    for (const expected of heatFixture.builds) {
        const event = HEAT_BUILDS[expected.fixture];
        assert.ok(event, `no journal for ${expected.fixture}`);
        const build = ShipLoadout.fromLoadout(event);
        assert.equal(build.shipSymbol.toLowerCase(), expected.ship);
        const heat = BuildMetrics.of(build).heatMetricsResult().value;
        assert.ok(heat, expected.fixture);
        assert.equal(heat.heatEfficiency, expected.heatEfficiency);
        assert.equal(heat.hullHeatCapacity, expected.hullHeatCapacity);
        assert.equal(heat.hullHeatDissipation, expected.hullHeatDissipation);

        const power = BuildMetrics.of(build).powerBudget();
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
    const input = heatInputResultFor(
        ship,
        modules,
        calculatePowerBudget(10, [
            { draw: 1, priority: 1 },
            { draw: 1, priority: 1 },
        ]),
        (module) => stats.get(module.Item) ?? null,
    );

    assert.equal(input.value?.thrusterHeatRate, 2);
    assert.equal(input.value?.deployedThrusterHeatRate, 2);
    assert.equal(input.value?.fsdHeatRate, 3);
});

test('the Lynx uses its pinned maximum dissipation in build heat metrics', () => {
    const build = ShipLoadout.fromLoadout(lynxJournal as LoadoutEvent);
    const expected = heatFixture.hulls.lynx;
    assert.equal(build.shipSymbol.toLowerCase(), expected.symbol.toLowerCase());
    assert.equal(getShipBySymbol(build.shipSymbol)?.heatDissipation, expected.heatDissipation);
    assert.equal(
        BuildMetrics.of(build).heatMetricsResult().value?.hullHeatDissipation,
        expected.heatDissipation,
    );
});

test('a build with no powered power plant has no heat profile', () => {
    // Every build mounts a plant; switching it off is what leaves the profile unknown.
    const event = corvetteBeamsJournal as LoadoutEvent;
    const plantOff = ShipLoadout.fromLoadout({
        ...event,
        Modules: event.Modules.map((module) =>
            module.Slot === 'PowerPlant' ? { ...module, On: false } : module,
        ),
    });
    assert.equal(BuildMetrics.of(plantOff).heatMetricsResult().value, null, 'plant switched off');
});

test('heat follows what the plant actually feeds, not what is fitted', () => {
    const event = corvetteBeamsJournal as LoadoutEvent;
    const build = ShipLoadout.fromLoadout(event);
    const idle = BuildMetrics.of(build).heatMetricsResult().value!.idle.thermalLoad;

    // Switching a drawing module off takes its heat with it.
    const boosterOff = ShipLoadout.fromLoadout({
        ...event,
        Modules: event.Modules.map((module) =>
            module.Slot === 'Slot01_Size7' ? { ...module, On: false } : module,
        ),
    });
    assert.ok(BuildMetrics.of(boosterOff).heatMetricsResult().value!.idle.thermalLoad < idle);

    // And a group the plant cannot keep lit makes no heat either: dropping the plant to
    // its smallest rating unpowers the lower priorities rather than heating the hull.
    const weakPlant = build.setModule(
        'PowerPlant',
        getModuleBySymbol('Int_PowerPlant_Size2_Class1', CORE_MODULES)!,
    );
    const budget = BuildMetrics.of(weakPlant).powerBudget();
    assert.ok(!budget.withinBudget, 'the small plant must leave a group unpowered');
    const powered = budget.bands.reduce(
        (total, band) => (band.poweredRetracted ? total + band.retracted : total),
        0,
    );
    assert.ok(powered < budget.retracted, 'and some retracted draw must go unfed');
    assert.equal(
        BuildMetrics.of(weakPlant).heatMetricsResult().value!.idle.thermalLoad,
        powered * BuildMetrics.of(weakPlant).heatMetricsResult().value!.heatEfficiency,
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
    const bands = BuildMetrics.of(starved).powerBudget().bands;
    assert.ok(
        bands.every((band) => !band.poweredRetracted && !band.poweredDeployed),
        'the reproduction needs every band unpowered',
    );
    const heat = BuildMetrics.of(starved).heatMetricsResult().value;
    assert.ok(heat);
    for (const scenario of HEAT_SCENARIOS) {
        assert.equal(heat[scenario].thermalLoad, expected.thermalLoad, scenario);
        assert.equal(heat[scenario].overheats, expected.overheats, scenario);
        assert.equal(heat[scenario].heatLevel, expected.heatLevel, scenario);
    }
});
