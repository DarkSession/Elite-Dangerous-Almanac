import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    effectiveHitPoints,
    mapDamageTypes,
    stackShieldResistance,
    stackArmourResistance,
    systemsResistance,
} from './resistances.js';
import fixture from '../../../fixtures/ships/build-metrics.jsonc' with { type: 'json' };

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('a lone source stacks to itself', () => {
    assert.ok(near(stackShieldResistance(0.4), 0.4));
    assert.ok(near(stackArmourResistance(0.25), 0.25));
    assert.ok(near(stackShieldResistance(-0.2), -0.2)); // a weakness survives untouched
    assert.ok(near(stackArmourResistance(-0.4, []), -0.4));
});

test('shield boosters stack multiplicatively below the diminishing threshold', () => {
    // Two 10% boosters on a generator with no kinetic resistance: 1 - 0.9 * 0.9.
    assert.ok(near(stackShieldResistance(0, [0.1, 0.1]), 0.19));
    // The damage multiplier is the resistance's complement.
    assert.ok(near(1 - stackShieldResistance(0, [0.1, 0.1]), 0.81));
});

test('shields take half credit once the boosters pass 30% of the generator', () => {
    // Four 20% resistance boosters on a 40% generator. Raw stacking would leave a
    // multiplier of 0.6 * 0.8^4 = 0.24576 (75.4% resisted); the game halves the gain
    // past the threshold, landing at 66.7%.
    const raw = 0.6 * Math.pow(0.8, 4);
    assert.ok(raw < 0.6 * 0.7, 'this case is past the threshold');
    const effective = stackShieldResistance(0.4, [0.2, 0.2, 0.2, 0.2]);
    assert.ok(near(effective, 1 - 0.33288, 1e-6), `got ${effective}`);
    assert.ok(effective < 1 - raw, 'diminishing returns must reduce the raw stack');
});

test('the shield stack approaches, but never passes, half the generator threshold', () => {
    // The squeeze maps [0, threshold] onto [threshold/2, threshold], so the multiplier
    // tends to 0.35 x the generator's own however many boosters pile on.
    const floor = 0.6 * 0.35;
    const many = 1 - stackShieldResistance(0.4, Array<number>(10).fill(0.5));
    assert.ok(many > floor, `got ${many}`);
    assert.ok(many - floor < 1e-3, `got ${many}`);
    assert.ok(1 - stackShieldResistance(0.4, Array<number>(20).fill(0.5)) < many);
});

test('hull reinforcement stacks onto the bulkhead', () => {
    // Reactive composite (+25%) with a 2.5% package: 1 - 0.75 * 0.975.
    assert.ok(near(stackArmourResistance(0.25, [0.025]), 0.26875));
    // A weakness compounds the same way: lightweight alloy is -20% kinetic.
    assert.ok(near(stackArmourResistance(-0.2, [0.025]), 1 - 1.2 * 0.975));
});

test('hull resistance takes half credit past the best single source', () => {
    // Six 5% packages behind a 25% bulkhead: raw 0.75 * 0.95^6 = 0.5514, and the
    // squeeze maps [0, 0.7] into [0.35, 0.7].
    const raw = 0.75 * Math.pow(0.95, 6);
    const expected = 0.35 + (0.7 - 0.35) * (raw / 0.7);
    assert.ok(near(1 - stackArmourResistance(0.25, Array<number>(6).fill(0.05)), expected, 1e-9));
});

test('a hull stack that never reaches the threshold keeps its plain product', () => {
    // A lightweight alloy (-20%) with one small package cannot reach 30% resisted, so
    // the raw product stands rather than being remapped upwards.
    const raw = 1.2 * 0.995;
    assert.ok(near(1 - stackArmourResistance(-0.2, [0.005]), raw, 1e-9));
});

test('systems pips add resistance on their own curve', () => {
    assert.equal(systemsResistance(0), 0);
    assert.ok(near(systemsResistance(4), 0.6, 1e-12));
    assert.ok(systemsResistance(2) > 0.3 && systemsResistance(2) < 0.4);
    // Monotonic across the range.
    for (let pips = 0; pips < 4; pips++) {
        assert.ok(systemsResistance(pips) < systemsResistance(pips + 1));
    }
});

test('systemsResistance rejects pips outside 0-4, naming its own parameter', () => {
    // Called directly, the parameter the consumer wrote is `pips`; reached through
    // `shieldCapacitorMetrics` it is `systemsPips`, and that call names itself instead.
    const message = 'systemsResistance: pips must be a finite number from 0 to 4';
    for (const bad of [-1, 5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () => systemsResistance(bad),
            (error: unknown) => error instanceof RangeError && error.message === message,
            String(bad),
        );
    }
});

test('mapDamageTypes visits each damage type exactly once, under its own key', () => {
    const seen: string[] = [];
    // First letters, which are distinct across the four types — so a record built with
    // its keys crossed over would not match.
    const values = mapDamageTypes((type) => {
        seen.push(type);
        return type.charCodeAt(0);
    });
    assert.deepEqual(seen, ['kinetic', 'thermal', 'explosive', 'caustic']);
    assert.deepEqual(values, { kinetic: 107, thermal: 116, explosive: 101, caustic: 99 });
});

test('effective hit points divide the pool by what gets through', () => {
    // 945 hull points behind lightweight alloy: kinetically and explosively weak.
    const hull = effectiveHitPoints(945, {
        kinetic: -0.2,
        thermal: 0,
        explosive: -0.4,
        caustic: 0,
    });
    assert.ok(near(hull.kinetic, 787.5));
    assert.equal(hull.thermal, 945); // no resistance, no weakness
    assert.ok(near(hull.explosive, 675));
    // A weakness must report *fewer* effective hit points than the pool holds.
    assert.ok(hull.kinetic < 945 && hull.explosive < hull.kinetic);
});

test('a resistance of 100% or more soaks unlimited damage of that type', () => {
    const pool = effectiveHitPoints(350, { kinetic: 1, thermal: 1.5, explosive: 0.5, caustic: 0 });
    assert.equal(pool.kinetic, Infinity);
    assert.equal(pool.thermal, Infinity); // never negative, however far past 100%
    assert.equal(pool.explosive, 700);
    assert.equal(pool.caustic, 350);
});

test('an empty pool stays empty behind any resistance short of 100%', () => {
    const none = effectiveHitPoints(
        0,
        mapDamageTypes(() => 0),
    );
    assert.deepEqual(none, { kinetic: 0, thermal: 0, explosive: 0, caustic: 0 });
});

test('the shared fixture pins the resistance stacking and the pip curve', () => {
    for (const { generator, boosters, expected } of fixture.functions.stackShieldResistance) {
        assert.ok(near(stackShieldResistance(generator, boosters), expected, 1e-6), `${generator}`);
    }
    for (const { bulkhead, reinforcements, expected } of fixture.functions.stackArmourResistance) {
        assert.ok(
            near(stackArmourResistance(bulkhead, reinforcements), expected, 1e-6),
            `${bulkhead}`,
        );
    }
    for (const { pips, expected } of fixture.functions.systemsResistance) {
        assert.ok(near(systemsResistance(pips), expected, 1e-6), `${pips} pips`);
    }
});
