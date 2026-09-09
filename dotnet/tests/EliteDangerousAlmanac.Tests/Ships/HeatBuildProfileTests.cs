using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The whole heat profile of each captured build.</summary>
/// <remarks>
/// A build's heat is one calculation read at five loads, so a profile measures the plant,
/// the hull, the power budget and the weapons together rather than one at a time.
/// </remarks>
public class HeatBuildProfileTests
{
    private static readonly HeatFixture Fixture =
        SharedFixtures.Load<HeatFixture>("fixtures/ships/heat.jsonc");

    /// <summary>The precision the fixture states a heat figure to.</summary>
    private const double Tolerance = 1e-9;

    public static TheoryData<string> Builds()
    {
        TheoryData<string> data = [];
        foreach (HeatBuildFixture build in Fixture.Builds) data.Add(build.Fixture);
        return data;
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void ACapturedBuildRunsAtTheHeatTheFixturePins(string name)
    {
        HeatBuildFixture expected = Build(name);
        ShipLoadout build = Read(name);

        Assert.Equal(expected.Ship, build.ShipSymbol, ignoreCase: true);

        HeatMetrics heat = BuildMetrics.Of(build).HeatMetricsResult().Value!;
        Assert.Equal(expected.HeatEfficiency, heat.HeatEfficiency);
        Assert.Equal(expected.HullHeatCapacity, heat.HullHeatCapacity);
        Assert.Equal(expected.HullHeatDissipation, heat.HullHeatDissipation);

        PowerBudget power = BuildMetrics.Of(build).PowerBudget();
        Assert.Equal(expected.RetractedPowerDraw, power.Retracted, 4);
        Assert.Equal(expected.DeployedPowerDraw, power.Deployed, 4);

        foreach ((HeatStateFixture want, HeatState got) in Loads(expected, heat))
        {
            Assert.Equal(want.ThermalLoad, got.ThermalLoad, Tolerance);
            Assert.Equal(want.Overheats, got.Overheats);

            if (want.Gauge is double gauge)
            {
                // A load the ship settles under reaches a level, and never a countdown.
                Assert.Equal(gauge, got.Gauge, Tolerance);
                Assert.Null(got.SecondsToOverheat);
            }

            if (want.SecondsToOverheat is double seconds)
            {
                // A load the ship never settles under has no level, only a countdown.
                Assert.Equal(double.PositiveInfinity, got.Gauge);
                Assert.Equal(seconds, got.SecondsToOverheat!.Value, Tolerance);
            }
        }
    }

    /// <summary>A plant that feeds nothing leaves nothing to make heat with.</summary>
    /// <remarks>
    /// Every priority group is unpowered, so no thruster, drive or gun is running, and the
    /// build cannot cook itself at any load.
    /// </remarks>
    [Fact]
    public void ABuildThePlantCannotFeedMakesNoHeatAnywhere()
    {
        UnpoweredHeatFixture expected = Fixture.Unpowered;
        ShipLoadout starved = Read(expected.Fixture)
            .SetModule("PowerPlant", ModuleCatalogue.FindBySymbol(expected.PowerPlant)!);

        foreach (PowerBand band in BuildMetrics.Of(starved).PowerBudget().Bands)
        {
            Assert.False(band.PoweredRetracted);
            Assert.False(band.PoweredDeployed);
        }

        HeatMetrics heat = BuildMetrics.Of(starved).HeatMetricsResult().Value!;
        HeatState[] loads =
        [
            heat.Idle, heat.Thrusters, heat.FsdCharging, heat.FiringSustained, heat.FiringDrained,
        ];
        foreach (HeatState load in loads)
        {
            Assert.Equal(expected.ThermalLoad, load.ThermalLoad);
            Assert.Equal(expected.HeatLevel, load.HeatLevel);
            Assert.Equal(expected.Overheats, load.Overheats);
        }
    }

    /// <summary>Pairs each stated load with the one the calculation answers.</summary>
    private static IEnumerable<(HeatStateFixture Expected, HeatState Actual)> Loads(
        HeatBuildFixture expected,
        HeatMetrics heat)
    {
        yield return (expected.Idle, heat.Idle);
        yield return (expected.Thrusters, heat.Thrusters);
        yield return (expected.FsdCharging, heat.FsdCharging);
        yield return (expected.FiringSustained, heat.FiringSustained);
        yield return (expected.FiringDrained, heat.FiringDrained);
    }

    private static HeatBuildFixture Build(string name)
    {
        foreach (HeatBuildFixture build in Fixture.Builds)
        {
            if (build.Fixture == name) return build;
        }

        throw new KeyNotFoundException($"The fixture states no build '{name}'.");
    }

    /// <summary>Reads one capture, which the fixture names by file rather than by path.</summary>
    private static ShipLoadout Read(string name)
    {
        using JsonDocument document = SharedFixtures.LoadDocument($"fixtures/ships/{name}");
        return ShipLoadout.FromLoadout(
            document.RootElement.Deserialize<LoadoutEvent>(JournalOptions)!);
    }

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };
}
