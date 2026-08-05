/**
 * Internal compatibility rules connecting engineering ids to module families.
 *
 * Frontier's blueprint and experimental ids encode their target family, but the
 * numeric catalogues intentionally contain only modifier data. Keeping the mapping
 * here lets {@link ShipLoadout} reject impossible combinations without adding
 * TypeScript-specific metadata to the shared JSON payloads.
 *
 * A blueprint id names one family only when the game offers that recipe to one family.
 * Several do not: the generic `Misc_LightWeight` / `Misc_Reinforced` / `Misc_Shielded`
 * recipes are shared across every support family that takes them, and Long Range and Wide
 * Angle are shared by the sensor suite and the utility scanners. Those ids resolve to a
 * *list* of families, so a build authored anywhere is accepted — see
 * {@link GENERIC_MISC_TARGETS} and `data/ships/SOURCES.md` (§Engineering compatibility).
 *
 * @remarks
 * Which family offers which recipe is read from the module-group tables of
 * {@link https://github.com/taleden/EDSY | EDSY} (`eddb.js`, taleden, CC BY-NC 4.0),
 * cross-checked against {@link https://github.com/EDCD/coriolis-data | EDCD/coriolis-data}
 * (`modifications/modules.json`, commit `0db9234`, code MIT). The underlying game logic is
 * Elite Dangerous data, property of Frontier Developments plc. Full provenance in
 * `data/ships/SOURCES.md`; the canonical credit list is `ATTRIBUTIONS.md`.
 *
 * @internal
 */

/**
 * The module families distinguished by Elite Dangerous engineering.
 *
 * `unengineerable` is not a family: it marks the modules the game offers no blueprint on
 * at all, so no blueprint id ever resolves to it. See {@link moduleEngineeringTarget}.
 *
 * @internal
 */
export type EngineeringTarget =
    | 'afmu'
    | 'armour'
    | 'cargoRack'
    | 'chaff'
    | 'collectionLimpet'
    | 'detailedSurfaceScanner'
    | 'frameShiftDrive'
    | 'frameShiftDriveInterdictor'
    | 'fuelScoop'
    | 'fuelTransferLimpet'
    | 'hatchBreakerLimpet'
    | 'heatSink'
    | 'hullReinforcement'
    | 'lifeSupport'
    | 'miscellaneous'
    | 'moduleReinforcement'
    | 'pointDefence'
    | 'powerDistributor'
    | 'powerPlant'
    | 'prospectorLimpet'
    | 'refinery'
    | 'scanner'
    | 'sensors'
    | 'shieldBooster'
    | 'shieldCellBank'
    | 'shieldGenerator'
    | 'thrusters'
    | 'unengineerable'
    | 'weapon';

const prefixTarget = (
    value: string,
    rules: readonly (readonly [string, EngineeringTarget])[],
): EngineeringTarget | null => {
    const normalized = value.trim().toLowerCase();
    for (const [prefix, target] of rules) {
        if (normalized.startsWith(prefix)) return target;
    }
    return null;
};

/**
 * The families that offer the generic **Lightweight** and **Reinforced** recipes.
 *
 * Frontier keys one modification under several ids: a family-prefixed one
 * (`LifeSupport_LightWeight`, `CollectionLimpet_LightWeight`, …) and the generic
 * `Misc_LightWeight`, whose grades are identical to them in `blueprints.jsonc`. Which id
 * a build carries depends on where it was authored — EDSY writes `Misc_LightWeight` for
 * every family below, coriolis-data the family-prefixed one — so both spellings have to
 * resolve to the same set.
 *
 * The set is EDSY's own module-group table (`eddb.js`, the `misc_lw` / `misc_rf` group
 * lists): chaff launchers, ECMs, heat sink launchers, point defence, the KWS/manifest/wake
 * scanners, life support and the four limpet controllers. `miscellaneous` is the fallback
 * bucket, so it stays.
 *
 * Two kinds of family are deliberately absent. Sensors, weapons, hull armour and hull
 * reinforcement each have a Lightweight of their own that is a **different recipe** —
 * `Sensor_LightWeight` carries a scan-angle leg, `Weapon_LightWeight` a distributor-draw
 * one, `Armour_Advanced` trades hull boost for resistances and
 * `HullReinforcement_Advanced` reinforcement for mass — so the generic id must not reach
 * them. AFMUs, fuel scoops and refineries
 * are absent for the other reason: the game offers them Shielded and nothing else, which
 * is why they are in {@link GENERIC_SHIELDED_TARGETS} and not here.
 *
 * @internal
 */
const GENERIC_MISC_TARGETS: readonly EngineeringTarget[] = [
    'miscellaneous',
    'chaff',
    'collectionLimpet',
    'fuelTransferLimpet',
    'hatchBreakerLimpet',
    'heatSink',
    'lifeSupport',
    'pointDefence',
    'prospectorLimpet',
    'scanner',
];

