using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What a build runs at, and whether firing everything cooks it.</summary>
public class HeatTests
{
    private static readonly HeatFixture Fixture =
        SharedFixtures.Load<HeatFixture>("fixtures/ships/heat.jsonc");

    /// <summary>The precision the fixture states a heat figure to.</summary>
    private const double Tolerance = 1e-9;

    public static TheoryData<int> Equilibria() => Positions(Fixture.Equilibrium.Count);

    public static TheoryData<int> WeaponLoads() => Positions(Fixture.WeaponThermalLoad.Count);

    public static TheoryData<int> Transients() => Positions(Fixture.Transient.Count);

    [Fact]
    public void TheGaugeIsFullAtTheHeatLevelTheFixtureStates() =>
        Assert.Equal(Heat.OverheatHeatLevel, Fixture.OverheatHeatLevel);

    [Theory]
    [MemberData(nameof(Equilibria))]
    public void ALoadSettlesAtTheFixturesHeatLevel(int position)
    {
        EquilibriumCaseFixture stated = Fixture.Equilibrium[position];

        double level = Heat.EquilibriumLevel(stated.Dissipation, stated.ThermalLoad);

        // A case that states no level is one that settles nowhere.
        Assert.Equal(stated.HeatLevel ?? double.PositiveInfinity, level, Tolerance);
    }

    [Theory]
    [MemberData(nameof(WeaponLoads))]
    public void TheCapacitorsStateAmplifiesAWeaponsThermalLoad(int position)
    {
        WeaponThermalLoadCaseFixture stated = Fixture.WeaponThermalLoad[position];

        double effective = Heat.EffectiveWeaponThermalLoad(
            stated.ThermalLoad, stated.DistributorDraw, stated.WeaponsCapacity, stated.CapacitorLevel);

        Assert.Equal(stated.Effective, effective, Tolerance);
    }

    [Fact]
    public void ADrainedCapacitorMultipliesTheStatedLoadByTheFixturesFactor()
    {
        double full = Heat.EffectiveWeaponThermalLoad(2, 20, 20, 1);
        double empty = Heat.EffectiveWeaponThermalLoad(2, 20, 20, 0);

        Assert.Equal(2 * Fixture.DrainedCapacitorMultiplier, empty, Tolerance);
        // A discharge that costs the whole capacitor already runs it dry, even from full.
        Assert.Equal(empty, full, Tolerance);
    }

    [Theory]
    [MemberData(nameof(Transients))]
    public void HeatMovesTowardsWhereItSettlesAtTheFixturesRate(int position)
    {
        TransientCaseFixture stated = Fixture.Transient[position];

        if (stated.TargetLevel is double target)
        {
            double seconds = Heat.SecondsToLevel(
                stated.HeatCapacity,
                stated.HeatDissipation,
                stated.ThermalLoad,
                stated.StartLevel,
                target);

            // A case that states no seconds is one the load never carries the ship to.
            Assert.Equal(stated.Seconds ?? double.PositiveInfinity, seconds, Tolerance);
            return;
        }

        double level = Heat.LevelAtTime(
            stated.HeatCapacity,
            stated.HeatDissipation,
            stated.ThermalLoad,
            stated.StartLevel,
            stated.Seconds!.Value);

        Assert.Equal(stated.HeatLevel!.Value, level, Tolerance);
    }

    [Fact]
    public void TheCatalogueCarriesTheFixturesMeasuredDissipation()
    {
        foreach (HullHeatFixture hull in Fixture.Hulls.Values)
        {
            Ship ship = ShipCatalogue.FindBySymbol(hull.Symbol)!;

            Assert.Equal(hull.HeatDissipation, ship.HeatDissipation);
        }
    }

    [Fact]
    public void NoTimeAtAllLeavesTheShipWhereItStarted() =>
        Assert.Equal(0.4, Heat.LevelAtTime(100, 50, 50, 0.4, 0));

    [Fact]
    public void ALoadTheHullCannotShedClimbsPastTheWholeGauge()
    {
        // Above heat level one the dissipation is capped, so heat climbs at a fixed rate.
        double level = Heat.LevelAtTime(100, 50, 150, 1, 2);

        Assert.Equal(1 + (2 * (150 - 50) / 100d), level, Tolerance);
    }

