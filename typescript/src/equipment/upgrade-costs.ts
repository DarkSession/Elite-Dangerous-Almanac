/**
 * Material costs for Pioneer Supplies suit and handheld-weapon grade upgrades.
 *
 * Recipes are keyed by the grade being reached: grade `3` is the one-time `2 → 3`
 * purchase. These costs are separate from engineer-applied modifications.
 *
 * @packageDocumentation
 */

import upgradeCostsData from '../../../data/equipment/upgrade-costs.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { getSuitByFamily } from './suits.js';
import { getPersonalWeaponBySymbol, type WeaponUpgradeGroup } from './weapons.js';
import {
    sumPersonalEngineeringIngredients,
    type PersonalEngineeringIngredient,
} from './engineering.js';

/**
 * One equipment recipe family's costs, keyed by the target grade `"2"` through `"5"`.
 * Each list is the one-time cost of upgrading from the preceding grade.
 *
 * @example
 * ```ts
 * import type { PersonalUpgradeGradeCosts } from '@elite-dangerous-almanac/core/equipment/upgrade-costs';
 *
 * const costs: PersonalUpgradeGradeCosts = {
 *   '2': [{ symbol: 'suitschematic', count: 1 }],
 *   '3': [],
 *   '4': [],
 *   '5': [],
 * };
 * costs['2'][0]?.count; // -> 1
 * ```
 */
export type PersonalUpgradeGradeCosts = Readonly<
    Record<'2' | '3' | '4' | '5', readonly PersonalEngineeringIngredient[]>
>;

/**
 * The complete personal-equipment grade-upgrade cost catalogue.
 *
 * @example
 * ```ts
 * import {
 *   PERSONAL_UPGRADE_COSTS,
 *   type PersonalUpgradeCosts,
 * } from '@elite-dangerous-almanac/core/equipment/upgrade-costs';
 *
 * const costs: PersonalUpgradeCosts = PERSONAL_UPGRADE_COSTS;
 * Object.keys(costs.suits).length; // -> 3
 * ```
 */
export interface PersonalUpgradeCosts {
    /** Upgradeable suits keyed by grade-independent family. */
    readonly suits: Readonly<
        Record<'utilitysuit' | 'tacticalsuit' | 'explorationsuit', PersonalUpgradeGradeCosts>
    >;
    /** Handheld-weapon recipes shared by Karma, Takada or Manticore family. */
    readonly weaponGroups: Readonly<Record<WeaponUpgradeGroup, PersonalUpgradeGradeCosts>>;
}

/**
 * All Pioneer Supplies personal-equipment upgrade recipes.
 *
 * @remarks
 * Suit recipes are keyed by the same grade-independent family used by `getSuitByFamily`.
 * Weapon recipes are shared by the Karma, Takada and Manticore upgrade groups recorded
 * on `PERSONAL_WEAPONS`.
 *
 * @example
 * ```ts
 * import { PERSONAL_UPGRADE_COSTS } from '@elite-dangerous-almanac/core/equipment/upgrade-costs';
 * PERSONAL_UPGRADE_COSTS.suits.utilitysuit['2'][0]?.symbol; // -> 'suitschematic'
 * ```
 */
export const PERSONAL_UPGRADE_COSTS: PersonalUpgradeCosts = deepFreeze(
    upgradeCostsData as PersonalUpgradeCosts,
);

/**
 * Get the one-step cost of upgrading a suit to a target grade.
 *
 * @param family - Grade-independent suit family, e.g. `"utilitysuit"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @param targetGrade - Grade being reached, integer `2`–`5`.
 * @returns The frozen ingredient list, or `null` for an unknown/non-upgradeable suit.
 * @throws {TypeError} If `family` is present and not a string. A nullish family is a
 * miss, answered like an unrecognised one.
 * @throws {RangeError} If `targetGrade` is not an integer from 2 through 5.
 * @example
 * ```ts
 * import { getSuitUpgradeStepCost } from '@elite-dangerous-almanac/core/equipment/upgrade-costs';
 * getSuitUpgradeStepCost('utilitysuit', 2)?.[0]?.symbol; // -> 'suitschematic'
 * ```
 */
export function getSuitUpgradeStepCost(
    family: string,
    targetGrade: number,
): readonly PersonalEngineeringIngredient[] | null {
    assertTargetGrade(targetGrade, 'getSuitUpgradeStepCost');
    const costs = getSuitUpgradeCosts(family);
    return costs?.[String(targetGrade) as keyof PersonalUpgradeGradeCosts] ?? null;
}

/**
 * Total the suit upgrade steps above `currentGrade` through `targetGrade`.
 *
 * @param family - Grade-independent suit family, matched case-insensitively after
 * trimming surrounding whitespace.
 * @param targetGrade - Desired grade, integer `1`–`5`.
 * @param currentGrade - Current grade, integer `1`–`5`; defaults to `1`.
 * @returns A summed shopping list, `[]` when no climb remains, or `null` for an
 * unknown/non-upgradeable suit.
 * @throws {TypeError} If `family` is present and not a string. A nullish family is a
 * miss, answered like an unrecognised one.
 * @throws {RangeError} If either grade is not an integer from 1 through 5.
 * @example
 * ```ts
 * import { getSuitUpgradeCost } from '@elite-dangerous-almanac/core/equipment/upgrade-costs';
 * getSuitUpgradeCost('utilitysuit', 3)?.find(({ symbol }) => symbol === 'graphene')?.count; // -> 7
 * ```
 */
