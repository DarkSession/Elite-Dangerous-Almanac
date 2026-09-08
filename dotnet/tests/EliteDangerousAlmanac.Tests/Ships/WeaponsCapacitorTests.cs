using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>How long a weapons capacitor lasts under a firing load.</summary>
public class WeaponsCapacitorTests
{
    private static readonly WeaponsCapacitorFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc").WeaponsCapacitor;

    /// <summary>The precision the fixture states a rate to.</summary>
    private const double Tolerance = 1e-12;

    [Fact]
    public void TheSharedFixturePinsTheRechargeAndTheEndurance()
    {
        WeaponsCapacitorInputFixture stated = Fixture.Input;

        WeaponsCapacitorMetrics metrics = WeaponsCapacitor.Metrics(
            new WeaponsCapacitorInput(
                stated.WeaponsCapacity, stated.WeaponsRecharge, stated.SustainedEnergyPerSecond),
            stated.WeaponsPips);

        Assert.Equal(Fixture.Expected.WeaponsPips, metrics.WeaponsPips);
        Assert.Equal(Fixture.Expected.Capacity, metrics.Capacity);
        Assert.Equal(Fixture.Expected.RechargeRate, metrics.RechargeRate, Tolerance);
        Assert.Equal(
            Fixture.Expected.SustainedEnergyPerSecond, metrics.SustainedEnergyPerSecond);
        Assert.Equal(Fixture.Expected.NetDrainRate, metrics.NetDrainRate, Tolerance);
        Assert.Equal(Fixture.Expected.TimeToDrain, metrics.TimeToDrain, Tolerance);
    }

    [Fact]
    public void ARechargeThatKeepsPaceWithTheDrawNeverDrains()
    {
        WeaponsCapacitorMetrics metrics = WeaponsCapacitor.Metrics(
            new WeaponsCapacitorInput(20, 5, 5));

        Assert.Equal(0, metrics.NetDrainRate);
        Assert.Equal(double.PositiveInfinity, metrics.TimeToDrain);
    }

    [Fact]
    public void ADrawAgainstNoCapacityAtAllDrainsInNoTime()
    {
        WeaponsCapacitorMetrics metrics = WeaponsCapacitor.Metrics(
            new WeaponsCapacitorInput(0, 0, 7));

        Assert.Equal(7, metrics.NetDrainRate);
        Assert.Equal(0, metrics.TimeToDrain);
    }

    [Fact]
    public void FewerPipsRechargeMoreSlowlyAndDrainSooner()
    {
        var input = new WeaponsCapacitorInput(20, 5, 7);

        WeaponsCapacitorMetrics full = WeaponsCapacitor.Metrics(input, 4);
        WeaponsCapacitorMetrics half = WeaponsCapacitor.Metrics(input, 2);

        Assert.Equal(5, full.RechargeRate);
        Assert.True(half.RechargeRate < full.RechargeRate);
        Assert.True(half.TimeToDrain < full.TimeToDrain);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    public void AnAllocationOutsideTheRangeIsRefused(double weaponsPips) =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => WeaponsCapacitor.Metrics(new WeaponsCapacitorInput(20, 5, 7), weaponsPips));

    public static TheoryData<WeaponsCapacitorInput> NonPhysicalLoads() =>
    [
        new WeaponsCapacitorInput(-1, 5, 7),
        new WeaponsCapacitorInput(20, double.NaN, 7),
        new WeaponsCapacitorInput(20, 5, double.PositiveInfinity),
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalLoads))]
    public void AFigureThatIsNotPhysicalIsRefused(WeaponsCapacitorInput input) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => WeaponsCapacitor.Metrics(input));

    [Fact]
    public void AMissingInputIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => WeaponsCapacitor.Metrics(null!));
}
