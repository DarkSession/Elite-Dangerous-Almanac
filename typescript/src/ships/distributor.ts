/**
 * Power-distributor capacitor capacities and pip-scaled recharge rates.
 *
 * A distributor's catalogue recharge figures are its four-pip maxima. SYS, ENG
 * and WEP use the same non-linear allocation curve:
 * `ratedRecharge * (pips / 4) ^ 1.1`.
 *
 * This module is data-free. {@link BuildMetrics.distributorMetrics}
 * (`./build-metrics`) resolves the powered distributor in a build for you.
 *
 * @remarks
 * The SYS and WEP curves follow EDCD/Coriolis; the ENG curve is cross-checked
 * against EDSY's boost-frequency calculation. Credit and licence terms are in
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @packageDocumentation
 */

import { capacitorRechargeAtPips } from './internal/capacitor-recharge.js';

/** Everything {@link distributorMetrics} needs about one power distributor. */
export interface DistributorInput {
    /** SYS-capacitor capacity, in megajoules — finite and non-negative. */
    readonly systemsCapacity: number;
    /** Four-SYS-pip recharge rate, in megajoules per second — finite and non-negative. */
    readonly systemsRecharge: number;
    /** ENG-capacitor capacity, in megajoules — finite and non-negative. */
    readonly enginesCapacity: number;
    /** Four-ENG-pip recharge rate, in megajoules per second — finite and non-negative. */
    readonly enginesRecharge: number;
    /** WEP-capacitor capacity, in megajoules — finite and non-negative. */
    readonly weaponsCapacity: number;
    /** Four-WEP-pip recharge rate, in megajoules per second — finite and non-negative. */
    readonly weaponsRecharge: number;
    /** Pips assigned to SYS, in `[0, 4]`. Fractional pips are accepted; defaults to `4`. */
    readonly systemsPips?: number;
    /** Pips assigned to ENG, in `[0, 4]`. Fractional pips are accepted; defaults to `4`. */
    readonly enginesPips?: number;
    /** Pips assigned to WEP, in `[0, 4]`. Fractional pips are accepted; defaults to `4`. */
    readonly weaponsPips?: number;
}

/** One distributor capacitor at a chosen pip allocation. */
export interface DistributorCapacitorMetrics {
    /** Energy the capacitor holds when full, in megajoules. */
    readonly capacity: number;
    /** Maximum recharge at four pips, in megajoules per second. */
    readonly ratedRecharge: number;
    /** Actual recharge at the selected pips, in megajoules per second. */
    readonly rechargeRate: number;
}

/** Pip allocation used by {@link DistributorMetrics}. */
export interface DistributorPips {
    /** Pips assigned to SYS, in `[0, 4]`. */
    readonly systems: number;
    /** Pips assigned to ENG, in `[0, 4]`. */
    readonly engines: number;
    /** Pips assigned to WEP, in `[0, 4]`. */
    readonly weapons: number;
}

/**
 * All three capacitor figures for one power distributor and pip allocation.
 *
 * @remarks
 * Frozen — nested records and lists included — so a result can be held, cached and
 * shared without a defensive copy. Derive a changed figure with a spread rather than
 * by assigning into one.
 */
export interface DistributorMetrics {
    /** SYS-capacitor capacity and recharge. */
    readonly systems: DistributorCapacitorMetrics;
    /** ENG-capacitor capacity and recharge. */
    readonly engines: DistributorCapacitorMetrics;
    /** WEP-capacitor capacity and recharge. */
    readonly weapons: DistributorCapacitorMetrics;
    /** Pip allocation used to calculate the three recharge rates. */
    readonly pips: DistributorPips;
}

const requirePips = (name: string, value: number): void => {
    if (!Number.isFinite(value) || value < 0 || value > 4) {
        throw new RangeError(`distributorMetrics: ${name} must be a finite number from 0 to 4`);
    }
};

const requireFiniteNonNegative = (name: string, value: number): void => {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`distributorMetrics: ${name} must be a finite non-negative number`);
    }
};

const capacitorMetrics = (
    capacity: number,
    ratedRecharge: number,
    pips: number,
): DistributorCapacitorMetrics =>
    Object.freeze({
        capacity,
        ratedRecharge,
        rechargeRate: capacitorRechargeAtPips(ratedRecharge, pips),
    });

/**
 * Calculate SYS, ENG and WEP recharge at one set of pip allocations.
 *
 * @param input - All three distributor capacities, their rated four-pip recharge
 * rates and the pips to model.
 * @returns Capacity, rated recharge and actual recharge for each capacitor, plus
 * the allocations used. Each omitted allocation defaults independently to `4`;
 * allocations are not required to sum to the six pips available in game so callers
 * can compare independent scenarios in one result.
 * @throws {RangeError} If a capacity or recharge is negative or non-finite, or a
 * pip allocation is outside `[0, 4]` or non-finite.
 * @example
 * ```ts
 * import { distributorMetrics } from '@elite-dangerous-almanac/core/ships/distributor';
 *
 * distributorMetrics({
 *   systemsCapacity: 32,
 *   systemsRecharge: 3.2,
 *   enginesCapacity: 32,
 *   enginesRecharge: 3.2,
 *   weaponsCapacity: 48,
 *   weaponsRecharge: 4.8,
 *   systemsPips: 2,
 *   enginesPips: 2,
 *   weaponsPips: 2,
 * }).engines.rechargeRate; // -> 1.492… MJ/s
 * ```
 */
export function distributorMetrics(input: DistributorInput): DistributorMetrics {
    const pips = Object.freeze({
        systems: input.systemsPips ?? 4,
        engines: input.enginesPips ?? 4,
        weapons: input.weaponsPips ?? 4,
    });
    requirePips('systemsPips', pips.systems);
    requirePips('enginesPips', pips.engines);
    requirePips('weaponsPips', pips.weapons);
    for (const field of [
        'systemsCapacity',
        'systemsRecharge',
        'enginesCapacity',
        'enginesRecharge',
        'weaponsCapacity',
        'weaponsRecharge',
    ] as const) {
        requireFiniteNonNegative(field, input[field]);
    }

    return Object.freeze({
        systems: capacitorMetrics(input.systemsCapacity, input.systemsRecharge, pips.systems),
        engines: capacitorMetrics(input.enginesCapacity, input.enginesRecharge, pips.engines),
        weapons: capacitorMetrics(input.weaponsCapacity, input.weaponsRecharge, pips.weapons),
        pips,
    });
}
