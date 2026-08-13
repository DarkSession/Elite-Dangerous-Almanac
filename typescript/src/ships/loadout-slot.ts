/**
 * Immutable slot snapshots returned by {@link ShipLoadout}.
 *
 * @packageDocumentation
 */

import type { FittedModule } from './fitted-module.js';
import type { BuildSlot } from './slots.js';

/** Stable reason a hull mount cannot be emptied through {@link ShipLoadout.removeModule}. */
export type ImmovableReason = 'cargoHatch';

/**
 * A point-in-time, deeply frozen view of one hull mount.
 *
 * The view is detached from its {@link ShipLoadout}; after an edit that changes the
 * build, call {@link ShipLoadout.slots} again for the current view. Reads made without an
 * intervening state change reuse the same frozen snapshots. Mutations and candidate
 * filtering stay on `ShipLoadout` and take the slot `key`, leaving this value serializable
 * and free of lifecycle rules.
 *
 * @example
 * Walking a build's mounts. Slot keys come from the game and are not derivable from
 * position, so read the slot's `key` rather than composing one.
 *
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const event: LoadoutEvent;
 *
 * // Figures below are one build's — a Federal Corvette.
 * const build = ShipLoadout.fromLoadout(event);
 *
 * build.slots().length; // -> 38   every mount on the hull
 * build.slots('hardpoint').length; // -> 7
 *
 * const first = build.slots('hardpoint')[0];
 * first?.key; // -> 'HugeHardpoint1'      what ShipLoadout.setModule takes
 * first?.name; // -> 'Huge Hardpoint 1'   what a UI shows
 * first?.size; // -> 4
 * first?.module?.symbol; // -> 'hpt_beamlaser_gimbal_huge'; undefined when the mount is empty
 * ```
 *
 * @example
 * The view is a snapshot, not a handle — re-read it after an edit.
 *
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * const build = ShipLoadout.empty('Sidewinder');
 * const before = build.slots('hardpoint')[0];
 * before?.key; // -> 'SmallHardpoint1'
 * before?.module; // -> null
 *
 * const pulse = getModuleBySymbol('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES);
 * if (pulse) build.setModule('SmallHardpoint1', pulse);
 *
 * before?.module; // -> still null — `before` describes the build as it was
 * build.slots('hardpoint')[0]?.module?.symbol; // -> 'Hpt_PulseLaser_Fixed_Small'
 * ```
 */
export type LoadoutSlot = BuildSlot & {
    /** Human-readable label, e.g. `"Frame Shift Drive"`. */
    readonly name: string;
    /** Frozen fitted-module snapshot, or `null` when this mount is empty. */
    readonly module: FittedModule | null;
    /** Whether {@link ShipLoadout.removeModule} may empty this mount. */
    readonly removable: boolean;
    /** Machine-readable reason the mount is fixed; absent when {@link removable} is true. */
    readonly immovableReason?: ImmovableReason;
};
