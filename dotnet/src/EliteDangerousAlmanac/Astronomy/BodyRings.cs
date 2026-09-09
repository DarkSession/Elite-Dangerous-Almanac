using System;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>How fast one ring travels around what it orbits.</summary>
/// <param name="OrbitalPeriod">The period at the nominal radius, in seconds.</param>
/// <param name="NominalRadius">
/// The radius the period is taken at, in metres. It is three eighths of the way out from
/// the inner edge. See <see cref="BodyRings.Dynamics"/> for where that fraction comes from.
/// </param>
/// <param name="InnerVelocity">The speed at the inner edge, in metres a second.</param>
/// <param name="OuterVelocity">The speed at the outer edge, in metres a second.</param>
public sealed record RingDynamics(
    double OrbitalPeriod,
    double NominalRadius,
    double InnerVelocity,
    double OuterVelocity);

/// <summary>What a ring is made of, how thick it lies, and how fast it turns.</summary>
/// <remarks>
/// <para>
/// Every calculation reads the figures the scan states, and answers <see langword="null"/>
/// where the ring states none it can use.
/// </para>
/// <para>
/// The maths is ported from the Canonn Research Group's
/// <see href="https://github.com/canonn-science/canonn-signals">canonn-signals</see>, whose
/// ring model is their own observational research. See <c>ATTRIBUTIONS.md</c> for credit and
/// licence terms.
/// </para>
/// </remarks>
public static class BodyRings
{
    /// <summary>Where along a ring its period is taken, as a fraction of its width.</summary>
    /// <remarks>See <see cref="Dynamics"/> for where the figure comes from.</remarks>
    public const double NominalRadiusFraction = 3d / 8d;

    /// <summary>The surface density at or above which the game draws a ring, in tonnes a square kilometre.</summary>
    /// <remarks>See <see cref="IsInvisible"/> for where the figure comes from.</remarks>
    public const double VisibleRingMinSurfaceDensity = 0.1;

    /// <summary>The width below which the game draws a ring whatever its density, in metres.</summary>
    /// <remarks>See <see cref="IsInvisible"/> for where the figure comes from.</remarks>
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
    /// <remarks>
    /// A ring both very wide and very diffuse has nothing to catch the light, and the game
    /// draws nothing where the scan states a ring. The test is the Canonn Research Group's
    /// own observational finding, not a rule read out of the game: wider than
    /// <see cref="VisibleRingMaxWidth"/> <em>and</em> thinner than
    /// <see cref="VisibleRingMinSurfaceDensity"/>. Either one alone still draws.
    /// </remarks>
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
    /// <remarks>
    /// <para>
    /// <b>The game turns a ring as one rigid sheet.</b> A real ring shears, because every
    /// particle keeps its own orbit and the inner edge is the fastest. Elite Dangerous gives
    /// the whole ring one period instead, which makes the outer edge the fast one. That is
    /// the opposite of the physical answer, and the reason the speeds cannot be computed
    /// edge by edge.
    /// </para>
    /// <para>
    /// The one period is recovered by applying Kepler's third law at a nominal radius some
    /// way across the ring: <c>nominal = inner + (outer - inner) * 3/8</c>, then
    /// <c>T = 2*pi*sqrt(nominal^3 / GM)</c>. The three eighths is a fitted constant, not a
    /// derivation. The Canonn Research Group arrived at it from in-game measurements, having
    /// also weighed 1/e (about 0.368) and 1/phi^2 (about 0.382), which it sits between.
    /// </para>
    /// <para>
    /// Two things bound how exact the result can be. The journal writes ring radii to four
    /// significant figures, and the constant is a fit to observations rather than an exact
    /// value. Read the figures as close, not exact.
    /// </para>
    /// </remarks>
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
