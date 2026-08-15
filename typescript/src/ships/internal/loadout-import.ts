/** Durable state normalization for imported journal loadouts. @internal */

import { getPreEngineeredVariants } from '../pre-engineered.js';
import { getPreEngineeredStats, identifyPreEngineeredVariant } from '../pre-engineered-stats.js';
import { sourcePurchaseFromLoadout, type SourcePurchaseRecord } from '../source-purchase.js';
import type { OutfittingModule } from '../modules.js';
import type { LoadoutEvent, LoadoutModule, ModuleEngineering } from '../slef.js';
import { isFinalGuardianWeaponEngineering } from './loadout-engineering.js';
import { builtInModuleBySymbol } from './module-symbol-index.js';
import { cloneLoadoutModule, cloneModuleStats } from './loadout-state.js';
import { normalizeKey } from '../../internal/registry-index.js';
import {
    describeValue,
    requireString,
    requireStringIfPresent,
    truncate,
} from '../../internal/argument-guards.js';

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

/**
 * Take one reading of every caller-owned field, before any of it is checked.
 *
 * A journal event is usually `JSON.parse` output, but nothing says it has to be: a
 * property can be an accessor that answers differently on each read. Checking one read
 * and using another would let a checked value be swapped for an unchecked one — an
 * `Item` that passed as a string arriving at a catalogue lookup as a number, a `Label`
 * poisoning a build that then throws on the first read of it. So the walk below, the
 * clone, and `sourcePurchaseFromLoadout` all work from this snapshot rather than from
 * the caller's object.
 *
 * Nothing is validated here. A field of the wrong type is carried through exactly as it
 * arrived, so the checks below can name it.
 */
function captureLoadoutEvent(event: LoadoutEvent): LoadoutEvent {
    const modules = event.Modules;
    const shipName = event.ShipName;
    const shipIdent = event.ShipIdent;
    const hullValue = event.HullValue;
    const modulesValue = event.ModulesValue;
    const rebuy = event.Rebuy;
    const unladenMass = event.UnladenMass;
    const cargoCapacity = event.CargoCapacity;
    const fuelCapacity = event.FuelCapacity;
    return {
        Ship: event.Ship,
        Modules: Array.isArray(modules) ? captureEach(modules, captureModule) : modules,
        ...(shipName === undefined ? {} : { ShipName: shipName }),
        ...(shipIdent === undefined ? {} : { ShipIdent: shipIdent }),
        ...(hullValue === undefined ? {} : { HullValue: hullValue }),
        ...(modulesValue === undefined ? {} : { ModulesValue: modulesValue }),
        ...(rebuy === undefined ? {} : { Rebuy: rebuy }),
        ...(unladenMass === undefined ? {} : { UnladenMass: unladenMass }),
        ...(cargoCapacity === undefined ? {} : { CargoCapacity: cargoCapacity }),
        ...(fuelCapacity === undefined ? {} : { FuelCapacity: { ...fuelCapacity } }),
    };
}

/**
 * Copy an array by index, reading each element exactly once.
 *
 * `Array.isArray` proves the exotic object, not the methods on it: an own `map` shadows
 * the intrinsic, and calling it would put `modules.map is not a function` in front of a
 * caller instead of a message naming their field. Indexing reaches no caller-supplied
 * method, and `length` on a real array is a data property rather than an accessor.
 */
function captureEach<T, U>(values: readonly T[], capture: (value: T) => U): U[] {
    const captured: U[] = [];
    const { length } = values;
    for (let index = 0; index < length; index++) captured.push(capture(values[index] as T));
    return captured;
}

/** One reading of a module's fields — see {@link captureLoadoutEvent}. */
function captureModule(module: LoadoutModule): LoadoutModule {
    if (module === null || typeof module !== 'object') return module;
    const on = module.On;
    const priority = module.Priority;
    const health = module.Health;
    const value = module.Value;
    const engineering = module.Engineering;
    return {
        Slot: module.Slot,
        Item: module.Item,
        ...(on === undefined ? {} : { On: on }),
        ...(priority === undefined ? {} : { Priority: priority }),
        ...(health === undefined ? {} : { Health: health }),
        ...(value === undefined ? {} : { Value: value }),
        ...(engineering === undefined ? {} : { Engineering: captureEngineering(engineering) }),
    };
}

/** One reading of an engineering block — see {@link captureLoadoutEvent}. */
function captureEngineering(engineering: ModuleEngineering): ModuleEngineering {
    if (engineering === null || typeof engineering !== 'object') return engineering;
    const experimental = engineering.ExperimentalEffect;
    const experimentalLocalised = engineering.ExperimentalEffect_Localised;
    const modifiers = engineering.Modifiers;
    return {
        BlueprintName: engineering.BlueprintName,
        ...(engineering.Level === undefined ? {} : { Level: engineering.Level }),
        ...(engineering.Quality === undefined ? {} : { Quality: engineering.Quality }),
        ...(experimental === undefined ? {} : { ExperimentalEffect: experimental }),
        ...(experimentalLocalised === undefined
            ? {}
            : { ExperimentalEffect_Localised: experimentalLocalised }),
        ...(modifiers === undefined
            ? {}
            : {
                  Modifiers: Array.isArray(modifiers)
                      ? captureEach(modifiers, (modifier) =>
                            modifier !== null && typeof modifier === 'object'
                                ? { ...modifier }
                                : modifier,
                        )
                      : modifiers,
              }),
    };
}

