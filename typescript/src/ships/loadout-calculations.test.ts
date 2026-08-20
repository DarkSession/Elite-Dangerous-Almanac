import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
    type LoadoutCalculationModule,
} from './loadout-calculations.js';

const drive: LoadoutCalculationModule = { mass: 10 };

test('pure loadout calculations sum only the modules that carry the figure', () => {
    const modules: LoadoutCalculationModule[] = [
        drive,
        { mass: 2, cargoCapacity: 16 },
        { mass: 1, fuelCapacity: 8 },
    ];
    assert.equal(calculateUnladenMass(25, modules), 38);
    assert.equal(calculateCargoCapacity(modules), 16);
    assert.deepEqual(calculateFuelCapacity(0.5, modules), { main: 8, reserve: 0.5 });
});

test('a hull with no rack or tank still reports its genuine zeroes', () => {
    assert.equal(calculateUnladenMass(25, []), 25);
    assert.equal(calculateCargoCapacity([drive]), 0);
    const fuel = calculateFuelCapacity(0.5, [drive]);
    assert.deepEqual(fuel, { main: 0, reserve: 0.5 });
    assert.equal(Object.isFrozen(fuel), true);
});
