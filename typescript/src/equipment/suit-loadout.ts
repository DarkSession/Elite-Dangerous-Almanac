/**
 * Import a journal suit loadout: the suit a Commander wears, its grade, the permanent
 * modifications on it, and the weapon at each mount with the modifications on that.
 *
 * The game writes the same payload under three event names — `SuitLoadout` when a
 * session starts or a loadout changes, `SwitchSuitLoadout` when the Commander changes
 * suit, and `CreateSuitLoadout` when they save a new one — so {@link parseSuitLoadout}
 * takes any of the three.
 *
 * This is the personal-equipment counterpart of `ships/ship-loadout`, at the scale the
 * domain needs: a suit has no editor, so an import is one frozen record rather than a
 * mutable build. It carries the suit and weapon catalogues and the modification recipes,
 * which is every catalogue an event names.
 *
 * @packageDocumentation
 */

import { describeValue, requireString, truncate } from '../internal/argument-guards.js';
import { deepFreeze } from '../internal/deep-freeze.js';
import { normalizeKey } from '../internal/registry-index.js';
import type { PersonalModifier } from './engineering.js';
import { resolvePersonalModificationForWeapon } from './modification-journal.js';
import { getPersonalModification, type PersonalModification } from './modifications.js';
import {
    getSuitBySymbol,
    getSuitGrade,
    type EquipmentGrade,
    type PersonalMountKey,
    type Suit,
    type SuitGrade,
} from './suits.js';
import {
    getPersonalWeaponBySymbol,
    personalWeaponMetrics,
    type PersonalWeapon,
    type PersonalWeaponMetrics,
} from './weapons.js';

/**
 * The two recipes whose whole effect is a pair of figures on the weapon record.
 *
 * Reload Speed and Scope carry no modifier, so a fitted one is reported as a flag —
 * {@link FittedPersonalWeapon.reloadSpeed} and {@link FittedPersonalWeapon.scope} — and
 * the second figure of `PersonalWeapon.reloadTime` or `PersonalWeapon.scopeMagnification`
 * is what it selects.
 */
const RELOAD_SPEED_SYMBOL = 'weapon_reloadspeed';
const SCOPE_SYMBOL = 'weapon_scope';

/** One weapon entry in a journal suit-loadout event. */
export interface SuitLoadoutModuleEvent {
    /** The mount it occupies, e.g. `"PrimaryWeapon1"`. */
    readonly SlotName: string;
    /** The owned weapon instance's id. */
    readonly SuitModuleID?: number;
    /** The weapon's Frontier symbol, e.g. `"wpn_m_launcher_rocket_sauto"`. */
    readonly ModuleName: string;
    /** The weapon's display name, when the event states one. */
    readonly ModuleName_Localised?: string;
    /** The weapon's Pioneer Supplies grade, 1–5. */
    readonly Class: number;
    /** Each permanent modification on the weapon, in the game's own spelling. */
    readonly WeaponMods?: readonly string[];
}

/**
 * A journal `SuitLoadout`, `SwitchSuitLoadout` or `CreateSuitLoadout` event.
 *
 * @remarks
 * `event` and `timestamp` name the journal line rather than the loadout, and the
 * `_Localised` fields are the game's own display text for a locale. {@link
 * parseSuitLoadout} drops all four; `i18n/suits`, `i18n/personal-weapons` and
 * `i18n/personal-modifications` answer for display text in every stored locale.
 */
export interface SuitLoadoutEvent {
    /** The journal event name. Accepted on input, and not part of the loadout. */
    readonly event?: string;
    /** When the game wrote the line. */
    readonly timestamp?: string;
    /** The owned suit instance's id. */
    readonly SuitID?: number;
    /** The suit's grade-specific Frontier symbol, e.g. `"tacticalsuit_class5"`. */
    readonly SuitName: string;
    /** The suit's display name, when the event states one. */
    readonly SuitName_Localised?: string;
    /** Each permanent modification on the suit, in the game's own spelling. */
    readonly SuitMods?: readonly string[];
    /** The saved loadout's id. */
    readonly LoadoutID?: number;
    /** The player-given loadout name, e.g. `"Double Trouble"`. */
    readonly LoadoutName?: string;
    /** The weapon at each occupied mount. */
    readonly Modules?: readonly SuitLoadoutModuleEvent[];
}

