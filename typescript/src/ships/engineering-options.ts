/**
 * **Ordinary engineering options** — which blueprints and experimental effects appear
 * in a given stock module's ordinary engineering menu.
 *
 * Availability is a property of the **module**, not of the blueprint. A Pulse Laser
 * accepts the Efficient blueprint and a Rail Gun does not, and the two offer different
 * experimental effects even where their blueprints overlap; asking "what can I put on
 * this module?" is the question the game actually answers. So modules are grouped, and
 * each group lists what it offers.
 *
 * The catalogue groups every stock module with an ordinary engineering menu. The rest
 * have no ordinary menu: whole families (fuel tanks,
 * cargo racks, passenger cabins, the repair, recon, research, decontamination and
 * multi-limpet controllers, meta-alloy and ordinary module reinforcement, the Pulse Wave
 * Analyser, the mining launchers, Shock Cannons, Nanite Torpedo Pylons, fighter and vehicle
 * hangars, docking computers and Supercruise Assist, the module stabilisers, the planetary
 * approach suites, the cargo hatch and the AX utility modules), plus the individual
 * modules denied every ordinary blueprint — every anti-xeno multi-cannon and missile rack,
 * the Enzyme Missile Rack, all seven mining tools, the remote-release launchers and the Mk II
 * Plasma Shock Accelerator. Six module symbols without a menu still have a Mercenary upgrade
 * route: the Enzyme Missile Rack, fixed Mining Laser, fixed Abrasion Blaster, size-5 class-2
 * Module Reinforcement Package, and size-5 and size-6 cargo racks. Their qualifying articles can
 * take grades 2–5 of their bespoke recipes through
 * `ships/pre-engineered`; fixed community-goal cargo racks remain final articles.
 *
 * **A group is one menu.** Where the same kind of module comes in two flavours with
 * different menus, they are two groups: a Guardian Power Plant takes only Anti-Guardian
 * Zone Resistance and an ordinary one takes only the ordinary recipes, so `powerPlants`
 * and `guardianPowerPlants` are separate — likewise the distributors and the hull
 * reinforcement packages. The Guardian half of each pair takes **no experimental effect**:
 * Anti-Guardian Zone Resistance is the whole menu, and it has no experimental slot. The
 * other Guardian module families — FSD boosters, module and shield reinforcement — are the
 * same. There are no pre-engineered Guardian module reward variants. Guardian **weapons**
 * are different: their menus are that one recipe too, but an ordinary weapon recipe on a
 * Guardian weapon identifies a final purchase rather than an engineer roll —
 * `ships/pre-engineered` carries those, and they accept no further engineering.
 *
 * It has its own module and data file so a consumer who only reads menus pays for
 * nothing else.
 * Everything returned joins straight to `BLUEPRINTS` and `EXPERIMENTAL_EFFECTS`, neither
 * of which this module pulls in. That is why reading a journal `BlueprintName` against a
 * module — `resolveBlueprintForModule`, which needs a menu and the small journal-collision
 * catalogue — lives in `ships/blueprint-journal` rather than here.
 *
 * **This catalogue is the ordinary-menu gate.** {@link ShipLoadout.applyBlueprint} refuses
 * a recipe this module does not offer unless one of the three narrow accommodations below
 * resolves it. A `ShipLoadout` therefore carries this module's weight whether or not the
 * consumer calls it. The editor and the menu use one catalogue for ordinary availability,
 * so those answers cannot drift; Mercenary upgrades remain a separate purchase-specific
 * route. The gate makes three accommodations beyond the literal menu ids, in the
 * order it applies them: a journal id
 * the game writes for two different recipes, which `ships/blueprint-journal` settles by
 * reading this menu against the journal-collision catalogue; a bespoke Operations key
 * belonging to a Mercenary module sold at grade 1, whose grades 2–5 no ordinary menu lists, and
 * `ships/pre-engineered` resolves per module; and a build that spells a modification
 * generically — `Misc_LightWeight` where the menu lists `LifeSupport_LightWeight`, which
 * {@link getBlueprintsForModule} describes.
 *
 * @packageDocumentation
 */

