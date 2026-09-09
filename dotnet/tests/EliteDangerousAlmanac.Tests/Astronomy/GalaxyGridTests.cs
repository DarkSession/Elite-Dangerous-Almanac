using System;
using EliteDangerousAlmanac.Astronomy;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The step from a galactic position to the naming grid.</summary>
public sealed class GalaxyGridTests
{
    [Fact]
    public void TheSectorEdgeIsTheInternalSectorSizeInLightYears()
    {
        Assert.Equal(
            GalaxyGrid.SectorEdgeLy,
            SystemAddress.SectorInternalSize / SystemAddress.UnitsPerLightYear);
    }

    [Fact]
    public void AKnownPositionFallsInTheSectorThatNamesIt()
    {
        // Synuefe EN-H d11-96 sits at (751, -179, -91) by EDSM.
        GalacticPosition position = new(751, -179, -91);

        Assert.Equal(new SectorGridPosition(39, 31, 18), GalaxyGrid.ToSectorGridPosition(position));
        Assert.Equal("Synuefe", GalaxyGrid.ToSectorName(position));
    }

    [Fact]
    public void TheGalaxyCornerIsTheFirstSector()
    {
        Assert.Equal(
            new SectorGridPosition(0, 0, 0),
            GalaxyGrid.ToSectorGridPosition(GalaxyGrid.Origin));
    }

    [Fact]
    public void AnAddressAndAPositionAgreeOnTheSectorTheyName()
    {
        DecodedSystemAddress decoded = SystemAddress.Decode(10577693187UL);
        SectorGridPosition sector = decoded.SectorGridPosition;

        // The corner of the sector, one light year in, sits inside that same sector.
        GalacticPosition corner = new(
            (double)(sector.SectorX * GalaxyGrid.SectorEdgeLy) + GalaxyGrid.Origin.X + 1,
            (double)(sector.SectorY * GalaxyGrid.SectorEdgeLy) + GalaxyGrid.Origin.Y + 1,
            (double)(sector.SectorZ * GalaxyGrid.SectorEdgeLy) + GalaxyGrid.Origin.Z + 1);

        Assert.Equal(sector, GalaxyGrid.ToSectorGridPosition(corner));
        Assert.Equal("Blae Eock", GalaxyGrid.ToSectorName(corner));
    }

    [Theory]
    [InlineData(-1e6, 0, 0)]
    [InlineData(0, 0, 1e6)]
    [InlineData(double.NaN, 0, 0)]
    public void APositionOutsideTheGridIsRefused(double x, double y, double z)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => GalaxyGrid.ToSectorGridPosition(new GalacticPosition(x, y, z)));
    }

    [Fact]
    public void AnAbsentPositionIsNamedRatherThanLeftToFail()
    {
        Assert.Throws<ArgumentNullException>(() => GalaxyGrid.ToSectorGridPosition(null!));
        Assert.Throws<ArgumentNullException>(() => GalaxyGrid.ToSectorName(null!));
    }
}
