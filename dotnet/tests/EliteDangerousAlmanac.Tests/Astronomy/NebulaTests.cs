using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The nebula catalogues, and the searches that read them.</summary>
public sealed class NebulaTests
{
    private static readonly NebulaeFixture Fixture =
        SharedFixtures.Load<NebulaeFixture>("fixtures/astro/nebulae.jsonc");

    public static TheoryData<string> Catalogues => ["real", "planetary", "procgen"];

    public static TheoryData<int> RecordCases => Indices(Fixture.Records.Count);

    public static TheoryData<int> NearestCases => Indices(Fixture.Nearest.Count);

    public static TheoryData<int> WithinCases => Indices(Fixture.Within.Count);

    [Theory]
    [MemberData(nameof(Catalogues))]
    public void EachCatalogueHoldsTheRecordsItWasAcquiredWith(string catalogue)
    {
        IReadOnlyList<Nebula> nebulae = Catalogue(catalogue);

        StringBuilder names = new();
        foreach (Nebula nebula in nebulae) names.Append(nebula.Name).Append('\n');
        byte[] digest = SHA256.HashData(Encoding.UTF8.GetBytes(names.ToString()));

        Assert.Equal(Fixture.Counts[catalogue], nebulae.Count);
        Assert.Equal(
            Fixture.MembershipSha256[catalogue],
            Convert.ToHexString(digest).ToLowerInvariant());
    }

    [Fact]
    public void TheWholeCatalogueIsTheThreeClassesOneAfterTheOther()
    {
        Assert.Equal(Fixture.Counts["all"], NebulaCatalogue.All.Count);
        Assert.Equal(
            NebulaCatalogue.Real.Count
                + NebulaCatalogue.Planetary.Count
                + NebulaCatalogue.Procgen.Count,
            NebulaCatalogue.All.Count);
        Assert.Equal(NebulaCatalogue.Real[0], NebulaCatalogue.All[0]);
        Assert.Equal(
            NebulaCatalogue.Procgen[NebulaCatalogue.Procgen.Count - 1],
            NebulaCatalogue.All[NebulaCatalogue.All.Count - 1]);
    }

    [Theory]
    [MemberData(nameof(RecordCases))]
    public void EachPinnedNebulaSitsWhereTheFixtureStates(int index)
    {
        NebulaRecordFixture expected = Fixture.Records[index];

        Nebula? nebula = NebulaCatalogue.FindByName(expected.Name, Catalogue(expected.Catalogue));

        Assert.NotNull(nebula);
        Assert.Equal(expected.System, nebula!.System);
        Assert.Equal(expected.X, nebula.X);
        Assert.Equal(expected.Y, nebula.Y);
        Assert.Equal(expected.Z, nebula.Z);
        Assert.Equal(expected.Type, nebula.Type.ToString().ToLowerInvariant());
        Assert.Equal(expected.RegionId, nebula.RegionId);
    }

    [Theory]
    [MemberData(nameof(RecordCases))]
    public void EachPinnedNebulaAgreesWithTheRegionLookup(int index)
    {
        NebulaRecordFixture expected = Fixture.Records[index];

        CodexRegion? region = CodexRegionMap.FindAt(expected.X, expected.Z);

        Assert.NotNull(region);
        Assert.Equal(expected.RegionId, region!.Id);
    }

    [Theory]
    [MemberData(nameof(NearestCases))]
    public void TheNearestNebulaeComeBackNearestFirst(int index)
    {
        NearestCaseFixture expected = Fixture.Nearest[index];

        IReadOnlyList<NebulaNearby> found = NebulaCatalogue.Nearest(
            Position(expected.From), Catalogue(expected.Catalogue), expected.Count);

        AssertSame(expected.Expect, found, expected.Origin);
    }

    [Theory]
    [MemberData(nameof(WithinCases))]
    public void TheNebulaeWithinADistanceComeBackNearestFirst(int index)
    {
        WithinCaseFixture expected = Fixture.Within[index];

        IReadOnlyList<NebulaNearby> found = NebulaCatalogue.Within(
            Position(expected.From), Catalogue(expected.Catalogue), expected.RadiusLy);

        AssertSame(expected.Expect, found, expected.Origin);
    }

