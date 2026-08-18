import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    OVERHEAT_HEAT_LEVEL,
    effectiveWeaponThermalLoad,
    equilibriumHeatLevel,
    heatLevelAtTime,
    heatMetrics,
    secondsToHeatLevel,
    type HeatInput,
} from './heat.js';
import fixture from '../../../fixtures/ships/heat.jsonc' with { type: 'json' };

/** The fixture rounds to 12 dp; `1e-9` catches any real change in the maths. */
const TOLERANCE = 1e-9;
const close = (actual: number, expected: number, what: string): void => {
    assert.ok(
        Math.abs(actual - expected) < TOLERANCE,
        `${what}: got ${actual}, expected ${expected}`,
    );
};

/** JSON carries no infinity, so the fixture writes `null` for an unbounded figure. */
const unbounded = (value: number | null): number => value ?? Infinity;

const HULL = { heatCapacity: 100, heatDissipation: 50 };

test('the overheating point is heat level 1.5 — what the gauge shows as 100%', () => {
    assert.equal(OVERHEAT_HEAT_LEVEL, fixture.overheatHeatLevel);
});

test('heat settles where the square-law dissipation matches the load', () => {
    for (const expected of fixture.equilibrium) {
        assert.equal(
            equilibriumHeatLevel(expected.dissipation, expected.thermalLoad),
            unbounded(expected.heatLevel),
            `${expected.thermalLoad} against ${expected.dissipation}`,
        );
    }
});

test('equilibriumHeatLevel rejects figures that are not finite and non-negative', () => {
    assert.throws(() => equilibriumHeatLevel(-1, 10), RangeError);
    assert.throws(() => equilibriumHeatLevel(10, -1), RangeError);
    assert.throws(() => equilibriumHeatLevel(Infinity, 10), RangeError);
    assert.throws(() => equilibriumHeatLevel(10, Number.NaN), RangeError);
});

test('a drained weapons capacitor multiplies a weapon thermal load by five', () => {
    for (const expected of fixture.weaponThermalLoad) {
        close(
            effectiveWeaponThermalLoad(
                expected.thermalLoad,
                expected.distributorDraw,
                expected.weaponsCapacity,
                expected.capacitorLevel,
            ),
            expected.effective,
            `load ${expected.thermalLoad} at capacitor ${expected.capacitorLevel}`,
        );
    }
});

test('the capacitor multiplier follows what the shot leaves behind', () => {
    // Half a capacitor, and the shot empties it: the full penalty.
    assert.equal(effectiveWeaponThermalLoad(1, 10, 20, 0.5), 5);
    // The same shot with a quarter of the capacitor still to spare.
    assert.equal(effectiveWeaponThermalLoad(1, 5, 20, 0.5), 4);
    // A draw beyond the whole capacitor cannot be worse than firing on empty.
    assert.equal(effectiveWeaponThermalLoad(1, 400, 20, 1), 5);
});

test('effectiveWeaponThermalLoad rejects impossible capacitor states', () => {
    assert.throws(() => effectiveWeaponThermalLoad(1, 1, 10, 1.5), RangeError);
    assert.throws(() => effectiveWeaponThermalLoad(1, 1, 10, -0.1), RangeError);
    assert.throws(() => effectiveWeaponThermalLoad(-1, 1, 10, 1), RangeError);
    assert.throws(() => effectiveWeaponThermalLoad(1, -1, 10, 1), RangeError);
    assert.throws(() => effectiveWeaponThermalLoad(1, 1, -10, 1), RangeError);
});

