/**
 * The validation and thruster mass curves shared by `../mobility` and
 * `../mobility-capacitor`.
 *
 * Both entry points read the same hull endpoints, the same loaded mass and the same
 * fitted curve; only what they do with the ENG allocation differs. The rules are written
 * once here so the two cannot drift, and each is told the **public** function name to
 * put in a message — a hull figure rejected inside `mobilityCapacitorMetrics` says
 * `mobilityCapacitorMetrics`, never a helper.
 *
 * @internal
 */

import { massCurveMultiplier, requireFiniteNonNegative, validateMassCurve } from './mass-curve.js';
import type { MobilityInput, ThrusterCurveParams } from '../mobility.js';

/** The two thruster multipliers a loaded build sits at. */
export interface MobilityCurves {
    /** The speed curve's multiplier at the loaded mass. */
    readonly massCurveMultiplier: number;
    /** The rotation curve's multiplier; differs for enhanced-performance thrusters. */
    readonly rotationMassCurveMultiplier: number;
}

export const requireFiniteRange = (
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

export const curveMultiplier = (
    scope: string,
    mass: number,
    thrusters: ThrusterCurveParams,
): number => massCurveMultiplier({ scope, mass: 'mass', curve: 'thrusters' }, mass, thrusters);

/**
 * Check one mobility input and resolve the thrusters' two multipliers at its loaded mass.
 *
 * @param scope - The public function to name in a message.
 * @param input - The hull figures, loaded mass and fitted thruster curve.
 * @returns The two multipliers, or `null` when no thrusters are fitted. Every hull
 * figure is checked first, so a build with no thrusters still reports a bad one.
 * @throws {RangeError} If an input is not finite or is outside its documented range, or
 * a thruster curve does not follow the documented ordering.
 */
export function resolveMobilityCurves(scope: string, input: MobilityInput): MobilityCurves | null {
    for (const field of [
        'minimumSpeed',
        'maximumSpeed',
        'boost',
        'pitch',
        'roll',
        'yaw',
        'mass',
    ] as const) {
        requireFiniteNonNegative(scope, field, input[field]);
    }
    if (input.minimumSpeed > input.maximumSpeed) {
        throw new RangeError(`${scope}: minimumSpeed must not exceed maximumSpeed`);
    }
    for (const [minimum, maximum] of [
        ['minPitch', 'pitch'],
        ['minRoll', 'roll'],
        ['minYaw', 'yaw'],
    ] as const) {
        requireFiniteRange(scope, minimum, input[minimum], 0, input[maximum]);
    }
    if (!input.thrusters) return null;
    validateMassCurve(`${scope}: thrusters`, input.thrusters);
    return {
        massCurveMultiplier: curveMultiplier(
            `${scope}: speed curve`,
            input.mass,
            input.thrusters.speedCurve ?? input.thrusters,
        ),
        rotationMassCurveMultiplier: curveMultiplier(
            `${scope}: rotation curve`,
            input.mass,
            input.thrusters.rotationCurve ?? input.thrusters,
        ),
    };
}
