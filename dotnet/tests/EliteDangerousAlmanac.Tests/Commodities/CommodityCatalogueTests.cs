using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Commodities;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Commodities;

/// <summary>
/// The market-commodity registries, measured against the shared fixture.
/// </summary>
public class CommodityCatalogueTests
{
    private static readonly CommoditiesFixture Fixture =
        SharedFixtures.Load<CommoditiesFixture>("fixtures/commodities/commodities.jsonc");

    public static TheoryData<string, int> Counts()
    {
        TheoryData<string, int> data = [];
        foreach (KeyValuePair<string, int> entry in Fixture.Counts) data.Add(entry.Key, entry.Value);
        return data;
    }

    public static TheoryData<string, int> CategoryCounts()
    {
        TheoryData<string, int> data = [];
        foreach (KeyValuePair<string, int> entry in Fixture.CategoryCounts) data.Add(entry.Key, entry.Value);
        return data;
    }

    public static TheoryData<string> FixtureSymbols()
    {
        TheoryData<string> data = [];
        foreach (CommodityFixtureRecord record in Fixture.Records) data.Add(record.Symbol);
        return data;
    }

    [Theory]
    [MemberData(nameof(Counts))]
    public void CatalogueHoldsTheFixturesCount(string catalogue, int expected) =>
        Assert.Equal(expected, CatalogueNamed(catalogue).Count);

    [Theory]
    [MemberData(nameof(CategoryCounts))]
    public void MarketGroupHoldsTheFixturesCount(string category, int expected) =>
        Assert.Equal(expected, CommodityCatalogue.InCategory(category).Count);

    [Fact]
    public void AllIsTheTwoRegistriesConcatenated() =>
        Assert.Equal(
            CommodityCatalogue.Standard.Concat(CommodityCatalogue.Rare),
            CommodityCatalogue.All);

    [Fact]
    public void EveryCommodityUsesAGroupTheFixtureNames()
    {
        HashSet<string> allowed = [.. Fixture.Categories];
        foreach (Commodity commodity in CommodityCatalogue.All)
        {
            Assert.Contains(commodity.Category.DisplayName(), allowed);
        }
    }

    [Theory]
    [MemberData(nameof(FixtureSymbols))]
    public void FixtureRecordsResolveBySymbolAndName(string symbol)
    {
        CommodityFixtureRecord expected = Fixture.Records.Single(record => record.Symbol == symbol);
        Commodity? bySymbol = CommodityCatalogue.FindBySymbol(symbol);
        Assert.NotNull(bySymbol);
        Assert.Equal(expected.Name, bySymbol!.Name);
        Assert.Equal(expected.Category, bySymbol.Category.DisplayName());
        Assert.Equal(expected.Rare, bySymbol.Rare);
        Assert.Same(bySymbol, CommodityCatalogue.FindByName(expected.Name));
    }

    [Fact]
    public void TheRareFlagFollowsTheRegistryTheRecordLivesIn()
    {
        Assert.All(CommodityCatalogue.Standard, commodity => Assert.False(commodity.Rare));
        Assert.All(CommodityCatalogue.Rare, commodity => Assert.True(commodity.Rare));
    }

    [Fact]
    public void ASymbolResolvesTheWayTheMarketReportsIt()
    {
        Assert.Equal("Lavian Brandy", CommodityCatalogue.FindBySymbol("lavianbrandy")?.Name);
        Assert.Equal(CommodityCategory.Metals, CommodityCatalogue.FindBySymbol("  PLATINUM ")?.Category);
    }

    [Fact]
    public void AnAbsentOrEmptyKeyIsAMissRatherThanAFailure()
    {
        Assert.Null(CommodityCatalogue.FindBySymbol(null));
        Assert.Null(CommodityCatalogue.FindByName("   "));
        Assert.Empty(CommodityCatalogue.InCategory((string?)null));
        Assert.Empty(CommodityCatalogue.InCategory("Nothing Named This"));
    }

    [Fact]
    public void ASubsetNarrowsTheSearchToOneRegistry()
    {
        Assert.NotNull(CommodityCatalogue.FindByName("Lavian Brandy"));
        Assert.Null(CommodityCatalogue.FindByName("Lavian Brandy", CommodityCatalogue.Standard));
        Assert.NotNull(CommodityCatalogue.FindByName("Lavian Brandy", CommodityCatalogue.Rare));
    }

    [Fact]
    public void GroupNamesRoundTripThroughTheirInGameSpelling()
    {
        foreach (CommodityCategory category in System.Enum.GetValues<CommodityCategory>())
        {
            Assert.True(CommodityCategories.TryParse(category.DisplayName(), out CommodityCategory parsed));
            Assert.Equal(category, parsed);
            Assert.True(CommodityCategories.TryParse(category.ToString(), out parsed));
            Assert.Equal(category, parsed);
        }

        Assert.Throws<System.ArgumentOutOfRangeException>(() => ((CommodityCategory)99).DisplayName());
        Assert.False(CommodityCategories.TryParse(null, out _));
    }

    [Fact]
    public void InCategoryReturnsBothRegistriesAndKeepsRegistryOrder()
    {
        IReadOnlyList<Commodity> metals = CommodityCatalogue.InCategory(CommodityCategory.Metals);
        Assert.Equal(metals, CommodityCatalogue.InCategory("metals"));
        Assert.Equal(
            CommodityCatalogue.All.Where(commodity => commodity.Category == CommodityCategory.Metals),
            metals);
    }

    private static IReadOnlyList<Commodity> CatalogueNamed(string name) => name switch
    {
        "standard" => CommodityCatalogue.Standard,
        "rare" => CommodityCatalogue.Rare,
        _ => CommodityCatalogue.All,
    };
}
