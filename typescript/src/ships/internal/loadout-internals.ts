/**
 * The one channel `ShipLoadout` hands its fitted state to the build metrics.
 *
 * @remarks
 * The metrics live at their own entry point (`../build-metrics`) so an outfitting editor
 * can import the editing surface without them, and they need the build's raw fitted
 * modules, its resolved records and its hull — none of which is public API, and none of
 * which a `#private` field can reach across a module boundary. A `WeakMap` keyed by the
 * build is that channel: the build publishes one accessor object at construction, the
 * metrics read it, and no consumer can obtain it because this module has no public
 * subpath.
 *
 * The accessors are read live rather than snapshotted. A `ShipLoadout` is mutable, so a
 * metrics view holds the build itself and every read reflects the fit as it stands.
 *
 * @internal
 */

import { describeValue } from '../../internal/argument-guards.js';
import type { FrameShiftDriveParams } from '../jump-range.js';
import type { LoadoutCalculationModule } from '../loadout-calculations.js';
import type { OutfittingModule } from '../modules.js';
import type { Ship } from '../ships.js';
import type { LoadoutModule } from '../slef.js';
import type { BuildSlot } from '../slots.js';

/** Everything the build metrics read off a `ShipLoadout` that is not public API. */
export interface LoadoutInternals {
    /** The hull record the build is fitted on. */
    readonly ship: Ship;
    /** Every fitted module, as the build stores it. */
    readonly modules: () => LoadoutModule[];
    /** Every fitted module with recipe-only modifiers restored for effective stats. */
    readonly effectiveModules: () => LoadoutModule[];
    /** One fitted module in its effective-calculation representation. */
    readonly effectiveModule: (module: LoadoutModule) => LoadoutModule;
    /** The catalogue record resolved for one fitted module. */
    readonly statsFor: (module: LoadoutModule) => OutfittingModule | null;
    /** The hull's expanded mounts, in outfitting-panel order. */
    readonly layout: () => readonly BuildSlot[];
    /** The fitted drive's post-engineering constants, or `null` when none is fitted. */
    readonly resolveDrive: () => FrameShiftDriveParams | null;
    /** The fitted frame shift drive, or `undefined` when none is fitted. */
    readonly frameShiftDriveModule: () => LoadoutModule | undefined;
    /** Fitted modules reduced to the contributions the aggregate calculations sum. */
    readonly calculationModules: () => readonly LoadoutCalculationModule[];
    /** Main-tank fuel as a capture stated it, or `undefined` when none did. */
    readonly statedMainFuel: () => number | undefined;
}

const INTERNALS = new WeakMap<object, LoadoutInternals>();

/** Publish a build's internal accessors. Called once, from the loadout constructor. */
export function publishLoadoutInternals(build: object, internals: LoadoutInternals): void {
    INTERNALS.set(build, internals);
}

/**
 * Read a build's internal accessors.
 *
 * @remarks
 * This doubles as the type guard for the public entry point that takes a build: only a
 * `ShipLoadout` has ever published accessors, so anything else is a wrong-typed
 * argument. The message names the **public** function the consumer called and the
 * **public** parameter they wrote, never this module.
 *
 * @param build - The value a consumer passed as a build.
 * @param label - How to name it in a failure, `"function: parameter"`.
 * @throws {TypeError} If `build` is not a `ShipLoadout`.
 */
export function loadoutInternals(build: unknown, label: string): LoadoutInternals {
    const internals =
        typeof build === 'object' && build !== null ? INTERNALS.get(build) : undefined;
    if (internals === undefined) {
        throw new TypeError(`${label} must be a ShipLoadout, received ${describeValue(build)}`);
    }
    return internals;
}
