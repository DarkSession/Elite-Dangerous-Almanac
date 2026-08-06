/**
 * **Weapons** — damage per second, capacitor draw per second, heat per second, and how
 * the damage splits by type.
 *
 * A weapon's catalogue record gives damage *per round*; turning that into DPS means
 * folding in the rounds per shot and the rate of fire, and — for the **sustained**
 * figures — the clip and reload, because a weapon that stops to reload is not firing:
 *
 * ```text
 * DPS  = damage × roundsPerShot × rateOfFire
 * SDPS = DPS × (sustained rate of fire / rate of fire)
 * EPS  = distributorDraw × rateOfFire        (weapons capacitor, MW)
 * HPS  = thermalLoad × rateOfFire            (heat)
 * ```
 *
 * Beam and mining lasers are **continuous**: they carry no rate of fire, and their
 * `damage`, `distributorDraw` and `thermalLoad` are already per second, so the figures
 * above collapse to the raw stats.
 *
 * This module is data-free — hand it a weapon's stats (a catalogue record satisfies
 * {@link WeaponStats} as-is). {@link ShipLoadout.weaponMetrics} (in `./ship-loadout`)
 * reads a build's hardpoints, applies their engineering, and totals them for you.
 *
 * @remarks
 * Reference implementation: EDCD/Coriolis by the Coriolis contributors (MIT),
 * <https://github.com/EDCD/coriolis> — `src/app/shipyard/Module.js` (`getDps`,
 * `getSustainedFactor`, `getEps`, `getHps`), commit
 * `68c042ca6e3db62372cbbb2077cf972345511712`; cross-checked against EDSY by taleden
 * (CC BY-NC 4.0), <https://github.com/taleden/EDSY>. The algorithm is ported as fact,
 * not code.
 *
 * @example
 * ```ts
 * import { weaponMetrics } from '@elite-dangerous-almanac/core/ships/weapons';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
 *
 * const mc = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', HARDPOINT_MODULES)!;
 * weaponMetrics(mc).damagePerSecond;          // -> 8.62  (while firing, reloads ignored)
 * weaponMetrics(mc).sustainedDamagePerSecond; // -> 6.64  (with the 4 s reload)
 * ```
 *
 * @packageDocumentation
 */

import type { DamageDistribution } from './modules.js';

/**
 * The weapon stats a DPS calculation needs — all post-engineering.
 *
 * @remarks
 * An {@link OutfittingModule} record satisfies this as-is, so you can pass a catalogue
 * entry straight in. Every field is optional: a weapon carries only the ones that
 * apply to it, and a missing field takes the neutral default noted below.
 */
export interface WeaponStats {
    /** Damage per round — or per second on a continuous-fire weapon. Defaults to `0`. */
    readonly damage?: number;
    /** How the damage splits by type. Defaults to all-absolute if absent. */
    readonly damageDistribution?: DamageDistribution;
    /** Rounds fired per shot. Defaults to `1`. */
    readonly roundsPerShot?: number;
    /**
     * Shots per second, burst pattern folded in. Absent marks a **continuous-fire**
     * weapon, whose per-second stats are used as they stand.
     */
    readonly rateOfFire?: number;
    /**
     * Seconds between shots — between *bursts* on a burst-fire weapon. Only
     * {@link combinedRateOfFire} uses it; the per-second figures work off
     * {@link WeaponStats.rateOfFire}.
     */
    readonly burstInterval?: number;
    /** Shots in one burst. Defaults to `1`. */
    readonly burstRounds?: number;
    /** Shots per second within a burst. Defaults to `1`. */
    readonly burstRateOfFire?: number;
    /** Seconds spent charging before a shot (rail guns). Defaults to `0`. */
    readonly chargeTime?: number;
    /** Rounds in a clip. Absent means the weapon never stops to reload. */
    readonly clipSize?: number;
    /** Seconds to reload a clip. Defaults to `0`. */
    readonly reloadTime?: number;
    /** Weapons-capacitor draw per shot (per second when continuous), in MW. Defaults to `0`. */
    readonly distributorDraw?: number;
    /** Heat per shot (per second when continuous). Defaults to `0`. */
    readonly thermalLoad?: number;
    /** Power draw, in megawatts — echoed through to the metrics. Defaults to `0`. */
    readonly powerDraw?: number;
    /** Maximum range, in metres. */
    readonly maximumRange?: number;
    /** Range at which damage begins to drop off, in metres. */
    readonly falloffRange?: number;
    /** Armour piercing rating, against a hull's hardness. */
    readonly armourPiercing?: number;
}

