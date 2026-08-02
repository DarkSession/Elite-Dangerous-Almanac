import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    armourPiercingFactor,
    combinedRateOfFire,
    damageFalloff,
    damagePerSecond,
    energyPerSecond,
    heatPerSecond,
    splitDamage,
    sumWeaponMetrics,
    sustainedDamagePerSecond,
    sustainedFireFactor,
    weaponMetrics,
} from './weapons.js';
import { getModuleBySymbol } from './modules.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import fixture from '../../../fixtures/ships/build-metrics.json' with { type: 'json' };

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const weapon = (symbol: string) => getModuleBySymbol(symbol, HARDPOINT_MODULES)!;

test("catalogue weapons reproduce the fixture's DPS, EPS and heat", () => {
    for (const expected of fixture.weapons) {
        const metrics = weaponMetrics(weapon(expected.symbol));
        assert.ok(near(metrics.damagePerSecond, expected.damagePerSecond), expected.symbol);
        assert.ok(
            near(metrics.sustainedDamagePerSecond, expected.sustainedDamagePerSecond),
            expected.symbol,
        );
        assert.ok(near(metrics.energyPerSecond, expected.energyPerSecond), expected.symbol);
        assert.ok(near(metrics.heatPerSecond, expected.heatPerSecond), expected.symbol);
        assert.equal(metrics.continuous, expected.continuous, expected.symbol);
    }
});

test('DPS is damage x rounds x rate of fire', () => {
    const pulse = weapon('Hpt_PulseLaser_Fixed_Small');
    assert.ok(near(damagePerSecond(pulse), pulse.damage! * pulse.rateOfFire!));
    // A shard cannon fires a dozen rounds per shot, and every one counts.
    const shard = weapon('Hpt_Guardian_ShardCannon_Fixed_Medium');
    assert.ok(
        near(damagePerSecond(shard), shard.damage! * shard.roundsPerShot! * shard.rateOfFire!),
    );
});

test('a continuous-fire weapon reports its per-second stats unchanged', () => {
    const beam = weapon('Hpt_BeamLaser_Fixed_Small');
    const metrics = weaponMetrics(beam);
    assert.ok(metrics.continuous);
    assert.equal(metrics.rateOfFire, 1);
    assert.equal(metrics.damagePerSecond, beam.damage);
    assert.equal(metrics.energyPerSecond, beam.distributorDraw);
    assert.equal(metrics.heatPerSecond, beam.thermalLoad);
    // Nothing to reload, so sustained equals the raw figure.
    assert.equal(metrics.sustainedDamagePerSecond, metrics.damagePerSecond);
    assert.equal(sustainedFireFactor(beam), 1);
});

test('reloading cuts the sustained figures below the raw ones', () => {
    const mc = weapon('Hpt_MultiCannon_Fixed_Small');
    const factor = sustainedFireFactor(mc);
    assert.ok(factor > 0 && factor < 1);
    assert.ok(near(sustainedDamagePerSecond(mc), damagePerSecond(mc) * factor));
    const metrics = weaponMetrics(mc);
    assert.ok(near(metrics.sustainedEnergyPerSecond, energyPerSecond(mc) * factor));
    assert.ok(near(metrics.sustainedHeatPerSecond, heatPerSecond(mc) * factor));
    assert.ok(near(metrics.sustainedRateOfFire, mc.rateOfFire! * factor));
});

test('the sustained factor is the share of time spent firing', () => {
    // 10 rounds at 1/s then a 5 s reload: 10 rounds every 14 s (the last round needs
    // no wait before the reload), against 10 per 10 s while firing.
    const factor = sustainedFireFactor({ rateOfFire: 1, clipSize: 10, reloadTime: 5 });
    assert.ok(near(factor, 10 / 14));
    // No clip means nothing to reload.
    assert.equal(sustainedFireFactor({ rateOfFire: 5 }), 1);
    assert.equal(sustainedFireFactor({ rateOfFire: 5, clipSize: 0 }), 1);
});

test('a burst weapon spends its within-burst time too', () => {
    // 3-round bursts at 15/s, clip of 12, 3 s reload, one burst every 0.5 s.
    const burst = {
        rateOfFire: 4.736842,
        burstRounds: 3,
        burstRateOfFire: 15,
        clipSize: 12,
        reloadTime: 3,
    };
    const cycle = (12 - 3) / burst.rateOfFire + 2 / 15 + 3;
    assert.ok(near(sustainedFireFactor(burst), 12 / cycle / burst.rateOfFire));
});

test('damage splits by type, and anti-xeno overlays rather than partitions', () => {
    const railgun = weaponMetrics(weapon('Hpt_Railgun_Fixed_Small'));
    const { kinetic, thermal, explosive, absolute } = railgun.damageByType;
    assert.ok(near(kinetic + thermal + explosive + absolute, railgun.damagePerSecond));
    assert.ok(thermal > kinetic); // a rail gun is two-thirds thermal

    const ax = weaponMetrics(
        getModuleBySymbol('Hpt_ATMultiCannon_Fixed_Medium', HARDPOINT_MODULES)!,
    );
    assert.ok(near(ax.damageByType.kinetic, ax.damagePerSecond));
    assert.ok(near(ax.damageByType.antiXeno, ax.damagePerSecond));
});

