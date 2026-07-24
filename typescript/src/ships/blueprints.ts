/**
 * The **blueprint catalogue** — every engineering blueprint's per-grade stat
 * modifiers, keyed by the blueprint's Frontier `fdname` (as it appears in a journal
 * `Loadout` event's `Engineering.BlueprintName`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Feed a grade's features to {@link computeModifiers} from `./engineering`.
 *
 * Keys are Frontier `fdname`s — the exact strings a journal `Loadout` event carries in
 * `Engineering.BlueprintName` (e.g. `"FSD_LongRange"`), not the in-game display names.
 * Enumerate the 81 available blueprints with `Object.keys(BLUEPRINTS)`.
 *
 * Data from EDCD/coriolis-data (`modifications/blueprints.json`), with journal Labels
 * resolved via EDSY; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import blueprintsData from '../../../data/ships/blueprints.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';
import type { BlueprintGrades, BlueprintFeature } from './engineering.js';

/**
 * Every blueprint, keyed by Frontier `fdname` (e.g. `"FSD_LongRange"`).
 *
 * @example
 * ```ts
 * BLUEPRINTS['FSD_LongRange']['5']; // -> [{ label: 'FSDOptimalMass', ... }, ...]
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
 * Look up one grade of a blueprint.
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
    return getBlueprint(fdname)?.[String(grade)] ?? null;
}
