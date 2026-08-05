/**
 * **Engineering options** — which blueprints a module can be engineered with, and which
 * experimental effects each of those blueprints offers.
 *
 * **An experimental effect belongs to the blueprint, not to the module.** The game
 * offers the experimental slot inside an applied blueprint: an effect survives a re-roll
 * or a grade increase of the same blueprint, and is dropped when the module is switched
 * to a different one. So the exact question is *"what can this blueprint give me on this
 * module?"* — {@link getExperimentalsForBlueprint} — and a blueprint id alone does not
 * answer it, because a Pulse Laser and a Rail Gun both take `Weapon_Efficient` and offer
 * different effects under it. Modules are grouped, and each group's blueprints carry
 * their own experimental list.
 *
 * **What the stored lists can and cannot say.** No public registry publishes an
 * experimental list per blueprint — EDSY and coriolis-data both publish one per module
 * group — so every blueprint of a group here carries that group's list. The shape holds
 * a per-blueprint difference the moment one is sourced, but until then a blueprint that
 * offers *fewer* effects than its siblings, if such a blueprint exists, still answers
 * with the group's:
 * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/33.
 *
 * The catalogue groups 428 of the 1198 modules, so families it does not yet map — hull
 * armour, sensors, life support, heat sink and chaff launchers, the Detailed Surface
 * Scanner, limpet controllers, AFMUs, fuel scoops, FSD interdictors, the Guardian
 * weapons — answer "nothing" here although real builds engineer them. Treat an empty
 * result as "not listed", not as "cannot be engineered"; the gap is tracked at
 * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/13.
 *
 * Its own module (and data file) so consumers who never open an engineering menu do not
 * bundle it. Everything returned joins straight to `BLUEPRINTS` and
 * `EXPERIMENTAL_EFFECTS`.
 *
 * **Size.** Storing a list per blueprint rather than per group costs 51.0 KB of shipped
 * `dist/` in this module's import graph, 4.3 KB gzipped — up from 31.4 KB / 3.9 KB,
 * because the 22 group lists are written out 107 times. Almost all of the growth is
 * redundancy gzip removes, and it buys the one place a per-blueprint difference can be
 * recorded, so the explicit form was kept. Against the rest of the library
 * (`ships/modules` 290 KB) it is small, but it is why this stays a leaf module you opt
 * into rather than something the barrel drags in.
 *
 * This complements `engineering-compatibility.ts`: that answers "may this blueprint be
 * applied to this module?" for a build already assembled, while this enumerates the
 * choices up front.
 *
 * @packageDocumentation
 */

import optionsData from '../../../data/ships/engineering-options.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';

/** What one group of modules can be engineered with. */
export interface EngineeringOptionGroup {
    /** Display name of the module group, e.g. `"Beam Lasers"`. */
    readonly name: string;
    /**
     * Blueprint id → the experimental-effect ids **that blueprint** offers on this
     * group's modules. Keys join to `BLUEPRINTS`, values to `EXPERIMENTAL_EFFECTS`.
     *
     * @remarks
     * An empty array is a blueprint with no experimental slot, which is a different
     * answer from a blueprint the group does not offer at all (an absent key).
     */
    readonly blueprints: Readonly<Record<string, readonly string[]>>;
}

interface EngineeringOptionData {
    readonly groups: Readonly<Record<string, EngineeringOptionGroup>>;
    readonly modules: Readonly<Record<string, string>>;
    readonly exclusions: Readonly<Record<string, readonly string[]>>;
}

const DATA: EngineeringOptionData = deepFreeze(optionsData as EngineeringOptionData);

/**
 * Every module group that can be engineered, keyed by a stable group id
 * (e.g. `"beamLasers"`, `"powerDistributors"`).
 *
 * @example
 * ```ts
 * ENGINEERING_OPTION_GROUPS['beamLasers'].name; // -> 'Beam Lasers'
 * ENGINEERING_OPTION_GROUPS['beamLasers'].blueprints['Weapon_Efficient'].length; // -> 9
 * ```
 */
