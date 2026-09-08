using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The slot model, measured against the shared slot fixture.</summary>
public class BuildSlotsTests
{
    private static readonly ShipSlotsFixture Fixture =
        SharedFixtures.Load<ShipSlotsFixture>("fixtures/ships/ship-slots.jsonc");

    public static TheoryData<string> KeyedHulls()
    {
        TheoryData<string> data = [];
        foreach (string symbol in Fixture.Keys.Keys) data.Add(symbol);
        return data;
    }

    public static TheoryData<string> LaidOutHulls()
    {
        TheoryData<string> data = [];
        foreach (ShipSlotLayoutFixture layout in Fixture.Spot) data.Add(layout.Symbol);
        return data;
    }

    [Fact]
    public void EveryHullHasALayout() =>
        Assert.Equal(Fixture.Count, ShipCatalogue.All.Count(ship => ShipCatalogue.FindSlots(ship.Symbol) is not null));

    [Fact]
    public void EveryHullCarriesAPlanetaryApproachSuiteMount()
    {
        int hulls = ShipCatalogue.All.Count(ship =>
            BuildSlots.Enumerate(ship.Slots())
                .Any(slot => slot.Restriction == SlotRestriction.PlanetaryApproachSuite));
        Assert.Equal(Fixture.PlanetaryApproachSuiteCount, hulls);
    }

    [Theory]
    [MemberData(nameof(LaidOutHulls))]
    public void AHullsLayoutMatchesTheFixtureMountForMount(string symbol)
    {
        ShipSlotLayoutFixture expected = Fixture.Spot.Single(layout => layout.Symbol == symbol);
        ShipSlots actual = ShipCatalogue.FindSlots(symbol)!;

        Assert.Equal(expected.Utility, actual.Utility);
        foreach (KeyValuePair<string, int> core in expected.Core)
        {
            Assert.True(MaterialCoreType(core.Key, out CoreSlotType parsed));
            Assert.Equal(core.Value, actual.Core[parsed]);
        }

        Assert.Equal(expected.Hardpoints.Count, actual.Hardpoints.Count);
        for (int index = 0; index < expected.Hardpoints.Count; index++)
        {
            SlotSpecFixture wanted = expected.Hardpoints[index];
            HardpointSlotSpec got = actual.Hardpoints[index];
            Assert.Equal(wanted.Size, got.Size);
            Assert.Equal(wanted.Name, got.Name);
            AssertRestriction(wanted.Restriction, got.Restriction);
        }

        Assert.Equal(expected.Optional.Count, actual.Optional.Count);
        for (int index = 0; index < expected.Optional.Count; index++)
        {
            SlotSpecFixture wanted = expected.Optional[index];
            OptionalSlotSpec got = actual.Optional[index];
            Assert.Equal(wanted.Size, got.Size);
            Assert.Equal(wanted.Name, got.Name);
            AssertRestriction(wanted.Restriction, got.Restriction);
        }
    }

    [Theory]
    [MemberData(nameof(KeyedHulls))]
    public void AHullsLayoutExpandsIntoTheFixturesSlotKeys(string symbol)
    {
        IReadOnlyList<BuildSlot> slots = BuildSlots.Enumerate(ShipCatalogue.FindSlots(symbol)!);
        Assert.Equal(Fixture.Keys[symbol], slots.Select(slot => slot.Key));
    }

    [Fact]
    public void EveryEnumeratedKeyReadsBackAsTheSameKindOfMount()
    {
        foreach (Ship ship in ShipCatalogue.All)
        {
            foreach (BuildSlot slot in BuildSlots.Enumerate(ship.Slots()))
            {
                ParsedSlot? parsed = BuildSlots.ParseName(slot.Key);
                Assert.NotNull(parsed);
                Assert.Equal(slot.Kind, parsed!.Kind);
                Assert.Equal(slot.Core, parsed.Core);
                Assert.Equal(slot.Restriction, parsed.Restriction);
            }
        }
    }

    [Fact]
    public void SlotKeysAreUniqueWithinAHull()
    {
        foreach (Ship ship in ShipCatalogue.All)
        {
            IReadOnlyList<BuildSlot> slots = BuildSlots.Enumerate(ship.Slots());
            Assert.Equal(
                slots.Count,
                slots.Select(slot => slot.Key.ToUpperInvariant()).Distinct().Count());
        }
    }

