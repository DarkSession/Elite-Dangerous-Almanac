namespace EliteDangerousAlmanac.Ships;

/// <summary>The three masses and three multipliers one power-law mass curve passes through.</summary>
/// <remarks>
/// <para>
/// A thruster's performance multiplier and a shield generator's strength multiplier are read off
/// the same curve. Normalise the mass into the range from zero through one, between the maximum
/// and the minimum mass. Raise it to the exponent that makes the curve pass through the optimal
/// point. Then interpolate between the minimum and the maximum multiplier.
/// </para>
/// <para>
/// The masses must be in strict order, from the minimum through the optimum to the maximum, or
/// all three equal for a constant curve. The multipliers follow the same rule. A curve whose
/// masses are all equal must have equal multipliers, because three different multipliers at one
/// mass is not a curve.
/// </para>
/// </remarks>
public interface IMassCurve
{
    /// <summary>The mass at which performance reaches <see cref="MaxMultiplier"/>, in tonnes.</summary>
    double MinMass { get; }

    /// <summary>The mass at which performance is exactly <see cref="OptMultiplier"/>, in tonnes.</summary>
    double OptMass { get; }

    /// <summary>The mass beyond which the curve contributes nothing, in tonnes.</summary>
    double MaxMass { get; }

    /// <summary>The multiplier at <see cref="MaxMass"/>.</summary>
    double MinMultiplier { get; }

    /// <summary>The multiplier at <see cref="OptMass"/>.</summary>
    double OptMultiplier { get; }

    /// <summary>The multiplier at <see cref="MinMass"/>.</summary>
    double MaxMultiplier { get; }
}
