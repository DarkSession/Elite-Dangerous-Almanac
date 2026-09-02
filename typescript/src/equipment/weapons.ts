/**
 * Odyssey handheld weapons: their journal identifiers, combat stats, sight
 * magnification, reload time and grade-dependent damage.
 *
 * @packageDocumentation
 */

import weaponsData from '../../../data/equipment/weapons.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex } from '../internal/registry-index.js';
import { assertEquipmentGrade } from './internal/equipment-grade.js';
import type { EquipmentGrade } from './suits.js';

/** A weapon manufacturer's shared Pioneer grade-upgrade recipe. */
export type WeaponUpgradeGroup = 'karma' | 'takada' | 'manticore';
/** Technology suffix used to disambiguate personal-weapon modification recipes. */
export type PersonalWeaponEngineeringType = 'kinetic' | 'laser' | 'plasma';
/** A handheld weapon's form factor. */
export type PersonalWeaponClass =
    'pistol' | 'carbine' | 'rifle' | 'shotgun' | 'sniper' | 'launcher';
/** Which suit weapon slot accepts the weapon. */
export type PersonalWeaponSlot = 'primary' | 'secondary';
/** The damage family relevant to resistances and some modification recipes. */
export type PersonalDamageType = 'kinetic' | 'thermal' | 'plasma' | 'explosive';
/** A handheld weapon firing cycle. */
export type PersonalFireMode = 'automatic' | 'semi-automatic' | 'burst';

/** A weapon's aim-down-sights magnification, before and after the Scope modification. */
export interface ScopeMagnification {
    /** Magnification of the sight the weapon ships with, e.g. `1.12` for 1.12x. */
    readonly default: number;
    /** Magnification of the sight the Scope modification fits, e.g. `1.41` for 1.41x. */
    readonly upgraded: number;
}

/** A weapon's magazine reload time, before and after the Reload Speed modification. */
export interface ReloadTime {
    /** Seconds to reload the weapon as it ships, e.g. `2.7` for 2.7 s. */
    readonly default: number;
    /** Seconds to reload with the Reload Speed modification fitted, e.g. `2.16` for 2.16 s. */
    readonly upgraded: number;
}

/** Grade-dependent stats for one handheld weapon. */
export interface PersonalWeaponGrade {
    /** Damage per projectile or pellet. */
    readonly damage: number;
    /** Permanent engineering-modification slots available, from `0` through `4`. */
    readonly modificationSlots: number;
}

/** One handheld weapon sold by Pioneer Supplies. */
export interface PersonalWeapon {
    /** Frontier item id reported by journal loadout events. */
    readonly symbol: string;
    /** English display name. */
    readonly name: string;
    /** Manufacturer recipe family used for grade upgrades. */
    readonly upgradeGroup: WeaponUpgradeGroup;
    /** Recipe suffix used when the journal omits a modification's weapon technology. */
    readonly engineeringType: PersonalWeaponEngineeringType;
    /** Weapon form factor. */
    readonly class: PersonalWeaponClass;
    /** Suit slot this weapon occupies. */
    readonly slot: PersonalWeaponSlot;
    /** Base damage family. */
    readonly damageType: PersonalDamageType;
    /** Firing cycle. */
    readonly fireMode: PersonalFireMode;
    /** Shots per second. */
    readonly rateOfFire: number;
    /** Rounds loaded in one magazine. */
    readonly magazineSize: number;
    /** Spare rounds carried before suit-capacity changes. */
    readonly reserveAmmo: number;
    /** Headshot damage multiplier (`2` means 200%). */
    readonly headshotMultiplier: number;
    /** Nominal effective range in metres. */
    readonly effectiveRange: number;
    /**
     * Aim-down-sights magnification with the stock sight and with the one the Scope
     * modification fits. Scope carries no modifier of its own: this pair is its whole
     * numeric effect, and it differs per weapon.
     */
    readonly scopeMagnification: ScopeMagnification;
    /**
     * Seconds to reload the magazine with the stock weapon and with the Reload Speed
     * modification fitted. Reload Speed carries no modifier of its own: this pair is its
     * whole numeric effect, and it differs per weapon.
     */
    readonly reloadTime: ReloadTime;
    /**
     * Grade records keyed by `"1"` through `"5"` — every weapon carries all five,
     * unlike {@link Suit.grades}. Read one through
     * {@link getPersonalWeaponGrade} to get the same nullable answer suits give.
     */
    readonly grades: Readonly<Record<`${EquipmentGrade}`, PersonalWeaponGrade>>;
}

