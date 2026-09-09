using EliteDangerousAlmanac.Astronomy;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>Where the game's naming regions start.</summary>
public sealed class NamingRegionOriginTests
{
    [Fact]
    public void EveryCataloguedRegionCarriesAStartAndAnExtent()
    {
        Assert.NotEmpty(NamingRegionOrigins.HandAuthored);
        foreach (NamingRegionOrigin region in NamingRegionOrigins.HandAuthored)
        {
            Assert.False(string.IsNullOrWhiteSpace(region.Name));
            Assert.True(region.X >= 0 && region.Y >= 0 && region.Z >= 0);
            Assert.True(region.SizeX > 0 && region.SizeY > 0 && region.SizeZ > 0);
        }
    }

    [Fact]
    public void ARegionTheGameNamesByHandIsFoundInAnyCasing()
    {
        NamingRegionOrigin? region = NamingRegionOrigins.FindHandAuthored("  PLEIADES SECTOR ");

        Assert.NotNull(region);
        Assert.Equal("Pleiades Sector", region!.Name);
        Assert.Same(region, NamingRegionOrigins.Resolve("pleiades sector"));
    }

    [Fact]
    public void AProceduralSectorStartsWhereItsGridPositionPutsIt()
    {
        SectorGridPosition position = SectorName.ToGridPosition("Blae Eock")!;

        NamingRegionOrigin region = NamingRegionOrigins.Resolve("blae eock")!;

        Assert.Equal("Blae Eock", region.Name);
        Assert.Equal(
            (double)position.SectorX * SystemAddress.SectorInternalSize, region.X);
        Assert.Equal(
            (double)position.SectorY * SystemAddress.SectorInternalSize, region.Y);
        Assert.Equal(
            (double)position.SectorZ * SystemAddress.SectorInternalSize, region.Z);
        Assert.Equal(SystemAddress.SectorInternalSize, region.SizeX);
        Assert.Equal(SystemAddress.SectorInternalSize, region.SizeY);
        Assert.Equal(SystemAddress.SectorInternalSize, region.SizeZ);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a region")]
    public void ANameNeitherCataloguedNorProceduralIsAMiss(string? name)
    {
        Assert.Null(NamingRegionOrigins.FindHandAuthored(name));
        Assert.Null(NamingRegionOrigins.Resolve(name));
    }
}
