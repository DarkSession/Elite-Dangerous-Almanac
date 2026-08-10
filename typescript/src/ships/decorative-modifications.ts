/**
 * The **decorative modification catalogue** — the festive transformations the game
 * records in the same field as an engineering blueprint, keyed by the Frontier `fdname`
 * a journal writes (`EngineerModifications` on a `StoredModules` entry,
 * `Engineering.BlueprintName` on a `Loadout` module).
 *
 * **Not engineering.** A decorative modification has no grade, costs no materials, and no
 * engineer offers one. So these ids are **not** in {@link BLUEPRINTS} — there is no recipe
 * to store — and no menu in `ships/engineering-options` lists one, because that catalogue
 * answers what a player may apply. This module is what makes the id resolve to something
 * rather than to nothing.
 *
 * **Not cosmetic-only, either.** A festive launcher fires fireworks rather than flak, and
 * the transformation cuts the module's `Damage` by 99% to match — the one stat any of them
 * moves, carried in {@link DecorativeModification.modifiers}. So a record here is never a
 * claim that the module is unmodified. Feed the modifiers to {@link computeModifiers} to
 * resolve a fitted launcher, the same way a pre-engineered variant's are resolved.
 *
 * Resolving the id is the whole of its job, and it is why it is worth having. A consumer
 * reading a real journal meets `Decorative_Green` on a stored module and needs to tell "an
 * id this library has never heard of" from "an id that is real and names no recipe"; only
 * the second is true here. {@link ShipLoadout.applyBlueprint} reads it for the same
 * reason: it refuses a decorative id, but refuses it by name.
 *
 * Three modifications are known — `Decorative_Green`, `Decorative_Red` and
 * `Decorative_Yellow` — and one module is observed carrying them, the medium turreted
 * Remote Release Flak Launcher (`Hpt_FlakMortar_Turret_Medium`). Enumerate them with
 * `Object.keys(DECORATIVE_MODIFICATIONS)`.
 *
 * Its own module (and data file), a few hundred bytes, so nothing else has to grow to
 * hold three records that belong to none of it.
 *
 * Ids and the module they sit on from a `StoredModules` capture contributed by the
 * repository owner, the `Damage` cut from the same contributor's outfitting panel; EDSY
 * lists the same three transformations and gives them no modifiers, which the cut shows to
 * be an incomplete record. See
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import decorativeData from '../../../data/ships/decorative-modifications.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';

/**
 * One hand-set stat change a decorative modification arrives with.
 *
 * Deliberately the same shape as {@link PreEngineeredModifier}, and for the same reason: a
 * transformation that arrives on the module is a fixed article, not a roll, so there is no
 * `min`/`max` to bound it. The two are kept as separate types because a festive launcher is
 * not a pre-engineered purchase — but anything that handles one handles the other, and
 * {@link computeModifiers} takes both once each value is read as its own `min` and `max`.
 */
export interface DecorativeModifier {
    /** Journal Modifier Label, e.g. `"Damage"`. */
    readonly label: string;
    /** How the value applies to the base stat. */
    readonly method: 'multiplicative' | 'additive' | 'overwrite';
    /**
     * The modifier value: a fraction for `multiplicative` (`-0.99` is `−99%`), an absolute
     * delta for `additive`, and the replacement value for `overwrite`.
     */
    readonly value: number;
}

/** One festive transformation a module can carry in place of engineering. */
export interface DecorativeModification {
    /**
     * The festive naming paired with the colour the id spells, e.g. `"Festive Green"`. No
     * registry publishes the outfitting panel's own string for these, so this is what the
     * transformation is known as rather than a sourced label.
     */
    readonly name: string;
    /**
     * Every module symbol observed carrying this transformation, e.g.
     * `["Hpt_FlakMortar_Turret_Medium"]`. Joins to the module catalogues.
     *
     * This is what has been **seen**, not what the game permits: the list comes from a
     * journal capture, so a module absent from it is one no capture has shown carrying
     * the transformation.
     */
    readonly modules: readonly string[];
    /**
     * The stat changes the transformation arrives with — for every one of these, a single
     * `Damage` cut of −99%, which is what turns a flak launcher into a firework launcher.
     *
     * Never empty: a decorative modification names no engineering *recipe*, but it is not
     * inert, and reading it as cosmetic-only would overstate a fitted launcher's damage a
     * hundredfold.
     *
     * @example
     * ```ts
     * import { DECORATIVE_MODIFICATIONS } from '@elite-dangerous-almanac/core/ships/decorative-modifications';
     *
     * DECORATIVE_MODIFICATIONS['Decorative_Green']?.modifiers;
     * // -> [{ label: 'Damage', method: 'multiplicative', value: -0.99 }]
     * // on the medium turreted launcher: 34 damage -> 0.34, 0.17 DPS
     * ```
     */
    readonly modifiers: readonly DecorativeModifier[];
}

