using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using EliteDangerousAlmanac.Materials;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Materials;

/// <summary>
/// The Odyssey micro-resource catalogues, measured against the shared fixture.
/// </summary>
public class MicroResourceCatalogueTests
{
    private static readonly MicroResourcesFixture Fixture =
        SharedFixtures.Load<MicroResourcesFixture>("fixtures/materials/micro-resources.jsonc");

    public static TheoryData<string, int> Counts()
    {
        TheoryData<string, int> data = [];
        foreach (KeyValuePair<string, int> entry in Fixture.Counts) data.Add(entry.Key, entry.Value);
        return data;
    }

    public static TheoryData<string, string> Memberships()
    {
        TheoryData<string, string> data = [];
        foreach (KeyValuePair<string, string> entry in Fixture.MembershipSha256) data.Add(entry.Key, entry.Value);
        return data;
    }

    public static TheoryData<string> FixtureSymbols()
    {
        TheoryData<string> data = [];
        foreach (MicroResourceFixtureRecord record in Fixture.Records) data.Add(record.Symbol);
        return data;
    }

    [Theory]
    [MemberData(nameof(Counts))]
    public void CatalogueHoldsTheFixturesCount(string catalogue, int expected) =>
        Assert.Equal(expected, CatalogueNamed(catalogue).Count);

    [Theory]
    [MemberData(nameof(Memberships))]
    public void CatalogueRetainsItsAcquiredMembership(string catalogue, string expected)
    {
        StringBuilder symbols = new();
        foreach (MicroResource resource in CatalogueNamed(catalogue))
        {
            symbols.Append(resource.Symbol).Append('\n');
        }

        byte[] digest = SHA256.HashData(Encoding.UTF8.GetBytes(symbols.ToString()));
        Assert.Equal(expected, Hex(digest));
    }

    [Fact]
    public void AllIsTheFourCataloguesConcatenated() =>
        Assert.Equal(
            MicroResourceCatalogue.Components
                .Concat(MicroResourceCatalogue.Consumables)
                .Concat(MicroResourceCatalogue.Data)
                .Concat(MicroResourceCatalogue.Items),
            MicroResourceCatalogue.All);

    [Theory]
    [MemberData(nameof(FixtureSymbols))]
    public void FixtureRecordsResolveBySymbolAndName(string symbol)
    {
        MicroResourceFixtureRecord expected = Fixture.Records.Single(record => record.Symbol == symbol);
        MicroResource? bySymbol = MicroResourceCatalogue.FindBySymbol(symbol);
        Assert.NotNull(bySymbol);
        Assert.Equal(expected.Name, bySymbol!.Name);
        Assert.Equal(expected.Category, bySymbol.Category.ToString(), ignoreCase: true);
        Assert.Same(bySymbol, MicroResourceCatalogue.FindByName(expected.Name));
    }

    [Fact]
    public void SymbolLookupIgnoresCaseAndSurroundingWhitespace()
    {
        Assert.Equal("Circuit Board", MicroResourceCatalogue.FindBySymbol("CIRCUITBOARD")?.Name);
        Assert.Equal("circuitboard", MicroResourceCatalogue.FindByName("  circuit board  ")?.Symbol);
    }

    [Fact]
    public void AnAbsentOrEmptyKeyIsAMissRatherThanAFailure()
    {
        Assert.Null(MicroResourceCatalogue.FindBySymbol(null));
        Assert.Null(MicroResourceCatalogue.FindByName(string.Empty));
    }

    [Fact]
    public void ASubsetNarrowsTheSearch()
    {
        Assert.NotNull(MicroResourceCatalogue.FindBySymbol("graphene"));
        Assert.Null(MicroResourceCatalogue.FindBySymbol("graphene", MicroResourceCatalogue.Consumables));
        Assert.NotNull(MicroResourceCatalogue.FindByName("Graphene", MicroResourceCatalogue.Components));
        Assert.Null(MicroResourceCatalogue.FindByName("Graphene", MicroResourceCatalogue.Items));
    }

    [Fact]
    public void InCategoryReachesTheSameCatalogueFromAString()
    {
        Assert.Same(MicroResourceCatalogue.Consumables, MicroResourceCatalogue.InCategory("consumable"));
        Assert.Same(MicroResourceCatalogue.Consumables, MicroResourceCatalogue.InCategory("Consumable"));
        Assert.Same(MicroResourceCatalogue.Data, MicroResourceCatalogue.InCategory(MicroResourceCategory.Data));
        Assert.Same(MicroResourceCatalogue.Items, MicroResourceCatalogue.InCategory(MicroResourceCategory.Item));
        Assert.Empty(MicroResourceCatalogue.InCategory("material"));
        Assert.Empty(MicroResourceCatalogue.InCategory((MicroResourceCategory)9));
    }

    [Fact]
    public void EveryCategoryStampsItsOwnRecords()
    {
        Assert.All(MicroResourceCatalogue.Components, r => Assert.Equal(MicroResourceCategory.Component, r.Category));
        Assert.All(MicroResourceCatalogue.Consumables, r => Assert.Equal(MicroResourceCategory.Consumable, r.Category));
        Assert.All(MicroResourceCatalogue.Data, r => Assert.Equal(MicroResourceCategory.Data, r.Category));
        Assert.All(MicroResourceCatalogue.Items, r => Assert.Equal(MicroResourceCategory.Item, r.Category));
    }

    private static string Hex(byte[] digest)
    {
        StringBuilder text = new(digest.Length * 2);
        foreach (byte value in digest) text.Append(value.ToString("x2", CultureInfo.InvariantCulture));
        return text.ToString();
    }

    private static IReadOnlyList<MicroResource> CatalogueNamed(string name) => name switch
    {
        "component" => MicroResourceCatalogue.Components,
        "consumable" => MicroResourceCatalogue.Consumables,
        "data" => MicroResourceCatalogue.Data,
        "item" => MicroResourceCatalogue.Items,
        _ => MicroResourceCatalogue.All,
    };
}
