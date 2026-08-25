/**
 * The **blueprint mechanics catalogue** — every engineering blueprint's per-grade stat
 * modifiers, keyed by the blueprint's Frontier symbol
 * (as it appears in a journal `Loadout` event's `Engineering.BlueprintName`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Each grade is a {@link BlueprintGrade} — its `features` (feed to
 * {@link computeModifiers} from `./engineering`) and optional converted
 * `damageDistribution`. Read it with {@link getBlueprintGrade}. Material shopping lists
 * live separately in `ships/blueprint-costs`, so applying a recipe does not bundle what it
 * costs — though `ShipLoadout` carries both, since it prices a build as well as
 * engineering one.
 *
 * Keys are Frontier symbols — normally the exact strings a journal `Loadout` event
 * carries in `Engineering.BlueprintName` (e.g. `"FSD_LongRange"`), not the in-game display
 * names. **Three keys collide**: each is a recipe the game writes under an id another
 * record already answers to:
 * `Scanner_LongRange` and `Scanner_WideAngle` are coriolis keys for recipes the game writes
 * as `Sensor_LongRange` / `Sensor_WideAngle`, the ids it also writes for the sensor suites'
 * different recipes of the same name; `MC_Overcharged` is its multi-cannon Overcharged,
 * which cuts the clip by 3–15% where the `Weapon_Overcharged` the game writes for both
 * leaves it alone. `ships/blueprint-journal` keeps those three spellings apart from this
 * full mechanics catalogue and resolves one against a module.
 *
 * A further 25 keys are the **Operations** ids: 21 recipes a module is *sold*
 * carrying (`ships/pre-engineered`) and four Operations recipes a player rolls at an
 * engineer (`ships/engineering-options`). No journal spelling has been observed for those
 * Operations ids — a gap in the evidence, not a claim that the game writes none.
 *
 * **Every recipe is keyed once.** Anti-Guardian Zone Resistance is
 * `GuardianModule_Sturdy`, the id the game writes on Guardian weapons as well as on
 * Guardian modules; the Inara registry's `recipe_guardianmodule_sturdy` and
 * `recipe_guardianweapon_sturdy` are that registry's own spellings of the same recipe and
 * are not keys here.
 * Enumerate the 107 blueprints with `Object.keys(BLUEPRINTS)`.
 *
 * Data from EDCD/coriolis-data (`modifications/blueprints.json`): `features` from the
 * grade with journal Labels resolved via EDSY; see
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import blueprintsData from '../../../data/ships/blueprints.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';
import type { Blueprint, BlueprintGrade } from './engineering.js';
import { requireStringIfPresent } from '../internal/argument-guards.js';

/**
 * Every blueprint, keyed by Frontier symbol (e.g. `"FSD_LongRange"`). Each is a
 * {@link Blueprint} — its display `name` and its per-grade `grades`, where each grade
 * carries its `features` (modifiers) and optional converted `damageDistribution`.
 *
 * @example
 * ```ts
 * import { BLUEPRINTS } from '@elite-dangerous-almanac/core/ships/blueprints';
 *
 * BLUEPRINTS['FSD_LongRange']?.name;               // -> 'Increased range'
 * BLUEPRINTS['FSD_LongRange']?.grades['5']?.features;  // -> [{ label: 'Integrity', ... }, ...]
 * BLUEPRINTS['BeamLaser_ThermalPlasmaConversion']?.grades['5']?.damageDistribution;
 * // -> { thermal: 0.845, absolute: 0.155 }
 * ```
 */
export const BLUEPRINTS: Readonly<Record<string, Blueprint>> = deepFreeze(
    blueprintsData as Record<string, Blueprint>,
);

/**
 * Look up a blueprint by its Frontier symbol, case-insensitively.
 *
 * @param blueprintSymbol - The blueprint id, e.g. `"FSD_LongRange"`. Leading/trailing
 * whitespace and case are ignored.
 * @returns The blueprint (its `name` and `grades`), or `null` if this catalogue stores no
 * blueprint under that id.
 * @remarks
 * **`null` is not always an unknown id.** The game writes the grade-5 `Decorative_*`
 * identities of festive pre-engineered variants in the same `BlueprintName` /
 * `EngineerModifications` field. They name no craftable recipe — no materials or applying
 * engineer — and are carried by the variants returned from
 * `getPreEngineeredVariants` in `ships/pre-engineered`. Their fixed modifiers still
 * change the fitted article's stats.
 * @throws {TypeError} If `blueprintSymbol` is present and not a string. A nullish
 * `blueprintSymbol` is a miss, answered the way an unrecognised one is.
 */
export function getBlueprint(blueprintSymbol: string): Blueprint | null {
    return findByRawKey(BLUEPRINTS, blueprintSymbol, 'getBlueprint: blueprintSymbol');
}

/**
 * Look up one complete grade of a blueprint, case-insensitively.
 *
 * @param blueprintSymbol - The blueprint id, e.g. `"FSD_LongRange"`. Leading/trailing
 * whitespace and case are ignored.
 * @param grade - The grade, `1`–`5`.
 * @returns The grade record — its modifier `features` and optional converted
 * `damageDistribution` — or `null` if the catalogue holds no such blueprint or grade.
 * See {@link getBlueprint} for what an absent blueprint can mean besides "unknown".
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 * @throws {TypeError} If `blueprintSymbol` is present and not a string. A nullish
 * `blueprintSymbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getBlueprintGrade } from '@elite-dangerous-almanac/core/ships/blueprints';
 *
 * const grade = getBlueprintGrade('FSD_LongRange', 5);
 * grade?.features;  // -> [{ label: 'Integrity', ... }, ...]
 * ```
 */
export function getBlueprintGrade(blueprintSymbol: string, grade: number): BlueprintGrade | null {
    requireStringIfPresent(blueprintSymbol, 'getBlueprintGrade: blueprintSymbol');
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`getBlueprintGrade: grade must be an integer in [1, 5]`);
    }
    return getBlueprint(blueprintSymbol)?.grades[String(grade)] ?? null;
}
