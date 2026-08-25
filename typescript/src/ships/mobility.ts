/**
 * Data-free speed and handling calculations for a loaded ship, at **full ENG** — the
 * hull's four-pip endpoints with the fitted thruster mass curves applied.
 *
 * The ENG capacitor is a separate story with its own entry point,
 * `./mobility-capacitor`, which interpolates the hull's zero-pip endpoints towards the
 * four-pip ones before the same curves are applied.
 *
 * Ported from EDCD/Coriolis and cross-checked against EDSY's mass-curve calculation;
 * see [`ATTRIBUTIONS.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @packageDocumentation
 */

import { curveMultiplier, resolveMobilityCurves } from './internal/mobility-core.js';

/**
 * One post-engineering thruster performance curve.
 *
 * Masses must be strictly ordered `minMass < optMass < maxMass`. The all-equal
 * mass form is accepted only for a constant curve. Multipliers must be strictly
 * ordered `minMultiplier < optMultiplier < maxMultiplier`, or all equal for a
 * constant curve.
 */
export interface ThrusterCurveParams {
    /** Finite non-negative loaded mass at which performance reaches {@link maxMultiplier}, in tonnes. */
    readonly minMass: number;
    /** Finite non-negative loaded mass at which performance is exactly {@link optMultiplier}, in tonnes. */
    readonly optMass: number;
    /** Finite non-negative maximum loaded mass the thrusters can move, in tonnes. */
    readonly maxMass: number;
    /** Finite non-negative performance multiplier at {@link maxMass}. */
    readonly minMultiplier: number;
    /** Finite non-negative performance multiplier at {@link optMass}. */
    readonly optMultiplier: number;
    /** Finite non-negative performance multiplier at {@link minMass}. */
    readonly maxMultiplier: number;
}

/** A fitted thruster's post-engineering mass curves. */
export interface ThrusterParams extends ThrusterCurveParams {
    /** Optional speed/boost curve; enhanced-performance thrusters differ from handling. */
    readonly speedCurve?: ThrusterCurveParams;
    /** Optional pitch/roll/yaw curve; enhanced-performance thrusters differ from speed. */
    readonly rotationCurve?: ThrusterCurveParams;
}

/** Everything {@link mobilityMetrics} needs about one loaded ship. */
export interface MobilityInput {
    /** Finite non-negative hull speed at multiplier `1` and zero ENG pips, in m/s. */
    readonly minimumSpeed: number;
    /** Finite hull speed at multiplier `1` and four ENG pips, in m/s, at least {@link minimumSpeed}. */
    readonly maximumSpeed: number;
    /** Finite non-negative hull boost speed at the thruster curve's `1` multiplier, in m/s. */
    readonly boost: number;
    /** Finite non-negative pitch rate at multiplier `1` and four ENG pips, in °/s. */
    readonly pitch: number;
    /** Finite hull pitch rate at zero ENG pips, in °/s from `0` through {@link pitch}. */
    readonly minPitch: number;
    /** Finite non-negative roll rate at multiplier `1` and four ENG pips, in °/s. */
    readonly roll: number;
    /** Finite hull roll rate at zero ENG pips, in °/s from `0` through {@link roll}. */
    readonly minRoll: number;
    /** Finite non-negative yaw rate at multiplier `1` and four ENG pips, in °/s. */
    readonly yaw: number;
    /** Finite hull yaw rate at zero ENG pips, in °/s from `0` through {@link yaw}. */
    readonly minYaw: number;
    /** Finite non-negative loaded mass — hull, modules, fuel and cargo — in tonnes. */
    readonly mass: number;
    /** The fitted thrusters' post-engineering curve, or no curve when none are fitted. */
    readonly thrusters?: ThrusterParams | null;
}

/**
 * Speed and rotation rates for one loaded ship.
 *
 * @remarks
 * Frozen — nested records and lists included — so a result can be held, cached and
 * shared without a defensive copy. Derive a changed figure with a spread rather than
 * by assigning into one.
 */
