/**
 * **Engineering options** — which blueprints and which experimental effects a given
 * module can actually take.
 *
 * Availability is a property of the **module**, not of the blueprint. A Pulse Laser
 * accepts the Efficient blueprint and a Rail Gun does not, and the two offer different
 * experimental effects even where their blueprints overlap; asking "what can I put on
 * this module?" is the question the game actually answers. So modules are grouped, and
 * each group lists what it offers.
 *
 * The catalogue groups 428 of the 1198 modules, so families it does not yet map — hull
 * armour, sensors, life support, heat sink and chaff launchers, the Detailed Surface
 * Scanner, limpet controllers, AFMUs, fuel scoops, FSD interdictors, the Guardian
 * weapons — answer "nothing" here although real builds engineer them. Treat an empty
 * result as "not listed", not as "cannot be engineered"; `TODO.md` tracks the gap.
 *
 * Its own module (and data file) so consumers who never open an engineering menu do not
 * bundle it. Everything returned joins straight to `BLUEPRINTS` and
 * `EXPERIMENTAL_EFFECTS`.
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
    /** Blueprint ids the group accepts. Join to `BLUEPRINTS`. */
    readonly blueprints: readonly string[];
    /** Experimental-effect ids the group accepts. Join to `EXPERIMENTAL_EFFECTS`. */
    readonly experimentals: readonly string[];
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
 * ENGINEERING_OPTION_GROUPS['beamLasers'].experimentals.length; // -> 9
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
 * @returns Blueprint ids, in catalogue order. Join to `BLUEPRINTS`.
 *
 * @example
 * ```ts
 * getBlueprintsForModule('Hpt_BeamLaser_Fixed_Small');
 * // -> ['Weapon_Efficient', 'Weapon_LightWeight', 'Weapon_LongRange', ...]
 * ```
 */
export function getBlueprintsForModule(symbol: string): readonly string[] {
    const group = getEngineeringGroup(symbol);
    return group === null ? [] : ENGINEERING_OPTION_GROUPS[group]!.blueprints;
}

/**
 * Every experimental effect a module can take — its group's list, minus the effects
 * that particular module is excluded from.
 *
 * Most modules take their whole group's list, but there are real exceptions: a
 * Multi-cannon cannot take Phasing Sequence, and six of the seven grouped mining tools
 * take no experimental at all (every Mining Laser but the small fixed one, plus both
 * Abrasion Blasters). Those are applied here, so the result is the exact set for this
 * module.
 *
 * Returns an empty array both for modules this catalogue does not group and for those
 * six, which are grouped but have no experimental slot — {@link getEngineeringGroup}
 * tells the two apart: it is `null` only for the first, and only the first may still be
 * engineerable in game.
 *
 * @param symbol - A module symbol.
 * @returns Experimental-effect ids. Join to `EXPERIMENTAL_EFFECTS`.
 *
 * @example
 * ```ts
 * getExperimentalsForModule('Hpt_MultiCannon_Fixed_Medium').length; // -> 12
 *
 * // The small Multi-cannon is one effect short — no Phasing Sequence.
 * getExperimentalsForModule('Hpt_MultiCannon_Fixed_Small').length; // -> 11
 *
 * // Grouped, so it has blueprints — but it takes no experimental.
 * getExperimentalsForModule('Hpt_Mining_AbrBlstr_Fixed_Small'); // -> []
 * ```
 */
export function getExperimentalsForModule(symbol: string): readonly string[] {
    const normalized = symbol.trim().toLowerCase();
    const group = moduleGroup.get(normalized);
    if (group === undefined) return [];
    const all = ENGINEERING_OPTION_GROUPS[group]!.experimentals;
    const excluded = moduleExclusions.get(normalized);
    return excluded === undefined ? all : all.filter((e) => !excluded.has(e.toLowerCase()));
}

/**
 * Every experimental effect that can be paired with a blueprint, across all the module
 * groups that accept it.
 *
 * Because availability is per module, this is the **union**: engineering a Rail Gun with
 * `Weapon_LongRange` does not offer every effect listed here, only its own group's. Use
 * {@link getExperimentalsForModule} once you know the module — that is the exact answer.
 *
 * Only the blueprints the grouped families name are covered — 42 of the 108 in
 * `BLUEPRINTS`. The other 66 are real recipes on modules this catalogue does not group
 * yet (every armour, sensor, limpet-controller and interdictor blueprint among them),
 * and they answer `[]` here exactly as an unknown id would.
 *
 * @param blueprint - A blueprint id, e.g. `"Weapon_Efficient"`.
 * @returns Experimental-effect ids, sorted and de-duplicated; empty when no group names
 * the blueprint — because it is unknown, or not yet mapped — or when its groups take no
 * experimental.
 *
 * @example
 * ```ts
 * getExperimentalsForBlueprint('FSD_LongRange');
 * // -> ['special_fsd_cooled', 'special_fsd_fuelcapacity', 'special_fsd_heavy', ...]
 * ```
 */
export function getExperimentalsForBlueprint(blueprint: string): readonly string[] {
    const normalized = blueprint.trim().toLowerCase();
    const out = new Set<string>();
    for (const group of Object.values(ENGINEERING_OPTION_GROUPS)) {
        if (!group.blueprints.some((b) => b.toLowerCase() === normalized)) continue;
        for (const effect of group.experimentals) out.add(effect);
    }
    return [...out].sort();
}
