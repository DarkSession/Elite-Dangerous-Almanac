import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/ships/operations.jsonc' with { type: 'json' };
import { weaponsCapacitorMetrics, type WeaponsCapacitorInput } from './weapons-capacitor.js';

test('weaponsCapacitorMetrics matches the shared pip-allocation fixture', () => {
    const actual = weaponsCapacitorMetrics(fixture.weaponsCapacitor.input);
    for (const [field, expected] of Object.entries(fixture.weaponsCapacitor.expected)) {
        assert.ok(
            Math.abs(actual[field as keyof typeof actual] - expected) < 1e-12,
            `${field}: ${actual[field as keyof typeof actual]}`,
        );
    }
});

test('four WEP pips use the rated recharge and a sustainable load never drains', () => {
    const actual = weaponsCapacitorMetrics({
        weaponsCapacity: 20,
        weaponsRecharge: 5,
        sustainedEnergyPerSecond: 4,
    });
    assert.equal(actual.weaponsPips, 4);
    assert.equal(actual.rechargeRate, 5);
    assert.equal(actual.netDrainRate, 0);
    assert.equal(actual.timeToDrain, Infinity);
});

test('zero WEP pips provide no recharge and zero capacity drains immediately', () => {
    assert.deepEqual(
        weaponsCapacitorMetrics({
            weaponsCapacity: 0,
            weaponsRecharge: 5,
            sustainedEnergyPerSecond: 4,
            weaponsPips: 0,
        }),
        {
            weaponsPips: 0,
            capacity: 0,
            rechargeRate: 0,
            sustainedEnergyPerSecond: 4,
            netDrainRate: 4,
            timeToDrain: 0,
        },
    );
});

test('weaponsCapacitorMetrics rejects non-physical inputs', () => {
    const base: WeaponsCapacitorInput = {
        weaponsCapacity: 20,
        weaponsRecharge: 5,
        sustainedEnergyPerSecond: 4,
    };
    for (const input of [
        { ...base, weaponsCapacity: -1 },
        { ...base, weaponsRecharge: Number.NaN },
        { ...base, sustainedEnergyPerSecond: Infinity },
        { ...base, weaponsPips: -0.5 },
        { ...base, weaponsPips: 4.5 },
    ]) {
        assert.throws(() => weaponsCapacitorMetrics(input), RangeError);
    }
});

test('weaponsCapacitorMetrics returns a frozen result', () => {
    const metrics = weaponsCapacitorMetrics({
        weaponsCapacity: 20,
        weaponsRecharge: 5,
        sustainedEnergyPerSecond: 7,
    });
    assert.ok(Object.isFrozen(metrics));
    assert.throws(() => {
        (metrics as { timeToDrain: number }).timeToDrain = 0;
    }, TypeError);
});
