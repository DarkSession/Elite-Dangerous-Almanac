/** Durable state normalization for imported journal loadouts. @internal */

import { getPreEngineeredVariants, type PreEngineeredVariant } from '../pre-engineered.js';
import {
    getPreEngineeredModifiers,
    getPreEngineeredStats,
    identifyPreEngineeredVariant,
} from '../pre-engineered-stats.js';
import { sourcePurchaseFromLoadout, type SourcePurchaseRecord } from '../source-purchase.js';
import { getDefaultLoadout } from '../default-loadouts.js';
import { getShipSlots } from '../ships.js';
import { enumerateSlots, parseSlotName, type BuildSlot } from '../slots.js';
import type { OutfittingModule } from '../modules.js';
import type {
    EngineeringModifier,
    LoadoutEvent,
    LoadoutModule,
    ModuleEngineering,
} from '../slef.js';
import type { LoadoutImportOutcome } from '../loadout-import-outcome.js';
import { isFinalGuardianWeaponEngineering, unrollableFixedArticle } from './loadout-engineering.js';
import { moduleFitProblem } from './loadout-fitting.js';
import { builtInModuleBySymbol } from './module-symbol-index.js';
import {
    cloneLoadoutModule,
    cloneModuleStats,
    isBuiltInHullModule,
    isNonOutfittingSlot,
    matchingKeyIn,
    ownKeyIn,
} from './loadout-state.js';
import { normalizeKey } from '../../internal/registry-index.js';
import { deepFreeze } from '../../internal/deep-freeze.js';
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
    readonly primitiveModifiers: Map<string, readonly EngineeringModifier[]>;
    readonly top: ImportedTopFigures;
    readonly sourcePurchase: SourcePurchaseRecord | null;
    readonly outcomes: readonly LoadoutImportOutcome[];
}

/**
 * The catalogued fixed article a fitted module describes, however it says so.
 *
 * A capture that spells out its modifiers is identified by that signature. One that
 * states a bare identity and no `Modifiers` is identified by the identity, but only where
 * no ordinary roll could have written it: the article is final, or the module's own
 * engineering menu does not offer the blueprint it is named for. Everything that asks
 * whether a slot holds an article asks this, so the answer cannot differ between the
 * import that resolved one and the editor that later reads it back.
 *
 * @internal
 */
export function preEngineeredVariantFor(module: LoadoutModule): PreEngineeredVariant | null {
    return (
        identifyPreEngineeredVariant(module) ??
        (module.Engineering ? unrollableFixedArticle(module.Item, module.Engineering) : null)
    );
}

/**
 * Take one reading of every caller-owned field, before any of it is checked.
 *
 * A journal event is usually `JSON.parse` output, but a property can be an accessor that
 * answers differently on each read: checking one read and using another would let a
 * checked value be swapped for an unchecked one. Everything downstream works from this
 * snapshot. Nothing is validated here — a wrong-typed field is carried through as it
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
 * the intrinsic. Indexing reaches no caller-supplied method.
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
        Level: engineering.Level,
        Quality: engineering.Quality,
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

/** The hull's mounts, expanded only when a fixed mount has to be judged. */
function hullLayout(shipSymbol: string): readonly BuildSlot[] {
    const slots = getShipSlots(shipSymbol);
    return slots ? enumerateSlots(slots) : [];
}

/**
 * Whether this fixed mount refuses the article the capture put in it.
 *
 * An unrecognised hull answers no: without its layout there is nothing to judge against,
 * and the capture is the only account of the ship there is.
 */
function fixedMountRejects(
    shipSymbol: string,
    layout: readonly BuildSlot[],
    slot: string,
    stats: OutfittingModule,
): boolean {
    const mount = layout.find((candidate) => candidate.key.toLowerCase() === slot.toLowerCase());
    return mount !== undefined && moduleFitProblem(shipSymbol, mount, stats) !== null;
}