test('splitDamage treats an unknown distribution as absolute damage', () => {
    assert.deepEqual(splitDamage(10), {
        kinetic: 0,
        thermal: 0,
        explosive: 0,
        absolute: 10,
        antiXeno: 0,
    });
    assert.deepEqual(splitDamage(60, { kinetic: 1 / 3, thermal: 2 / 3 }), {
        kinetic: 20,
        thermal: 40,
        explosive: 0,
        absolute: 0,
        antiXeno: 0,
    });
});

test('damage tapers between the falloff range and maximum range', () => {
    const mc = { maximumRange: 4000, falloffRange: 2000 };
    assert.equal(damageFalloff(mc, 0), 1);
    assert.equal(damageFalloff(mc, 2000), 1);
    assert.equal(damageFalloff(mc, 3000), 0.5);
    assert.equal(damageFalloff(mc, 4000), 0);
    assert.equal(damageFalloff(mc, 9999), 0);
    // No falloff data: full damage up to the maximum, nothing past it.
    assert.equal(damageFalloff({ maximumRange: 3000 }, 2999), 1);
    assert.equal(damageFalloff({ maximumRange: 3000 }, 3001), 0);
    assert.equal(damageFalloff({}, 100000), 1);
    // A weapon whose falloff sits at its maximum range never tapers.
    assert.equal(damageFalloff({ maximumRange: 3000, falloffRange: 3000 }, 3000), 1);
});

test("armour piercing is capped at the target's hardness", () => {
    assert.ok(near(armourPiercingFactor(22, 65), 22 / 65));
    assert.equal(armourPiercingFactor(100, 65), 1);
    assert.equal(armourPiercingFactor(65, 65), 1);
    // An unknown hardness cannot scale anything.
    assert.equal(armourPiercingFactor(22, 0), 1);
});

test('a weapon with no stats at all reports zeroes rather than NaN', () => {
    const metrics = weaponMetrics({});
    assert.equal(metrics.damagePerSecond, 0);
    assert.equal(metrics.sustainedDamagePerSecond, 0);
    assert.equal(metrics.energyPerSecond, 0);
    assert.equal(metrics.powerDraw, 0);
    assert.ok(metrics.continuous);
});

test("sumWeaponMetrics totals a build's hardpoints", () => {
    const beam = weaponMetrics(weapon('Hpt_BeamLaser_Fixed_Small'));
    const mc = weaponMetrics(weapon('Hpt_MultiCannon_Fixed_Small'));
    const total = sumWeaponMetrics([beam, mc]);
    assert.ok(near(total.damagePerSecond, beam.damagePerSecond + mc.damagePerSecond));
    assert.ok(near(total.damageByType.thermal, beam.damageByType.thermal));
    assert.ok(near(total.damageByType.kinetic, mc.damageByType.kinetic));
    assert.ok(near(total.powerDraw, beam.powerDraw + mc.powerDraw));
    // Mixed armament, so the total is not a continuous-fire one.
    assert.equal(total.continuous, false);
    assert.equal(sumWeaponMetrics([beam]).continuous, true);
    assert.equal(sumWeaponMetrics([]).continuous, false);
    assert.equal(sumWeaponMetrics([]).damagePerSecond, 0);
});

test('the shared fixture pins falloff, piercing and the sustained factor', () => {
    for (const { maximumRange, falloffRange, metres, expected } of fixture.functions
        .damageFalloff) {
        assert.ok(
            near(damageFalloff({ maximumRange, falloffRange }, metres), expected),
            `${metres} m`,
        );
    }
    for (const { armourPiercing, hardness, expected } of fixture.functions.armourPiercingFactor) {
        assert.ok(
            near(armourPiercingFactor(armourPiercing, hardness), expected),
            `${armourPiercing}`,
        );
    }
    for (const expected of fixture.weapons) {
        assert.ok(
            near(sustainedFireFactor(weapon(expected.symbol)), expected.sustainedFireFactor),
            expected.symbol,
        );
    }
});

test('a clip left fractional by engineering is loaded as whole rounds', () => {
    // A 6-round clip at +36% is 8.16 rounds; the game loads 9.
    const fractional = { rateOfFire: 1.5, clipSize: 8.16, reloadTime: 3 };
    const whole = { rateOfFire: 1.5, clipSize: 9, reloadTime: 3 };
    assert.equal(sustainedFireFactor(fractional), sustainedFireFactor(whole));
    assert.ok(sustainedFireFactor(fractional) < sustainedFireFactor({ ...whole, clipSize: 10 }));
});

test('an unspecified burst rate falls back to one shot a second', () => {
    // Both reference implementations default it that way, and the sustained factor
    // below must not assume something different about the same weapon.
    assert.ok(near(combinedRateOfFire({ burstInterval: 0.15, burstRounds: 2 })!, 2 / 1.15));
    assert.ok(
        near(
            combinedRateOfFire({ burstInterval: 0.15, burstRounds: 2, burstRateOfFire: 0 })!,
            2 / 1.15,
        ),
    );
    assert.ok(
        near(
            combinedRateOfFire({ burstInterval: 0.15, burstRounds: 2, burstRateOfFire: 14 })!,
            2 / (1 / 14 + 0.15),
        ),
    );
    // A single-shot weapon never pays a within-burst cost, whatever the rate says.
    assert.ok(near(combinedRateOfFire({ burstInterval: 0.13 })!, 1 / 0.13));
});
