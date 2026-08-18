/**
 * Pure aggregate calculations for ship loadouts.
 *
 * @remarks
 * These functions deliberately distinguish a genuine zero from an incomplete answer.
 * They consume already-resolved module contributions, so they neither import the module
 * catalogues nor know about {@link ShipLoadout}. The facade uses them after resolving
 * engineering and consumers with their own catalogues can use them directly.
 *
 * @packageDocumentation
 */

import { completeResult, incompleteResult } from './internal/calculation-result.js';
import { truncate } from '../internal/argument-guards.js';

/**
 * Stable reason a loadout calculation could not produce a value.
 *
 * `missing` means no required module is fitted; `unresolved` means a fitted module or
 * numeric dependency is absent from the supplied data; `disabled` is the module switch;
 * `shed` is the priority budget; and `invalid` identifies a non-physical known value.
 */
export type CalculationIssueReason = 'missing' | 'unresolved' | 'disabled' | 'shed' | 'invalid';

/** An input or fitted-module state that prevented a complete loadout calculation. */
export interface CalculationIssue {
    /** Calculation input that is missing or unavailable. */
    readonly field:
        | 'mass'
        | 'cargoCapacity'
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
 * A calculation and the evidence for whether it is complete.
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
    /** Slot key in the build's own spelling. */
    readonly slot: string;
    /** Module symbol. */
    readonly symbol: string;
    /** Post-engineering mass in tonnes, or `null` when this fitted module's mass is unknown. */
    readonly mass: number | null;
    /** Cargo tonnes; `undefined` for a non-rack and `null` for an unclassified rack. */
    readonly cargoCapacity?: number | null;
    /** Fuel tonnes; `undefined` for a non-tank and `null` for an unclassified tank. */
    readonly fuelCapacity?: number | null;
}

/** A ship's fuel-tank capacities, in tonnes. */
export interface FuelCapacity {
    /** Main tank capacity — the fuel jumps and supercruise draw from. */
    readonly main: number;
    /** Reserve tank capacity — the small emergency reserve. */
    readonly reserve: number;
}

function moduleIssue(
    module: LoadoutCalculationModule,
    field: 'mass' | 'cargoCapacity' | 'fuelCapacity',
): CalculationIssue {
    return {
        field,
        reason: 'unresolved',
        slot: module.slot,
        symbol: module.symbol,
        params: { field, reason: 'unresolved', slot: module.slot, symbol: module.symbol },
        message: `${truncate(module.slot)}: ${truncate(module.symbol)} has no known ${field}`,
    };
}

function result<T>(
    value: (T & {}) | null,
    issues: readonly CalculationIssue[],
): CalculationResult<T> {
    if (value !== null && issues.length === 0) return completeResult(value);
    if (issues.length === 0) {
        throw new TypeError('CalculationResult: an incomplete result needs at least one issue');
    }
    return incompleteResult(issues as readonly [CalculationIssue, ...CalculationIssue[]]);
}

/**
 * Sum hull and fitted-module mass.
 *
 * @param hullMass - Empty-hull mass in tonnes.
 * @param modules - Resolved fitted-module contributions.
 * @returns Mass in tonnes, or a result listing every missing dependency.
 * @example
 * ```ts
 * import { calculateUnladenMass } from '@elite-dangerous-almanac/core/ships/loadout-calculations';
 *
 * const result = calculateUnladenMass(25, [{ slot: 'Radar', symbol: 'sensors', mass: 2 }]);
 * if (result.complete) result.value; // -> 27 tonnes; narrowed to number
 * ```
 */
export function calculateUnladenMass(
    hullMass: number,
    modules: readonly LoadoutCalculationModule[],
): CalculationResult<number> {
    const issues: CalculationIssue[] = [];
    let value = hullMass;
    for (const module of modules) {
        if (module.mass === null) issues.push(moduleIssue(module, 'mass'));
        else value += module.mass;
    }
    return result(issues.length === 0 ? value : null, Object.freeze(issues));
}

/**
 * Sum fitted cargo racks.
 *
 * @param modules - Resolved fitted-module contributions.
 * @returns Cargo capacity in tonnes. A build with no rack is the complete value `0`.
 * @example
 * ```ts
 * import { calculateCargoCapacity } from '@elite-dangerous-almanac/core/ships/loadout-calculations';
 *
 * calculateCargoCapacity([]).value; // -> 0, a complete result
 * ```
 */
export function calculateCargoCapacity(
    modules: readonly LoadoutCalculationModule[],
): CalculationResult<number> {
    const issues: CalculationIssue[] = [];
    let value = 0;
    for (const module of modules) {
        if (module.cargoCapacity === null) issues.push(moduleIssue(module, 'cargoCapacity'));
        else if (module.cargoCapacity !== undefined) value += module.cargoCapacity;
    }
    return result(issues.length === 0 ? value : null, Object.freeze(issues));
}

/**
 * Sum fitted fuel tanks and the hull reserve.
 *
 * @param reserveFuelCapacity - Hull reserve in tonnes.
 * @param modules - Resolved fitted-module contributions.
 * @returns Main and reserve capacity. No fitted tank is the complete main value `0`.
 * @example
 * ```ts
 * import { calculateFuelCapacity } from '@elite-dangerous-almanac/core/ships/loadout-calculations';
 *
 * const result = calculateFuelCapacity(0.3, [
 *   { slot: 'FuelTank', symbol: 'tank', mass: 2, fuelCapacity: 4 },
 * ]);
 * if (result.complete) result.value.main; // -> 4 tonnes
 * ```
 */
export function calculateFuelCapacity(
    reserveFuelCapacity: number,
    modules: readonly LoadoutCalculationModule[],
): CalculationResult<FuelCapacity> {
    const issues: CalculationIssue[] = [];
    let main = 0;
    for (const module of modules) {
        if (module.fuelCapacity === null) issues.push(moduleIssue(module, 'fuelCapacity'));
        else if (module.fuelCapacity !== undefined) main += module.fuelCapacity;
    }
    return result(
        issues.length === 0 ? Object.freeze({ main, reserve: reserveFuelCapacity }) : null,
        Object.freeze(issues),
    );
}
