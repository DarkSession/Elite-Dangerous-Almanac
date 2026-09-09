using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The stock module loadout every hull is supplied with.</summary>
public class DefaultLoadoutsTests
{
    private static readonly DefaultLoadoutsFixture Fixture =
        SharedFixtures.Load<DefaultLoadoutsFixture>("fixtures/ships/default-loadouts.jsonc");

    public static TheoryData<string> Hulls()
    {
        TheoryData<string> ships = [];
        foreach (DefaultLoadoutCaseFixture hull in Fixture.Spot) ships.Add(hull.Ship);
        return ships;
    }

    [Theory]
    [MemberData(nameof(Hulls))]
    public void AHullFitsTheFixturesStockModules(string ship)
    {
        DefaultLoadoutCaseFixture stated = Fixture.Spot.Find(hull => hull.Ship == ship)!;

        DefaultLoadout loadout = DefaultLoadouts.Find(ship)!;

        foreach (DefaultLoadoutModuleFixture module in stated.Modules)
        {
            DefaultLoadoutModule fitted = Assert.Single(
                loadout.Modules, entry => entry.Slot == module.Slot);

            Assert.Equal(module.Symbol, fitted.Symbol);
        }

        // An empty mount is left out of the record rather than carried as a blank one.
        foreach (string empty in stated.Empty)
        {
            Assert.DoesNotContain(loadout.Modules, entry => entry.Slot == empty);
        }
    }

    [Fact]
    public void EveryPlayerFlyableHullIsSuppliedReadyToFly()
    {
        int modules = 0;
        foreach (Ship ship in ShipCatalogue.All)
        {
            DefaultLoadout loadout = DefaultLoadouts.Find(ship.Symbol)!;

            Assert.NotNull(loadout);
            Assert.Equal(ship.Symbol, loadout.Symbol);
            modules += loadout.Modules.Count;
        }

        Assert.Equal(Fixture.ShipCount, DefaultLoadouts.All.Count);
        Assert.Equal(Fixture.ModuleCount, modules);
    }

    [Fact]
    public void EveryStockModuleIsACatalogueArticleInAKnownMount()
    {
        List<string> unresolved = [];
        foreach (DefaultLoadout loadout in DefaultLoadouts.All)
        {
            foreach (DefaultLoadoutModule module in loadout.Modules)
            {
                Assert.NotEmpty(module.Slot);
                if (ModuleCatalogue.FindBySymbol(module.Symbol) is null)
                {
                    unresolved.Add($"{module.Slot}: {module.Symbol}");
                }
            }
        }

        // The hull-specific cargo hatch is the one stock symbol the catalogue does not carry.
        // The standard hatch supplies its stats, so it resolves at the mount rather than here.
        Assert.All(unresolved, entry => Assert.StartsWith("CargoHatch: ", entry));
    }

    [Fact]
    public void AHullSymbolResolvesWhateverItsCaseOrSpacing()
    {
        DefaultLoadout plain = DefaultLoadouts.Find("SideWinder")!;

        Assert.Same(plain, DefaultLoadouts.Find(" sidewinder "));
        Assert.Same(plain, DefaultLoadouts.Find("SIDEWINDER"));
    }

    [Fact]
    public void AnUnknownOrAbsentHullIsAMiss()
    {
        Assert.Null(DefaultLoadouts.Find("not_a_ship"));
        Assert.Null(DefaultLoadouts.Find(null));
    }

    [Fact]
    public void TheCatalogueRefusesMutation()
    {
        Assert.Throws<System.NotSupportedException>(
            () => ((IList<DefaultLoadout>)DefaultLoadouts.All).Clear());
        Assert.Throws<System.NotSupportedException>(
            () => ((IList<DefaultLoadoutModule>)DefaultLoadouts.All[0].Modules).Clear());
    }
}