/**
 * The families that offer the generic **Shielded** recipe: {@link GENERIC_MISC_TARGETS}
 * plus the three the game gives Shielded and nothing else — AFMUs, fuel scoops and
 * refineries, which also carry the family-prefixed `AFM_Shielded`, `FuelScoop_Shielded`
 * and `Refineries_Shielded`.
 *
 * @internal
 */
const GENERIC_SHIELDED_TARGETS: readonly EngineeringTarget[] = [
    ...GENERIC_MISC_TARGETS,
    'afmu',
    'fuelScoop',
    'refinery',
];

const BLUEPRINT_TARGETS: readonly (readonly [string, EngineeringTarget])[] = [
    ['afm_', 'afmu'],
    ['armour_', 'armour'],
    ['cargorack_', 'cargoRack'],
    ['collectionlimpet_', 'collectionLimpet'],
    ['engine_', 'thrusters'],
    ['fsdinterdictor_', 'frameShiftDriveInterdictor'],
    ['fsd_', 'frameShiftDrive'],
    ['fuelscoop_', 'fuelScoop'],
    ['fueltransferlimpet_', 'fuelTransferLimpet'],
    ['hatchbreakerlimpet_', 'hatchBreakerLimpet'],
    ['hullreinforcement_', 'hullReinforcement'],
    ['lifesupport_', 'lifeSupport'],
    ['powerdistributor_', 'powerDistributor'],
    ['powerplant_', 'powerPlant'],
    ['prospectinglimpet_', 'prospectorLimpet'],
    ['refineries_', 'refinery'],
    ['scanner_', 'scanner'],
    ['shieldbooster_', 'shieldBooster'],
    ['shieldcellbank_', 'shieldCellBank'],
    ['shieldgenerator_', 'shieldGenerator'],
    ['weapon_', 'weapon'],
    ['mc_', 'weapon'],
];

// The Operations pre-engineered blueprints use Frontier's compiled `recipe_*` keys,
// which do not carry the family prefixes the journal `BlueprintName`s do — map them
// explicitly. The Anti-Guardian `recipe_guardianmodule_sturdy` applies across several
// families (Guardian weapons, FSD booster, hull/module reinforcement, distributor,
// power plant).
const RECIPE_TARGETS: ReadonlyMap<string, readonly EngineeringTarget[]> = new Map([
    ['recipe_fuelscoop_efficiency', ['fuelScoop']],
    ['recipe_beamlaser_thermalplasmaconversion', ['weapon']],
    ['recipe_burstlaser_thermalplasmaconversion', ['weapon']],
    ['recipe_pulselaser_thermalplasmaconversion', ['weapon']],
    ['recipe_detailedsurfacescanner_longrange', ['detailedSurfaceScanner']],
    ['recipe_cargoracks5c1_extended', ['cargoRack']],
    ['recipe_cargoracks6c1_extended', ['cargoRack']],
    ['recipe_modulereinforcement_heavyduty', ['moduleReinforcement']],
    ['recipe_powerdistributor_balanced', ['powerDistributor']],
    ['recipe_powerdistributors3c2_supportfocused', ['powerDistributor']],
    ['recipe_powerdistributors3c5_supportfocused', ['powerDistributor']],
    ['recipe_powerdistributors4c2_supportfocused', ['powerDistributor']],
    ['recipe_powerdistributors4c5_supportfocused', ['powerDistributor']],
    ['recipe_powerdistributors6c5_supportfocused', ['powerDistributor']],
    ['recipe_abrasionblaster_farreaching', ['weapon']],
    ['recipe_fragmentcannonsmall_doublescreaming', ['weapon']],
    ['recipe_fragmentcannonlarge_doublescreaming', ['weapon']],
    ['recipe_railgun_longshot', ['weapon']],
    ['recipe_mininglaser_longrange', ['weapon']],
    ['recipe_multicannon_rapid', ['weapon']],
    ['recipe_seekermissilerack_drag', ['weapon']],
    ['recipe_seekermissilerack_lightweightthermal', ['weapon']],
    ['recipe_seekermissilerackmedium_lockdown', ['weapon']],
    ['recipe_seekermissileracklarge_lockdown', ['weapon']],
    ['recipe_enzymemissilerack_highyield', ['weapon']],
    [
        'recipe_guardianmodule_sturdy',
        [
            'weapon',
            'frameShiftDrive',
            'hullReinforcement',
            'moduleReinforcement',
            'powerDistributor',
            'powerPlant',
        ],
    ],
    // Anti-Guardian Zone Resistance is keyed twice — once for modules, once for weapons —
    // with an identical grade-1 effect and recipe. See data/ships/SOURCES.md.
    ['recipe_guardianweapon_sturdy', ['weapon']],
]);

