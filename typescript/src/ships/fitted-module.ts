/**
 * Immutable fitted-module snapshots returned by {@link ShipLoadout}.
 *
 * @packageDocumentation
 */

import type { AmmunitionCapacity } from './ammunition.js';
import type { OutfittingModule } from './modules.js';
import type { PreEngineeredVariant } from './pre-engineered.js';
import type { LoadoutModule, ModuleEngineering } from './slef.js';

/**
 * A point-in-time, deeply frozen view of the module fitted in one slot.
 *
 * The view is detached from its {@link ShipLoadout}: later edits do not change it, and
 * mutating it throws. Fetch a new view with {@link ShipLoadout.fittedModuleAt} after an
 * edit. All mutations live on `ShipLoadout`, keyed by {@link slot}; this avoids the
 * stale-handle lifecycle that a live proxy would otherwise need.
 *
 * @example
 * ```ts
 * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * declare const build: ShipLoadout;
 *
 * const before = build.fittedModuleAt('FrameShiftDrive')!;
 * build.applyBlueprint(before.slot, 'FSD_LongRange', { grade: 5 });
 * const after = build.fittedModuleAt(before.slot)!;
 * before.engineering; // unchanged
 * after.engineering;  // the applied blueprint
 * ```
 */
export interface FittedModule {
    /** Slot key in the build's own spelling. */
    readonly slot: string;
    /** Frontier module symbol, e.g. `"Int_Hyperdrive_Size6_Class5"`. */
    readonly symbol: string;
    /** Whether the module was powered on, or `undefined` when unspecified. */
    readonly on: boolean | undefined;
    /** Zero-based power-priority group, or `undefined` when unspecified. */
    readonly priority: number | undefined;
    /** Module health in `[0, 1]`, or `undefined` when unspecified. */
    readonly health: number | undefined;
    /** Captured purchase value in credits, or `undefined` when unspecified. */
    readonly value: number | undefined;
    /** Applied engineering, or `undefined` for a stock module. */
    readonly engineering: ModuleEngineering | undefined;
    /** Detached, journal-shaped fitted record. */
    readonly raw: LoadoutModule;
    /** Snapshotted base module stats, or `null` when unresolved. */
    readonly stats: OutfittingModule | null;
    /**
     * Post-engineering module stats, or `null` when unresolved. For weapons, journal
     * damage per second is resolved back to per-round damage and falloff is capped at
     * maximum range. Exact damage components follow the engineered total and disappear
     * when a damage conversion replaces them with a fractional distribution.
     */
    readonly effectiveStats: OutfittingModule | null;
    /** Fully rearmed ammunition capacity, or `null` for modules without ammunition. */
    readonly ammunition: AmmunitionCapacity | null;
    /** Identified fixed pre-engineered variant, or `null` when not uniquely identified. */
    readonly preEngineeredVariant: PreEngineeredVariant | null;
}
