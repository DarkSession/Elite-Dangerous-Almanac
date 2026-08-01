/**
 * The **pre-engineered module catalogue** — the outfitting rows you buy already
 * engineered, each paired with the base module it fits as and the blueprint baked in.
 *
 * A pre-engineered module has **no symbol of its own**. The game sells an ordinary
 * module with engineering already applied, so a journal `Loadout` reports the base
 * `symbol` plus an `Engineering` block — which is why you will not find, say, a
 * `Hpt_Railgun_Fixed_Medium_Merc` in the module catalogues. This catalogue supplies the
 * link that would otherwise be missing: which stock modules are purchasable
 * pre-engineered, and with what.
 *
 * Its own module (and data file) so consumers who never touch pre-engineered variants
 * do not bundle it.
 *
 * Each entry is a {@link PreEngineeredVariant}: `symbol` joins to the module catalogues,
 * `blueprint` to `BLUEPRINTS`, and `grade` is the grade already applied at purchase.
 * Because grade 1 is what the bought module already contains, these blueprints' own
 * recipes start at grade 2 — price the remaining upgrade with
 * `getBlueprintCost(blueprint, target, grade)`.
 *
 * Note that one base module can appear more than once: a 2B Missile Rack is sold in
 * three different pre-engineered flavours, so `Hpt_BasicMissileRack_Fixed_Medium` has
 * three entries. Look variants up with {@link getPreEngineeredVariants} (plural) rather
 * than assuming one.
 *
 * The Merc-Coin price is deliberately not stored — it is a currency, and no catalogue
 * in this repository carries prices. See `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import preEngineeredData from '../../../data/ships/pre-engineered.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/** Where a pre-engineered variant is obtained. */
export type PreEngineeredAcquisition = 'mercenary';

/**
 * One purchasable pre-engineered module variant — a pairing of a stock module with the
 * blueprint it ships with, not a module in its own right.
 */
export interface PreEngineeredVariant {
    /** The base module's symbol, e.g. `"Hpt_Railgun_Fixed_Medium"`. Joins to the module catalogues. */
    readonly symbol: string;
    /** The base module's display name, e.g. `"Rail Gun"`. */
    readonly name: string;
    /** The blueprint baked in at purchase, e.g. `"recipe_railgun_longshot"`. Joins to `BLUEPRINTS`. */
    readonly blueprint: string;
    /** The blueprint grade already applied when bought (1–5). */
    readonly grade: number;
    /** Where the variant comes from. */
    readonly acquisition: PreEngineeredAcquisition;
}

/**
 * Every purchasable pre-engineered module variant.
 *
 * @example
 * ```ts
 * PRE_ENGINEERED_MODULES.length; // -> 21
 * PRE_ENGINEERED_MODULES[0];
 * // -> { symbol: 'Hpt_Mining_AbrBlstr_Fixed_Small', name: 'Abrasion Blaster',
 * //      blueprint: 'recipe_abrasionblaster_farreaching', grade: 1, acquisition: 'mercenary' }
 * ```
 */
export const PRE_ENGINEERED_MODULES: readonly PreEngineeredVariant[] = deepFreeze(
    preEngineeredData as PreEngineeredVariant[],
);

/**
 * Every pre-engineered variant sold for a given base module symbol.
 *
 * Matching is case-insensitive and tolerates surrounding whitespace, so a raw journal
 * value can be passed straight in. Returns an empty array when the module is not sold
 * pre-engineered — never `null`, so the result is always safe to iterate.
 *
 * @param symbol - A module symbol, e.g. `"Hpt_BasicMissileRack_Fixed_Medium"`.
 * @returns Every pre-engineered variant of that module, in catalogue order.
 *
 * @example
 * ```ts
 * getPreEngineeredVariants('Hpt_BasicMissileRack_Fixed_Medium').map((v) => v.blueprint);
 * // -> ['recipe_seekermissilerack_drag',
 * //     'recipe_seekermissilerack_lightweightthermal',
 * //     'recipe_seekermissilerackmedium_lockdown']
 *
 * getPreEngineeredVariants('Int_Hyperdrive_Size5_Class5'); // -> []
 * ```
 */
export function getPreEngineeredVariants(symbol: string): readonly PreEngineeredVariant[] {
    const normalized = symbol.trim().toLowerCase();
    return PRE_ENGINEERED_MODULES.filter((v) => v.symbol.toLowerCase() === normalized);
}

/**
 * Every pre-engineered variant sold with a given blueprint.
 *
 * One blueprint can be sold on more than one base module — the Drag seeker
 * pre-engineering, for instance, is offered on both the medium and the large missile
 * rack — so this returns an array. Matching is case-insensitive and trims whitespace,
 * and a miss is an empty array rather than `null`.
 *
 * @param blueprint - A blueprint id, e.g. `"recipe_railgun_longshot"`.
 * @returns Every variant sold with that blueprint, in catalogue order.
 *
 * @example
 * ```ts
 * getPreEngineeredByBlueprint('recipe_railgun_longshot').map((v) => v.symbol);
 * // -> ['Hpt_Railgun_Fixed_Medium']
 *
 * getPreEngineeredByBlueprint('recipe_seekermissilerack_drag').map((v) => v.symbol);
 * // -> ['Hpt_BasicMissileRack_Fixed_Medium', 'Hpt_BasicMissileRack_Fixed_Large']
 *
 * getPreEngineeredByBlueprint('FSD_LongRange'); // -> []
 * ```
 */
export function getPreEngineeredByBlueprint(blueprint: string): readonly PreEngineeredVariant[] {
    const normalized = blueprint.trim().toLowerCase();
    return PRE_ENGINEERED_MODULES.filter((v) => v.blueprint.toLowerCase() === normalized);
}

/**
 * Whether a module is sold in at least one pre-engineered form.
 *
 * @param symbol - A module symbol.
 * @returns `true` when {@link getPreEngineeredVariants} would return anything.
 *
 * @example
 * ```ts
 * isPreEngineered('Hpt_Railgun_Fixed_Medium'); // -> true
 * isPreEngineered('Int_Hyperdrive_Size5_Class5'); // -> false
 * ```
 */
export function isPreEngineered(symbol: string): boolean {
    return getPreEngineeredVariants(symbol).length > 0;
}
