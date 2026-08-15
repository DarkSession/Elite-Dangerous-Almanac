/**
 * The **pre-engineered module catalogue** — the outfitting rows you buy or receive
 * already modified, each paired with the base module it fits as and the engineering
 * identity baked in.
 *
 * A pre-engineered module has **no symbol of its own**. The game sells an ordinary
 * module with engineering already applied, so a journal `Loadout` reports the base
 * `symbol` plus an `Engineering` block — which is why you will not find, say, a
 * `Hpt_Railgun_Fixed_Medium_Merc` in the module catalogues. This catalogue supplies the
 * link that would otherwise be missing: which stock modules exist in a pre-engineered
 * form, and with what fixed engineering state.
 *
 * Its own module (and data file) so consumers who never touch pre-engineered variants
 * do not bundle it.
 *
 * Each entry is a {@link PreEngineeredVariant}: `symbol` joins to the module catalogues,
 * `blueprint` is the id Frontier writes in `Engineering.BlueprintName`, and `grade` is the
 * grade already applied. Most blueprint ids join to `BLUEPRINTS`; the festive
 * `Decorative_*` ids instead identify fixed grade-5 reward articles with no craftable
 * recipe or material cost.
 * The 22 Mercenary entries are bought at grade 1 and their bespoke recipes start at
 * grade 2 — price the remaining upgrade with `getBlueprintCost(blueprint, target,
 * grade)` from `ships/blueprint-costs`. Community-goal and tech-broker entries instead
 * identify fixed reward articles; their blueprint ids do not grant a recipe to the stock
 * module.
 *
 * Note that one base module can appear more than once: the medium Seeker Missile Rack is
 * sold or awarded in six different pre-engineered flavours, so
 * `Hpt_BasicMissileRack_Fixed_Medium` has six entries. Look variants up with
 * {@link getPreEngineeredVariants} (plural) rather than assuming one.
 *
 * Most variants carry a `modifiers` block — the hand-set stat
 * changes the variant arrives with, which is what lets one be fitted and its stats
 * computed. Resolve them against the base module with `getPreEngineeredStats` from
 * `./pre-engineered-stats.js`; it lives in its own module so that consumers who only
 * want the catalogue do not bundle the module and engineering tables.
 * The only pre-engineered Guardian variants are seven Guardian-weapon records. They are
 * final articles and carry {@link PreEngineeredVariant.engineeringLocked}; their stock
 * counterparts can take Anti-Guardian Zone Resistance, but the resolved pre-engineered
 * articles cannot.
 *
 * @packageDocumentation
 */

import preEngineeredData from '../../../data/ships/pre-engineered.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { filterByKey } from '../internal/registry-index.js';
import { requireStringIfPresent } from '../internal/argument-guards.js';

/**
 * Where a pre-engineered variant is obtained.
 *
 * - `mercenary` — bought from the Merc-Coin shop; always arrives at grade 1.
 * - `communityGoal` — awarded for taking part in a community goal; mostly grade 5, and
 *   often carrying an experimental effect the shop rows do not.
 * - `techBroker` — unlocked at a tech broker. Records the route stated by the source.
 * - `eventReward` — awarded already transformed by an event; the festive articles are grade 5.
 */
export type PreEngineeredAcquisition = 'mercenary' | 'communityGoal' | 'techBroker' | 'eventReward';

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
 * One pre-engineered module variant — a pairing of a stock module with the engineering
 * identity it ships with, not a module in its own right.
 */
