/** State-boundary helpers for the mutable loadout facade. @internal */

import { deepFreeze } from '../../internal/deep-freeze.js';
import type { OutfittingModule } from '../modules.js';
import type { LoadoutModule } from '../slef.js';

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

/** Find the first key naming a mount case-insensitively. */
export function firstKeyMatchingCase(keys: Iterable<string>, slotKey: string): string | null {
    const wanted = slotKey.toLowerCase();
    for (const key of keys) {
        if (key.toLowerCase() === wanted) return key;
    }
    return null;
}

/** Snapshot caller-supplied stats so later caller mutation cannot alter the build. */
export function cloneModuleStats(module: OutfittingModule): OutfittingModule {
    return deepFreeze({
        ...module,
        ...(module.restrictedToShips === undefined
            ? {}
            : { restrictedToShips: [...module.restrictedToShips] }),
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