export function getSuitUpgradeCost(
    family: string,
    targetGrade: number,
    currentGrade = 1,
): PersonalEngineeringIngredient[] | null {
    assertGrade(targetGrade, 'getSuitUpgradeCost: targetGrade');
    assertGrade(currentGrade, 'getSuitUpgradeCost: currentGrade');
    const costs = getSuitUpgradeCosts(family);
    if (!costs) return null;
    return totalCosts(costs, targetGrade, currentGrade);
}

/**
 * Get the one-step cost of upgrading a handheld weapon to a target grade.
 *
 * @param symbol - Frontier handheld-weapon journal symbol, matched
 * case-insensitively after trimming surrounding whitespace.
 * @param targetGrade - Grade being reached, integer `2`–`5`.
 * @returns The frozen ingredient list, or `null` for an unknown weapon.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish symbol is a
 * miss, answered like an unrecognised one.
 * @throws {RangeError} If `targetGrade` is not an integer from 2 through 5.
 * @example
 * ```ts
 * import { getPersonalWeaponUpgradeStepCost } from '@elite-dangerous-almanac/core/equipment/upgrade-costs';
 * getPersonalWeaponUpgradeStepCost('wpn_m_assaultrifle_kinetic_fauto', 2)?.[0]?.symbol; // -> 'weaponschematic'
 * ```
 */
export function getPersonalWeaponUpgradeStepCost(
    symbol: string,
    targetGrade: number,
): readonly PersonalEngineeringIngredient[] | null {
    assertTargetGrade(targetGrade, 'getPersonalWeaponUpgradeStepCost');
    const weapon = getPersonalWeaponBySymbol(symbol);
    if (!weapon) return null;
    return (
        PERSONAL_UPGRADE_COSTS.weaponGroups[weapon.upgradeGroup][String(targetGrade) as '2'] ?? null
    );
}

/**
 * Total the weapon upgrade steps above `currentGrade` through `targetGrade`.
 *
 * @param symbol - Frontier handheld-weapon journal symbol, matched
 * case-insensitively after trimming surrounding whitespace.
 * @param targetGrade - Desired grade, integer `1`–`5`.
 * @param currentGrade - Current grade, integer `1`–`5`; defaults to `1`.
 * @returns A summed shopping list, `[]` when no climb remains, or `null` for an unknown
 * weapon.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish symbol is a
 * miss, answered like an unrecognised one.
 * @throws {RangeError} If either grade is not an integer from 1 through 5.
 * @example
 * ```ts
 * import { getPersonalWeaponUpgradeCost } from '@elite-dangerous-almanac/core/equipment/upgrade-costs';
 * const symbol = 'wpn_m_assaultrifle_kinetic_fauto';
 * getPersonalWeaponUpgradeCost(symbol, 5, 4)?.find(({ symbol }) => symbol === 'weaponcomponent')?.count; // -> 12
 * ```
 */
export function getPersonalWeaponUpgradeCost(
    symbol: string,
    targetGrade: number,
    currentGrade = 1,
): PersonalEngineeringIngredient[] | null {
    assertGrade(targetGrade, 'getPersonalWeaponUpgradeCost: targetGrade');
    assertGrade(currentGrade, 'getPersonalWeaponUpgradeCost: currentGrade');
    const weapon = getPersonalWeaponBySymbol(symbol);
    if (!weapon) return null;
    return totalCosts(
        PERSONAL_UPGRADE_COSTS.weaponGroups[weapon.upgradeGroup],
        targetGrade,
        currentGrade,
    );
}

function totalCosts(
    costs: PersonalUpgradeGradeCosts,
    targetGrade: number,
    currentGrade: number,
): PersonalEngineeringIngredient[] {
    const steps: (readonly PersonalEngineeringIngredient[])[] = [];
    for (let grade = currentGrade + 1; grade <= targetGrade; grade++) {
        steps.push(costs[String(grade) as keyof PersonalUpgradeGradeCosts]);
    }
    return sumPersonalEngineeringIngredients(...steps);
}

function getSuitUpgradeCosts(family: string): PersonalUpgradeGradeCosts | null {
    const suit = getSuitByFamily(family);
    if (!suit || !Object.hasOwn(PERSONAL_UPGRADE_COSTS.suits, suit.family)) return null;
    return PERSONAL_UPGRADE_COSTS.suits[suit.family as keyof PersonalUpgradeCosts['suits']];
}

function assertTargetGrade(grade: number, functionName: string): void {
    if (!Number.isInteger(grade) || grade < 2 || grade > 5) {
        throw new RangeError(`${functionName}: targetGrade must be an integer in [2, 5]`);
    }
}

function assertGrade(grade: number, label: string): void {
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`${label} must be an integer in [1, 5]`);
    }
}
