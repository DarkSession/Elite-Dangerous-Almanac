/** State-boundary helpers for the mutable loadout facade. @internal */

import { deepFreeze } from '../../internal/deep-freeze.js';
import type { OutfittingModule } from '../modules.js';
import type { LoadoutModule } from '../slef.js';
import type { BuildSlot } from '../slots.js';

/**
 * How a fitted module's `Item` is named when a catalogue lookup rejects it as a wrong
 * type. A build assembled through `setModule` carries a symbol the guard there checked;
 * one read from a `Loadout` event carries whatever the event held, so the failure has to
 * say which field of the build it came from.
 */
export const FITTED_ITEM = 'ShipLoadout: fitted module Item';

/** Whether a journal key names a known cosmetic or hull-geometry entry. */
export function isNonOutfittingSlot(slotKey: string): boolean {
    return /^(paintjob|shipname\d+|shipid\d+|bobble\d+|decal\d+|shipkit.+|weaponcolour|enginecolour|vesselvoice|shipcockpit|stringlights)$/i.test(
        slotKey,
    );
}

/** Whether a module is the zero-mass, zero-price cargo hatch built into every hull. */
export function isBuiltInHullModule(module: LoadoutModule): boolean {
    return (
        module.Slot.toLowerCase() === 'cargohatch' &&
        module.Item.toLowerCase().startsWith('modularcargobaydoor')
    );
}

/** Detach a journal module from caller-owned or returned mutable objects. */
export function cloneLoadoutModule(module: LoadoutModule): LoadoutModule {
    return {
        Slot: module.Slot,
        Item: module.Item,
        ...(module.On === undefined ? {} : { On: module.On }),
        ...(module.Priority === undefined ? {} : { Priority: module.Priority }),
        ...(module.Health === undefined ? {} : { Health: module.Health }),
        ...(module.Value === undefined ? {} : { Value: module.Value }),
        ...(module.Engineering === undefined
            ? {}
            : {
                  Engineering: {
                      BlueprintName: module.Engineering.BlueprintName,
                      Level: module.Engineering.Level,
                      Quality: module.Engineering.Quality,
                      ...(module.Engineering.ExperimentalEffect === undefined
                          ? {}
                          : { ExperimentalEffect: module.Engineering.ExperimentalEffect }),
                      ...(module.Engineering.ExperimentalEffect_Localised === undefined
                          ? {}
                          : {
                                ExperimentalEffect_Localised:
                                    module.Engineering.ExperimentalEffect_Localised,
                            }),
                      ...(module.Engineering.Modifiers === undefined
                          ? {}
                          : {
                                Modifiers: module.Engineering.Modifiers.map((modifier) => ({
                                    ...modifier,
                                })),
                            }),
                  },
              }),
    };
}

/**
 * The key a slot-keyed map actually holds for a mount, or `null` when it holds none.
 *
 * @remarks
 * A build's own spelling is authoritative and is never rewritten — Frontier writes
 * `FrameShiftDrive` where a SLEF producer may write `frameshiftdrive`, and both name the
 * same mount — so every read and every mutation resolves the caller's key through here
 * first. The own-key hit is a fast path: only a miss pays for the scan. It never has to
 * break a tie, because a build cannot hold two keys differing only in case (`fromLoadout`
 * throws on one, and every edit writes through this).
 */
export function matchingKeyIn(keyed: ReadonlyMap<string, unknown>, slotKey: string): string | null {
    if (keyed.has(slotKey)) return slotKey;
    const wanted = slotKey.toLowerCase();
    for (const key of keyed.keys()) {
        if (key.toLowerCase() === wanted) return key;
    }
    return null;
}

/** Order values by a hull's slots, retaining source order for slots outside the layout. */
export function orderBySlotLayout<T>(
    values: readonly T[],
    layout: readonly BuildSlot[] | null | undefined,
    slotOf: (value: T) => string,
): T[] {
    if (!layout) return [...values];
    const order = new Map(layout.map((slot, index) => [slot.key.toLowerCase(), index] as const));
    return [...values].sort(
        (left, right) =>
            (order.get(slotOf(left).toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(slotOf(right).toLowerCase()) ?? Number.MAX_SAFE_INTEGER),
    );
}

/** Snapshot caller-supplied stats so later caller mutation cannot alter the build. */
export function cloneModuleStats(module: OutfittingModule): OutfittingModule {
    try {
        return deepFreeze(structuredClone(module));
    } catch (error) {
        if (!(error instanceof Error && error.name === 'DataCloneError')) throw error;
        return deepFreeze({
            ...module,
            ...(module.restrictedToShips === undefined
                ? {}
                : { restrictedToShips: [...module.restrictedToShips] }),
            ...(module.limitIncrease === undefined
                ? {}
                : { limitIncrease: { ...module.limitIncrease } }),
            ...(module.damageDistribution === undefined
                ? {}
                : { damageDistribution: { ...module.damageDistribution } }),
            ...(module.damageComponents === undefined
                ? {}
                : {
                      damageComponents: {
                          ...module.damageComponents,
                          ...(module.damageComponents.unclassified === undefined
                              ? {}
                              : { unclassified: [...module.damageComponents.unclassified] }),
                      },
                  }),
            ...(module.projectileRange === undefined
                ? {}
                : { projectileRange: { ...module.projectileRange } }),
        });
    }
}
