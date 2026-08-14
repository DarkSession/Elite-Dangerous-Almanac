import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/ships/operations.jsonc' with { type: 'json' };
import { mobilityMetrics } from './mobility.js';
import { calculateCargoCapacity } from './loadout-calculations.js';
import { cellBankSummary, shieldRecovery } from './shield-recovery.js';
import { validateLoadout } from './loadout-validation.js';
import { calculateModuleLimits, type ModuleLimitEntry } from './module-limits.js';
import { getModuleBySymbol, type ModuleExclusionGroup } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { LoadoutEditError, ShipLoadout } from './ship-loadout.js';
import { inspectSlef } from './slef.js';
import { sumWeaponMetrics, weaponMetrics } from './weapons.js';
import { weaponsCapacitorMetrics } from './weapons-capacitor.js';

test('shared ship-operation cases reproduce across public calculations', () => {
    const mobility = mobilityMetrics(fixture.mobility.input);
    for (const [field, expected] of Object.entries(fixture.mobility.expected)) {
        assert.ok(Math.abs(mobility[field as keyof typeof mobility] - expected) < 1e-12, field);
    }
    const zeroPipRotation = mobilityMetrics(fixture.mobility.zeroPipRotation.input);
    for (const [field, expected] of Object.entries(fixture.mobility.zeroPipRotation.expected)) {
        assert.ok(
            Math.abs(zeroPipRotation[field as keyof typeof zeroPipRotation] - expected) < 1e-12,
            field,
        );
    }
    const lynxSequence = Array.from({ length: 5 }, (_, enginesPips) =>
        mobilityMetrics({ ...fixture.mobility.zeroPipRotation.input, enginesPips }),
    );
    assert.deepEqual(
        lynxSequence.map(({ speed }) => speed),
        fixture.mobility.zeroPipRotation.speedSequence,
    );
    assert.deepEqual(
        lynxSequence.map(({ pitch }) => pitch),
        fixture.mobility.zeroPipRotation.pitchSequence,
    );
    assert.ok(lynxSequence.every(({ roll, yaw }) => roll === 60 && yaw === 19));
    const pipAllocation = mobilityMetrics(fixture.mobility.pipAllocation.input);
    for (const [field, expected] of Object.entries(fixture.mobility.pipAllocation.expected)) {
        assert.ok(
            Math.abs(pipAllocation[field as keyof typeof pipAllocation] - expected) < 1e-12,
            field,
        );
    }
    assert.deepEqual(shieldRecovery(fixture.shieldRecovery.input), fixture.shieldRecovery.expected);
    const pipRecovery = shieldRecovery(fixture.shieldRecovery.pipAllocation.input);
    for (const [field, expected] of Object.entries(fixture.shieldRecovery.pipAllocation.expected)) {
        assert.ok(
            Math.abs(pipRecovery[field as keyof typeof pipRecovery] - expected) < 1e-12,
            field,
        );
    }
    assert.throws(() => mobilityMetrics(fixture.mobility.invalidSpeedEndpoints.input), {
        name: fixture.mobility.invalidSpeedEndpoints.expectedError,
    });
    assert.throws(() => shieldRecovery(fixture.shieldRecovery.invalidStrength.input), {
        name: fixture.shieldRecovery.invalidStrength.expectedError,
    });
    const cells = cellBankSummary(fixture.cellBanks.input);
    assert.deepEqual(
        { totalRestorable: cells.totalRestorable, totalCells: cells.totalCells },
        fixture.cellBanks.expected,
    );
    assert.equal(
        sumWeaponMetrics(fixture.weapons.input.map((weapon) => weaponMetrics(weapon))).thermalLoad,
        fixture.weapons.expectedThermalLoad,
    );
    const capacitor = weaponsCapacitorMetrics(fixture.weaponsCapacitor.input);
    for (const [field, expected] of Object.entries(fixture.weaponsCapacitor.expected)) {
        assert.ok(Math.abs(capacitor[field as keyof typeof capacitor] - expected) < 1e-12, field);
    }
});

test('shared catalogue-backed operation cases reproduce', () => {
    const retail = ShipLoadout.default(fixture.retailCredits.ship).retailCredits();
    assert.deepEqual(
        { hull: retail.hull, modules: retail.modules, rebuy: retail.rebuy },
        fixture.retailCredits.expected,
    );
    const validation = validateLoadout({
        shipSymbol: 'FutureShip',
        slots: null,
        modules: [
            {
                slot: 'A',
                symbol: 'first',
                known: true,
                fitError: null,
                exclusionGroup: fixture.exclusivity.group as ModuleExclusionGroup,
            },
            {
                slot: 'B',
                symbol: 'second',
                known: true,
                fitError: null,
                exclusionGroup: fixture.exclusivity.group as ModuleExclusionGroup,
            },
        ],
    });
    assert.ok(validation.issues.some((issue) => issue.code === fixture.exclusivity.expectedCode));

    const limits = fixture.moduleLimits.catalogue;
    assert.equal(
        ALL_MODULES.filter((module) => module.limitGroup === fixture.moduleLimits.group).length,
        limits.limitedCount,
    );
    assert.equal(getModuleBySymbol(limits.weapon)?.limitGroup, fixture.moduleLimits.group);
    for (const expected of limits.increases) {
        assert.deepEqual(getModuleBySymbol(expected.symbol)?.limitIncrease, {
            group: fixture.moduleLimits.group,
            amount: expected.amount,
        });
    }

    const removal = fixture.moduleLimits.removal;
    const limitedBuild = ShipLoadout.fromLoadout({
        Ship: removal.ship,
        Modules: [
            ...removal.weaponSlots.map((Slot) => ({ Slot, Item: limits.weapon })),
            { Slot: removal.slot, Item: removal.stabiliser },
        ],
    });
    const limitedSlot = limitedBuild.slots().find((slot) => slot.key === removal.slot);
    assert.ok(limitedSlot);
    assert.deepEqual(
        {
            key: limitedSlot.key,
            removable: limitedSlot.removable,
            immovableReason: limitedSlot.immovableReason,
        },
        removal.expected,
    );
});

