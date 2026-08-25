import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shieldMassCurveMultiplier, shieldMetrics, shieldStrength } from './shields.js';
import { thrusterMassCurveMultiplier } from './mobility.js';
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
    // A build with no shield soaks nothing, whatever the resistances say — the empty
    // pool must not report Infinity or NaN.
    assert.deepEqual(metrics.effectiveHitPoints, {
        kinetic: 0,
        thermal: 0,
        explosive: 0,
        caustic: 0,
    });
});

test('resistances come from the generator and the boosters, and nothing else', () => {
    const bare = shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator });
    // A stock generator resists kinetic and explosive damage and is weak to thermal.
    assert.ok(near(bare.resistances.kinetic, 0.4));
    assert.ok(near(bare.resistances.thermal, -0.2));
    assert.ok(near(bare.resistances.explosive, 0.5));
    // Nothing a generator does not carry appears: caustic is untouched, and the SYS
    // pips belong to `shieldCapacitorMetrics` rather than to the bare shield.
    assert.equal(bare.resistances.caustic, 0);
    assert.equal(Object.hasOwn(bare, 'systemsResistance'), false);

    const boosted = shieldMetrics({
        hullMass: 400,
        baseShieldStrength: 350,
        generator,
        boosters: [{ kineticResistance: 0.2 }, { kineticResistance: 0.2 }],
    });
    assert.ok(boosted.resistances.kinetic > bare.resistances.kinetic);
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

test('a constant curve answers its one multiplier', () => {
    const noSpread = {
        minMass: 100,
        optMass: 200,
        maxMass: 300,
        minMultiplier: 1,
        optMultiplier: 1,
        maxMultiplier: 1,
    };
    assert.equal(shieldMassCurveMultiplier(150, noSpread), 1);
    // Three equal masses are a curve only when the multipliers agree too.
    const point = {
        minMass: 100,
        optMass: 100,
        maxMass: 100,
        minMultiplier: 1.2,
        optMultiplier: 1.2,
        maxMultiplier: 1.2,
    };
    assert.equal(shieldMassCurveMultiplier(100, point), 1.2);
});

