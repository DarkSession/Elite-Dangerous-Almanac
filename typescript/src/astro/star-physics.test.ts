import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    absoluteBolometricMagnitude,
    assessMassStability,
    classifyNeutronStar,
    mainSequenceLifetime,
    schwarzschildRadius,
    CHANDRASEKHAR_LIMIT_SOLAR_MASSES,
    NEUTRON_STAR_MASS_DROP_OFF_SOLAR_MASSES,
    SOLAR_RADIUS,
    SPEED_OF_LIGHT,
    TOV_LIMIT_SOLAR_MASSES,
    type NeutronStarClass,
} from './star-physics.js';
import { assertQuantity } from './internal/body-calculation-tests.js';
import fixture from '../../../fixtures/astro/body-calculations.jsonc' with { type: 'json' };

test('the documented constants are the ones the calculations use', () => {
    assert.equal(SPEED_OF_LIGHT, 299_792_458);
    assert.equal(SOLAR_RADIUS, 695_700_000);
    assert.equal(CHANDRASEKHAR_LIMIT_SOLAR_MASSES, 1.44);
    assert.equal(TOV_LIMIT_SOLAR_MASSES, 2.17);
    assert.equal(NEUTRON_STAR_MASS_DROP_OFF_SOLAR_MASSES, 2.51);
});

for (const entry of fixture.mainSequenceLifetime) {
    test(`main-sequence lifetime: ${entry.case}`, () => {
        assertQuantity(mainSequenceLifetime(entry.body), entry.millionYears);
    });
}

test('a heavier star burns out sooner', () => {
    const light = mainSequenceLifetime({ StellarMass: 0.5 }) ?? 0;
    const solar = mainSequenceLifetime({ StellarMass: 1 }) ?? 0;
    const heavy = mainSequenceLifetime({ StellarMass: 5 }) ?? 0;
    assert.ok(light > solar && solar > heavy);
});

for (const entry of fixture.absoluteBolometricMagnitude) {
    test(`absolute bolometric magnitude: ${entry.case}`, () => {
        assertQuantity(absoluteBolometricMagnitude(entry.body), entry.magnitude);
    });
}

test('a magnitude needs a radius as well as a temperature', () => {
    assert.equal(absoluteBolometricMagnitude({ SurfaceTemperature: 5772 }), null);
    assert.equal(absoluteBolometricMagnitude({ Radius: 0, SurfaceTemperature: 5772 }), null);
});

for (const entry of fixture.schwarzschildRadius) {
    test(`Schwarzschild radius: ${entry.case}`, () => {
        assertQuantity(schwarzschildRadius(entry.body), entry.metres);
    });
}

test('the Schwarzschild radius scales with the mass', () => {
    const one = schwarzschildRadius({ StellarMass: 1 }) ?? 0;
    const two = schwarzschildRadius({ StellarMass: 2 }) ?? 0;
    assert.ok(Math.abs(two / one - 2) < 1e-12);
});

for (const entry of fixture.massStability) {
    test(`mass stability: ${entry.case}`, () => {
        assert.deepEqual(assessMassStability(entry.body), entry.assessment);
    });
}

test('a mass exactly at a limit has not passed it', () => {
    assert.equal(assessMassStability({ StarType: 'N', StellarMass: TOV_LIMIT_SOLAR_MASSES }), null);
    assert.equal(
        assessMassStability({ StarType: 'DA', StellarMass: CHANDRASEKHAR_LIMIT_SOLAR_MASSES }),
        null,
    );
});

test('mass stability needs both a kind and a mass', () => {
    assert.equal(assessMassStability({ StellarMass: 3 }), null);
    assert.equal(assessMassStability({ StarType: 'N' }), null);
});

for (const entry of fixture.neutronStarClass) {
    test(`neutron-star class: ${entry.case}`, () => {
        assert.equal(classifyNeutronStar(entry.body), entry.class as NeutronStarClass | null);
    });
}

test('a neutron-star class needs a mass, a rotation and a magnitude', () => {
    assert.equal(classifyNeutronStar({ RotationPeriod: 0.05, AbsoluteMagnitude: 12 }), null);
    assert.equal(classifyNeutronStar({ StellarMass: 1.5, AbsoluteMagnitude: 12 }), null);
    assert.equal(classifyNeutronStar({ StellarMass: 1.5, RotationPeriod: 0.05 }), null);
});

test('every entry point rejects a non-object body with a named TypeError', () => {
    const notABody = undefined as unknown as Record<string, never>;
    assert.throws(() => mainSequenceLifetime(notABody), /mainSequenceLifetime: body/);
    assert.throws(() => absoluteBolometricMagnitude(notABody), /absoluteBolometricMagnitude: body/);
    assert.throws(() => schwarzschildRadius(notABody), /schwarzschildRadius: body/);
    assert.throws(() => assessMassStability(notABody), /assessMassStability: body/);
    assert.throws(() => classifyNeutronStar(notABody), /classifyNeutronStar: body/);
});
