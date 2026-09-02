/**
 * Odyssey personal suits: their journal identifiers, the suit-wide component stats every
 * grade shares, and the grade-dependent defensive stats.
 *
 * @packageDocumentation
 */

import suitsData from '../../../data/equipment/suits.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex, normalizeKey } from '../internal/registry-index.js';
import { assertEquipmentGrade } from './internal/equipment-grade.js';

/** A Pioneer Supplies equipment grade, from the stock grade 1 through grade 5. */
export type EquipmentGrade = 1 | 2 | 3 | 4 | 5;

/** The stats of one suit at one equipment grade. */
export interface SuitGrade {
    /** Frontier item symbol for this exact suit and grade. */
    readonly symbol: string;
    /** Permanent engineering-modification slots available, from `0` through `4`. */
    readonly modificationSlots: number;
    /** Base shield strength in shield points. */
    readonly shieldStrength: number;
    /** Shield points regenerated per second. */
    readonly shieldRegeneration: number;
    /** Kinetic damage resistance as a fraction; negative values increase damage. */
    readonly kineticResistance: number;
    /** Thermal damage resistance as a fraction. */
    readonly thermalResistance: number;
    /** Plasma damage resistance as a fraction; negative values increase damage. */
    readonly plasmaResistance: number;
    /** Explosive damage resistance as a fraction. */
    readonly explosiveResistance: number;
}

/** One personal suit model sold by Pioneer Supplies. */
export interface Suit {
    /** Suit family without a grade suffix, e.g. `"utilitysuit"`. */
    readonly family: string;
    /** English display name, e.g. `"Maverick Suit"`. */
    readonly name: string;
    /** Number of primary-weapon slots. */
    readonly primarySlots: number;
    /** Number of secondary-weapon slots. */
    readonly secondarySlots: number;
    /** Suit health in health points, the pool the shield protects. */
    readonly health: number;
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
     * A grade changes exactly what {@link SuitGrade} carries — the four resistances,
     * shield strength, shield regeneration, the modification slots and the item symbol.
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