    [Fact]
    public void AShipAboveWhereItSettlesFallsBackThroughHeatLevelOne()
    {
        // It cools linearly to heat level one, then along the square-law curve below it.
        double level = Heat.LevelAtTime(100, 50, 25, 1.5, 4);

        Assert.True(level < 1);
        Assert.True(level > Heat.EquilibriumLevel(50, 25));
    }

    [Fact]
    public void AHullThatShedsNothingOnlyEverHeats()
    {
        Assert.Equal(0.5, Heat.LevelAtTime(100, 0, 25, 0, 2), Tolerance);
        Assert.Equal(4, Heat.SecondsToLevel(100, 0, 25, 0, 1), Tolerance);
        // It never cools, and with no load it never moves at all.
        Assert.Equal(double.PositiveInfinity, Heat.SecondsToLevel(100, 0, 25, 1, 0));
        Assert.Equal(double.PositiveInfinity, Heat.SecondsToLevel(100, 0, 0, 0, 1));
    }

    [Fact]
    public void CoolingWithNothingGeneratingFollowsAReciprocal()
    {
        Assert.Equal(0, Heat.LevelAtTime(100, 50, 0, 0, 5));
        Assert.Equal(1 / ((1 / 0.5) + (0.5 * 2)), Heat.LevelAtTime(100, 50, 0, 0.5, 2), Tolerance);
        // Absolute zero is never reached, and nothing heats a ship that generates nothing.
        Assert.Equal(double.PositiveInfinity, Heat.SecondsToLevel(100, 50, 0, 0.5, 0));
        Assert.Equal(double.PositiveInfinity, Heat.SecondsToLevel(100, 50, 0, 0.5, 0.8));
    }

    [Fact]
    public void AShipAlreadyAtWhereItSettlesStaysThere()
    {
        double settled = Heat.EquilibriumLevel(50, 25);

        Assert.Equal(settled, Heat.LevelAtTime(100, 50, 25, settled, 30));
        Assert.Equal(0, Heat.SecondsToLevel(100, 50, 25, settled, settled));
    }

    [Fact]
    public void ALoadThatSettlesBelowTheTargetNeverGetsThere() =>
        Assert.Equal(double.PositiveInfinity, Heat.SecondsToLevel(100, 50, 25, 0, 1.5));

    [Fact]
    public void ASteadyLoadStillCoolsAShipThatStartedHotterThanIt()
    {
        double seconds = Heat.SecondsToLevel(100, 50, 25, 1.5, 0.9);

        Assert.True(seconds > 0);
        Assert.True(double.IsFinite(seconds));
    }

    [Fact]
    public void AnIdleBuildSettlesAndAFiringOneStatesItsSecondsToOverheat()
    {
        HeatMetrics metrics = Heat.Metrics(new HeatInput(334, 67.15, 0.4)
        {
            RetractedPowerDraw = 18.2,
            DeployedPowerDraw = 24.6,
            ThrusterHeatRate = 2.3,
            FsdHeatRate = 37,
            WeaponsCapacity = 31,
            Weapons = [new HeatWeapon(60, 2.6)],
        });

        Assert.Equal(0.4, metrics.HeatEfficiency);
        Assert.Equal(334, metrics.HullHeatCapacity);
        Assert.Equal(67.15, metrics.HullHeatDissipation);
        Assert.Equal(18.2 * 0.4, metrics.Idle.ThermalLoad, Tolerance);
        Assert.False(metrics.Idle.Overheats);
        Assert.Null(metrics.Idle.SecondsToOverheat);
        Assert.Equal(metrics.Idle.HeatLevel / 1.5, metrics.Idle.Gauge);
        // Each scenario is the one before it plus its own source.
        Assert.Equal(metrics.Idle.ThermalLoad + 2.3, metrics.Thrusters.ThermalLoad, Tolerance);
        Assert.Equal(metrics.Thrusters.ThermalLoad + 37, metrics.FsdCharging.ThermalLoad, Tolerance);
        // A drained capacitor makes the same guns hotter than a full one.
        Assert.True(metrics.FiringDrained.ThermalLoad > metrics.FiringSustained.ThermalLoad);
        Assert.True(metrics.FiringDrained.Overheats);
        Assert.Equal(double.PositiveInfinity, metrics.FiringDrained.HeatLevel);
        Assert.Equal(double.PositiveInfinity, metrics.FiringDrained.Gauge);
        Assert.True(metrics.FiringDrained.SecondsToOverheat > 0);
    }

