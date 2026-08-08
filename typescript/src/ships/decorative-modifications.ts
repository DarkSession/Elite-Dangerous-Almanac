/**
 * The **decorative modification catalogue** — the cosmetic transformations the game
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
 * the transformation carries a heavy cut to the module's `Damage` to match. That cut is
 * **not stored yet**: nothing published carries the magnitude, and this catalogue does not
 * guess one. So a build carrying a festive launcher computes its weapon metrics from the
 * base module's damage, which is far too high — read the module's stats through the
 * `Engineering.Modifiers` block the journal itself supplies, which is exact, rather than
 * through this catalogue. See
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md)
 * §Decorative modifications for what would fill the gap.
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
 * repository owner; EDSY lists the same three transformations and gives them no modifiers,
 * which the damage cut shows to be an incomplete record. See
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import decorativeData from '../../../data/ships/decorative-modifications.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

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
}

/**
 * Every decorative modification, keyed by Frontier `fdname` (e.g. `"Decorative_Green"`).
 *
 * @example
 * ```ts
 * Object.keys(DECORATIVE_MODIFICATIONS);
 * // -> ['Decorative_Green', 'Decorative_Red', 'Decorative_Yellow']
 * DECORATIVE_MODIFICATIONS['Decorative_Green'].modules;
 * // -> ['Hpt_FlakMortar_Turret_Medium']
 * ```
 */
export const DECORATIVE_MODIFICATIONS: Readonly<Record<string, DecorativeModification>> =
    deepFreeze(decorativeData as Record<string, DecorativeModification>);

/**
 * Look up a decorative modification by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The modification id, e.g. `"Decorative_Green"`.
 * @returns The modification (its `name` and the `modules` observed carrying it), or
 * `null` if the id is not a decorative modification.
 * @example
 * ```ts
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
 * remaining reading. It does **not** mean the module is unmodified — a festive
 * transformation cuts the launcher's damage heavily, and the journal's own
 * `Engineering.Modifiers` block is where that value is.
 *
 * @param fdname - The id to test, matched case-insensitively and trimmed.
 * @returns `true` when {@link getDecorativeModification} would find it.
 * @example
 * ```ts
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
