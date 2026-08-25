import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mobilityMetrics, thrusterMassCurveMultiplier } from './mobility.js';

const thrusters = {
    minMass: 24,
    optMass: 48,
    maxMass: 72,
    minMultiplier: 0.83,
    optMultiplier: 1,
    maxMultiplier: 1.03,
};

test('the thruster curve passes through all three declared points', () => {
    assert.equal(thrusterMassCurveMultiplier(24, thrusters), 1.03);
    assert.ok(Math.abs(thrusterMassCurveMultiplier(48, thrusters) - 1) < 1e-12);
    assert.equal(thrusterMassCurveMultiplier(72, thrusters), 0.83);
    assert.equal(thrusterMassCurveMultiplier(73, thrusters), 0);
});

test('mobility scales speed, boost and handling by loaded mass and ENG pips', () => {
    const four = mobilityMetrics({
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
    });
    assert.deepEqual(four, {
        loadedMass: 48,
        speed: 220,
        boost: 320,
        pitch: 42,
        roll: 110,
        yaw: 16,
        massCurveMultiplier: four.massCurveMultiplier,
        rotationMassCurveMultiplier: four.rotationMassCurveMultiplier,
    });

    const two = mobilityMetrics({
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
        enginesPips: 2,
    });
    assert.equal(two.speed, 160);
    assert.equal(two.boost, 320);
    assert.equal(two.pitch, 38);
    // The mass is reported back so the curve position can be read off the result: ENG
    // pips move the speed, never the mass the curve was evaluated at.
    assert.equal(two.loadedMass, 48);
});

test('enhanced thrusters use distinct speed and rotation curves', () => {
    const result = mobilityMetrics({
        minimumSpeed: 80,
        maximumSpeed: 200,
        boost: 300,
        minPitch: 16,
        pitch: 40,
        minRoll: 40,
        roll: 100,
        minYaw: 8,
        yaw: 20,
        mass: 90,
        thrusters: {
            minMass: 70,
            optMass: 90,
            maxMass: 200,
            minMultiplier: 0.9,
            optMultiplier: 1.1,
            maxMultiplier: 1.2,
            speedCurve: {
                minMass: 70,
                optMass: 90,
                maxMass: 200,
                minMultiplier: 0.9,
                optMultiplier: 1.25,
                maxMultiplier: 1.6,
            },
            rotationCurve: {
                minMass: 70,
                optMass: 90,
                maxMass: 200,
                minMultiplier: 0.9,
                optMultiplier: 1.1,
                maxMultiplier: 1.3,
            },
        },
    });
    assert.equal(result.speed, 250);
    assert.equal(result.boost, 375);
    assert.equal(result.pitch, 44);
    assert.equal(result.massCurveMultiplier, 1.25);
    assert.equal(result.rotationMassCurveMultiplier, 1.1);
});

test('mobility handles degenerate curves and validates physical inputs', () => {
    const input = {
        minimumSpeed: 0,
        maximumSpeed: 1,
        boost: 1,
        minPitch: 0,
        pitch: 1,
        minRoll: 0,
        roll: 1,
        minYaw: 0,
        yaw: 1,
        mass: 1,
        thrusters,
    };
    assert.equal(
        mobilityMetrics({
            ...input,
            thrusters: null,
        }),
        null,
    );
    assert.equal(
        thrusterMassCurveMultiplier(1, {
            minMass: 1,
            optMass: 1,
            maxMass: 1,
            minMultiplier: 1.2,
            optMultiplier: 1.2,
            maxMultiplier: 1.2,
        }),
        1.2,
    );
    assert.throws(() => mobilityMetrics({ ...input, enginesPips: 5 }), RangeError);
    assert.throws(
        () => mobilityMetrics({ ...input, minimumSpeed: 2, maximumSpeed: 1 }),
        RangeError,
    );
    assert.throws(() => mobilityMetrics({ ...input, minPitch: 2 }), RangeError);
    assert.throws(() => mobilityMetrics({ ...input, maximumSpeed: -1 }), RangeError);
    assert.throws(
        () =>
            thrusterMassCurveMultiplier(-1, {
                ...thrusters,
            }),
        RangeError,
    );
    assert.throws(
        () =>
            thrusterMassCurveMultiplier(1, {
                ...thrusters,
                minMass: 50,
                optMass: 40,
            }),
        RangeError,
    );
    assert.throws(
        () =>
            thrusterMassCurveMultiplier(1, {
                ...thrusters,
                minMass: 48,
            }),
        RangeError,
    );
    assert.throws(
        () =>
            thrusterMassCurveMultiplier(1, {
                ...thrusters,
                optMass: 72,
            }),
        RangeError,
    );
    assert.throws(
        () =>
            thrusterMassCurveMultiplier(1, {
                ...thrusters,
                minMultiplier: -1,
            }),
        RangeError,
    );
    for (const multipliers of [
        { minMultiplier: 1, optMultiplier: 1.2, maxMultiplier: 1 },
        { minMultiplier: 0.8, optMultiplier: 0.8, maxMultiplier: 1.2 },
        { minMultiplier: 0.8, optMultiplier: 1.2, maxMultiplier: 1.2 },
    ]) {
        assert.throws(
            () => thrusterMassCurveMultiplier(1, { ...thrusters, ...multipliers }),
            RangeError,
        );
    }
    assert.throws(
        () =>
            thrusterMassCurveMultiplier(1, {
                minMass: 1,
                optMass: 1,
                maxMass: 1,
                minMultiplier: 1,
                optMultiplier: 1.1,
                maxMultiplier: 1.2,
            }),
        RangeError,
    );
});

test('mobilityMetrics returns a frozen result', () => {
    const metrics = mobilityMetrics({
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
    })!;
    assert.ok(Object.isFrozen(metrics));
    assert.throws(() => {
        (metrics as { speed: number }).speed = 0;
    }, TypeError);
});
