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
    type WeaponMetrics,
} from './weapons.js';
import { getModuleBySymbol } from './modules.js';
import { HARDPOINT_MODULES } from './modules-hardpoint.js';
import { weaponStatsFor } from './internal/loadout-metrics.js';
import fixture from '../../../fixtures/ships/build-metrics.jsonc' with { type: 'json' };

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const weapon = (symbol: string) => getModuleBySymbol(symbol, HARDPOINT_MODULES)!;
const displayed = (value: number, decimals: number) => Number(value.toFixed(decimals));

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

test('current fixed Guardian Shard Cannons reproduce their individual panels', () => {
    const observed = fixture.observedGuardianShardCannons;
    assert.equal(observed.blueprint, 'Anti-Guardian Zone Resistance');
    assert.equal(observed.grade, 1);
    assert.equal(observed.active, true);

    for (const expected of observed.records) {
        const stats = weapon(expected.symbol);
        assert.equal(stats.class, expected.class, expected.symbol);
        assert.equal(stats.mass, expected.mass, expected.symbol);
        assert.equal(stats.integrity, expected.integrity, expected.symbol);
        assert.equal(stats.powerDraw, expected.powerDraw, expected.symbol);
        assert.equal(
            displayed(damagePerSecond(stats), 1),
            expected.damagePerSecond,
            expected.symbol,
        );
        assert.equal(displayed(stats.damage!, 1), expected.damage, expected.symbol);
        assert.equal(stats.distributorDraw, expected.distributorDraw, expected.symbol);
        assert.equal(stats.thermalLoad, expected.thermalLoad, expected.symbol);
        assert.equal(stats.armourPiercing, expected.armourPiercing, expected.symbol);
        assert.equal(stats.maximumRange, expected.maximumRange, expected.symbol);
        assert.equal(displayed(stats.shotSpeed!, 0), expected.shotSpeed, expected.symbol);
        assert.equal(displayed(stats.rateOfFire!, 1), expected.rateOfFire, expected.symbol);
        assert.equal(stats.clipSize, expected.clipSize, expected.symbol);
        assert.equal(stats.ammoMaximum, expected.ammoMaximum, expected.symbol);
        assert.deepEqual(stats.damageDistribution, { thermal: 1, antiXeno: 1 });
        assert.equal(expected.damageType, 'Thermal');
        assert.equal(stats.falloffRange, expected.falloffRange, expected.symbol);
    }
});

test("charge time delays impact but does not change Frontier's firing cadence", () => {
    // Frontier states 1.587302/s for this 0.63 s rail gun beside its 1.2 s charge time.
    // The charge must remain available to consumers without being folded into the rate.
    assert.ok(near(combinedRateOfFire({ burstInterval: 0.63, chargeTime: 1.2 })!, 1 / 0.63));
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
    assert.ok(ax.damageByType.antiXeno > ax.damagePerSecond);
    assert.ok(near(ax.damageByType.antiXeno, 2.19 * ax.rateOfFire));
});

test('exact components preserve Guardian and unclassified damage without double-counting AX', () => {
    const gauss = weaponMetrics(
        getModuleBySymbol('Hpt_Guardian_GaussCannon_Fixed_Medium', HARDPOINT_MODULES)!,
    );
    assert.ok(near(gauss.damageByType.thermal, gauss.damagePerSecond));
    assert.ok(near(gauss.damageByType.antiXeno, gauss.damagePerSecond));

    const enzyme = weaponMetrics(
        getModuleBySymbol('Hpt_CausticMissile_Fixed_Medium', HARDPOINT_MODULES)!,
    );
    assert.ok(near(enzyme.damageByType.explosive, 2));
    assert.ok(near(enzyme.damageByType.unclassified ?? 0, 0.5));
    assert.ok(
        near(
            enzyme.damageByType.explosive + (enzyme.damageByType.unclassified ?? 0),
            enzyme.damagePerSecond,
        ),
    );

    const mkII = weaponMetrics(
        getModuleBySymbol('Hpt_MkIIPlasmaShockAutocannon_Fixed_Large', HARDPOINT_MODULES)!,
    );
    assert.ok(near(mkII.damageByType.unclassified ?? 0, mkII.damagePerSecond));
});

