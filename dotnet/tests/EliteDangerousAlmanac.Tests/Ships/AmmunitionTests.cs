using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What a module holds when fully rearmed.</summary>
public class AmmunitionTests
{
    private static readonly AmmunitionFixture Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc").Ammunition;

    public static TheoryData<string> Carriers()
    {
        TheoryData<string> symbols = [];
        foreach (AmmunitionCaseFixture module in Fixture.Catalogue) symbols.Add(module.Symbol);
        return symbols;
    }

    public static TheoryData<string> Lasers()
    {
        TheoryData<string> symbols = [];
        foreach (string symbol in Fixture.NoAmmunition) symbols.Add(symbol);
        return symbols;
    }

    [Theory]
    [MemberData(nameof(Carriers))]
    public void AModuleHoldsTheFixturesRounds(string symbol)
    {
        AmmunitionCaseFixture stated = Fixture.Catalogue.Find(module => module.Symbol == symbol)!;

        AmmunitionCapacity capacity = Ammunition.Capacity(ModuleCatalogue.FindBySymbol(symbol)!)!;

        Assert.Equal(stated.ClipSize, capacity.ClipSize);
        Assert.Equal(stated.Unlimited, capacity.Unlimited);
        // The fixture cannot write infinity, so an unlimited reserve is stated as no figure.
        Assert.Equal(stated.Hopper ?? double.PositiveInfinity, capacity.Hopper);
        Assert.Equal(stated.Total ?? double.PositiveInfinity, capacity.Total);
    }

    [Theory]
    [MemberData(nameof(Lasers))]
    public void AModuleThatDrawsFromTheCapacitorHasNoAmmunitionToCount(string symbol) =>
        Assert.Null(Ammunition.Capacity(ModuleCatalogue.FindBySymbol(symbol)!));

    [Fact]
    public void AReserveOfNothingIsNotAnUnlimitedOne()
    {
        AmmunitionCapacity spent = Ammunition.Capacity(
            ModuleStats.From([
                new(ModuleStat.ClipSize, 18),
                new(ModuleStat.AmmoMaximum, 0),
            ]))!;

        Assert.False(spent.Unlimited);
        Assert.Equal(0, spent.Hopper);
        Assert.Equal(18, spent.Total);
    }

    [Fact]
    public void AMagazineWithNoReserveStatedIsOneNothingStopsRefilling()
    {
        AmmunitionCapacity unlimited = Ammunition.Capacity(
            ModuleStats.From([new(ModuleStat.ClipSize, 1)]))!;

        Assert.True(unlimited.Unlimited);
        Assert.Equal(double.PositiveInfinity, unlimited.Hopper);
        Assert.Equal(double.PositiveInfinity, unlimited.Total);
    }

    [Fact]
    public void AReserveWithNoMagazineStatedIsDrawnFromDirectly()
    {
        AmmunitionCapacity reserve = Ammunition.Capacity(
            ModuleStats.From([new(ModuleStat.AmmoMaximum, 3600)]))!;

        Assert.Equal(0, reserve.ClipSize);
        Assert.Equal(3600, reserve.Hopper);
        Assert.Equal(3600, reserve.Total);
        Assert.False(reserve.Unlimited);
    }

    [Fact]
    public void AModuleStatingNeitherFigureCarriesNoAmmunition() =>
        Assert.Null(Ammunition.Capacity(ModuleStats.Empty));

    [Fact]
    public void AMissingModuleIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => Ammunition.Capacity((ModuleStats)null!));
        Assert.Throws<ArgumentNullException>(() => Ammunition.Capacity((OutfittingModule)null!));
    }
}
