/**
 * The **blueprint cost catalogue** — material shopping lists kept separate from
 * blueprint mechanics so calculating or editing a build does not bundle them.
 *
 * Each blueprint id maps its available grades to what one roll at that grade costs.
 * Use {@link getBlueprintGradeCost} for that per-roll recipe or {@link getBlueprintCost}
 * for the complete weighted climb to a target grade. Both answer with a
 * {@link BlueprintCost} — the materials consumed *and* the **Merc Coin** billed beside
 * them, since 25 recipes charge a currency as well. The matching stat modifiers live in
 * `ships/blueprints`.
 *
 * Data from EDCD/coriolis-data (`modifications/blueprints.json`), with Operations and
 * Anti-Guardian recipes from the Inara registry and Frontier update notes; see
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import blueprintCostsData from '../../../data/ships/blueprint-costs.jsonc' with { type: 'json' };
import blueprintMercCoinCostsData from '../../../data/ships/blueprint-merc-coin-costs.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';
import { rollsForGrade, sumMaterials } from './engineering.js';
import type { EngineeringMaterial } from './engineering.js';

/**
 * Material recipes for one blueprint, keyed by grade (`"1"`–`"5"`). Each list is the
 * cost of one roll at that grade.
 *
 * @example
 * ```ts
 * import type { BlueprintGradeCosts } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * const costs: BlueprintGradeCosts = {
 *   '1': [{ symbol: 'Phosphorus', name: 'Phosphorus', count: 1 }],
 * };
 * ```
 */
export type BlueprintGradeCosts = Readonly<Record<string, readonly EngineeringMaterial[]>>;

/**
 * Every craftable blueprint's per-roll material recipes, keyed by Frontier `fdname` and then grade.
 *
 * @remarks
 * Its ids and grade sets are the craftable subset of `BLUEPRINTS` from
 * `ships/blueprints`. Fixed reward identities with mechanics but no ordinary craft
 * route are deliberately absent. The catalogues are separate runtime payloads so a
 * mechanics-only consumer pays for neither material names nor counts.
 *
 * @example
 * ```ts
 * import { BLUEPRINT_COSTS } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * BLUEPRINT_COSTS['FSD_LongRange']?.['5'];
 * // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * ```
 */
export const BLUEPRINT_COSTS: Readonly<Record<string, BlueprintGradeCosts>> = deepFreeze(
    blueprintCostsData as Record<string, BlueprintGradeCosts>,
);

/**
 * Look up all per-grade material recipes for one blueprint.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @remarks
 * The material half only, straight from the catalogue. The Merc Coin some recipes charge
 * beside it lives in {@link BLUEPRINT_MERC_COIN_COSTS}; use {@link getBlueprintGradeCost}
 * or {@link getBlueprintCost} to get both halves of a cost together.
 *
 * @returns The frozen grade-to-material-list record, or `null` if no ordinary craft
 * cost is catalogued (including a known fixed reward identity).
 * @throws {TypeError} If `fdname` is present and not a string. A nullish
 * `fdname` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getBlueprintCosts } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * getBlueprintCosts('FSD_LongRange')?.['5'];
 * // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * ```
 */
export function getBlueprintCosts(fdname: string): BlueprintGradeCosts | null {
    return materialCosts(fdname, 'getBlueprintCosts: fdname');
}

/**
 * What one engineering step costs — the materials it consumes and the Merc Coin billed
 * beside them.
 *
 * @remarks
 * Merc Coin has no credit equivalent and is not a material, so it is its own member
 * rather than an entry in `materials`. Only 25 of the catalogued blueprints charge any;
 * on every other recipe `mercCoins` is `0`, which is a real amount rather than a missing
 * one — a step that is catalogued at all reports both halves of its cost.
 */
export interface BlueprintCost {
    /**
     * Every material the step consumes. One entry per distinct material, each `count`
     * already multiplied out for however many rolls the step covers.
     */
    readonly materials: readonly EngineeringMaterial[];
    /**
     * The Merc Coin the step bills, already weighted for however many rolls the step
     * covers, exactly as the `materials` counts are.
     *
     * `0` either where the recipe charges no currency — 25 blueprints do and the rest do
     * not — or where this particular step covers no grade that charges. It is therefore
     * an amount for *this* step, and reading `0` as "this blueprint never charges Merc
     * Coin" is wrong on exactly the 25 that do.
     */
    readonly mercCoins: number;
}

