/**
 * Data-free speed and handling calculations for a loaded ship.
 *
 * Ported from EDCD/Coriolis and cross-checked against EDSY's mass-curve calculation;
 * see [`ATTRIBUTIONS.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @packageDocumentation
 */

/** One post-engineering thruster performance curve. */
export interface ThrusterCurveParams {
    /** Loaded mass at which performance reaches {@link maxMultiplier}, in tonnes. */
    readonly minMass: number;
    /** Loaded mass at which performance is exactly {@link optMultiplier}, in tonnes. */
    readonly optMass: number;
    /** Maximum loaded mass the thrusters can move, in tonnes. */
    readonly maxMass: number;
    /** Performance multiplier at {@link maxMass}. */
    readonly minMultiplier: number;
    /** Performance multiplier at {@link optMass}. */
    readonly optMultiplier: number;
    /** Performance multiplier at {@link minMass}. */
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
    /** Hull top speed at the thruster curve's `1` multiplier and four ENG pips, in m/s. */
    readonly speed: number;
    /** Hull boost speed at the thruster curve's `1` multiplier, in m/s. */
    readonly boost: number;
    /** Hull pitch rate at the thruster curve's `1` multiplier and four ENG pips, in °/s. */
    readonly pitch: number;
    /** Hull pitch rate at zero ENG pips, in °/s from `0` through {@link pitch}. */
    readonly minPitch?: number;
    /** Hull roll rate at the thruster curve's `1` multiplier and four ENG pips, in °/s. */
    readonly roll: number;
    /** Hull roll rate at zero ENG pips, in °/s from `0` through {@link roll}. */
    readonly minRoll?: number;
    /** Hull yaw rate at the thruster curve's `1` multiplier and four ENG pips, in °/s. */
    readonly yaw: number;
    /** Hull yaw rate at zero ENG pips, in °/s from `0` through {@link yaw}. */
    readonly minYaw?: number;
    /** Minimum thrust at zero ENG pips, as a percentage in `[0, 100]`. */
    readonly minThrust: number;
    /**
     * Fraction of four-pip rotation lost for each missing ENG pip. Defaults to `0` and
     * is overridden per axis by a corresponding `minPitch`, `minRoll` or `minYaw`.
     */
    readonly pipSpeed?: number;
    /** Loaded mass — hull, modules, fuel and cargo — in tonnes. */
    readonly mass: number;
    /** The fitted thrusters' post-engineering curve, or no curve when none are fitted. */
    readonly thrusters?: ThrusterParams | null;
    /** Pips assigned to ENG, in `[0, 4]`. Defaults to `4`. */
    readonly enginesPips?: number;
}

/** Speed and rotation rates for one loaded ship. */
export interface MobilityMetrics {
    /** Top speed at this mass and ENG allocation, in metres per second. */
    readonly speed: number;
    /** Boost speed at this mass, in metres per second. */
    readonly boost: number;
    /** Pitch rate at this mass and ENG allocation, in degrees per second. */
    readonly pitch: number;
    /** Roll rate at this mass and ENG allocation, in degrees per second. */
    readonly roll: number;
    /** Yaw rate at this mass and ENG allocation, in degrees per second. */
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
    if (mass > thrusters.maxMass) return 0;
    const span = thrusters.maxMass - thrusters.minMass;
    if (span <= 0 || thrusters.maxMultiplier === thrusters.minMultiplier) {
        return thrusters.optMultiplier;
    }
    const normalised = Math.max(0, Math.min(1, (thrusters.maxMass - mass) / span));
    const optNormalised = Math.min(1, (thrusters.maxMass - thrusters.optMass) / span);
    const exponent =
        Math.log(
            (thrusters.optMultiplier - thrusters.minMultiplier) /
                (thrusters.maxMultiplier - thrusters.minMultiplier),
        ) / Math.log(optNormalised);
    if (!Number.isFinite(exponent)) return thrusters.optMultiplier;
    return (
        thrusters.minMultiplier +
        Math.pow(normalised, exponent) * (thrusters.maxMultiplier - thrusters.minMultiplier)
    );
}

/**
 * Calculate a loaded ship's top speed, boost speed and rotation rates.
 *
 * @param input - Hull figures, loaded mass, fitted thrusters and ENG pips.
 * @returns The build's {@link MobilityMetrics}, or `null` without thrusters. A mass above
 * the thrusters' maximum returns zero performance rather than a fabricated curve value.
 * @throws {RangeError} If `enginesPips` is outside `[0, 4]` or not finite.
 * @example
 * ```ts
 * import { mobilityMetrics } from '@elite-dangerous-almanac/core/ships/mobility';
 *
 * mobilityMetrics({
 *   speed: 220, boost: 320, pitch: 42, roll: 110, yaw: 16,
 *   minThrust: 45.454, mass: 48,
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
    const pips = input.enginesPips ?? 4;
    if (!Number.isFinite(pips) || pips < 0 || pips > 4) {
        throw new RangeError('mobilityMetrics: enginesPips must be a finite number from 0 to 4');
    }
    if (!input.thrusters) return null;
    const massCurveMultiplier = thrusterMassCurveMultiplier(
        input.mass,
        input.thrusters.speedCurve ?? input.thrusters,
    );
    const rotationMassCurveMultiplier = thrusterMassCurveMultiplier(
        input.mass,
        input.thrusters.rotationCurve ?? input.thrusters,
    );
    const pipMultiplier = pips / 4;
    const minimum = input.minThrust / 100;
    const speedMultiplier = pipMultiplier + minimum * (1 - pipMultiplier);
    const handlingAtPips = (maximum: number, minimum: number | undefined): number =>
        minimum === undefined
            ? maximum * (1 - (input.pipSpeed ?? 0) * (4 - pips))
            : minimum + (maximum - minimum) * pipMultiplier;
    return {
        speed: input.speed * massCurveMultiplier * speedMultiplier,
        boost: input.boost * massCurveMultiplier,
        pitch: handlingAtPips(input.pitch, input.minPitch) * rotationMassCurveMultiplier,
        roll: handlingAtPips(input.roll, input.minRoll) * rotationMassCurveMultiplier,
        yaw: handlingAtPips(input.yaw, input.minYaw) * rotationMassCurveMultiplier,
        massCurveMultiplier,
        rotationMassCurveMultiplier,
    };
}