test('heat follows the model through time, in both directions', () => {
    for (const [index, expected] of fixture.transient.entries()) {
        const where = `transient case ${index}`;
        const params = {
            heatCapacity: expected.heatCapacity,
            heatDissipation: expected.heatDissipation,
            thermalLoad: expected.thermalLoad,
            startLevel: expected.startLevel,
        };
        if ('heatLevel' in expected && expected.heatLevel !== undefined) {
            close(
                heatLevelAtTime({ ...params, seconds: expected.seconds ?? 0 }),
                expected.heatLevel,
                where,
            );
        }
        if ('targetLevel' in expected && expected.targetLevel !== undefined) {
            const seconds = secondsToHeatLevel({ ...params, targetLevel: expected.targetLevel });
            if (expected.seconds === null) assert.equal(seconds, Infinity, where);
            else close(seconds, expected.seconds ?? 0, where);
        }
    }
});

test('the two time functions are inverses of each other', () => {
    const params = { ...HULL, thermalLoad: 90, startLevel: 0.2 };
    for (const seconds of [0.5, 3, 12]) {
        const level = heatLevelAtTime({ ...params, seconds });
        close(secondsToHeatLevel({ ...params, targetLevel: level }), seconds, `${seconds}s`);
    }
});

test('a load beyond dissipation crosses heat level 1 and then climbs at a steady rate', () => {
    const params = { ...HULL, thermalLoad: 100, startLevel: 0 };
    const secondsToOne = secondsToHeatLevel({ ...params, targetLevel: 1 });
    close(heatLevelAtTime({ ...params, seconds: secondsToOne }), 1, 'the crossing itself');
    // Above level 1 the hull sheds a flat 50 of the 100 being made: 0.5 levels a second.
    close(heatLevelAtTime({ ...params, seconds: secondsToOne + 2 }), 2, 'two seconds past it');
    close(
        secondsToHeatLevel({ ...params, targetLevel: 2 }) - secondsToOne,
        2,
        'and the same time back',
    );
});

test('a level the load never reaches takes forever, heating or cooling', () => {
    // Settles at level 1, so 1 itself and anything above is out of reach.
    assert.equal(
        secondsToHeatLevel({ ...HULL, thermalLoad: 50, startLevel: 0, targetLevel: 1 }),
        Infinity,
    );
    assert.equal(
        secondsToHeatLevel({ ...HULL, thermalLoad: 50, startLevel: 0, targetLevel: 1.2 }),
        Infinity,
    );
    // Cooling stops at the same level, and nothing ever reaches stone cold.
    assert.equal(
        secondsToHeatLevel({ ...HULL, thermalLoad: 50, startLevel: 1.4, targetLevel: 0.5 }),
        Infinity,
    );
    assert.equal(
        secondsToHeatLevel({ ...HULL, thermalLoad: 0, startLevel: 0.5, targetLevel: 0 }),
        Infinity,
    );
    assert.equal(
        secondsToHeatLevel({ ...HULL, thermalLoad: 0, startLevel: 0.5, targetLevel: 0.9 }),
        Infinity,
    );
    // Standing still costs nothing and takes no time.
    assert.equal(
        secondsToHeatLevel({ ...HULL, thermalLoad: 50, startLevel: 1, targetLevel: 1 }),
        0,
    );
    assert.equal(heatLevelAtTime({ ...HULL, thermalLoad: 50, startLevel: 0.4, seconds: 0 }), 0.4);
});

test('a build parked at its settled level stays there', () => {
    const settled = equilibriumHeatLevel(50, 12.5);
    close(
        heatLevelAtTime({ ...HULL, thermalLoad: 12.5, startLevel: settled, seconds: 30 }),
        settled,
        'settled',
    );
});

test('heat falls back towards the settled level from above it', () => {
    const cooling = heatLevelAtTime({ ...HULL, thermalLoad: 12.5, startLevel: 1.4, seconds: 4 });
    assert.ok(cooling < 1 && cooling > equilibriumHeatLevel(50, 12.5), `${cooling}`);
    // Long enough, and it arrives.
    close(
        heatLevelAtTime({ ...HULL, thermalLoad: 12.5, startLevel: 1.4, seconds: 600 }),
        equilibriumHeatLevel(50, 12.5),
        'eventually settled',
    );
    // A hull cooling with the guns quiet approaches zero without reaching it.
    const cold = heatLevelAtTime({ ...HULL, thermalLoad: 0, startLevel: 0.8, seconds: 100 });
    assert.ok(cold > 0 && cold < 0.03, `${cold}`);
    assert.equal(heatLevelAtTime({ ...HULL, thermalLoad: 0, startLevel: 0, seconds: 10 }), 0);
});

