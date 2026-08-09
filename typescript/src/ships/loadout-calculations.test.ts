import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
    type LoadoutCalculationModule,
} from './loadout-calculations.js';

const known: LoadoutCalculationModule = {
    slot: 'FrameShiftDrive',
    symbol: 'KnownDrive',
    mass: 10,
};

test('pure loadout calculations preserve genuine zeroes', () => {
    assert.deepEqual(calculateCargoCapacity([known]), {
        value: 0,
        complete: true,
        issues: [],
    });
    assert.deepEqual(calculateFuelCapacity(0.5, [known]), {
        value: { main: 0, reserve: 0.5 },
        complete: true,
        issues: [],
    });
    const fuel = calculateFuelCapacity(0.5, [known]);
    assert.equal(Object.isFrozen(fuel), true);
    assert.equal(Object.isFrozen(fuel.issues), true);
    assert.equal(Object.isFrozen(fuel.value), true);
});

test('mass reports every missing dependency instead of returning a partial sum', () => {
    const result = calculateUnladenMass(null, [
        known,
        { slot: 'Slot01_Size4', symbol: 'UnknownModule', mass: null },
    ]);
    assert.equal(result.value, null);
    assert.equal(result.complete, false);
    assert.deepEqual(
        result.issues.map((issue) => [issue.field, issue.slot]),
        [
            ['hullMass', undefined],
            ['mass', 'Slot01_Size4'],
        ],
    );
    assert.equal(Object.isFrozen(result.issues[0]), true);
});

test('cargo and fuel name unknown capacity modules while ignoring unrelated modules', () => {
    const modules: LoadoutCalculationModule[] = [
        known,
        { slot: 'Slot01_Size4', symbol: 'UnknownRack', mass: 0, cargoCapacity: null },
        { slot: 'FuelTank', symbol: 'UnknownTank', mass: 0, fuelCapacity: null },
    ];
    assert.deepEqual(calculateCargoCapacity(modules).issues[0], {
        field: 'cargoCapacity',
        slot: 'Slot01_Size4',
        symbol: 'UnknownRack',
        message: 'Slot01_Size4: UnknownRack has no known cargoCapacity',
    });
    const fuel = calculateFuelCapacity(null, modules);
    assert.equal(fuel.value, null);
    assert.deepEqual(
        fuel.issues.map((issue) => issue.field),
        ['reserveFuelCapacity', 'fuelCapacity'],
    );
});
