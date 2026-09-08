using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Speed and handling at a chosen ENG-pip allocation.</summary>
public class MobilityCapacitorTests
{
    private static readonly MobilityFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc").Mobility;

    /// <summary>The precision the fixture states a rate to.</summary>
    private const double Tolerance = 1e-12;

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

    [Fact]
    public void TheSharedFixturePinsAPartAllocation()
    {
        MobilityCaseFixture stated = Fixture.PipAllocation;
        MobilityExpectedFixture expected = stated.Expected;

        MobilityCapacitorMetrics? metrics =
            MobilityCapacitor.Metrics(stated.Input.ToInput(), stated.Input.EnginesPips ?? 4);

        Assert.NotNull(metrics);
        Assert.Equal(stated.Input.EnginesPips, metrics.EnginesPips);
        Assert.Equal(expected.Speed, metrics.Speed, Tolerance);
        Assert.Equal(expected.Pitch, metrics.Pitch, Tolerance);
        Assert.Equal(expected.Roll, metrics.Roll, Tolerance);
        Assert.Equal(expected.Yaw, metrics.Yaw, Tolerance);
    }

    [Fact]
    public void AHullWithEqualRotationEndpointsKeepsItsRatesAtEveryAllocation()
    {
        MobilityCaseFixture stated = Fixture.ZeroPipRotation;
        MobilityInput input = stated.Input.ToInput();

        MobilityCapacitorMetrics? metrics =
            MobilityCapacitor.Metrics(input, stated.Input.EnginesPips ?? 4);

        Assert.NotNull(metrics);
        Assert.Equal(stated.Expected.Speed, metrics.Speed, Tolerance);
        Assert.Equal(stated.Expected.Roll, metrics.Roll, Tolerance);
        Assert.Equal(stated.Expected.Yaw, metrics.Yaw, Tolerance);
        // Roll and yaw declare equal endpoints on this hull, so no allocation can move them.
        for (int pips = 0; pips <= 4; pips++)
        {
            MobilityCapacitorMetrics? step = MobilityCapacitor.Metrics(input, pips);

            Assert.NotNull(step);
            Assert.Equal(stated.SpeedSequence[pips], step.Speed, Tolerance);
            Assert.Equal(stated.PitchSequence[pips], step.Pitch, Tolerance);
            Assert.Equal(stated.Expected.Roll, step.Roll, Tolerance);
            Assert.Equal(stated.Expected.Yaw, step.Yaw, Tolerance);
        }
    }

    [Fact]
    public void FourPipsReproduceThePipFreeFiguresExactly()
    {
        MobilityInput input = Hull();
        MobilityMetrics? full = Mobility.Metrics(input);

        MobilityCapacitorMetrics? four = MobilityCapacitor.Metrics(input);

        Assert.NotNull(full);
        Assert.NotNull(four);
        Assert.Equal(4, four.EnginesPips);
        // Bit for bit, not merely close: full ENG is the baseline, so the split must not move
        // a headline number.
        Assert.Equal(full.Speed, four.Speed);
        Assert.Equal(full.Pitch, four.Pitch);
        Assert.Equal(full.Roll, four.Roll);
        Assert.Equal(full.Yaw, four.Yaw);
        Assert.Equal(four, MobilityCapacitor.Metrics(input, 4));
    }

    [Theory]
    [InlineData(0, 100, 34)]
    [InlineData(0.5, 115, 35)]
    [InlineData(1, 130, 36)]
    [InlineData(2, 160, 38)]
    [InlineData(4, 220, 42)]
    public void TheAllocationInterpolatesBetweenTheHullEndpoints(
        double enginesPips, double speed, double pitch)
    {
        MobilityCapacitorMetrics? metrics = MobilityCapacitor.Metrics(Hull(), enginesPips);

        Assert.NotNull(metrics);
        Assert.Equal(speed, metrics.Speed, Tolerance);
        Assert.Equal(pitch, metrics.Pitch, Tolerance);
        // This hull declares equal rotation endpoints, so the pips cannot move these two.
        Assert.Equal(110, metrics.Roll, Tolerance);
        Assert.Equal(16, metrics.Yaw, Tolerance);
    }

    [Fact]
    public void TheMassCurveMultipliesTheInterpolatedFigure()
    {
        MobilityCapacitorMetrics? heavy = MobilityCapacitor.Metrics(Hull() with { Mass = 72 }, 2);

        Assert.NotNull(heavy);
        Assert.Equal(160 * 0.83, heavy.Speed, Tolerance);
    }

    [Fact]
    public void PastTheRatedMassEveryFigureIsZero()
    {
        MobilityCapacitorMetrics? overloaded = MobilityCapacitor.Metrics(Hull() with { Mass = 73 });

        Assert.NotNull(overloaded);
        Assert.Equal(0, overloaded.Speed);
        Assert.Equal(0, overloaded.Pitch);
        Assert.Equal(0, overloaded.Roll);
        Assert.Equal(0, overloaded.Yaw);
    }

    [Fact]
    public void EnhancedThrustersUseTheirDistinctSpeedAndRotationCurves()
    {
        MobilityInput input = (Hull() with { Mass = 24 }) with
        {
            Thrusters = Thrusters with
            {
                SpeedCurve = new ThrusterCurveParams(24, 48, 72, 0.83, 1, 1.25),
                RotationCurve = new ThrusterCurveParams(24, 48, 72, 0.83, 1, 1.1),
            },
        };

        MobilityCapacitorMetrics? enhanced = MobilityCapacitor.Metrics(input, 2);

        Assert.NotNull(enhanced);
        Assert.Equal(160 * 1.25, enhanced.Speed, Tolerance);
        Assert.Equal(38 * 1.1, enhanced.Pitch, Tolerance);
    }

    [Fact]
    public void AHullWithNoThrustersHasNoMobility() =>
        Assert.Null(MobilityCapacitor.Metrics(Hull() with { Thrusters = null }, 2));

    [Theory]
    [InlineData(5)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void TheAllocationIsCheckedBeforeTheHull(double enginesPips) =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => MobilityCapacitor.Metrics(Hull() with { Thrusters = null }, enginesPips));

    [Fact]
    public void AHullFigureThatIsNotPhysicalIsRefused() =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => MobilityCapacitor.Metrics(Hull() with { MaximumSpeed = -1 }));

    [Fact]
    public void ACurveThatIsNotPhysicalIsRefused() =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => MobilityCapacitor.Metrics(
                Hull() with { Thrusters = Thrusters with { MinMass = 50, OptMass = 40 } }));

    [Fact]
    public void AMissingInputIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => MobilityCapacitor.Metrics(null!));
}
