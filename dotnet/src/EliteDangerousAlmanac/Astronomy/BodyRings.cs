using System;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>How fast one ring travels around what it orbits.</summary>
/// <param name="OrbitalPeriod">The period at the nominal radius, in seconds.</param>
/// <param name="NominalRadius">
/// The radius the period is taken at, in metres. It is three eighths of the way out from
/// the inner edge, which is where a ring carries most of its mass.
/// </param>
/// <param name="InnerVelocity">The speed at the inner edge, in metres a second.</param>
/// <param name="OuterVelocity">The speed at the outer edge, in metres a second.</param>
public sealed record RingDynamics(
    double OrbitalPeriod,
    double NominalRadius,
    double InnerVelocity,
    double OuterVelocity);

/// <summary>What a ring is made of, how thick it lies, and how fast it turns.</summary>
public static class BodyRings
{
    /// <summary>Where along a ring its period is taken, as a fraction of its width.</summary>
    public const double NominalRadiusFraction = 3d / 8d;

    /// <summary>The surface density below which a ring is too thin to see, in tonnes a square kilometre.</summary>
    public const double VisibleRingMinSurfaceDensity = 0.1;

    /// <summary>The width above which a thin ring is too spread out to see, in metres.</summary>
    public const double VisibleRingMaxWidth = 1e9;

    private const double IcyParticleDensity = 1000;
    private const double RockyParticleDensity = 3000;
    private const double MetallicParticleDensity = 4500;

    /// <summary>How dense one ring's particles are, in kilograms a cubic metre.</summary>
    /// <param name="ringClass">The ring's class, such as <c>eRingClass_MetalRich</c>.</param>
    /// <returns>The density the class implies. A class naming no rock or metal is ice.</returns>
    /// <exception cref="ArgumentNullException">The class is absent.</exception>
    public static double ParticleDensity(string ringClass)
    {
        if (ringClass is null) throw new ArgumentNullException(nameof(ringClass));

        string token = ringClass.ToLowerInvariant();
        if (token.Contains("metal")) return MetallicParticleDensity;
        return token.Contains("rock") ? RockyParticleDensity : IcyParticleDensity;
    }

    /// <summary>How much mass one ring carries over its area, in tonnes a square kilometre.</summary>
    /// <param name="ring">The ring, as a scan states it.</param>
    /// <returns>
    /// The surface density, or <see langword="null"/> where the ring states no usable mass
    /// or radii.
    /// </returns>
    /// <exception cref="ArgumentNullException">The ring is absent.</exception>
    public static double? SurfaceDensity(BodyRing ring)
    {
        if (ring is null) throw new ArgumentNullException(nameof(ring));

        double? innerM = BodyQuantities.Positive(ring.InnerRad);
        double? outerM = BodyQuantities.Positive(ring.OuterRad);
        double? massMt = BodyQuantities.Positive(ring.MassMT);
        if (innerM is not double inner
            || outerM is not double outer
            || massMt is not double mass
            || outer <= inner)
        {
            return null;
        }

        double innerKm = inner / 1000;
        double outerKm = outer / 1000;
        return mass / (Math.PI * ((outerKm * outerKm) - (innerKm * innerKm)));
    }

    /// <summary>Whether a ring is spread too thin over too wide a span to be seen.</summary>
    /// <param name="ring">The ring, as a scan states it.</param>
    /// <returns>
    /// <see langword="true"/> where the ring is both wide and thin. A ring stating too
    /// little to judge is not called invisible.
    /// </returns>
    /// <exception cref="ArgumentNullException">The ring is absent.</exception>
    public static bool IsInvisible(BodyRing ring)
    {
        if (ring is null) throw new ArgumentNullException(nameof(ring));
        if (SurfaceDensity(ring) is not double surfaceDensity) return false;

        // Both radii are usable wherever a density came back, so the width means something.
        double width = ring.OuterRad - ring.InnerRad;
        return width > VisibleRingMaxWidth && surfaceDensity < VisibleRingMinSurfaceDensity;
    }

    /// <summary>How fast one ring travels around what it orbits.</summary>
    /// <param name="ring">The ring, as a scan states it.</param>
    /// <param name="primary">The body the ring is around, as a scan states it.</param>
    /// <returns>
    /// The figures, or <see langword="null"/> where the ring states no usable radii or the
    /// primary states no mass.
    /// </returns>
    /// <exception cref="ArgumentNullException">Either the ring or the primary is absent.</exception>
    public static RingDynamics? Dynamics(BodyRing ring, BodyProperties primary)
    {
        if (ring is null) throw new ArgumentNullException(nameof(ring));
        if (primary is null) throw new ArgumentNullException(nameof(primary));

        double? innerM = BodyQuantities.Positive(ring.InnerRad);
        double? outerM = BodyQuantities.Positive(ring.OuterRad);
        double? primaryMassKg = BodyPhysics.Mass(primary);
        if (innerM is not double inner
            || outerM is not double outer
            || primaryMassKg is not double primaryMass
            || outer <= inner)
        {
            return null;
        }

        double nominalRadius = inner + ((outer - inner) * NominalRadiusFraction);
        double orbitalPeriod = 2 * Math.PI * Math.Sqrt(
            nominalRadius * nominalRadius * nominalRadius
            / (BodyPhysics.GravitationalConstant * primaryMass));

        return new RingDynamics(
            orbitalPeriod,
            nominalRadius,
            2 * Math.PI * inner / orbitalPeriod,
            2 * Math.PI * outer / orbitalPeriod);
    }

    /// <summary>Where the body a ring is around pulls that ring's particles apart.</summary>
    /// <param name="ring">The ring, as a scan states it.</param>
    /// <param name="primary">The body the ring is around, as a scan states it.</param>
    /// <returns>
    /// The two limits, or <see langword="null"/> where the primary states too little.
    /// </returns>
    /// <exception cref="ArgumentNullException">Either the ring or the primary is absent.</exception>
    /// <remarks>
    /// A ring sits inside the fluid limit, which is why it stays a ring rather than
    /// gathering into a moon.
    /// </remarks>
    public static RocheLimits? RocheLimits(BodyRing ring, BodyProperties primary)
    {
        if (ring is null) throw new ArgumentNullException(nameof(ring));
        return BodyPhysics.RocheLimitsForDensity(primary, ParticleDensity(ring.RingClass));
    }
}
