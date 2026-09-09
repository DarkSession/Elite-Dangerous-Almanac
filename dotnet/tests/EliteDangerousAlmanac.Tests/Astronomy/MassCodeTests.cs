using System;
using EliteDangerousAlmanac.Astronomy;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The letter that states how large a boxel is.</summary>
public sealed class MassCodeTests
{
    [Theory]
    [InlineData("a", 0, 10)]
    [InlineData("d", 3, 80)]
    [InlineData("D", 3, 80)]
    [InlineData("h", 7, 1280)]
    public void AMassCodeStatesASizeClassAndABoxelEdge(string code, int sizeClass, int edge)
    {
        Assert.Equal(sizeClass, MassCode.ToSizeClass(code));
        Assert.Equal(sizeClass, MassCode.ToSizeClass(code[0]));
        Assert.Equal(char.ToLowerInvariant(code[0]), MassCode.FromSizeClass(sizeClass));
        Assert.Equal(edge, MassCode.BoxelEdgeLy(sizeClass));
    }

    [Fact]
    public void TheLargestBoxelIsAWholeSector()
    {
        Assert.Equal(GalaxyGrid.SectorEdgeLy, MassCode.BoxelEdgeLy(MassCode.Count - 1));
        Assert.Equal(MassCode.BaseBoxelLy, MassCode.BoxelEdgeLy(0));
    }

    [Theory]
    [InlineData("i")]
    [InlineData("A1")]
    [InlineData("")]
    [InlineData("1")]
    public void ALetterNoMassCodeUsesIsRefused(string code)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => MassCode.ToSizeClass(code));
    }

    [Fact]
    public void AnAbsentMassCodeIsNamedRatherThanLeftToFail()
    {
        Assert.Throws<ArgumentNullException>(() => MassCode.ToSizeClass(null!));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(8)]
    public void ASizeClassOutsideTheRangeIsRefused(int sizeClass)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => MassCode.FromSizeClass(sizeClass));
        Assert.Throws<ArgumentOutOfRangeException>(() => MassCode.BoxelEdgeLy(sizeClass));
    }
}
