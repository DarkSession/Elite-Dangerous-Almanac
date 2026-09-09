using System;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>How near and how far one orbit takes a body.</summary>
/// <param name="SemiMajorAxis">The semi-major axis in metres.</param>
/// <param name="Periapsis">The nearest distance in metres.</param>
/// <param name="Apoapsis">The furthest distance in metres.</param>
/// <param name="Eccentricity">The eccentricity the extents were computed at.</param>
public sealed record OrbitExtents(
    double SemiMajorAxis,
    double Periapsis,
    double Apoapsis,
    double Eccentricity);

/// <summary>How far from a circle one orbit is.</summary>
public enum EccentricityClass
{
    /// <summary>A circle.</summary>
    Circular,

    /// <summary>Near enough a circle to look like one.</summary>
    NearlyCircular,

    /// <summary>A clearly elongated orbit.</summary>
    Eccentric,

    /// <summary>An orbit that sweeps far in and far out again.</summary>
    HighlyEccentric,
}

/// <summary>How a body's turning and its orbit keep step.</summary>
/// <param name="Rotations">The turns the body makes.</param>
/// <param name="Orbits">The orbits it makes in the same time.</param>
/// <remarks>
/// One turn to one orbit is a tidally locked body, which keeps one face towards what it
/// orbits. Three turns to two orbits is what Mercury does around the Sun.
/// </remarks>
public sealed record SpinOrbitResonance(int Rotations, int Orbits);

/// <summary>Where one orbit takes a body, and how the body turns along it.</summary>
/// <remarks>
/// Every calculation reads the figures the scan states, and answers <see langword="null"/>
/// where the body states none it can use.
/// </remarks>
public static class BodyOrbit
{
    private const int MaxResonanceTerm = 5;
    private const double ResonanceTolerance = 0.01;

    /// <summary>How near and how far one orbit takes a body.</summary>
    /// <param name="body">The body, as a scan states it.</param>
    /// <returns>
    /// The extents, or <see langword="null"/> where the body states no semi-major axis.
    /// </returns>
    /// <exception cref="ArgumentNullException">The body is absent.</exception>
    /// <remarks>A body that states no eccentricity is read as travelling a circle.</remarks>
    public static OrbitExtents? Extents(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));
        if (BodyQuantities.Positive(body.SemiMajorAxis) is not double semiMajorAxis) return null;

        double eccentricity = BodyQuantities.Finite(body.Eccentricity) ?? 0;
        return new OrbitExtents(
            semiMajorAxis,
            semiMajorAxis * (1 - eccentricity),
            semiMajorAxis * (1 + eccentricity),
            eccentricity);
    }

    /// <summary>How far from a circle one orbit is.</summary>
    /// <param name="eccentricity">The eccentricity, from zero upwards.</param>
    /// <returns>The class the eccentricity falls in.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The eccentricity is not a finite figure of zero or more.
    /// </exception>
    public static EccentricityClass ClassifyEccentricity(double eccentricity)
    {
        if (BodyQuantities.Finite(eccentricity) is null || eccentricity < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(eccentricity),
                eccentricity,
                "The eccentricity must be a finite number of zero or more.");
        }

        if (eccentricity == 0) return EccentricityClass.Circular;
        if (eccentricity < 0.4) return EccentricityClass.NearlyCircular;
        return eccentricity < 0.8 ? EccentricityClass.Eccentric : EccentricityClass.HighlyEccentric;
    }

    /// <summary>Whether a body's turning and its orbit keep step.</summary>
    /// <param name="body">The body, as a scan states it.</param>
    /// <returns>
    /// The simplest whole-number ratio within a hundredth, or <see langword="null"/> where
    /// the body states no usable period or the two keep no such step.
    /// </returns>
    /// <exception cref="ArgumentNullException">The body is absent.</exception>
    /// <remarks>
    /// Both periods are read without their signs, because a body that turns the other way
    /// keeps step just the same. Neither term goes above five.
    /// </remarks>
    public static SpinOrbitResonance? Resonance(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));

        double? rotation = BodyQuantities.Finite(body.RotationPeriod);
        double? orbital = BodyQuantities.Finite(body.OrbitalPeriod);
        if (rotation is not double rotationPeriod || orbital is not double orbitalPeriod)
        {
            return null;
        }

        if (rotationPeriod == 0 || orbitalPeriod == 0) return null;

        double rotationsPerOrbit = Math.Abs(orbitalPeriod) / Math.Abs(rotationPeriod);
        for (int orbits = 1; orbits <= MaxResonanceTerm; orbits++)
        {
            for (int rotations = 1; rotations <= MaxResonanceTerm; rotations++)
            {
                double candidate = (double)rotations / orbits;
                if (Math.Abs(candidate - rotationsPerOrbit) / candidate <= ResonanceTolerance)
                {
                    return new SpinOrbitResonance(rotations, orbits);
                }
            }
        }

        return null;
    }

    /// <summary>How fast a body's equator travels as it turns, in metres a second.</summary>
    /// <param name="body">The body, as a scan states it.</param>
    /// <returns>
    /// The speed, or <see langword="null"/> where the body states no radius, or a rotation
    /// period of zero.
    /// </returns>
    /// <exception cref="ArgumentNullException">The body is absent.</exception>
    public static double? EquatorialVelocity(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));

        double? radiusM = BodyQuantities.Positive(body.Radius);
        double? rotation = BodyQuantities.Finite(body.RotationPeriod);
        if (radiusM is not double radius
            || rotation is not double rotationPeriod
            || rotationPeriod == 0)
        {
            return null;
        }

        return 2 * Math.PI * radius / Math.Abs(rotationPeriod);
    }
}
