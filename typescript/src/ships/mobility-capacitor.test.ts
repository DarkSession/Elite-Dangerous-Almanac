import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mobilityCapacitorMetrics } from './mobility-capacitor.js';
import { mobilityMetrics } from './mobility.js';

const thrusters = {
    minMass: 24,
    optMass: 48,
    maxMass: 72,
    minMultiplier: 0.83,
    optMultiplier: 1,
    maxMultiplier: 1.03,
};

const input = {
    minimumSpeed: 100,
    maximumSpeed: 220,
    boost: 320,
    minPitch: 34,
    pitch: 42,
    minRoll: 110,
    roll: 110,
    minYaw: 16,
    yaw: 16,
    mass: 48,
    thrusters,
};

test('four pips reproduce the pip-free figures exactly', () => {
    const base = mobilityMetrics(input);
    const four = mobilityCapacitorMetrics(input);
    assert.equal(four.enginesPips, 4);
    // Bit-for-bit, not merely close: full ENG *is* the baseline, so the split must not
    // move a headline number.
    for (const field of ['speed', 'pitch', 'roll', 'yaw'] as const) {
        assert.equal(four[field], base[field], field);
    }
    assert.deepEqual(four, mobilityCapacitorMetrics({ ...input, enginesPips: 4 }));
});

test('the allocation interpolates between the hull endpoints, then the curve applies', () => {
    const two = mobilityCapacitorMetrics({ ...input, enginesPips: 2 });
    assert.equal(two.speed, 160);
    assert.equal(two.pitch, 38);
    // Roll and yaw declare equal endpoints on this hull, so the pips cannot move them.
    assert.equal(two.roll, 110);
    assert.equal(two.yaw, 16);

    const none = mobilityCapacitorMetrics({ ...input, enginesPips: 0 });
    assert.equal(none.speed, 100);
    assert.equal(none.pitch, 34);

    // Fractional pips are legal — the game's own curve is continuous.
    assert.equal(mobilityCapacitorMetrics({ ...input, enginesPips: 1 }).speed, 130);
    assert.equal(mobilityCapacitorMetrics({ ...input, enginesPips: 0.5 }).speed, 115);
});

test('the mass curve multiplies the interpolated figure, and past maxMass zeroes it', () => {
    const heavy = mobilityCapacitorMetrics({ ...input, mass: 72, enginesPips: 2 });
    assert.ok(Math.abs(heavy.speed - 160 * 0.83) < 1e-12);
    const overloaded = mobilityCapacitorMetrics({ ...input, mass: 73, enginesPips: 4 });
    assert.equal(overloaded.speed, 0);
    assert.equal(overloaded.pitch, 0);
});

test('boost is not reported here, because the allocation cannot move it', () => {
    const two = mobilityCapacitorMetrics({ ...input, enginesPips: 2 });
    assert.equal(Object.hasOwn(two, 'boost'), false);
    assert.equal(Object.hasOwn(two, 'loadedMass'), false);
    assert.ok(Object.isFrozen(two));
});

test('no thrusters is null, and the allocation is still checked first', () => {
    assert.equal(mobilityCapacitorMetrics({ ...input, thrusters: null }), null);
    const message = 'mobilityCapacitorMetrics: enginesPips must be a finite number from 0 to 4';
    for (const enginesPips of [5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () => mobilityCapacitorMetrics({ ...input, thrusters: null, enginesPips }),
            (error: unknown) => error instanceof RangeError && error.message === message,
            String(enginesPips),
        );
    }
});

test('hull figures are validated in this function’s own name', () => {
    assert.throws(
        () => mobilityCapacitorMetrics({ ...input, maximumSpeed: -1 }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'mobilityCapacitorMetrics: maximumSpeed must be a finite non-negative number',
    );
    assert.throws(
        () => mobilityCapacitorMetrics({ ...input, minimumSpeed: 2, maximumSpeed: 1 }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message === 'mobilityCapacitorMetrics: minimumSpeed must not exceed maximumSpeed',
    );
    assert.throws(
        () => mobilityCapacitorMetrics({ ...input, minPitch: 99 }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'mobilityCapacitorMetrics: minPitch must be a finite number from 0 to 42',
    );
    assert.throws(
        () =>
            mobilityCapacitorMetrics({
                ...input,
                thrusters: { ...thrusters, minMass: 50, optMass: 40 },
            }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message.startsWith('mobilityCapacitorMetrics: thrusters: '),
    );
});

test('enhanced thrusters use their distinct speed and rotation curves', () => {
    const enhanced = mobilityCapacitorMetrics({
        ...input,
        mass: 24,
        enginesPips: 2,
        thrusters: {
            ...thrusters,
            speedCurve: { ...thrusters, maxMultiplier: 1.25 },
            rotationCurve: { ...thrusters, maxMultiplier: 1.1 },
        },
    });
    assert.ok(Math.abs(enhanced.speed - 160 * 1.25) < 1e-12);
    assert.ok(Math.abs(enhanced.pitch - 38 * 1.1) < 1e-12);
});
