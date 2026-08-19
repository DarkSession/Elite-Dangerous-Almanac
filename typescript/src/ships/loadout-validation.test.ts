import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateLoadout } from './loadout-validation.js';
import { enumerateSlots, type ShipSlots } from './slots.js';

const layout: ShipSlots = {
    symbol: 'TestShip',
    core: {
        powerPlant: 2,
        thrusters: 2,
        frameShiftDrive: 2,
        lifeSupport: 1,
        powerDistributor: 2,
        sensors: 1,
        fuelTank: 2,
    },
    hardpoints: [],
    utility: 0,
    optional: [],
};

test('an empty known hull is valid but operationally incomplete', () => {
    const result = validateLoadout({
        shipSymbol: layout.symbol,
        slots: enumerateSlots(layout),
        modules: [],
    });
    assert.equal(result.valid, true);
    assert.equal(result.complete, false);
    assert.equal(result.issues.filter((issue) => issue.code === 'missingRequiredSlot').length, 8);
});

test('validation names a non-array slot layout', () => {
    assert.throws(
        () =>
            validateLoadout({
                shipSymbol: layout.symbol,
                slots: null,
                modules: [],
            } as unknown as Parameters<typeof validateLoadout>[0]),
        {
            name: 'TypeError',
            message: 'validateLoadout: input.slots must be an array, received null',
        },
    );
});

test('a cargo hatch is immutable without becoming required for editor-built loadouts', () => {
    const slots = enumerateSlots(layout);
    const result = validateLoadout({
        shipSymbol: layout.symbol,
        slots,
        modules: slots
            .filter((slot) => slot.kind === 'core' || slot.kind === 'armour')
            .map((slot) => ({
                slot: slot.key,
                symbol: `Test_${slot.key}`,
                fitError: null,
            })),
    });
    assert.deepEqual(result, { valid: true, complete: true, issues: [] });
});

test('validation reports invalid structure and incompatible modules', () => {
    const result = validateLoadout({
        shipSymbol: layout.symbol,
        slots: enumerateSlots(layout),
        modules: [
            { slot: 'NoSuchSlot', symbol: 'Known', fitError: null },
            { slot: 'PowerPlant', symbol: 'Known', fitError: null },
            { slot: 'powerplant', symbol: 'Wrong', fitError: 'does not fit' },
        ],
    });
    assert.equal(result.valid, false);
    assert.equal(result.complete, false);
    assert.ok(result.issues.some((issue) => issue.code === 'duplicateSlot'));
    assert.ok(result.issues.some((issue) => issue.code === 'unknownSlot'));
    assert.ok(result.issues.some((issue) => issue.code === 'incompatibleModule'));
});

test('fitting params cannot replace canonical diagnostic identity fields', () => {
    const result = validateLoadout({
        shipSymbol: layout.symbol,
        slots: enumerateSlots(layout),
        modules: [
            {
                slot: 'PowerPlant',
                symbol: 'Actual',
                fitError: 'does not fit',
                fitConstraint: 'oversized',
                fitParams: { slot: 'spoof', symbol: 'spoof', constraint: 'wrongCoreType' },
            },
        ],
    });
    assert.deepEqual(result.issues.find((issue) => issue.code === 'incompatibleModule')?.params, {
        slot: 'PowerPlant',
        symbol: 'Actual',
        constraint: 'oversized',
    });
});

test('known non-outfitting entries do not have to name a hull mount', () => {
    const result = validateLoadout({
        shipSymbol: layout.symbol,
        slots: enumerateSlots(layout),
        modules: [
            {
                slot: 'PaintJob',
                symbol: 'paintjob_test',
                requiresKnownSlot: false,
                fitError: null,
            },
        ],
    });
    assert.equal(result.valid, true);
    assert.equal(
        result.issues.some((issue) => issue.code === 'unknownSlot'),
        false,
    );
});

test('validation reports two modules from the same one-per-ship family', () => {
    const result = validateLoadout({
        shipSymbol: layout.symbol,
        slots: enumerateSlots({ ...layout, optional: [{ size: 2 }, { size: 2 }] }),
        modules: [
            {
                slot: 'Slot01_Size2',
                symbol: 'ShieldA',
                fitError: null,
                exclusionGroup: 'shieldGenerator',
            },
            {
                slot: 'Slot02_Size2',
                symbol: 'ShieldB',
                fitError: null,
                exclusionGroup: 'shieldGenerator',
            },
        ],
    });
    const issue = result.issues.find((item) => item.code === 'duplicateExclusiveModule');
    assert.equal(result.valid, false);
    assert.deepEqual(issue?.params, {
        exclusionGroup: 'shieldGenerator',
        slot: 'Slot02_Size2',
        symbol: 'ShieldB',
        previousSlot: 'Slot01_Size2',
        previousSymbol: 'ShieldA',
    });
    assert.ok(Object.isFrozen(issue?.params));
});

test('validation abbreviates message previews without changing structured values', () => {
    const longHull = `FutureShip${'x'.repeat(20_000)}`;
    const longSlot = `FutureSlot${'y'.repeat(20_000)}`;
    const longSymbol = `FutureModule${'z'.repeat(20_000)}`;
    const result = validateLoadout({
        shipSymbol: longHull,
        slots: [],
        modules: [
            { slot: longSlot, symbol: longSymbol, fitError: null },
            { slot: longSlot, symbol: longSymbol, fitError: 'q'.repeat(20_000) },
        ],
    });

    assert.ok(result.issues.length >= 4);
    assert.ok(result.issues.every((issue) => issue.message.length < 300));
    assert.ok(result.issues.every((issue) => issue.message.includes('…')));
    assert.ok(result.issues.some((issue) => issue.slot === longSlot));
    assert.ok(result.issues.some((issue) => issue.symbol === longSymbol));
});