test('a hull that sheds nothing only ever heats, at a flat rate', () => {
    const params = { heatCapacity: 100, heatDissipation: 0, thermalLoad: 50, startLevel: 0 };
    assert.equal(heatLevelAtTime({ ...params, seconds: 2 }), 1);
    assert.equal(secondsToHeatLevel({ ...params, targetLevel: 1.5 }), 3);
    assert.equal(secondsToHeatLevel({ ...params, startLevel: 1, targetLevel: 0.5 }), Infinity);
    assert.equal(
        secondsToHeatLevel({ ...params, thermalLoad: 0, targetLevel: 1 }),
        Infinity,
        'and with no load it never moves at all',
    );
});

test('the time functions reject figures that are not finite and non-negative', () => {
    const params = { ...HULL, thermalLoad: 10, startLevel: 0 };
    assert.throws(() => heatLevelAtTime({ ...params, seconds: -1 }), RangeError);
    assert.throws(() => heatLevelAtTime({ ...params, startLevel: -1, seconds: 1 }), RangeError);
    assert.throws(() => heatLevelAtTime({ ...params, heatCapacity: 0, seconds: 1 }), RangeError);
    assert.throws(
        () => heatLevelAtTime({ ...params, thermalLoad: Infinity, seconds: 1 }),
        RangeError,
    );
    assert.throws(() => secondsToHeatLevel({ ...params, targetLevel: -1 }), RangeError);
    assert.throws(
        () => secondsToHeatLevel({ ...params, heatDissipation: -1, targetLevel: 1 }),
        RangeError,
    );
});

// ── heatMetrics ─────────────────────────────────────────────────────────────

const INPUT: HeatInput = {
    heatCapacity: 334,
    heatDissipation: 67.15,
    heatEfficiency: 0.4,
    retractedPowerDraw: 20,
    deployedPowerDraw: 30,
    thrusterHeatRate: 1.5,
    fsdHeatRate: 30,
    weaponsCapacity: 25,
    weapons: [{ heatPerSecond: 6, distributorDraw: 2.5 }],
};

test('each scenario adds its own load to the one before it', () => {
    const heat = heatMetrics(INPUT);
    assert.equal(heat.heatEfficiency, 0.4);
    assert.equal(heat.hullHeatCapacity, 334);
    assert.equal(heat.hullHeatDissipation, 67.15);
    assert.equal(heat.idle.thermalLoad, 8); // 20 MW × 0.4
    assert.equal(heat.thrusters.thermalLoad, 9.5);
    assert.equal(heat.fsdCharging.thermalLoad, 39.5);
    // Deployed draw, the thrusters, and the guns at 1 + 4 × (2.5 / 25) of their load.
    close(heat.firingSustained.thermalLoad, 12 + 1.5 + 6 * 1.4, 'firing, capacitor full');
    close(heat.firingDrained.thermalLoad, 12 + 1.5 + 30, 'firing, capacitor empty');
});

test('a settled build reports its level both ways and never overheats', () => {
    const heat = heatMetrics(INPUT);
    close(heat.idle.heatLevel, Math.sqrt(8 / 67.15), 'idle level');
    close(heat.idle.gauge, Math.sqrt(8 / 67.15) / OVERHEAT_HEAT_LEVEL, 'idle gauge');
    assert.equal(heat.idle.overheats, false);
    assert.equal(heat.idle.secondsToOverheat, null);
});