    [Fact]
    public void TheDeployedFiguresFallBackToTheStowedOnes()
    {
        var stowedOnly = new HeatInput(334, 67.15, 0.4)
        {
            RetractedPowerDraw = 18.2,
            ThrusterHeatRate = 2.3,
        };

        HeatMetrics metrics = Heat.Metrics(stowedOnly);
        HeatMetrics stated = Heat.Metrics(stowedOnly with
        {
            DeployedPowerDraw = 18.2,
            DeployedThrusterHeatRate = 2.3,
        });

        Assert.Equal(stated, metrics);
    }

    [Fact]
    public void AThrusterThePlantNoLongerFeedsMakesNoHeat()
    {
        HeatMetrics metrics = Heat.Metrics(new HeatInput(334, 67.15, 0.4)
        {
            RetractedPowerDraw = 18.2,
            ThrusterHeatRate = 2.3,
            DeployedThrusterHeatRate = 0,
        });

        Assert.Equal(metrics.Idle.ThermalLoad, metrics.FiringSustained.ThermalLoad, Tolerance);
    }

    [Fact]
    public void ABuildWithNoWeaponsCapacityRunsEveryWeaponDrained()
    {
        HeatMetrics metrics = Heat.Metrics(new HeatInput(334, 67.15, 0.4)
        {
            Weapons = [new HeatWeapon(4, 2.6)],
        });

        Assert.Equal(20, metrics.FiringSustained.ThermalLoad, Tolerance);
        Assert.Equal(20, metrics.FiringDrained.ThermalLoad, Tolerance);
    }

    [Fact]
    public void AHeatCapacityOfNothingIsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Heat.Metrics(new HeatInput(0, 67.15, 0.4)));
        Assert.Throws<ArgumentOutOfRangeException>(() => Heat.LevelAtTime(0, 50, 50, 0, 1));
        Assert.Throws<ArgumentOutOfRangeException>(() => Heat.SecondsToLevel(0, 50, 50, 0, 1));
    }

    [Fact]
    public void ACapacitorLevelAboveFullIsRefused() =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Heat.EffectiveWeaponThermalLoad(2, 5, 20, 1.5));

    public static TheoryData<HeatInput> NonPhysicalBuilds() =>
    [
        new HeatInput(-1, 67.15, 0.4),
        new HeatInput(334, double.NaN, 0.4),
        new HeatInput(334, 67.15, -0.4),
        new HeatInput(334, 67.15, 0.4) { RetractedPowerDraw = -1 },
        new HeatInput(334, 67.15, 0.4) { DeployedPowerDraw = double.PositiveInfinity },
        new HeatInput(334, 67.15, 0.4) { ThrusterHeatRate = -1 },
        new HeatInput(334, 67.15, 0.4) { DeployedThrusterHeatRate = -1 },
        new HeatInput(334, 67.15, 0.4) { FsdHeatRate = double.NaN },
        new HeatInput(334, 67.15, 0.4) { WeaponsCapacity = -1 },
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalBuilds))]
    public void AFigureThatIsNotPhysicalIsRefused(HeatInput input) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Heat.Metrics(input));

    [Theory]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    public void ALoadThatIsNotPhysicalIsRefused(double thermalLoad)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Heat.EquilibriumLevel(50, thermalLoad));
        Assert.Throws<ArgumentOutOfRangeException>(() => Heat.EquilibriumLevel(thermalLoad, 50));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Heat.LevelAtTime(100, 50, thermalLoad, 0, 1));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Heat.LevelAtTime(100, 50, 50, 0, thermalLoad));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Heat.SecondsToLevel(100, 50, 50, 0, thermalLoad));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Heat.EffectiveWeaponThermalLoad(thermalLoad, 5, 20, 1));
    }

    [Fact]
    public void AMissingInputIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => Heat.Metrics(null!));

    private static TheoryData<int> Positions(int count)
    {
        TheoryData<int> positions = [];
        for (int position = 0; position < count; position++) positions.Add(position);
        return positions;
    }
}
