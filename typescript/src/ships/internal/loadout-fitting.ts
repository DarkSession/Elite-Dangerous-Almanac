/** Module-to-mount compatibility rules for {@link ShipLoadout}. @internal */

import type { OutfittingModule } from '../modules.js';
import { getShipBySymbol } from '../ships.js';
import { SLOT_RESTRICTION_LABELS, type BuildSlot, type SlotRestriction } from '../slots.js';
import { truncate } from '../../internal/argument-guards.js';

/** Optional-internal groups a military slot accepts (symbol prefixes). */
const MILITARY_PREFIXES: readonly string[] = [
    'int_hullreinforcement',
    'int_metaalloyhullreinforcement',
    'int_modulereinforcement',
    'int_shieldcellbank',
    'int_guardianhullreinforcement',
    'int_guardianmodulereinforcement',
    'int_guardianshieldreinforcement',
];

/**
 * Weapon groups a mining hardpoint accepts.
 *
 * The Sub-Surface Extraction Missile is included because both source registries file
 * it with the displacement missile it is a variant of, despite its unrelated symbol.
 * The Pulse Wave Analyser is excluded because it is a utility fitting.
 */
const MINING_PREFIXES: readonly string[] = [
    'hpt_mininglaser', // Mining Laser, Mining Lance
    'hpt_mining_abrblstr', // Abrasion Blaster
    'hpt_mining_seismchrgwarhd', // Seismic Charge Launcher
    'hpt_mining_subsurfdispmisle', // Sub-Surface Displacement Missile
    'hpt_human_extraction', // Sub-Surface Extraction Missile
    'hpt_miningtoolv2', // Mining Volley Repeater
];

/**
 * Optional-internal groups a dedicated cargo slot accepts. A fuel tank counts here,
 * as it does in an unrestricted optional slot.
 */
const CARGO_PREFIXES: readonly string[] = [
    'int_cargorack',
    'int_largecargorack',
    'int_corrosionproofcargorack',
    'int_fueltank',
];

/**
 * The module symbol families accepted by each restricted mount.
 *
 * This is the mount's half of compatibility. A module reserved for one mount carries
 * its own `restrictedToSlot`, checked separately below. Labels come from the public
 * slot model so application menus and refusal messages cannot drift apart.
 */
const RESTRICTED_SLOT_PREFIXES: Record<SlotRestriction, readonly string[]> = {
    mining: MINING_PREFIXES,
    military: MILITARY_PREFIXES,
    cargo: CARGO_PREFIXES,
    // Single- and multi-limpet controllers are separate symbol families.
    limpetController: ['int_dronecontrol', 'int_multidronecontrol'],
    // One family covers both the Mk I and Mk II vessel bays.
    vesselHangar: ['int_fighterbay'],
    // Mk II cabins are a separate family, not PassengerCabin variants.
    passenger: ['int_passengercabin', 'int_mkii_passengercabin'],
    // Both ordinary and advanced suites share this prefix and reserve this mount.
    planetaryApproachSuite: ['int_planetapproachsuite'],
};

function restrictionError(slot: BuildSlot, symbol: string): string | null {
    const restriction = slot.restriction;
    if (!restriction) return null;
    if (RESTRICTED_SLOT_PREFIXES[restriction].some((prefix) => symbol.startsWith(prefix))) {
        return null;
    }
    return `slot only takes ${SLOT_RESTRICTION_LABELS[restriction]}`;
}

function moduleSlotError(slot: BuildSlot, module: OutfittingModule): string | null {
    const required = module.restrictedToSlot;
    if (!required || slot.restriction === required) return null;
    return `module only fits a mount that takes ${SLOT_RESTRICTION_LABELS[required]}`;
}

/**
 * Explain why `module` cannot fit `slot`, or return `null` when it fits.
 *
 * The checks intentionally proceed from fixed hull constraints to module-specific
 * mount constraints, slot kind and finally size so callers receive the most specific
 * useful failure.
 */
export function moduleFitError(
    shipSymbol: string,
    slot: BuildSlot,
    module: OutfittingModule,
): string | null {
    if (slot.kind === 'cargoHatch') {
        return 'the cargoHatch slot cannot be changed';
    }
    if (slot.kind === 'armour') {
        const hull = getShipBySymbol(shipSymbol);
        if (module.slot !== 'armour' || module.ship === undefined) {
            return 'not a ship armour module';
        }
        if (!hull || module.ship.toLowerCase() !== hull.name.toLowerCase()) {
            return `armour belongs to ${truncate(module.ship)}, not ${truncate(hull?.name ?? shipSymbol)}`;
        }
        return null;
    }

    // `ship` is unreliable for restricted modules (some carry a "None" sentinel), so
    // use the normalized restriction list and retain symbols in the error for journal
    // searches.
    const restricted = module.restrictedToShips;
    if (
        restricted &&
        !restricted.some((symbol) => symbol.toLowerCase() === shipSymbol.toLowerCase())
    ) {
        const hulls = restricted.map((symbol) => {
            const hull = getShipBySymbol(symbol);
            return hull ? `${hull.name} (${symbol})` : symbol;
        });
        return `module is restricted to ${truncate(hulls.join(', '))}`;
    }

    // Check the article's reserved mount before general kind rules: this remains true
    // even when the mount offered by the caller is otherwise unrestricted.
    const wrongMount = moduleSlotError(slot, module);
    if (wrongMount) return wrongMount;
    const symbol = module.symbol.toLowerCase();
    // The normalized slot field handles Guardian core modules filed as `internal` and
    // hull-specific modules whose symbols share no family prefix.
    const moduleSlot = module.slot;

    switch (slot.kind) {
        case 'core':
            if (moduleSlot !== slot.core) return `not a ${slot.core} module`;
            break;
        case 'hardpoint': {
            if (module.category !== 'hardpoint') return 'not a hardpoint weapon';
            const problem = restrictionError(slot, symbol);
            if (problem) return problem;
            break;
        }
        case 'utility':
            if (module.category !== 'utility') return 'not a utility module';
            return null;
        case 'optional': {
            const isFuelTank = moduleSlot === 'fuelTank';
            if (module.category !== 'internal' && !isFuelTank) {
                return 'not an optional-internal module';
            }
            if (moduleSlot && !isFuelTank) return 'a core module only fits its core slot';
            const problem = restrictionError(slot, symbol);
            if (problem) return problem;
            break;
        }
    }

    return module.class > slot.size
        ? `module size ${truncate(module.class)} exceeds slot size ${slot.size}`
        : null;
}
