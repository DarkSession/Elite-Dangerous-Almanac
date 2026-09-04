/**
 * Odyssey personal suits: their journal identifiers, the suit-wide stats every grade
 * shares, including the shield resistances, and the grade-dependent armour resistances
 * and shield figures.
 *
 * @packageDocumentation
 */

import suitsData from '../../../data/equipment/suits.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex, normalizeKey } from '../internal/registry-index.js';
import { assertEquipmentGrade } from './internal/equipment-grade.js';
import type { PersonalWeaponSlot } from './weapons.js';

/** A Pioneer Supplies equipment grade, from the stock grade 1 through grade 5. */
export type EquipmentGrade = 1 | 2 | 3 | 4 | 5;

/**
 * Frontier's own `SlotName` for a suit weapon mount, exactly as the journal spells it.
 *
 * @remarks
 * The `SuitLoadout`, `CreateSuitLoadout`, `SwitchSuitLoadout`, `LoadoutEquipModule` and
 * `LoadoutRemoveModule` events all write one of these three strings. The secondary mount
 * carries no number, because the game gives it none. Compare a key with `===`; it is
 * case-sensitive, like every other journal key.
 */
export type PersonalMountKey = 'PrimaryWeapon1' | 'PrimaryWeapon2' | 'SecondaryWeapon';

/**
 * One weapon mount on a suit.
 *
 * @remarks
 * {@link PersonalMount.key} is Frontier's journal `SlotName`, so a `SuitLoadout`
 * module joins straight onto a mount without a positional index.
 * @example
 * ```ts
 * import { getSuitByFamily } from '@elite-dangerous-almanac/core/equipment/suits';
 *
 * const suit = getSuitByFamily('tacticalsuit')!;
 * suit.mounts.map((mount) => mount.key);
 * // -> ['PrimaryWeapon1', 'PrimaryWeapon2', 'SecondaryWeapon']
 * suit.mounts.filter((mount) => mount.kind === 'primary').map((mount) => mount.key);
 * // -> ['PrimaryWeapon1', 'PrimaryWeapon2']
 * ```
 */
export interface PersonalMount {
    /** Frontier journal `SlotName`, e.g. `"PrimaryWeapon1"`. */
    readonly key: PersonalMountKey;
    /** Which weapons the mount takes; a weapon whose `slot` equals it fits here. */
    readonly kind: PersonalWeaponSlot;
}

/**
 * The stats of one suit at one equipment grade.
 *
 * @remarks
 * A suit defends in two layers, and each layer has its own four resistances. The four
 * here are the armour's: they apply to the {@link Suit.health} pool, and the Damage
 * Resistance modification moves them. The shield's four sit on {@link Suit}, because a
 * grade leaves them alone.
 * @example
 * ```ts
 * import { getSuitByFamily, getSuitGrade } from '@elite-dangerous-almanac/core/equipment/suits';
 *
 * const suit = getSuitByFamily('tacticalsuit')!;
 * // The shield is weak against a laser; the armour behind it is strong.
 * suit.shieldThermalResistance; // -> -0.5
 * getSuitGrade(suit, 5)!.armourThermalResistance; // -> 0.8
 * ```
 */
export interface SuitGrade {
    /** Frontier item symbol for this exact suit and grade. */
    readonly symbol: string;
    /** Permanent engineering-modification slots available, from `0` through `4`. */
    readonly modificationSlots: number;
    /** Base shield strength in shield points. */
    readonly shieldStrength: number;
    /** Shield points regenerated per second. */
    readonly shieldRegeneration: number;
    /** Armour kinetic damage resistance as a fraction; negative values increase damage. */
    readonly armourKineticResistance: number;
    /** Armour thermal damage resistance as a fraction. */
    readonly armourThermalResistance: number;
    /** Armour plasma damage resistance as a fraction; negative values increase damage. */
    readonly armourPlasmaResistance: number;
    /** Armour explosive damage resistance as a fraction. */
    readonly armourExplosiveResistance: number;
}

/** One personal suit model sold by Pioneer Supplies. */
export interface Suit {
    /** Suit family without a grade suffix, e.g. `"utilitysuit"`. */
    readonly family: string;
    /** English display name, e.g. `"Maverick Suit"`. */
    readonly name: string;
    /**
     * Every weapon mount the suit carries, in the order the game lists them: the
     * primary mounts by their number, then the secondary mount.
     *
     * @remarks
     * Count a kind by filtering:
     * `suit.mounts.filter((mount) => mount.kind === 'primary').length`.
     */
    readonly mounts: readonly PersonalMount[];
    /** Suit health in health points, the pool the shield protects. */
    readonly health: number;
    /**
     * Shield kinetic damage resistance as a fraction.
     *
     * @remarks
     * The shield takes the damage first, and the armour under it takes what gets
     * through, so the two layers carry separate resistances. The four here are the same
     * at every grade, so they are stored once per family, like every other stat a grade
     * leaves alone. A grade changes the shield's strength and its regeneration, both on
     * {@link SuitGrade}, and it changes the armour's four resistances there as well.
     */
    readonly shieldKineticResistance: number;
    /** Shield thermal damage resistance as a fraction; negative values increase damage. */
    readonly shieldThermalResistance: number;
    /** Shield plasma damage resistance as a fraction. */
    readonly shieldPlasmaResistance: number;
    /** Shield explosive damage resistance as a fraction. */
    readonly shieldExplosiveResistance: number;
    /** Suit mass in kilograms. */
    readonly mass: number;
    /** Battery capacity in energy units, the pool the suit's tools draw from. */
    readonly batteryCapacity: number;
    /** Emergency air, in seconds of life support. */
    readonly oxygenTime: number;
    /** Jump-assist boost acceleration, the bare figure the panel shows, which has no unit. */
    readonly boostAcceleration: number;
    /** Backpack goods capacity in items. */
    readonly goodsCapacity: number;
    /** Backpack assets capacity in components. */
    readonly assetsCapacity: number;
    /** Backpack data capacity in items. */
    readonly dataCapacity: number;
    /** How far footsteps carry, as a multiplier of the base audible range. */
    readonly footstepAudibleRange: number;
    /** Line-of-sight analysis range in metres. */
    readonly losAnalysisRange: number;
    /** Seconds of line of sight the suit needs to complete an analysis. */
    readonly losAnalysisTime: number;
    /**
     * Available grade records, keyed by `"1"` through `"5"`.
     *
     * @remarks
     * A grade changes exactly what {@link SuitGrade} carries — the four armour
     * resistances, shield strength, shield regeneration, the modification slots and the
     * item symbol.
     * Every stat above is a property of the suit family and is the same at all five.
     */
    readonly grades: Readonly<Partial<Record<`${EquipmentGrade}`, SuitGrade>>>;
}

