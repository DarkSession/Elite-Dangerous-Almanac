/**
 * **Engineering options** — which blueprints and which experimental effects a given
 * module can actually take.
 *
 * Availability is a property of the **module**, not of the blueprint. A Pulse Laser and
 * a Rail Gun both accept the Efficient blueprint, but they offer different experimental
 * effects; asking "what can I put on this module?" is the question the game actually
 * answers. So modules are grouped, and each group lists what it offers.
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
 * The group id a module is engineered as, or `null` when the module cannot be
 * engineered at all.
 *
 * @param symbol - A module symbol, e.g. `"Hpt_BeamLaser_Fixed_Small"`.
 * @returns The group id, or `null`.
 *
 * @example
 * ```ts
 * getEngineeringGroup('Hpt_BeamLaser_Fixed_Small'); // -> 'beamLasers'
 * getEngineeringGroup('Int_CargoRack_Size2_Class1'); // -> null (not engineerable)
 * ```
 */
export function getEngineeringGroup(symbol: string): string | null {
    return moduleGroup.get(symbol.trim().toLowerCase()) ?? null;
}

/**
 * Every blueprint a module can be engineered with.
 *
 * Matching is case-insensitive and trims whitespace. A module that cannot be engineered
 * yields an empty array, never `null`, so the result is always safe to iterate.
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
 * Multi-cannon cannot take Phasing Sequence, and the mining tools take no experimental
 * at all. Those are applied here, so the result is the exact set for this module.
 *
 * Returns an empty array both for modules that cannot be engineered and for the few
 * that are engineerable but have no experimental slot — use {@link getEngineeringGroup}
 * to tell those apart if you need to.
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
 * getExperimentalsForModule('Hpt_Mining_AbrBlstr_Fixed_Small'); // -> [] (no slot)
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
 * `Weapon_Efficient` does not offer every effect listed here, only its own group's. Use
 * {@link getExperimentalsForModule} once you know the module — that is the exact answer.
 *
 * @param blueprint - A blueprint id, e.g. `"Weapon_Efficient"`.
 * @returns Experimental-effect ids, sorted and de-duplicated; empty when the blueprint
 * is unknown or its modules take no experimental.
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
