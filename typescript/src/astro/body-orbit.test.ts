import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    classifyEccentricity,
    equatorialVelocity,
    orbitExtents,
    spinOrbitResonance,
    type EccentricityClass,
} from './body-orbit.js';
import { assertQuantity } from './internal/body-calculation-tests.js';
import fixture from '../../../fixtures/astro/body-calculations.jsonc' with { type: 'json' };

for (const entry of fixture.orbitExtents) {
    test(`orbit extents: ${entry.case}`, () => {
        const extents = orbitExtents(entry.body);
        assertQuantity(extents?.periapsis, entry.periapsis);
        assertQuantity(extents?.apoapsis, entry.apoapsis);
        if (entry.eccentricityClass === null) {
            assert.equal(extents, null);
            return;
        }
        assert.ok(extents !== null);
        assert.equal(extents.semiMajorAxis, entry.body.SemiMajorAxis);
        assert.equal(classifyEccentricity(extents.eccentricity), entry.eccentricityClass);
    });
}

test('an absent eccentricity is a circle, not an absent answer', () => {
    assert.equal(orbitExtents({ SemiMajorAxis: 1e9 })?.eccentricity, 0);
});

test('an unusable semi-major axis has no extents', () => {
    assert.equal(orbitExtents({ SemiMajorAxis: 0 }), null);
    assert.equal(orbitExtents({ SemiMajorAxis: Number.NaN }), null);
});

for (const entry of fixture.eccentricityClass) {
    test(`eccentricity ${entry.eccentricity} is ${entry.class}`, () => {
        assert.equal(classifyEccentricity(entry.eccentricity), entry.class as EccentricityClass);
    });
}

test('an eccentricity that is not a number at all is an error', () => {
    assert.throws(() => classifyEccentricity(Number.NaN), RangeError);
    assert.throws(() => classifyEccentricity(-0.1), /finite non-negative number/);
});

for (const entry of fixture.spinOrbitResonance) {
    test(`spin-orbit resonance: ${entry.case}`, () => {
        assert.deepEqual(spinOrbitResonance(entry.body), entry.resonance);
    });
}

test('a period of zero is not a resonance', () => {
    assert.equal(spinOrbitResonance({ RotationPeriod: 0, OrbitalPeriod: 86400 }), null);
    assert.equal(spinOrbitResonance({ RotationPeriod: 86400, OrbitalPeriod: 0 }), null);
    assert.equal(spinOrbitResonance({ OrbitalPeriod: 86400 }), null);
});

test('a resonance is found within one per cent, and not beyond it', () => {
    // 1.005 orbits per rotation is inside the tolerance of 1:1; 1.05 is outside every ratio.
    assert.deepEqual(spinOrbitResonance({ RotationPeriod: 1000, OrbitalPeriod: 1005 }), {
        rotations: 1,
        orbits: 1,
    });
    assert.equal(spinOrbitResonance({ RotationPeriod: 1000, OrbitalPeriod: 1050 }), null);
});

for (const entry of fixture.equatorialVelocity) {
    test(`equatorial velocity: ${entry.case}`, () => {
        assertQuantity(equatorialVelocity(entry.body), entry.metresPerSecond);
    });
}

test('equatorial velocity needs a radius and a rotation', () => {
    assert.equal(equatorialVelocity({ RotationPeriod: 86400 }), null);
    assert.equal(equatorialVelocity({ Radius: 6_371_000, RotationPeriod: 0 }), null);
});

test('every entry point rejects a non-object body with a named TypeError', () => {
    const notABody = undefined as unknown as Record<string, never>;
    assert.throws(() => orbitExtents(notABody), /orbitExtents: body/);
    assert.throws(() => spinOrbitResonance(notABody), /spinOrbitResonance: body/);
    assert.throws(() => equatorialVelocity(notABody), /equatorialVelocity: body/);
});