test('shared module-count limits resolve allowances and structural diagnostics', () => {
    const input = fixture.moduleLimits.input as readonly ModuleLimitEntry[];
    const usage = calculateModuleLimits(input);
    assert.deepEqual(usage[0], fixture.moduleLimits.expectedUsage);
    assert.ok(Object.isFrozen(usage));
    assert.ok(Object.isFrozen(usage[0]));

    const validation = validateLoadout({
        shipSymbol: 'FutureShip',
        slots: null,
        modules: input.map((metadata, index) => ({
            slot: `Slot${index}`,
            symbol: `Module${index}`,
            known: true,
            fitError: null,
            ...metadata,
        })),
    });
    const issue = validation.issues.find(
        (candidate) => candidate.code === fixture.moduleLimits.expectedIssue.code,
    );
    assert.ok(issue);
    assert.deepEqual(issue.params, fixture.moduleLimits.expectedIssue.params);
});

test('shared diagnostic cases expose stable localization keys', () => {
    const diagnostic = inspectSlef(fixture.diagnostics.slef.input).diagnostics[0];
    assert.ok(diagnostic);
    assert.deepEqual(
        {
            code: diagnostic.code,
            path: diagnostic.path,
            constraint: diagnostic.constraint,
        },
        fixture.diagnostics.slef.expected,
    );

    const loadoutIssue = ShipLoadout.fromLoadout(
        fixture.diagnostics.loadout.input,
    ).validation.issues.find((issue) => issue.code === fixture.diagnostics.loadout.expected.code);
    assert.ok(loadoutIssue);
    assert.deepEqual(loadoutIssue.params, fixture.diagnostics.loadout.expected.params);

    for (const fitting of [
        fixture.diagnostics.restrictedLoadout,
        fixture.diagnostics.wrongArmourLoadout,
    ]) {
        const issue = ShipLoadout.fromLoadout(fitting.input).validation.issues.find(
            (candidate) => candidate.code === fitting.expected.code,
        );
        assert.ok(issue);
        assert.deepEqual(issue.params, fitting.expected.params);
    }

    const calculationIssue = calculateCargoCapacity([
        { ...fixture.diagnostics.calculation.input, cargoCapacity: null },
    ]).issues[0];
    assert.ok(calculationIssue);
    assert.deepEqual(
        {
            field: calculationIssue.field,
            slot: calculationIssue.slot,
            symbol: calculationIssue.symbol,
            params: calculationIssue.params,
        },
        fixture.diagnostics.calculation.expected,
    );
});

test('shared editor failures expose stable codes and localization params', () => {
    const capture = (edit: () => void): LoadoutEditError => {
        try {
            edit();
        } catch (error) {
            assert.ok(error instanceof LoadoutEditError);
            assert.ok(error instanceof TypeError);
            return error;
        }
        assert.fail('expected the loadout edit to be refused');
    };
    const project = (error: LoadoutEditError) => ({
        code: error.code,
        ...(error.constraint === undefined ? {} : { constraint: error.constraint }),
        params: error.params,
    });

    const incompatible = fixture.editorErrors.incompatibleModule;
    assert.deepEqual(
        project(
            capture(() =>
                ShipLoadout.empty(incompatible.ship).setModule(
                    incompatible.slot,
                    getModuleBySymbol(incompatible.module)!,
                ),
            ),
        ),
        incompatible.expected,
    );

    const exclusive = fixture.editorErrors.duplicateExclusiveModule;
    const exclusiveModule = getModuleBySymbol(exclusive.module)!;
    const exclusiveBuild = ShipLoadout.empty(exclusive.ship).setModule(
        exclusive.firstSlot,
        exclusiveModule,
    );
    assert.deepEqual(
        project(capture(() => exclusiveBuild.setModule(exclusive.secondSlot, exclusiveModule))),
        exclusive.expected,
    );

    const limited = fixture.editorErrors.moduleLimitExceeded;
    const limitedModule = getModuleBySymbol(limited.module)!;
    const limitedBuild = ShipLoadout.empty(limited.ship);
    for (const slot of limited.fittedSlots) limitedBuild.setModule(slot, limitedModule);
    assert.deepEqual(
        project(capture(() => limitedBuild.setModule(limited.targetSlot, limitedModule))),
        limited.expected,
    );

    const immutable = fixture.editorErrors.immutableSlot;
    assert.deepEqual(
        project(capture(() => ShipLoadout.default(immutable.ship).removeModule(immutable.slot))),
        immutable.expected,
    );

    const immutableReplacement = fixture.editorErrors.immutableSlotReplacement;
    assert.deepEqual(
        project(
            capture(() =>
                ShipLoadout.default(immutableReplacement.ship).setModule(
                    immutableReplacement.slot,
                    getModuleBySymbol(immutableReplacement.module)!,
                ),
            ),
        ),
        immutableReplacement.expected,
    );
});

test('shared slot metadata states whether a mount can be emptied', () => {
    const slot = ShipLoadout.default(fixture.slotRemoval.ship)
        .slots()
        .find((candidate) => candidate.key === fixture.slotRemoval.expected.key);
    assert.ok(slot);
    const { key, kind, size, removable, immovableReason } = slot;
    assert.deepEqual({ key, kind, size, removable, immovableReason }, fixture.slotRemoval.expected);
});
