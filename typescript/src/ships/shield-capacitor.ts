/**
 * **The SYS capacitor** — what pips to SYS buy a raised shield, and what the shield is
 * worth once they are folded in.
 *
 * SYS does two things at once. It **resists**: the allocation adds a flat resistance to
 * every damage type, which multiplies with the shield's own stack rather than adding to
 * it, so incoming damage is scaled by `(1 − shieldResistance) × (1 − sysResistance)`. And
 * it **recharges**: the capacitor's energy is what the generator spends putting the
 * shield back up, on the same non-linear pip curve the other two capacitors follow,
 * `ratedRecharge × (pips / 4) ^ 1.1`.
 *
 * ```text
 * sysResistance         = 0.6 × (pips / 4) ^ 0.85
 * effectiveResistance   = 1 − (1 − shieldResistance) × (1 − sysResistance)
 * effectiveHitPoints    = strength / (1 − effectiveResistance)
 * ```
 *
 * The bare shield those effective figures are built from is {@link shieldMetrics}, which
 * is pip-free. What the recharge reported here *buys* — seconds from collapse back to a
 * raised shield — is {@link shieldRecovery}, which takes the same allocation and the
 * generator's regeneration rates.
 *
 * This module is data-free. {@link BuildMetrics.shieldCapacitorMetrics} (in
 * `./build-metrics`) resolves the powered generator, boosters and distributor for you.
 *
 * @remarks
 * Reference implementation: EDCD/Coriolis, `src/app/shipyard/Calculations.js`
 * (`sysResistance`, `calcShieldStrength`), commit
 * `68c042ca6e3db62372cbbb2077cf972345511712`. The algorithm is ported as fact, not code;
 * credit and licence terms are in
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @packageDocumentation
 */

import { capacitorRechargeAtPips } from './internal/capacitor-recharge.js';
import { requirePips } from './internal/pips.js';
import {
    effectiveHitPoints,
    mapDamageTypes,
    systemsResistance,
    type DamageResistances,
    type DamageType,
    type DamageTypeValues,
} from './resistances.js';

/** Everything {@link shieldCapacitorMetrics} needs about one raised shield. */
export interface ShieldCapacitorInput {
    /**
     * The shield's total strength, in megajoules — finite and non-negative.
     * {@link ShieldMetrics.strength}.
     */
    readonly strength: number;
    /**
     * The shield's own stacked resistances, pip-free — every one a finite fraction.
     * {@link ShieldMetrics.resistances}.
     */
    readonly resistances: DamageResistances;
    /** SYS-capacitor capacity, in megajoules — finite and non-negative. */
    readonly systemsCapacity: number;
    /** Four-SYS-pip recharge rate, in megajoules per second — finite and non-negative. */
    readonly systemsRecharge: number;
    /** Pips assigned to SYS, in `[0, 4]`. Fractional pips are accepted; defaults to `4`. */
    readonly systemsPips?: number;
}

/**
 * What one SYS allocation is worth to a raised shield.
 *
 * @remarks
 * Frozen — nested records and lists included — so a result can be held, cached and
 * shared without a defensive copy. Derive a changed figure with a spread rather than
 * by assigning into one.
 */
export interface ShieldCapacitorMetrics {
    /** Pips assigned to SYS for this result, in `[0, 4]`. */
    readonly systemsPips: number;
    /** SYS-capacitor capacity, in megajoules. */
    readonly capacity: number;
    /** Actual recharge rate at {@link systemsPips}, in megajoules per second. */
    readonly rechargeRate: number;
    /**
     * The resistance the pips contribute on their own, as a fraction: `0` at no pips
     * rising to `0.6` at four. Unrounded, like every resistance here.
     */
    readonly systemsResistance: number;
    /**
     * The shield's resistances with the pips folded in — the figures the game's own
     * panel shows while the allocation stands.
     *
     * @remarks
     * Fractions rather than percentages, and **unrounded**. The pips multiply with the
     * shield's stack rather than adding to it, so these are
     * `1 − (1 − shieldResistance) × (1 − systemsResistance)` and not a sum.
     */
    readonly effectiveResistances: DamageResistances;
    /**
     * Effective hit points against each damage type, in megajoules, behind
     * {@link ShieldCapacitorMetrics.effectiveResistances} — the raw damage of that type
     * the shield soaks at this allocation. `Infinity` where a resistance reaches 100%.
     */
    readonly effectiveHitPoints: DamageTypeValues;
}