    [Fact]
    public void ACountOfNoneOrLessAsksForNothing()
    {
        GalacticPosition sol = new(0, 0, 0);

        Assert.Empty(NebulaCatalogue.Nearest(sol, NebulaCatalogue.Real, 0));
        Assert.Empty(NebulaCatalogue.Nearest(sol, NebulaCatalogue.Real, -1));
        Assert.Empty(NebulaCatalogue.Within(sol, NebulaCatalogue.Real, -1));
    }

    [Fact]
    public void ACountPastTheCatalogueAsksForTheWholeOfIt()
    {
        GalacticPosition sol = new(0, 0, 0);

        IReadOnlyList<NebulaNearby> found =
            NebulaCatalogue.Nearest(sol, NebulaCatalogue.Real, NebulaCatalogue.Real.Count + 10);

        Assert.Equal(NebulaCatalogue.Real.Count, found.Count);
        for (int index = 1; index < found.Count; index++)
        {
            Assert.True(found[index - 1].DistanceLy <= found[index].DistanceLy);
        }
    }

    [Fact]
    public void ANameNoCatalogueCarriesIsAMiss()
    {
        Assert.Null(NebulaCatalogue.FindByName("no such nebula", NebulaCatalogue.Real));
        Assert.Null(NebulaCatalogue.FindByName(null, NebulaCatalogue.Real));

        // Only the catalogue handed over is read.
        Assert.Null(NebulaCatalogue.FindByName("Horsehead Nebula", NebulaCatalogue.Procgen));
        Assert.NotNull(NebulaCatalogue.FindByName("  horsehead nebula ", NebulaCatalogue.Real));
    }

    [Fact]
    public void AnAbsentArgumentIsNamedRatherThanLeftToFail()
    {
        GalacticPosition sol = new(0, 0, 0);

        Assert.Throws<ArgumentNullException>(
            () => NebulaCatalogue.Nearest(null!, NebulaCatalogue.Real));
        Assert.Throws<ArgumentNullException>(() => NebulaCatalogue.Nearest(sol, null!));
        Assert.Throws<ArgumentNullException>(
            () => NebulaCatalogue.Within(null!, NebulaCatalogue.Real, 100));
        Assert.Throws<ArgumentNullException>(() => NebulaCatalogue.Within(sol, null!, 100));
        Assert.Throws<ArgumentNullException>(() => NebulaCatalogue.FindByName("Pleiades", null!));
    }

    /// <summary>Reads the catalogue one fixture case names.</summary>
    private static IReadOnlyList<Nebula> Catalogue(string name) => name switch
    {
        "real" => NebulaCatalogue.Real,
        "planetary" => NebulaCatalogue.Planetary,
        "procgen" => NebulaCatalogue.Procgen,
        "all" => NebulaCatalogue.All,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, "No such catalogue."),
    };

    /// <summary>Reads one fixture place as a galactic position.</summary>
    private static GalacticPosition Position(CoordsFixture coords) =>
        new(coords.X, coords.Y, coords.Z);

    /// <summary>Compares an answer against the one a fixture case states.</summary>
    /// <remarks>The fixture rounds a distance to six places, so it is compared as near enough.</remarks>
    private static void AssertSame(
        List<NearbyNebulaFixture> expected, IReadOnlyList<NebulaNearby> found, string origin)
    {
        Assert.Equal(expected.Count, found.Count);
        for (int index = 0; index < expected.Count; index++)
        {
            string what = string.Format(
                CultureInfo.InvariantCulture, "{0}, entry {1}", origin, index);
            Assert.Equal(expected[index].Name, found[index].Name);
            if (expected[index].System is not null)
            {
                Assert.Equal(expected[index].System, found[index].System);
            }

            Assert.True(
                Math.Abs(expected[index].DistanceLy - found[index].DistanceLy) <= 5e-6, what);
        }
    }

    /// <summary>Numbers the cases of one fixture list.</summary>
    private static TheoryData<int> Indices(int count)
    {
        TheoryData<int> data = [];
        for (int index = 0; index < count; index++) data.Add(index);
        return data;
    }
}