/** One modification an event states, resolved against the recipe catalogue. */
export interface FittedPersonalModification {
    /** The symbol the event wrote, e.g. `"weapon_range"`. */
    readonly journalSymbol: string;
    /**
     * The recipe key, e.g. `"weapon_range_kinetic"`.
     *
     * @remarks
     * This is what `PERSONAL_MODIFICATIONS` and `PERSONAL_MODIFICATION_COSTS` are keyed
     * by. It differs from {@link journalSymbol} for the three recipes whose material
     * cost depends on the weapon's technology; `equipment/modification-journal` is the
     * lookup that settles them, and the weapon at the mount is what settles it.
     */
    readonly symbol: string;
    /** The recipe itself. */
    readonly modification: PersonalModification;
}

/** One weapon an event puts on a suit mount, resolved against the weapon catalogue. */
export interface FittedPersonalWeapon {
    /** The mount, in the catalogue's spelling, whatever spelling the event used. */
    readonly mount: PersonalMountKey;
    /** The owned weapon instance's id, or `null` when the event states none. */
    readonly moduleId: number | null;
    /** The weapon. */
    readonly weapon: PersonalWeapon;
    /** The weapon's grade, from the event's `Class`. */
    readonly grade: EquipmentGrade;
    /** Each modification on the weapon, in the order the event lists them. */
    readonly modifications: readonly FittedPersonalModification[];
    /**
     * Every modifier that acts on this weapon, ready for `applyPersonalModifiers`.
     *
     * @remarks
     * This includes the suit's own modifiers that name a stat the weapon carries: Extra
     * Ammo Capacity is a suit modification and multiplies a *weapon's* `reserveAmmo`, so
     * one list answers for the weapon and a consumer does not have to know which
     * equipment the recipe sits on.
     */
    readonly modifiers: readonly PersonalModifier[];
    /** Whether Reload Speed is fitted, which selects `weapon.reloadTime.upgraded`. */
    readonly reloadSpeed: boolean;
    /** Whether Scope is fitted, which selects `weapon.scopeMagnification.upgraded`. */
    readonly scope: boolean;
    /** What the weapon does per second at this grade, with {@link modifiers} folded in. */
    readonly metrics: PersonalWeaponMetrics;
}

/**
 * Something an event states that the import could not use.
 *
 * @remarks
 * An event is taken as far as the catalogues allow: an entry that names a weapon, a
 * mount, a grade or a recipe the catalogues do not carry is left out of the loadout and
 * reported here. Only the suit itself is refused outright, because nothing else in the
 * event stands without it.
 */
export interface SuitLoadoutImportOutcome {
    /**
     * What the import could not use:
     *
     * - `unknownWeapon` — no catalogue weapon answers to `ModuleName`, so the mount is
     *   empty.
     * - `unknownMount` — the suit carries no mount by that `SlotName`, so the entry is
     *   left out.
     * - `refusedMount` — the weapon resolves, and the mount does not take its kind: a
     *   primary weapon in the secondary mount, or the reverse.
     * - `unknownGrade` — `Class` is not an integer from 1 through 5, so the weapon has
     *   no stats to report and the mount is empty.
     * - `unknownModification` — no recipe answers to the symbol, so it moves nothing.
     */
    readonly action:
        'unknownWeapon' | 'unknownMount' | 'refusedMount' | 'unknownGrade' | 'unknownModification';
    /**
     * The mount the event named, in its own spelling, or `null` for a modification on
     * the suit itself.
     */
    readonly mount: string | null;
    /** The weapon or recipe symbol the event stated. */
    readonly sourceSymbol: string;
}

