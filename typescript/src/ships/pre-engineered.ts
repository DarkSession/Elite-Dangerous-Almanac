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
 * Note that one base module can appear more than once: the medium Seeker Missile Rack is
 * sold or awarded in six different pre-engineered flavours, so
 * `Hpt_BasicMissileRack_Fixed_Medium` has six entries. Look variants up with
 * {@link getPreEngineeredVariants} (plural) rather than assuming one.
 *
 * Most variants carry a {@link PreEngineeredVariant.modifiers} block — the hand-set stat
 * changes the variant arrives with, which is what lets one be fitted and its stats
 * computed. Resolve them against the base module with `getPreEngineeredStats` from
 * `./pre-engineered-stats.js`; it lives in its own module so that consumers who only
 * want the catalogue do not bundle the module and engineering tables.
 *
 * @packageDocumentation
 */

import preEngineeredData from '../../../data/ships/pre-engineered.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/**
 * Where a pre-engineered variant is obtained.
 *
 * - `mercenary` — bought from the Merc-Coin shop; always arrives at grade 1.
 * - `communityGoal` — awarded for taking part in a community goal; mostly grade 5, and
 *   often carrying an experimental effect the shop rows do not.
 * - `techBroker` — unlocked at a tech broker. Records the one route the source states;
 *   several of these were also community-goal rewards at some point.
 */
export type PreEngineeredAcquisition = 'mercenary' | 'communityGoal' | 'techBroker';

/**
 * One hand-set stat change a pre-engineered variant arrives with.
 *
 * Same vocabulary as a blueprint feature or experimental contribution: a journal
 * Modifier `label`, the `method` by which it applies, and its `value`. Unlike a
 * blueprint feature there is no `min`/`max` — a pre-engineered variant is a fixed
 * article, not a roll.
 */
export interface PreEngineeredModifier {
    /** Journal Modifier Label, e.g. `"PowerDraw"`, `"ArmourPenetration"`. */
    readonly label: string;
    /** How the value applies to the base stat. */
    readonly method: 'multiplicative' | 'additive' | 'overwrite';
    /**
     * The modifier value: a fraction for `multiplicative` (`0.5` is `+50%`), an absolute
     * delta for `additive`, and the replacement value for `overwrite`.
     */
    readonly value: number;
}

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
    /** The blueprint grade already applied (1–5). */
    readonly grade: number;
    /**
     * The experimental effect already applied, e.g. `"special_feedback_cascade_cooled"`.
     * Joins to `EXPERIMENTAL_EFFECTS`. Absent when the variant carries none.
     */
    readonly experimental?: string;
    /** Where the variant comes from. */
    readonly acquisition: PreEngineeredAcquisition;
    /**
     * The shop price in Merc Coin. Present only on `mercenary` rows — the other routes
     * are not bought with a currency. Merc Coin has no credit equivalent, which is why
     * this is separate from the credit `cost` a module carries.
     */
    readonly mercCoinCost?: number;
    /**
     * The hand-set stat block the variant arrives with, sorted by `label`.
     *
     * Absent on every `mercenary` row: no registry publishes the grade-1 pre-engineering
     * those arrive with. Present on all 51 community-goal and tech-broker rows.
     */
    readonly modifiers?: readonly PreEngineeredModifier[];
}

/**
 * Every purchasable pre-engineered module variant.
 *
 * @example
 * ```ts
 * PRE_ENGINEERED_MODULES.length; // -> 72
 * PRE_ENGINEERED_MODULES[0];
 * // -> { symbol: 'Hpt_Mining_AbrBlstr_Fixed_Small', name: 'Abrasion Blaster',
 * //      blueprint: 'recipe_abrasionblaster_farreaching', grade: 1,
 * //      acquisition: 'mercenary', mercCoinCost: 400 }
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
 * //     'recipe_seekermissilerackmedium_lockdown',
 * //     'Weapon_HighCapacity', 'Weapon_HighCapacity', 'Weapon_HighCapacity']
 *
 * getPreEngineeredVariants('Int_Hyperdrive_Size2_Class1'); // -> []
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
 * getPreEngineeredByBlueprint('NoSuchBlueprint'); // -> []
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
 * isPreEngineered('Int_Hyperdrive_Size2_Class1'); // -> false
 * ```
 */
export function isPreEngineered(symbol: string): boolean {
    return getPreEngineeredVariants(symbol).length > 0;
}