test('a load beyond the hull settles nowhere, and is timed to the gauge instead', () => {
    const heat = heatMetrics({ ...INPUT, weapons: [{ heatPerSecond: 80, distributorDraw: 0 }] });
    assert.equal(heat.firingSustained.overheats, true);
    assert.equal(heat.firingSustained.heatLevel, Infinity);
    assert.equal(heat.firingSustained.gauge, Infinity);
    // Counted from the level the build sits at with the guns quiet but the hardpoints out.
    const expected = secondsToHeatLevel({
        heatCapacity: 334,
        heatDissipation: 67.15,
        thermalLoad: heat.firingSustained.thermalLoad,
        startLevel: equilibriumHeatLevel(67.15, 13.5),
        targetLevel: OVERHEAT_HEAT_LEVEL,
    });
    close(heat.firingSustained.secondsToOverheat ?? 0, expected, 'seconds to 100%');
    assert.ok((heat.firingSustained.secondsToOverheat ?? 0) > 0);
});

test('a scenario whose own baseline runs away is timed from heat level 1', () => {
    // The plant alone makes more than the hull can shed, so there is no settled start.
    const heat = heatMetrics({
        ...INPUT,
        retractedPowerDraw: 200,
        deployedPowerDraw: 200,
        weapons: [{ heatPerSecond: 20, distributorDraw: 0 }],
    });
    assert.equal(heat.idle.overheats, true);
    const expected = secondsToHeatLevel({
        heatCapacity: 334,
        heatDissipation: 67.15,
        thermalLoad: heat.firingSustained.thermalLoad,
        startLevel: 1,
        targetLevel: OVERHEAT_HEAT_LEVEL,
    });
    close(heat.firingSustained.secondsToOverheat ?? 0, expected, 'seconds from level 1');
});

test('the optional parts of a build default to contributing nothing', () => {
    const heat = heatMetrics({ heatCapacity: 334, heatDissipation: 67.15, heatEfficiency: 0.4 });
    assert.equal(heat.idle.thermalLoad, 0);
    assert.equal(heat.idle.heatLevel, 0);
    assert.equal(heat.thrusters.thermalLoad, 0);
    assert.equal(heat.firingDrained.thermalLoad, 0);
    // Deployed draw defaults to the retracted figure rather than to zero.
    const stowedOnly: HeatInput = {
        heatCapacity: 334,
        heatDissipation: 67.15,
        heatEfficiency: 0.4,
        retractedPowerDraw: 20,
    };
    assert.equal(
        heatMetrics(stowedOnly).firingSustained.thermalLoad,
        heatMetrics({ ...stowedOnly, deployedPowerDraw: 20 }).firingSustained.thermalLoad,
    );
});

test('thrusters the plant stops feeding once the hardpoints are out make no heat', () => {
    const shed = heatMetrics({ ...INPUT, deployedThrusterHeatRate: 0 });
    // Stowed is unaffected; deploying drops the thrusters' contribution from the base.
    assert.equal(shed.thrusters.thermalLoad, heatMetrics(INPUT).thrusters.thermalLoad);
    close(
        heatMetrics(INPUT).firingSustained.thermalLoad - shed.firingSustained.thermalLoad,
        1.5,
        'the thrusters drop out of the firing scenarios',
    );
});

test('weapons with no capacitor behind them all fire on empty', () => {
    const heat = heatMetrics({ ...INPUT, weaponsCapacity: 0 });
    close(heat.firingSustained.thermalLoad, heat.firingDrained.thermalLoad, 'no distributor');
});

test('heatMetrics rejects figures that are not finite and non-negative', () => {
    assert.throws(() => heatMetrics({ ...INPUT, heatCapacity: 0 }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, heatDissipation: -1 }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, heatEfficiency: Number.NaN }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, retractedPowerDraw: -1 }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, deployedPowerDraw: Infinity }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, thrusterHeatRate: -1 }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, deployedThrusterHeatRate: -1 }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, fsdHeatRate: -1 }), RangeError);
    assert.throws(() => heatMetrics({ ...INPUT, weaponsCapacity: -1 }), RangeError);
});
