using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The fixed-weapon gunsights, and the geometry that places them.</summary>
public class GunsightsTests
{
    private static readonly GunsightsFixture Fixture =
        SharedFixtures.Load<GunsightsFixture>("fixtures/ships/gunsights.jsonc");

    public static TheoryData<string> Hulls()
    {
        TheoryData<string> ships = [];
        foreach (GunsightCaseFixture hull in Fixture.Cases) ships.Add(hull.Ship);
        return ships;
    }

    [Theory]
    [MemberData(nameof(Hulls))]
    public void AHullCarriesTheFixturesOffsetsAndProjectsToItsPoints(string ship)
    {
        GunsightCaseFixture stated = Fixture.Cases.Find(hull => hull.Ship == ship)!;

        IReadOnlyList<GunsightOffset> gunsight = Gunsights.Find(ship)!;
        IReadOnlyList<GunsightPoint> points = Gunsights.Project(gunsight, stated.RangeMetres);

        // A case states the hull's leading hardpoints, and every hardpoint where it names slots.
        Assert.True(gunsight.Count >= stated.Offsets.Count);
        if (stated.Slots.Count > 0) Assert.Equal(stated.Slots.Count, gunsight.Count);
        for (int position = 0; position < stated.Offsets.Count; position++)
        {
            Assert.Equal(stated.Offsets[position][0], gunsight[position].HorizontalMetres);
            Assert.Equal(stated.Offsets[position][1], gunsight[position].VerticalMetres);
            AssertTangent(stated.Points[position][0], points[position].HorizontalTangent);
            AssertTangent(stated.Points[position][1], points[position].VerticalTangent);
        }
    }

    /// <summary>
    /// A tangent is one division away from an exactly stated offset, so it is checked to the last
    /// few bits rather than to the decimal the fixture writes.
    /// </summary>
    private static void AssertTangent(double expected, double actual) =>
        Assert.Equal(expected, actual, (Math.Abs(expected) * 1e-12) + double.Epsilon);

    [Fact]
    public void EveryPlayerFlyableHullCarriesAGunsightForEveryHardpoint()
    {
        int hardpoints = 0;
        foreach (Ship ship in ShipCatalogue.All)
        {
            IReadOnlyList<GunsightOffset> gunsight = Gunsights.Find(ship.Symbol)!;

            Assert.NotNull(gunsight);
            Assert.Equal(ship.Hardpoints.Count, gunsight.Count);
            hardpoints += gunsight.Count;
        }

        Assert.Equal(Fixture.ShipCount, ShipCatalogue.All.Count);
        Assert.Equal(Fixture.ShipCount, Gunsights.All.Count);
        Assert.Equal(Fixture.HardpointCount, hardpoints);
    }

    [Fact]
    public void AHullSymbolResolvesWhateverItsCaseOrSpacing()
    {
        IReadOnlyList<GunsightOffset> plain = Gunsights.Find("SideWinder")!;

        Assert.Same(plain, Gunsights.Find(" sidewinder "));
        Assert.Same(plain, Gunsights.Find("SIDEWINDER"));
    }

    [Fact]
    public void AnUnknownOrAbsentHullIsAMiss()
    {
        Assert.Null(Gunsights.Find("not_a_ship"));
        Assert.Null(Gunsights.Find(null));
        Assert.Null(Gunsights.Find("  "));
    }

    [Fact]
    public void TheOffsetsScaleWithTheRange()
    {
        IReadOnlyList<GunsightOffset> gunsight = Gunsights.Find("SideWinder")!;

        IReadOnlyList<GunsightPoint> near = Gunsights.Project(gunsight, 500);
        IReadOnlyList<GunsightPoint> far = Gunsights.Project(gunsight, 1000);

        Assert.Equal(near[0].HorizontalTangent / 2, far[0].HorizontalTangent);
        Assert.Equal(near[0].VerticalTangent / 2, far[0].VerticalTangent);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void ARangeThatIsNotPhysicalIsRefused(double targetRangeMetres) =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Gunsights.Project(Gunsights.Find("SideWinder")!, targetRangeMetres));

    [Fact]
    public void AMissingGunsightIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => Gunsights.Project(null!, 1000));

    [Fact]
    public void TheCatalogueRefusesMutation()
    {
        Assert.Throws<NotSupportedException>(
            () => ((IDictionary<string, IReadOnlyList<GunsightOffset>>)Gunsights.All).Clear());
        Assert.Throws<NotSupportedException>(
            () => ((IList<GunsightOffset>)Gunsights.Find("SideWinder")!).Clear());
    }
}
