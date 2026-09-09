using System;
using EliteDangerousAlmanac.Astronomy;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The written form of a procedural system name.</summary>
public sealed class SystemNameTests
{
    [Fact]
    public void ANameReadsIntoItsParts()
    {
        SystemNameParts parts = SystemName.Parse("Synuefe EN-H d11-96")!;

        Assert.Equal("Synuefe", parts.RegionName);
        Assert.Equal(4, parts.L1);
        Assert.Equal(13, parts.L2);
        Assert.Equal(7, parts.L3);
        Assert.Equal(3, parts.SizeClass);
        Assert.Equal(11, parts.N1);
        Assert.Equal(96, parts.N2);
    }

    [Fact]
    public void ARegionThatCarriesDigitsOfItsOwnStaysWhole()
    {
        SystemNameParts parts = SystemName.Parse("Col 285 Sector IB-X b30-0")!;

        Assert.Equal("Col 285 Sector", parts.RegionName);
        Assert.Equal(30, parts.N1);
        Assert.Equal(0, parts.N2);
    }

    [Fact]
    public void AFirstIndexOfZeroIsLeftOutOfTheWrittenName()
    {
        SystemNameParts parts = SystemName.Parse("Blae Eock KC-C d0")!;

        Assert.Equal(0, parts.N1);
        Assert.Equal(0, parts.N2);
        Assert.Equal("Blae Eock KC-C d0", SystemName.Format(parts));
    }

    [Fact]
    public void ANameReadInLowerCaseWritesItsFieldsBackInTheGamesCasing()
    {
        SystemNameParts parts = SystemName.Parse("  synuefe en-h d11-96  ")!;

        // The region is held as written, so only the fields held as counts are re-cased.
        Assert.Equal("synuefe EN-H d11-96", SystemName.Format(parts));
        Assert.Equal("Synuefe EN-H d11-96", SystemName.Canonicalize("  synuefe en-h d11-96  "));
    }

    [Fact]
    public void ARegionTheGameNamesByHandIsRecasedFromTheCatalogue()
    {
        Assert.Equal(
            "Pleiades Sector HR-W d1-79",
            SystemName.Canonicalize("pleiades sector hr-w d1-79"));
    }

    [Fact]
    public void ARegionNoCatalogueAndNoGridCarriesIsLeftAsWritten()
    {
        Assert.Equal("qqqq AA-A a0", SystemName.Canonicalize("qqqq aa-a a0"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Sol")]
    [InlineData("Blae Eock KC-C d")]
    [InlineData("Blae Eock KC-C i0")]
    [InlineData("Blae Eock KCC d0")]
    [InlineData("Blae Eock K1-C d0")]
    [InlineData("Blae Eock KC-1 d0")]
    [InlineData("Blae Eock KC-Cd0")]
    [InlineData("BlaeEockKC-C d0")]
    [InlineData("Blae Eock KC-C d-0")]
    [InlineData("Th aa-a a")]
    public void ANameTheGrammarDoesNotAcceptIsAMiss(string? name)
    {
        Assert.Null(SystemName.Parse(name));
        Assert.Null(SystemName.Canonicalize(name));
        Assert.False(SystemName.IsProcedural(name));
    }

    [Fact]
    public void TheShortestNameTheGrammarAcceptsIsRead()
    {
        Assert.NotNull(SystemName.Parse("Th aa-a a0"));
        Assert.Null(SystemName.Parse("T aa-a a0"));
    }

    [Fact]
    public void AProceduralNameIsToldApartFromASystemTheGameNamesOutright()
    {
        Assert.True(SystemName.IsProcedural("Blae Eock KC-C d0"));
        Assert.True(SystemName.IsProcedural("  Blae Eock KC-C d0  "));
        Assert.True(SystemName.IsProcedural("Pleiades Sector HR-W d1-79"));
        Assert.False(SystemName.IsProcedural("Sol"));
    }

    [Fact]
    public void ARegionTheGameNamesByHandIsNotAProceduralSector()
    {
        Assert.True(
            SystemName.IsProcedural("Blae Eock KC-C d0", requireProceduralRegion: true));
        Assert.False(
            SystemName.IsProcedural("Pleiades Sector HR-W d1-79", requireProceduralRegion: true));
    }

    [Fact]
    public void ABoxelCodePacksAndUnpacksTheSameFourFields()
    {
        int code = SystemName.ToBoxelCode(4, 13, 7, 11);

        Assert.Equal(new BoxelLetters(4, 13, 7, 11), SystemName.ToBoxelLetters(code));
    }

    [Theory]
    [InlineData(-1, 0, 0, 0)]
    [InlineData(26, 0, 0, 0)]
    [InlineData(0, -1, 0, 0)]
    [InlineData(0, 0, 26, 0)]
    [InlineData(0, 0, 0, -1)]
    public void ABoxelFieldOutsideItsRangeIsRefused(int l1, int l2, int l3, int n1)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemName.ToBoxelCode(l1, l2, l3, n1));
    }

    [Fact]
    public void ABoxelCodeNoNameCouldPackIsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => SystemName.ToBoxelLetters(-1));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemName.ToBoxelLetters(int.MaxValue));
    }

    [Fact]
    public void PartsThatStateNoLetterAreRefusedWhenWritten()
    {
        SystemNameParts parts = SystemName.Parse("Blae Eock KC-C d0")!;

        Assert.Throws<ArgumentNullException>(() => SystemName.Format(null!));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemName.Format(parts with { L1 = 26 }));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemName.Format(parts with { SizeClass = 8 }));
    }
}