const DAMAGE_TYPES: readonly DamageType[] = ['kinetic', 'thermal', 'explosive', 'caustic'];

function requireFiniteNonNegative(scope: string, name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${scope}: ${name} must be a finite non-negative number`);
    }
}

/**
 * Calculate what a SYS-pip allocation gives a raised shield.
 *
 * @param input - The bare shield's strength and stacked resistances, the distributor's
 * SYS capacity and rated four-pip recharge, and the allocation to model.
 * @returns The {@link ShieldCapacitorMetrics}. At **no** pips `systemsResistance` and
 * `rechargeRate` are `0` and the effective figures equal the bare ones that went in.
 * @throws {RangeError} If `systemsPips` is outside `[0, 4]`, if a strength, capacity or
 * recharge is negative or non-finite, or if a resistance is not a finite number. The
 * pips are checked first, so a bad allocation is reported before the shield.
 * @throws {TypeError} If `resistances` is not an object carrying the four damage types.
 * @example
 * ```ts
 * import { shieldMetrics } from '@elite-dangerous-almanac/core/ships/shields';
 * import { shieldCapacitorMetrics } from '@elite-dangerous-almanac/core/ships/shield-capacitor';
 *
 * // The bare shield, then what four pips to SYS make of it.
 * const shields = shieldMetrics({
 *   hullMass: 400,
 *   baseShieldStrength: 350,
 *   generator: {
 *     minMass: 270, optMass: 540, maxMass: 1350,
 *     minMultiplier: 0.7, optMultiplier: 1.2, maxMultiplier: 1.7,
 *     kineticResistance: 0.4,
 *   },
 * });
 * const sys = shieldCapacitorMetrics({
 *   ...shields,
 *   systemsCapacity: 41,
 *   systemsRecharge: 3.9,
 *   systemsPips: 4,
 * });
 * Number(sys.systemsResistance.toFixed(2));            // -> 0.6
 * Number(sys.effectiveResistances.kinetic.toFixed(2)); // -> 0.76
 * sys.effectiveHitPoints.kinetic > shields.effectiveHitPoints.kinetic; // -> true
 * ```
 */
export function shieldCapacitorMetrics(input: ShieldCapacitorInput): ShieldCapacitorMetrics {
    const scope = 'shieldCapacitorMetrics';
    const systemsPips = input.systemsPips ?? 4;
    // Named for the parameter the caller wrote, and checked before the shield so a
    // build with no shields still reports a bad allocation.
    requirePips(scope, 'systemsPips', systemsPips);
    for (const field of ['strength', 'systemsCapacity', 'systemsRecharge'] as const) {
        requireFiniteNonNegative(scope, field, input[field]);
    }
    const resistances: unknown = input.resistances;
    if (typeof resistances !== 'object' || resistances === null) {
        throw new TypeError(`${scope}: resistances must carry the four damage types`);
    }
    for (const type of DAMAGE_TYPES) {
        if (!Number.isFinite(input.resistances[type])) {
            throw new RangeError(`${scope}: resistances.${type} must be a finite number`);
        }
    }

    const sysResistance = systemsResistance(systemsPips);
    // The SYS pips multiply with the stacked shield resistance rather than adding to it.
    const effectiveResistances: DamageResistances = Object.freeze(
        mapDamageTypes((type) => 1 - (1 - input.resistances[type]) * (1 - sysResistance)),
    );
    return Object.freeze({
        systemsPips,
        capacity: input.systemsCapacity,
        rechargeRate: capacitorRechargeAtPips(input.systemsRecharge, systemsPips),
        systemsResistance: sysResistance,
        effectiveResistances,
        effectiveHitPoints: Object.freeze(effectiveHitPoints(input.strength, effectiveResistances)),
    });
}
