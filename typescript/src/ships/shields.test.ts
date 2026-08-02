import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shieldMassCurveMultiplier, shieldMetrics, shieldStrength } from './shields.js';
import { getModuleBySymbol } from './modules.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { getShipBySymbol } from './ships.js';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

/** A 6A shield generator — a catalogue record is a valid generator input as-is. */
const generator = getModuleBySymbol('Int_ShieldGenerator_Size6_Class5', INTERNAL_MODULES)!;

test("the mass curve passes through the generator's three declared points", () => {
    assert.ok(
        near(shieldMassCurveMultiplier(generator.optMass!, generator), generator.optMultiplier!),
    );
    assert.ok(
        near(shieldMassCurveMultiplier(generator.maxMass!, generator), generator.minMultiplier!),
    );
    assert.ok(
        near(shieldMassCurveMultiplier(generator.minMass!, generator), generator.maxMultiplier!),
    );
});

test('the curve falls as the hull gets heavier, and stops at maximum mass', () => {
    const light = shieldMassCurveMultiplier(300, generator);
    const heavy = shieldMassCurveMultiplier(900, generator);
    assert.ok(light > heavy);
    // A hull past the generator's maximum mass gets no shield at all.
    assert.equal(shieldMassCurveMultiplier(generator.maxMass! + 1, generator), 0);
    // A featherweight hull is capped at the generator's best multiplier.
    assert.ok(near(shieldMassCurveMultiplier(1, generator), generator.maxMultiplier!));
});

test("shield strength is the hull's base times the curve times the boosters", () => {
    const anaconda = getShipBySymbol('Anaconda')!;
    const curve = shieldMassCurveMultiplier(anaconda.hullMass!, generator);
    assert.ok(
        near(
            shieldStrength(anaconda.hullMass!, anaconda.baseShieldStrength!, generator),
            anaconda.baseShieldStrength! * curve,
        ),
    );
    assert.ok(
        near(
            shieldStrength(anaconda.hullMass!, anaconda.baseShieldStrength!, generator, 1.4),
            anaconda.baseShieldStrength! * curve * 1.4,
        ),
    );
});

test('shieldMetrics splits the strength between generator, boosters and reinforcement', () => {
    const metrics = shieldMetrics({
        hullMass: 400,
        baseShieldStrength: 350,
        generator,
        boosters: [{ shieldBoost: 0.2 }, { shieldBoost: 0.2 }],
        reinforcement: 64,
    });
    assert.ok(near(metrics.boostMultiplier, 1.4));
    assert.ok(near(metrics.boosters, metrics.generator * 0.4));
    assert.equal(metrics.reinforcement, 64);
    assert.ok(near(metrics.strength, metrics.generator + metrics.boosters + 64));
});

test('a build with no generator reports zero shields but well-defined figures', () => {
    const metrics = shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator: null });
    assert.equal(metrics.strength, 0);
    assert.equal(metrics.generator, 0);
    assert.equal(metrics.massCurveMultiplier, 0);
    assert.equal(metrics.boostMultiplier, 1);
    assert.deepEqual(metrics.resistances, { kinetic: 0, thermal: 0, explosive: 0, caustic: 0 });
});

test('resistances come from the generator, the boosters and the pips', () => {
    const bare = shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator });
    // A stock generator resists kinetic and explosive damage and is weak to thermal.
    assert.ok(near(bare.resistances.kinetic, 0.4));
    assert.ok(near(bare.resistances.thermal, -0.2));
    assert.ok(near(bare.resistances.explosive, 0.5));
    assert.equal(bare.systemsResistance, 0);

    const boosted = shieldMetrics({
        hullMass: 400,
        baseShieldStrength: 350,
        generator,
        boosters: [{ kineticResistance: 0.2 }, { kineticResistance: 0.2 }],
    });
    assert.ok(boosted.resistances.kinetic > bare.resistances.kinetic);

    const pipped = shieldMetrics({
        hullMass: 400,
        baseShieldStrength: 350,
        generator,
        systemsPips: 4,
    });
    // Pips multiply with the shield's own resistance rather than adding to it.
    assert.ok(near(pipped.resistances.kinetic, 1 - 0.6 * 0.4));
    assert.ok(near(pipped.resistances.caustic, 0.6));
    assert.ok(near(pipped.systemsResistance, 0.6));
});

test('effective hit points scale the strength by each resistance', () => {
    const metrics = shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator });
    assert.ok(
        near(
            metrics.effectiveHitPoints.kinetic,
            metrics.strength / (1 - metrics.resistances.kinetic),
        ),
    );
    // A thermal weakness means fewer effective hit points than the raw strength.
    assert.ok(metrics.effectiveHitPoints.thermal < metrics.strength);
});

test('a generator with no curve at all raises no shield', () => {
    assert.equal(shieldMassCurveMultiplier(400, {}), 0);
    assert.equal(
        shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator: {} }).strength,
        0,
    );
});

test('a degenerate curve falls back to the optimal multiplier', () => {
    const flat = {
        minMass: 100,
        optMass: 100,
        maxMass: 100,
        minMultiplier: 1,
        optMultiplier: 1.2,
        maxMultiplier: 1.4,
    };
    assert.equal(shieldMassCurveMultiplier(100, flat), 1.2);
    const noSpread = {
        minMass: 100,
        optMass: 200,
        maxMass: 300,
        minMultiplier: 1,
        optMultiplier: 1,
        maxMultiplier: 1,
    };
    assert.equal(shieldMassCurveMultiplier(150, noSpread), 1);
});