/**
 * One imported suit loadout: the suit, its modifications, and the weapon at each mount.
 *
 * @remarks
 * Every field is a frozen fact the event stated or the catalogues resolved. Read a mount
 * with `loadout.weapons.find((fitted) => fitted.mount === 'PrimaryWeapon1')`; an absent
 * one holds no weapon, which is what the game writes for an empty mount.
 */
export interface SuitLoadout {
    /** The suit model. */
    readonly suit: Suit;
    /** The suit's grade, from its Frontier symbol. */
    readonly grade: EquipmentGrade;
    /** The suit's stats at {@link grade}. */
    readonly stats: SuitGrade;
    /** The owned suit instance's id, or `null` when the event states none. */
    readonly suitId: number | null;
    /** The saved loadout's id, or `null` when the event states none. */
    readonly loadoutId: number | null;
    /** The player-given loadout name, or `null` when the event states none. */
    readonly name: string | null;
    /** Each modification on the suit, in the order the event lists them. */
    readonly modifications: readonly FittedPersonalModification[];
    /**
     * Every modifier the suit's modifications carry, ready for `applyPersonalModifiers`.
     *
     * @remarks
     * A modifier here names a stat of whatever the recipe changes. Most name a suit
     * stat; Extra Ammo Capacity names a weapon's `reserveAmmo` and Reduced Tool Battery
     * Consumption names a tool's `toolEnergyDrain`. `applyPersonalModifiers` reads one
     * stat at a time, so pass the base the stat belongs to and the rest are skipped.
     */
    readonly modifiers: readonly PersonalModifier[];
    /** The weapon at each occupied mount, in the order the event lists them. */
    readonly weapons: readonly FittedPersonalWeapon[];
    /** Everything the event stated that the catalogues could not resolve. */
    readonly outcomes: readonly SuitLoadoutImportOutcome[];
}

