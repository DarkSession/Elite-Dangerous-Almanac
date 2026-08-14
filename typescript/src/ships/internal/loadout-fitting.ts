/** Module-to-mount compatibility rules for {@link ShipLoadout}. @internal */

import type { OutfittingModule } from '../modules.js';
import { getShipByName, getShipBySymbol } from '../ships.js';
import { SLOT_RESTRICTION_LABELS, type BuildSlot, type SlotRestriction } from '../slots.js';
import { truncate } from '../../internal/argument-guards.js';
import type { LoadoutIssueParams, ModuleFitConstraint } from '../loadout-validation.js';

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

/** A fitting failure's stable code and English fallback. */
export interface ModuleFitProblem {
    readonly constraint: ModuleFitConstraint;
    readonly message: string;
    readonly params?: LoadoutIssueParams;
}

const problem = (
    constraint: ModuleFitConstraint,
    message: string,
    params?: LoadoutIssueParams,
): ModuleFitProblem => ({ constraint, message, ...(params === undefined ? {} : { params }) });

function restrictionProblem(slot: BuildSlot, symbol: string): ModuleFitProblem | null {
    const restriction = slot.restriction;
    if (!restriction) return null;
    if (RESTRICTED_SLOT_PREFIXES[restriction].some((prefix) => symbol.startsWith(prefix))) {
        return null;
    }
    return problem('restrictedMount', `slot only takes ${SLOT_RESTRICTION_LABELS[restriction]}`, {
        restriction,
    });
}

function moduleSlotProblem(slot: BuildSlot, module: OutfittingModule): ModuleFitProblem | null {
    const required = module.restrictedToSlot;
    if (!required || slot.restriction === required) return null;
    return problem(
        'restrictedMount',
        `module only fits a mount that takes ${SLOT_RESTRICTION_LABELS[required]}`,
        { restriction: required },
    );
}

/**
 * Explain why `module` cannot fit `slot`, or return `null` when it fits.
 *
 * The checks intentionally proceed from fixed hull constraints to module-specific
 * mount constraints, slot kind and finally size so callers receive the most specific
 * useful failure.
 */
export function moduleFitProblem(
    shipSymbol: string,
    slot: BuildSlot,
    module: OutfittingModule,
): ModuleFitProblem | null {
    if (slot.kind === 'cargoHatch') {
        return problem('immutableSlot', 'the cargoHatch slot cannot be changed');
    }
    if (slot.kind === 'armour') {
        const hull = getShipBySymbol(shipSymbol);
        if (module.slot !== 'armour' || module.ship === undefined) {
            return problem('armourRequired', 'not a ship armour module');
        }
        if (!hull || module.ship.toLowerCase() !== hull.name.toLowerCase()) {
            const armourHull = getShipByName(module.ship);
            return problem(
                'wrongHullArmour',
                `armour belongs to ${truncate(module.ship)}, not ${truncate(hull?.name ?? shipSymbol)}`,
                {
                    armourShipName: module.ship,
                    ...(armourHull === null ? {} : { armourShipSymbol: armourHull.symbol }),
                    shipSymbol,
                    ...(hull === null ? {} : { shipName: hull.name }),
                },
            );
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
        const allowedShipNames = restricted.map((symbol) => {
            const hull = getShipBySymbol(symbol);
            return hull?.name ?? symbol;
        });
        const labels = restricted.map((symbol, index) => {
            const name = allowedShipNames[index]!;
            return name === symbol ? symbol : `${name} (${symbol})`;
        });
        return problem('restrictedHull', `module is restricted to ${truncate(labels.join(', '))}`, {
            allowedShipNames,
            allowedShipSymbols: [...restricted],
            shipSymbol,
        });
    }

    // Check the article's reserved mount before general kind rules: this remains true
    // even when the mount offered by the caller is otherwise unrestricted.
    const wrongMount = moduleSlotProblem(slot, module);
    if (wrongMount) return wrongMount;
    const symbol = module.symbol.toLowerCase();
    // The normalized slot field handles Guardian core modules filed as `internal` and
    // hull-specific modules whose symbols share no family prefix.
    const moduleSlot = module.slot;

    switch (slot.kind) {
        case 'core':
            if (moduleSlot !== slot.core) {
                return problem('wrongCoreType', `not a ${slot.core} module`, {
                    requiredCore: slot.core,
                    moduleSlot: moduleSlot ?? 'none',
                });
            }
            break;
        case 'hardpoint': {
            if (module.category !== 'hardpoint') {
                return problem('hardpointRequired', 'not a hardpoint weapon');
            }
            const restricted = restrictionProblem(slot, symbol);
            if (restricted) return restricted;
            break;
        }
        case 'utility':
            if (module.category !== 'utility') {
                return problem('utilityRequired', 'not a utility module');
            }
            return null;
        case 'optional': {
            const isFuelTank = moduleSlot === 'fuelTank';
            if (module.category !== 'internal' && !isFuelTank) {
                return problem('optionalInternalRequired', 'not an optional-internal module');
            }
            if (moduleSlot && !isFuelTank) {
                return problem('coreModuleInOptionalSlot', 'a core module only fits its core slot');
            }
            const restricted = restrictionProblem(slot, symbol);
            if (restricted) return restricted;
            break;
        }
    }

    return module.class > slot.size
        ? problem(
              'oversized',
              `module size ${truncate(module.class)} exceeds slot size ${slot.size}`,
              { moduleClass: module.class, slotSize: slot.size },
          )
        : null;
}

/** Explain why `module` cannot fit `slot`, or return `null` when it fits. */
export function moduleFitError(
    shipSymbol: string,
    slot: BuildSlot,
    module: OutfittingModule,
): string | null {
    return moduleFitProblem(shipSymbol, slot, module)?.message ?? null;
}