/**
 * Every decorative modification, keyed by Frontier `fdname` (e.g. `"Decorative_Green"`).
 *
 * @example
 * ```ts
 * import { DECORATIVE_MODIFICATIONS } from '@elite-dangerous-almanac/core/ships/decorative-modifications';
 *
 * Object.keys(DECORATIVE_MODIFICATIONS);
 * // -> ['Decorative_Green', 'Decorative_Red', 'Decorative_Yellow']
 * DECORATIVE_MODIFICATIONS['Decorative_Green']?.modules;
 * // -> ['Hpt_FlakMortar_Turret_Medium']
 * DECORATIVE_MODIFICATIONS['Decorative_Green']?.modifiers;
 * // -> [{ label: 'Damage', method: 'multiplicative', value: -0.99 }]
 * ```
 */
export const DECORATIVE_MODIFICATIONS: Readonly<Record<string, DecorativeModification>> =
    deepFreeze(decorativeData as Record<string, DecorativeModification>);

/**
 * Look up a decorative modification by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The modification id, e.g. `"Decorative_Green"`.
 * @returns The modification — its `name`, the `modules` observed carrying it and the
 * `modifiers` it arrives with — or `null` if the id is not a decorative modification.
 * @example
 * ```ts
 * import { getDecorativeModification } from '@elite-dangerous-almanac/core/ships/decorative-modifications';
 *
 * getDecorativeModification('decorative_red')?.name; // -> 'Festive Red'
 * getDecorativeModification('FSD_LongRange');        // -> null
 * ```
 */
export function getDecorativeModification(fdname: string): DecorativeModification | null {
    if (Object.hasOwn(DECORATIVE_MODIFICATIONS, fdname)) return DECORATIVE_MODIFICATIONS[fdname]!;
    const wanted = fdname.trim().toLowerCase();
    for (const key of Object.keys(DECORATIVE_MODIFICATIONS)) {
        if (key.toLowerCase() === wanted) return DECORATIVE_MODIFICATIONS[key]!;
    }
    return null;
}

/**
 * Whether an id names a decorative modification rather than an engineering blueprint.
 *
 * The question to ask of a journal `EngineerModifications` / `BlueprintName` value that
 * {@link getBlueprint} answered `null` for: `true` means the id is real and names no
 * recipe, and only a `false` here leaves "this library does not know the id" as the
 * remaining reading. It does **not** mean the module is unmodified — read
 * {@link DecorativeModification.modifiers} for what it does change.
 *
 * @param fdname - The id to test, matched case-insensitively and trimmed.
 * @returns `true` when {@link getDecorativeModification} would find it.
 * @example
 * ```ts
 * import { isDecorativeModification } from '@elite-dangerous-almanac/core/ships/decorative-modifications';
 *
 * isDecorativeModification('Decorative_Yellow'); // -> true
 * isDecorativeModification('Weapon_Efficient');  // -> false
 * ```
 */
export function isDecorativeModification(fdname: string): boolean {
    return getDecorativeModification(fdname) !== null;
}

/**
 * Every decorative modification a module has been observed carrying.
 *
 * Matching is case-insensitive and trims whitespace, so a raw journal value can be passed
 * straight in. A module no capture shows carrying one yields an empty array, never
 * `null`, so the result is always safe to iterate — and an empty answer is "none seen on
 * this module", not "this module cannot have one".
 *
 * @param symbol - A module symbol, e.g. `"Hpt_FlakMortar_Turret_Medium"`.
 * @returns The modification ids, in catalogue order. Join to
 * {@link DECORATIVE_MODIFICATIONS}.
 * @example
 * ```ts
 * import { getDecorativeModificationsForModule } from '@elite-dangerous-almanac/core/ships/decorative-modifications';
 *
 * getDecorativeModificationsForModule('Hpt_FlakMortar_Turret_Medium');
 * // -> ['Decorative_Green', 'Decorative_Red', 'Decorative_Yellow']
 * getDecorativeModificationsForModule('Hpt_BeamLaser_Fixed_Small'); // -> []
 * ```
 */
export function getDecorativeModificationsForModule(symbol: string): readonly string[] {
    const wanted = symbol.trim().toLowerCase();
    return Object.entries(DECORATIVE_MODIFICATIONS)
        .filter(([, record]) => record.modules.some((m) => m.toLowerCase() === wanted))
        .map(([id]) => id);
}