export const ENGINEERING_OPTION_GROUPS: Readonly<Record<string, EngineeringOptionGroup>> =
    DATA.groups;

const moduleGroup = new Map(
    Object.entries(DATA.modules).map(([symbol, group]) => [symbol.toLowerCase(), group]),
);
const moduleExclusions = new Map(
    Object.entries(DATA.exclusions).map(([symbol, effects]) => [
        symbol.toLowerCase(),
        new Set(effects.map((e) => e.toLowerCase())),
    ]),
);

/** The one "nothing here" answer, so a miss is as frozen as a hit. */
const EMPTY: readonly string[] = Object.freeze([]);

/** The group a module belongs to, with its lookup key already normalised. */
function groupFor(symbol: string): EngineeringOptionGroup | null {
    const group = moduleGroup.get(symbol.trim().toLowerCase());
    return group === undefined ? null : (ENGINEERING_OPTION_GROUPS[group] ?? null);
}

/**
 * Drop the effects this particular module is excluded from.
 *
 * Always a fresh frozen array, never the catalogue's own: a caller that sorts the result
 * must not behave differently for a module that happens to have no exclusions, and must
 * not be able to reorder the catalogue for everyone else.
 */
function withoutExclusions(symbol: string, effects: readonly string[]): readonly string[] {
    const excluded = moduleExclusions.get(symbol.trim().toLowerCase());
    return Object.freeze(
        excluded === undefined
            ? [...effects]
            : effects.filter((e) => !excluded.has(e.toLowerCase())),
    );
}

/**
 * The group id a module is engineered as, or `null` when this catalogue does not group
 * it.
 *
 * `null` means **"not listed here"**, which is not the same as "cannot be engineered".
 * The catalogue groups 428 of the 1198 modules, so families it does not yet map answer
 * `null` although the game engineers them — a cargo rack is the plain case: it takes
 * `CargoRack_IncreasedCapacity`, which is in `BLUEPRINTS`, yet has no group here.
 *
 * @param symbol - A module symbol, e.g. `"Hpt_BeamLaser_Fixed_Small"`.
 * @returns The group id, or `null` when the module is not in the catalogue.
 *
 * @example
 * ```ts
 * getEngineeringGroup('Hpt_BeamLaser_Fixed_Small'); // -> 'beamLasers'
 *
 * // Not listed — which is not the same as not engineerable; see above.
 * getEngineeringGroup('Int_CargoRack_Size2_Class1'); // -> null
 * ```
 */
export function getEngineeringGroup(symbol: string): string | null {
    return moduleGroup.get(symbol.trim().toLowerCase()) ?? null;
}

/**
 * Every blueprint a module can be engineered with.
 *
 * Matching is case-insensitive and trims whitespace. A module this catalogue does not
 * group yields an empty array, never `null`, so the result is always safe to iterate —
 * but read that empty array as "not listed", not as "not engineerable"; see
 * {@link getEngineeringGroup}.
 *
 * @param symbol - A module symbol.
 * @returns A frozen array of blueprint ids, in catalogue order. Join to `BLUEPRINTS`.
 *
 * @example
 * ```ts
 * getBlueprintsForModule('Hpt_BeamLaser_Fixed_Small');
 * // -> ['Weapon_Efficient', 'Weapon_LightWeight', 'Weapon_LongRange', ...]
 * ```
 */
export function getBlueprintsForModule(symbol: string): readonly string[] {
    const group = groupFor(symbol);
    return group === null ? EMPTY : Object.freeze(Object.keys(group.blueprints));
}