test('a non-physical curve is a RangeError, not a fabricated multiplier', () => {
    const physical = {
        minMass: 270,
        optMass: 540,
        maxMass: 1350,
        minMultiplier: 0.7,
        optMultiplier: 1.2,
        maxMultiplier: 1.7,
    };
    // The optimal mass sitting on the maximum used to answer maxMultiplier, which looks
    // like a shield and is not one.
    assert.throws(
        () => shieldMassCurveMultiplier(400, { ...physical, optMass: 1350 }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'shieldMassCurveMultiplier: generator: masses must be strictly ordered minMass < optMass < maxMass, or all equal',
    );
    assert.throws(
        () => shieldMassCurveMultiplier(400, { ...physical, minMass: -1 }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'shieldMassCurveMultiplier: generator: minMass must be a finite non-negative number',
    );
    assert.throws(
        () => shieldMassCurveMultiplier(400, { ...physical, optMultiplier: Number.NaN }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'shieldMassCurveMultiplier: generator: optMultiplier must be a finite non-negative number',
    );
    assert.throws(
        () => shieldMassCurveMultiplier(400, { ...physical, maxMultiplier: 0.1 }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'shieldMassCurveMultiplier: generator: multipliers must be strictly ordered minMultiplier < optMultiplier < maxMultiplier, or all equal',
    );
    assert.throws(
        () =>
            shieldMassCurveMultiplier(400, {
                minMass: 100,
                optMass: 100,
                maxMass: 100,
                minMultiplier: 1,
                optMultiplier: 1.2,
                maxMultiplier: 1.4,
            }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'shieldMassCurveMultiplier: generator: an all-equal mass curve must have equal multipliers',
    );
    // The hull mass is held to the same standard as the curve it is read against.
    assert.throws(
        () => shieldMassCurveMultiplier(Number.NaN, physical),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'shieldMassCurveMultiplier: hullMass must be a finite non-negative number',
    );
    assert.throws(() => shieldMassCurveMultiplier(-1, physical), RangeError);
});

test('an incomplete catalogue record is still zero, not a failure', () => {
    const partial = { optMass: 540, optMultiplier: 1.2 };
    // Missing curve data is missing data; the hull mass is never even read.
    assert.equal(shieldMassCurveMultiplier(Number.NaN, partial), 0);
    assert.equal(shieldStrength(Number.NaN, 350, partial), 0);
    assert.equal(
        shieldMetrics({ hullMass: Number.NaN, baseShieldStrength: 350, generator: partial })
            .massCurveMultiplier,
        0,
    );
});

test('a curve failure names the public function the consumer called', () => {
    const broken = {
        minMass: 270,
        optMass: 1350,
        maxMass: 1350,
        minMultiplier: 0.7,
        optMultiplier: 1.2,
        maxMultiplier: 1.7,
    };
    for (const [scope, call] of [
        ['shieldMassCurveMultiplier', () => shieldMassCurveMultiplier(400, broken)],
        ['shieldStrength', () => shieldStrength(400, 350, broken)],
        [
            'shieldMetrics',
            () => shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator: broken }),
        ],
    ] as const) {
        assert.throws(
            call,
            (error: unknown) =>
                error instanceof RangeError && error.message.startsWith(`${scope}: generator: `),
            scope,
        );
    }
});

test('an ordered curve with no exponent that fits it is a RangeError too', () => {
    // The optimal point is distinct from both endpoints and still rounds onto one when
    // normalised, so the power law has no exponent — the last curve that could produce a
    // silent multiplier.
    assert.throws(
        () =>
            shieldMassCurveMultiplier(1, {
                minMass: 0,
                optMass: Number.MIN_VALUE,
                maxMass: 1e308,
                minMultiplier: 0.7,
                optMultiplier: 1.2,
                maxMultiplier: 1.7,
            }),
        (error: unknown) =>
            error instanceof RangeError &&
            error.message ===
                'shieldMassCurveMultiplier: curve values do not produce a finite exponent',
    );
});

test('the shield and thruster mass curves are one curve with one failure model', () => {
    const curves = [
        {
            minMass: 270,
            optMass: 540,
            maxMass: 1350,
            minMultiplier: 0.7,
            optMultiplier: 1.2,
            maxMultiplier: 1.7,
        },
        {
            minMass: 24,
            optMass: 48,
            maxMass: 72,
            minMultiplier: 0.83,
            optMultiplier: 1,
            maxMultiplier: 1.03,
        },
        {
            minMass: 100,
            optMass: 100,
            maxMass: 100,
            minMultiplier: 1.2,
            optMultiplier: 1.2,
            maxMultiplier: 1.2,
        },
    ];
    for (const curve of curves) {
        for (const mass of [0, 30, 100, 400, 540, 1350, 2000]) {
            assert.equal(
                shieldMassCurveMultiplier(mass, curve),
                thrusterMassCurveMultiplier(mass, curve),
                `${mass} t on ${JSON.stringify(curve)}`,
            );
        }
    }
    // And where one refuses the input, so does the other — the same reason, differing
    // only in the public names each reports.
    const nonPhysical = { ...curves[0]!, optMass: 1350 };
    assert.throws(() => shieldMassCurveMultiplier(400, nonPhysical), RangeError);
    assert.throws(() => thrusterMassCurveMultiplier(400, nonPhysical), RangeError);
});

test('shieldMetrics returns a frozen result, both with and without a generator', () => {
    const metrics = shieldMetrics({ hullMass: 400, baseShieldStrength: 350, generator });
    assert.ok(Object.isFrozen(metrics));
    assert.ok(Object.isFrozen(metrics.resistances));
    assert.ok(Object.isFrozen(metrics.effectiveHitPoints));
    assert.throws(() => {
        (metrics as { strength: number }).strength = 0;
    }, TypeError);
    assert.throws(() => {
        (metrics.resistances as { thermal: number }).thermal = 0;
    }, TypeError);

    // The shieldless build takes the other return path, and holds the same contract.
    const bare = shieldMetrics({ hullMass: 400, baseShieldStrength: 350 });
    assert.ok(Object.isFrozen(bare));
    assert.ok(Object.isFrozen(bare.resistances));
    assert.ok(Object.isFrozen(bare.effectiveHitPoints));
});

test('resistances are unrounded fractions, as their documentation says', () => {
    // A nominal -20% thermal resistance comes back as the exact stacked double, not as
    // a display figure: consumers round, the calculation does not.
    const bare = shieldMetrics({
        hullMass: 400,
        baseShieldStrength: 350,
        generator: { ...generator, thermalResistance: -0.2 },
    });
    assert.notEqual(bare.resistances.thermal, -0.2);
    assert.ok(Math.abs(bare.resistances.thermal + 0.2) < 1e-12);
    assert.equal(Number(bare.resistances.thermal.toFixed(2)), -0.2);
});
