/**
 * Internal compatibility rules connecting engineering ids to module families.
 *
 * Frontier's blueprint and experimental ids encode their target family, but the
 * numeric catalogues intentionally contain only modifier data. Keeping the mapping
 * here lets {@link ShipLoadout} reject impossible combinations without adding
 * TypeScript-specific metadata to the shared JSON payloads.
 *
 * @internal
 */

/** The module families distinguished by Elite Dangerous engineering. @internal */
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

/** Resolve a known blueprint id to the families it can engineer. @internal */
export function blueprintTargets(fdname: string): readonly EngineeringTarget[] | null {
    const normalized = fdname.trim().toLowerCase();
    if (normalized === 'misc_chaffcapacity') return ['chaff'];
    if (normalized === 'misc_heatsinkcapacity') return ['heatSink'];
    if (normalized === 'misc_pointdefensecapacity') return ['pointDefence'];
    if (
        normalized === 'misc_lightweight' ||
        normalized === 'misc_reinforced' ||
        normalized === 'misc_shielded'
    ) {
        return ['miscellaneous', 'chaff', 'heatSink', 'pointDefence'];
    }
    if (normalized === 'sensor_expanded') return ['detailedSurfaceScanner'];
    if (normalized === 'sensor_fastscan') return ['scanner'];
    if (normalized.startsWith('sensor_')) return ['sensors'];
    const target = prefixTarget(normalized, BLUEPRINT_TARGETS);
    return target === null ? null : [target];
}

const WEAPON_EXPERIMENTALS = new Set([
    'special_concordant_sequence',
    'special_emissive_munitions',
    'special_feedback_cascade_cooled',
    'special_incendiary_rounds',
    'special_plasma_slug_cooled',
    'special_super_penetrator_cooled',
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
 * The fallback is `miscellaneous`: these are modules such as ECMs and the limpet
 * controllers without their own specialised blueprint family.
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
    if (symbol.startsWith('int_dronecontrol_hatchbreaker')) return 'hatchBreakerLimpet';
    if (symbol.startsWith('hpt_heatsinklauncher')) return 'heatSink';
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
    if (symbol.includes('scanner')) return 'scanner';
    if (symbol.startsWith('int_sensors')) return 'sensors';
    if (symbol.startsWith('hpt_shieldbooster')) return 'shieldBooster';
    if (symbol.startsWith('int_shieldcellbank')) return 'shieldCellBank';
    if (symbol.startsWith('int_shieldgenerator')) return 'shieldGenerator';
    if (symbol.startsWith('int_engine') || symbol.startsWith('int_mkiiagileboost')) {
        return 'thrusters';
    }
    if (
        symbol.startsWith('hpt_electroniccountermeasure') ||
        symbol.startsWith('hpt_antiunknownshutdown') ||
        symbol.startsWith('hpt_causticsinklauncher')
    ) {
        return 'miscellaneous';
    }
    if (symbol.startsWith('hpt_')) return 'weapon';
    return 'miscellaneous';
}