/**
 * Every handheld weapon, in catalogue order.
 *
 * @example
 * ```ts
 * import { PERSONAL_WEAPONS } from '@elite-dangerous-almanac/core/equipment/weapons';
 * PERSONAL_WEAPONS[0]?.symbol; // -> 'wpn_s_pistol_kinetic_sauto'
 * ```
 */
export const PERSONAL_WEAPONS: readonly PersonalWeapon[] = deepFreeze(
    weaponsData as unknown as readonly PersonalWeapon[],
);

const BY_SYMBOL = /* @__PURE__ */ createKeyIndex(PERSONAL_WEAPONS, 'symbol');
const BY_NAME = /* @__PURE__ */ createKeyIndex(PERSONAL_WEAPONS, 'name');

/**
 * Look up a handheld weapon by its Frontier journal symbol, case-insensitively.
 *
 * @param symbol - Journal item id such as `"wpn_m_assaultrifle_kinetic_fauto"`,
 * matched case-insensitively after trimming surrounding whitespace.
 * @returns The frozen weapon record, or `null` when unknown.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish symbol is a
 * miss, answered like an unrecognised one.
 * @example
 * ```ts
 * import { getPersonalWeaponBySymbol } from '@elite-dangerous-almanac/core/equipment/weapons';
 * getPersonalWeaponBySymbol('wpn_m_assaultrifle_kinetic_fauto')?.name; // -> 'Karma AR-50'
 * ```
 */
export function getPersonalWeaponBySymbol(symbol: string): PersonalWeapon | null {
    return findInKeyIndex(BY_SYMBOL, symbol, 'getPersonalWeaponBySymbol: symbol');
}

/**
 * Look up a handheld weapon by display name, case-insensitively.
 *
 * @param name - English display name such as `"Karma AR-50"`; surrounding
 * whitespace is ignored.
 * @returns The frozen weapon record, or `null` when unknown.
 * @throws {TypeError} If `name` is present and not a string. A nullish name is a miss,
 * answered like an unrecognised one.
 * @example
 * ```ts
 * import { getPersonalWeaponByName } from '@elite-dangerous-almanac/core/equipment/weapons';
 * getPersonalWeaponByName('Karma AR-50')?.symbol; // -> 'wpn_m_assaultrifle_kinetic_fauto'
 * ```
 */
export function getPersonalWeaponByName(name: string): PersonalWeapon | null {
    return findInKeyIndex(BY_NAME, name, 'getPersonalWeaponByName: name');
}

/**
 * Read one handheld weapon's stats at a grade.
 *
 * @param weapon - A catalogue weapon record.
 * @param grade - Integer grade `1`–`5`.
 * @returns The frozen grade record, or `null` when the record carries no such grade.
 * Every catalogued weapon carries all five, so the `null` is the same promise
 * {@link getSuitGrade} makes rather than an outcome the shipped catalogue produces —
 * write the two the same way and neither can surprise you.
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 * @example
 * ```ts
 * import { PERSONAL_WEAPONS, getPersonalWeaponGrade } from '@elite-dangerous-almanac/core/equipment/weapons';
 * getPersonalWeaponGrade(PERSONAL_WEAPONS[0]!, 5)?.modificationSlots; // -> 4
 * ```
 */
export function getPersonalWeaponGrade(
    weapon: PersonalWeapon,
    grade: number,
): PersonalWeaponGrade | null {
    assertEquipmentGrade(grade, 'getPersonalWeaponGrade');
    return weapon.grades[String(grade) as `${EquipmentGrade}`] ?? null;
}
