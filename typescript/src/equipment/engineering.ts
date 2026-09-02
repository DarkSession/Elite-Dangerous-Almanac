/**
 * Data-free helpers shared by personal-equipment upgrade and modification recipes.
 *
 * @packageDocumentation
 */

import { describeValue, requireString } from '../internal/argument-guards.js';

/** One Odyssey micro resource consumed by a personal-equipment engineering step. */
export interface PersonalEngineeringIngredient {
    /** Frontier micro-resource symbol; join it to `materials/micro-resources`. */
    readonly symbol: string;
    /** Units consumed. */
    readonly count: number;
}

/**
 * Combine personal-engineering shopping lists by symbol.
 *
 * @param recipes - Ingredient lists to add. Input records are not modified.
 * @returns One mutable result record per symbol, in first-seen order.
 * @example
 * ```ts
 * import { sumPersonalEngineeringIngredients } from '@elite-dangerous-almanac/core/equipment/engineering';
 * sumPersonalEngineeringIngredients(
 *   [{ symbol: 'graphene', count: 2 }],
 *   [{ symbol: 'graphene', count: 5 }],
 * ); // -> [{ symbol: 'graphene', count: 7 }]
 * ```
 */
export function sumPersonalEngineeringIngredients(
    ...recipes: readonly (readonly PersonalEngineeringIngredient[])[]
): PersonalEngineeringIngredient[] {
    const totals = new Map<string, PersonalEngineeringIngredient>();
    for (const ingredient of recipes.flat()) {
        const key = ingredient.symbol.toLowerCase();
        const previous = totals.get(key);
        totals.set(key, {
            symbol: previous?.symbol ?? ingredient.symbol,
            count: (previous?.count ?? 0) + ingredient.count,
        });
    }
    return [...totals.values()];
}

/**
 * One stat multiplier an engineer-applied modification puts on a suit, a handheld
 * weapon or a suit tool.
 *
 * @remarks
 * A personal modification is applied in one step: it has no grade and no quality roll,
 * so a modifier is a single factor rather than the `[min, max]` band a ship blueprint
 * feature carries. `1` is the no-op value and is never stored — a recipe lists only the
 * stats it actually moves.
 */
export interface PersonalModifier {
    /**
     * The stat the factor multiplies, named as the equipment catalogues name it —
     * `"magazineSize"`, `"effectiveRange"`, `"batteryCapacity"`, `"goodsCapacity"`.
     *
     * @remarks
     * Some stats the game shows on foot have no catalogue field, because the panel
     * shows no base for them. They are named for what they are: `"meleeDamage"`,
     * `"sprintDuration"`, and the pressurised and unpressurised firing audible ranges.
     *
     * `"toolEnergyDrain"` names no field either, but its bases are catalogued: it is a
     * tool's `powerUsage` and the Energylink's `overloadPowerUsage` in
     * `equipment/tools`. The Energylink's `dischargeRate` carries its own name because
     * the game leaves it alone, so hand `applyPersonalModifiers` the base the factor
     * applies to.
     */
    readonly stat: string;
    /** The factor the stat is multiplied by, e.g. `1.5` for a 50% increase. */
    readonly multiplier: number;
    /** Whether the game rounds the result up to a whole number, as it does a magazine. */
    readonly roundUp?: boolean;
}

/**
 * Apply every modifier for one stat to its base value.
 *
 * A **resistance** is the exception, exactly as it is for ship engineering: the factor
 * multiplies the *damage taken*, so a resistance compounds on `1 − r`. Damage Resistance
 * is `×0.9` on damage taken, which turns a `0.5` resistance into `0.55` rather than
 * `0.45`. Any stat whose name ends in `Resistance` is treated this way.
 *
 * @param stat - Stat to apply, e.g. `"magazineSize"`. Modifiers naming another stat are
 * skipped, so a whole suit's or weapon's modifier list can be passed for each stat.
 * @param base - The catalogue value before engineering.
 * @param modifiers - Modifiers to fold in, in order.
 * @returns The modified value, rounded to six decimals to keep binary floating-point
 * noise out of a displayed stat.
 * @throws {TypeError} If `stat` is not a string or `base` is not a finite number.
 * @example
 * ```ts
 * import { applyPersonalModifiers } from '@elite-dangerous-almanac/core/equipment/engineering';
 * import { getPersonalModification } from '@elite-dangerous-almanac/core/equipment/modifications';
 *
 * const clipSize = getPersonalModification('weapon_clipsize')?.modifiers ?? [];
 * applyPersonalModifiers('magazineSize', 45, clipSize); // -> 68
 * ```
 */
export function applyPersonalModifiers(
    stat: string,
    base: number,
    modifiers: readonly PersonalModifier[],
): number {
    requireString(stat, 'applyPersonalModifiers: stat');
    if (!Number.isFinite(base)) {
        throw new TypeError(
            `applyPersonalModifiers: base must be a finite number, received ${describeValue(base)}`,
        );
    }

    const onDamageTaken = stat.endsWith('Resistance');
    let value = onDamageTaken ? 1 - base : base;
    for (const modifier of modifiers) {
        if (modifier.stat !== stat) continue;
        value *= modifier.multiplier;
        if (modifier.roundUp) value = Math.ceil(value);
    }
    return Math.round((onDamageTaken ? 1 - value : value) * 1e6) / 1e6;
}