/**
 * Every experimental effect a module can take **under one blueprint** — the menu the
 * game shows once that blueprint is applied.
 *
 * This is the answer to ask for, because the experimental slot belongs to the
 * blueprint: pick the blueprint first, and this is the list. It is that blueprint's own
 * list minus the effects the particular module is excluded from — a Multi-cannon cannot
 * take Phasing Sequence under any blueprint, and six of the seven grouped mining tools
 * take no experimental at all (every Mining Laser but the small fixed one, plus both
 * Abrasion Blasters).
 *
 * Both arguments are matched case-insensitively with surrounding whitespace trimmed.
 *
 * @remarks
 * **It can be wider than the game's, never narrower.** The stored lists are an expansion
 * of a per-module-group source, so two blueprints of one group answer identically; if
 * the game gives one of them fewer effects — Anti-Guardian Zone Resistance is the
 * suspected case — that difference is not carried here yet:
 * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/33.
 *
 * @param blueprint - A blueprint id, e.g. `"Weapon_Efficient"`.
 * @param symbol - The module symbol the blueprint would be applied to.
 * @returns A frozen array of experimental-effect ids, in catalogue order. Join to
 * `EXPERIMENTAL_EFFECTS`. Empty when the module is not grouped here, when the blueprint
 * is not one this module offers, or when the pairing genuinely has no experimental slot
 * — {@link getEngineeringGroup} and {@link getBlueprintsForModule} tell those apart.
 *
 * @example
 * ```ts
 * getExperimentalsForBlueprint('FSD_LongRange', 'Int_Hyperdrive_Size5_Class5');
 * // -> ['special_fsd_cooled', 'special_fsd_fuelcapacity', 'special_fsd_heavy', ...]
 *
 * // The small Multi-cannon is one effect short — no Phasing Sequence.
 * getExperimentalsForBlueprint('Weapon_Efficient', 'Hpt_MultiCannon_Fixed_Medium').length; // -> 12
 * getExperimentalsForBlueprint('Weapon_Efficient', 'Hpt_MultiCannon_Fixed_Small').length; // -> 11
 *
 * // A blueprint this module does not take.
 * getExperimentalsForBlueprint('Weapon_Efficient', 'Int_Hyperdrive_Size5_Class5'); // -> []
 * ```
 */
export function getExperimentalsForBlueprint(blueprint: string, symbol: string): readonly string[] {
    const group = groupFor(symbol);
    if (group === null) return EMPTY;
    const wanted = blueprint.trim().toLowerCase();
    const entry = Object.entries(group.blueprints).find(([id]) => id.toLowerCase() === wanted);
    return entry === undefined ? EMPTY : withoutExclusions(symbol, entry[1]);
}

/**
 * Every experimental effect a module can take under **any** of its blueprints — the
 * union, for a menu drawn before a blueprint has been chosen.
 *
 * Because the experimental slot belongs to the blueprint, this is deliberately looser
 * than the real answer: it is the union over every blueprint the module takes, so it can
 * never be narrower than {@link getExperimentalsForBlueprint} for any one of them. Once
 * the blueprint is known, ask for that pairing instead.
 *
 * Matching is case-insensitive and trims whitespace. Returns an empty array both for
 * modules this catalogue does not group and for the six that are grouped but have no
 * experimental slot — {@link getEngineeringGroup} tells the two apart: it is `null` only
 * for the first, and only the first may still be engineerable in game.
 *
 * @param symbol - A module symbol.
 * @returns A frozen array of experimental-effect ids, in catalogue order, de-duplicated
 * across the module's blueprints. Join to `EXPERIMENTAL_EFFECTS`.
 *
 * @example
 * ```ts
 * getExperimentalsForModule('Hpt_MultiCannon_Fixed_Medium').length; // -> 12
 *
 * // Grouped, so it has blueprints — but it takes no experimental.
 * getExperimentalsForModule('Hpt_Mining_AbrBlstr_Fixed_Small'); // -> []
 * ```
 */
export function getExperimentalsForModule(symbol: string): readonly string[] {
    const group = groupFor(symbol);
    if (group === null) return EMPTY;
    const union = new Set<string>();
    for (const effects of Object.values(group.blueprints)) {
        for (const effect of effects) union.add(effect);
    }
    return withoutExclusions(symbol, [...union]);
}
