/**
 * Data-free speed and handling calculations for a loaded ship. Speed and angular-rate
 * endpoints interpolate linearly by the ENG-PIP fraction before thruster mass curves
 * are applied.
 *
 * Ported from EDCD/Coriolis and cross-checked against EDSY's mass-curve calculation;
 * see [`ATTRIBUTIONS.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @packageDocumentation
 */

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
    /** Finite pips assigned to ENG, in `[0, 4]`. Defaults to `4`. */
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

const requireFiniteNonNegative = (scope: string, name: string, value: number): void => {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${scope}: ${name} must be a finite non-negative number`);
    }
};

const requireFiniteRange = (
    scope: string,
    name: string,
    value: number,
    minimum: number,
    maximum: number,
): void => {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
        throw new RangeError(
            `${scope}: ${name} must be a finite number from ${minimum} to ${maximum}`,
        );
    }
};

const validateCurve = (scope: string, curve: ThrusterCurveParams): void => {
    for (const field of ['minMass', 'optMass', 'maxMass'] as const) {
        requireFiniteNonNegative(scope, field, curve[field]);
    }
    const allMassesEqual = curve.minMass === curve.optMass && curve.optMass === curve.maxMass;
    if (!allMassesEqual && !(curve.minMass < curve.optMass && curve.optMass < curve.maxMass)) {
        throw new RangeError(
            `${scope}: masses must be strictly ordered minMass < optMass < maxMass, or all equal`,
        );
    }
    for (const field of ['minMultiplier', 'optMultiplier', 'maxMultiplier'] as const) {
        requireFiniteNonNegative(scope, field, curve[field]);
    }
    const allMultipliersEqual =
        curve.minMultiplier === curve.optMultiplier && curve.optMultiplier === curve.maxMultiplier;
    const strictlyOrderedMultipliers =
        curve.minMultiplier < curve.optMultiplier && curve.optMultiplier < curve.maxMultiplier;
    if (!allMultipliersEqual && !strictlyOrderedMultipliers) {
        throw new RangeError(
            `${scope}: multipliers must be strictly ordered minMultiplier < optMultiplier < maxMultiplier, or all equal`,
        );
    }
    if (allMassesEqual && !allMultipliersEqual) {
        throw new RangeError(`${scope}: an all-equal mass curve must have equal multipliers`);
    }
};

const curveMultiplier = (scope: string, mass: number, thrusters: ThrusterCurveParams): number => {
    requireFiniteNonNegative(scope, 'mass', mass);
    validateCurve(`${scope}: thrusters`, thrusters);
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
    if (!Number.isFinite(exponent)) {
        throw new RangeError(`${scope}: curve values do not produce a finite exponent`);
    }
    return (
        thrusters.minMultiplier +
        Math.pow(normalised, exponent) * (thrusters.maxMultiplier - thrusters.minMultiplier)
    );
};

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
 * Calculate a loaded ship's top speed, boost speed and rotation rates.
 *
 * @remarks
 * Speed, pitch, roll and yaw interpolate linearly from their installed zero-ENG-PIP
 * endpoints to their four-PIP endpoints. The fitted thruster's speed and rotation
 * mass-curve multipliers are then applied to those interpolated hull values. Boost is
 * independent of ENG allocation and uses the speed curve at the loaded mass.
 *
 * @param input - Hull figures, loaded mass, fitted thrusters and ENG pips.
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
    const pips = input.enginesPips ?? 4;
    requireFiniteRange('mobilityMetrics', 'enginesPips', pips, 0, 4);
    for (const field of [
        'minimumSpeed',
        'maximumSpeed',
        'boost',
        'pitch',
        'roll',
        'yaw',
        'mass',
    ] as const) {
        requireFiniteNonNegative('mobilityMetrics', field, input[field]);
    }
    if (input.minimumSpeed > input.maximumSpeed) {
        throw new RangeError('mobilityMetrics: minimumSpeed must not exceed maximumSpeed');
    }
    for (const [minimum, maximum] of [
        ['minPitch', 'pitch'],
        ['minRoll', 'roll'],
        ['minYaw', 'yaw'],
    ] as const) {
        requireFiniteRange('mobilityMetrics', minimum, input[minimum], 0, input[maximum]);
    }
    if (!input.thrusters) return null;
    validateCurve('mobilityMetrics: thrusters', input.thrusters);
    const massCurveMultiplier = curveMultiplier(
        'mobilityMetrics: speed curve',
        input.mass,
        input.thrusters.speedCurve ?? input.thrusters,
    );
    const rotationMassCurveMultiplier = curveMultiplier(
        'mobilityMetrics: rotation curve',
        input.mass,
        input.thrusters.rotationCurve ?? input.thrusters,
    );
    const pipMultiplier = pips / 4;
    const speedAtPips =
        input.minimumSpeed + (input.maximumSpeed - input.minimumSpeed) * pipMultiplier;
    const handlingAtPips = (maximum: number, minimum: number): number =>
        minimum + (maximum - minimum) * pipMultiplier;
    return {
        speed: speedAtPips * massCurveMultiplier,
        boost: input.boost * massCurveMultiplier,
        pitch: handlingAtPips(input.pitch, input.minPitch) * rotationMassCurveMultiplier,
        roll: handlingAtPips(input.roll, input.minRoll) * rotationMassCurveMultiplier,
        yaw: handlingAtPips(input.yaw, input.minYaw) * rotationMassCurveMultiplier,
        massCurveMultiplier,
        rotationMassCurveMultiplier,
    };
}
