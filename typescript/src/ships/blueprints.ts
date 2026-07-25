/**
 * The **blueprint catalogue** — every engineering blueprint's per-grade stat
 * modifiers **and material requirements**, keyed by the blueprint's Frontier `fdname`
 * (as it appears in a journal `Loadout` event's `Engineering.BlueprintName`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Each grade is a {@link BlueprintGrade} — its `features` (feed to
 * {@link computeModifiers} from `./engineering`, or read via {@link getBlueprintGrade})
 * and its `materials` (what a roll costs, via {@link getBlueprintGradeMaterials}).
 *
 * Keys are Frontier `fdname`s — the exact strings a journal `Loadout` event carries in
 * `Engineering.BlueprintName` (e.g. `"FSD_LongRange"`), not the in-game display names.
 * Enumerate the 107 available blueprints with `Object.keys(BLUEPRINTS)`.
 *
 * Data from EDCD/coriolis-data (`modifications/blueprints.json`): `features` from the
 * grade with journal Labels resolved via EDSY, `materials` from the grade's
 * `components` resolved to material symbols against the `materials` domain; see
 * `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import blueprintsData from '../../../data/ships/blueprints.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';
import { rollsForGrade, sumMaterials } from './engineering.js';
import type { Blueprint, BlueprintFeature, EngineeringMaterial } from './engineering.js';

/**
 * Every blueprint, keyed by Frontier `fdname` (e.g. `"FSD_LongRange"`). Each is a
 * {@link Blueprint} — its display `name` and its per-grade `grades`, where each grade
 * carries its `features` (modifiers) and its `materials` (recipe).
 *
 * @example
 * ```ts
 * BLUEPRINTS['FSD_LongRange'].name;               // -> 'Increased range'
 * BLUEPRINTS['FSD_LongRange'].grades['5'].features;  // -> [{ label: 'FSDOptimalMass', ... }, ...]
 * BLUEPRINTS['FSD_LongRange'].grades['5'].materials; // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * ```
 */
export const BLUEPRINTS: Readonly<Record<string, Blueprint>> = deepFreeze(
    blueprintsData as Record<string, Blueprint>,
);

/**
 * Look up a blueprint by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @returns The blueprint (its `name` and `grades`), or `null` if unknown.
 */
export function getBlueprint(fdname: string): Blueprint | null {
    if (Object.hasOwn(BLUEPRINTS, fdname)) return BLUEPRINTS[fdname]!;
    const wanted = fdname.trim().toLowerCase();
    for (const key of Object.keys(BLUEPRINTS)) {
        if (key.toLowerCase() === wanted) return BLUEPRINTS[key]!;
    }
    return null;
}

/**
 * Look up a blueprint's in-game display name by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @returns The display name (e.g. `"Increased range"`), or `null` if the blueprint is
 * unknown.
 */
export function getBlueprintName(fdname: string): string | null {
    return getBlueprint(fdname)?.name ?? null;
}

/**
 * Look up the modifier features of one grade of a blueprint — what it changes, ready
 * for {@link computeModifiers}.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @param grade - The grade, `1`–`5`.
 * @returns The grade's features, or `null` if the blueprint or grade is unknown.
 * @example
 * ```ts
 * getBlueprintGrade('FSD_LongRange', 5); // -> [{ label: 'FSDOptimalMass', ... }, ...]
 * ```
 */
export function getBlueprintGrade(
    fdname: string,
    grade: number,
): readonly BlueprintFeature[] | null {
    return getBlueprint(fdname)?.grades[String(grade)]?.features ?? null;
}

/**
 * Look up the materials one roll of a blueprint costs at a given grade — what it
 * costs.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @param grade - The grade, `1`–`5`.
 * @returns The grade's material requirements — possibly an empty list — or `null` if
 * the blueprint is unknown or defines no recipe for that grade.
 * @remarks
 * Distinguish the two "no materials" cases: `null` means the blueprint or grade is not
 * in the catalogue, while `[]` means a **known** recipe that costs nothing. Only
 * `CargoRack_IncreasedCapacity` grade 5 returns `[]`. Blueprints are keyed only by the
 * grades that have data, so iterating grades `1`–`5` can return `null` for a grade a
 * blueprint does not define — treat that as "no such grade", not an error. Join each
 * material's `symbol` to the `materials` domain for its own grade and category.
 * @example
 * ```ts
 * getBlueprintGradeMaterials('FSD_LongRange', 5);
 * // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * ```
 */
export function getBlueprintGradeMaterials(
    fdname: string,
    grade: number,
): readonly EngineeringMaterial[] | null {
    return getBlueprint(fdname)?.grades[String(grade)]?.materials ?? null;
}

/**
 * Compute the **total** materials to engineer a module up to a grade — every grade the
 * module still has to climb, each rolled the number of times it takes to complete
 * ({@link rollsForGrade}: grade `g` needs `g` rolls), summed into one shopping list.
 *
 * By default it prices the whole climb from unengineered; pass `currentGrade` to price
 * only what is left when the module already sits at a grade. Each grade `g` in the range
 * `currentGrade + 1 … grade` contributes `g ·` (grade `g`'s recipe). To price a single
 * grade in isolation, set `currentGrade` to `grade − 1` — e.g. grade 5 alone is 5 rolls
 * of the grade-5 recipe.
 *
 * This is blueprint cost only; an experimental effect is a separate single application —
 * fold its {@link getExperimentalEffectMaterials} in with {@link sumMaterials} if you
 * want the grand total (kept apart so a consumer who never applies an experimental does
 * not bundle that catalogue).
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @param grade - The target grade, `1`–`5`.
 * @param currentGrade - The grade the module is already at (completed), default `0` for
 * an unengineered module. Only grades above it are charged; `currentGrade >= grade`
 * costs nothing (`[]`).
 * @returns One entry per distinct material with its summed `count`, or `null` if the
 * blueprint or the target grade is unknown, or `currentGrade` is negative or not an
 * integer. A grade the blueprint does not define is skipped (so a blueprint that starts
 * above grade 1 costs only the grades it has); a grade whose recipe is empty contributes
 * nothing.
 * @example
 * ```ts
 * getBlueprintCost('FSD_LongRange', 5);
 * // grades 1–5, 1+2+3+4+5 rolls — e.g. Datamined Wake Exceptions ×5 (grade-5 only, 5 rolls)
 * getBlueprintCost('FSD_LongRange', 5, 3);
 * // only grades 4 and 5, from a module already at grade 3
 * getBlueprintCost('FSD_LongRange', 5, 4);
 * // grade 5 alone — 5 rolls of the grade-5 recipe
 * ```
 */
export function getBlueprintCost(
    fdname: string,
    grade: number,
    currentGrade = 0,
): EngineeringMaterial[] | null {
    const blueprint = getBlueprint(fdname);
    if (!blueprint || !Number.isInteger(grade) || grade < 1) return null;
    if (!Number.isInteger(currentGrade) || currentGrade < 0) return null;
    if (!blueprint.grades[String(grade)]) return null; // the target grade must exist
    const perGrade: EngineeringMaterial[][] = [];
    for (let g = currentGrade + 1; g <= grade; g++) {
        const entry = blueprint.grades[String(g)];
        if (!entry) continue; // a blueprint need not define every intermediate grade
        const rolls = rollsForGrade(g);
        perGrade.push(
            entry.materials.map((m) => ({
                symbol: m.symbol,
                name: m.name,
                count: m.count * rolls,
            })),
        );
    }
    return sumMaterials(...perGrade);
}
