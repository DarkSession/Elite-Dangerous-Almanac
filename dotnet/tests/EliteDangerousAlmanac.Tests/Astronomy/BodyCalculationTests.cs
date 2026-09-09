using System;
using System.Text;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>What a scanned body weighs, where it orbits, and what its star is doing.</summary>
/// <remarks>
/// The fixture stores twelve significant figures, so a figure is compared as a proportion
/// of itself. An answer of <see langword="null"/> is compared as itself: "this cannot be
/// computed" is an answer of its own, and must never pass as a near miss for a number.
/// </remarks>
public sealed class BodyCalculationTests
{
    private static readonly BodyCalculationsFixture Fixture =
        SharedFixtures.Load<BodyCalculationsFixture>("fixtures/astro/body-calculations.jsonc");

    public static TheoryData<int> DensityCases => Indices(Fixture.BulkDensity.Count);

    public static TheoryData<int> ExtentsCases => Indices(Fixture.OrbitExtents.Count);

    public static TheoryData<int> EccentricityCases => Indices(Fixture.EccentricityClass.Count);

    public static TheoryData<int> ResonanceCases => Indices(Fixture.SpinOrbitResonance.Count);

    public static TheoryData<int> VelocityCases => Indices(Fixture.EquatorialVelocity.Count);

    public static TheoryData<int> RocheCases => Indices(Fixture.RocheLimits.Count);

    public static TheoryData<int> RocheDensityCases =>
        Indices(Fixture.RocheLimitsForDensity.Count);

    public static TheoryData<int> HillCases => Indices(Fixture.HillRadius.Count);

    public static TheoryData<int> AngularCases => Indices(Fixture.PrimaryAngularDiameter.Count);

    public static TheoryData<int> ParticleCases => Indices(Fixture.RingParticleDensity.Count);

    public static TheoryData<int> RingDensityCases => Indices(Fixture.RingSurfaceDensity.Count);

    public static TheoryData<int> RingDynamicsCases => Indices(Fixture.RingDynamics.Count);

    public static TheoryData<int> LifetimeCases => Indices(Fixture.MainSequenceLifetime.Count);

    public static TheoryData<int> MagnitudeCases =>
        Indices(Fixture.AbsoluteBolometricMagnitude.Count);

    public static TheoryData<int> SchwarzschildCases => Indices(Fixture.SchwarzschildRadius.Count);

    public static TheoryData<int> StabilityCases => Indices(Fixture.MassStability.Count);

    public static TheoryData<int> NeutronCases => Indices(Fixture.NeutronStarClass.Count);

    [Theory]
    [MemberData(nameof(DensityCases))]
    public void ABodyIsAsDenseAsItsMassAndItsRadiusMakeIt(int index)
    {
        DensityCaseFixture expected = Fixture.BulkDensity[index];

        Quantity(expected.KgPerCubicMetre, BodyPhysics.BulkDensity(expected.Body), expected.Case);
    }

    [Theory]
    [MemberData(nameof(ExtentsCases))]
    public void AnOrbitReachesAsFarAsItsEccentricityTakesIt(int index)
    {
        OrbitExtentsCaseFixture expected = Fixture.OrbitExtents[index];

        OrbitExtents? extents = BodyOrbit.Extents(expected.Body);

        Quantity(expected.Periapsis, extents?.Periapsis, expected.Case);
        Quantity(expected.Apoapsis, extents?.Apoapsis, expected.Case);
        Assert.Equal(
            expected.EccentricityClass,
            extents is null ? null : Kebab(BodyOrbit.ClassifyEccentricity(extents.Eccentricity)));
    }

    [Theory]
    [MemberData(nameof(EccentricityCases))]
    public void AnEccentricityFallsInTheClassItsFigurePutsIt(int index)
    {
        EccentricityCaseFixture expected = Fixture.EccentricityClass[index];

        Assert.Equal(
            expected.Class, Kebab(BodyOrbit.ClassifyEccentricity(expected.Eccentricity)));
    }