    [Fact]
    public void ARestrictedMountCarriesTheFixturesRestriction()
    {
        foreach (SlotRestrictionFixture expected in Fixture.Restrictions)
        {
            BuildSlot slot = BuildSlots
                .Enumerate(ShipCatalogue.FindSlots(expected.Ship)!)
                .Single(candidate => candidate.Key == expected.Slot);
            AssertRestriction(expected.Restriction, slot.Restriction);
        }
    }

    [Theory]
    [InlineData("Slot03_Size5", SlotKind.Optional, 5)]
    [InlineData("HugeHardpoint1", SlotKind.Hardpoint, 4)]
    [InlineData("SmallHardpoint2", SlotKind.Hardpoint, 1)]
    [InlineData("TinyHardpoint1", SlotKind.Utility, 0)]
    [InlineData("Armour", SlotKind.Armour, 0)]
    [InlineData("CargoHatch", SlotKind.CargoHatch, 1)]
    public void ParseNameReadsTheSizeAKeyEncodes(string key, SlotKind kind, int size)
    {
        ParsedSlot? parsed = BuildSlots.ParseName(key);
        Assert.NotNull(parsed);
        Assert.Equal(kind, parsed!.Kind);
        Assert.Equal(size, parsed.Size);
    }

    [Fact]
    public void ParseNameIgnoresTheCasingAProducerChose()
    {
        Assert.Equal(CoreSlotType.PowerPlant, BuildSlots.ParseName("powerplant")?.Core);
        Assert.Equal(CoreSlotType.Sensors, BuildSlots.ParseName("Radar")?.Core);
        Assert.Equal(CoreSlotType.Thrusters, BuildSlots.ParseName("MAINENGINES")?.Core);
        Assert.Equal(
            SlotRestriction.Mining,
            BuildSlots.ParseName("largemininghardpoint1")?.Restriction);
    }

    [Fact]
    public void ARestrictedKeySaysWhatItTakesWithoutAHullLayout()
    {
        Assert.Equal(SlotRestriction.Military, BuildSlots.ParseName("Military01")?.Restriction);
        Assert.Equal(SlotRestriction.Cargo, BuildSlots.ParseName("Cargo02")?.Restriction);
        Assert.Equal(SlotRestriction.LimpetController, BuildSlots.ParseName("LimpetController01")?.Restriction);
        Assert.Equal(SlotRestriction.VesselHangar, BuildSlots.ParseName("FighterBay01")?.Restriction);
        Assert.Equal(SlotRestriction.Passenger, BuildSlots.ParseName("Passenger03")?.Restriction);

        ParsedSlot suite = BuildSlots.ParseName("PlanetaryApproachSuite")!;
        Assert.Equal(SlotRestriction.PlanetaryApproachSuite, suite.Restriction);
        Assert.Null(suite.Size);
    }

    [Fact]
    public void AnUnknownOrAbsentKeyIsAMiss()
    {
        Assert.Null(BuildSlots.ParseName(null));
        Assert.Null(BuildSlots.ParseName("  "));
        Assert.Null(BuildSlots.ParseName("NotASlot"));
        Assert.Null(BuildSlots.ParseName("Slot01"));
        Assert.Null(BuildSlots.ParseName("Slot01_Size"));
        Assert.Null(BuildSlots.ParseName("SlotXX_Size4"));
        Assert.Null(BuildSlots.ParseName("Military"));
        Assert.Null(BuildSlots.ParseName("HugeHardpoint"));
    }

    [Fact]
    public void ARestrictionNamesWhatItAccepts()
    {
        Assert.Equal("mining tools", SlotRestriction.Mining.Label());
        Assert.True(SlotRestriction.Mining.IsHardpointRestriction());
        Assert.False(SlotRestriction.Mining.IsOptionalRestriction());
        Assert.True(SlotRestriction.Military.IsOptionalRestriction());
        Assert.Throws<System.ArgumentOutOfRangeException>(() => ((SlotRestriction)99).Label());
        Assert.Throws<System.ArgumentOutOfRangeException>(() => ((CoreSlotType)99).SlotKey());
        Assert.Throws<System.ArgumentNullException>(() => BuildSlots.Enumerate(null!));
    }

    private static void AssertRestriction(string? expected, SlotRestriction? actual)
    {
        if (expected is null)
        {
            Assert.Null(actual);
            return;
        }

        Assert.NotNull(actual);
        Assert.Equal(expected, actual!.Value.ToString(), ignoreCase: true);
    }

    private static bool MaterialCoreType(string name, out CoreSlotType core) =>
        System.Enum.TryParse(name, ignoreCase: true, out core);
}
