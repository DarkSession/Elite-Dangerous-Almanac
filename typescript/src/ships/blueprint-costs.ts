/**
 * The **blueprint cost catalogue** — material shopping lists kept separate from
 * blueprint mechanics so calculating or editing a build does not bundle them.
 *
 * Each blueprint id maps its available grades to the materials consumed by one roll.
 * Use {@link getBlueprintGradeCost} for that per-roll recipe or {@link getBlueprintCost}
 * for the complete weighted climb to a target grade. The matching stat modifiers live
 * in `ships/blueprints`.
 *
 * Data from EDCD/coriolis-data (`modifications/blueprints.json`), with Operations and
 * Anti-Guardian recipes from the Inara registry and Frontier update notes; see
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import blueprintCostsData from '../../../data/ships/blueprint-costs.jsonc' with { type: 'json' };
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
    return findByRawKey(BLUEPRINT_COSTS, fdname, 'getBlueprintCosts: fdname');
}

/**
 * Look up the materials consumed by **one roll** at one blueprint grade.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @param grade - The grade, `1`–`5`.
 * @returns The frozen per-roll material list, or `null` if no ordinary craft cost is
 * catalogued for the blueprint and grade.
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 * @example
 * ```ts
 * import { getBlueprintGradeCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * getBlueprintGradeCost('FSD_LongRange', 5);
 * // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * ```
 */
export function getBlueprintGradeCost(
    fdname: string,
    grade: number,
): readonly EngineeringMaterial[] | null {
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`getBlueprintGradeCost: grade must be an integer in [1, 5]`);
    }
    return getBlueprintCosts(fdname)?.[String(grade)] ?? null;
}

/**
 * Compute the **total** materials to engineer a module up to a grade — every grade the
 * module still has to climb, each rolled the number of times it takes to complete
 * ({@link rollsForGrade}: grade `g` needs `g` rolls), summed into one shopping list.
 *
 * By default it prices the whole climb from unengineered; pass `currentGrade` to price
 * only what remains. Each grade `g` in `currentGrade + 1 … grade` contributes
 * `g ·` (grade `g`'s recipe). To price a single grade's complete progression, set
 * `currentGrade` to `grade − 1`; use {@link getBlueprintGradeCost} for one roll.
 *
 * This is blueprint cost only. An experimental effect is a separate application; combine
 * its `getExperimentalEffectCost` result with this one using {@link sumMaterials}.
 *
 * The game writes three colliding ids for two different recipes, but each pair costs the
 * same materials at every grade. Either spelling therefore prices correctly without a
 * fitted module; cross-catalogue tests pin that invariant.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @param grade - The target grade, `1`–`5`.
 * @param currentGrade - The completed grade, `0`–`5`; defaults to `0` for an
 * unengineered module.
 * Only grades above it are charged; `currentGrade >= grade` costs nothing (`[]`).
 * @returns One entry per distinct material with its summed `count`, or `null` if no
 * ordinary craft cost is catalogued for the blueprint and target grade. A blueprint that
 * starts above grade 1 charges only the grades it defines.
 * @throws {RangeError} If `grade` is not an integer from 1 through 5, or `currentGrade`
 * is not an integer from 0 through 5.
 * @example
 * ```ts
 * import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 *
 * getBlueprintCost('FSD_LongRange', 5);    // grades 1–5
 * getBlueprintCost('FSD_LongRange', 5, 3); // grades 4 and 5 only
 * getBlueprintCost('FSD_LongRange', 5, 4); // grade 5 progression only
 * ```
 */
export function getBlueprintCost(
    fdname: string,
    grade: number,
    currentGrade = 0,
): EngineeringMaterial[] | null {
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`getBlueprintCost: grade must be an integer in [1, 5]`);
    }
    if (!Number.isInteger(currentGrade) || currentGrade < 0 || currentGrade > 5) {
        throw new RangeError(`getBlueprintCost: currentGrade must be an integer in [0, 5]`);
    }

    const costs = getBlueprintCosts(fdname);
    if (!costs) return null;
    if (!costs[String(grade)]) return null;

    const perGrade: EngineeringMaterial[][] = [];
    for (let g = currentGrade + 1; g <= grade; g++) {
        const recipe = costs[String(g)];
        if (!recipe) continue;
        const rolls = rollsForGrade(g);
        perGrade.push(
            recipe.map((material) => ({
                symbol: material.symbol,
                name: material.name,
                count: material.count * rolls,
            })),
        );
    }
    return sumMaterials(...perGrade);
}
