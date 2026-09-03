/**
 * Odyssey handheld weapons: their journal identifiers, combat stats, sight
 * magnification, reload time, grade-dependent damage, and the damage per second those
 * stats resolve to.
 *
 * @packageDocumentation
 */

import weaponsData from '../../../data/equipment/weapons.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex } from '../internal/registry-index.js';
import { assertEquipmentGrade } from './internal/equipment-grade.js';
import { applyPersonalModifiers, type PersonalModifier } from './engineering.js';
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
    /** Trigger pulls per second, so bursts per second on a burst weapon. */
    readonly rateOfFire: number;
    /**
     * Projectiles one round fires, each doing the full
     * {@link PersonalWeaponGrade.damage}. Absent on every weapon that fires a single
     * projectile — only the Manticore Intimidator, a shotgun, carries it.
     */
    readonly projectiles?: number;
    /**
     * Rounds one trigger pull fires, spent from the magazine. Present only when
     * {@link PersonalWeapon.fireMode} is `"burst"`, together with
     * {@link PersonalWeapon.burstRateOfFire}.
     */
    readonly burstRounds?: number;
    /** Rounds per second within one burst. Absent whenever `burstRounds` is. */
    readonly burstRateOfFire?: number;
    /**
     * Rounds loaded in one magazine. A burst weapon spends
     * {@link PersonalWeapon.burstRounds} of them per trigger pull.
     */
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

/**
 * What one handheld weapon does per second at a grade, sustained and unsustained.
 *
 * @remarks
 * Frozen, so a result can be held and shared without a defensive copy.
 */
export interface PersonalWeaponMetrics {
    /** Damage of one trigger pull — every projectile of every round in it. */
    readonly damagePerShot: number;
    /** {@link PersonalWeaponMetrics.damagePerShot} with every projectile hitting the head. */
    readonly headshotDamagePerShot: number;
    /** Trigger pulls per second. */
    readonly rateOfFire: number;
    /** Trigger pulls per second averaged over reloads. */
    readonly sustainedRateOfFire: number;
    /** Damage per second while firing, reloads ignored. */
    readonly damagePerSecond: number;
    /** Damage per second averaged over reloads — the figure a long fight sees. */
    readonly sustainedDamagePerSecond: number;
}

/**
 * Everything the on-foot damage arithmetic gives you for one weapon: damage per trigger
 * pull, per second, and per second once reloads are counted.
 *
 * A grade record states damage **per projectile**, so a shot is that damage times the
 * projectiles a round carries times the rounds one trigger pull fires. The sustained
 * figures then average in the reload: a magazine's worth of fire takes the shots after
 * the first, plus the tail of the last burst, plus the reload.
 *
 * ```text
 * damagePerShot = damage × projectiles × burstRounds
 * DPS           = damagePerShot × rateOfFire
 * SDPS          = damagePerShot × (magazine's shots / one magazine-and-reload cycle)
 * ```
 *
 * @param weapon - A catalogue weapon record.
 * @param grade - Integer grade `1`–`5`.
 * @param modifiers - Fitted modification modifiers, folded per stat the way
 * {@link applyPersonalModifiers} does. `magazineSize` and `headshotMultiplier` are the
 * two this arithmetic reads; modifiers naming other stats are ignored. A Reload Speed
 * modification carries no modifier at all, so it arrives through `options` instead. A
 * fractional magazine is held to whole rounds, rounding **up**, as `ships/weapons` does.
 * @param options - `reloadSpeed` takes the reload from
 * {@link PersonalWeapon.reloadTime | reloadTime.upgraded} rather than `.default`,
 * because Reload Speed carries its magnitude as that pair rather than as a modifier.
 * @returns The frozen {@link PersonalWeaponMetrics}, or `null` when the record carries
 * no such grade — the same nullable answer {@link getPersonalWeaponGrade} gives. A
 * magazine that modifiers empty to zero rounds or fewer reports no sustained fire.
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 * @example
 * ```ts
 * import {
 *     getPersonalWeaponByName,
 *     personalWeaponMetrics,
 * } from '@elite-dangerous-almanac/core/equipment/weapons';
 *
 * const shotgun = getPersonalWeaponByName('Manticore Intimidator')!;
 * personalWeaponMetrics(shotgun, 5)?.damagePerShot; // -> 52.15  (ten pellets of 5.215)
 * personalWeaponMetrics(shotgun, 5)?.damagePerSecond; // -> 65.19
 * personalWeaponMetrics(shotgun, 5)?.sustainedDamagePerSecond; // -> 31.6  (with the 2.5 s reload)
 * ```
 */
export function personalWeaponMetrics(
    weapon: PersonalWeapon,
    grade: number,
    modifiers: readonly PersonalModifier[] = [],
    options: { readonly reloadSpeed?: boolean } = {},
): PersonalWeaponMetrics | null {
    assertEquipmentGrade(grade, 'personalWeaponMetrics');
    const stats = getPersonalWeaponGrade(weapon, grade);
    if (!stats) return null;

    const burstRounds = weapon.burstRounds ?? 1;
    // Held to whole rounds the way `ships/weapons` holds a clip, so a hand-built
    // fraction cannot reach the reload cycle and give the two domains different answers.
    const magazineSize = Math.ceil(
        applyPersonalModifiers('magazineSize', weapon.magazineSize, modifiers),
    );
    const headshotMultiplier = applyPersonalModifiers(
        'headshotMultiplier',
        weapon.headshotMultiplier,
        modifiers,
    );
    const reloadTime = options.reloadSpeed ? weapon.reloadTime.upgraded : weapon.reloadTime.default;

    const damagePerShot = stats.damage * (weapon.projectiles ?? 1) * burstRounds;
    const shots = magazineSize / burstRounds;
    // Trigger pulls after the first, then the tail of the last burst, then the reload.
    const cycle =
        (shots - 1) / weapon.rateOfFire +
        (burstRounds - 1) / (weapon.burstRateOfFire ?? 1) +
        reloadTime;
    const sustainedRateOfFire = shots <= 0 ? 0 : Math.min(weapon.rateOfFire, shots / cycle);

    return Object.freeze({
        damagePerShot,
        headshotDamagePerShot: damagePerShot * headshotMultiplier,
        rateOfFire: weapon.rateOfFire,
        sustainedRateOfFire,
        damagePerSecond: damagePerShot * weapon.rateOfFire,
        sustainedDamagePerSecond: damagePerShot * sustainedRateOfFire,
    });
}
