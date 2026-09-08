using System;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>
/// The power-law mass curve a thruster and a shield generator are both read off, and the check
/// that decides a curve is physical at all.
/// </summary>
/// <remarks>
/// <para>
/// Both public callers share one failure model. A well-formed but non-physical curve is an
/// <see cref="ArgumentOutOfRangeException"/>, never a fabricated multiplier.
/// </para>
/// <para>
/// Reference implementations: EDCD/Coriolis and EDSY. See <c>ATTRIBUTIONS.md</c> for credit and
/// licence terms.
/// </para>
/// </remarks>
internal static class MassCurve
{
    /// <summary>Establishes that a curve is physical before anything reads a multiplier off it.</summary>
    /// <param name="curve">The curve as received.</param>
    /// <param name="name">The parameter to name in a failure.</param>
    /// <exception cref="ArgumentNullException"><paramref name="curve"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A curve value is not finite and zero or more, or the masses or the multipliers are not in
    /// the order <see cref="IMassCurve"/> documents.
    /// </exception>
    internal static void Validate(IMassCurve curve, string name)
    {
        if (curve is null) throw new ArgumentNullException(name);

        RangeGuards.RequireFiniteNonNegative(curve.MinMass, $"{name}.{nameof(IMassCurve.MinMass)}");
        RangeGuards.RequireFiniteNonNegative(curve.OptMass, $"{name}.{nameof(IMassCurve.OptMass)}");
        RangeGuards.RequireFiniteNonNegative(curve.MaxMass, $"{name}.{nameof(IMassCurve.MaxMass)}");

        bool massesEqual = curve.MinMass == curve.OptMass && curve.OptMass == curve.MaxMass;
        if (!massesEqual && !(curve.MinMass < curve.OptMass && curve.OptMass < curve.MaxMass))
        {
            throw new ArgumentOutOfRangeException(
                name,
                curve,
                "The masses must be in strict order, from the minimum through the optimum to the maximum, or all equal.");
        }

        RangeGuards.RequireFiniteNonNegative(
            curve.MinMultiplier, $"{name}.{nameof(IMassCurve.MinMultiplier)}");
        RangeGuards.RequireFiniteNonNegative(
            curve.OptMultiplier, $"{name}.{nameof(IMassCurve.OptMultiplier)}");
        RangeGuards.RequireFiniteNonNegative(
            curve.MaxMultiplier, $"{name}.{nameof(IMassCurve.MaxMultiplier)}");

        bool multipliersEqual =
            curve.MinMultiplier == curve.OptMultiplier && curve.OptMultiplier == curve.MaxMultiplier;
        bool multipliersOrdered =
            curve.MinMultiplier < curve.OptMultiplier && curve.OptMultiplier < curve.MaxMultiplier;
        if (!multipliersEqual && !multipliersOrdered)
        {
            throw new ArgumentOutOfRangeException(
                name,
                curve,
                "The multipliers must be in strict order, from the minimum through the optimum to the maximum, or all equal.");
        }

        if (massesEqual && !multipliersEqual)
        {
            throw new ArgumentOutOfRangeException(
                name, curve, "A curve whose masses are all equal must have equal multipliers.");
        }
    }

    /// <summary>Reads the multiplier off a mass curve.</summary>
    /// <param name="mass">The mass to evaluate the curve at, in tonnes.</param>
    /// <param name="curve">The curve, post-engineering.</param>
    /// <param name="massName">The parameter that carries the mass, to name in a failure.</param>
    /// <param name="curveName">The parameter that carries the curve, to name in a failure.</param>
    /// <returns>
    /// The curve's multiplier at the mass, and zero past the maximum mass. Beyond its rated mass
    /// the curve contributes nothing rather than a fabricated value.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="curve"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The mass is not finite and zero or more, or the curve is not physical.
    /// </exception>
    internal static double MultiplierAt(double mass, IMassCurve curve, string massName, string curveName)
    {
        RangeGuards.RequireFiniteNonNegative(mass, massName);
        Validate(curve, curveName);
        if (mass > curve.MaxMass) return 0;

        double span = curve.MaxMass - curve.MinMass;
        if (span <= 0 || curve.MaxMultiplier == curve.MinMultiplier) return curve.OptMultiplier;

        double normalised = Math.Max(0, Math.Min(1, (curve.MaxMass - mass) / span));
        double optNormalised = Math.Min(1, (curve.MaxMass - curve.OptMass) / span);
        double exponent = Math.Log(
            (curve.OptMultiplier - curve.MinMultiplier) / (curve.MaxMultiplier - curve.MinMultiplier))
            / Math.Log(optNormalised);
        if (double.IsNaN(exponent) || double.IsInfinity(exponent))
        {
            // This is reachable only where the optimal point rounds onto an endpoint under
            // division. The curve is well ordered and still has no exponent that fits it.
            throw new ArgumentOutOfRangeException(
                curveName, curve, "The curve values do not produce a finite exponent.");
        }

        return curve.MinMultiplier
            + (Math.Pow(normalised, exponent) * (curve.MaxMultiplier - curve.MinMultiplier));
    }
}
