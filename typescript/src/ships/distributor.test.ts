import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/ships/operations.jsonc' with { type: 'json' };
import { distributorMetrics, type DistributorInput } from './distributor.js';

test('distributorMetrics matches the shared three-capacitor fixture', () => {
    assert.deepEqual(distributorMetrics(fixture.distributor.input), fixture.distributor.expected);
});

test('four pips use every rated recharge and zero pips provide none', () => {
    const input: DistributorInput = {
        systemsCapacity: 20,
        systemsRecharge: 2,
        enginesCapacity: 24,
        enginesRecharge: 3,
        weaponsCapacity: 30,
        weaponsRecharge: 5,
    };
    const rated = distributorMetrics(input);
    assert.deepEqual(rated.pips, { systems: 4, engines: 4, weapons: 4 });
    assert.deepEqual(rated.systems, { capacity: 20, ratedRecharge: 2, rechargeRate: 2 });
    assert.deepEqual(rated.engines, { capacity: 24, ratedRecharge: 3, rechargeRate: 3 });
    assert.deepEqual(rated.weapons, { capacity: 30, ratedRecharge: 5, rechargeRate: 5 });

    const empty = distributorMetrics({
        ...input,
        systemsPips: 0,
        enginesPips: 0,
        weaponsPips: 0,
    });
    assert.equal(empty.systems.rechargeRate, 0);
    assert.equal(empty.engines.rechargeRate, 0);
    assert.equal(empty.weapons.rechargeRate, 0);
});

test('distributorMetrics rejects non-physical inputs', () => {
    const base: DistributorInput = {
        systemsCapacity: 20,
        systemsRecharge: 2,
        enginesCapacity: 24,
        enginesRecharge: 3,
        weaponsCapacity: 30,
        weaponsRecharge: 5,
    };
    for (const input of [
        { ...base, systemsCapacity: -1 },
        { ...base, enginesRecharge: Number.NaN },
        { ...base, weaponsCapacity: Infinity },
        { ...base, systemsPips: -0.5 },
        { ...base, enginesPips: 4.5 },
        { ...base, weaponsPips: Number.NaN },
    ]) {
        assert.throws(() => distributorMetrics(input), RangeError);
    }
});