export interface PreEngineeredVariant {
    /** The base module's symbol, e.g. `"Hpt_Railgun_Fixed_Medium"`. Joins to the module catalogues. */
    readonly symbol: string;
    /**
     * The variant's display name. Festive rows include their colour so variants of the
     * same launcher remain distinct.
     */
    readonly name: string;
    /**
     * The Frontier id written in `Engineering.BlueprintName`, e.g. `"RailGun_LongShot"`
     * or `"Decorative_Red"`.
     *
     * @remarks
     * Most ids join to `BLUEPRINTS`. A festive `Decorative_*` id does not, because it
     * identifies a fixed reward article rather than a recipe a player can apply.
     * On any reward variant the id **identifies** the article rather than reproducing it.
     * Alongside its blueprint and effect, a reward carries hand-set modifier overrides no
     * blueprint grants — that is what makes it a reward rather than a shortcut — so
     * rolling this recipe to this `grade` does not
     * arrive at the same module, and `getBlueprintCost` (in `ships/blueprint-costs`)
     * against it prices ordinary engineering rather than the reward. Read `modifiers`
     * for what the article actually carries.
     */
    readonly blueprint: string;
    /** The engineering grade already applied (1–5). */
    readonly grade: number;
    /**
     * The experimental effect's Frontier `fdname`, e.g.
     * `"special_feedback_cascade_cooled"`. Joins to `EXPERIMENTAL_EFFECTS`. Absent when
     * the variant carries none.
     */
    readonly experimental?: string;
    /** Where the variant comes from. */
    readonly acquisition: PreEngineeredAcquisition;
    /**
     * Whether the article is final and accepts no further engineering.
     *
     * @remarks
     * Present as `true` on the pre-engineered Guardian weapons. Their stock counterparts
     * can take Anti-Guardian Zone Resistance, but the pre-engineered articles cannot:
     * neither that recipe nor any ordinary weapon recipe may be applied to them.
     * Absence means this catalogue does not lock further engineering.
     */
    readonly engineeringLocked?: true;
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
     * those arrive with. Present on all community-goal, tech-broker and event-reward rows.
     */
    readonly modifiers?: readonly PreEngineeredModifier[];
}

/**
 * Every pre-engineered module variant, whether purchased, unlocked or awarded.
 *
 * @remarks
 * This catalogue omits pre-engineered Guardian module rewards whose variant details have
 * no traceable source. The gap is tracked at
 * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/224.
 *
 * @example
 * ```ts
 * import { PRE_ENGINEERED_MODULES } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 *
 * PRE_ENGINEERED_MODULES.length; // -> 76
 * PRE_ENGINEERED_MODULES[0];
 * // -> { symbol: 'Hpt_Mining_AbrBlstr_Fixed_Small', name: 'Abrasion Blaster',
 * //      blueprint: 'AbrasionBlaster_FarReaching', grade: 1,
 * //      acquisition: 'mercenary', mercCoinCost: 400 }
 * ```
 */
export const PRE_ENGINEERED_MODULES: readonly PreEngineeredVariant[] = deepFreeze(
    preEngineeredData as PreEngineeredVariant[],
);

/**
 * Every pre-engineered variant associated with a given base module symbol.
 *
 * Matching is case-insensitive and tolerates surrounding whitespace, so a raw journal
 * value can be passed straight in. Returns an empty array when the module has no known
 * pre-engineered variant — never `null`, so the result is always safe to iterate.
 *
 * @param symbol - A module symbol, e.g. `"Hpt_BasicMissileRack_Fixed_Medium"`.
 * @returns Every pre-engineered variant of that module, in catalogue order.
 *
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 *
 * getPreEngineeredVariants('Hpt_BasicMissileRack_Fixed_Medium').map((v) => v.blueprint);
 * // -> ['SeekerMissileRack_Drag',
 * //     'SeekerMissileRack_LightWeightThermal',
 * //     'SeekerMissileRackMedium_Lockdown',
 * //     'Weapon_HighCapacity', 'Weapon_HighCapacity', 'Weapon_HighCapacity']
 *
 * getPreEngineeredVariants('Int_Hyperdrive_Size2_Class1'); // -> []
 * ```
 */
export function getPreEngineeredVariants(symbol: string): readonly PreEngineeredVariant[] {
    return filterByKey(
        PRE_ENGINEERED_MODULES,
        'symbol',
        symbol,
        'getPreEngineeredVariants: symbol',
    );
}

/**
 * Whether a module has at least one known pre-engineered form.
 *
 * @param symbol - A module symbol.
 * @returns `true` when {@link getPreEngineeredVariants} would return anything.
 *
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { isPreEngineered } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 *
 * isPreEngineered('Hpt_Railgun_Fixed_Medium'); // -> true
 * isPreEngineered('Int_Hyperdrive_Size2_Class1'); // -> false
 * ```
 */
export function isPreEngineered(symbol: string): boolean {
    requireStringIfPresent(symbol, 'isPreEngineered: symbol');
    return getPreEngineeredVariants(symbol).length > 0;
}
