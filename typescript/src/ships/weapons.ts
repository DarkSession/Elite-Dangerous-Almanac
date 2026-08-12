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
 * Reference implementation: EDCD/Coriolis, `src/app/shipyard/Module.js` (`getDps`,
 * `getSustainedFactor`, `getEps`, `getHps`), commit
 * `68c042ca6e3db62372cbbb2077cf972345511712`; cross-checked against EDSY. The algorithm is
 * ported as fact, not code; credit and licence terms are in [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
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

import type { DamageComponents, DamageDistribution, ProjectileRangeBoundaries } from './modules.js';

/**
 * The weapon stats a DPS calculation needs — all post-engineering.
 *
 * @remarks
 * An {@link OutfittingModule} record satisfies this as-is, so you can pass a catalogue
 * entry straight in. Every field is optional: a weapon carries only the ones that
 * apply to it. Fields used directly by these calculations state their omitted
 * behavior below; informational fields remain absent when unknown or inapplicable.
 */
export interface WeaponStats {
    /** Damage per round — or per second on a continuous-fire weapon. Defaults to `0`. */
    readonly damage?: number;
    /** How the damage splits by type. Defaults to all-absolute if absent. */
    readonly damageDistribution?: DamageDistribution;
    /** Exact damage amounts. When present, these are authoritative for damage splits. */
    readonly damageComponents?: DamageComponents;
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
    /**
     * Seconds spent charging before a shot (rail guns). Absent means no charge delay is
     * recorded; these calculations do not fold charge time into `rateOfFire` or DPS.
     */
    readonly chargeTime?: number;
    /** Rounds in a clip. Absent means the weapon never stops to reload. */
    readonly clipSize?: number;
    /**
     * Reserve rounds behind the clip. Absent means nothing limits them.
     *
     * @remarks
     * No per-second figure reads it — a reserve says how long a weapon can keep firing,
     * not how hard. It is carried here so `weaponStatsFor` hands
     * {@link ammunitionCapacity} everything it needs from one record.
     */
    readonly ammoMaximum?: number;
    /** Seconds to reload a clip. Defaults to `0`. */
    readonly reloadTime?: number;
    /** Weapons-capacitor draw per shot (per second when continuous), in MW. Defaults to `0`. */
    readonly distributorDraw?: number;
    /** Heat per shot (per second when continuous). Defaults to `0`. */
    readonly thermalLoad?: number;
    /** Power draw, in megawatts — echoed through to the metrics. Defaults to `0`. */
    readonly powerDraw?: number;
    /** Maximum range, in metres. Absent means {@link damageFalloff} imposes no range cap. */
    readonly maximumRange?: number;
    /**
     * Range at which damage begins to drop off, in metres. Absent means full damage
     * through `maximumRange`, then zero beyond it.
     */
    readonly falloffRange?: number;
    /**
     * Projectile boundary parameters, which are not effective distances. Absent means
     * no boundary metadata is known; {@link damageFalloff} ignores it either way.
     */
    readonly projectileRange?: ProjectileRangeBoundaries;
    /**
     * Armour piercing rating, against a hull's hardness. Absent means the rating is
     * unknown; callers of {@link armourPiercingFactor} must supply an explicit value.
     */
    readonly armourPiercing?: number;
}

/**
 * Damage split across the established, unclassified and anti-xeno types, in the same
 * unit as the figure it splits (for example, damage per second when splitting DPS).
 */
export interface DamageSplit {
    /** Kinetic share. */
    readonly kinetic: number;
    /** Thermal share. */
    readonly thermal: number;
    /** Explosive share. */
    readonly explosive: number;
    /** Absolute share — the part no resistance reduces. */
    readonly absolute: number;
    /** Damage unclassified by in-game verification. Absent when zero. */
    readonly unclassified?: number;
    /**
     * The part effective against Thargoids. Overlays conventional damage rather than
     * partitioning it, so it is not part of the conventional total.
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
    /**
     * {@link damagePerSecond} split by damage type.
     *
     * @remarks
     * Uses the split supplied in {@link WeaponStats}. {@link ShipLoadout.weaponMetrics}
     * resolves damage-converting experimental effects, Plasma Conversion blueprints and
     * a journal's own damage-type modifiers before calling this calculation, so fitted
     * conversions report their resulting split.
     */
    readonly damageByType: DamageSplit;
    /** {@link sustainedDamagePerSecond} split by damage type. */
    readonly sustainedDamageByType: DamageSplit;
    /** Whether the weapon fires continuously (a beam or mining laser). */
    readonly continuous: boolean;
}

/**
 * The additive firepower totals across several weapons.
 *
 * @remarks
 * Per-shot damage, rate of fire and continuous-fire state belong to one weapon and
 * therefore do not appear here: adding a beam laser's cadence to a multi-cannon's does
 * not describe either weapon or the build. Use the individual {@link WeaponMetrics}
 * when those figures matter.
 */
export interface WeaponTotals {
    /** Damage per second while firing, summed across the weapons. */
    readonly damagePerSecond: number;
    /** Damage per second averaged over reloads, summed across the weapons. */
    readonly sustainedDamagePerSecond: number;
    /** Weapons-capacitor draw per second, in MW, summed across the weapons. */
    readonly energyPerSecond: number;
    /** Weapons-capacitor draw per second averaged over reloads, in MW. */
    readonly sustainedEnergyPerSecond: number;
    /** Heat generated per second while firing, summed across the weapons. */
    readonly heatPerSecond: number;
    /** Heat generated per second averaged over reloads, summed across the weapons. */
    readonly sustainedHeatPerSecond: number;
    /** Deployed power draw, in MW, summed across the weapons. */
    readonly powerDraw: number;
    /** {@link damagePerSecond} split by damage type. */
    readonly damageByType: DamageSplit;
    /** {@link sustainedDamagePerSecond} split by damage type. */
    readonly sustainedDamageByType: DamageSplit;
}

/**
 * The combined rate of fire a weapon's firing cycle implies — the journal's own
 * `RateOfFire`, rebuilt from its parts.
 *
 * A cycle fires `burstRounds` shots `1 / burstRateOfFire` apart, then waits out the
 * `burstInterval` before the next one. `chargeTime` is the delay before a shot lands,
 * not part of the cadence Frontier reports as `RateOfFire`.
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
 * import { combinedRateOfFire } from '@elite-dangerous-almanac/core/ships/weapons';
 *
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
    const cycle = (burst > 1 ? (burst - 1) / burstRate : 0) + interval;
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
 * @returns The share of `damage` in each type. `antiXeno` overlays conventional damage
 * rather than partitioning it; the other returned amounts sum back to `damage`.
 * @example
 * ```ts
 * import { splitDamage } from '@elite-dangerous-almanac/core/ships/weapons';
 *
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
        ...((distribution.unclassified ?? 0) === 0
            ? {}
            : { unclassified: damage * distribution.unclassified! }),
        antiXeno: damage * (distribution.antiXeno ?? 0),
    };
}

function splitComponents(damage: number, components: DamageComponents): DamageSplit {
    const unclassified = (components.unclassified ?? []).reduce((sum, value) => sum + value, 0);
    const conventional =
        (components.kinetic ?? 0) +
        (components.thermal ?? 0) +
        (components.explosive ?? 0) +
        (components.absolute ?? 0) +
        unclassified;
    if (conventional <= 0) return { ...ZERO_SPLIT, absolute: damage };
    const scale = damage / conventional;
    return {
        kinetic: (components.kinetic ?? 0) * scale,
        thermal: (components.thermal ?? 0) * scale,
        explosive: (components.explosive ?? 0) * scale,
        absolute: (components.absolute ?? 0) * scale,
        ...(unclassified === 0 ? {} : { unclassified: unclassified * scale }),
        antiXeno: (components.antiXeno ?? 0) * scale,
    };
}

/**
 * The factor that turns a weapon's while-firing figures into sustained ones — the
 * share of the time it spends shooting rather than reloading.
 *
 * @param weapon - The weapon's stats.
 * @returns A factor in `(0, 1]`: `1` for anything that never stops to reload, less for
 * a weapon whose clip runs dry. A fractional clip is held to whole rounds, rounding **up**
 * — which only a hand-built or journal-stated figure can be, since an engineered clip is
 * rounded to a whole *burst* where the roll is computed (`./engineering`). On a burst
 * weapon the two rules can differ by a round: a reload cycle follows Coriolis's own
 * `getClip` end to end, so taking half of EDSY's rule into it would agree with neither.
 * @remarks
 * A clip's worth of fire takes `(clip − burst) / rateOfFire` seconds plus the time to
 * finish the last burst, then the reload; the sustained rate is the clip divided by
 * that whole cycle.
 * @example
 * ```ts
 * import { sustainedFireFactor } from '@elite-dangerous-almanac/core/ships/weapons';
 *
 * // A small multi-cannon: 100 rounds at 7.69/s, then a 4 s reload
 * sustainedFireFactor({ rateOfFire: 7.692308, clipSize: 100, reloadTime: 4 }); // -> 0.77…
 * ```
 */
export function sustainedFireFactor(weapon: WeaponStats): number {
    const rateOfFire = weapon.rateOfFire;
    // A stat that reaches here is already whole — an engineered clip is rounded up to a
    // whole burst where the roll is computed (`./engineering`), and a journal states its
    // own. This holds a hand-built fraction to whole rounds, the way Coriolis's `getClip`
    // does, rather than letting it into the reload cycle.
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
 * reports `1` up to its maximum range. Projectile boundary parameters are deliberately
 * ignored: this function calculates attenuation, not projectile reach.
 * @example
 * ```ts
 * import { damageFalloff } from '@elite-dangerous-almanac/core/ships/weapons';
 *
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
 * import { armourPiercingFactor } from '@elite-dangerous-almanac/core/ships/weapons';
 *
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
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
 * import { weaponMetrics } from '@elite-dangerous-almanac/core/ships/weapons';
 *
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
        damageByType: weapon.damageComponents
            ? splitComponents(dps, weapon.damageComponents)
            : splitDamage(dps, weapon.damageDistribution),
        sustainedDamageByType: weapon.damageComponents
            ? splitComponents(sdps, weapon.damageComponents)
            : splitDamage(sdps, weapon.damageDistribution),
        continuous,
    };
}

/**
 * Add several weapons' metrics together — a build's total firepower.
 *
 * @param metrics - The per-weapon metrics to sum.
 * @returns The additive {@link WeaponTotals}. An empty list returns zeroes.
 * @example
 * ```ts
 * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import { sumWeaponMetrics } from '@elite-dangerous-almanac/core/ships/weapons';
 *
 * declare const build: ShipLoadout;
 *
 * sumWeaponMetrics(build.weaponMetrics().weapons.map((w) => w.metrics)).damagePerSecond;
 * ```
 */
export function sumWeaponMetrics(metrics: readonly WeaponMetrics[]): WeaponTotals {
    const damageByType = emptyDamageSplitAccumulator();
    const sustainedDamageByType = emptyDamageSplitAccumulator();
    let damagePerSecond = 0;
    let sustainedDamagePerSecond = 0;
    let energyPerSecond = 0;
    let sustainedEnergyPerSecond = 0;
    let heatPerSecond = 0;
    let sustainedHeatPerSecond = 0;
    let powerDraw = 0;

    for (const metric of metrics) {
        damagePerSecond += metric.damagePerSecond;
        sustainedDamagePerSecond += metric.sustainedDamagePerSecond;
        energyPerSecond += metric.energyPerSecond;
        sustainedEnergyPerSecond += metric.sustainedEnergyPerSecond;
        heatPerSecond += metric.heatPerSecond;
        sustainedHeatPerSecond += metric.sustainedHeatPerSecond;
        powerDraw += metric.powerDraw;
        addDamageSplit(damageByType, metric.damageByType);
        addDamageSplit(sustainedDamageByType, metric.sustainedDamageByType);
    }

    return {
        damagePerSecond,
        sustainedDamagePerSecond,
        energyPerSecond,
        sustainedEnergyPerSecond,
        heatPerSecond,
        sustainedHeatPerSecond,
        powerDraw,
        damageByType: finishDamageSplit(damageByType),
        sustainedDamageByType: finishDamageSplit(sustainedDamageByType),
    };
}

interface DamageSplitAccumulator {
    kinetic: number;
    thermal: number;
    explosive: number;
    absolute: number;
    unclassified: number;
    antiXeno: number;
}

function emptyDamageSplitAccumulator(): DamageSplitAccumulator {
    return { kinetic: 0, thermal: 0, explosive: 0, absolute: 0, unclassified: 0, antiXeno: 0 };
}

function addDamageSplit(total: DamageSplitAccumulator, split: DamageSplit): void {
    total.kinetic += split.kinetic;
    total.thermal += split.thermal;
    total.explosive += split.explosive;
    total.absolute += split.absolute;
    total.unclassified += split.unclassified ?? 0;
    total.antiXeno += split.antiXeno;
}

function finishDamageSplit(total: DamageSplitAccumulator): DamageSplit {
    const { unclassified, ...classified } = total;
    return unclassified === 0 ? classified : { ...classified, unclassified };
}