    [Theory]
    [MemberData(nameof(ResonanceCases))]
    public void ABodyKeepsStepWithItsOrbitOrItDoesNot(int index)
    {
        ResonanceCaseFixture expected = Fixture.SpinOrbitResonance[index];

        SpinOrbitResonance? actual = BodyOrbit.Resonance(expected.Body);

        if (expected.Resonance is null)
        {
            Assert.Null(actual);
            return;
        }

        Assert.NotNull(actual);
        Assert.Equal(expected.Resonance.Rotations, actual!.Rotations);
        Assert.Equal(expected.Resonance.Orbits, actual.Orbits);
    }

    [Theory]
    [MemberData(nameof(VelocityCases))]
    public void AnEquatorTravelsAsFastAsTheBodyTurns(int index)
    {
        VelocityCaseFixture expected = Fixture.EquatorialVelocity[index];

        Quantity(
            expected.MetresPerSecond,
            BodyOrbit.EquatorialVelocity(expected.Body),
            expected.Case);
    }

    [Theory]
    [MemberData(nameof(RocheCases))]
    public void ABodyPullsItsSatelliteApartAtTheDistanceTheirDensitiesSet(int index)
    {
        RocheCaseFixture expected = Fixture.RocheLimits[index];

        RocheLimits? limits = BodyPhysics.RocheLimits(expected.Satellite, expected.Primary);

        Quantity(expected.Rigid, limits?.Rigid, expected.Case);
        Quantity(expected.Fluid, limits?.Fluid, expected.Case);
    }

    [Theory]
    [MemberData(nameof(RocheDensityCases))]
    public void AStatedSatelliteDensitySetsTheSameTwoDistances(int index)
    {
        RocheDensityCaseFixture expected = Fixture.RocheLimitsForDensity[index];

        RocheLimits? limits = BodyPhysics.RocheLimitsForDensity(
            expected.Primary, expected.SatelliteDensityKgM3);

        Quantity(expected.Rigid, limits?.Rigid, expected.Case);
        Quantity(expected.Fluid, limits?.Fluid, expected.Case);
    }

    [Theory]
    [MemberData(nameof(HillCases))]
    public void ABodyHoldsSatellitesAsFarOutAsItsMassAllows(int index)
    {
        HillRadiusCaseFixture expected = Fixture.HillRadius[index];

        Quantity(
            expected.Metres,
            BodyPhysics.HillRadius(expected.Body, expected.Primary),
            expected.Case);
    }

    [Theory]
    [MemberData(nameof(AngularCases))]
    public void APrimaryLooksAsWideAsItsRadiusAndItsDistanceMakeIt(int index)
    {
        AngularDiameterCaseFixture expected = Fixture.PrimaryAngularDiameter[index];

        Quantity(
            expected.Degrees,
            BodyPhysics.PrimaryAngularDiameter(expected.Body, expected.Primary),
            expected.Case);
    }

    [Theory]
    [MemberData(nameof(ParticleCases))]
    public void ARingsClassSaysWhatItsParticlesAre(int index)
    {
        ParticleDensityCaseFixture expected = Fixture.RingParticleDensity[index];

        Assert.Equal(
            expected.KgPerCubicMetre, BodyRings.ParticleDensity(expected.RingClass));
    }

    [Theory]
    [MemberData(nameof(RingDensityCases))]
    public void ARingIsAsThickAsItsMassOverItsAreaMakesIt(int index)
    {
        RingDensityCaseFixture expected = Fixture.RingSurfaceDensity[index];

        Quantity(
            expected.MegatonnesPerSquareKilometre,
            BodyRings.SurfaceDensity(expected.Ring),
            expected.Case);
        Assert.Equal(expected.Invisible, BodyRings.IsInvisible(expected.Ring));
    }

