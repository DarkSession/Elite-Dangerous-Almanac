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

test('calculation issues abbreviate caller-supplied slot and module symbols', () => {
    const longSlot = 's'.repeat(20_000);
    const longSymbol = 'm'.repeat(20_000);
    const result = calculateUnladenMass(10, [{ slot: longSlot, symbol: longSymbol, mass: null }]);
    assert.equal(result.complete, false);
    assert.equal(result.issues[0]?.slot, longSlot);
    assert.equal(result.issues[0]?.symbol, longSymbol);
    assert.ok(result.issues[0]!.message.length < 200);
    assert.match(result.issues[0]!.message, /….*…/);
});

test('mass reports every unknown module instead of returning a partial sum', () => {
    const result = calculateUnladenMass(10, [
        known,
        { slot: 'Slot01_Size4', symbol: 'UnknownModule', mass: null },
    ]);
    assert.equal(result.value, null);
    assert.equal(result.complete, false);
    assert.deepEqual(
        result.issues.map((issue) => [issue.field, issue.slot]),
        [['mass', 'Slot01_Size4']],
    );
    assert.equal(Object.isFrozen(result.issues[0]), true);
    assert.equal(Object.isFrozen(result.issues[0]?.params), true);
});

test('cargo and fuel name unknown capacity modules while ignoring unrelated modules', () => {
    const modules: LoadoutCalculationModule[] = [
        known,
        { slot: 'Slot01_Size4', symbol: 'UnknownRack', mass: 0, cargoCapacity: null },
        { slot: 'FuelTank', symbol: 'UnknownTank', mass: 0, fuelCapacity: null },
    ];
    assert.deepEqual(calculateCargoCapacity(modules).issues[0], {
        field: 'cargoCapacity',
        reason: 'unresolved',
        slot: 'Slot01_Size4',
        symbol: 'UnknownRack',
        params: {
            field: 'cargoCapacity',
            reason: 'unresolved',
            slot: 'Slot01_Size4',
            symbol: 'UnknownRack',
        },
        message: 'Slot01_Size4: UnknownRack has no known cargoCapacity',
    });
    const fuel = calculateFuelCapacity(0.5, modules);
    assert.equal(fuel.value, null);
    assert.deepEqual(
        fuel.issues.map((issue) => issue.field),
        ['fuelCapacity'],
    );
});
