using System;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The 42 codex regions, and which one a place belongs to.</summary>
public sealed class CodexRegionTests
{
    private static readonly GalacticRegionFixture Fixture =
        SharedFixtures.Load<GalacticRegionFixture>("fixtures/astro/galactic-region.jsonc");

    public static TheoryData<int> PlaceCases => Indices(Fixture.Coords.Count);

    public static TheoryData<int> BoxelCases => Indices(Fixture.Boxels.Count);

    [Fact]
    public void TheGalaxyCornerIsTheSamePointInBothPlacesItIsStated()
    {
        // The corner is a plain constant beside the grid, so that reading a coordinate
        // never reads the region cells. This holds the two together.
        Assert.Equal(GalaxyGrid.Origin.X, CodexRegionMap.OriginX);
        Assert.Equal(GalaxyGrid.Origin.Y, CodexRegionMap.OriginY);
        Assert.Equal(GalaxyGrid.Origin.Z, CodexRegionMap.OriginZ);
    }

    [Fact]
    public void TheGalaxyHolds42Regions()
    {
        Assert.Equal(42, CodexRegions.All.Count);
        for (int index = 0; index < CodexRegions.All.Count; index++)
        {
            Assert.Equal(index + 1, CodexRegions.All[index].Id);
        }
    }

    [Theory]
    [MemberData(nameof(PlaceCases))]
    public void EachPlaceSitsInTheRegionTheFixtureStates(int index)
    {
        RegionCoordsCaseFixture expected = Fixture.Coords[index];

        CodexRegion? region = CodexRegionMap.FindAt(expected.X, expected.Z);

        Assert.NotNull(region);
        Assert.Equal(expected.RegionId, region!.Id);
        Assert.Equal(expected.Region, region.Name);
        Assert.Equal(region, CodexRegionMap.FindAt(new GalacticPlanePosition(expected.X, expected.Z)));
        Assert.Equal(region, CodexRegionMap.FindAt(new GalacticPosition(expected.X, 0, expected.Z)));
    }

    [Theory]
    [MemberData(nameof(BoxelCases))]
    public void EachBoxelCornerSitsInTheRegionTheFixtureStates(int index)
    {
        RegionBoxelCaseFixture expected = Fixture.Boxels[index];

        BoxelCodexRegion found = CodexRegionMap.FindForBoxel(SystemAddress.Parse(expected.Id64));

        Assert.Equal(expected.X, found.X);
        Assert.Equal(expected.Y, found.Y);
        Assert.Equal(expected.Z, found.Z);
        Assert.NotNull(found.Region);
        Assert.Equal(expected.RegionId, found.Region!.Id);
        Assert.Equal(expected.Region, found.Region.Name);
    }

    [Fact]
    public void EachRegionCarriesTheFootprintTheGridGivesIt()
    {
        foreach (CodexRegion region in CodexRegions.All)
        {
            Assert.False(string.IsNullOrWhiteSpace(region.Name));
            Assert.True(region.CellCount > 0);
            Assert.True(region.AreaLy2 > 0);
            Assert.True(region.Bounds.MinX <= region.Bounds.MaxX);
            Assert.True(region.Bounds.MinZ <= region.Bounds.MaxZ);
            Assert.InRange(region.Centroid.X, region.Bounds.MinX, region.Bounds.MaxX);
            Assert.InRange(region.Centroid.Z, region.Bounds.MinZ, region.Bounds.MaxZ);
            Assert.Equal(region, CodexRegions.Find(region.Id));
            Assert.Equal(region, CodexRegions.FindByName(region.Name.ToUpperInvariant()));
        }
    }

    [Fact]
    public void TheGridCellIsTheSizeTheProjectionStates()
    {
        Assert.Equal(4096d / 83, CodexRegionMap.LightYearsPerCell, 9);
    }

    [Fact]
    public void APlaceOutsideTheMappedGridBelongsToNoRegion()
    {
        Assert.Null(CodexRegionMap.FindAt(-1e6, 0));
        Assert.Null(CodexRegionMap.FindAt(0, -1e6));
        Assert.Null(CodexRegionMap.FindAt(1e6, 1e6));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(43)]
    [InlineData(-1)]
    public void ANumberNoRegionCarriesIsAMiss(int id)
    {
        Assert.Null(CodexRegions.Find(id));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no such region")]
    public void ANameNoRegionCarriesIsAMiss(string? name)
    {
        Assert.Null(CodexRegions.FindByName(name));
    }

    [Fact]
    public void AnAbsentPlaceIsNamedRatherThanLeftToFail()
    {
        Assert.Throws<ArgumentNullException>(
            () => CodexRegionMap.FindAt((GalacticPlanePosition)null!));
        Assert.Throws<ArgumentNullException>(
            () => CodexRegionMap.FindAt((GalacticPosition)null!));
    }

    /// <summary>Numbers the cases of one fixture list.</summary>
    private static TheoryData<int> Indices(int count)
    {
        TheoryData<int> data = [];
        for (int index = 0; index < count; index++) data.Add(index);
        return data;
    }
}
