/**
 * Weapons-capacitor recharge and endurance at a chosen WEP-pip allocation.
 *
 * A power distributor's catalogue recharge figure is its four-pip maximum. The
 * actual rate follows the same non-linear pip curve as the SYS capacitor:
 * `ratedRecharge * (weaponsPips / 4) ^ 1.1`. Endurance compares that rate with
 * the weapons' sustained draw, so magazine reloads are already folded in.
 *
 * This module is data-free. {@link ShipLoadout.weaponsCapacitorMetrics}
 * (`./ship-loadout`) resolves the powered distributor and weapons for you.
 *
 * @remarks
 * Reference implementation: EDCD/Coriolis, `src/app/shipyard/Calculations.js`
 * (`wepRechargeRate`, `timeToDrainWep`), commit
 * `68c042ca6e3db62372cbbb2077cf972345511712`. The algorithm is ported as fact,
 * not code; credit and licence terms are in
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @packageDocumentation
 */

import { capacitorRechargeAtPips } from './internal/capacitor-recharge.js';

/** Everything {@link weaponsCapacitorMetrics} needs about one firing load. */
export interface WeaponsCapacitorInput {
    /** WEP-capacitor capacity, in megajoules — finite and non-negative. */
    readonly weaponsCapacity: number;
    /** Four-WEP-pip recharge rate, in megajoules per second — finite and non-negative. */
    readonly weaponsRecharge: number;
    /** Sustained weapons-capacitor draw, in megajoules per second — finite and non-negative. */
    readonly sustainedEnergyPerSecond: number;
    /** Pips assigned to WEP, in `[0, 4]`. Fractional pips are accepted; defaults to `4`. */
    readonly weaponsPips?: number;
}

/** Recharge, drain and endurance of one weapons capacitor. */
export interface WeaponsCapacitorMetrics {
    /** Pips assigned to WEP for this result, in `[0, 4]`. */
    readonly weaponsPips: number;
    /** WEP-capacitor capacity, in megajoules. */
    readonly capacity: number;
    /** Actual recharge rate at {@link weaponsPips}, in megajoules per second. */
    readonly rechargeRate: number;
    /** Sustained draw across the firing weapons, in megajoules per second. */
    readonly sustainedEnergyPerSecond: number;
    /** Capacity lost per second after recharge, floored at `0`, in megajoules per second. */
    readonly netDrainRate: number;
    /** Seconds from full to empty, or `Infinity` when recharge keeps pace with draw. */
    readonly timeToDrain: number;
}

function requireFiniteNonNegative(scope: string, name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${scope}: ${name} must be a finite non-negative number`);
    }
}

/**
 * Calculate WEP recharge and time to drain while a weapon load fires continuously.
 *
 * @param input - Distributor capacity, its rated four-pip recharge, sustained weapon
 * draw and the WEP-pip allocation to model.
 * @returns Actual recharge, net drain and seconds until empty. `timeToDrain` is
 * `Infinity` when the weapons draw no more than the actual recharge rate. A positive
 * draw with zero capacity drains immediately (`0` seconds).
 * @throws {RangeError} If a capacity, recharge or draw is negative or non-finite, or
 * `weaponsPips` is outside `[0, 4]`.
 * @example
 * ```ts
 * import { weaponsCapacitorMetrics } from '@elite-dangerous-almanac/core/ships/weapons-capacitor';
 *
 * weaponsCapacitorMetrics({
 *   weaponsCapacity: 20,
 *   weaponsRecharge: 5,
 *   sustainedEnergyPerSecond: 7,
 *   weaponsPips: 2,
 * }).timeToDrain; // -> 4.285…
 * ```
 */
export function weaponsCapacitorMetrics(input: WeaponsCapacitorInput): WeaponsCapacitorMetrics {
    const scope = 'weaponsCapacitorMetrics';
    const weaponsPips = input.weaponsPips ?? 4;
    if (!Number.isFinite(weaponsPips) || weaponsPips < 0 || weaponsPips > 4) {
        throw new RangeError(`${scope}: weaponsPips must be a finite number from 0 to 4`);
    }
    for (const field of [
        'weaponsCapacity',
        'weaponsRecharge',
        'sustainedEnergyPerSecond',
    ] as const) {
        requireFiniteNonNegative(scope, field, input[field]);
    }

    const rechargeRate = capacitorRechargeAtPips(input.weaponsRecharge, weaponsPips);
    const netDrainRate = Math.max(0, input.sustainedEnergyPerSecond - rechargeRate);
    return {
        weaponsPips,
        capacity: input.weaponsCapacity,
        rechargeRate,
        sustainedEnergyPerSecond: input.sustainedEnergyPerSecond,
        netDrainRate,
        timeToDrain: netDrainRate === 0 ? Infinity : input.weaponsCapacity / netDrainRate,
    };
}
