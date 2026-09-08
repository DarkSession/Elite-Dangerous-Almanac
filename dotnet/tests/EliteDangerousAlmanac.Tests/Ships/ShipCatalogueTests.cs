using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The ship catalogue, measured against the shared fixtures.</summary>
public class ShipCatalogueTests
{
    private static readonly ShipsFixture Fixture =
        SharedFixtures.Load<ShipsFixture>("fixtures/ships/ships.jsonc");

    private static readonly ShipStatsFixture Stats =
        SharedFixtures.Load<ShipStatsFixture>("fixtures/ships/ship-stats.jsonc");

    public static TheoryData<string> PinnedHulls()
    {
        TheoryData<string> data = [];
        foreach (ShipFixtureRecord record in Fixture.Records) data.Add(record.Symbol);
        return data;
    }

    public static TheoryData<string> Corrections()
    {
        TheoryData<string> data = [];
        foreach (ShipFixtureRecord record in Fixture.DisplayNameCorrections) data.Add(record.Symbol);
        return data;
    }

    [Fact]
    public void TheCatalogueHoldsEveryFlyableHull() => Assert.Equal(Fixture.Count, ShipCatalogue.All.Count);

    [Theory]
    [MemberData(nameof(PinnedHulls))]
    public void PinnedHullsCarryTheirFixtureIdentity(string symbol)
    {
        ShipFixtureRecord expected = Fixture.Records.Single(record => record.Symbol == symbol);
        Ship? ship = ShipCatalogue.FindBySymbol(symbol);
        Assert.NotNull(ship);
        Assert.Equal(expected.Name, ship!.Name);
        Assert.Equal(expected.Manufacturer, ship.Manufacturer);
        Assert.Equal(expected.Size, ship.Size.ToString(), ignoreCase: true);
        Assert.Equal(expected.Entitlement, ship.Entitlement);
    }

    [Theory]
    [MemberData(nameof(Corrections))]
    public void AHullUsesItsInstalledDisplayNameNotTheRegistrySpelling(string symbol)
    {
        ShipFixtureRecord expected = Fixture.DisplayNameCorrections.Single(record => record.Symbol == symbol);
        Assert.Equal(expected.Name, ShipCatalogue.FindBySymbol(symbol)?.Name);
    }

    [Fact]
    public void PinnedLookupsResolveTheirHull()
    {
        foreach (ShipLookupFixture lookup in Fixture.Lookups)
        {
            Ship? ship = lookup.By == "symbol"
                ? ShipCatalogue.FindBySymbol(lookup.Query)
                : ShipCatalogue.FindByName(lookup.Query);
            Assert.NotNull(ship);
            if (lookup.Name is not null) Assert.Equal(lookup.Name, ship!.Name);
            if (lookup.Symbol is not null) Assert.Equal(lookup.Symbol, ship!.Symbol);
        }
    }

    [Fact]
    public void SymbolsAndNamesAreEachUniqueAcrossTheCatalogue()
    {
        Assert.Equal(
            ShipCatalogue.All.Count,
            ShipCatalogue.All.Select(ship => ship.Symbol.ToUpperInvariant()).Distinct().Count());
        Assert.Equal(
            ShipCatalogue.All.Count,
            ShipCatalogue.All.Select(ship => ship.Name.ToUpperInvariant()).Distinct().Count());
    }

    [Fact]
    public void AnAbsentOrUnknownSymbolIsAMiss()
    {
        Assert.Null(ShipCatalogue.FindBySymbol(null));
        Assert.Null(ShipCatalogue.FindBySymbol("   "));
        Assert.Null(ShipCatalogue.FindByName("Not A Ship"));
        Assert.Null(ShipCatalogue.FindSlots("Not A Ship"));
    }

    [Fact]
    public void EveryHullIsPricedAndTheRetailPriceIncludesTheHull()
    {
        Assert.Equal(Stats.PricedCount, ShipCatalogue.All.Count(ship => ship.HullCost > 0));
        Assert.All(ShipCatalogue.All, ship => Assert.True(ship.RetailCost >= ship.HullCost));
    }

    [Fact]
    public void EveryPinnedStatMatchesTheFixture()
    {
        List<ShipStatFixture> pinned =
        [
            .. Stats.Prices,
            .. Stats.Spot,
            .. Stats.InGameCorrections,
            .. Stats.SpeedEndpoints,
            .. Stats.RotationEndpoints,
            .. Stats.HeatDissipation.Values,
            Stats.HeatDissipation.Minimum,
            Stats.HeatDissipation.Maximum,
        ];

        Assert.NotEmpty(pinned);
        foreach (ShipStatFixture expected in pinned)
        {
            Ship? ship = ShipCatalogue.FindBySymbol(expected.Symbol);
            Assert.NotNull(ship);
            foreach (KeyValuePair<string, JsonElement> stat in expected.Values)
            {
                Assert.Equal(stat.Value.GetDouble(), StatOf(ship!, stat.Key), 6);
            }
        }
    }

    [Fact]
    public void NoHullDissipatesHeatOutsideTheMeasuredRange()
    {
        double lowest = Stats.HeatDissipation.Minimum.Values["heatDissipation"].GetDouble();
        double highest = Stats.HeatDissipation.Maximum.Values["heatDissipation"].GetDouble();
        Assert.All(ShipCatalogue.All, ship => Assert.InRange(ship.HeatDissipation, lowest, highest));
    }

    [Fact]
    public void EveryHullDissipatesHeatAndSpeedEndpointsAreOrdered()
    {
        Assert.All(ShipCatalogue.All, ship => Assert.True(ship.HeatDissipation > 0));
        Assert.All(ShipCatalogue.All, ship => Assert.True(ship.MinimumSpeed <= ship.MaximumSpeed));
        Assert.All(ShipCatalogue.All, ship => Assert.True(ship.MinPitch <= ship.Pitch));
        Assert.All(ShipCatalogue.All, ship => Assert.True(ship.MinRoll <= ship.Roll));
        Assert.All(ShipCatalogue.All, ship => Assert.True(ship.MinYaw <= ship.Yaw));
    }

    private static double StatOf(Ship ship, string field) => field switch
    {
        "hullMass" => ship.HullMass,
        "minimumSpeed" => ship.MinimumSpeed,
        "maximumSpeed" => ship.MaximumSpeed,
        "boost" => ship.Boost,
        "baseShieldStrength" => ship.BaseShieldStrength,
        "baseArmour" => ship.BaseArmour,
        "hardness" => ship.Hardness,
        "masslock" => ship.Masslock,
        "crew" => ship.Crew,
        "heatCapacity" => ship.HeatCapacity,
        "heatDissipation" => ship.HeatDissipation,
        "reserveFuelCapacity" => ship.ReserveFuelCapacity,
        "minPitch" => ship.MinPitch,
        "pitch" => ship.Pitch,
        "minRoll" => ship.MinRoll,
        "roll" => ship.Roll,
        "minYaw" => ship.MinYaw,
        "yaw" => ship.Yaw,
        "hullCost" => ship.HullCost,
        "retailCost" => ship.RetailCost,
        _ => throw new System.ArgumentOutOfRangeException(nameof(field), field, "Not a hull stat."),
    };
}