import optionsData from '../../../data/ships/engineering-options.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { normalizeKey } from '../internal/registry-index.js';
import { requireStringIfPresent } from '../internal/argument-guards.js';

/**
 * A stable identifier for an engineering-menu family.
 *
 * @remarks
 * These are the keys of {@link ENGINEERING_OPTION_GROUPS}. They are more precise than
 * an outfitting category: a category says which store tab a module appears under, while
 * an engineering-group id identifies the family whose stats and engineering menu it
 * shares. Guardian variants use separate ids when their menus differ.
 *
 * An outfitting module with no ordinary engineering menu carries `engineeringGroup:
 * null`; do not infer a group from its symbol. This explicit absence distinguishes a
 * stock module without a menu from an unknown id.
 *
 * @example
 * ```ts
 * import type { EngineeringGroupId } from '@elite-dangerous-almanac/core/ships/engineering-options';
 *
 * const family: EngineeringGroupId = 'frameShiftDrives';
 * ```
 */
export type EngineeringGroupId =
    | 'powerPlants'
    | 'guardianPowerPlants'
    | 'thrusters'
    | 'frameShiftDrives'
    | 'powerDistributors'
    | 'guardianPowerDistributors'
    | 'frameShiftDrivesSCO'
    | 'shieldGenerators'
    | 'shieldCellBanks'
    | 'hullReinforcements'
    | 'guardianHullReinforcements'
    | 'pulseLasers'
    | 'burstLasers'
    | 'beamLasers'
    | 'cannons'
    | 'fragmentCannons'
    | 'multiCannons'
    | 'plasmaAccelerators'
    | 'railGuns'
    | 'missiles'
    | 'mines'
    | 'torpedoes'
    | 'shieldBoosters'
    | 'bulkheads'
    | 'lifeSupports'
    | 'sensors'
    | 'autoFieldMaintenanceUnits'
    | 'collectionLimpets'
    | 'fsdBoosters'
    | 'fsdInterdictors'
    | 'fuelScoops'
    | 'fuelTransferLimpets'
    | 'hatchBreakerLimpets'
    | 'moduleReinforcements'
    | 'prospectingLimpets'
    | 'refineries'
    | 'shieldReinforcements'
    | 'surfaceScanners'
    | 'chaffLaunchers'
    | 'ecms'
    | 'heatSinkLaunchers'
    | 'killWarrantScanners'
    | 'manifestScanners'
    | 'pointDefence'
    | 'wakeScanners'
    | 'guardianGauss'
    | 'guardianPlasma'
    | 'guardianShard';

/**
 * What one group of modules can be engineered with.
 *
 * @remarks
 * A group carries no display name, because the game has no engineering-group label to
 * carry: an engineering menu is headed by the module's own outfitting family. Name a
 * group by naming that family — `getOutfittingFamilyName(module.familyId, locale)` in
 * `i18n/module-families`.
 */
export interface EngineeringOptionGroup {
    /** Blueprint ids the group accepts. Join to `BLUEPRINTS`. */
    readonly blueprints: readonly string[];
    /** Experimental-effect ids the group accepts. Join to `EXPERIMENTAL_EFFECTS`. */
    readonly experimentals: readonly string[];
}

interface EngineeringOptionData {
    readonly groups: Readonly<Record<EngineeringGroupId, EngineeringOptionGroup>>;
    readonly modules: Readonly<Record<string, EngineeringGroupId>>;
    readonly exclusions: Readonly<Record<string, readonly string[]>>;
}

const DATA: EngineeringOptionData = deepFreeze(optionsData as EngineeringOptionData);