export interface MobilityMetrics {
    /**
     * The loaded mass these figures were calculated at, in tonnes — the
     * {@link MobilityInput.mass} that went in.
     *
     * @remarks
     * Reported so a build-level caller, which never states the mass itself, can read
     * what the curve was evaluated at. Against the fitted curve's `optMass` and
     * `maxMass` it is the build's position on that curve: at or below `optMass` the
     * thrusters are at or above their rated performance, and past `maxMass` they do not
     * move the ship at all — {@link massCurveMultiplier} is `0` there.
     */
    readonly loadedMass: number;
    /** Top speed at this mass and **four** ENG pips, in metres per second. */
    readonly speed: number;
    /** Boost speed at this mass, in metres per second. Boost ignores the ENG allocation. */
    readonly boost: number;
    /** Pitch rate at this mass and **four** ENG pips, in degrees per second. */
    readonly pitch: number;
    /** Roll rate at this mass and **four** ENG pips, in degrees per second. */
    readonly roll: number;
    /** Yaw rate at this mass and **four** ENG pips, in degrees per second. */
    readonly yaw: number;
    /** The thruster mass curve's performance multiplier at this loaded mass. */
    readonly massCurveMultiplier: number;
    /** The rotation curve's multiplier; differs for enhanced-performance thrusters. */
    readonly rotationMassCurveMultiplier: number;
}

/**
 * Resolve a thruster's performance multiplier at a loaded mass.
 *
 * @param mass - Loaded mass in tonnes.
 * @param thrusters - The fitted thruster curve, post-engineering.
 * @returns The curve multiplier, or `0` above the thrusters' maximum supported mass.
 * @throws {RangeError} If mass or a curve value is not finite and non-negative, or
 * the curve masses or multipliers do not follow the ordering documented by
 * {@link ThrusterCurveParams}.
 * @example
 * ```ts
 * import { thrusterMassCurveMultiplier } from '@elite-dangerous-almanac/core/ships/mobility';
 *
 * thrusterMassCurveMultiplier(48, {
 *   minMass: 24, optMass: 48, maxMass: 72,
 *   minMultiplier: 0.83, optMultiplier: 1, maxMultiplier: 1.03,
 * }); // -> 1
 * ```
 */
export function thrusterMassCurveMultiplier(mass: number, thrusters: ThrusterCurveParams): number {
    return curveMultiplier('thrusterMassCurveMultiplier', mass, thrusters);
}

/**
 * Calculate a loaded ship's top speed, boost speed and rotation rates at **full ENG**.
 *
 * @remarks
 * Speed, pitch, roll and yaw are the hull's four-ENG-PIP endpoints with the fitted
 * thruster's speed and rotation mass-curve multipliers applied. Boost is independent of
 * the ENG allocation and uses the speed curve at the loaded mass, so it is the same
 * figure whatever the pips.
 *
 * A **lower** allocation is {@link mobilityCapacitorMetrics}: it interpolates each figure
 * from the hull's zero-pip endpoint (`minimumSpeed`, `minPitch`, `minRoll`, `minYaw`)
 * towards the endpoint used here, and applies the same curves.
 *
 * @param input - Hull figures, loaded mass and fitted thrusters.
 * @returns The build's {@link MobilityMetrics}, or `null` without thrusters. A mass above
 * the thrusters' maximum returns zero performance rather than a fabricated curve value.
 * @throws {RangeError} If an input is not finite or is outside its documented range,
 * or a thruster curve does not follow the ordering documented by
 * {@link ThrusterCurveParams}.
 * @example
 * ```ts
 * import { mobilityMetrics } from '@elite-dangerous-almanac/core/ships/mobility';
 *
 * mobilityMetrics({
 *   minimumSpeed: 100, maximumSpeed: 220, boost: 320,
 *   minPitch: 34, pitch: 42, minRoll: 110, roll: 110, minYaw: 16, yaw: 16,
 *   mass: 48,
 *   thrusters: {
 *     minMass: 24, optMass: 48, maxMass: 72,
 *     minMultiplier: 0.83, optMultiplier: 1, maxMultiplier: 1.03,
 *   },
 * }).speed; // -> 220
 * ```
 */
export function mobilityMetrics(
    input: MobilityInput & { readonly thrusters: ThrusterParams },
): MobilityMetrics;
export function mobilityMetrics(input: MobilityInput): MobilityMetrics | null;
export function mobilityMetrics(input: MobilityInput): MobilityMetrics | null {
    const curves = resolveMobilityCurves('mobilityMetrics', input);
    if (!curves) return null;
    const { massCurveMultiplier, rotationMassCurveMultiplier } = curves;
    return Object.freeze({
        loadedMass: input.mass,
        speed: input.maximumSpeed * massCurveMultiplier,
        boost: input.boost * massCurveMultiplier,
        pitch: input.pitch * rotationMassCurveMultiplier,
        roll: input.roll * rotationMassCurveMultiplier,
        yaw: input.yaw * rotationMassCurveMultiplier,
        massCurveMultiplier,
        rotationMassCurveMultiplier,
    });
}
