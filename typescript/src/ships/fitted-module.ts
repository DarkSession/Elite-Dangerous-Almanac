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
 * mutating it throws. Fetch a new view with {@link ShipLoadout.fittedModuleAt} after a
 * state-changing edit. All mutations live on `ShipLoadout`, keyed by {@link slot}; this
 * avoids the stale-handle lifecycle that a live proxy would otherwise need.
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
    /** Applied engineering state; otherwise `undefined`. */
    readonly engineering: ModuleEngineering | undefined;
    /** Detached, journal-shaped fitted record. */
    readonly raw: LoadoutModule;
    /**
     * Snapshotted fitted-article stats before its journal modifier block is folded, or
     * `null` when unresolved.
     *
     * A stock or ordinarily engineered module exposes its base catalogue record. A fixed
     * pre-engineered variant exposes its resolved article record here as well as through
     * {@link effectiveStats}, so stats omitted by a journal capture still describe the
     * article. Clearing or replacing that fixed engineering restores the stock record
     * before applying the next recipe.
     */
    readonly stats: OutfittingModule | null;
    /**
     * Post-engineering module stats, or `null` when unresolved. For weapons, journal
     * damage per second is resolved back to per-round damage and falloff is capped at
     * maximum range. Exact damage components follow the engineered total and disappear
     * when a damage conversion replaces them with a fractional distribution.
     * A module engineered through {@link ShipLoadout.applyBlueprint} also retains
     * recipe-only burst values that its journal-shaped modifier block does not serialize.
     * A festive variant fitted through {@link ShipLoadout.setPreEngineeredVariant} uses
     * its fixed modifier block.
     */
    readonly effectiveStats: OutfittingModule | null;
    /** Fully rearmed ammunition capacity, or `null` for modules without ammunition. */
    readonly ammunition: AmmunitionCapacity | null;
    /** Identified fixed pre-engineered variant, or `null` when not uniquely identified. */
    readonly preEngineeredVariant: PreEngineeredVariant | null;
}