/**
 * Every module group that can be engineered, keyed by a stable group id
 * (e.g. `"beamLasers"`, `"powerDistributors"`).
 *
 * @example
 * ```ts
 * import { ENGINEERING_OPTION_GROUPS } from '@elite-dangerous-almanac/core/ships/engineering-options';
 *
 * ENGINEERING_OPTION_GROUPS['beamLasers'].blueprints.includes('Weapon_Efficient'); // -> true
 * ```
 */
export const ENGINEERING_OPTION_GROUPS: Readonly<
    Record<EngineeringGroupId, EngineeringOptionGroup>
> = DATA.groups;

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
 * `null` means **"this stock module has no ordinary engineering menu"**. For nearly every
 * ungrouped module that is the same as "has no engineering route". Six instead
 * retain Mercenary upgrade routes: the Enzyme Missile Rack, fixed Mining Laser and Abrasion
 * Blaster, size-5 and size-6 cargo racks, and size-5 class-2 Module Reinforcement Package
 * have no stock menu while their qualifying Mercenary articles retain bespoke upgrade routes.
 * The build corpus also contains an unsupported declaration on the Mk II Plasma Shock
 * Accelerator, which upstream denies every blueprint.
 *
 * @param symbol - A module symbol, e.g. `"Hpt_BeamLaser_Fixed_Small"`.
 * Leading/trailing whitespace and case are ignored.
 * @returns The group id, or `null` when the module is not in the catalogue.
 *
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getEngineeringGroup } from '@elite-dangerous-almanac/core/ships/engineering-options';
 *
 * getEngineeringGroup('Hpt_BeamLaser_Fixed_Small'); // -> 'beamLasers'
 * getEngineeringGroup('Int_CargoRack_Size2_Class1'); // -> null
 *
 * // Not listed — no registry gives a fuel tank a blueprint.
 * getEngineeringGroup('Int_FuelTank_Size3_Class3'); // -> null
 * ```
 */
export function getEngineeringGroup(symbol: string): EngineeringGroupId | null {
    return moduleGroup.get(normalizeKey(symbol, 'getEngineeringGroup: symbol')) ?? null;
}

/**
 * Every blueprint in a stock module's ordinary engineering menu.
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
 * the ordinary multi-cannon menu lists it rather than the
 * `Weapon_Overcharged` every other weapon menu lists, because a multi-cannon's Overcharged
 * also cuts the clip by 3–15% — and the game writes `Weapon_Overcharged` for both.
 *
 * Anti-Guardian Zone Resistance is neither: the game writes `GuardianModule_Sturdy` — on
 * Guardian weapons as well as modules — every group here lists that id, and `BLUEPRINTS`
 * keys the recipe under it alone.
 *
 * @param symbol - A module symbol. Leading/trailing whitespace and case are ignored.
 * @returns Blueprint ids, sorted. Join to `BLUEPRINTS`.
 *
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getBlueprintsForModule } from '@elite-dangerous-almanac/core/ships/engineering-options';
 *
 * getBlueprintsForModule('Hpt_BeamLaser_Fixed_Small');
 * // -> ['BeamLaser_ThermalPlasmaConversion', 'Weapon_Efficient', 'Weapon_LightWeight', ...]
 *
 * getBlueprintsForModule('Int_LifeSupport_Size4_Class2');
 * // -> ['LifeSupport_LightWeight', 'LifeSupport_Reinforced', 'LifeSupport_Shielded']
 * ```
 */
export function getBlueprintsForModule(symbol: string): readonly string[] {
    requireStringIfPresent(symbol, 'getBlueprintsForModule: symbol');
    const group = getEngineeringGroup(symbol);
    return group === null ? [] : ENGINEERING_OPTION_GROUPS[group]!.blueprints;
}

