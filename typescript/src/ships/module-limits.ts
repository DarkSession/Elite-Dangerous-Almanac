/**
 * Per-ship module-count limits.
 *
 * The base allowances and fitted increases reproduce EDSY's `limit` / `unlimit`
 * model. See
 * [`ATTRIBUTIONS.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md)
 * for source credit and licence details.
 *
 * @packageDocumentation
 */

import type { ModuleLimitGroup, ModuleLimitIncrease } from './modules.js';

/**
 * Base number of fitted modules allowed in each per-ship limit family.
 *
 * @remarks
 * Every value is a positive whole-module count. A fitted
 * {@link ModuleLimitIncrease} raises this base; use {@link calculateModuleLimits} for
 * the effective allowance and current excess rather than adding grants yourself.
 *
 * @example
 * ```ts
 * import { SHIP_MODULE_LIMITS } from '@elite-dangerous-almanac/core/ships/module-limits';
 *
 * SHIP_MODULE_LIMITS.experimentalWeapon; // -> 4
 * ```
 */
export const SHIP_MODULE_LIMITS: Readonly<Record<ModuleLimitGroup, number>> = Object.freeze({
    experimentalWeapon: 4,
});

/** The limit metadata needed by {@link calculateModuleLimits}. */
export interface ModuleLimitEntry {
    /** Per-ship count family this fitted module consumes, if any. */
    readonly limitGroup?: ModuleLimitGroup;
    /** Allowance increase this fitted module grants, if any. */
    readonly limitIncrease?: ModuleLimitIncrease;
}

/** One per-ship limit family's resolved allowance and fitted usage. */
export interface ModuleLimitUsage {
    /** Stable limit-family id. */
    readonly group: ModuleLimitGroup;
    /** Allowance before fitted increases. */
    readonly baseLimit: number;
    /** Sum of the increases granted by fitted modules. */
    readonly increase: number;
    /** Effective allowance: `baseLimit + increase`. */
    readonly limit: number;
    /** Number of fitted modules consuming the allowance. */
    readonly count: number;
    /** Number above the effective allowance, or `0` when within it. */
    readonly excess: number;
}

/**
 * Resolve every per-ship module-count allowance for a fitted module list.
 *
 * @remarks
 * This calculation reproduces EDSY's per-ship `limit` / `unlimit` model; see
 * [`ATTRIBUTIONS.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @param modules - Fitted modules reduced to their optional limit metadata. Every entry
 * carrying `limitGroup` consumes one place; every `limitIncrease` raises the named
 * allowance. Entries may carry both.
 * @returns A deeply frozen usage record for every known family, in
 * {@link SHIP_MODULE_LIMITS} order.
 * @example
 * ```ts
 * import { calculateModuleLimits } from '@elite-dangerous-almanac/core/ships/module-limits';
 *
 * calculateModuleLimits([
 *   ...Array.from({ length: 5 }, () => ({ limitGroup: 'experimentalWeapon' as const })),
 *   { limitIncrease: { group: 'experimentalWeapon', amount: 1 } },
 * ])[0];
 * // -> { group: 'experimentalWeapon', baseLimit: 4, increase: 1, limit: 5, count: 5, excess: 0 }
 * ```
 */
export function calculateModuleLimits(
    modules: readonly ModuleLimitEntry[],
): readonly ModuleLimitUsage[] {
    const count = new Map<ModuleLimitGroup, number>();
    const increase = new Map<ModuleLimitGroup, number>();
    for (const module of modules) {
        if (module.limitGroup !== undefined) {
            count.set(module.limitGroup, (count.get(module.limitGroup) ?? 0) + 1);
        }
        if (module.limitIncrease !== undefined) {
            const { group, amount } = module.limitIncrease;
            increase.set(group, (increase.get(group) ?? 0) + amount);
        }
    }
    return Object.freeze(
        (Object.entries(SHIP_MODULE_LIMITS) as [ModuleLimitGroup, number][]).map(
            ([group, baseLimit]) => {
                const added = increase.get(group) ?? 0;
                const limit = baseLimit + added;
                const fitted = count.get(group) ?? 0;
                return Object.freeze({
                    group,
                    baseLimit,
                    increase: added,
                    limit,
                    count: fitted,
                    excess: Math.max(0, fitted - limit),
                });
            },
        ),
    );
}