/** Damage split across the five types, in the same unit as the figure it splits. */
export interface DamageSplit {
    /** Kinetic share. */
    readonly kinetic: number;
    /** Thermal share. */
    readonly thermal: number;
    /** Explosive share. */
    readonly explosive: number;
    /** Absolute share — the part no resistance reduces. */
    readonly absolute: number;
    /**
     * The part effective against Thargoids. Overlays the four physical shares rather
     * than partitioning them, so it is not part of the total.
     */
    readonly antiXeno: number;
}

/** What one weapon does per second, sustained and unsustained. */
export interface WeaponMetrics {
    /** Damage of one shot — `damage × roundsPerShot`. */
    readonly damagePerShot: number;
    /** Shots per second; `1` on a continuous-fire weapon, whose stats are per second. */
    readonly rateOfFire: number;
    /** Shots per second averaged over reloads. Equals `rateOfFire` when nothing reloads. */
    readonly sustainedRateOfFire: number;
    /** Damage per second while firing, reloads ignored. */
    readonly damagePerSecond: number;
    /** Damage per second averaged over reloads — the figure a long fight sees. */
    readonly sustainedDamagePerSecond: number;
    /** Weapons-capacitor draw per second, in MW, reloads ignored. */
    readonly energyPerSecond: number;
    /** Weapons-capacitor draw per second, in MW, averaged over reloads. */
    readonly sustainedEnergyPerSecond: number;
    /** Heat per second while firing, reloads ignored. */
    readonly heatPerSecond: number;
    /** Heat per second averaged over reloads. */
    readonly sustainedHeatPerSecond: number;
    /** Power draw, in megawatts — what the weapon asks of the power plant when deployed. */
    readonly powerDraw: number;
    /** {@link damagePerSecond} split by damage type. */
    readonly damageByType: DamageSplit;
    /** {@link sustainedDamagePerSecond} split by damage type. */
    readonly sustainedDamageByType: DamageSplit;
    /** Whether the weapon fires continuously (a beam or mining laser). */
    readonly continuous: boolean;
}

/**
 * The combined rate of fire a weapon's firing cycle implies — the journal's own
 * `RateOfFire`, rebuilt from its parts.
 *
 * A cycle fires `burstRounds` shots `1 / burstRateOfFire` apart, spends any
 * `chargeTime` winding up, then waits out the `burstInterval` before the next one.
 *
 * @param weapon - The weapon's stats, post-engineering.
 * @returns Shots per second, or `undefined` for a continuous-fire weapon (no
 * `burstInterval`) or a cycle that does not resolve to a positive time.
 * @remarks
 * Use this after engineering has moved a burst stat: a recipe that gives a weapon a
 * two-round burst changes the rate of fire without naming it. `weaponMetrics` takes
 * `rateOfFire` as given, so recompute it first if you have changed the parts.
 * @example
 * ```ts
 * // A small burst laser: three shots at 15/s, then half a second's wait
 * combinedRateOfFire({ burstInterval: 0.5, burstRounds: 3, burstRateOfFire: 15 }); // -> 4.74
 * ```
 */
