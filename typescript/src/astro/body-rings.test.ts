import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    isInvisibleRing,
    ringDynamics,
    ringParticleDensity,
    ringRocheLimits,
    ringSurfaceDensity,
    RING_NOMINAL_RADIUS_FRACTION,
    VISIBLE_RING_MAX_WIDTH,
    VISIBLE_RING_MIN_SURFACE_DENSITY,
} from './body-rings.js';
import { rocheLimitsForDensity } from './body-physics.js';
import { assertQuantity } from './internal/body-calculation-tests.js';
import fixture from '../../../fixtures/astro/body-calculations.jsonc' with { type: 'json' };

const ICY_RING = {
    Name: 'Test A Ring',
    RingClass: 'eRingClass_Icy',
    MassMT: 1e13,
    InnerRad: 1e8,
    OuterRad: 2e8,
};

test('the Canonn thresholds are the ones the heuristics use', () => {
    assert.equal(RING_NOMINAL_RADIUS_FRACTION, 3 / 8);
    assert.equal(VISIBLE_RING_MIN_SURFACE_DENSITY, 0.1);
    assert.equal(VISIBLE_RING_MAX_WIDTH, 1e9);
});

for (const entry of fixture.ringParticleDensity) {
    test(`${entry.ringClass} particles are assumed to be ${entry.kgPerCubicMetre} kg/m³`, () => {
        assert.equal(ringParticleDensity(entry.ringClass), entry.kgPerCubicMetre);
    });
}

test('a ring class matches however the game cases it', () => {
    assert.equal(ringParticleDensity('eringclass_rocky'), 3000);
    assert.equal(ringParticleDensity('ERINGCLASS_METALRICH'), 4500);
});

test('a class is a required argument, not a lookup that can miss', () => {
    assert.throws(
        () => ringParticleDensity(undefined as unknown as string),
        /ringParticleDensity: ringClass/,
    );
});

for (const entry of fixture.ringSurfaceDensity) {
    test(`ring surface density: ${entry.case}`, () => {
        assertQuantity(ringSurfaceDensity(entry.ring), entry.megatonnesPerSquareKilometre);
        assert.equal(isInvisibleRing(entry.ring), entry.invisible);
    });
}

test('a ring with no mass written has no surface density, and is not called invisible', () => {
    const massless = { ...ICY_RING, MassMT: 0 };
    assert.equal(ringSurfaceDensity(massless), null);
    assert.equal(isInvisibleRing(massless), false);
});

test('width and density are both required for a ring to go undrawn', () => {
    // Wide enough, but far too much mass in it to disappear.
    const wideAndHeavy = { ...ICY_RING, MassMT: 1e18, InnerRad: 1e9, OuterRad: 3e9 };
    assert.ok((ringSurfaceDensity(wideAndHeavy) ?? 0) > VISIBLE_RING_MIN_SURFACE_DENSITY);
    assert.equal(isInvisibleRing(wideAndHeavy), false);
});

for (const entry of fixture.ringDynamics) {
    test(`ring dynamics: ${entry.case}`, () => {
        const dynamics = ringDynamics(entry.ring, entry.primary);
        assertQuantity(dynamics?.nominalRadius, entry.nominalRadius);
        assertQuantity(dynamics?.orbitalPeriod, entry.orbitalPeriod);
        assertQuantity(dynamics?.innerVelocity, entry.innerVelocity);
        assertQuantity(dynamics?.outerVelocity, entry.outerVelocity);
    });
}

test('the game turns a ring rigidly, so its outer edge is the faster one', () => {
    const dynamics = ringDynamics(ICY_RING, { MassEM: 300 });
    assert.ok(dynamics !== null);
    assert.ok(dynamics.outerVelocity > dynamics.innerVelocity);
    // Both edges share one period, so the speeds are in the ratio of the radii.
    assert.ok(
        Math.abs(
            dynamics.outerVelocity / dynamics.innerVelocity - ICY_RING.OuterRad / ICY_RING.InnerRad,
        ) < 1e-9,
    );
});

test('the nominal radius sits three eighths of the way across the ring', () => {
    const dynamics = ringDynamics(ICY_RING, { MassEM: 300 });
    const expected =
        ICY_RING.InnerRad + (ICY_RING.OuterRad - ICY_RING.InnerRad) * RING_NOMINAL_RADIUS_FRACTION;
    assert.equal(dynamics?.nominalRadius, expected);
});

test('ring dynamics need usable radii', () => {
    assert.equal(ringDynamics({ ...ICY_RING, InnerRad: 0 }, { MassEM: 300 }), null);
    assert.equal(ringDynamics({ ...ICY_RING, OuterRad: 1e7 }, { MassEM: 300 }), null);
});

test('a ring is judged against the Roche limit for the material it is made of', () => {
    const primary = { MassEM: 1, Radius: 6_371_000 };
    assert.deepEqual(ringRocheLimits(ICY_RING, primary), rocheLimitsForDensity(primary, 1000));
    assert.deepEqual(
        ringRocheLimits({ ...ICY_RING, RingClass: 'eRingClass_MetalRich' }, primary),
        rocheLimitsForDensity(primary, 4500),
    );
});

test('a ring about a primary with no density has no Roche limits', () => {
    assert.equal(ringRocheLimits(ICY_RING, { MassEM: 1 }), null);
});

test('every entry point rejects a non-object ring with a named TypeError', () => {
    const notARing = undefined as unknown as typeof ICY_RING;
    assert.throws(() => ringSurfaceDensity(notARing), /ringSurfaceDensity: ring/);
    assert.throws(() => isInvisibleRing(notARing), /isInvisibleRing: ring/);
    assert.throws(() => ringDynamics(notARing, {}), /ringDynamics: ring/);
    assert.throws(() => ringRocheLimits(notARing, {}), /ringRocheLimits: ring/);
});
