/**
 * The **blueprint catalogue** — every engineering blueprint's per-grade stat
 * modifiers **and material requirements**, keyed by the blueprint's Frontier `fdname`
 * (as it appears in a journal `Loadout` event's `Engineering.BlueprintName`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Each grade is a {@link BlueprintGrade} — its `features` (feed to
 * {@link computeModifiers} from `./engineering`), optional converted
 * `damageDistribution`, and `materials` (what a roll costs). Read the complete record
 * with {@link getBlueprintGrade}.
 *
 * Keys are Frontier `fdname`s — the exact strings a journal `Loadout` event carries in
 * `Engineering.BlueprintName` (e.g. `"FSD_LongRange"`), not the in-game display names.
 * **Three keys collide**, and say so in their own {@link Blueprint.journalName} — each is
 * a recipe the game writes under an id another record already answers to:
 * `Scanner_LongRange` and `Scanner_WideAngle` are coriolis keys for recipes the game writes
 * as `Sensor_LongRange` / `Sensor_WideAngle`, the ids it also writes for the sensor suites'
 * different recipes of the same name; `MC_Overcharged` is its multi-cannon Overcharged,
 * which cuts the clip by 3–15% where the `Weapon_Overcharged` the game writes for both
 * leaves it alone. `ships/blueprint-journal` reads one against a module.
 *
 * A further 27 keys are the **Operations** ids: 21 recipes a module is *sold*
 * carrying (`ships/pre-engineered`), four Operations recipes a player rolls at an engineer
 * (`ships/engineering-options`), and two the community spellings of Anti-Guardian Zone
 * Resistance, whose journal id `GuardianModule_Sturdy` is a key here in its own right. None
 * carries a `journalName`, because no journal spelling has been observed for any of them —
 * which is a gap in the evidence, not a claim that the game writes none.
 * Enumerate the 109 blueprints with `Object.keys(BLUEPRINTS)`.
 *
 * Data from EDCD/coriolis-data (`modifications/blueprints.json`): `features` from the
 * grade with journal Labels resolved via EDSY, `materials` from the grade's
 * `components` resolved to material symbols against the `materials` domain; see
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import blueprintsData from '../../../data/ships/blueprints.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { rollsForGrade, sumMaterials } from './engineering.js';
import type { Blueprint, BlueprintGrade, EngineeringMaterial } from './engineering.js';

/**
 * Every blueprint, keyed by Frontier `fdname` (e.g. `"FSD_LongRange"`). Each is a
 * {@link Blueprint} — its display `name` and its per-grade `grades`, where each grade
 * carries its `features` (modifiers), optional converted `damageDistribution`, and its
 * `materials` (recipe).
 *
 * @example
 * ```ts
 * import { BLUEPRINTS } from '@elite-dangerous-almanac/core/ships/blueprints';
 *
 * BLUEPRINTS['FSD_LongRange']?.name;               // -> 'Increased range'
 * BLUEPRINTS['FSD_LongRange']?.grades['5']?.features;  // -> [{ label: 'Integrity', ... }, ...]
 * BLUEPRINTS['FSD_LongRange']?.grades['5']?.materials; // -> [{ symbol: 'Arsenic', name: 'Arsenic', count: 1 }, ...]
 * BLUEPRINTS['BeamLaser_ThermalPlasmaConversion']?.grades['5']?.damageDistribution;
 * // -> { thermal: 0.845, absolute: 0.155 }
 * ```
 */
export const BLUEPRINTS: Readonly<Record<string, Blueprint>> = deepFreeze(
    blueprintsData as Record<string, Blueprint>,
);

/**
 * Look up a blueprint by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @returns The blueprint (its `name` and `grades`), or `null` if this catalogue stores no
 * blueprint under that id.
 * @remarks
 * **`null` is not always an unknown id.** The game writes a handful of cosmetic
 * transformations in the same `BlueprintName` / `EngineerModifications` field, and they
 * name no recipe — no grade, no materials, and no engineer who applies one.
 * {@link isDecorativeModification} from `ships/decorative-modifications` is what tells one
 * of those apart from an id this library has never heard of. Note that such an id is not a
 * claim that the module is unmodified: read a fitted one's stats from the journal's own
 * `Engineering.Modifiers`.
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
 * Look up one complete grade of a blueprint, case-insensitively.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @param grade - The grade, `1`–`5`.
 * @returns The grade record — its modifier `features`, optional converted
 * `damageDistribution`, and material recipe — or `null` if the catalogue holds no such
 * blueprint or grade. See {@link getBlueprint} for what an absent blueprint can mean
 * besides "unknown".
 * @example
 * ```ts
 * import { getBlueprintGrade } from '@elite-dangerous-almanac/core/ships/blueprints';
 *
 * const grade = getBlueprintGrade('FSD_LongRange', 5);
 * grade?.features;  // -> [{ label: 'Integrity', ... }, ...]
 * grade?.materials; // -> [{ symbol: 'Arsenic', ... }, ...]
 * ```
 */
export function getBlueprintGrade(fdname: string, grade: number): BlueprintGrade | null {
    return getBlueprint(fdname)?.grades[String(grade)] ?? null;
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
 * This is blueprint cost only; an experimental effect is a separate single application.
 * Fold the effect record's `materials` in with {@link sumMaterials} if you want the grand
 * total (kept apart so a consumer who never applies an experimental does not bundle that
 * catalogue).
 *
 * **It takes an id and no module, and that is safe for the one id that needs a module to
 * read.** The game writes `Sensor_LongRange` / `Sensor_WideAngle` for two different recipes
 * — a sensor suite's and a utility scanner's — which is why `ships/blueprint-journal`
 * exposes `resolveBlueprintForModule` for the *stats*. The costs are identical across both
 * pairs at every grade, so pricing either spelling bills correctly and this function needs
 * no such lookup; `engineering.test.ts` holds upstream to that, and would fail here first
 * if the two ever diverged.
 *
 * @param fdname - The blueprint id, e.g. `"FSD_LongRange"`.
 * @param grade - The target grade, `1`–`5`.
 * @param currentGrade - The grade the module is already at (completed), default `0` for
 * an unengineered module. Only grades above it are charged; `currentGrade >= grade`
 * costs nothing (`[]`).
 * @returns One entry per distinct material with its summed `count`, or `null` if the
 * catalogue holds no such blueprint or target grade, or `currentGrade` is negative or not
 * an integer. A grade the blueprint does not define is skipped (so a blueprint that starts
 * above grade 1 costs only the grades it has); a grade whose recipe is empty contributes
 * nothing.
 * @example
 * ```ts
 * import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprints';
 *
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
