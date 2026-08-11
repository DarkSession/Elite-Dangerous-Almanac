/** Durable state normalization for imported journal loadouts. @internal */

import { getPreEngineeredVariants } from '../pre-engineered.js';
import { getPreEngineeredStats, identifyPreEngineeredVariant } from '../pre-engineered-stats.js';
import { sourcePurchaseFromLoadout, type SourcePurchaseRecord } from '../source-purchase.js';
import type { OutfittingModule } from '../modules.js';
import type { LoadoutEvent, LoadoutModule } from '../slef.js';
import { isFinalGuardianWeaponEngineering } from './loadout-engineering.js';
import { builtInModuleBySymbol } from './module-symbol-index.js';
import { cloneLoadoutModule, cloneModuleStats } from './loadout-state.js';
import { normalizeKey } from '../../internal/registry-index.js';

/** Top-level figures an import carries, trusted over computed fallbacks. */
export interface ImportedTopFigures {
    ShipName?: string;
    ShipIdent?: string;
    HullValue?: number;
    ModulesValue?: number;
    Rebuy?: number;
    UnladenMass?: number;
    CargoCapacity?: number;
    FuelCapacity?: { Main?: number; Reserve?: number };
}

/** Fully detached durable state produced from one journal loadout. */
export interface ImportedLoadoutState {
    readonly shipSymbol: string;
    readonly modules: Map<string, LoadoutModule>;
    readonly moduleStats: Map<string, OutfittingModule>;
    readonly top: ImportedTopFigures;
    readonly sourcePurchase: SourcePurchaseRecord | null;
}

/** Normalize a journal event before the mutable facade takes ownership of it. */
export function normalizeLoadoutEvent(event: LoadoutEvent): ImportedLoadoutState {
    const modules = new Map<string, LoadoutModule>();
    const slots = new Set<string>();
    for (const module of event.Modules) {
        const normalizedSlot = module.Slot.toLowerCase();
        if (slots.has(normalizedSlot)) {
            throw new TypeError(`ShipLoadout.fromLoadout: duplicate slot "${module.Slot}"`);
        }
        slots.add(normalizedSlot);
        modules.set(module.Slot, cloneLoadoutModule(module));
    }

    const top: ImportedTopFigures = {};
    if (event.ShipName !== undefined) top.ShipName = event.ShipName;
    if (event.ShipIdent !== undefined) top.ShipIdent = event.ShipIdent;
    if (event.HullValue !== undefined) top.HullValue = event.HullValue;
    if (event.ModulesValue !== undefined) top.ModulesValue = event.ModulesValue;
    if (event.Rebuy !== undefined) top.Rebuy = event.Rebuy;
    if (event.UnladenMass !== undefined) top.UnladenMass = event.UnladenMass;
    if (event.CargoCapacity !== undefined) top.CargoCapacity = event.CargoCapacity;
    if (event.FuelCapacity !== undefined) top.FuelCapacity = { ...event.FuelCapacity };

    const moduleStats = new Map<string, OutfittingModule>();
    // A reward has no distinct module symbol. Identify its hand-set stat signature so
    // values absent from the capture still come from the fitted article; explicit
    // captured modifiers remain authoritative. Guardian weapons retain the recipe
    // fallback because a capture without modifiers can still identify a final article.
    for (const module of modules.values()) {
        const engineering = module.Engineering;
        const variant = identifyPreEngineeredVariant(module);
        const variantStats = variant ? getPreEngineeredStats(variant) : null;
        if (variantStats) moduleStats.set(module.Slot, cloneModuleStats(variantStats));
        if (
            variantStats?.engineeringLocked ||
            !engineering ||
            !isFinalGuardianWeaponEngineering(module.Item, engineering.BlueprintName)
        ) {
            continue;
        }

        const normalizedBlueprint = normalizeKey(engineering.BlueprintName);
        const normalizedExperimental = normalizeKey(engineering.ExperimentalEffect);
        const exact = getPreEngineeredVariants(module.Item).find(
            (candidate) =>
                candidate.blueprint.toLowerCase() === normalizedBlueprint &&
                candidate.grade === engineering.Level &&
                candidate.experimental?.toLowerCase() === normalizedExperimental,
        );
        const stats = exact ? getPreEngineeredStats(exact) : builtInModuleBySymbol(module.Item);
        if (stats) {
            moduleStats.set(module.Slot, cloneModuleStats({ ...stats, engineeringLocked: true }));
        }
    }

    return {
        shipSymbol: event.Ship,
        modules,
        moduleStats,
        top,
        sourcePurchase: sourcePurchaseFromLoadout(event),
    };
}
