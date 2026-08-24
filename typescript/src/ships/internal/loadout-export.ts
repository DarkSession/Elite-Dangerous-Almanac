/** Serialization policy for the mutable loadout facade. @internal */

import { normalizeKey } from '../../internal/registry-index.js';
import type { OutfittingModule } from '../modules.js';
import { getSourceModuleValue, type SourcePurchaseRecord } from '../source-purchase.js';
import type { LoadoutEvent, LoadoutModule } from '../slef.js';
import type { BuildSlot } from '../slots.js';
import {
    cloneLoadoutModule,
    FITTED_ITEM,
    isBuiltInHullModule,
    isCargoHatchSlot,
    isNonOutfittingSlot,
    matchingKeyIn,
    orderBySlotLayout,
} from './loadout-state.js';

/** The public export options consumed by the serializer. */
export interface LoadoutExportShape {
    readonly moduleOrder?: 'fitted' | 'slots';
    readonly explicitPower?: boolean;
    readonly credits?: 'retail' | 'source';
}

/** Everything the facade resolves before handing a build to the serializer. */
export interface LoadoutExportInput {
    readonly shipSymbol: string;
    readonly shipName?: string;
    readonly shipIdent?: string;
    readonly modules: ReadonlyMap<string, LoadoutModule>;
    readonly layout: readonly BuildSlot[];
    readonly sourcePurchase: SourcePurchaseRecord | null;
    readonly retailHullValue: number;
    readonly unladenMass: number;
    readonly cargoCapacity: number;
    readonly fuelCapacity: { readonly main: number; readonly reserve: number };
    readonly maxJumpRange: number | null;
    readonly statsFor: (module: LoadoutModule) => OutfittingModule | null;
    /**
     * Whether *import* put a priced article aboard that the capture never listed — a
     * core internal it named no module for, stocked from the hull defaults. No comparison
     * against the priced slots can see an addition, only a swap or a removal, and
     * filling an empty mount by an edit deliberately leaves the totals standing: the
     * caller made that change and can see it. This one nobody asked for. A stocked
     * bulkhead or cargo hatch is free, so it does not set this.
     */
    readonly sourceTotalsVoided?: boolean;
}

/** Insurance rebuy is a flat 5% of hull-plus-modules retail value, truncated. */
const REBUY_FRACTION = 0.05;

/** Turn resolved loadout state into a fresh journal event. */
export function exportLoadoutEvent(
    input: LoadoutExportInput,
    options: LoadoutExportShape,
): LoadoutEvent {
    const fromSource = options.credits === 'source';
    const source = fromSource ? input.sourcePurchase : null;
    const totals =
        source !== null && !input.sourceTotalsVoided && sourceTotalsHold(input.modules, source)
            ? source
            : null;
    const hullValue = fromSource ? (source?.hullValue ?? null) : input.retailHullValue;
    const modulesValue = fromSource
        ? (totals?.modulesValue ?? null)
        : computedModulesValue(input.modules, input.statsFor);
    const rebuy = fromSource
        ? (totals?.rebuy ?? null)
        : hullValue === null || modulesValue === null
          ? null
          : Math.trunc((hullValue + modulesValue) * REBUY_FRACTION);

    return {
        Ship: input.shipSymbol.toLowerCase(),
        ...(input.shipName === undefined ? {} : { ShipName: input.shipName }),
        ...(input.shipIdent === undefined ? {} : { ShipIdent: input.shipIdent }),
        ...(hullValue === null ? {} : { HullValue: hullValue }),
        ...(modulesValue === null ? {} : { ModulesValue: modulesValue }),
        UnladenMass: input.unladenMass,
        CargoCapacity: input.cargoCapacity,
        ...(input.maxJumpRange === null ? {} : { MaxJumpRange: input.maxJumpRange }),
        FuelCapacity: { Main: input.fuelCapacity.main, Reserve: input.fuelCapacity.reserve },
        ...(rebuy === null ? {} : { Rebuy: rebuy }),
        Modules: exportModules(input, options, fromSource),
    };
}

function exportModules(
    input: LoadoutExportInput,
    options: LoadoutExportShape,
    fromSource: boolean,
): LoadoutModule[] {
    const ordered =
        options.moduleOrder === 'slots'
            ? slotOrderedModules(input.modules, input.layout)
            : [...input.modules.values()];
    return ordered.map((module) => {
        const on = module.On ?? (options.explicitPower ? true : undefined);
        const priority = module.Priority ?? (options.explicitPower ? 0 : undefined);
        const value = fromSource
            ? sourceModuleValue(module, input.sourcePurchase)
            : moduleValue(module, input.statsFor);
        return {
            Slot: module.Slot,
            Item: module.Item.toLowerCase(),
            ...(on === undefined ? {} : { On: on }),
            ...(priority === undefined ? {} : { Priority: priority }),
            ...(module.Health === undefined ? {} : { Health: module.Health }),
            ...(typeof value === 'number' ? { Value: value } : {}),
            ...(module.Engineering === undefined
                ? {}
                : { Engineering: cloneLoadoutModule(module).Engineering! }),
        };
    });
}

function slotOrderedModules(
    modules: ReadonlyMap<string, LoadoutModule>,
    layout: readonly BuildSlot[],
): LoadoutModule[] {
    return orderBySlotLayout([...modules.values()], layout, (module) => module.Slot);
}

function computedModulesValue(
    modules: ReadonlyMap<string, LoadoutModule>,
    statsFor: (module: LoadoutModule) => OutfittingModule | null,
): number | null {
    let sum = 0;
    for (const module of modules.values()) {
        const value = moduleValue(module, statsFor);
        if (value === 'unknown') return null;
        if (value !== 'free') sum += value;
    }
    return sum;
}

function moduleValue(
    module: LoadoutModule,
    statsFor: (module: LoadoutModule) => OutfittingModule | null,
): number | 'free' | 'unknown' {
    const stats = statsFor(module);
    if (stats !== null) return stats.cost ?? 'unknown';
    return isNonOutfittingSlot(module.Slot) || isBuiltInHullModule(module) ? 'free' : 'unknown';
}

/** How a capture's own record of what a slot held is named when it is not a string. */
const SOURCE_ITEM = 'ShipLoadout: sourcePurchase moduleValues[].item';

function sourceModuleValue(
    module: LoadoutModule,
    source: SourcePurchaseRecord | null,
): number | 'unknown' {
    const entry = source === null ? null : getSourceModuleValue(source, module.Slot);
    if (entry === null) return 'unknown';
    return normalizeKey(entry.item, SOURCE_ITEM) === normalizeKey(module.Item, FITTED_ITEM)
        ? entry.value
        : 'unknown';
}

function sourceTotalsHold(
    modules: ReadonlyMap<string, LoadoutModule>,
    source: SourcePurchaseRecord,
): boolean {
    for (const entry of source.moduleValues) {
        const key = matchingKeyIn(modules, entry.slot);
        const fitted = key === null ? undefined : modules.get(key);
        if (!fitted) return false;
        if (isCargoHatchSlot(entry.slot) && entry.value === 0) continue;
        if (normalizeKey(fitted.Item, FITTED_ITEM) !== normalizeKey(entry.item, SOURCE_ITEM)) {
            return false;
        }
    }
    return true;
}
