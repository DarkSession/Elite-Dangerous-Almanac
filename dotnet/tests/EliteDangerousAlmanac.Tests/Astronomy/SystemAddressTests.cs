using System;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The address a system name writes, and the name an address writes back.</summary>
/// <remarks>
/// Every case in the fixture is a pair the EDTS reference states, one for each mass code
/// plus two systems inside regions the game names by hand. They hold the bit layout in
/// place, and not merely the agreement of the two directions with each other.
/// </remarks>
public sealed class SystemAddressTests
{
    private static readonly SystemAddressesFixture Fixture =
        SharedFixtures.Load<SystemAddressesFixture>("fixtures/astro/system-addresses.jsonc");

    public static TheoryData<int> Cases
    {
        get
        {
            TheoryData<int> data = [];
            for (int index = 0; index < Fixture.Systems.Count; index++) data.Add(index);
            return data;
        }
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void ASystemNameReadsIntoTheFieldsTheFixtureStates(int index)
    {
        SystemAddressCaseFixture expected = Fixture.Systems[index];

        SystemNameParts? parts = SystemName.Parse(expected.Name);

        Assert.NotNull(parts);
        Assert.Equal(expected.Region, parts!.RegionName);
        Assert.Equal(Letter(expected.L1), parts.L1);
        Assert.Equal(Letter(expected.L2), parts.L2);
        Assert.Equal(Letter(expected.L3), parts.L3);
        Assert.Equal(MassCode.ToSizeClass(expected.MassCode), parts.SizeClass);
        Assert.Equal(expected.N1, parts.N1);
        Assert.Equal(expected.N2, parts.N2);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void ASystemNameWritesTheAddressTheFixtureStates(int index)
    {
        SystemAddressCaseFixture expected = Fixture.Systems[index];
        SystemNameParts parts = SystemName.Parse(expected.Name)!;
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve(parts.RegionName)!;

        ulong address = SystemAddress.Encode(parts, origin);

        Assert.Equal(SystemAddress.Parse(expected.Id64), address);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void AnAddressReadsBackIntoTheNameThatWroteIt(int index)
    {
        SystemAddressCaseFixture expected = Fixture.Systems[index];
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve(expected.Region)!;

        DecodedSystemAddress decoded = SystemAddress.Decode(SystemAddress.Parse(expected.Id64));
        int boxelCode = SystemAddress.ToBoxelCode(
            decoded.SizeClass, decoded.AbsoluteBoxel, origin)!.Value;
        BoxelLetters letters = SystemName.ToBoxelLetters(boxelCode);

        Assert.Equal(MassCode.ToSizeClass(expected.MassCode), decoded.SizeClass);
        Assert.Equal(expected.N2, decoded.Sequence);
        Assert.Equal(Letter(expected.L1), letters.L1);
        Assert.Equal(Letter(expected.L2), letters.L2);
        Assert.Equal(Letter(expected.L3), letters.L3);
        Assert.Equal(expected.N1, letters.N1);
        Assert.Equal(
            expected.Name,
            SystemName.Format(new SystemNameParts(
                origin.Name,
                letters.L1,
                letters.L2,
                letters.L3,
                decoded.SizeClass,
                letters.N1,
                decoded.Sequence)));
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void TheModulatedLayoutCarriesTheSameSystem(int index)
    {
        SystemAddressCaseFixture expected = Fixture.Systems[index];
        SystemNameParts parts = SystemName.Parse(expected.Name)!;
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve(parts.RegionName)!;
        DecodedSystemAddress usual = SystemAddress.Decode(SystemAddress.Parse(expected.Id64));

        DecodedSystemAddress modulated =
            SystemAddress.DecodeModulated(SystemAddress.EncodeModulated(parts, origin));

        Assert.Equal(usual.SizeClass, modulated.SizeClass);
        Assert.Equal(usual.Sequence, modulated.Sequence);
        Assert.Equal(usual.AbsoluteBoxel, modulated.AbsoluteBoxel);
        Assert.Equal(usual.SectorGridPosition, modulated.SectorGridPosition);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void AProceduralRegionNamesTheSectorItsAddressLandsIn(int index)
    {
        SystemAddressCaseFixture expected = Fixture.Systems[index];
        if (NamingRegionOrigins.FindHandAuthored(expected.Region) is not null) return;

        DecodedSystemAddress decoded = SystemAddress.Decode(SystemAddress.Parse(expected.Id64));

        Assert.Equal(expected.Region, SectorName.FromGridPosition(decoded.SectorGridPosition));
    }

    [Fact]
    public void TheBoxelEdgeDoublesWithEveryMassCode()
    {
        for (int sizeClass = 0; sizeClass < MassCode.Count; sizeClass++)
        {
            Assert.Equal(
                MassCode.BoxelEdgeLy(sizeClass) * SystemAddress.UnitsPerLightYear,
                SystemAddress.BoxelInternalSize(sizeClass));
        }

        Assert.Equal(SystemAddress.SectorInternalSize, SystemAddress.BoxelInternalSize(7));
        Assert.Equal(2560, SystemAddress.BoxelInternalSize(3));
    }

    [Fact]
    public void ASizeClassOutsideTheLayoutIsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => SystemAddress.BoxelInternalSize(-1));
        Assert.Throws<ArgumentOutOfRangeException>(() => SystemAddress.BoxelInternalSize(8));
    }

    [Fact]
    public void AnAddressReadsFromTheTextAJournalOrAStoreHoldsIt()
    {
        Assert.True(SystemAddress.TryParse(" 10577693187 ", out ulong parsed));
        Assert.Equal(10577693187UL, parsed);
        Assert.False(SystemAddress.TryParse("-1", out _));
        Assert.False(SystemAddress.TryParse("1.5", out _));
        Assert.False(SystemAddress.TryParse(null, out _));
        Assert.False(SystemAddress.TryParse("18446744073709551616", out _));
        Assert.Throws<FormatException>(() => SystemAddress.Parse("not an address"));
        Assert.Throws<ArgumentNullException>(() => SystemAddress.Parse(null!));
    }

    [Fact]
    public void AnOriginBelowTheGalaxyCornerIsRefused()
    {
        NamingRegionOrigin origin = new("Made up", -1, 0, 0, 40960, 40960, 40960);

        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemAddress.ToAbsoluteBoxel(3, 0, origin));
        Assert.Null(SystemAddress.ToBoxelCode(3, new AbsoluteBoxel(0, 0, 0), origin));
    }

    [Fact]
    public void ABoxelOutsideItsRegionCarriesNoCodeInThatRegion()
    {
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve("Blae Eock")!;

        Assert.Null(SystemAddress.ToBoxelCode(3, new AbsoluteBoxel(0, 0, 0), origin));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemAddress.ToAbsoluteBoxel(3, 0x1fffff, origin));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemAddress.ToAbsoluteBoxel(3, -1, origin));
    }

