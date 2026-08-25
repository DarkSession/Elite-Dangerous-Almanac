/**
 * The power-law mass curve a thruster's performance multiplier and a shield generator's
 * strength multiplier are both read off, and the validation that decides a curve is
 * physical at all.
 *
 * The curve passes through three declared points — `(minMass, maxMultiplier)`,
 * `(optMass, optMultiplier)` and `(maxMass, minMultiplier)`. Normalize the mass into
 * `[0, 1]` between `maxMass` and `minMass`, raise it to the exponent that makes the
 * curve pass through the optimal point, then interpolate between `minMultiplier` and
 * `maxMultiplier`.
 *
 * Both public callers share one failure model: a well-formed but non-physical curve is a
 * `RangeError`, never a fabricated multiplier. Every message names the *public* function
 * the consumer called and the *public* parameter that carried the bad value, so a caller
 * who reaches this module through `mobilityMetrics` or `shieldMetrics` is never told
 * about a helper they did not call.
 *
 * Reference implementations: EDCD/Coriolis and EDSY; credit and licence terms are in
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @internal
 */

/**
 * The three masses and three multipliers one power-law mass curve passes through.
 *
 * Masses must be strictly ordered `minMass < optMass < maxMass`, or all equal for a
 * constant curve; multipliers likewise `minMultiplier < optMultiplier < maxMultiplier`,
 * or all equal. An all-equal mass curve must have equal multipliers — three different
 * multipliers at one mass is not a curve.
 */
export interface MassCurve {
    /** Mass at which performance reaches {@link maxMultiplier}, in tonnes. */
    readonly minMass: number;
    /** Mass at which performance is exactly {@link optMultiplier}, in tonnes. */
    readonly optMass: number;
    /** Mass beyond which the curve contributes nothing, in tonnes. */
    readonly maxMass: number;
    /** Multiplier at {@link maxMass}. */
    readonly minMultiplier: number;
    /** Multiplier at {@link optMass}. */
    readonly optMultiplier: number;
    /** Multiplier at {@link minMass}. */
    readonly maxMultiplier: number;
}

/**
 * How a failure names the call that produced it — always the public one.
 *
 * A consumer who called `shieldMetrics` reads `shieldMetrics: generator: …`, not the
 * name of whatever this module was reached through.
 */
export interface MassCurveLabels {
    /** The public function the consumer called, e.g. `'shieldMassCurveMultiplier'`. */
    readonly scope: string;
    /** The public parameter carrying the mass, e.g. `'hullMass'`. */
    readonly mass: string;
    /** The public parameter carrying the curve, e.g. `'generator'`. */
    readonly curve: string;
}

/**
 * Require a finite, non-negative number.
 *
 * @param scope - The public function to name, e.g. `'mobilityMetrics'`.
 * @param name - The public parameter or field to name.
 * @param value - The value as received.
 * @throws {RangeError} If `value` is not a finite number of zero or more.
 */
export function requireFiniteNonNegative(scope: string, name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${scope}: ${name} must be a finite non-negative number`);
    }
}

/**
 * Establish that a curve is physical before anything reads a multiplier off it.
 *
 * @param label - How to name the curve in a failure, `"function: parameter"` — the
 * public function the consumer called and the public parameter that carried the curve.
 * @param curve - The curve as received.
 * @throws {RangeError} If a curve value is not finite and non-negative, or the masses or
 * multipliers do not follow the ordering documented by {@link MassCurve}.
 */
export function validateMassCurve(label: string, curve: MassCurve): void {
    for (const field of ['minMass', 'optMass', 'maxMass'] as const) {
        requireFiniteNonNegative(label, field, curve[field]);
    }
    const allMassesEqual = curve.minMass === curve.optMass && curve.optMass === curve.maxMass;
    if (!allMassesEqual && !(curve.minMass < curve.optMass && curve.optMass < curve.maxMass)) {
        throw new RangeError(
            `${label}: masses must be strictly ordered minMass < optMass < maxMass, or all equal`,
        );
    }
    for (const field of ['minMultiplier', 'optMultiplier', 'maxMultiplier'] as const) {
        requireFiniteNonNegative(label, field, curve[field]);
    }
    const allMultipliersEqual =
        curve.minMultiplier === curve.optMultiplier && curve.optMultiplier === curve.maxMultiplier;
    const strictlyOrderedMultipliers =
        curve.minMultiplier < curve.optMultiplier && curve.optMultiplier < curve.maxMultiplier;
    if (!allMultipliersEqual && !strictlyOrderedMultipliers) {
        throw new RangeError(
            `${label}: multipliers must be strictly ordered minMultiplier < optMultiplier < maxMultiplier, or all equal`,
        );
    }
    if (allMassesEqual && !allMultipliersEqual) {
        throw new RangeError(`${label}: an all-equal mass curve must have equal multipliers`);
    }
}

/**
 * Read the multiplier off a validated power-law mass curve.
 *
 * @param labels - The public names a failure reports — see {@link MassCurveLabels}.
 * @param mass - The mass to evaluate the curve at, in tonnes.
 * @param curve - The curve, post-engineering.
 * @returns The curve's multiplier at `mass`, and `0` past `maxMass` — beyond its rated
 * mass the curve contributes nothing rather than a fabricated value.
 * @throws {RangeError} If `mass` is not finite and non-negative, or the curve is not
 * physical — see {@link validateMassCurve}.
 */
export function massCurveMultiplier(
    labels: MassCurveLabels,
    mass: number,
    curve: MassCurve,
): number {
    requireFiniteNonNegative(labels.scope, labels.mass, mass);
    validateMassCurve(`${labels.scope}: ${labels.curve}`, curve);
    if (mass > curve.maxMass) return 0;
    const span = curve.maxMass - curve.minMass;
    if (span <= 0 || curve.maxMultiplier === curve.minMultiplier) return curve.optMultiplier;
    const normalised = Math.max(0, Math.min(1, (curve.maxMass - mass) / span));
    const optNormalised = Math.min(1, (curve.maxMass - curve.optMass) / span);
    const exponent =
        Math.log(
            (curve.optMultiplier - curve.minMultiplier) /
                (curve.maxMultiplier - curve.minMultiplier),
        ) / Math.log(optNormalised);
    if (!Number.isFinite(exponent)) {
        // Reachable only where the optimal point rounds onto an endpoint under division
        // — the curve is well-ordered and still has no exponent that fits it.
        throw new RangeError(`${labels.scope}: curve values do not produce a finite exponent`);
    }
    return (
        curve.minMultiplier +
        Math.pow(normalised, exponent) * (curve.maxMultiplier - curve.minMultiplier)
    );
}