export function combinedRateOfFire(weapon: WeaponStats): number | undefined {
    const interval = weapon.burstInterval;
    if (interval === undefined || interval <= 0) return undefined;
    const burst = weapon.burstRounds && weapon.burstRounds > 0 ? weapon.burstRounds : 1;
    // An unspecified burst rate falls back to one shot a second, as both Coriolis
    // (`getRoF`) and EDSY (`bstrof` default 1) do — and as `sustainedFireFactor` below
    // does, so the two never disagree about the same weapon.
    const burstRate =
        weapon.burstRateOfFire && weapon.burstRateOfFire > 0 ? weapon.burstRateOfFire : 1;
    const cycle = (burst > 1 ? (burst - 1) / burstRate : 0) + interval + (weapon.chargeTime ?? 0);
    return cycle > 0 ? burst / cycle : undefined;
}

const ZERO_SPLIT: DamageSplit = {
    kinetic: 0,
    thermal: 0,
    explosive: 0,
    absolute: 0,
    antiXeno: 0,
};

/**
 * Split a per-second (or per-shot) damage figure by damage type.
 *
 * @param damage - The figure to split — DPS, sustained DPS, damage per shot, anything.
 * @param distribution - The weapon's damage distribution. Absent treats the whole
 * figure as absolute damage, which no resistance reduces.
 * @returns The share of `damage` in each type. `antiXeno` overlays the physical types
 * rather than partitioning them, so the four physical shares — not all five — sum back
 * to `damage`.
 * @example
 * ```ts
 * splitDamage(60, { kinetic: 1 / 3, thermal: 2 / 3 }); // -> { kinetic: 20, thermal: 40, ... }
 * ```
 */
export function splitDamage(damage: number, distribution?: DamageDistribution): DamageSplit {
    if (!distribution) return { ...ZERO_SPLIT, absolute: damage };
    return {
        kinetic: damage * (distribution.kinetic ?? 0),
        thermal: damage * (distribution.thermal ?? 0),
        explosive: damage * (distribution.explosive ?? 0),
        absolute: damage * (distribution.absolute ?? 0),
        antiXeno: damage * (distribution.antiXeno ?? 0),
    };
}

/**
 * The factor that turns a weapon's while-firing figures into sustained ones — the
 * share of the time it spends shooting rather than reloading.
 *
 * @param weapon - The weapon's stats.
 * @returns A factor in `(0, 1]`: `1` for anything that never stops to reload, less for
 * a weapon whose clip runs dry. A fractional clip left by engineering is rounded **up**,
 * as the game loads whole rounds.
 * @remarks
 * A clip's worth of fire takes `(clip − burst) / rateOfFire` seconds plus the time to
 * finish the last burst, then the reload; the sustained rate is the clip divided by
 * that whole cycle.
 * @example
 * ```ts
 * // A small multi-cannon: 100 rounds at 7.69/s, then a 4 s reload
 * sustainedFireFactor({ rateOfFire: 7.692308, clipSize: 100, reloadTime: 4 }); // -> 0.77…
 * ```
 */
export function sustainedFireFactor(weapon: WeaponStats): number {
    const rateOfFire = weapon.rateOfFire;
    // Engineering can leave a fractional clip; the game loads whole rounds and rounds up.
    const clip = weapon.clipSize === undefined ? undefined : Math.ceil(weapon.clipSize);
    if (!rateOfFire || !clip || clip <= 0) return 1;
    const burst = weapon.burstRounds && weapon.burstRounds > 0 ? weapon.burstRounds : 1;
    const burstRate =
        weapon.burstRateOfFire && weapon.burstRateOfFire > 0 ? weapon.burstRateOfFire : 1;
    const reload = weapon.reloadTime ?? 0;
    // Time between bursts within the clip, the trailing burst itself, then the reload.
    const cycle = (clip - burst) / rateOfFire + (burst - 1) / burstRate + reload;
    if (cycle <= 0) return 1;
    const sustainedRate = clip / cycle;
    return Math.min(1, sustainedRate / rateOfFire);
}

/**
 * Damage per second while the trigger is held, reloads ignored.
 *
 * @param weapon - The weapon's stats.
 * @returns Damage per second. A continuous-fire weapon (no `rateOfFire`) reports its
 * `damage` unchanged, because that stat is already per second.
 */
