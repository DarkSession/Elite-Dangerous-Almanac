using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The distributor's capacities and its pip-scaled recharge rates.</summary>
public class DistributorTests
{
    private static readonly DistributorFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc").Distributor;

    /// <summary>The precision the fixture states a recharge rate to.</summary>
    private const double Tolerance = 1e-12;

    private static DistributorInput Rated() => new(
        SystemsCapacity: 20,
        SystemsRecharge: 2,
        EnginesCapacity: 24,
        EnginesRecharge: 3,
        WeaponsCapacity: 30,
        WeaponsRecharge: 5);

    [Fact]
    public void TheSharedFixturePinsAllThreeCapacitors()
    {
        DistributorInputFixture stated = Fixture.Input;

        DistributorMetrics metrics = Distributor.Metrics(new DistributorInput(
            stated.SystemsCapacity,
            stated.SystemsRecharge,
            stated.EnginesCapacity,
            stated.EnginesRecharge,
            stated.WeaponsCapacity,
            stated.WeaponsRecharge)
        {
            SystemsPips = stated.SystemsPips,
            EnginesPips = stated.EnginesPips,
            WeaponsPips = stated.WeaponsPips,
        });

        AssertCapacitor(Fixture.Expected.Systems, metrics.Systems);
        AssertCapacitor(Fixture.Expected.Engines, metrics.Engines);
        AssertCapacitor(Fixture.Expected.Weapons, metrics.Weapons);
        Assert.Equal(Fixture.Expected.Pips.Systems, metrics.Pips.Systems);
        Assert.Equal(Fixture.Expected.Pips.Engines, metrics.Pips.Engines);
        Assert.Equal(Fixture.Expected.Pips.Weapons, metrics.Pips.Weapons);
    }

    [Fact]
    public void FourPipsUseEveryRatedRechargeAndAreTheDefault()
    {
        DistributorMetrics metrics = Distributor.Metrics(Rated());

        Assert.Equal(new DistributorPips(4, 4, 4), metrics.Pips);
        Assert.Equal(new DistributorCapacitorMetrics(20, 2, 2), metrics.Systems);
        Assert.Equal(new DistributorCapacitorMetrics(24, 3, 3), metrics.Engines);
        Assert.Equal(new DistributorCapacitorMetrics(30, 5, 5), metrics.Weapons);
    }

    [Fact]
    public void NoPipsProvideNoRecharge()
    {
        DistributorMetrics metrics = Distributor.Metrics(
            Rated() with { SystemsPips = 0, EnginesPips = 0, WeaponsPips = 0 });

        Assert.Equal(0, metrics.Systems.RechargeRate);
        Assert.Equal(0, metrics.Engines.RechargeRate);
        Assert.Equal(0, metrics.Weapons.RechargeRate);
        // The capacity and the rated recharge are the distributor's own, whatever the pips.
        Assert.Equal(20, metrics.Systems.Capacity);
        Assert.Equal(2, metrics.Systems.RatedRecharge);
    }

    [Fact]
    public void TheAllocationCurveIsNonLinear()
    {
        DistributorMetrics half = Distributor.Metrics(Rated() with { EnginesPips = 2 });

        // Half the pips buy less than half the recharge, because the curve bends the other way.
        Assert.True(half.Engines.RechargeRate < 1.5);
        Assert.Equal(3 * Math.Pow(0.5, 1.1), half.Engines.RechargeRate, Tolerance);
    }

    public static TheoryData<DistributorInput> NonPhysicalInputs() =>
    [
        Rated() with { SystemsCapacity = -1 },
        Rated() with { EnginesRecharge = double.NaN },
        Rated() with { WeaponsCapacity = double.PositiveInfinity },
        Rated() with { SystemsPips = -0.5 },
        Rated() with { EnginesPips = 4.5 },
        Rated() with { WeaponsPips = double.NaN },
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalInputs))]
    public void AnInputThatIsNotPhysicalIsRefused(DistributorInput input) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Distributor.Metrics(input));

    [Fact]
    public void AMissingInputIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => Distributor.Metrics(null!));

    private static void AssertCapacitor(CapacitorFixture expected, DistributorCapacitorMetrics actual)
    {
        Assert.Equal(expected.Capacity, actual.Capacity);
        Assert.Equal(expected.RatedRecharge, actual.RatedRecharge);
        Assert.Equal(expected.RechargeRate, actual.RechargeRate, Tolerance);
    }
}
