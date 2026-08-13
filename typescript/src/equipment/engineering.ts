/**
 * Data-free helpers shared by personal-equipment upgrade and modification recipes.
 *
 * @packageDocumentation
 */

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