    [Theory]
    [MemberData(nameof(RingDynamicsCases))]
    public void ARingTravelsAsFastAsWhatItOrbitsPullsIt(int index)
    {
        RingDynamicsCaseFixture expected = Fixture.RingDynamics[index];

        RingDynamics? actual = BodyRings.Dynamics(expected.Ring, expected.Primary);

        Quantity(expected.OrbitalPeriod, actual?.OrbitalPeriod, expected.Case);
        Quantity(expected.NominalRadius, actual?.NominalRadius, expected.Case);
        Quantity(expected.InnerVelocity, actual?.InnerVelocity, expected.Case);
        Quantity(expected.OuterVelocity, actual?.OuterVelocity, expected.Case);
    }

    [Theory]
    [MemberData(nameof(LifetimeCases))]
    public void AStarBurnsForAsLongAsItsMassAllows(int index)
    {
        LifetimeCaseFixture expected = Fixture.MainSequenceLifetime[index];

        Quantity(
            expected.MillionYears,
            StarPhysics.MainSequenceLifetime(expected.Body),
            expected.Case);
    }

    [Theory]
    [MemberData(nameof(MagnitudeCases))]
    public void AStarShinesAsBrightlyAsItsSizeAndItsHeatMakeIt(int index)
    {
        MagnitudeCaseFixture expected = Fixture.AbsoluteBolometricMagnitude[index];

        Quantity(
            expected.Magnitude,
            StarPhysics.AbsoluteBolometricMagnitude(expected.Body),
            expected.Case);
    }

    [Theory]
    [MemberData(nameof(SchwarzschildCases))]
    public void ABodyBecomesAHoleAtTheRadiusItsMassSets(int index)
    {
        SchwarzschildCaseFixture expected = Fixture.SchwarzschildRadius[index];

        Quantity(
            expected.Metres, StarPhysics.SchwarzschildRadius(expected.Body), expected.Case);
    }

    [Theory]
    [MemberData(nameof(StabilityCases))]
    public void AStarPastItsMassLimitIsSaidToBe(int index)
    {
        MassStabilityCaseFixture expected = Fixture.MassStability[index];

        MassStabilityAssessment? actual = StarPhysics.AssessMassStability(expected.Body);

        if (expected.Assessment is null)
        {
            Assert.Null(actual);
            return;
        }

        Assert.NotNull(actual);
        Assert.Equal(expected.Assessment.Limit, Kebab(actual!.Limit));
        Assert.Equal(expected.Assessment.LimitSolarMasses, actual.LimitSolarMasses);
        Assert.Equal(expected.Assessment.Severity, Kebab(actual.Severity));
    }

    [Theory]
    [MemberData(nameof(NeutronCases))]
    public void ANeutronStarIsClassedByHowFastItTurns(int index)
    {
        NeutronStarCaseFixture expected = Fixture.NeutronStarClass[index];

        NeutronStarClass? actual = StarPhysics.ClassifyNeutronStar(expected.Body);

        Assert.Equal(expected.Class, actual is null ? null : Kebab(actual.Value));
    }

