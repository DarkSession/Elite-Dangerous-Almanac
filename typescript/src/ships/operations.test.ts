import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/ships/operations.jsonc' with { type: 'json' };
import { mobilityMetrics } from './mobility.js';
import { distributorMetrics } from './distributor.js';
import { cellBankSummary, shieldRecovery } from './shield-recovery.js';
import { validateLoadout } from './loadout-validation.js';
import { calculateModuleLimits, type ModuleLimitEntry } from './module-limits.js';
import { getModuleBySymbol, type ModuleExclusionGroup } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { getPreEngineeredVariants } from './pre-engineered.js';
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
        {
            totalRestorable: cells.totalRestorable,
            totalCells: cells.totalCells,
            powered: cells.banks.map((bank) => bank.powered),
        },
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
    assert.deepEqual(distributorMetrics(fixture.distributor.input), fixture.distributor.expected);
});

test('shared catalogue-backed operation cases reproduce', () => {
    const distributorFacade = fixture.distributor.facade;
    const distributorBuild = ShipLoadout.fromLoadout(distributorFacade.loadout);
    const distributorBand = distributorBuild.powerBudget().bands[4];
    assert.equal(distributorBand?.poweredRetracted, true);
    assert.equal(distributorBand?.poweredDeployed, false);
    assert.deepEqual(
        distributorBuild.distributorMetrics(distributorFacade.options),
        distributorFacade.expected,
    );
    for (const loadout of distributorFacade.nullLoadouts) {
        assert.equal(ShipLoadout.fromLoadout(loadout).distributorMetrics(), null);
    }

    const credits = ShipLoadout.default(fixture.buildCost.credits.ship).buildCost().credits;
    assert.deepEqual(
        {
            total: credits.total,
            hull: credits.hull,
            modules: credits.modules,
            rebuy: credits.rebuy,
        },
        fixture.buildCost.credits.expected,
    );
    const ordinary = fixture.buildCost.ordinaryEngineering;
    const ordinaryBuild = ShipLoadout.empty(ordinary.ship).setModule(
        ordinary.slot,
        getModuleBySymbol(ordinary.symbol, ALL_MODULES)!,
    );
    ordinaryBuild.applyBlueprint(ordinary.slot, ordinary.blueprint, { grade: ordinary.grade });
    assert.equal(ordinaryBuild.buildCost().mercCoins, ordinary.mercCoins);
    const mercenary = fixture.buildCost.mercenary;
    const mercCoinBuild = ShipLoadout.default(mercenary.ship);
    for (const module of mercenary.modules) {
        const variant = getPreEngineeredVariants(module.symbol).find(
            (candidate) => candidate.blueprint === module.blueprint,
        );
        assert.ok(variant);
        assert.equal(variant.mercCoinCost, module.cost);
        mercCoinBuild.setPreEngineeredVariant(module.slot, variant);
    }
    assert.equal(mercCoinBuild.buildCost().mercCoins, mercenary.expected);
    const climbed = mercenary.modules[0]!;
    mercCoinBuild
        .setModule(climbed.slot, getModuleBySymbol(climbed.symbol, ALL_MODULES)!)
        .applyBlueprint(climbed.slot, climbed.blueprint, { grade: mercenary.climbed.grade });
    assert.deepEqual(
        {
            mercCoins: mercCoinBuild.buildCost().mercCoins,
            materials: mercCoinBuild.buildCost().materials,
        },
        { mercCoins: mercenary.climbed.mercCoins, materials: mercenary.climbed.materials },
    );
    const validation = validateLoadout({
        shipSymbol: 'FutureShip',
        slots: [],
        modules: [
            {
                slot: 'A',
                symbol: 'first',
                fitError: null,
                exclusionGroup: fixture.exclusivity.group as ModuleExclusionGroup,
            },
            {
                slot: 'B',
                symbol: 'second',
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

test('shared import rejection cases apply to journal and SLEF entry points', () => {
    const rejection = fixture.importRejections.unknownHull;
    assert.deepEqual(rejection.expected, { accepted: false, reason: 'unknownHull' });
    for (const [scope, importBuild] of [
        ['ShipLoadout.fromLoadout', () => ShipLoadout.fromLoadout(rejection.input)],
        ['ShipLoadout.fromSlef', () => ShipLoadout.fromSlef([rejection.input])],
    ] as const) {
        assert.throws(importBuild, {
            name: 'TypeError',
            message: `${scope}: unknown hull "${rejection.input.Ship}"`,
        });
    }
});

test('shared module-count limits resolve allowances and structural diagnostics', () => {
    const input = fixture.moduleLimits.input as readonly ModuleLimitEntry[];
    const usage = calculateModuleLimits(input);
    assert.deepEqual(usage[0], fixture.moduleLimits.expectedUsage);
    assert.ok(Object.isFrozen(usage));
    assert.ok(Object.isFrozen(usage[0]));

    const validation = validateLoadout({
        shipSymbol: 'FutureShip',
        slots: [],
        modules: input.map((metadata, index) => ({
            slot: `Slot${index}`,
            symbol: `Module${index}`,
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

    const restricted = fixture.diagnostics.restrictedLoadout;
    const restrictedIssue = ShipLoadout.fromLoadout(restricted.input).validation.issues.find(
        (candidate) => candidate.code === restricted.expected.code,
    );
    assert.ok(restrictedIssue);
    assert.deepEqual(restrictedIssue.params, restricted.expected.params);
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

    const wrongArmour = fixture.editorErrors.wrongHullArmour;
    assert.deepEqual(
        project(
            capture(() =>
                ShipLoadout.empty(wrongArmour.ship).setModule(
                    wrongArmour.slot,
                    getModuleBySymbol(wrongArmour.module)!,
                ),
            ),
        ),
        wrongArmour.expected,
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

    const required = fixture.editorErrors.requiredSlot;
    assert.deepEqual(
        project(capture(() => ShipLoadout.fromLoadout(required.input).removeModule(required.slot))),
        required.expected,
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
    const slots = ShipLoadout.default(fixture.slotRemoval.ship).slots();
    for (const expected of fixture.slotRemoval.expected) {
        const slot = slots.find((candidate) => candidate.key === expected.key);
        assert.ok(slot);
        const { key, kind, size, removable, immovableReason } = slot;
        assert.deepEqual({ key, kind, size, removable, immovableReason }, expected);
    }
});
