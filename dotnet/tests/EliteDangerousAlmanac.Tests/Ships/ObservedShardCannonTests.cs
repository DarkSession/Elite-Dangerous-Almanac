using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The fixed Guardian shard cannons, against the outfitting panel one at a time.</summary>
/// <remarks>
/// The readings were taken with Anti-Guardian Zone Resistance running, which grants a
/// capability rather than moving a figure, so the panel shows the stock article. Reading
/// the two cannons on their own is what separates them: a mixed build's combined damage
/// agrees with more than one set of figures behind it.
/// </remarks>
public class ObservedShardCannonTests
{
    private static readonly ObservedShardCannonsFixture Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc")
            .ObservedGuardianShardCannons;

    public static TheoryData<string> Cannons()
    {
        TheoryData<string> symbols = [];
        foreach (ObservedShardCannonFixture record in Fixture.Records) symbols.Add(record.Symbol);
        return symbols;
    }

    [Fact]
    public void TheReadingsWereTakenWithTheZoneResistanceRunning()
    {
        Assert.Equal("Anti-Guardian Zone Resistance", Fixture.Blueprint);
        Assert.Equal(1, Fixture.Grade);
        Assert.True(Fixture.Active);
    }

    [Theory]
    [MemberData(nameof(Cannons))]
    public void AShardCannonReproducesItsOwnOutfittingPanel(string symbol)
    {
        ObservedShardCannonFixture expected = Record(symbol);
        OutfittingModule cannon = ModuleCatalogue.FindBySymbol(symbol)!;
        ModuleStats stats = cannon.Stats;

        Assert.Equal(expected.Class, cannon.Class);
        Assert.Equal(expected.Mass, stats[ModuleStat.Mass]);
        Assert.Equal(expected.Integrity, stats[ModuleStat.Integrity]);
        Assert.Equal(expected.PowerDraw, stats[ModuleStat.PowerDraw]);
        Assert.Equal(expected.DistributorDraw, stats[ModuleStat.DistributorDraw]);
        Assert.Equal(expected.ThermalLoad, stats[ModuleStat.ThermalLoad]);
        Assert.Equal(expected.ArmourPiercing, stats[ModuleStat.ArmourPiercing]);
        Assert.Equal(expected.MaximumRange, stats[ModuleStat.MaximumRange]);
        Assert.Equal(expected.ClipSize, stats[ModuleStat.ClipSize]);
        Assert.Equal(expected.AmmoMaximum, stats[ModuleStat.AmmoMaximum]);
        Assert.Equal(expected.FalloffRange, stats[ModuleStat.FalloffRange]);

        Assert.True(
            expected.Damage.Matches(stats[ModuleStat.Damage]!.Value),
            $"{symbol} damage: {stats[ModuleStat.Damage]}");
        Assert.True(
            expected.ShotSpeed.Matches(stats[ModuleStat.ShotSpeed]!.Value), $"{symbol} shot speed");
        Assert.True(
            expected.RateOfFire.Matches(stats[ModuleStat.RateOfFire]!.Value),
            $"{symbol} rate of fire");
        Assert.True(
            expected.DamagePerSecond.Matches(
                Weapons.DamagePerSecond(WeaponStats.FromModule(cannon))),
            $"{symbol} damage per second");

        // The panel names one damage type. The anti-xeno share overlays that rather than
        // splitting it, so the record carries both at their whole share.
        Assert.Equal("Thermal", expected.DamageType);
        Assert.Equal(1, cannon.DamageDistribution!.Thermal);
        Assert.Equal(1, cannon.DamageDistribution.AntiXeno);
    }

    private static ObservedShardCannonFixture Record(string symbol)
    {
        foreach (ObservedShardCannonFixture record in Fixture.Records)
        {
            if (record.Symbol == symbol) return record;
        }

        throw new KeyNotFoundException($"The fixture states no cannon '{symbol}'.");
    }
}