/**
 * Every personal suit, including the non-upgradeable Flight Suit.
 *
 * @example
 * ```ts
 * import { SUITS } from '@elite-dangerous-almanac/core/equipment/suits';
 * SUITS.find((suit) => suit.family === 'utilitysuit')?.name; // -> 'Maverick Suit'
 * ```
 */
export const SUITS: readonly Suit[] = deepFreeze(suitsData as unknown as readonly Suit[]);

const BY_FAMILY = /* @__PURE__ */ createKeyIndex(SUITS, 'family');
const BY_NAME = /* @__PURE__ */ createKeyIndex(SUITS, 'name');
const BY_SYMBOL = /* @__PURE__ */ Object.freeze(
    Object.fromEntries(
        SUITS.flatMap((suit) =>
            Object.entries(suit.grades).map(([grade, stats]) => [
                stats.symbol.toLowerCase(),
                Object.freeze({ suit, grade: Number(grade) as EquipmentGrade }),
            ]),
        ),
    ) as Readonly<Record<string, Readonly<{ suit: Suit; grade: EquipmentGrade }>>>,
);

/**
 * Look up a suit model by its grade-independent family, case-insensitively.
 *
 * @param family - Family such as `"utilitysuit"`, matched case-insensitively after
 * trimming surrounding whitespace.
 * @returns The frozen suit record, or `null` when unknown.
 * @throws {TypeError} If `family` is present and not a string. A nullish family is a
 * miss, answered like an unrecognised one.
 * @example
 * ```ts
 * import { getSuitByFamily } from '@elite-dangerous-almanac/core/equipment/suits';
 * getSuitByFamily('utilitysuit')?.name; // -> 'Maverick Suit'
 * ```
 */
export function getSuitByFamily(family: string): Suit | null {
    return findInKeyIndex(BY_FAMILY, family, 'getSuitByFamily: family');
}

/**
 * Look up a suit by its display name, case-insensitively.
 *
 * @param name - Display name such as `"Maverick Suit"`, matched case-insensitively
 * after trimming surrounding whitespace.
 * @returns The frozen suit record, or `null` when unknown.
 * @throws {TypeError} If `name` is present and not a string. A nullish name is a miss,
 * answered like an unrecognised one.
 * @example
 * ```ts
 * import { getSuitByName } from '@elite-dangerous-almanac/core/equipment/suits';
 * getSuitByName('Maverick Suit')?.family; // -> 'utilitysuit'
 * ```
 */
export function getSuitByName(name: string): Suit | null {
    return findInKeyIndex(BY_NAME, name, 'getSuitByName: name');
}

/**
 * Resolve the grade-specific Frontier item symbol reported by journal suit events.
 *
 * @param symbol - Item symbol such as `"utilitysuit_class3"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @returns The owning suit and its numeric grade, or `null` when unknown.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish symbol is a
 * miss, answered like an unrecognised one.
 * @example
 * ```ts
 * import { getSuitBySymbol } from '@elite-dangerous-almanac/core/equipment/suits';
 * getSuitBySymbol('utilitysuit_class3')?.grade; // -> 3
 * ```
 */
export function getSuitBySymbol(
    symbol: string,
): Readonly<{ suit: Suit; grade: EquipmentGrade }> | null {
    const key = normalizeKey(symbol, 'getSuitBySymbol: symbol');
    return Object.hasOwn(BY_SYMBOL, key) ? BY_SYMBOL[key]! : null;
}

/**
 * Read a suit's stats at one grade.
 *
 * @param suit - A catalogue suit record.
 * @param grade - Integer grade `1`–`5`.
 * @returns The frozen grade record, or `null` when that suit has no such grade.
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 * @example
 * ```ts
 * import { getSuitByFamily, getSuitGrade } from '@elite-dangerous-almanac/core/equipment/suits';
 * const suit = getSuitByFamily('utilitysuit');
 * if (!suit) throw new Error('Maverick Suit is missing');
 * getSuitGrade(suit, 5)?.modificationSlots; // -> 4
 * ```
 */
export function getSuitGrade(suit: Suit, grade: number): SuitGrade | null {
    assertEquipmentGrade(grade, 'getSuitGrade');
    return suit.grades[String(grade) as `${EquipmentGrade}`] ?? null;
}