/** Resolve a known blueprint id to the families it can engineer. @internal */
export function blueprintTargets(fdname: string): readonly EngineeringTarget[] | null {
    const normalized = fdname.trim().toLowerCase();
    const recipe = RECIPE_TARGETS.get(normalized);
    if (recipe) return recipe;
    if (normalized === 'misc_chaffcapacity') return ['chaff'];
    if (normalized === 'misc_heatsinkcapacity') return ['heatSink'];
    if (normalized === 'misc_pointdefensecapacity') return ['pointDefence'];
    if (normalized === 'misc_lightweight' || normalized === 'misc_reinforced') {
        return GENERIC_MISC_TARGETS;
    }
    if (normalized === 'misc_shielded') return GENERIC_SHIELDED_TARGETS;
    if (normalized === 'sensor_expanded') return ['detailedSurfaceScanner'];
    if (normalized === 'sensor_fastscan') return ['scanner'];
    // Long Range and Wide Angle are offered on both the internal sensor suite and the
    // utility scanners, and the game writes one `BlueprintName` for both. The two groups
    // roll different numbers — the sensors' Long Range costs mass, the scanners' costs
    // power draw — which is why coriolis-data splits the scanner side out under
    // `Scanner_LongRange` / `Scanner_WideAngle` while EDSY keeps a single `Sensor_*`
    // fdname. The corpus carries both spellings on the same Frame Shift Wake Scanner, so
    // both are accepted; the numbers then applied are the ones stored under the id named,
    // which is the wrong set for a scanner given a `Sensor_*` id. That is unreachable
    // today — a utility scanner carries no `ScannerRange` base stat, so the call fails the
    // missing-base check first — and is tracked, together with the ordering against that
    // gap, at https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/32.
    if (normalized === 'sensor_longrange' || normalized === 'sensor_wideangle') {
        return ['sensors', 'scanner'];
    }
    if (normalized.startsWith('sensor_')) return ['sensors'];
    const target = prefixTarget(normalized, BLUEPRINT_TARGETS);
    return target === null ? null : [target];
}

const WEAPON_EXPERIMENTALS = new Set([
    'special_concordant_sequence',
    'special_emissive_munitions',
    'special_feedback_cascade',
    'special_feedback_cascade_cooled',
    'special_incendiary_rounds',
    'special_plasma_slug_cooled',
    'special_super_penetrator_cooled',
    // The weapon-combat effects re-added for completeness. All target weapons; listing
    // them explicitly also overrides the `special_fsd_` prefix rule for FSD Interrupt
    // (a munition, not a drive effect).
    'special_auto_loader',
    'special_corrosive_shell',
    'special_blinding_shell',
    'special_dispersal_field',
    'special_drag_munitions',
    'special_force_shell',
    'special_fsd_interrupt',
    'special_high_yield_shell',
    'special_distortion_field',
    'special_choke_canister',
    'special_mass_lock',
    'special_overload_munitions',
    'special_penetrator_munitions',
    'special_deep_cut_payload',
    'special_phasing_sequence',
    'special_plasma_slug',
    'special_radiant_canister',
    'special_regeneration_sequence',
    'special_reverberating_cascade',
    'special_scramble_spectrum',
    'special_screening_shell',
    'special_shiftlock_canister',
    'special_smart_rounds',
    'special_super_penetrator',
    'special_lock_breaker',
    'special_thermal_cascade',
    'special_thermal_conduit',
    'special_thermalshock',
    'special_thermal_vent',
]);

const EXPERIMENTAL_TARGETS: readonly (readonly [string, EngineeringTarget])[] = [
    ['special_weapon_', 'weapon'],
    ['special_shieldbooster_', 'shieldBooster'],
    ['special_armour_', 'armour'],
    ['special_powerplant_', 'powerPlant'],
    ['special_engine_', 'thrusters'],
    ['special_fsd_', 'frameShiftDrive'],
    ['special_powerdistributor_', 'powerDistributor'],
    ['special_hullreinforcement_', 'hullReinforcement'],
    ['special_shieldcell_', 'shieldCellBank'],
    ['special_shield_', 'shieldGenerator'],
];

/** Resolve a known experimental-effect id to the family it can engineer. @internal */
export function experimentalTarget(fdname: string): EngineeringTarget | null {
    const normalized = fdname.trim().toLowerCase();
    if (WEAPON_EXPERIMENTALS.has(normalized)) return 'weapon';
    return prefixTarget(normalized, EXPERIMENTAL_TARGETS);
}

