/**
 * **The ENG capacitor** — speed and handling at a chosen ENG-pip allocation.
 *
 * A hull publishes two endpoints for each of speed, pitch, roll and yaw: the figure at
 * **no** ENG pips (`minimumSpeed`, `minPitch`, `minRoll`, `minYaw`) and the figure at
 * **four** (`maximumSpeed`, `pitch`, `roll`, `yaw`). The allocation interpolates
 * linearly between them, and the fitted thruster's mass curves are applied to the
 * result:
 *
 * ```text
 * speed = (minimumSpeed + (maximumSpeed − minimumSpeed) × pips / 4) × speedCurve(mass)
 * ```
 *
 * Boost does **not** move with the pips, so it is not reported here — it is on
 * {@link MobilityMetrics.boost}, along with the loaded mass and the two curve
 * multipliers these figures share.
 *
 * This module is data-free. {@link BuildMetrics.mobilityCapacitorMetrics} (in
 * `./build-metrics`) reads the hull, the loaded mass and the powered thrusters out of a
 * build and calls {@link mobilityCapacitorMetrics} for you.
 *
 * @remarks
 * Reference implementations: EDCD/Coriolis and EDSY; the algorithm is ported as fact,
 * not code, and credit and licence terms are in
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @packageDocumentation
 */

import { requirePips } from './internal/pips.js';
import { resolveMobilityCurves } from './internal/mobility-core.js';
import type { MobilityInput, ThrusterParams } from './mobility.js';

/** Everything {@link mobilityCapacitorMetrics} needs about one loaded ship. */
export interface MobilityCapacitorInput extends MobilityInput {
    /** Finite pips assigned to ENG, in `[0, 4]`. Fractional pips are accepted; defaults to `4`. */
    readonly enginesPips?: number;
}

/**
 * Speed and rotation rates at one ENG-pip allocation.
 *
 * @remarks
 * Frozen — nested records and lists included — so a result can be held, cached and
 * shared without a defensive copy. Derive a changed figure with a spread rather than
 * by assigning into one.
 */
export interface MobilityCapacitorMetrics {
    /** Pips assigned to ENG for this result, in `[0, 4]`. */
    readonly enginesPips: number;
    /** Top speed at this mass and allocation, in metres per second. */
    readonly speed: number;
    /** Pitch rate at this mass and allocation, in degrees per second. */
    readonly pitch: number;
    /** Roll rate at this mass and allocation, in degrees per second. */
    readonly roll: number;
    /** Yaw rate at this mass and allocation, in degrees per second. */
    readonly yaw: number;
}

/**
 * Calculate a loaded ship's speed and rotation rates at one ENG-pip allocation.
 *
 * @param input - The same hull figures, loaded mass and fitted thrusters
 * {@link mobilityMetrics} takes, plus the allocation to model.
 * @returns The {@link MobilityCapacitorMetrics}, or `null` without thrusters. A mass
 * above the thrusters' maximum returns zero performance rather than a fabricated curve
 * value. At four pips every figure equals its {@link MobilityMetrics} counterpart.
 * @throws {RangeError} If `enginesPips` is outside `[0, 4]`, an input is not finite or
 * is outside its documented range, or a thruster curve does not follow the ordering
 * {@link ThrusterCurveParams} documents. The pips are checked before the hull figures,
 * so a bad allocation is reported first.
 * @example
 * ```ts
 * import { mobilityCapacitorMetrics } from '@elite-dangerous-almanac/core/ships/mobility-capacitor';
 *
 * mobilityCapacitorMetrics({
 *   minimumSpeed: 100, maximumSpeed: 220, boost: 320,
 *   minPitch: 34, pitch: 42, minRoll: 110, roll: 110, minYaw: 16, yaw: 16,
 *   mass: 48,
 *   thrusters: {
 *     minMass: 24, optMass: 48, maxMass: 72,
 *     minMultiplier: 0.83, optMultiplier: 1, maxMultiplier: 1.03,
 *   },
 *   enginesPips: 2,
 * })?.speed; // -> 160
 * ```
 */
export function mobilityCapacitorMetrics(
    input: MobilityCapacitorInput & { readonly thrusters: ThrusterParams },
): MobilityCapacitorMetrics;
export function mobilityCapacitorMetrics(
    input: MobilityCapacitorInput,
): MobilityCapacitorMetrics | null;
export function mobilityCapacitorMetrics(
    input: MobilityCapacitorInput,
): MobilityCapacitorMetrics | null {
    const scope = 'mobilityCapacitorMetrics';
    const enginesPips = input.enginesPips ?? 4;
    // Named for the parameter the caller wrote, and checked before the hull so a build
    // with no thrusters still reports a bad allocation.
    requirePips(scope, 'enginesPips', enginesPips);
    const curves = resolveMobilityCurves(scope, input);
    if (!curves) return null;
    const pipMultiplier = enginesPips / 4;
    const atPips = (maximum: number, minimum: number): number =>
        minimum + (maximum - minimum) * pipMultiplier;
    return Object.freeze({
        enginesPips,
        speed: atPips(input.maximumSpeed, input.minimumSpeed) * curves.massCurveMultiplier,
        pitch: atPips(input.pitch, input.minPitch) * curves.rotationMassCurveMultiplier,
        roll: atPips(input.roll, input.minRoll) * curves.rotationMassCurveMultiplier,
        yaw: atPips(input.yaw, input.minYaw) * curves.rotationMassCurveMultiplier,
    });
}
