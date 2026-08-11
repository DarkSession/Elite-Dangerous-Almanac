/** Serialization policy for the mutable loadout facade. @internal */

import { normalizeKey } from '../../internal/registry-index.js';
import type { OutfittingModule } from '../modules.js';
import type { SourcePurchaseRecord } from '../source-purchase.js';
import type { LoadoutEvent, LoadoutModule } from '../slef.js';
import type { BuildSlot } from '../slots.js';
import {
    cloneLoadoutModule,
    isBuiltInHullModule,
    isNonOutfittingSlot,
    matchingKeyIn,
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
    readonly layout?: readonly BuildSlot[] | null;
    readonly sourcePurchase: SourcePurchaseRecord | null;
    readonly retailHullValue: number | null;
    readonly unladenMass: number | null;
    readonly cargoCapacity: number | null;
    readonly fuelCapacity: { readonly main: number; readonly reserve: number } | null;
    readonly maxJumpRange: number | null;
    readonly statsFor: (module: LoadoutModule) => OutfittingModule | null;
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
    const totals = source !== null && sourceTotalsHold(input.modules, source) ? source : null;
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
        event: 'Loadout',
        Ship: input.shipSymbol.toLowerCase(),
        ...(input.shipName === undefined ? {} : { ShipName: input.shipName }),
        ...(input.shipIdent === undefined ? {} : { ShipIdent: input.shipIdent }),
        ...(hullValue === null ? {} : { HullValue: hullValue }),
        ...(modulesValue === null ? {} : { ModulesValue: modulesValue }),
        ...(input.unladenMass === null ? {} : { UnladenMass: input.unladenMass }),
        ...(input.cargoCapacity === null ? {} : { CargoCapacity: input.cargoCapacity }),
        ...(input.maxJumpRange === null ? {} : { MaxJumpRange: input.maxJumpRange }),
        ...(input.fuelCapacity === null
            ? {}
            : {
                  FuelCapacity: {
                      Main: input.fuelCapacity.main,
                      Reserve: input.fuelCapacity.reserve,
                  },
              }),
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
            ? slotOrderedModules(input.shipSymbol, input.modules, input.layout)
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
    shipSymbol: string,
    modules: ReadonlyMap<string, LoadoutModule>,
    layout: readonly BuildSlot[] | null | undefined,
): LoadoutModule[] {
    if (!layout) {
        throw new TypeError(
            `ShipLoadout.toLoadoutEvent: no slot layout for hull "${shipSymbol}", so modules cannot be ordered by slot`,
        );
    }
    const remaining = new Map(modules);
    const ordered: LoadoutModule[] = [];
    for (const slot of layout) {
        const key = matchingKeyIn(remaining, slot.key);
        const module = key === null ? undefined : remaining.get(key);
        if (module && key !== null) {
            ordered.push(module);
            remaining.delete(key);
        }
    }
    return [...ordered, ...remaining.values()];
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

function sourceModuleValue(
    module: LoadoutModule,
    source: SourcePurchaseRecord | null,
): number | 'unknown' {
    const entry = source?.entryForSlot(module.Slot) ?? null;
    if (entry === null) return 'unknown';
    return normalizeKey(entry.item) === normalizeKey(module.Item) ? entry.value : 'unknown';
}

function sourceTotalsHold(
    modules: ReadonlyMap<string, LoadoutModule>,
    source: SourcePurchaseRecord,
): boolean {
    for (const entry of source.moduleValues) {
        const key = matchingKeyIn(modules, entry.slot);
        const fitted = key === null ? undefined : modules.get(key);
        if (!fitted || normalizeKey(fitted.Item) !== normalizeKey(entry.item)) return false;
    }
    return true;
}
