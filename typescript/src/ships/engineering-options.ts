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
 * The catalogue groups 1063 of the 1198 modules — every module EDSY or coriolis-data
 * gives a recipe for. The other 135 are the families that take no engineering at all:
 * fuel tanks, passenger cabins, the repair, recon, research, decontamination and
 * multi-limpet controllers, meta-alloy hull reinforcement, the Pulse Wave Analyser, the
 * mining launchers, Shock Cannons, Nanite Torpedo Pylons, fighter and vehicle hangars,
 * the discovery scanners and the AX utility modules.
 *
 * Its own module (and data file) so consumers who never open an engineering menu do not
 * bundle it — 65 KB minified, 7 KB gzipped, of which the module→group map is most of the
 * weight. Everything returned joins straight to `BLUEPRINTS` and `EXPERIMENTAL_EFFECTS`,
 * neither of which this module pulls in.
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
 * `null` means **"no source gives this module a recipe"**, which for the 135 ungrouped
 * modules is the same as "cannot be engineered" — they are whole families the game
 * offers no blueprint for, listed in the module overview above. It stays worded as the
 * catalogue's answer rather than the game's because that is what it can honestly claim:
 * a module Frontier adds engineering for later reads `null` until a registry says so.
 *
 * @param symbol - A module symbol, e.g. `"Hpt_BeamLaser_Fixed_Small"`.
 * @returns The group id, or `null` when the module is not in the catalogue.
 *
 * @example
 * ```ts
 * getEngineeringGroup('Hpt_BeamLaser_Fixed_Small'); // -> 'beamLasers'
 * getEngineeringGroup('Int_CargoRack_Size2_Class1'); // -> 'cargoRacks'
 *
 * // Not listed — no registry gives a fuel tank a blueprint.
 * getEngineeringGroup('Int_FuelTank_Size3_Class3'); // -> null
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
 * see {@link getEngineeringGroup} for what an empty answer claims.
 *
 * **One recipe, two journal ids.** Where a modification applies to several module
 * families the game writes a family-specific `BlueprintName`, and `BLUEPRINTS` carries
 * both that and the generic spelling — a life support's Lightweight is
 * `LifeSupport_LightWeight` here and `Misc_LightWeight` in an EDSY-authored build. The
 * family-specific id is the one listed, so compare ids with that in mind: the two are the
 * same recipe. `Sensor_LongRange` and `Scanner_LongRange` are **not** such a pair — those
 * are two different recipes, and the utility scanners list the `Scanner_*` ones.
 *
 * @param symbol - A module symbol.
 * @returns Blueprint ids, sorted. Join to `BLUEPRINTS`.
 *
 * @example
 * ```ts
 * getBlueprintsForModule('Hpt_BeamLaser_Fixed_Small');
 * // -> ['Weapon_Efficient', 'Weapon_LightWeight', 'Weapon_LongRange', ...]
 *
 * getBlueprintsForModule('Int_LifeSupport_Size4_Class2');
 * // -> ['LifeSupport_LightWeight', 'LifeSupport_Reinforced', 'LifeSupport_Shielded']
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
 * **An empty array is the common answer, and it usually means "blueprints only".** 389
 * of the 1063 grouped modules have no experimental slot at all — 27 of the 50 groups
 * offer none, among them life support, sensors, the limpet controllers, the utility
 * scanners and the Guardian weapons — and an ungrouped module answers empty too.
 * {@link getEngineeringGroup} tells the two apart: it is `null` only for the second.
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
 * The groups name 81 of the 108 blueprints in `BLUEPRINTS`. The other 27 are the
 * pre-engineered `recipe_*` variants, which are sold already applied rather than offered
 * in an engineering menu (see `ships/pre-engineered`), plus `MC_Overcharged` —
 * coriolis-data's multi-cannon Overcharged, one clip-size leg apart from the
 * `Weapon_Overcharged` the multi-cannon group lists. All 27 answer `[]` here exactly as
 * an unknown id would.
 *
 * @param blueprint - A blueprint id, e.g. `"Weapon_Efficient"`.
 * @returns Experimental-effect ids, sorted and de-duplicated; empty when no group names
 * the blueprint, or when its groups take no experimental.
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
