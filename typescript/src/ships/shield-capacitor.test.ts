import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shieldCapacitorMetrics } from './shield-capacitor.js';
import { shieldMetrics } from './shields.js';
import { systemsResistance } from './resistances.js';

const generator = {
    minMass: 270,
    optMass: 540,
    maxMass: 1350,
    minMultiplier: 0.7,
    optMultiplier: 1.2,
    maxMultiplier: 1.7,
    kineticResistance: 0.4,
    thermalResistance: -0.2,
    explosiveResistance: 0.5,
};

const shields = shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator });

const input = {
    ...shields,
    systemsCapacity: 41,
    systemsRecharge: 3.9,
};

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-12;

test('a shield metrics result is the capacitor input, spread straight in', () => {
    // The two halves compose without a hand-written adapter: `ShieldMetrics` already
    // carries the `strength` and `resistances` the capacitor reads.
    const sys = shieldCapacitorMetrics({ ...shields, systemsCapacity: 41, systemsRecharge: 3.9 });
    assert.equal(sys.systemsPips, 4);
    assert.equal(sys.capacity, 41);
    assert.ok(near(sys.systemsResistance, 0.6));
});

test('no pips leave the bare shield exactly as it came in', () => {
    const none = shieldCapacitorMetrics({ ...input, systemsPips: 0 });
    assert.equal(none.systemsResistance, 0);
    assert.equal(none.rechargeRate, 0);
    // Bit-for-bit, not merely close: the split must not move a headline number.
    assert.deepEqual(none.effectiveResistances, shields.resistances);
    assert.deepEqual(none.effectiveHitPoints, shields.effectiveHitPoints);
});

test('pips multiply with the shield stack rather than adding to it', () => {
    const four = shieldCapacitorMetrics({ ...input, systemsPips: 4 });
    assert.ok(near(four.effectiveResistances.kinetic, 1 - 0.6 * 0.4));
    // Caustic is the pips alone: no stock generator carries a caustic resistance.
    assert.ok(near(four.effectiveResistances.caustic, 0.6));
    assert.ok(near(four.effectiveResistances.thermal, 1 - 1.2 * 0.4));
    // Effective hit points are derived from exactly those effective resistances.
    assert.ok(
        near(
            four.effectiveHitPoints.kinetic,
            shields.strength / (1 - four.effectiveResistances.kinetic),
        ),
    );
    assert.ok(four.effectiveHitPoints.kinetic > shields.effectiveHitPoints.kinetic);
});

test('the recharge follows the same non-linear pip curve as the other capacitors', () => {
    assert.equal(shieldCapacitorMetrics({ ...input, systemsPips: 4 }).rechargeRate, 3.9);
    assert.ok(
        near(shieldCapacitorMetrics({ ...input, systemsPips: 2 }).rechargeRate, 3.9 * 0.5 ** 1.1),
    );
    // Half the pips buy less than half the recharge, and less than half the resistance.
    const half = shieldCapacitorMetrics({ ...input, systemsPips: 2 });
    assert.ok(half.rechargeRate < 3.9 / 2);
    assert.ok(half.systemsResistance > 0.6 / 2);
    assert.ok(near(half.systemsResistance, systemsResistance(2)));
});

test('a 100% effective resistance reports an infinite pool rather than a negative one', () => {
    const sealed = shieldCapacitorMetrics({
        ...input,
        resistances: { kinetic: 1, thermal: 0, explosive: 0, caustic: 0 },
    });
    assert.equal(sealed.effectiveHitPoints.kinetic, Infinity);
    assert.ok(Number.isFinite(sealed.effectiveHitPoints.thermal));
});

test('fractional pips are legal, and the result is frozen through its nested records', () => {
    const fractional = shieldCapacitorMetrics({ ...input, systemsPips: 2.5 });
    assert.ok(fractional.systemsResistance > 0);
    assert.ok(Object.isFrozen(fractional));
    assert.ok(Object.isFrozen(fractional.effectiveResistances));
    assert.ok(Object.isFrozen(fractional.effectiveHitPoints));
});

test('a bad allocation names shieldCapacitorMetrics and the parameter the caller wrote', () => {
    const message = 'shieldCapacitorMetrics: systemsPips must be a finite number from 0 to 4';
    for (const systemsPips of [5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () => shieldCapacitorMetrics({ ...input, systemsPips }),
            (error: unknown) => error instanceof RangeError && error.message === message,
            String(systemsPips),
        );
    }
    // The pips are checked before the shield, so a build with nothing raised still
    // reports the allocation the caller wrote rather than the shield behind it.
    assert.throws(
        () =>
            shieldCapacitorMetrics({
                strength: -1,
                resistances: { kinetic: 0, thermal: 0, explosive: 0, caustic: 0 },
                systemsCapacity: -1,
                systemsRecharge: -1,
                systemsPips: 5,
            }),
        (error: unknown) => error instanceof RangeError && error.message === message,
    );
});

test('a shield figure that is not a number is rejected, never quietly used', () => {
    for (const [field, value] of [
        ['strength', -1],
        ['systemsCapacity', Number.NaN],
        ['systemsRecharge', Number.POSITIVE_INFINITY],
    ] as const) {
        assert.throws(
            () => shieldCapacitorMetrics({ ...input, [field]: value }),
            (error: unknown) =>
                error instanceof RangeError &&
                error.message ===
                    `shieldCapacitorMetrics: ${field} must be a finite non-negative number`,
            field,
        );
    }
    assert.throws(
        () =>
            shieldCapacitorMetrics({
                ...input,
                resistances: { ...shields.resistances, caustic: Number.NaN },
            }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message === 'shieldCapacitorMetrics: resistances.caustic must be a finite number',
    );
    assert.throws(
        () => shieldCapacitorMetrics({ ...input, resistances: null as never }),
        (error: unknown) =>
            error instanceof TypeError &&
            error.message ===
                'shieldCapacitorMetrics: resistances must carry the four damage types',
    );
});
