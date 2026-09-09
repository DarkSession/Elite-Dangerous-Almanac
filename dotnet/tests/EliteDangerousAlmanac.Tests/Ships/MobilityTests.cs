using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Speed, boost and handling for a loaded ship at full ENG.</summary>
public class MobilityTests
{
    private static readonly MobilityFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc").Mobility;

    /// <summary>The precision the fixture states a rate to.</summary>
    private const double Tolerance = 1e-12;

    /// <summary>The stock thruster curve the hand-written cases sit on.</summary>
    private static readonly ThrusterParams Thrusters = new(
        MinMass: 24,
        OptMass: 48,
        MaxMass: 72,
        MinMultiplier: 0.83,
        OptMultiplier: 1,
        MaxMultiplier: 1.03);

    private static MobilityInput Hull() => new(
        MinimumSpeed: 100,
        MaximumSpeed: 220,
        Boost: 320,
        MinPitch: 34,
        Pitch: 42,
        MinRoll: 110,
        Roll: 110,
        MinYaw: 16,
        Yaw: 16,
        Mass: 48)
    {
        Thrusters = Thrusters,
    };

    /// <summary>A hull whose top speed sits below its bottom one describes no ship.</summary>
    [Fact]
    public void TheSharedFixturePinsSpeedEndpointsTheCalculationRefuses()
    {
        InvalidMobilityFixture stated = Fixture.InvalidSpeedEndpoints;

        Assert.Equal("RangeError", stated.ExpectedError);
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Mobility.Metrics(stated.Input.ToInput()));
    }

    [Fact]
    public void TheSharedFixturePinsSpeedBoostAndHandling()
    {
        MobilityExpectedFixture expected = Fixture.Expected;

        MobilityMetrics? metrics = Mobility.Metrics(Fixture.Input.ToInput());

        Assert.NotNull(metrics);
        Assert.Equal(Fixture.Input.Mass, metrics.LoadedMass);
        Assert.Equal(expected.Speed, metrics.Speed, Tolerance);
        Assert.Equal(expected.Boost, metrics.Boost, Tolerance);
        Assert.Equal(expected.Pitch, metrics.Pitch, Tolerance);
        Assert.Equal(expected.Roll, metrics.Roll, Tolerance);
        Assert.Equal(expected.Yaw, metrics.Yaw, Tolerance);
        Assert.Equal(expected.MassCurveMultiplier, metrics.MassCurveMultiplier, Tolerance);
        Assert.Equal(
            expected.RotationMassCurveMultiplier, metrics.RotationMassCurveMultiplier, Tolerance);
    }

    [Fact]
    public void TheCurvePassesThroughAllThreeDeclaredPoints()
    {
        Assert.Equal(1.03, Mobility.ThrusterMassCurveMultiplier(24, Thrusters));
        Assert.Equal(1, Mobility.ThrusterMassCurveMultiplier(48, Thrusters), Tolerance);
        Assert.Equal(0.83, Mobility.ThrusterMassCurveMultiplier(72, Thrusters));
    }

    [Fact]
    public void PastTheRatedMassTheThrustersContributeNothing() =>
        Assert.Equal(0, Mobility.ThrusterMassCurveMultiplier(73, Thrusters));

    [Fact]
    public void AConstantCurveHoldsItsOwnMultiplier()
    {
        var flat = new ThrusterCurveParams(
            MinMass: 1, OptMass: 1, MaxMass: 1,
            MinMultiplier: 1.2, OptMultiplier: 1.2, MaxMultiplier: 1.2);

        Assert.Equal(1.2, Mobility.ThrusterMassCurveMultiplier(1, flat));
    }

    [Fact]
    public void AtTheOptimalMassTheHullsOwnFiguresStand()
    {
        MobilityMetrics? metrics = Mobility.Metrics(Hull());

        Assert.NotNull(metrics);
        Assert.Equal(48, metrics.LoadedMass);
        Assert.Equal(220, metrics.Speed, Tolerance);
        Assert.Equal(320, metrics.Boost, Tolerance);
        Assert.Equal(42, metrics.Pitch, Tolerance);
        Assert.Equal(110, metrics.Roll, Tolerance);
        Assert.Equal(16, metrics.Yaw, Tolerance);
    }

    [Fact]
    public void EnhancedThrustersUseDistinctSpeedAndRotationCurves()
    {
        MobilityMetrics? metrics = Mobility.Metrics(Fixture.Input.ToInput());

        Assert.NotNull(metrics);
        Assert.NotEqual(metrics.MassCurveMultiplier, metrics.RotationMassCurveMultiplier);
        Assert.Equal(
            Fixture.Input.Boost * metrics.MassCurveMultiplier, metrics.Boost, Tolerance);
        Assert.Equal(
            Fixture.Input.Roll * metrics.RotationMassCurveMultiplier, metrics.Roll, Tolerance);
    }

    [Fact]
    public void AHullWithNoThrustersHasNoMobility() =>
        Assert.Null(Mobility.Metrics(Hull() with { Thrusters = null }));

    [Fact]
    public void AMissingInputIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => Mobility.Metrics(null!));

    public static TheoryData<MobilityInput> NonPhysicalHulls() =>
    [
        Hull() with { MinimumSpeed = 2, MaximumSpeed = 1 },
        Hull() with { MinPitch = 99 },
        Hull() with { MinRoll = 999 },
        Hull() with { MinYaw = 999 },
        Hull() with { MaximumSpeed = -1 },
        Hull() with { Boost = double.NaN },
        Hull() with { Mass = double.PositiveInfinity },
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalHulls))]
    public void AHullFigureThatIsNotPhysicalIsRefused(MobilityInput input) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Mobility.Metrics(input));

    public static TheoryData<ThrusterCurveParams> NonPhysicalCurves() =>
    [
        Thrusters with { MinMass = 50, OptMass = 40 },
        Thrusters with { MinMass = 48 },
        Thrusters with { OptMass = 72 },
        Thrusters with { MinMultiplier = -1 },
        Thrusters with { MinMultiplier = 1, OptMultiplier = 1.2, MaxMultiplier = 1 },
        Thrusters with { MinMultiplier = 0.8, OptMultiplier = 0.8, MaxMultiplier = 1.2 },
        Thrusters with { MinMultiplier = 0.8, OptMultiplier = 1.2, MaxMultiplier = 1.2 },
        new ThrusterCurveParams(1, 1, 1, 1, 1.1, 1.2),
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalCurves))]
    public void ACurveThatIsNotPhysicalIsRefused(ThrusterCurveParams curve) =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Mobility.ThrusterMassCurveMultiplier(1, curve));

    [Fact]
    public void AMassThatIsNotPhysicalIsRefused() =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Mobility.ThrusterMassCurveMultiplier(-1, Thrusters));

    [Fact]
    public void AMissingCurveIsRefused() =>
        Assert.Throws<ArgumentNullException>(
            () => Mobility.ThrusterMassCurveMultiplier(1, null!));
}
