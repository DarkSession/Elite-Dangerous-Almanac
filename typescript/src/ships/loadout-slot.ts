/**
 * Immutable slot snapshots returned by {@link ShipLoadout}.
 *
 * @packageDocumentation
 */

import type { FittedModule } from './fitted-module.js';
import type { BuildSlot } from './slots.js';

/**
 * A point-in-time, deeply frozen view of one hull mount.
 *
 * The view is detached from its {@link ShipLoadout}; after fitting or removing a
 * module, call {@link ShipLoadout.slots} again for the current view. Mutations and
 * candidate filtering stay on `ShipLoadout` and take {@link key}, leaving this value
 * serializable and free of lifecycle rules.
 */
export interface LoadoutSlot extends BuildSlot {
    /** Human-readable label, e.g. `"Frame Shift Drive"`. */
    readonly name: string;
    /** Frozen fitted-module snapshot, or `null` when this mount is empty. */
    readonly module: FittedModule | null;
}
