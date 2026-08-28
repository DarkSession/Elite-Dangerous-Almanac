import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    bodyMass,
    bulkDensity,
    hillRadius,
    primaryAngularDiameter,
    rocheLimits,
    rocheLimitsForDensity,
    GRAVITATIONAL_CONSTANT,
    KG_PER_EARTH_MASS,
    KG_PER_SOLAR_MASS,
} from './body-physics.js';
import { assertQuantity } from './internal/body-calculation-tests.js';
import fixture from '../../../fixtures/astro/body-calculations.jsonc' with { type: 'json' };

test('the documented constants are the ones the calculations use', () => {
    assert.equal(GRAVITATIONAL_CONSTANT, 6.6743e-11);
    assert.equal(KG_PER_EARTH_MASS, 5.972e24);
    assert.equal(KG_PER_SOLAR_MASS, 1.989e30);
});

test('a mass reads in kilograms whichever unit the scan wrote it in', () => {
    assert.equal(bodyMass({ MassEM: 1 }), KG_PER_EARTH_MASS);
    assert.equal(bodyMass({ StellarMass: 1 }), KG_PER_SOLAR_MASS);
    assert.equal(bodyMass({ Radius: 6_371_000 }), null);
    // No journal line writes both; when a record does, the planetary mass is the one read.
    assert.equal(bodyMass({ MassEM: 2, StellarMass: 1 }), 2 * KG_PER_EARTH_MASS);
});

test('an unusable mass is absent, not zero', () => {
    assert.equal(bodyMass({ MassEM: 0 }), null);
    assert.equal(bodyMass({ MassEM: -1 }), null);
    assert.equal(bodyMass({ StellarMass: Number.NaN }), null);
    assert.equal(bodyMass({ StellarMass: Number.POSITIVE_INFINITY }), null);
});

for (const entry of fixture.bulkDensity) {
    test(`bulk density: ${entry.case}`, () => {
        assertQuantity(bulkDensity(entry.body), entry.kgPerCubicMetre);
    });
}

for (const entry of fixture.rocheLimits) {
    test(`Roche limits: ${entry.case}`, () => {
        const limits = rocheLimits(entry.satellite, entry.primary);
        assertQuantity(limits?.rigid ?? null, entry.rigid);
        assertQuantity(limits?.fluid ?? null, entry.fluid);
    });
}

for (const entry of fixture.rocheLimitsForDensity) {
    test(`Roche limits for an assumed density: ${entry.case}`, () => {
        const limits = rocheLimitsForDensity(entry.primary, entry.satelliteDensityKgM3);
        assertQuantity(limits?.rigid ?? null, entry.rigid);
        assertQuantity(limits?.fluid ?? null, entry.fluid);
    });
}

test('the fluid Roche limit is always the wider one', () => {
    const limits = rocheLimitsForDensity({ MassEM: 1, Radius: 6_371_000 }, 1000);
    assert.ok(limits !== null && limits.fluid > limits.rigid);
});

test('a satellite with no density of its own has no Roche limit', () => {
    assert.equal(rocheLimits({ MassEM: 1 }, { MassEM: 1, Radius: 6_371_000 }), null);
});

test("an assumed density is the caller's own figure, so a bad one is an error", () => {
    assert.throws(
        () => rocheLimitsForDensity({ MassEM: 1, Radius: 6_371_000 }, 0),
        /finite positive number/,
    );
    assert.throws(
        () => rocheLimitsForDensity({ MassEM: 1, Radius: 6_371_000 }, Number.NaN),
        RangeError,
    );
});

for (const entry of fixture.hillRadius) {
    test(`Hill radius: ${entry.case}`, () => {
        assertQuantity(hillRadius(entry.body, entry.primary), entry.metres);
    });
}

test('a Hill radius needs both masses', () => {
    assert.equal(hillRadius({ SemiMajorAxis: 1e9 }, { MassEM: 1 }), null);
    assert.equal(hillRadius({ MassEM: 1, SemiMajorAxis: 1e9 }, { Radius: 6_371_000 }), null);
});

for (const entry of fixture.primaryAngularDiameter) {
    test(`apparent size of the primary: ${entry.case}`, () => {
        assertQuantity(primaryAngularDiameter(entry.body, entry.primary), entry.degrees);
    });
}

test('apparent size needs an orbit and a primary radius', () => {
    assert.equal(primaryAngularDiameter({ MassEM: 1 }, { Radius: 1e9 }), null);
    assert.equal(primaryAngularDiameter({ SemiMajorAxis: 1e9 }, { MassEM: 1 }), null);
});

test('every entry point rejects a non-object body with a named TypeError', () => {
    const notABody = undefined as unknown as Record<string, never>;
    assert.throws(() => bodyMass(notABody), /bodyMass: body/);
    assert.throws(() => bulkDensity(notABody), /bulkDensity: body/);
    assert.throws(() => rocheLimits(notABody, {}), /rocheLimits: satellite/);
    assert.throws(() => rocheLimits({}, notABody), /rocheLimits: primary/);
    assert.throws(() => rocheLimitsForDensity(notABody, 1000), /rocheLimitsForDensity: primary/);
    assert.throws(() => hillRadius(notABody, {}), /hillRadius: body/);
    assert.throws(() => hillRadius({}, notABody), /hillRadius: primary/);
    assert.throws(() => primaryAngularDiameter(notABody, {}), /primaryAngularDiameter: body/);
    assert.throws(() => primaryAngularDiameter({}, notABody), /primaryAngularDiameter: primary/);
});
