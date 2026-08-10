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
 * candidate filtering stay on `ShipLoadout` and take the slot `key`, leaving this value
 * serializable and free of lifecycle rules.
 *
 * @example
 * Walking a build's mounts. Slot keys come from the game and are not derivable from
 * position, so read {@link key} rather than composing one.
 *
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const event: LoadoutEvent;
 *
 * const build = ShipLoadout.fromLoadout(event);
 *
 * build.slots().length; // -> 27   every mount on the hull
 * build.slots('hardpoint').length; // -> 4
 *
 * for (const slot of build.slots('hardpoint')) {
 *     slot.key; // -> 'HugeHardpoint1'      what ShipLoadout.setModule takes
 *     slot.name; // -> 'Huge Hardpoint 1'   what a UI shows
 *     slot.size; // -> 4
 *     slot.module?.symbol; // -> 'hpt_beamlaser_gimbal_huge', or undefined when empty
 * }
 * ```
 *
 * @example
 * The view is a snapshot, not a handle — re-read it after an edit.
 *
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * const build = ShipLoadout.empty('Sidewinder');
 * const before = build.slots('hardpoint')[0];
 * before?.module; // -> null
 *
 * build.removeModule('TinyHardpoint1');
 * before?.module; // -> still null; `before` describes the build as it was
 * build.slots('hardpoint')[0]?.module; // -> the current view
 * ```
 */
export type LoadoutSlot = BuildSlot & {
    /** Human-readable label, e.g. `"Frame Shift Drive"`. */
    readonly name: string;
    /** Frozen fitted-module snapshot, or `null` when this mount is empty. */
    readonly module: FittedModule | null;
};
