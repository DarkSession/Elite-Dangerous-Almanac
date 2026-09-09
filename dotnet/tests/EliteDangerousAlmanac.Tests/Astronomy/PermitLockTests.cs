using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>Which systems and regions ask a commander for a permit.</summary>
public sealed class PermitLockTests
{
    private static readonly PermitLocksFixture Fixture =
        SharedFixtures.Load<PermitLocksFixture>("fixtures/astro/permit-locks.jsonc");

    public static TheoryData<int> Cases
    {
        get
        {
            TheoryData<int> data = [];
            for (int index = 0; index < Fixture.Cases.Count; index++) data.Add(index);
            return data;
        }
    }

    [Fact]
    public void TheListHoldsTheLocksItWasAcquiredWith()
    {
        Assert.Equal(Fixture.Counts.Systems, PermitLocks.LockedSystems.Count);
        Assert.Equal(Fixture.Counts.Regions, PermitLocks.LockedRegions.Count);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void EachSystemNameAsksForThePermitTheFixtureStates(int index)
    {
        PermitLockCaseFixture expected = Fixture.Cases[index];

        PermitLock? found = PermitLocks.ForSystemName(expected.Name);

        if (expected.Lock is null)
        {
            Assert.Null(found);
            Assert.False(PermitLocks.IsLocked(expected.Name));
            return;
        }

        Assert.NotNull(found);
        Assert.True(PermitLocks.IsLocked(expected.Name));
        Assert.Equal(expected.Lock.Name, found!.Name);
        Assert.Equal(
            expected.Lock.Kind,
            found.Kind.ToString().ToLowerInvariant());

        if (expected.Lock.Id64 is null)
        {
            Assert.Null(found.Id64);
            return;
        }

        Assert.Equal(SystemAddress.Parse(expected.Lock.Id64), found.Id64);
        Assert.Equal(expected.Lock.Name, PermitLocks.FindSystemByAddress(found.Id64!.Value)!.Name);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void ALockedRegionIsFoundFromAPositionAsWellAsFromAName(int index)
    {
        PermitLockCaseFixture expected = Fixture.Cases[index];
        if (expected.Coords is null || expected.Lock?.Kind != "region") return;

        HandAuthoredRegion? region = HandAuthoredRegions.FindAt(
            new GalacticPosition(expected.Coords.X, expected.Coords.Y, expected.Coords.Z));

        Assert.NotNull(region);
        Assert.True(PermitLocks.IsLockedRegionName(region!.Name));
    }

    [Fact]
    public void ASystemOfItsOwnIsReadBeforeItsRegion()
    {
        // The list is read in that order, so a name on both halves reports itself.
        PermitLock? found = PermitLocks.ForSystemName("  shinrarta dezhra ");

        Assert.NotNull(found);
        Assert.Equal(PermitLockKind.System, found!.Kind);
        Assert.Equal("Shinrarta Dezhra", found.Name);
        Assert.NotNull(found.Id64);
    }

    [Fact]
    public void ARegionNameOpensTheNamesOfTheSystemsInsideIt()
    {
        Assert.Equal("Col 70 Sector", PermitLocks.RegionForSystemName("Col 70 Sector AA-D b17-0"));
        Assert.Equal("Col 70 Sector", PermitLocks.RegionForSystemName("  col 70 sector  "));

        // The opening has to be the whole of a word, and not the start of a longer one.
        Assert.Null(PermitLocks.RegionForSystemName("Col 70 Sectors AA-D b17-0"));
        Assert.Null(PermitLocks.RegionForSystemName("Col 285 Sector IX-T d3-31"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Colonia")]
    public void ANameNoLockCarriesIsAMiss(string? name)
    {
        Assert.Null(PermitLocks.ForSystemName(name));
        Assert.Null(PermitLocks.FindSystemByName(name));
        Assert.Null(PermitLocks.RegionForSystemName(name));
        Assert.False(PermitLocks.IsLockedRegionName(name));
        Assert.False(PermitLocks.IsLocked(name));
    }

    [Fact]
    public void AnAddressNoLockedSystemCarriesIsAMiss()
    {
        Assert.Null(PermitLocks.FindSystemByAddress(1));
    }

    [Fact]
    public void ARegionIsToldApartFromASystemInsideIt()
    {
        Assert.True(PermitLocks.IsLockedRegionName("  bleia1 "));
        Assert.False(PermitLocks.IsLockedRegionName("Bleia1 DL-Y f26"));
    }
}
