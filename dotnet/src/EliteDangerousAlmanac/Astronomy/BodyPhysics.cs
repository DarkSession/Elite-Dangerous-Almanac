using System;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>The two distances at which one body pulls another apart.</summary>
/// <param name="Rigid">
/// The limit for a body held together by its own strength, in metres. A solid moon can
/// hold together inside it.
/// </param>
/// <param name="Fluid">
/// The limit for a body held together by gravity alone, in metres. Nothing survives inside
/// it, which is why a ring sits there rather than a moon.
/// </param>
public sealed record RocheLimits(double Rigid, double Fluid);

/// <summary>What a scanned body weighs, how dense it is, and what it pulls on.</summary>
/// <remarks>
/// Every calculation reads the figures the scan states, and answers <see langword="null"/>
/// where the body states none it can use. A journal writes zero for a figure it does not
/// have, so a figure of zero is read as an absent one wherever a calculation needs it above
/// zero.
/// </remarks>
public static class BodyPhysics
{
    /// <summary>The gravitational constant, in cubic metres a kilogram a second squared.</summary>
    public const double GravitationalConstant = 6.6743e-11;

    /// <summary>One Earth mass in kilograms.</summary>
    public const double KilogramsPerEarthMass = 5.972e24;

    /// <summary>One solar mass in kilograms.</summary>
    public const double KilogramsPerSolarMass = 1.989e30;

    private const double RigidRocheCoefficient = 1.26;
    private const double FluidRocheCoefficient = 2.456;

    /// <summary>What one body weighs, in kilograms.</summary>
    /// <param name="body">The body, as a scan states it.</param>
    /// <returns>
    /// The mass, or <see langword="null"/> where the body states neither Earth masses nor
    /// solar masses.
    /// </returns>
    /// <exception cref="ArgumentNullException">The body is absent.</exception>
    /// <remarks>A planet states Earth masses and a star states solar masses.</remarks>
    public static double? Mass(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));
        return MassOf(body);
    }

    /// <summary>How dense one body is, in kilograms a cubic metre.</summary>
    /// <param name="body">The body, as a scan states it.</param>
    /// <returns>
    /// The density, or <see langword="null"/> where the body states no mass or no radius.
    /// </returns>
    /// <exception cref="ArgumentNullException">The body is absent.</exception>
    public static double? BulkDensity(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));
        return DensityOf(body);
    }

    /// <summary>Where one body pulls apart a satellite of a stated density.</summary>
    /// <param name="primary">The body doing the pulling, as a scan states it.</param>
    /// <param name="satelliteDensityKgM3">The satellite's density, in kilograms a cubic metre.</param>
    /// <returns>
    /// The two limits, or <see langword="null"/> where the primary states no radius or no
    /// mass.
    /// </returns>
    /// <exception cref="ArgumentNullException">The primary is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The satellite density is not a finite figure above zero.
    /// </exception>
    public static RocheLimits? RocheLimitsForDensity(
        BodyProperties primary,
        double satelliteDensityKgM3)
    {
        if (primary is null) throw new ArgumentNullException(nameof(primary));
        if (BodyQuantities.Positive(satelliteDensityKgM3) is null)
        {
            throw new ArgumentOutOfRangeException(
                nameof(satelliteDensityKgM3),
                satelliteDensityKgM3,
                "The satellite density must be a finite number above zero.");
        }

        double? primaryRadiusM = BodyQuantities.Positive(primary.Radius);
        double? primaryDensity = DensityOf(primary);
        if (primaryRadiusM is not double radius || primaryDensity is not double density)
        {
            return null;
        }

        double densityRatio = Math.Pow(density / satelliteDensityKgM3, 1d / 3d);
        return new RocheLimits(
            RigidRocheCoefficient * radius * densityRatio,
            FluidRocheCoefficient * radius * densityRatio);
    }

    /// <summary>Where one body pulls another apart.</summary>
    /// <param name="satellite">The body being pulled, as a scan states it.</param>
    /// <param name="primary">The body doing the pulling, as a scan states it.</param>
    /// <returns>
    /// The two limits, or <see langword="null"/> where either body states too little.
    /// </returns>
    /// <exception cref="ArgumentNullException">Either body is absent.</exception>
    public static RocheLimits? RocheLimits(BodyProperties satellite, BodyProperties primary)
    {
        if (satellite is null) throw new ArgumentNullException(nameof(satellite));
        if (primary is null) throw new ArgumentNullException(nameof(primary));
        return DensityOf(satellite) is double density
            ? RocheLimitsForDensity(primary, density)
            : null;
    }

    /// <summary>How far one body holds satellites of its own, in metres.</summary>
    /// <param name="body">The body, as a scan states it.</param>
    /// <param name="primary">The body it orbits, as a scan states it.</param>
    /// <returns>
    /// The radius, or <see langword="null"/> where either body states too little.
    /// </returns>
    /// <exception cref="ArgumentNullException">Either body is absent.</exception>
    public static double? HillRadius(BodyProperties body, BodyProperties primary)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));
        if (primary is null) throw new ArgumentNullException(nameof(primary));

        double? semiMajorAxisM = BodyQuantities.Positive(body.SemiMajorAxis);
        double? bodyMassKg = MassOf(body);
        double? primaryMassKg = MassOf(primary);
        if (semiMajorAxisM is not double axis
            || bodyMassKg is not double mass
            || primaryMassKg is not double primaryMass)
        {
            return null;
        }

        return axis * Math.Pow(mass / (3 * primaryMass), 1d / 3d);
    }

    /// <summary>How wide the body it orbits looks from one body, in degrees.</summary>
    /// <param name="body">The body being looked from, as a scan states it.</param>
    /// <param name="primary">The body being looked at, as a scan states it.</param>
    /// <returns>
    /// The angular diameter, or <see langword="null"/> where either body states too little.
    /// </returns>
    /// <exception cref="ArgumentNullException">Either body is absent.</exception>
    public static double? PrimaryAngularDiameter(BodyProperties body, BodyProperties primary)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));
        if (primary is null) throw new ArgumentNullException(nameof(primary));

        double? distanceM = BodyQuantities.Positive(body.SemiMajorAxis);
        double? primaryRadiusM = BodyQuantities.Positive(primary.Radius);
        if (distanceM is not double distance || primaryRadiusM is not double radius) return null;

        return 2 * Math.Atan(radius / distance) * (180 / Math.PI);
    }

    private static double? MassOf(BodyProperties body)
    {
        if (BodyQuantities.Positive(body.MassEM) is double earthMasses)
        {
            return earthMasses * KilogramsPerEarthMass;
        }

        return BodyQuantities.Positive(body.StellarMass) is double solarMasses
            ? solarMasses * KilogramsPerSolarMass
            : null;
    }

    private static double? DensityOf(BodyProperties body)
    {
        double? massKg = MassOf(body);
        double? radiusM = BodyQuantities.Positive(body.Radius);
        if (massKg is not double mass || radiusM is not double radius) return null;
        return mass / BodyQuantities.SphereVolume(radius);
    }
}
