using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The per-ship module-count allowance, and what a build makes of it.</summary>
public class ModuleLimitsTests
{
    private static readonly ModuleLimitsFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc").ModuleLimits;

    [Fact]
    public void TheSharedFixturePinsTheAllowanceAndTheExcess()
    {
        List<ModuleLimitEntry> modules = [];
        foreach (ModuleLimitEntryFixture stated in Fixture.Input)
        {
            modules.Add(new ModuleLimitEntry(
                LimitGroup: stated.LimitGroup is null ? null : ModuleLimitGroup.ExperimentalWeapon,
                LimitIncrease: stated.LimitIncrease is null
                    ? null
                    : new ModuleLimitIncrease(
                        ModuleLimitGroup.ExperimentalWeapon, stated.LimitIncrease.Amount)));
        }

        ModuleLimitUsage usage = Assert.Single(ModuleLimits.Calculate(modules));

        Assert.Equal(ModuleLimitGroup.ExperimentalWeapon, usage.Group);
        Assert.Equal(Fixture.ExpectedUsage.BaseLimit, usage.BaseLimit);
        Assert.Equal(Fixture.ExpectedUsage.Increase, usage.Increase);
        Assert.Equal(Fixture.ExpectedUsage.Limit, usage.Limit);
        Assert.Equal(Fixture.ExpectedUsage.Count, usage.Count);
        Assert.Equal(Fixture.ExpectedUsage.Excess, usage.Excess);
    }

    [Fact]
    public void TheBaseAllowanceIsTheFixturesOwn() =>
        Assert.Equal(
            Fixture.ExpectedUsage.BaseLimit,
            ModuleLimits.ShipLimits[ModuleLimitGroup.ExperimentalWeapon]);

    [Fact]
    public void TheCatalogueCarriesTheFixturesLimitedModules()
    {
        int limited = 0;
        foreach (OutfittingModule module in ModuleCatalogue.All)
        {
            if (module.LimitGroup is not null) limited++;
        }

        Assert.Equal(Fixture.Catalogue.LimitedCount, limited);
        Assert.Equal(
            ModuleLimitGroup.ExperimentalWeapon,
            ModuleCatalogue.FindBySymbol(Fixture.Catalogue.Weapon)!.LimitGroup);
    }

    [Fact]
    public void TheCatalogueCarriesTheFixturesStabilisers()
    {
        foreach (ModuleLimitIncreaseModuleFixture stated in Fixture.Catalogue.Increases)
        {
            ModuleLimitIncrease increase =
                ModuleCatalogue.FindBySymbol(stated.Symbol)!.LimitIncrease!;

            Assert.Equal(ModuleLimitGroup.ExperimentalWeapon, increase.Group);
            Assert.Equal(stated.Amount, increase.Amount);
        }
    }

    [Fact]
    public void AModulesLimitFactsCanBeReadOffTheCatalogueRecord()
    {
        OutfittingModule stabiliser =
            ModuleCatalogue.FindBySymbol("Int_ExpModuleStabiliser_Size5_Class3")!;

        ModuleLimitEntry entry = ModuleLimitEntry.FromModule(stabiliser);

        Assert.Null(entry.LimitGroup);
        Assert.Equal(stabiliser.LimitIncrease, entry.LimitIncrease);
    }

    [Fact]
    public void ABuildWithinItsAllowanceHasNoExcess()
    {
        ModuleLimitUsage usage = Assert.Single(ModuleLimits.Calculate([
            new ModuleLimitEntry(ModuleLimitGroup.ExperimentalWeapon),
            new ModuleLimitEntry(ModuleLimitGroup.ExperimentalWeapon),
        ]));

        Assert.Equal(2, usage.Count);
        Assert.Equal(0, usage.Increase);
        Assert.Equal(4, usage.Limit);
        Assert.Equal(0, usage.Excess);
    }

    [Fact]
    public void OneModuleCanBothConsumeAPlaceAndRaiseTheAllowance()
    {
        ModuleLimitUsage usage = Assert.Single(ModuleLimits.Calculate([
            new ModuleLimitEntry(
                ModuleLimitGroup.ExperimentalWeapon,
                new ModuleLimitIncrease(ModuleLimitGroup.ExperimentalWeapon, 2)),
        ]));

        Assert.Equal(1, usage.Count);
        Assert.Equal(2, usage.Increase);
        Assert.Equal(6, usage.Limit);
    }

    [Fact]
    public void AnEmptyBuildStillReportsEveryKnownFamily()
    {
        ModuleLimitUsage usage = Assert.Single(ModuleLimits.Calculate([]));

        Assert.Equal(0, usage.Count);
        Assert.Equal(0, usage.Excess);
        Assert.Equal(usage.BaseLimit, usage.Limit);
    }

    [Fact]
    public void TheUsageListRefusesMutation() =>
        Assert.Throws<NotSupportedException>(
            () => ((IList<ModuleLimitUsage>)ModuleLimits.Calculate([])).Clear());

    [Fact]
    public void AMissingModuleListIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => ModuleLimits.Calculate(null!));
        Assert.Throws<ArgumentNullException>(() => ModuleLimitEntry.FromModule(null!));
    }
}