/**
 * Look up what **one roll** at one blueprint grade costs.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @param grade - The grade, `1`–`5`.
 * @returns The materials one roll consumes and the Merc Coin it bills, or `null` if no
 * ordinary craft cost is catalogued for the blueprint and grade. `materials` is the
 * frozen catalogue list; `mercCoins` is `0` unless the recipe charges a currency.
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 * @throws {TypeError} If `fdname` is present and not a string. A nullish
 * `fdname` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getBlueprintGradeCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * getBlueprintGradeCost('FSD_LongRange', 5)?.materials;
 * // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * getBlueprintGradeCost('FSD_LongRange', 5)?.mercCoins; // -> 0
 * getBlueprintGradeCost('RailGun_LongShot', 5)?.mercCoins; // -> 50
 * ```
 */
export function getBlueprintGradeCost(fdname: string, grade: number): BlueprintCost | null {
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`getBlueprintGradeCost: grade must be an integer in [1, 5]`);
    }
    const label = 'getBlueprintGradeCost: fdname';
    const materials = materialCosts(fdname, label)?.[String(grade)];
    if (!materials) return null;
    return { materials, mercCoins: mercCoinCosts(fdname, label)?.[String(grade)] ?? 0 };
}

/**
 * Compute the **total** cost of engineering a module up to a grade — every grade the
 * module still has to climb, each rolled the number of times it takes to complete
 * ({@link rollsForGrade}: grade `g` needs `g` rolls), summed into one shopping list and
 * one Merc Coin total.
 *
 * By default it prices the whole climb from unengineered; pass `currentGrade` to price
 * only what remains. Each grade `g` in `currentGrade + 1 … grade` contributes
 * `g ·` (grade `g`'s cost). To price a single grade's complete progression, set
 * `currentGrade` to `grade − 1`; use {@link getBlueprintGradeCost} for one roll.
 *
 * A Mercenary article is bought at grade 1 and its recipe defines grades 2–5, so pass
 * `1` to price what an engineer can still add. The four ordinary-menu recipes that also
 * bill Merc Coin — `FuelScoop_Efficiency` and the three `*Laser_ThermalPlasmaConversion`
 * — define grades 1–5 on a stock module and climb from `0` like any other recipe.
 *
 * This is blueprint cost only. An experimental effect is a separate application, and it
 * costs materials alone; combine its `getExperimentalEffectCost` result with
 * `materials` here using {@link sumMaterials}, and `mercCoins` needs no such folding.
 *
 * The game writes three colliding ids for two different recipes, but each pair costs the
 * same at every grade. Either spelling therefore prices correctly without a fitted
 * module; cross-catalogue tests pin that invariant.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @param grade - The target grade, `1`–`5`.
 * @param currentGrade - The completed grade, `0`–`5`; defaults to `0` for an
 * unengineered module.
 * Only grades above it are charged; `currentGrade >= grade` costs nothing
 * (`{ materials: [], mercCoins: 0 }`).
 * @returns The summed materials and Merc Coin total, or `null` if no ordinary craft cost
 * is catalogued for the blueprint and target grade. A blueprint that starts above
 * grade 1 charges only the grades it defines. `mercCoins` is `0` where the recipe
 * charges no currency, so `null` remains the one answer meaning "not catalogued".
 * @throws {RangeError} If `grade` is not an integer from 1 through 5, or `currentGrade`
 * is not an integer from 0 through 5.
 * @throws {TypeError} If `fdname` is present and not a string. A nullish
 * `fdname` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * getBlueprintCost('FSD_LongRange', 5);    // grades 1–5
 * getBlueprintCost('FSD_LongRange', 5, 3); // grades 4 and 5 only
 * getBlueprintCost('FSD_LongRange', 5, 4); // grade 5 progression only
 *
 * getBlueprintCost('FSD_LongRange', 5)?.mercCoins; // -> 0
 * getBlueprintCost('RailGun_LongShot', 5, 1)?.mercCoins; // -> 415
 * getBlueprintCost('FuelScoop_Efficiency', 5)?.mercCoins; // -> 350
 * ```
 */