/**
 * Import a journal `SuitLoadout`, `SwitchSuitLoadout` or `CreateSuitLoadout` event.
 *
 * @param event - The event object, as the game wrote it.
 * @returns The frozen {@link SuitLoadout}.
 * @remarks
 * A mount name is matched case-insensitively, with surrounding whitespace ignored, and
 * the loadout reports the catalogue's own spelling — so `fitted.mount === 'PrimaryWeapon1'`
 * holds whatever spelling the source used. Weapon and recipe symbols are matched the
 * same way.
 *
 * The suit has to resolve: an unknown `SuitName` is a `TypeError`, because the grade,
 * the mounts and every stat come from it. Everything else the catalogues cannot resolve
 * is left out of the loadout and reported by {@link SuitLoadout.outcomes}, so one
 * unknown weapon does not cost a caller the rest of the event.
 *
 * `SuitID`, `SuitModuleID`, `LoadoutID` and `LoadoutName` are kept: they name the items
 * the Commander owns and the loadout slot they sit in, which is what a later
 * `LoadoutEquipModule` event joins to. `event`, `timestamp` and the `_Localised` display
 * text are dropped.
 * @throws {TypeError} If `event` is not shaped like one. `event` must be an object whose
 * `SuitName` is a string naming a catalogued suit; `Modules`, `SuitMods` and `WeaponMods`
 * must be arrays whenever they are present; each module must be an object with a string
 * `SlotName` and `ModuleName`, no two claiming the same mount; and each modification must
 * be a string. Every other field is trusted.
 * @example
 * ```ts
 * import { parseSuitLoadout } from '@elite-dangerous-almanac/core/equipment/suit-loadout';
 *
 * const loadout = parseSuitLoadout({
 *     event: 'SwitchSuitLoadout',
 *     SuitID: 1700482757598197,
 *     SuitName: 'tacticalsuit_class5',
 *     SuitMods: ['suit_nightvision', 'suit_increasedammoreserves'],
 *     LoadoutID: 4293000007,
 *     LoadoutName: 'Double Trouble',
 *     Modules: [
 *         {
 *             SlotName: 'PrimaryWeapon1',
 *             SuitModuleID: 1701103603778031,
 *             ModuleName: 'wpn_m_launcher_rocket_sauto',
 *             Class: 5,
 *             WeaponMods: ['weapon_clipsize'],
 *         },
 *     ],
 * });
 *
 * loadout.suit.name; // -> 'Dominator Suit'
 * loadout.grade; // -> 5
 * loadout.name; // -> 'Double Trouble'
 * loadout.weapons[0]?.weapon.name; // -> 'Karma L-6'
 * loadout.weapons[0]?.metrics.damagePerSecond; // -> 119.2
 * ```
 * @example
 * A stat the game shows on foot is the catalogue's base with the fitted modifiers folded
 * onto it. The suit's Extra Ammo Capacity reaches the weapon that carries the reserve.
 *
 * ```ts
 * import { applyPersonalModifiers } from '@elite-dangerous-almanac/core/equipment/engineering';
 * import { parseSuitLoadout } from '@elite-dangerous-almanac/core/equipment/suit-loadout';
 *
 * const loadout = parseSuitLoadout({
 *     SuitName: 'tacticalsuit_class5',
 *     SuitMods: ['suit_increasedshieldregen', 'suit_increasedammoreserves'],
 *     Modules: [
 *         {
 *             SlotName: 'PrimaryWeapon1',
 *             ModuleName: 'wpn_m_launcher_rocket_sauto',
 *             Class: 5,
 *             WeaponMods: [],
 *         },
 *     ],
 * });
 *
 * const fitted = loadout.weapons[0]!;
 * applyPersonalModifiers('shieldRegeneration', loadout.stats.shieldRegeneration, loadout.modifiers);
 * // -> 3.1
 * applyPersonalModifiers('reserveAmmo', fitted.weapon.reserveAmmo, fitted.modifiers); // -> 12
 * ```
 */
export function parseSuitLoadout(event: SuitLoadoutEvent): SuitLoadout {
    if (event === null || typeof event !== 'object') {
        throw new TypeError(
            `parseSuitLoadout: event must be a suit loadout event, received ${describeValue(event)}`,
        );
    }

    const suitSymbol = requireString(event.SuitName, 'parseSuitLoadout: event.SuitName');
    const identified = getSuitBySymbol(suitSymbol);
    if (!identified) {
        throw new TypeError(`parseSuitLoadout: unknown suit "${truncate(suitSymbol)}"`);
    }
    const { suit, grade } = identified;
    // The symbol was read off this suit's own grade record, so the grade is one it has.
    const stats = getSuitGrade(suit, grade)!;

    const outcomes: SuitLoadoutImportOutcome[] = [];
    const modifications = resolveModifications(
        event.SuitMods,
        'parseSuitLoadout: event.SuitMods',
        null,
        null,
        outcomes,
    );

    return deepFreeze({
        suit,
        grade,
        stats,
        suitId: event.SuitID ?? null,
        loadoutId: event.LoadoutID ?? null,
        name: event.LoadoutName ?? null,
        modifications,
        modifiers: modifications.flatMap(({ modification }) => modification.modifiers),
        weapons: fitWeapons(event.Modules, suit, modifications, outcomes),
        outcomes,
    });
}

