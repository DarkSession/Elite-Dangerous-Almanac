/**
 * Elite Dangerous personal equipment: Odyssey suits, handheld weapons, suit tools,
 * Pioneer Supplies grade progression and engineer-applied modifications.
 *
 * Material shopping lists are deliberately leaf-only: import grade-upgrade costs from
 * `equipment/upgrade-costs` and modification costs from
 * `equipment/modification-costs`. Keeping them off this barrel lets identity and stat
 * lookups avoid bundling recipe ingredients.
 *
 * @packageDocumentation
 */

export {
    SUITS,
    getSuitByFamily,
    getSuitByName,
    getSuitBySymbol,
    getSuitGrade,
    type EquipmentGrade,
    type PersonalMount,
    type PersonalMountKey,
    type Suit,
    type SuitGrade,
} from './suits.js';

export {
    PERSONAL_WEAPONS,
    getPersonalWeaponByName,
    getPersonalWeaponBySymbol,
    getPersonalWeaponGrade,
    personalWeaponMetrics,
    type PersonalDamageType,
    type PersonalFireMode,
    type PersonalWeapon,
    type PersonalWeaponClass,
    type PersonalWeaponEngineeringType,
    type PersonalWeaponGrade,
    type PersonalWeaponMetrics,
    type PersonalWeaponSlot,
    type ReloadTime,
    type ScopeMagnification,
    type WeaponUpgradeGroup,
} from './weapons.js';

export { PERSONAL_TOOLS, getPersonalToolById, type PersonalTool } from './tools.js';

export {
    applyPersonalModifiers,
    sumPersonalEngineeringIngredients,
    type PersonalEngineeringIngredient,
    type PersonalModifier,
} from './engineering.js';

export {
    PERSONAL_MODIFICATIONS,
    getPersonalModification,
    type PersonalModification,
    type PersonalModificationTarget,
} from './modifications.js';

export { resolvePersonalModificationForWeapon } from './modification-journal.js';
