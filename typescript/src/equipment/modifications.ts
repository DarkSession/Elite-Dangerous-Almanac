/**
 * Engineer-applied modification recipes for Odyssey suits and handheld weapons.
 *
 * The catalogue is keyed by recipe symbol, following the same pattern as ship
 * blueprints and experimental effects. Most keys are the exact symbol written by a
 * journal loadout. Greater Range, Headshot Damage and Improved Hip Fire Accuracy
 * each have three technology-specific recipes; use `equipment/modification-journal`
 * to resolve those journal symbols against a weapon.
 *
 * Material shopping lists live separately in `equipment/modification-costs`, so reading
 * names and engineer availability does not bundle every recipe ingredient.
 *
 * @packageDocumentation
 */

import modificationsData from '../../../data/equipment/modifications.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';
import type { PersonalModifier } from './engineering.js';

/**
 * Equipment kind a personal modification can be installed on.
 *
 * @remarks
 * A suit tool is not one of them. The one recipe that changes a tool, Reduced Tool
 * Battery Consumption, is installed on the suit and carries `"suit"`.
 */
export type PersonalModificationTarget = 'suit' | 'weapon';

/** One permanent personal-equipment engineering recipe. */
export interface PersonalModification {
    /** English in-game display name. */
    readonly name: string;
    /** Whether the modification fits suits or handheld weapons. */
    readonly target: PersonalModificationTarget;
    /** English names of the on-foot engineers who offer the modification. */
    readonly engineers: readonly string[];
    /**
     * The stat multipliers the modification applies, in the order the game applies
     * them. Fold one onto a base value with `applyPersonalModifiers` from
     * `equipment/engineering`.
     *
     * A modifier names a stat of whatever it modifies, which is usually the equipment
     * the recipe is installed on. Two suit modifications move something else, and a
     * consumer has to know about both: Extra Ammo Capacity multiplies a *weapon's*
     * `reserveAmmo`, and Reduced Tool Battery Consumption halves a *tool's*
     * `powerUsage` and the Energylink's `overloadPowerUsage` under the name
     * `toolEnergyDrain`.
     *
     * @remarks
     * **Empty** where the recipe changes nothing this catalogue names. Night Vision,
     * Scope, Reload Speed, Stowed reloading and Combat Movement Speed have no numeric
     * magnitude at all — Scope swaps the sight, and each weapon's two magnifications
     * are on its own `scopeMagnification`; Reload Speed shortens the reload, and each
     * weapon's two reload times are on its own `reloadTime`. Faster Handling, Improved
     * Hip Fire Accuracy, Stability and Improved Jump Assist do change stats, ones the
     * personal stats panel does not put a number on; see
     * [`data/equipment/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/equipment/SOURCES.md).
     */
    readonly modifiers: readonly PersonalModifier[];
}

/**
 * Every suit and weapon engineering recipe, keyed by recipe symbol.
 *
 * @remarks
 * A recipe symbol is finer-grained than a display name: Greater Range, Headshot Damage
 * and Improved Hip Fire Accuracy each have separate Kinetic, Laser and Plasma recipes
 * because their material costs differ. Their keys end in `_kinetic`, `_laser` or
 * `_plasma`; the journal omits that suffix, so resolve its value with
 * `resolvePersonalModificationForWeapon` from `equipment/modification-journal`.
 *
 * @example
 * ```ts
 * import { PERSONAL_MODIFICATIONS } from '@elite-dangerous-almanac/core/equipment/modifications';
 * PERSONAL_MODIFICATIONS['suit_increasedo2capacity']?.modifiers[0]?.multiplier; // -> 5
 * ```
 */
export const PERSONAL_MODIFICATIONS: Readonly<Record<string, PersonalModification>> = deepFreeze(
    modificationsData as Record<string, PersonalModification>,
);

/**
 * Look up a personal-equipment modification by recipe symbol, case-insensitively.
 *
 * @param symbol - Recipe symbol such as `"suit_nightvision"` or
 * `"weapon_range_kinetic"`, matched case-insensitively after trimming surrounding
 * whitespace.
 * @returns The frozen modification record, or `null` when unknown.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish symbol is a
 * miss, answered like an unrecognised one.
 * @example
 * ```ts
 * import { getPersonalModification } from '@elite-dangerous-almanac/core/equipment/modifications';
 * getPersonalModification('suit_nightvision')?.name; // -> 'Night Vision'
 * ```
 */
export function getPersonalModification(symbol: string): PersonalModification | null {
    return findByRawKey(PERSONAL_MODIFICATIONS, symbol, 'getPersonalModification: symbol');
}