test('fitted engineering scales exact damage components with effective damage', () => {
    const stock = weapon('Hpt_ATMultiCannon_Gimbal_Medium');
    const stats = weaponStatsFor(
        {
            Slot: 'MediumHardpoint1',
            Item: stock.symbol,
            Engineering: {
                BlueprintName: 'MC_Overcharged',
                Level: 5,
                Quality: 1,
                Modifiers: [{ Label: 'Damage', OriginalValue: stock.damage!, Value: 1.232 }],
            },
        },
        stock,
    )!;
    assert.equal(stats.damage, 1.232);
    assert.deepEqual(stats.damageComponents, { kinetic: 1.232, antiXeno: 2.409 });

    const zero = weaponStatsFor(
        {
            Slot: 'MediumHardpoint1',
            Item: stock.symbol,
            Engineering: {
                BlueprintName: 'Test',
                Level: 1,
                Quality: 1,
                Modifiers: [{ Label: 'Damage', OriginalValue: stock.damage!, Value: 0 }],
            },
        },
        stock,
    )!;
    assert.equal(zero.damage, 0);
    assert.deepEqual(zero.damageComponents, { kinetic: 0, antiXeno: 0 });
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

test('projectile boundaries are not treated as effective falloff distances', () => {
    const missile = getModuleBySymbol('Hpt_ATDumbfireMissile_Fixed_Medium', HARDPOINT_MODULES)!;
    assert.deepEqual(missile.projectileRange, {
        maximumBoundary: 0,
        falloffBoundary: 100000,
    });
    assert.equal(damageFalloff(missile, 1_000_000), 1);
    const fitted = weaponStatsFor({ Slot: 'MediumHardpoint1', Item: missile.symbol }, missile)!;
    assert.deepEqual(fitted.projectileRange, missile.projectileRange);
    assert.notEqual(fitted.projectileRange, missile.projectileRange);

    const turret = getModuleBySymbol('Hpt_ATDumbfireMissile_Turret_Medium', HARDPOINT_MODULES)!;
    assert.deepEqual(turret.projectileRange, {
        maximumBoundary: 5000,
        falloffBoundary: 100000,
    });
    assert.equal(damageFalloff(turret, 6000), 1);
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
    assert.deepEqual(Object.keys(total).sort(), [
        'damageByType',
        'damagePerSecond',
        'energyPerSecond',
        'heatPerSecond',
        'powerDraw',
        'sustainedDamageByType',
        'sustainedDamagePerSecond',
        'sustainedEnergyPerSecond',
        'sustainedHeatPerSecond',
    ]);
});

test('sumWeaponMetrics adds every totals field and has a complete zero value', () => {
    const metrics: readonly WeaponMetrics[] = [
        {
            damagePerShot: 101,
            rateOfFire: 102,
            sustainedRateOfFire: 103,
            damagePerSecond: 1,
            sustainedDamagePerSecond: 2,
            energyPerSecond: 3,
            sustainedEnergyPerSecond: 4,
            heatPerSecond: 5,
            sustainedHeatPerSecond: 6,
            powerDraw: 7,
            damageByType: {
                kinetic: 8,
                thermal: 9,
                explosive: 10,
                absolute: 11,
                unclassified: 12,
                antiXeno: 13,
            },
            sustainedDamageByType: {
                kinetic: 14,
                thermal: 15,
                explosive: 16,
                absolute: 17,
                unclassified: 18,
                antiXeno: 19,
            },
            continuous: true,
        },
        {
            damagePerShot: 201,
            rateOfFire: 202,
            sustainedRateOfFire: 203,
            damagePerSecond: 20,
            sustainedDamagePerSecond: 30,
            energyPerSecond: 40,
            sustainedEnergyPerSecond: 50,
            heatPerSecond: 60,
            sustainedHeatPerSecond: 70,
            powerDraw: 80,
            damageByType: {
                kinetic: 90,
                thermal: 100,
                explosive: 110,
                absolute: 120,
                unclassified: 130,
                antiXeno: 140,
            },
            sustainedDamageByType: {
                kinetic: 150,
                thermal: 160,
                explosive: 170,
                absolute: 180,
                unclassified: 190,
                antiXeno: 200,
            },
            continuous: false,
        },
    ];

    assert.deepEqual(sumWeaponMetrics(metrics), {
        damagePerSecond: 21,
        sustainedDamagePerSecond: 32,
        energyPerSecond: 43,
        sustainedEnergyPerSecond: 54,
        heatPerSecond: 65,
        sustainedHeatPerSecond: 76,
        powerDraw: 87,
        damageByType: {
            kinetic: 98,
            thermal: 109,
            explosive: 120,
            absolute: 131,
            unclassified: 142,
            antiXeno: 153,
        },
        sustainedDamageByType: {
            kinetic: 164,
            thermal: 175,
            explosive: 186,
            absolute: 197,
            unclassified: 208,
            antiXeno: 219,
        },
    });

    const zeroSplit = { kinetic: 0, thermal: 0, explosive: 0, absolute: 0, antiXeno: 0 };
    assert.deepEqual(sumWeaponMetrics([]), {
        damagePerSecond: 0,
        sustainedDamagePerSecond: 0,
        energyPerSecond: 0,
        sustainedEnergyPerSecond: 0,
        heatPerSecond: 0,
        sustainedHeatPerSecond: 0,
        powerDraw: 0,
        damageByType: zeroSplit,
        sustainedDamageByType: zeroSplit,
    });
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

test('armour piercing rejects invalid ratings and permits zero sentinels', () => {
    assert.equal(armourPiercingFactor(0, 65), 0);
    assert.equal(armourPiercingFactor(22, 0), 1);
    assert.equal(armourPiercingFactor(0, 0), 1);
    for (const piercing of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => armourPiercingFactor(piercing, 65), RangeError);
    }
    for (const hardness of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => armourPiercingFactor(22, hardness), RangeError);
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
