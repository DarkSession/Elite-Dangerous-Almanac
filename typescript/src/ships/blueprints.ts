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
 * Enumerate the 81 available blueprints with `Object.keys(BLUEPRINTS)`.
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
import type { BlueprintGrades, BlueprintFeature, BlueprintMaterial } from './engineering.js';

/**
 * Every blueprint, keyed by Frontier `fdname` (e.g. `"FSD_LongRange"`). Each grade
 * carries its `features` (modifiers) and its `materials` (recipe).
 *
 * @example
 * ```ts
 * BLUEPRINTS['FSD_LongRange']['5'].features;  // -> [{ label: 'FSDOptimalMass', ... }, ...]
 * BLUEPRINTS['FSD_LongRange']['5'].materials; // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * ```
 */
export const BLUEPRINTS: Readonly<Record<string, BlueprintGrades>> = deepFreeze(
    blueprintsData as Record<string, BlueprintGrades>,
);

/**
 * Look up a blueprint by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @returns The blueprint's grades, or `null` if unknown.
 */
export function getBlueprint(fdname: string): BlueprintGrades | null {
    if (Object.hasOwn(BLUEPRINTS, fdname)) return BLUEPRINTS[fdname]!;
    const wanted = fdname.trim().toLowerCase();
    for (const key of Object.keys(BLUEPRINTS)) {
        if (key.toLowerCase() === wanted) return BLUEPRINTS[key]!;
    }
    return null;
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
    return getBlueprint(fdname)?.[String(grade)]?.features ?? null;
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
): readonly BlueprintMaterial[] | null {
    return getBlueprint(fdname)?.[String(grade)]?.materials ?? null;
}
