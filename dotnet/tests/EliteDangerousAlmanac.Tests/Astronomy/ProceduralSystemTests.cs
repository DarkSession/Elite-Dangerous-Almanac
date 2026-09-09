using System;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>One system the generator named, read from its name or its address.</summary>
public sealed class ProceduralSystemTests
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
    public void ANameAndAnAddressDescribeTheSameSystem(int index)
    {
        SystemAddressCaseFixture expected = Fixture.Systems[index];
        ulong address = SystemAddress.Parse(expected.Id64);

        ProceduralSystem named = ProceduralSystem.FromName(expected.Name)!;

        Assert.Equal(expected.Name, named.Name);
        Assert.Equal(expected.Region, named.NamingRegionName);
        Assert.Equal(expected.MassCode[0], named.MassCode);
        Assert.Equal(expected.N2, named.Sequence);
        Assert.Equal(address, named.SystemAddress);
        Assert.NotNull(named.ModulatedSystemAddress);
        Assert.Equal(
            named.SystemAddress,
            ProceduralSystem.FromModulatedSystemAddress(
                named.ModulatedSystemAddress!.Value).SystemAddress);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void AProceduralSectorRoundTripsThroughItsAddress(int index)
    {
        SystemAddressCaseFixture expected = Fixture.Systems[index];
        if (NamingRegionOrigins.FindHandAuthored(expected.Region) is not null) return;

        ProceduralSystem named =
            ProceduralSystem.FromSystemAddress(SystemAddress.Parse(expected.Id64));

        Assert.Equal(expected.Name, named.Name);
        Assert.False(named.UsesHandAuthoredRegion);
        Assert.False(named.RequiresRegionPermit);
    }

    [Fact]
    public void ANameIsReadInAnyCasingAndWrittenBackInTheGamesOwn()
    {
        ProceduralSystem named = ProceduralSystem.FromName("  blae eock kc-c d0 ")!;

        Assert.Equal("Blae Eock KC-C d0", named.Name);
        Assert.Equal("Blae Eock", named.NamingRegionName);
        Assert.Equal('d', named.MassCode);
        Assert.Equal(0, named.Sequence);
        Assert.Equal(new SystemNameParts("Blae Eock", 10, 2, 2, 3, 0, 0), named.Parts);
    }

    [Fact]
    public void ARegionTheGameNamesByHandIsRecasedAndItsPermitRead()
    {
        ProceduralSystem named = ProceduralSystem.FromName("bleia1 dl-y f26")!;

        Assert.Equal("Bleia1 DL-Y f26", named.Name);
        Assert.True(named.UsesHandAuthoredRegion);
        Assert.True(named.RequiresRegionPermit);
    }

    [Fact]
    public void ASystemTheGameNamedOutrightIsNotOneOfThese()
    {
        Assert.Null(ProceduralSystem.FromName("Sol"));
        Assert.Null(ProceduralSystem.FromName("Shinrarta Dezhra"));
        Assert.Null(ProceduralSystem.FromName(""));
    }

    [Fact]
    public void ANameNoRegionAnswersToIsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => ProceduralSystem.FromName("qqqq AA-A a0"));
    }

    [Fact]
    public void AnAbsentNameIsNamedRatherThanLeftToFail()
    {
        Assert.Throws<ArgumentNullException>(() => ProceduralSystem.FromName(null!));
    }

    [Fact]
    public void AnAddressWhoseGridPositionHasNoNameIsRefused()
    {
        // Sector 1/0/84 is one the generator leaves unnamed.
        ulong address = SystemAddress.Encode(
            new SystemNameParts("Blae Eock", 0, 0, 0, 7, 0, 0),
            new NamingRegionOrigin(
                "Made up",
                (double)1 * SystemAddress.SectorInternalSize,
                0,
                (double)84 * SystemAddress.SectorInternalSize,
                SystemAddress.SectorInternalSize,
                SystemAddress.SectorInternalSize,
                SystemAddress.SectorInternalSize));

        Assert.Throws<ArgumentOutOfRangeException>(
            () => ProceduralSystem.FromSystemAddress(address));
    }

    [Fact]
    public void ASequenceTooLargeForTheModulatedLayoutHasNoFormInIt()
    {
        ProceduralSystem named = ProceduralSystem.FromName("Blae Eock AA-A h40000")!;

        Assert.Equal(40000, named.Sequence);
        Assert.Null(named.ModulatedSystemAddress);
    }

    [Fact]
    public void APositionInOpenSpaceLeavesTheProceduralName()
    {
        ProceduralSystem named = ProceduralSystem.FromSystemAddress(
            10577693187UL, new GalacticPosition(0, 0, 0));

        Assert.Equal("Blae Eock KC-C d0", named.Name);
        Assert.False(named.UsesHandAuthoredRegion);
    }
}