/**
 * Classify a module symbol into the engineering family whose recipes it accepts.
 *
 * The fallback is `miscellaneous`: these are modules such as ECMs, the Shutdown Field
 * Neutraliser and the limpet controllers without their own specialised blueprint family
 * (repair, recon, decontamination, research and the multi-limpet controllers). Because it
 * is the fallback it is also where modules the game does not engineer at all land — fuel
 * tanks, passenger cabins, docking computers — and they accept the generic `Misc_*`
 * recipes as a result, which
 * {@link https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/31 | issue #31}
 * tracks. `unengineerable` is the opposite answer, returned only where a source says
 * outright that the module takes nothing.
 *
 * @internal
 */
export function moduleEngineeringTarget(moduleSymbol: string): EngineeringTarget {
    const symbol = moduleSymbol.toLowerCase();
    if (symbol.includes('_armour_')) return 'armour';
    if (symbol.startsWith('int_repairer')) return 'afmu';
    if (symbol.includes('cargorack')) return 'cargoRack';
    if (symbol.startsWith('hpt_chafflauncher')) return 'chaff';
    if (symbol.startsWith('int_dronecontrol_collection')) return 'collectionLimpet';
    if (symbol.startsWith('int_detailedsurfacescanner')) return 'detailedSurfaceScanner';
    if (symbol.startsWith('int_hyperdrive')) return 'frameShiftDrive';
    if (symbol.startsWith('int_fsdinterdictor')) return 'frameShiftDriveInterdictor';
    if (symbol.startsWith('int_fuelscoop')) return 'fuelScoop';
    if (symbol.startsWith('int_dronecontrol_fueltransfer')) return 'fuelTransferLimpet';
    // The Hatch Breaker Limpet Controller's symbol is `Int_DroneControl_ResourceSiphon`;
    // nothing in the catalogue is named `hatchbreaker`, so matching on the family's
    // display name alone left the whole family unreachable.
    if (symbol.startsWith('int_dronecontrol_resourcesiphon')) return 'hatchBreakerLimpet';
    // The Caustic Sink Launcher is a heat sink launcher: both upstreams group it with
    // `Hpt_HeatSinkLauncher_Turret_Tiny` and give it the same recipes, ammo capacity
    // (`Misc_HeatSinkCapacity`) included.
    if (symbol.startsWith('hpt_heatsinklauncher') || symbol.startsWith('hpt_causticsinklauncher')) {
        return 'heatSink';
    }
    if (symbol.includes('modulereinforcement')) return 'moduleReinforcement';
    if (symbol.includes('hullreinforcement')) return 'hullReinforcement';
    if (symbol.startsWith('int_lifesupport')) return 'lifeSupport';
    if (symbol.includes('pointdefence')) return 'pointDefence';
    if (
        symbol.startsWith('int_powerdistributor') ||
        symbol.startsWith('int_guardianpowerdistributor')
    ) {
        return 'powerDistributor';
    }
    if (symbol.startsWith('int_powerplant') || symbol.startsWith('int_guardianpowerplant')) {
        return 'powerPlant';
    }
    if (symbol.startsWith('int_dronecontrol_prospector')) return 'prospectorLimpet';
    if (symbol.startsWith('int_refinery')) return 'refinery';
    // `scanner` is the three utility scanners the game engineers — kill warrant, manifest
    // and frame shift wake — and only those. Every other module with "scanner" in its
    // symbol takes no blueprint at all: the Pulse Wave Analyser (`Hpt_MRAScanner`), the
    // Xeno Scanners and the three removed Discovery Scanner tiers are absent from both
    // upstreams' blueprint tables, so a recipe on one is a mistake to refuse rather than a
    // family to widen. An unrecognised scanner joins them: refusing is the visible failure.
    if (
        symbol.startsWith('hpt_crimescanner') ||
        symbol.startsWith('hpt_cargoscanner') ||
        symbol.startsWith('hpt_cloudscanner')
    ) {
        return 'scanner';
    }
    if (symbol.includes('scanner')) return 'unengineerable';
    if (symbol.startsWith('int_sensors')) return 'sensors';
    if (symbol.startsWith('hpt_shieldbooster')) return 'shieldBooster';
    if (symbol.startsWith('int_shieldcellbank')) return 'shieldCellBank';
    if (symbol.startsWith('int_shieldgenerator')) return 'shieldGenerator';
    if (symbol.startsWith('int_engine') || symbol.startsWith('int_mkiiagileboost')) {
        return 'thrusters';
    }
    if (
        symbol.startsWith('hpt_electroniccountermeasure') ||
        symbol.startsWith('hpt_antiunknownshutdown')
    ) {
        return 'miscellaneous';
    }
    if (symbol.startsWith('hpt_')) return 'weapon';
    return 'miscellaneous';
}
