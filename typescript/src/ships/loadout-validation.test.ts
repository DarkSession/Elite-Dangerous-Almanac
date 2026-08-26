import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateLoadout } from './loadout-validation.js';
import { enumerateSlots, type ShipSlots } from './slots.js';
import operationsFixture from '../../../fixtures/ships/operations.jsonc' with { type: 'json' };

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

test('a thruster rating is weighed at each load, lightest failure reported', () => {
    const { input, cases } = operationsFixture.thrusterMass;
    const weigh = (mass: (typeof cases)[number]['mass']) =>
        validateLoadout({
            shipSymbol: layout.symbol,
            slots: enumerateSlots(layout),
            mass,
            modules: [
                {
                    slot: input.slot,
                    symbol: input.symbol,
                    requiresKnownSlot: false,
                    fitError: null,
                    thrusterMaxMass: input.thrusterMaxMass,
                },
            ],
        }).issues.filter((issue) => issue.code === 'thrusterMassExceeded');

    for (const { name, mass, expectedIssue } of cases) {
        const reported = weigh(mass);
        // One issue, not one per load: the loads only grow, so the lightest failure
        // already says everything the heavier ones would.
        assert.equal(reported.length, 1, name);
        assert.equal(reported[0]?.severity, expectedIssue.severity, name);
        assert.equal(reported[0]?.message, expectedIssue.message, name);
        assert.deepEqual(reported[0]?.params, expectedIssue.params, name);
    }

    // A laden-only overload is a note against a build that is legal and fully mounted,
    // so it clears neither answer; the two heavier failures are errors.
    const laden = cases.find((item) => item.expectedIssue.params.load === 'laden');
    assert.ok(laden);
    const ladenResult = validateLoadout({
        shipSymbol: layout.symbol,
        slots: [],
        mass: laden.mass,
        modules: [
            {
                slot: input.slot,
                symbol: input.symbol,
                requiresKnownSlot: false,
                fitError: null,
                thrusterMaxMass: input.thrusterMaxMass,
            },
        ],
    });
    assert.equal(ladenResult.valid, true);
    assert.equal(ladenResult.complete, true);
});

test('a ship within its rating at every load it can reach is not reported', () => {
    const { input, quiet } = operationsFixture.thrusterMass;
    for (const mass of quiet) {
        const result = validateLoadout({
            shipSymbol: layout.symbol,
            slots: enumerateSlots(layout),
            mass,
            modules: [
                {
                    slot: input.slot,
                    symbol: input.symbol,
                    requiresKnownSlot: false,
                    fitError: null,
                    thrusterMaxMass: input.thrusterMaxMass,
                },
            ],
        });
        assert.equal(
            result.issues.filter((issue) => issue.code === 'thrusterMassExceeded').length,
            0,
            JSON.stringify(mass),
        );
    }

    // Nothing to weigh is not an overload: a module with no rating is every module but
    // the thrusters, and a `mass` nobody stated is the structural-only check.
    const overloaded = { dry: 85.6, fuel: 8 };
    const without = (thrusterMaxMass: number | undefined, mass: typeof overloaded | undefined) =>
        validateLoadout({
            shipSymbol: layout.symbol,
            slots: enumerateSlots(layout),
            ...(mass === undefined ? {} : { mass }),
            modules: [
                {
                    slot: input.slot,
                    symbol: input.symbol,
                    requiresKnownSlot: false,
                    fitError: null,
                    ...(thrusterMaxMass === undefined ? {} : { thrusterMaxMass }),
                },
            ],
        }).issues.filter((issue) => issue.code === 'thrusterMassExceeded').length;

    assert.equal(without(undefined, overloaded), 0);
    assert.equal(without(input.thrusterMaxMass, undefined), 0);
    // The rule does fire on that mass with that rating, so the two zeroes above are the
    // absent figure being respected rather than a rule that never fires.
    assert.equal(without(input.thrusterMaxMass, overloaded), 1);
});

test('both figures in an overload message round to the tenth of a tonne', () => {
    const { input } = operationsFixture.thrusterMass;
    // An engineered rating carries ten decimals of its own, and a capture's unladen
    // mass six; `params` keeps both exactly as measured.
    const issue = validateLoadout({
        shipSymbol: layout.symbol,
        slots: [],
        mass: { dry: 68.39999999999999 },
        modules: [
            {
                slot: input.slot,
                symbol: input.symbol,
                requiresKnownSlot: false,
                fitError: null,
                thrusterMaxMass: 64.79999550000001,
            },
        ],
    }).issues[0];
    assert.equal(
        issue?.message,
        'MainEngines: Int_Engine_Size2_Class1 is rated to 64.8 t but the ship weighs 68.4 t before fuel',
    );
    assert.deepEqual(issue?.params, {
        slot: input.slot,
        symbol: input.symbol,
        load: 'dry',
        mass: 68.39999999999999,
        maxMass: 64.79999550000001,
    });
});

test('a mass that cannot be weighed is refused rather than reported as an overload', () => {
    // NaN compares false against every rating, so an unguarded one would report an
    // overload on whatever build it reached.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
        for (const [field, mass] of [
            ['dry', { dry: bad }],
            ['fuel', { dry: 30, fuel: bad }],
            ['cargo', { dry: 30, fuel: 8, cargo: bad }],
        ] as const) {
            assert.throws(
                () => validateLoadout({ shipSymbol: layout.symbol, slots: [], modules: [], mass }),
                {
                    name: 'RangeError',
                    message: `validateLoadout: input.mass.${field} must be a finite non-negative number of tonnes, received number ${String(bad)}`,
                },
            );
        }
    }
    assert.throws(
        () =>
            validateLoadout({
                shipSymbol: layout.symbol,
                slots: [],
                modules: [
                    {
                        slot: 'MainEngines',
                        symbol: 'Int_Engine_Size2_Class1',
                        requiresKnownSlot: false,
                        fitError: null,
                        thrusterMaxMass: Number.NaN,
                    },
                ],
                mass: { dry: 30 },
            }),
        {
            name: 'RangeError',
            message:
                'validateLoadout: MainEngines thrusterMaxMass must be a finite non-negative number of tonnes, received number NaN',
        },
    );
});
