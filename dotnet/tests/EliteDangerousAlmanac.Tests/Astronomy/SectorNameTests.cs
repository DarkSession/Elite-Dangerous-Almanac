using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Astronomy;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The names the game gives the sectors it does not name by hand.</summary>
public sealed class SectorNameTests
{
    public static TheoryData<int, int, int, string> KnownSectors => new()
    {
        { 39, 31, 18, "Synuefe" },
        { 68, 10, 80, "Aoe Thoe" },
        { 126, 44, 94, "Thodgoa" },
    };

    [Theory]
    [MemberData(nameof(KnownSectors))]
    public void AGridPositionNamesTheSectorTheGameNamesIt(int x, int y, int z, string expected)
    {
        Assert.Equal(expected, SectorName.FromGridPosition(new SectorGridPosition(x, y, z)));
    }

    [Theory]
    [MemberData(nameof(KnownSectors))]
    public void ASectorNameReadsBackToTheGridPositionItCameFrom(
        int x, int y, int z, string name)
    {
        Assert.Equal(new SectorGridPosition(x, y, z), SectorName.ToGridPosition(name));
    }

    [Fact]
    public void EveryNamedSectorOfASweepReadsBackToItsOwnPlace()
    {
        int named = 0;
        for (int z = 0; z < 128; z += 11)
        {
            for (int y = 0; y < 64; y += 7)
            {
                for (int x = 0; x < 128; x += 13)
                {
                    SectorGridPosition position = new(x, y, z);
                    string name;
                    try
                    {
                        name = SectorName.FromGridPosition(position);
                    }
                    catch (ArgumentOutOfRangeException)
                    {
                        // The generator leaves some places of the grid unnamed.
                        continue;
                    }

                    named++;
                    Assert.Equal(position, SectorName.ToGridPosition(name));
                    Assert.Equal(name, SectorName.Canonicalize(name.ToUpperInvariant()));
                }
            }
        }

        Assert.True(named > 500, "the sweep reached too few named sectors to prove anything");
    }

    [Fact]
    public void BothNamingSchemesAreReachedBySweepingTheGrid()
    {
        HashSet<int> words = [];
        for (int x = 0; x < 64; x++)
        {
            try
            {
                words.Add(SectorName.FromGridPosition(new SectorGridPosition(x, 0, 0)).Split(' ').Length);
            }
            catch (ArgumentOutOfRangeException)
            {
                // An unnamed place of the grid states no scheme either.
            }
        }

        Assert.Contains(1, words);
        Assert.Contains(2, words);
    }

    [Fact]
    public void AGridPositionWithNoNameIsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SectorName.FromGridPosition(new SectorGridPosition(1, 0, 84)));
    }

    [Theory]
    [InlineData(-1, 0, 0)]
    [InlineData(128, 0, 0)]
    [InlineData(0, 0, 9999)]
    [InlineData(0, 128, 0)]
    public void AGridPositionOutsideTheGridIsRefused(int x, int y, int z)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SectorName.FromGridPosition(new SectorGridPosition(x, y, z)));
    }

    [Fact]
    public void AnAbsentGridPositionIsNamedRatherThanLeftToFail()
    {
        Assert.Throws<ArgumentNullException>(() => SectorName.FromGridPosition(null!));
    }

    [Theory]
    [InlineData("blae eock", "Blae Eock")]
    [InlineData("  SYNUEFE  ", "Synuefe")]
    [InlineData("Blae   Eock", "Blae Eock")]
    public void ASectorNameIsWrittenInTheGamesOwnCasing(string written, string expected)
    {
        Assert.Equal(expected, SectorName.Canonicalize(written));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Sol")]
    [InlineData("Pleiades Sector")]
    [InlineData("zzzzzzzzzzzz")]
    public void ANameNoProceduralSectorCarriesIsAMiss(string? name)
    {
        Assert.Null(SectorName.ToGridPosition(name));
        Assert.Null(SectorName.Canonicalize(name));
    }
}