/** Normalize a journal event before the mutable facade takes ownership of it. */
export function normalizeLoadoutEvent(rawEvent: LoadoutEvent): ImportedLoadoutState {
    const event = captureLoadoutEvent(rawEvent);
    requireStringIfPresent(event.Ship, 'ShipLoadout.fromLoadout: event.Ship');
    if (!Array.isArray(event.Modules)) {
        throw new TypeError(
            `ShipLoadout.fromLoadout: event.Modules must be an array, received ${describeValue(event.Modules)}`,
        );
    }
    const modules = new Map<string, LoadoutModule>();
    const slots = new Set<string>();
    for (const module of event.Modules) {
        // The fields every module must carry, named here rather than wherever the walk
        // below first dereferences them: an `Item` reaching a catalogue lookup as a
        // number would otherwise report the lookup's own parameter to a caller who only
        // ever called `fromLoadout`. The optional blocks stay unchecked, as the rest of
        // the event does — `fromSlef` is the entry point that reports every bad field.
        if (module === null || typeof module !== 'object') {
            throw new TypeError(
                `ShipLoadout.fromLoadout: event.Modules[] must hold module objects, received ${describeValue(module)}`,
            );
        }
        requireString(module.Slot, 'ShipLoadout.fromLoadout: module.Slot');
        requireString(module.Item, 'ShipLoadout.fromLoadout: module.Item');
        if (module.Engineering !== undefined) {
            // A relay that writes `null` for an absent block reaches the clone below,
            // which tests only for `undefined` and dereferences whatever else it finds.
            // The block itself is therefore checked, and its two id fields
            // present-and-wrong-typed only: this path accepts a partial block, and a
            // capture that states modifiers without naming the recipe is one this
            // library already reads.
            if (module.Engineering === null || typeof module.Engineering !== 'object') {
                throw new TypeError(
                    `ShipLoadout.fromLoadout: module.Engineering must be an object, received ${describeValue(module.Engineering)}`,
                );
            }
            requireStringIfPresent(
                module.Engineering.BlueprintName,
                'ShipLoadout.fromLoadout: module.Engineering.BlueprintName',
            );
            requireStringIfPresent(
                module.Engineering.ExperimentalEffect,
                'ShipLoadout.fromLoadout: module.Engineering.ExperimentalEffect',
            );
            // `Modifiers` is the same hazard as the block itself: the clone guards it on
            // `undefined` and then maps it, so anything else reaches `.map is not a
            // function`.
            if (
                module.Engineering.Modifiers !== undefined &&
                !Array.isArray(module.Engineering.Modifiers)
            ) {
                throw new TypeError(
                    `ShipLoadout.fromLoadout: module.Engineering.Modifiers must be an array, received ${describeValue(module.Engineering.Modifiers)}`,
                );
            }
            // A modifier is its `Label` and a value, and the label is not optional: it
            // is the only thing that says which stat moved, so `getLoadoutModifier` and
            // identification both read it unconditionally. An entry without one imports
            // fine and then breaks the build it produced, which is worse than a refusal
            // — so this is the same rule `parseSlef` applies, checked here rather than
            // reported under the name of whichever reader reaches it first. The value
            // beside it is a value, and values on this path are trusted.
            for (const [index, modifier] of (module.Engineering.Modifiers ?? []).entries()) {
                if (modifier === null || typeof modifier !== 'object') {
                    throw new TypeError(
                        `ShipLoadout.fromLoadout: module.Engineering.Modifiers[${index}] must be an object, received ${describeValue(modifier)}`,
                    );
                }
                requireString(
                    (modifier as { Label?: unknown }).Label,
                    `ShipLoadout.fromLoadout: module.Engineering.Modifiers[${index}].Label`,
                );
            }
        }
        const normalizedSlot = module.Slot.toLowerCase();
        if (slots.has(normalizedSlot)) {
            throw new TypeError(
                `ShipLoadout.fromLoadout: duplicate slot "${truncate(module.Slot)}"`,
            );
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
            // A partial block naming no recipe identifies no final article, and the
            // resolver below requires one rather than handing a nullish id back.
            typeof engineering?.BlueprintName !== 'string' ||
            !isFinalGuardianWeaponEngineering(module.Item, engineering.BlueprintName)
        ) {
            continue;
        }

        const normalizedBlueprint = normalizeKey(
            engineering.BlueprintName,
            'ShipLoadout.fromLoadout: module.Engineering.BlueprintName',
        );
        const normalizedExperimental = normalizeKey(
            engineering.ExperimentalEffect,
            'ShipLoadout.fromLoadout: module.Engineering.ExperimentalEffect',
        );
        const exact = getPreEngineeredVariants(module.Item).find(
            (candidate) =>
                candidate.blueprint.toLowerCase() === normalizedBlueprint &&
                candidate.grade === engineering.Level &&
                candidate.experimental?.toLowerCase() === normalizedExperimental,
        );
        const stats = exact
            ? getPreEngineeredStats(exact)
            : builtInModuleBySymbol(module.Item, 'ShipLoadout.fromLoadout: module.Item');
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
