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
 * The catalogue groups 1028 of the 1197 modules — every module upstream allows a recipe
 * on. The other 169 take no engineering: whole families (fuel tanks, passenger cabins,
 * the repair, recon, research, decontamination and multi-limpet controllers, meta-alloy
 * and ordinary module reinforcement, the Pulse Wave Analyser, the mining launchers, Shock
 * Cannons, Nanite Torpedo Pylons, fighter and vehicle hangars, docking computers and
 * Supercruise Assist, the module stabilisers, the planetary approach suites, the
 * discovery scanners, the cargo hatch and the AX utility modules), plus the individual
 * modules upstream denies every blueprint — every anti-xeno multi-cannon but the two
 * gimballed, both Enhanced anti-xeno missile racks and every turreted plain one, five of
 * the seven mining tools, the remote-release launchers and the Mk II Plasma Shock
 * Autocannon.
 *
 * **A group is one menu.** Where the same kind of module comes in two flavours with
 * different menus, they are two groups: a Guardian Power Plant takes only Anti-Guardian
 * Zone Resistance and an ordinary one takes only the ordinary recipes, so `powerPlants`
 * and `guardianPowerPlants` are separate — likewise the distributors and the hull
 * reinforcement packages. The Guardian half of each pair takes **no experimental effect**:
 * Anti-Guardian Zone Resistance is the whole menu, and it has no experimental slot. The
 * other Guardian module families — FSD boosters, module and shield reinforcement — are the
 * same. A Guardian module carrying an experimental was obtained already engineered, as a
 * community-goal or tech-broker reward, rather than rolled at an engineer; this menu
 * answers what a player may apply, so it does not list those. (Guardian **weapons** are a
 * same shape: their menus are that one recipe too, because an ordinary weapon recipe on a
 * Guardian weapon is always a purchase rather than an engineer roll — `ships/pre-engineered`
 * carries those.)
 *
 * Its own module (and data file) so a consumer who only reads it pays for nothing else —
 * 62 KB minified, 7 KB gzipped, of which the module→group map is most of the weight.
 * Everything returned joins straight to `BLUEPRINTS` and `EXPERIMENTAL_EFFECTS`, neither
 * of which this module pulls in. That is why reading a journal `BlueprintName` against a
 * module — `resolveBlueprintForModule`, which needs a menu *and* the recipes to see their
 * journal spellings — lives in `ships/blueprint-journal` rather than here: it would take
 * this module from 63 KB to 285 KB for every consumer who only wanted a menu.
 *
 * **This catalogue is also the gate.** {@link ShipLoadout.applyBlueprint} refuses a recipe
 * this module does not offer for that module, so "what can I put on this?" and "may I put
 * this on it?" cannot answer differently — they read the same menu. A `ShipLoadout`
 * therefore carries this module's weight whether or not the consumer calls it: its import
 * graph is 696 KB, 82 KB gzipped. When this catalogue landed it took that graph from
 * 624 KB to 709 KB, 74 KB to 82 KB gzipped; both ends have shrunk by about 13 KB since,
 * the module records having stopped repeating their category. That is a
 * deliberate trade, taken because the second hand-maintained map of the same fact drifted
 * from this one — §Engineering compatibility in
 * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md)
 * records what it cost. The gate
 * makes three accommodations beyond the menu, in the order it applies them: a journal id
 * the game writes for two different recipes, which `ships/blueprint-journal` settles by
 * reading this menu against `Blueprint.journalName`; an Operations key belonging to a module
 * sold already engineered, which no menu lists — 21 of the 27 Operations keys — and
 * `ships/pre-engineered` resolves per module; and a build that spells a modification
 * generically — `Misc_LightWeight` where the menu lists `LifeSupport_LightWeight`, which
 * {@link getBlueprintsForModule} describes.
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
 * `null` means **"no source gives this module a recipe"**, which for the 169 ungrouped
 * modules is the same as "cannot be engineered" — the families and the individually
 * denied modules listed in the module overview above. It stays worded as the catalogue's
 * answer rather than the game's because that is what it can honestly claim: a module
 * Frontier adds engineering for later reads `null` until a registry says so, and the
 * build corpus already has one such case (the Mk II Plasma Shock Autocannon, denied every
 * blueprint upstream and engineered on both of a community build's large hardpoints).
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
 * are two different recipes rolling different stats, and the utility scanners list the
 * `Scanner_*` ones where the sensor suites list the `Sensor_*` ones. The game writes
 * `Sensor_LongRange` for both all the same, so a journal id has to be read against the
 * module it sits on: `resolveBlueprintForModule` in `ships/blueprint-journal` is that
 * lookup. `MC_Overcharged` is the third of that kind and the one most consumers will meet:
 * the multi-cannon menus list it rather than the `Weapon_Overcharged` every other weapon
 * menu lists, because a multi-cannon's Overcharged also cuts the clip by 3–15% — and the
 * game writes `Weapon_Overcharged` for both.
 *
 * Anti-Guardian Zone Resistance is the other pair, and the reverse case: the game writes
 * `GuardianModule_Sturdy` — on Guardian weapons as well as modules — and every group here
 * lists that id. The registry's `recipe_guardianmodule_sturdy` and
 * `recipe_guardianweapon_sturdy` are accepted as its other spellings.
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
 * Most modules take their whole group's list, but 24 are exceptions: 13 Multi-cannons
 * cannot take Phasing Sequence, six dumbfire racks cannot take Drag Munitions, four
 * missile racks are short of Penetrator Munitions or FSD Interrupt, and the small fixed
 * Abrasion Blaster takes blueprints but no experimental at all. Those are applied here,
 * so the result is the exact set for this module.
 *
 * **An empty array is the common answer, and it usually means "blueprints only".** 388
 * of the 1028 grouped modules have no experimental slot: 387 sit in the 30 of 53 groups
 * that offer none — life support, sensors, the limpet controllers, the utility scanners,
 * and every Guardian group, weapons and modules alike — and the Abrasion Blaster is
 * excluded from its group's only effect. An ungrouped module answers empty too;
 * {@link getEngineeringGroup} tells the two apart: it is `null` only for that one.
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
 * The groups name 86 of the 109 blueprints in `BLUEPRINTS`, and the other 23 are all
 * accounted for: 21 are the Operations keys of modules sold already engineered rather than
 * offered in a menu (see `ships/pre-engineered`), and the other two are the registry's
 * spellings of Anti-Guardian Zone Resistance, which the nine groups offering it list under
 * `GuardianModule_Sturdy` — the id the game itself writes. All 23 answer `[]` here exactly
 * as an unknown id would, so read this function's empty answer with
 * {@link getExperimentalsForModule} rather than as a claim about the recipe.
 *
 * Four Operations keys **are** named by a group, because they are recipes a player applies
 * rather than a purchase: the Merc-Coin blueprints published with a full grade 1–5,
 * `fuelscoop_efficiency` and the three lasers' `*_thermalplasmaconversion`.
 * Anti-Guardian Zone Resistance answers `[]`, and there that is the exact answer rather
 * than a miss: it has no experimental slot, on any of the nine groups that offer it.
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
