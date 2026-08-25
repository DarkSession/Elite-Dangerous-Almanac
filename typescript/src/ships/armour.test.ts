import { test } from 'node:test';
import assert from 'node:assert/strict';

import { armourMetrics } from './armour.js';
import { getModuleBySymbol } from './modules.js';
import { CORE_MODULES } from './modules-core.js';
import { INTERNAL_MODULES } from './modules-internal.js';
import { getShipBySymbol } from './ships.js';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

const anaconda = getShipBySymbol('Anaconda')!;
const lightweight = getModuleBySymbol('Anaconda_Armour_Grade1', CORE_MODULES)!;
const reactive = getModuleBySymbol('Anaconda_Armour_Reactive', CORE_MODULES)!;
const reinforcement = getModuleBySymbol('Int_HullReinforcement_Size5_Class2', INTERNAL_MODULES)!;

test("the bulkhead multiplies the hull's base armour", () => {
    const stock = armourMetrics({ baseArmour: anaconda.baseArmour!, bulkhead: lightweight });
    assert.equal(stock.hitPoints, 945); // 525 x 1.8
    assert.equal(stock.bulkheads, 945);
    assert.equal(stock.reinforcement, 0);

    const heavy = armourMetrics({ baseArmour: anaconda.baseArmour!, bulkhead: reactive });
    assert.equal(heavy.hitPoints, 525 * 3.5);
});

test('hull reinforcement packages add flat hit points', () => {
    const metrics = armourMetrics({
        baseArmour: anaconda.baseArmour!,
        bulkhead: reactive,
        reinforcements: [reinforcement, reinforcement],
    });
    assert.equal(metrics.reinforcement, reinforcement.hullReinforcement! * 2);
    assert.equal(metrics.hitPoints, metrics.bulkheads + metrics.reinforcement);
});

test("an engineered package's hull boost is a share of the hull's base armour", () => {
    const metrics = armourMetrics({
        baseArmour: 500,
        bulkhead: { hullBoost: 0 },
        reinforcements: [{ hullReinforcement: 100, hullBoost: 0.2 }],
    });
    assert.equal(metrics.reinforcement, 100 + 500 * 0.2);
});

test("no bulkhead at all still reports the hull's bare armour", () => {
    const metrics = armourMetrics({ baseArmour: 525 });
    assert.equal(metrics.hitPoints, 525);
    assert.deepEqual(metrics.resistances, { kinetic: 0, thermal: 0, explosive: 0, caustic: 0 });
});

test('resistances come from the bulkhead and stack with the reinforcement', () => {
    const bare = armourMetrics({ baseArmour: 525, bulkhead: lightweight });
    // Lightweight alloy is weak to kinetic and explosive damage.
    assert.ok(near(bare.resistances.kinetic, -0.2));
    assert.ok(near(bare.resistances.explosive, -0.4));
    assert.ok(near(bare.resistances.thermal, 0));

    const reinforced = armourMetrics({
        baseArmour: 525,
        bulkhead: reactive,
        reinforcements: [reinforcement],
    });
    // Reactive composite (+25% kinetic) with a 2.5% package: 1 - 0.75 x 0.975.
    assert.ok(near(reinforced.resistances.kinetic, 0.26875));
    assert.ok(near(reinforced.resistances.thermal, 1 - 1.4 * 0.975));
});

test('effective hit points scale the total by each resistance', () => {
    const metrics = armourMetrics({ baseArmour: 525, bulkhead: lightweight });
    assert.ok(
        near(
            metrics.effectiveHitPoints.kinetic,
            metrics.hitPoints / (1 - metrics.resistances.kinetic),
        ),
    );
    // A kinetic weakness means fewer effective hit points than the raw total.
    assert.ok(metrics.effectiveHitPoints.kinetic < metrics.hitPoints);
    // Nothing resists caustic damage on a stock hull, so the two agree.
    assert.ok(near(metrics.effectiveHitPoints.caustic, metrics.hitPoints));
});

test('module reinforcement is reported apart from the hull', () => {
    const metrics = armourMetrics({
        baseArmour: 525,
        bulkhead: lightweight,
        moduleReinforcements: [
            { moduleProtection: 0.3, integrity: 88 },
            { moduleProtection: 0.3, integrity: 88 },
        ],
    });
    assert.equal(metrics.moduleArmour, 176);
    // Protection stacks multiplicatively: 1 - 0.7 x 0.7.
    assert.ok(near(metrics.moduleProtection, 0.51));
    // ...and does not touch the hull's own figures.
    assert.equal(metrics.hitPoints, 945);
});

test('armourMetrics returns a frozen result, nested records included', () => {
    const metrics = armourMetrics({ baseArmour: anaconda.baseArmour!, bulkhead: reactive });
    assert.ok(Object.isFrozen(metrics));
    assert.ok(Object.isFrozen(metrics.resistances));
    assert.ok(Object.isFrozen(metrics.effectiveHitPoints));
    assert.throws(() => {
        (metrics as { hitPoints: number }).hitPoints = 0;
    }, TypeError);
    assert.throws(() => {
        (metrics.resistances as { kinetic: number }).kinetic = 0;
    }, TypeError);
});

test('armour resistances are unrounded fractions, as their documentation says', () => {
    const metrics = armourMetrics({
        baseArmour: 525,
        bulkhead: { hullBoost: 0.8, kineticResistance: -0.2, explosiveResistance: -0.4 },
    });
    assert.notEqual(metrics.resistances.kinetic, -0.2);
    assert.ok(Math.abs(metrics.resistances.kinetic + 0.2) < 1e-12);
    assert.equal(Number(metrics.resistances.kinetic.toFixed(2)), -0.2);
    assert.notEqual(metrics.resistances.explosive, -0.4);
    assert.ok(Math.abs(metrics.resistances.explosive + 0.4) < 1e-12);
});