export function damagePerSecond(weapon: WeaponStats): number {
    const damage = weapon.damage ?? 0;
    const rounds = weapon.roundsPerShot && weapon.roundsPerShot > 0 ? weapon.roundsPerShot : 1;
    return damage * rounds * (weapon.rateOfFire ?? 1);
}

/**
 * Damage per second averaged over reloads — what a long engagement actually sees.
 *
 * @param weapon - The weapon's stats.
 * @returns Sustained damage per second.
 */
export function sustainedDamagePerSecond(weapon: WeaponStats): number {
    return damagePerSecond(weapon) * sustainedFireFactor(weapon);
}

/**
 * Weapons-capacitor draw per second, in megawatts.
 *
 * @param weapon - The weapon's stats.
 * @returns Capacitor draw per second, reloads ignored. Compare against the power
 * distributor's `weaponsRecharge` to see whether the build can fire indefinitely.
 */
export function energyPerSecond(weapon: WeaponStats): number {
    return (weapon.distributorDraw ?? 0) * (weapon.rateOfFire ?? 1);
}

/**
 * Heat generated per second.
 *
 * @param weapon - The weapon's stats.
 * @returns Heat per second, reloads ignored.
 */
export function heatPerSecond(weapon: WeaponStats): number {
    return (weapon.thermalLoad ?? 0) * (weapon.rateOfFire ?? 1);
}

/**
 * How much of a weapon's damage still lands at a given range.
 *
 * @param weapon - The weapon's stats.
 * @param metres - The range to the target, in metres.
 * @returns A factor in `[0, 1]`: `1` inside the falloff range, tapering linearly to
 * `0` at maximum range and staying there beyond it. A weapon with no falloff data
 * reports `1` up to its maximum range.
 * @example
 * ```ts
 * const mc = { maximumRange: 4000, falloffRange: 2000 };
 * damageFalloff(mc, 1500); // -> 1
 * damageFalloff(mc, 3000); // -> 0.5
 * damageFalloff(mc, 5000); // -> 0
 * ```
 */
export function damageFalloff(weapon: WeaponStats, metres: number): number {
    const maximum = weapon.maximumRange;
    if (maximum !== undefined && metres > maximum) return 0;
    const falloff = weapon.falloffRange;
    if (falloff === undefined || maximum === undefined || metres <= falloff) return 1;
    const taper = maximum - falloff;
    if (taper <= 0) return 1;
    return Math.max(0, 1 - (metres - falloff) / taper);
}

/**
 * How much of a weapon's damage a hull's hardness lets through.
 *
 * @param armourPiercing - The weapon's piercing rating.
 * @param hardness - The target hull's finite, non-negative {@link Ship.hardness}.
 * Pass `0` when the hardness is unknown, which disables hardness scaling.
 * @returns A factor in `[0, 1]`: `1` when the weapon out-pierces the hull, otherwise
 * `armourPiercing / hardness`. A zero piercing rating returns `0` when hardness is
 * positive; zero hardness always returns `1` because it disables hardness scaling.
 * Applies to hull damage only — shields do not care.
 * @throws {RangeError} If either argument is not a finite non-negative number.
 * @example
 * ```ts
 * armourPiercingFactor(22, 65); // -> 0.338…  a small multi-cannon against an Anaconda
 * armourPiercingFactor(100, 65); // -> 1      a rail gun goes straight through
 * ```
 */
export function armourPiercingFactor(armourPiercing: number, hardness: number): number {
    if (!Number.isFinite(armourPiercing) || armourPiercing < 0) {
        throw new RangeError(
            'armourPiercingFactor: armour piercing must be a finite non-negative number',
        );
    }
    if (!Number.isFinite(hardness) || hardness < 0) {
        throw new RangeError('armourPiercingFactor: hardness must be a finite non-negative number');
    }
    if (hardness === 0) return 1;
    return Math.min(1, armourPiercing / hardness);
}