    [Fact]
    public void NoCalculationReadsAnAbsentBody()
    {
        BodyProperties body = new() { Radius = 1, MassEM = 1 };
        BodyRing ring = new("Test A Ring", "eRingClass_Icy", 1, 1, 2);

        Assert.Throws<ArgumentNullException>(() => BodyPhysics.Mass(null!));
        Assert.Throws<ArgumentNullException>(() => BodyPhysics.BulkDensity(null!));
        Assert.Throws<ArgumentNullException>(() => BodyPhysics.RocheLimits(null!, body));
        Assert.Throws<ArgumentNullException>(() => BodyPhysics.RocheLimits(body, null!));
        Assert.Throws<ArgumentNullException>(
            () => BodyPhysics.RocheLimitsForDensity(null!, 1000));
        Assert.Throws<ArgumentNullException>(() => BodyPhysics.HillRadius(null!, body));
        Assert.Throws<ArgumentNullException>(() => BodyPhysics.HillRadius(body, null!));
        Assert.Throws<ArgumentNullException>(
            () => BodyPhysics.PrimaryAngularDiameter(null!, body));
        Assert.Throws<ArgumentNullException>(
            () => BodyPhysics.PrimaryAngularDiameter(body, null!));
        Assert.Throws<ArgumentNullException>(() => BodyOrbit.Extents(null!));
        Assert.Throws<ArgumentNullException>(() => BodyOrbit.Resonance(null!));
        Assert.Throws<ArgumentNullException>(() => BodyOrbit.EquatorialVelocity(null!));
        Assert.Throws<ArgumentNullException>(() => BodyRings.ParticleDensity(null!));
        Assert.Throws<ArgumentNullException>(() => BodyRings.SurfaceDensity(null!));
        Assert.Throws<ArgumentNullException>(() => BodyRings.IsInvisible(null!));
        Assert.Throws<ArgumentNullException>(() => BodyRings.Dynamics(null!, body));
        Assert.Throws<ArgumentNullException>(() => BodyRings.Dynamics(ring, null!));
        Assert.Throws<ArgumentNullException>(() => BodyRings.RocheLimits(null!, body));
        Assert.Throws<ArgumentNullException>(() => StarPhysics.MainSequenceLifetime(null!));
        Assert.Throws<ArgumentNullException>(
            () => StarPhysics.AbsoluteBolometricMagnitude(null!));
        Assert.Throws<ArgumentNullException>(() => StarPhysics.SchwarzschildRadius(null!));
        Assert.Throws<ArgumentNullException>(() => StarPhysics.AssessMassStability(null!));
        Assert.Throws<ArgumentNullException>(() => StarPhysics.ClassifyNeutronStar(null!));
    }

    [Fact]
    public void NoFigureIsComputedFromAnUnusableOne()
    {
        BodyProperties body = new() { Radius = 6371000, MassEM = 1 };

        Assert.Throws<ArgumentOutOfRangeException>(
            () => BodyPhysics.RocheLimitsForDensity(body, 0));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => BodyPhysics.RocheLimitsForDensity(body, double.NaN));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => BodyOrbit.ClassifyEccentricity(-0.1));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => BodyOrbit.ClassifyEccentricity(double.PositiveInfinity));
    }

    [Fact]
    public void ARingSitsInsideTheLimitThatKeepsItARing()
    {
        BodyProperties saturn = new() { MassEM = 95.16, Radius = 58_232_000 };
        BodyRing ring = new("Saturn A Ring", "eRingClass_Icy", 1e10, 122_000_000, 137_000_000);

        RocheLimits limits = Assert.IsType<RocheLimits>(BodyRings.RocheLimits(ring, saturn));

        Assert.True(limits.Fluid > limits.Rigid);
        Assert.True(ring.InnerRad < limits.Fluid);
    }

    private static void Quantity(double? expected, double? actual, string what)
    {
        if (expected is null)
        {
            Assert.True(actual is null, $"{what}: expected no figure, received {actual}.");
            return;
        }

        Assert.True(actual is not null, $"{what}: expected {expected}, received no figure.");
        double tolerance = Math.Max(Math.Abs(expected.Value) * 1e-9, 1e-9);
        Assert.True(
            Math.Abs(actual!.Value - expected.Value) <= tolerance,
            $"{what}: expected {expected}, received {actual}.");
    }

    private static string Kebab<TEnum>(TEnum value)
        where TEnum : struct, Enum
    {
        string name = value.ToString()!;
        StringBuilder kebab = new(name.Length + 8);
        for (int index = 0; index < name.Length; index++)
        {
            if (index > 0 && char.IsUpper(name[index])) kebab.Append('-');
            kebab.Append(char.ToLowerInvariant(name[index]));
        }

        return kebab.ToString();
    }

    private static TheoryData<int> Indices(int count)
    {
        TheoryData<int> cases = [];
        for (int index = 0; index < count; index++) cases.Add(index);
        return cases;
    }
}