    [Fact]
    public void ASequenceTooLargeForItsSizeClassIsRefused()
    {
        SystemNameParts parts = SystemName.Parse("Blae Eock KC-C d0")!;
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve("Blae Eock")!;

        // A d-class address leaves 20 bits for the sequence, and the modulated layout 15.
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemAddress.Encode(parts with { N2 = 1 << 20 }, origin));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemAddress.EncodeModulated(parts with { N2 = 0x8000 }, origin));
        Assert.Throws<ArgumentNullException>(() => SystemAddress.Encode(null!, origin));
        Assert.Throws<ArgumentNullException>(() => SystemAddress.EncodeModulated(null!, origin));
    }

    [Fact]
    public void ARegionThatSitsTooHighForTheLayoutIsRefused()
    {
        // The layout carries six sector bits for Y, so the top half of the grid has no room.
        NamingRegionOrigin origin = new(
            "Made up",
            0,
            (double)100 * SystemAddress.SectorInternalSize,
            0,
            SystemAddress.SectorInternalSize,
            SystemAddress.SectorInternalSize,
            SystemAddress.SectorInternalSize);

        Assert.Throws<ArgumentOutOfRangeException>(
            () => SystemAddress.ToAbsoluteBoxel(3, 0, origin));
    }

    [Fact]
    public void AnAbsentArgumentIsNamedRatherThanLeftToFail()
    {
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve("Blae Eock")!;

        Assert.Throws<ArgumentNullException>(() => SystemAddress.ToAbsoluteBoxel(3, 0, null!));
        Assert.Throws<ArgumentNullException>(
            () => SystemAddress.ToBoxelCode(3, null!, origin));
        Assert.Throws<ArgumentNullException>(
            () => SystemAddress.ToBoxelCode(3, new AbsoluteBoxel(0, 0, 0), null!));
    }

    /// <summary>Reads one fixture letter as its count from the start of the alphabet.</summary>
    private static int Letter(string value) => char.ToUpperInvariant(value[0]) - 'A';
}
