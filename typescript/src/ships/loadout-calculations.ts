/**
 * Pure aggregate calculations for ship loadouts.
 *
 * @remarks
 * The three sums here consume already-resolved module contributions, so they import no
 * catalogue and know nothing of {@link ShipLoadout}. Every contribution is a known number
 * — a record missing one is refused long before it reaches a build — so each returns its
 * figure outright. The {@link CalculationResult} types below belong to the build metrics
 * that *can* come back unavailable, which `ShipLoadout` exposes as `…Result` companions.
 *
 * @packageDocumentation
 */

/**
 * Stable reason a build metric could not produce a value.
 *
 * `missing` means the shield generator is not fitted; `unresolved` means a fitted module
 * or numeric dependency is absent from the supplied data; `disabled` is the module switch;
 * `shed` is the priority budget; and `invalid` identifies a non-physical known value.
 */
export type CalculationIssueReason = 'missing' | 'unresolved' | 'disabled' | 'shed' | 'invalid';

/** An input or fitted-module state that prevented a complete build metric. */
export interface CalculationIssue {
    /** Calculation input that is missing or unavailable. */
    readonly field:
        | 'mass'
        | 'fuelCapacity'
        | 'frameShiftDrive'
        | 'powerCapacity'
        | 'powerDraw'
        | 'thrusters'
        | 'shieldGenerator';
    /** Machine-readable unavailable-state discriminator. */
    readonly reason: CalculationIssueReason;
    /** Slot containing the incomplete module, when the dependency belongs to a module. */
    readonly slot?: string;
    /** Module symbol, when the dependency belongs to a module. */
    readonly symbol?: string;
    /** Human-readable diagnostic suitable for a log or validation panel. */
    readonly message: string;
    /** Values interpolated into `message`, for consumers composing localized text. */
    readonly params?: Readonly<Record<string, string | number>>;
}

/**
 * A metric and the evidence for whether it is complete.
 *
 * @typeParam T - The calculated value.
 */
export type CalculationResult<T> =
    | {
          /** The complete calculated value. */
          readonly value: T;
          /** Discriminator for a complete calculation. */
          readonly complete: true;
          /** Complete calculations have no blocking issues. */
          readonly issues: readonly [];
      }
    | {
          /** Unavailable calculations never expose a misleading partial value. */
          readonly value: null;
          /** Discriminator for an incomplete calculation. */
          readonly complete: false;
          /** One or more missing or unavailable dependencies. */
          readonly issues: readonly [CalculationIssue, ...CalculationIssue[]];
      };

/** One fitted module reduced to the contributions aggregate calculations need. */
export interface LoadoutCalculationModule {
    /** Post-engineering mass in tonnes. */
    readonly mass: number;
    /** Cargo tonnes; `undefined` for anything but a cargo rack. */
    readonly cargoCapacity?: number;
    /** Fuel tonnes; `undefined` for anything but a fuel tank. */
    readonly fuelCapacity?: number;
}

/** A ship's fuel-tank capacities, in tonnes. */
export interface FuelCapacity {
    /** Main tank capacity — the fuel jumps and supercruise draw from. */
    readonly main: number;
    /** Reserve tank capacity — the small emergency reserve. */
    readonly reserve: number;
}

/**
 * Sum hull and fitted-module mass, in tonnes.
 *
 * @param hullMass - Empty-hull mass in tonnes.
 * @param modules - Resolved fitted-module contributions.
 * @returns Mass in tonnes: `calculateUnladenMass(25, [{ mass: 2 }])` is `27`.
 */
export function calculateUnladenMass(
    hullMass: number,
    modules: readonly LoadoutCalculationModule[],
): number {
    let value = hullMass;
    for (const module of modules) value += module.mass;
    return value;
}

/**
 * Sum fitted cargo racks.
 *
 * @param modules - Resolved fitted-module contributions.
 * @returns Cargo capacity in tonnes. A build with no rack carries `0`.
 */
export function calculateCargoCapacity(modules: readonly LoadoutCalculationModule[]): number {
    let value = 0;
    for (const module of modules) value += module.cargoCapacity ?? 0;
    return value;
}

/**
 * Sum fitted fuel tanks and the hull reserve.
 *
 * @param reserveFuelCapacity - Hull reserve in tonnes.
 * @param modules - Resolved fitted-module contributions.
 * @returns Main and reserve capacity, in tonnes. No fitted tank is a main of `0`.
 */
export function calculateFuelCapacity(
    reserveFuelCapacity: number,
    modules: readonly LoadoutCalculationModule[],
): FuelCapacity {
    let main = 0;
    for (const module of modules) main += module.fuelCapacity ?? 0;
    return Object.freeze({ main, reserve: reserveFuelCapacity });
}