/**
 * Everything an outfitting screen shows about one weapon: DPS, sustained DPS, the
 * capacitor and heat cost of firing it, and the damage split by type.
 *
 * @param weapon - The weapon's stats, post-engineering. A catalogue record works as-is.
 * @returns The {@link WeaponMetrics}.
 * @example
 * ```ts
 * const beam = weaponMetrics(getModuleBySymbol('Hpt_BeamLaser_Fixed_Small', HARDPOINT_MODULES)!);
 * beam.continuous;                    // -> true
 * beam.damagePerSecond;               // -> 9.8 (its `damage` is already per second)
 * beam.damageByType.thermal;          // -> 9.8
 * ```
 */
export function weaponMetrics(weapon: WeaponStats): WeaponMetrics {
    const continuous = weapon.rateOfFire === undefined;
    const rateOfFire = weapon.rateOfFire ?? 1;
    const factor = sustainedFireFactor(weapon);
    const dps = damagePerSecond(weapon);
    const sdps = dps * factor;
    const eps = energyPerSecond(weapon);
    const hps = heatPerSecond(weapon);
    const rounds = weapon.roundsPerShot && weapon.roundsPerShot > 0 ? weapon.roundsPerShot : 1;

    return {
        damagePerShot: (weapon.damage ?? 0) * rounds,
        rateOfFire,
        sustainedRateOfFire: rateOfFire * factor,
        damagePerSecond: dps,
        sustainedDamagePerSecond: sdps,
        energyPerSecond: eps,
        sustainedEnergyPerSecond: eps * factor,
        heatPerSecond: hps,
        sustainedHeatPerSecond: hps * factor,
        powerDraw: weapon.powerDraw ?? 0,
        damageByType: splitDamage(dps, weapon.damageDistribution),
        sustainedDamageByType: splitDamage(sdps, weapon.damageDistribution),
        continuous,
    };
}

/**
 * Add several weapons' metrics together — a build's total firepower.
 *
 * @param metrics - The per-weapon metrics to sum.
 * @returns One {@link WeaponMetrics} carrying the totals. The per-shot and rate-of-fire
 * fields are summed too, which is meaningful only per weapon; read them off the
 * individual entries instead. `continuous` is `true` only when *every* weapon is.
 * @example
 * ```ts
 * sumWeaponMetrics(build.weaponMetrics().weapons.map((w) => w.metrics)).damagePerSecond;
 * ```
 */
export function sumWeaponMetrics(metrics: readonly WeaponMetrics[]): WeaponMetrics {
    const total = (pick: (m: WeaponMetrics) => number): number =>
        metrics.reduce((sum, m) => sum + pick(m), 0);
    const totalSplit = (pick: (m: WeaponMetrics) => DamageSplit): DamageSplit => ({
        kinetic: metrics.reduce((sum, m) => sum + pick(m).kinetic, 0),
        thermal: metrics.reduce((sum, m) => sum + pick(m).thermal, 0),
        explosive: metrics.reduce((sum, m) => sum + pick(m).explosive, 0),
        absolute: metrics.reduce((sum, m) => sum + pick(m).absolute, 0),
        antiXeno: metrics.reduce((sum, m) => sum + pick(m).antiXeno, 0),
    });

    return {
        damagePerShot: total((m) => m.damagePerShot),
        rateOfFire: total((m) => m.rateOfFire),
        sustainedRateOfFire: total((m) => m.sustainedRateOfFire),
        damagePerSecond: total((m) => m.damagePerSecond),
        sustainedDamagePerSecond: total((m) => m.sustainedDamagePerSecond),
        energyPerSecond: total((m) => m.energyPerSecond),
        sustainedEnergyPerSecond: total((m) => m.sustainedEnergyPerSecond),
        heatPerSecond: total((m) => m.heatPerSecond),
        sustainedHeatPerSecond: total((m) => m.sustainedHeatPerSecond),
        powerDraw: total((m) => m.powerDraw),
        damageByType: totalSplit((m) => m.damageByType),
        sustainedDamageByType: totalSplit((m) => m.sustainedDamageByType),
        continuous: metrics.length > 0 && metrics.every((m) => m.continuous),
    };
}