/**
 * Every experimental effect in a stock module's ordinary menu — its group's list, minus
 * the effects that particular module is excluded from.
 *
 * Most modules take their whole group's list, but some are exceptions: most Multi-cannons
 * cannot take Phasing Sequence, dumbfire racks cannot take Drag Munitions, and some
 * missile racks are short of Penetrator Munitions or FSD Interrupt. Those are applied
 * here, so the result is the exact set for this module.
 *
 * **An empty array is the common answer, and it usually means "blueprints only".** Whole
 * groups offer no experimental effect at all — life support, sensors, the limpet
 * controllers, the utility scanners, and every Guardian group, weapons and modules alike
 * — so every module in them answers empty. An ungrouped module answers empty
 * too; {@link getEngineeringGroup} tells the two apart.
 *
 * @param symbol - A module symbol. Leading/trailing whitespace and case are ignored.
 * @returns Experimental-effect ids. Join to `EXPERIMENTAL_EFFECTS`.
 *
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getExperimentalsForModule } from '@elite-dangerous-almanac/core/ships/engineering-options';
 *
 * getExperimentalsForModule('Hpt_MultiCannon_Fixed_Medium').includes('special_phasing_sequence'); // -> true
 *
 * // The small Multi-cannon is one effect short — no Phasing Sequence.
 * getExperimentalsForModule('Hpt_MultiCannon_Fixed_Small').includes('special_phasing_sequence'); // -> false
 *
 * // The stock Abrasion Blaster has no ordinary engineering menu.
 * getExperimentalsForModule('Hpt_Mining_AbrBlstr_Fixed_Small'); // -> []
 * ```
 */
export function getExperimentalsForModule(symbol: string): readonly string[] {
    const normalized = normalizeKey(symbol, 'getExperimentalsForModule: symbol');
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
 * The groups do not name every id in `BLUEPRINTS`. The ones they miss are Operations keys
 * of modules sold already engineered rather than offered in a menu (see
 * `ships/pre-engineered`), plus the fixed Expanded Cargo Rack reward identity.
 * They answer `[]` here exactly as an unknown id would, so read this function's empty answer with
 * {@link getExperimentalsForModule} rather than as a claim about the recipe.
 *
 * Four Operations keys **are** named by a group, because they are recipes a player applies
 * rather than a purchase: the Merc-Coin blueprints published with a full grade 1–5,
 * `FuelScoop_Efficiency` and the three lasers' `PulseLaser_ThermalPlasmaConversion`,
 * `BurstLaser_ThermalPlasmaConversion` and
 * `BeamLaser_ThermalPlasmaConversion`. Anti-Guardian Zone Resistance answers `[]`, and there
 * that is the exact answer rather
 * than a miss: it has no experimental slot, on any group that offers it.
 *
 * @param blueprintSymbol - A blueprint recipe's Frontier symbol, e.g. `"Weapon_Efficient"`.
 * Leading/trailing whitespace and case are ignored.
 * @returns Experimental-effect ids, sorted and de-duplicated; empty when no group names
 * the blueprint, or when its groups take no experimental.
 *
 * @throws {TypeError} If `blueprintSymbol` is present and not a string. A nullish
 * `blueprintSymbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getExperimentalsForBlueprint } from '@elite-dangerous-almanac/core/ships/engineering-options';
 *
 * getExperimentalsForBlueprint('FSD_LongRange');
 * // -> ['special_fsd_cooled', 'special_fsd_fuelcapacity', 'special_fsd_heavy', ...]
 * ```
 */
export function getExperimentalsForBlueprint(blueprintSymbol: string): readonly string[] {
    const normalized = normalizeKey(
        blueprintSymbol,
        'getExperimentalsForBlueprint: blueprintSymbol',
    );
    const out = new Set<string>();
    for (const group of Object.values(ENGINEERING_OPTION_GROUPS)) {
        if (!group.blueprints.some((b) => b.toLowerCase() === normalized)) continue;
        for (const effect of group.experimentals) out.add(effect);
    }
    return [...out].sort();
}