/** Resolve one equipment's stated modifications, reporting the symbols that miss. */
function resolveModifications(
    stated: readonly string[] | undefined,
    label: string,
    weapon: PersonalWeapon | null,
    mount: string | null,
    outcomes: SuitLoadoutImportOutcome[],
): FittedPersonalModification[] {
    if (stated === undefined || stated === null) return [];
    if (!Array.isArray(stated)) {
        throw new TypeError(`${label} must be an array, received ${describeValue(stated)}`);
    }

    const fitted: FittedPersonalModification[] = [];
    for (const [index, journalSymbol] of stated.entries()) {
        requireString(journalSymbol, `${label}[${index}]`);
        const symbol = weapon
            ? resolvePersonalModificationForWeapon(weapon.symbol, journalSymbol)
            : journalSymbol;
        const modification = getPersonalModification(symbol);
        if (!modification) {
            outcomes.push({ action: 'unknownModification', mount, sourceSymbol: journalSymbol });
            continue;
        }
        fitted.push({ journalSymbol, symbol, modification });
    }
    return fitted;
}

/** Resolve every stated module onto a mount the suit carries. */
function fitWeapons(
    modules: readonly SuitLoadoutModuleEvent[] | undefined,
    suit: Suit,
    suitModifications: readonly FittedPersonalModification[],
    outcomes: SuitLoadoutImportOutcome[],
): FittedPersonalWeapon[] {
    if (modules === undefined || modules === null) return [];
    if (!Array.isArray(modules)) {
        throw new TypeError(
            `parseSuitLoadout: event.Modules must be an array, received ${describeValue(modules)}`,
        );
    }

    const weapons: FittedPersonalWeapon[] = [];
    const taken = new Set<string>();
    for (const [index, module] of modules.entries()) {
        const label = `parseSuitLoadout: event.Modules[${index}]`;
        if (module === null || typeof module !== 'object') {
            throw new TypeError(`${label} must be an object, received ${describeValue(module)}`);
        }
        const slotName = requireString(module.SlotName, `${label}.SlotName`);
        const weaponSymbol = requireString(module.ModuleName, `${label}.ModuleName`);
        const key = normalizeKey(slotName, `${label}.SlotName`);
        if (taken.has(key)) {
            throw new TypeError(`${label}.SlotName repeats mount "${truncate(slotName)}"`);
        }
        taken.add(key);

        const mount = suit.mounts.find((candidate) => candidate.key.toLowerCase() === key);
        if (!mount) {
            outcomes.push({ action: 'unknownMount', mount: slotName, sourceSymbol: weaponSymbol });
            continue;
        }
        const weapon = getPersonalWeaponBySymbol(weaponSymbol);
        if (!weapon) {
            outcomes.push({ action: 'unknownWeapon', mount: slotName, sourceSymbol: weaponSymbol });
            continue;
        }
        if (weapon.slot !== mount.kind) {
            outcomes.push({ action: 'refusedMount', mount: slotName, sourceSymbol: weaponSymbol });
            continue;
        }
        const grade = module.Class;
        if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
            outcomes.push({ action: 'unknownGrade', mount: slotName, sourceSymbol: weaponSymbol });
            continue;
        }

        const modifications = resolveModifications(
            module.WeaponMods,
            `${label}.WeaponMods`,
            weapon,
            slotName,
            outcomes,
        );
        const modifiers = [
            ...modifications.flatMap(({ modification }) => modification.modifiers),
            // A suit recipe that names a stat the weapon carries acts on the weapon:
            // Extra Ammo Capacity is fitted to the suit and multiplies `reserveAmmo`.
            ...suitModifications.flatMap(({ modification }) =>
                modification.modifiers.filter((modifier) => modifier.stat in weapon),
            ),
        ];
        const reloadSpeed = modifications.some(({ symbol }) => symbol === RELOAD_SPEED_SYMBOL);
        weapons.push({
            mount: mount.key,
            moduleId: module.SuitModuleID ?? null,
            weapon,
            grade: grade as EquipmentGrade,
            modifications,
            modifiers,
            reloadSpeed,
            scope: modifications.some(({ symbol }) => symbol === SCOPE_SYMBOL),
            // The grade is checked above, so this weapon's stats resolve.
            metrics: personalWeaponMetrics(weapon, grade, modifiers, { reloadSpeed })!,
        });
    }
    return weapons;
}
