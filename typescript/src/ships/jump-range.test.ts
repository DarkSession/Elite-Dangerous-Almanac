import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    singleJumpRange,
    fuelPerJump,
    totalRange,
    type FrameShiftDriveParams,
} from './jump-range.js';
import expected from '../../../fixtures/ships/jump-range.json' with { type: 'json' };

const fsd: FrameShiftDriveParams = expected.frameShiftDrive;

test('singleJumpRange reproduces EDSY MaxJumpRange for the Deep Black', () => {
    const range = singleJumpRange(
        expected.unladenMass,
        Math.min(expected.mainFuel, fsd.maxFuel),
        fsd,
    );
    assert.ok(Math.abs(range - expected.edsyMaxJumpRange) < 1e-4, `got ${range}`);
});

test('singleJumpRange returns 0 when the drive cannot jump', () => {
    assert.equal(singleJumpRange(1000, 0, fsd), 0);
    assert.equal(singleJumpRange(1000, 5, { ...fsd, maxFuel: 0 }), 0);
});

test('jumpBoost defaults to 0 when omitted', () => {
    const noBoostParams: FrameShiftDriveParams = {
        optMass: fsd.optMass,
        maxFuel: fsd.maxFuel,
        fuelMul: fsd.fuelMul,
        fuelPower: fsd.fuelPower,
    };
    const withBoost = singleJumpRange(1000, 5, fsd);
    const noBoost = singleJumpRange(1000, 5, noBoostParams);
    assert.ok(Math.abs(withBoost - noBoost - (fsd.jumpBoost ?? 0)) < 1e-9);
});

test('fuelPerJump is the inverse of singleJumpRange', () => {
    const mass = expected.unladenMass;
    const fuel = fsd.maxFuel; // one jump's worth
    const dist = singleJumpRange(mass, fuel, fsd);
    const cost = fuelPerJump(dist, mass, fuel, fsd);
    assert.ok(Math.abs(cost - Math.min(fuel, fsd.maxFuel)) < 1e-6, `got ${cost}`);
});

test('without a booster, fuelPerJump is the exact inverse at an interior distance', () => {
    const noBoost: FrameShiftDriveParams = {
        optMass: fsd.optMass,
        maxFuel: fsd.maxFuel,
        fuelMul: fsd.fuelMul,
        fuelPower: fsd.fuelPower,
    };
    const mass = 1000;
    const fuel = noBoost.maxFuel;
    const dist = 0.6 * singleJumpRange(mass, fuel, noBoost);
    // Closed form: fuel = fuelMul * (dist * (mass + fuel) / optMass)^fuelPower.
    const closed =
        noBoost.fuelMul * Math.pow((dist * (mass + fuel)) / noBoost.optMass, noBoost.fuelPower);
    assert.ok(Math.abs(fuelPerJump(dist, mass, fuel, noBoost) - closed) < 1e-9);
});

test('fuelPerJump caps at the drive max fuel and floors at 0', () => {
    assert.equal(fuelPerJump(0, 1000, 128, fsd), 0);
    const huge = fuelPerJump(10000, 1000, 128, fsd);
    assert.ok(huge <= fsd.maxFuel + 1e-9);
});

test('fuelPerJump for a 50 LY jump matches the fixture', () => {
    const cost = fuelPerJump(50, expected.unladenMass, expected.mainFuel, fsd);
    assert.ok(Math.abs(cost - expected.fuelPerJump50Ly) < 1e-3, `got ${cost}`);
});

test('totalRange matches the fixture and exceeds a single jump', () => {
    const total = totalRange(expected.unladenMass, expected.mainFuel, fsd);
    assert.ok(Math.abs(total - expected.totalRange) < 1e-2, `got ${total}`);
    assert.ok(total > singleJumpRange(expected.unladenMass, expected.mainFuel, fsd));
});

test('totalRange returns 0 for a drive with no fuel per jump', () => {
    assert.equal(totalRange(1000, 32, { ...fsd, maxFuel: 0 }), 0);
});

test('jump calculations reject the shared invalid-input cases', () => {
    const decode = (value: number | string): number => {
        if (value === 'NaN') return Number.NaN;
        if (value === 'Infinity') return Number.POSITIVE_INFINITY;
        return Number(value);
    };
    for (const row of expected.invalidInputs) {
        let mass = 1000;
        let fuel = 5;
        let distance = 10;
        const params: Record<string, number> = { ...fsd };
        const value = decode(row.value);
        if (row.field === 'mass') mass = value;
        else if (row.field === 'fuel') fuel = value;
        else if (row.field === 'distance') distance = value;
        else params[row.field] = value;

        const invoke = () => {
            if (row.function === 'singleJumpRange') {
                return singleJumpRange(mass, fuel, params as unknown as FrameShiftDriveParams);
            }
            if (row.function === 'fuelPerJump') {
                return fuelPerJump(
                    distance,
                    mass,
                    fuel,
                    params as unknown as FrameShiftDriveParams,
                );
            }
            return totalRange(mass, fuel, params as unknown as FrameShiftDriveParams);
        };
        assert.throws(invoke, RangeError, `${row.function}.${row.field}`);
    }
});

test('totalRange rejects an excessive workload instead of returning a partial range', () => {
    const row = expected.excessiveJumpCount;
    assert.equal(row.error, 'workload-limit');
    assert.throws(
        () => totalRange(row.mass, row.fuel, { ...fsd, maxFuel: row.maxFuel }),
        /more than 100000 jumps/,
    );
});

test('totalRange spends even the smallest positive fuel amount', () => {
    const row = expected.tinyFuel;
    assert.ok(totalRange(row.mass, row.fuel, fsd) >= row.minimumRange);
});

test('totalRange rejects a non-finite accumulated result', () => {
    const row = expected.overflowingTotal;
    assert.equal(row.error, 'non-finite-result');
    assert.throws(
        () => totalRange(row.mass, row.fuel, row.frameShiftDrive),
        /non-finite total range/,
    );
});