export function getBlueprintCost(
    fdname: string,
    grade: number,
    currentGrade = 0,
): BlueprintCost | null {
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`getBlueprintCost: grade must be an integer in [1, 5]`);
    }
    if (!Number.isInteger(currentGrade) || currentGrade < 0 || currentGrade > 5) {
        throw new RangeError(`getBlueprintCost: currentGrade must be an integer in [0, 5]`);
    }

    const label = 'getBlueprintCost: fdname';
    const costs = materialCosts(fdname, label);
    if (!costs) return null;
    if (!costs[String(grade)]) return null;
    const currency = mercCoinCosts(fdname, label);

    const perGrade: EngineeringMaterial[][] = [];
    let mercCoins = 0;
    for (let g = currentGrade + 1; g <= grade; g++) {
        const recipe = costs[String(g)];
        if (!recipe) continue;
        const rolls = rollsForGrade(g);
        mercCoins += (currency?.[String(g)] ?? 0) * rolls;
        perGrade.push(
            recipe.map((material) => ({
                symbol: material.symbol,
                name: material.name,
                count: material.count * rolls,
            })),
        );
    }
    return { materials: sumMaterials(...perGrade), mercCoins };
}

/**
 * Merc Coin charged for **one roll** of a blueprint, keyed by grade (`"1"`–`"5"`).
 *
 * @example
 * ```ts
 * import type { BlueprintMercCoinCosts } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * const costs: BlueprintMercCoinCosts = { '2': 5, '3': 10 };
 * ```
 */
export type BlueprintMercCoinCosts = Readonly<Record<string, number>>;

/**
 * The Merc Coin charged per roll by every blueprint that charges any, keyed by Frontier
 * `fdname` and then grade.
 *
 * @remarks
 * The raw catalogue behind {@link BlueprintCost.mercCoins}; reach for
 * {@link getBlueprintCost} or {@link getBlueprintGradeCost} unless you want the table
 * itself. A small subset of {@link BLUEPRINT_COSTS} — 25 of its ids, in two shapes.
 * Twenty-one are the bespoke grade-2–5 recipes that only a Mercenary article, bought
 * already at grade 1, can be taken through. The other four are ordinary
 * engineering-menu recipes spanning grades 1–5 that happen to bill the currency too:
 * `FuelScoop_Efficiency` and the three `*Laser_ThermalPlasmaConversion`. Every other
 * blueprint is absent rather than zero. Merc Coin has no credit equivalent, so it is
 * never folded into a material list.
 *
 * @example
 * ```ts
 * import { BLUEPRINT_MERC_COIN_COSTS } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * BLUEPRINT_MERC_COIN_COSTS['CargoRackS5C1_Extended']; // -> { '2': 5, '3': 10, '4': 15, '5': 30 }
 * Object.hasOwn(BLUEPRINT_MERC_COIN_COSTS, 'FSD_LongRange'); // -> false
 * ```
 */
export const BLUEPRINT_MERC_COIN_COSTS: Readonly<Record<string, BlueprintMercCoinCosts>> =
    deepFreeze(blueprintMercCoinCostsData as Record<string, BlueprintMercCoinCosts>);

/**
 * Case-insensitive lookup into {@link BLUEPRINT_COSTS}. Takes the label of the public
 * function it is reached through, so a `TypeError` names what the consumer called.
 *
 * @internal
 */
function materialCosts(fdname: string, label: string): BlueprintGradeCosts | null {
    return findByRawKey(BLUEPRINT_COSTS, fdname, label);
}

/** Case-insensitive lookup into {@link BLUEPRINT_MERC_COIN_COSTS}. @internal */
function mercCoinCosts(fdname: string, label: string): BlueprintMercCoinCosts | null {
    return findByRawKey(BLUEPRINT_MERC_COIN_COSTS, fdname, label);
}
