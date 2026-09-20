using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using EliteDangerousAlmanac.GalaxyMap;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.GalaxyMap;

/// <summary>
/// The galaxy-map marker catalogue, measured against the shared fixture.
/// </summary>
public class GalaxyMapMarkerCatalogueTests
{
    private static readonly GalaxyMapMarkersFixture Fixture =
        SharedFixtures.Load<GalaxyMapMarkersFixture>("fixtures/galaxy-map/markers.jsonc");

    private static readonly Regex HexColor = new("^#[0-9A-F]{6}$", RegexOptions.CultureInvariant);

    public static TheoryData<string, string, string> Records()
    {
        TheoryData<string, string, string> data = [];
        foreach (GalaxyMapMarkerFixtureRecord record in Fixture.Records)
        {
            data.Add(record.Symbol, record.Color, record.FrameColor);
        }

        return data;
    }

    [Fact]
    public void CatalogueHoldsThePinnedNumberOfMarkers() =>
        Assert.Equal(Fixture.Count, GalaxyMapMarkerCatalogue.All.Count);

    [Theory]
    [MemberData(nameof(Records))]
    public void EveryPinnedMarkerIsFoundBySymbol(string symbol, string color, string frameColor)
    {
        GalaxyMapMarker? marker = GalaxyMapMarkerCatalogue.FindBySymbol(symbol);

        Assert.NotNull(marker);
        Assert.Equal(symbol, marker!.Symbol);
        Assert.Equal(color, marker.Color);
        Assert.Equal(frameColor, marker.FrameColor);
    }

    [Fact]
    public void CatalogueOrderMatchesTheFixture() =>
        Assert.Equal(
            Fixture.Records.Select(record => record.Symbol).ToList(),
            GalaxyMapMarkerCatalogue.All.Select(marker => marker.Symbol).ToList());

    [Fact]
    public void CatalogueIsSortedBySymbol()
    {
        List<string> symbols = GalaxyMapMarkerCatalogue.All.Select(marker => marker.Symbol).ToList();

        Assert.Equal(symbols.OrderBy(symbol => symbol, System.StringComparer.Ordinal).ToList(), symbols);
    }

    [Fact]
    public void SymbolsAreUnique()
    {
        List<string> symbols = GalaxyMapMarkerCatalogue.All.Select(marker => marker.Symbol).ToList();

        Assert.Equal(symbols.Count, symbols.Distinct(System.StringComparer.Ordinal).Count());
    }

    [Fact]
    public void PaletteIsThePinnedSetOfDistinctColours() =>
        Assert.Equal(
            Fixture.DistinctColors,
            GalaxyMapMarkerCatalogue.All
                .Select(marker => marker.Color)
                .Distinct()
                .OrderBy(color => color, System.StringComparer.Ordinal)
                .ToList());

    [Fact]
    public void OnlyThePinnedMarkersAreFramedInASecondColour() =>
        Assert.Equal(
            Fixture.FramedDifferently,
            GalaxyMapMarkerCatalogue.All
                .Where(marker => marker.FrameColor != marker.Color)
                .Select(marker => marker.Symbol)
                .ToList());

    [Fact]
    public void EveryColourIsAnUppercaseHexString()
    {
        foreach (GalaxyMapMarker marker in GalaxyMapMarkerCatalogue.All)
        {
            Assert.Matches(HexColor, marker.Color);
            Assert.Matches(HexColor, marker.FrameColor);
        }
    }

    [Theory]
    [InlineData("  FRONT-LINE ", "#9418FF")]
    [InlineData("Titan", "#FF0000")]
    [InlineData("mission", "#005DFF")]
    public void LookupsIgnoreCaseAndSurroundingWhitespace(string symbol, string expected) =>
        Assert.Equal(expected, GalaxyMapMarkerCatalogue.FindColor(symbol));

    [Theory]
    [InlineData("no-such-marker")]
    [InlineData("")]
    [InlineData(null)]
    public void AnUnrecognisedSymbolIsAMiss(string? symbol)
    {
        Assert.Null(GalaxyMapMarkerCatalogue.FindBySymbol(symbol));
        Assert.Null(GalaxyMapMarkerCatalogue.FindColor(symbol));
    }
}
