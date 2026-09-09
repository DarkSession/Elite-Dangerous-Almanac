using System;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The sectors the game names by hand, and the systems inside them.</summary>
public sealed class HandAuthoredRegionTests
{
    private static readonly HandAuthoredRegionsFixture Fixture =
        SharedFixtures.Load<HandAuthoredRegionsFixture>(
            "fixtures/astro/hand-authored-regions.jsonc");

    public static TheoryData<int> SystemCases => Indices(Fixture.Systems.Count);

    public static TheoryData<int> PlaceCases => Indices(Fixture.RegionForCoords.Count);

    [Theory]
    [MemberData(nameof(PlaceCases))]
    public void EachPlaceBelongsToTheRegionTheFixtureStates(int index)
    {
        RegionForCoordsFixture expected = Fixture.RegionForCoords[index];

        HandAuthoredRegion? region = HandAuthoredRegions.FindAt(
            new GalacticPosition(expected.Coords.X, expected.Coords.Y, expected.Coords.Z));

        Assert.Equal(expected.Region, region?.Name);
    }

    [Theory]
    [MemberData(nameof(SystemCases))]
    public void AnAddressAndAPositionNameTheSystemTheWayTheGameDoes(int index)
    {
        HandAuthoredSystemFixture expected = Fixture.Systems[index];
        GalacticPosition position =
            new(expected.Coords.X, expected.Coords.Y, expected.Coords.Z);

        ProceduralSystem named = ProceduralSystem.FromSystemAddress(
            SystemAddress.Parse(expected.Id64), position);

        Assert.Equal(expected.Name, named.Name);
        Assert.True(named.UsesHandAuthoredRegion);
        Assert.Equal(expected.NeedsPermit, named.RequiresRegionPermit);
        Assert.Equal(position, named.Position);
    }

    [Theory]
    [MemberData(nameof(SystemCases))]
    public void AnAddressAloneNamesTheSystemAfterItsSector(int index)
    {
        HandAuthoredSystemFixture expected = Fixture.Systems[index];

        // A case states the procedural name only where it was read from a source that
        // carries one.
        if (expected.ProceduralName is null) return;

        ProceduralSystem named =
            ProceduralSystem.FromSystemAddress(SystemAddress.Parse(expected.Id64));

        Assert.Equal(expected.ProceduralName, named.Name);
        Assert.False(named.UsesHandAuthoredRegion);
        Assert.Null(named.Position);
    }

    [Theory]
    [MemberData(nameof(SystemCases))]
    public void EitherNameOfASystemWritesTheSameAddress(int index)
    {
        HandAuthoredSystemFixture expected = Fixture.Systems[index];
        ulong address = SystemAddress.Parse(expected.Id64);

        Assert.Equal(address, ProceduralSystem.FromName(expected.Name)!.SystemAddress);
        if (expected.ProceduralName is null) return;
        Assert.Equal(address, ProceduralSystem.FromName(expected.ProceduralName)!.SystemAddress);
    }

    [Fact]
    public void TheCatalogueIsHeldSmallestRegionFirst()
    {
        // The game settles an overlap by the smallest region, which the order reproduces.
        Assert.NotEmpty(HandAuthoredRegions.All);
        double previous = 0;
        foreach (HandAuthoredRegion region in HandAuthoredRegions.All)
        {
            Assert.NotEmpty(region.Spheres);
            double smallest = double.MaxValue;
            foreach (HandAuthoredSphere sphere in region.Spheres)
            {
                Assert.True(sphere.Radius > 0);
                smallest = Math.Min(smallest, sphere.Radius);
            }

            Assert.True(smallest >= previous, region.Name);
            previous = smallest;
        }
    }

    [Fact]
    public void ASmallerRegionWinsWhereTwoOverlap()
    {
        // Sol sits inside three of these regions. The catalogue is held smallest first,
        // so the first one that holds a place is the answer, as it is in the game.
        HandAuthoredRegion? region = HandAuthoredRegions.FindAt(new GalacticPosition(0, 0, 0));

        Assert.NotNull(region);
        Assert.Equal("Jastreb Sector", region!.Name);
    }

    [Fact]
    public void AnAbsentPositionIsNamedRatherThanLeftToFail()
    {
        Assert.Throws<ArgumentNullException>(() => HandAuthoredRegions.FindAt(null!));
    }

    /// <summary>Numbers the cases of one fixture list.</summary>
    private static TheoryData<int> Indices(int count)
    {
        TheoryData<int> data = [];
        for (int index = 0; index < count; index++) data.Add(index);
        return data;
    }
}