/** Normalize a journal event before the mutable facade takes ownership of it. */
export function normalizeLoadoutEvent(rawEvent: LoadoutEvent): ImportedLoadoutState {
    const event = captureLoadoutEvent(rawEvent);
    requireString(event.Ship, 'ShipLoadout.fromLoadout: event.Ship');
    if (!Array.isArray(event.Modules)) {
        throw new TypeError(
            `ShipLoadout.fromLoadout: event.Modules must be an array, received ${describeValue(event.Modules)}`,
        );
    }
    const modules = new Map<string, LoadoutModule>();
    const slots = new Set<string>();
    for (const module of event.Modules) {
        // The fields every module must carry, named here rather than wherever the walk
        // below first dereferences them — an `Item` reaching a catalogue lookup as a
        // number would report that lookup's own parameter instead. Values stay unchecked;
        // `fromSlef` is the entry point that reports every bad field.
        if (module === null || typeof module !== 'object') {
            throw new TypeError(
                `ShipLoadout.fromLoadout: event.Modules[] must hold module objects, received ${describeValue(module)}`,
            );
        }
        requireString(module.Slot, 'ShipLoadout.fromLoadout: module.Slot');
        requireString(module.Item, 'ShipLoadout.fromLoadout: module.Item');
        if (module.Engineering !== undefined) {
            // A relay writing `null` for an absent block would reach the clone below,
            // which only tests for `undefined`. A partial block is accepted: a capture
            // may state modifiers without naming the recipe.
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
            // Same hazard as the block itself: the clone guards on `undefined`, then maps.
            if (
                module.Engineering.Modifiers !== undefined &&
                !Array.isArray(module.Engineering.Modifiers)
            ) {
                throw new TypeError(
                    `ShipLoadout.fromLoadout: module.Engineering.Modifiers must be an array, received ${describeValue(module.Engineering.Modifiers)}`,
                );
            }
            // The `Label` is not optional: it is the only thing saying which stat moved,
            // and every reader takes it unconditionally, so an entry without one would
            // import fine and then break the build it produced. The value beside it is a
            // value, and values on this path are trusted.
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

    let invalidatesAggregates = false;
    const outcomes: LoadoutImportOutcome[] = [];
    const defaults = getDefaultLoadout(event.Ship)?.modules ?? [];
    let layout: readonly BuildSlot[] | undefined;
    for (const [slot, module] of modules) {
        // Some hull families name their own cargo-hatch symbol for the one article the
        // catalogue carries under the standard hatch, so a symbol lookup alone would
        // normalize the hatch of every Fer-de-Lance and Lynx Highliner capture.
        if (isNonOutfittingSlot(slot) || isBuiltInHullModule(module)) continue;

        const stats = builtInModuleBySymbol(module.Item, 'ShipLoadout.fromLoadout: module.Item');
        const slotKind = parseSlotName(slot)?.kind;
        const fallback =
            slotKind === 'core' || slotKind === 'armour' || slotKind === 'cargoHatch'
                ? defaults.find((candidate) => candidate.slot.toLowerCase() === slot.toLowerCase())
                : undefined;
        // A fixed mount is the hull's, not the capture's: resolving the symbol only says
        // it names some module, not one this mount can hold. A capture that puts a cargo
        // rack in `Armour`, a size-8 plant in a Sidewinder's size-2 mount, or anything at
        // all in the hatch describes a ship that cannot exist, so the hull's own article
        // goes there — the same substitution an unresolvable symbol already gets. Only a
        // fixed mount is corrected this way: an optional or hardpoint mount can legally
        // stand empty, so a bad article there is the caller's to see and remove.
        const rejected =
            fallback !== undefined &&
            (stats === null ||
                // Every legitimate hatch left this loop above; `moduleFitProblem` refuses
                // that mount to every article, so it cannot tell the rest apart.
                slotKind === 'cargoHatch' ||
                fixedMountRejects(event.Ship, (layout ??= hullLayout(event.Ship)), slot, stats));
        if (stats !== null && !rejected) continue;

        if (fallback) {
            // The article is unknown; how the commander ran it is not. Dropping `On`
            // would switch a disabled module back on and re-band it, moving power and
            // heat silently. `Value` and engineering describe the article, so they go.
            modules.set(slot, {
                Slot: slot,
                Item: fallback.symbol,
                ...(module.On === undefined ? {} : { On: module.On }),
                ...(module.Priority === undefined ? {} : { Priority: module.Priority }),
                ...(module.Health === undefined ? {} : { Health: module.Health }),
            });
            outcomes.push({
                action: 'defaulted',
                slot,
                sourceSymbol: module.Item,
                replacementSymbol: fallback.symbol,
            });
        } else {
            modules.delete(slot);
            outcomes.push({ action: 'emptied', slot, sourceSymbol: module.Item });
        }
        invalidatesAggregates = true;
    }
    // A mount the source named nothing for leaves the same hole as one it named an
    // unresolvable article for, so both are filled from the hull defaults. Only a stocked
    // core internal invalidates the capture's aggregates: the stock bulkhead and hatch
    // weigh and cost nothing, which `default-loadouts.test.ts` pins.
    for (const fallback of defaults) {
        const slotKind = parseSlotName(fallback.slot)?.kind;
        if (
            (slotKind !== 'core' && slotKind !== 'armour' && slotKind !== 'cargoHatch') ||
            matchingKeyIn(modules, fallback.slot) !== null
        ) {
            continue;
        }
        const slot = ownKeyIn(modules, fallback.slot);
        modules.set(slot, { Slot: slot, Item: fallback.symbol });
        outcomes.push({
            action: 'defaulted',
            slot,
            sourceSymbol: null,
            replacementSymbol: fallback.symbol,
        });
        if (slotKind === 'core') invalidatesAggregates = true;
    }
    if (invalidatesAggregates) {
        delete top.ModulesValue;
        delete top.Rebuy;
        delete top.UnladenMass;
        delete top.CargoCapacity;
        delete top.FuelCapacity;
    }

    const moduleStats = new Map<string, OutfittingModule>();
    const primitiveModifiers = new Map<string, readonly EngineeringModifier[]>();
    // A reward has no distinct module symbol, so it is identified by its hand-set stat
    // signature and supplies the values the capture omits; explicit captured modifiers
    // stay authoritative. A capture that omits `Modifiers` entirely can still be selected
    // by its full identity — a present array cannot, since older releases exported
    // ordinary AX rolls under the same symbol/blueprint/grade tuple.
    for (const module of modules.values()) {
        const engineering = module.Engineering;
        const variant = preEngineeredVariantFor(module);
        const catalogueVariantStats = variant ? getPreEngineeredStats(variant) : null;
        let variantStats = catalogueVariantStats;
        const retainsBakedExperimental =
            variant?.experimentalEffectSymbol !== undefined &&
            typeof engineering?.ExperimentalEffect === 'string' &&
            variant.experimentalEffectSymbol.trim().toLowerCase() ===
                engineering.ExperimentalEffect.trim().toLowerCase();
        if (
            variant &&
            catalogueVariantStats &&
            !catalogueVariantStats.engineeringLocked &&
            !retainsBakedExperimental
        ) {
            const { experimentalEffectSymbol: originalExperimental, ...withoutExperimental } =
                variant;
            void originalExperimental;
            const currentExperimental = engineering?.ExperimentalEffect;
            const currentVariant =
                typeof currentExperimental === 'string'
                    ? { ...withoutExperimental, experimentalEffectSymbol: currentExperimental }
                    : withoutExperimental;
            // Seed the effect-free fixed article, then retain the complete primitive
            // inputs separately. Journal presentation omits recipe-only labels such as
            // BurstInterval, while applying the effect to this baseline would make
            // related-stat ratios count it zero times after import. Captured entries
            // come first so their explicit values remain authoritative.
            variantStats = getPreEngineeredStats(withoutExperimental);
            primitiveModifiers.set(module.Slot, [
                ...(engineering?.Modifiers ?? []),
                ...getPreEngineeredModifiers(currentVariant),
            ]);
        }
        if (variantStats) moduleStats.set(module.Slot, cloneModuleStats(variantStats));
        const guardianFinal =
            typeof engineering?.BlueprintName === 'string' &&
            isFinalGuardianWeaponEngineering(module.Item, engineering.BlueprintName);
        if (
            variantStats?.engineeringLocked ||
            // A partial block naming no recipe identifies no final article, and the
            // resolver below requires one rather than handing a nullish id back.
            typeof engineering?.BlueprintName !== 'string' ||
            !guardianFinal
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
        const variants = getPreEngineeredVariants(module.Item);
        const exact = variants.find(
            (candidate) =>
                candidate.engineeringLocked === true &&
                candidate.blueprintSymbol.toLowerCase() === normalizedBlueprint &&
                candidate.grade === engineering.Level &&
                candidate.experimentalEffectSymbol?.toLowerCase() === normalizedExperimental,
        );
        const guardianBase = variants.find(
            (candidate) =>
                candidate.engineeringLocked === true &&
                candidate.blueprintSymbol.toLowerCase() === normalizedBlueprint &&
                candidate.grade === engineering.Level &&
                candidate.experimentalEffectSymbol === undefined,
        );
        const stats = exact
            ? getPreEngineeredStats(exact)
            : guardianBase && engineering.ExperimentalEffect !== undefined
              ? getPreEngineeredStats({
                    ...guardianBase,
                    experimentalEffectSymbol: engineering.ExperimentalEffect,
                })
              : builtInModuleBySymbol(module.Item, 'ShipLoadout.fromLoadout: module.Item');
        if (stats) {
            moduleStats.set(module.Slot, cloneModuleStats({ ...stats, engineeringLocked: true }));
        }
    }

    return {
        shipSymbol: event.Ship,
        modules,
        moduleStats,
        primitiveModifiers,
        top,
        sourcePurchase: sourcePurchaseFromLoadout(event),
        outcomes: deepFreeze(outcomes),
    };
}
