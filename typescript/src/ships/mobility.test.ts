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
        speed: 220,
        boost: 320,
        pitch: 42,
        roll: 110,
        yaw: 16,
        minThrust: 45.454,
        pipSpeed: 0.13636363636364,
        mass: 48,
        thrusters,
    });
    assert.deepEqual(four, {
        speed: 220,
        boost: 320,
        pitch: 42,
        roll: 110,
        yaw: 16,
        massCurveMultiplier: four.massCurveMultiplier,
        rotationMassCurveMultiplier: four.rotationMassCurveMultiplier,
    });

    const two = mobilityMetrics({
        speed: 220,
        boost: 320,
        pitch: 42,
        roll: 110,
        yaw: 16,
        minThrust: 45.454,
        pipSpeed: 0.13636363636364,
        mass: 48,
        thrusters,
        enginesPips: 2,
    });
    assert.ok(Math.abs(two.speed - 159.9994) < 1e-4);
    assert.equal(two.boost, 320);
    assert.ok(Math.abs(two.pitch - 30.54545454545424) < 1e-10);
});

test('enhanced thrusters use distinct speed and rotation curves', () => {
    const result = mobilityMetrics({
        speed: 200,
        boost: 300,
        pitch: 40,
        roll: 100,
        yaw: 20,
        minThrust: 40,
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
        speed: 1,
        boost: 1,
        pitch: 1,
        roll: 1,
        yaw: 1,
        minThrust: 0,
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
    assert.throws(() => mobilityMetrics({ ...input, minThrust: 101 }), RangeError);
    assert.throws(() => mobilityMetrics({ ...input, pipSpeed: 0.26 }), RangeError);
    assert.throws(() => mobilityMetrics({ ...input, minPitch: 2 }), RangeError);
    assert.throws(() => mobilityMetrics({ ...input, speed: -1 }), RangeError);
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
