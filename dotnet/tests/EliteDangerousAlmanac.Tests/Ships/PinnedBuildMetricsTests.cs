using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>
/// Two builds pinned at the full precision this library works in, rather than at a panel's.
/// </summary>
/// <remarks>
/// The panel-audited builds hold the arithmetic to the game. These hold it to itself: one
/// build read out of an export and one assembled here, each with every figure a metric
/// publishes written out. A change that moves a figure below the place a panel shows still
/// fails here.
/// </remarks>
public class PinnedBuildMetricsTests
{
    /// <summary>The figures are pinned to six decimal places, so this clears the rounding.</summary>
    private const double Tolerance = 1e-6;

    private static readonly BuildMetricsFixture Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc");

    /// <summary>The exported build, which carries no weapons at all.</summary>
    private static ShipLoadout Exported()
    {
        using JsonDocument document = SharedFixtures.LoadDocument(Fixture.DeepBlack.Build);
        return ShipLoadout.FromSlef(Slef.Parse(document.RootElement));
    }

    /// <summary>The fixture's Anaconda, assembled from the catalogues on the hull's defaults.</summary>
    private static ShipLoadout Assembled()
    {
        ShipLoadout build = ShipLoadout.Empty("Anaconda");
        foreach (KeyValuePair<string, string> fitted in Fixture.Anaconda.Modules)
        {
            build.SetModule(fitted.Key, ModuleCatalogue.FindBySymbol(fitted.Value)!);
        }

        return build;
    }

    [Fact]
    public void TheExportedBuildDrawsThePowerTheFixturePins()
    {
        PinnedPowerFixture expected = Fixture.DeepBlack.Power;

        PowerBudget budget = BuildMetrics.Of(Exported()).PowerBudget();

        Assert.Equal(expected.Available, budget.Available, Tolerance);
        Assert.Equal(expected.Retracted, budget.Retracted, Tolerance);
        Assert.Equal(expected.Deployed, budget.Deployed, Tolerance);
        Assert.Equal(expected.Headroom!.Value, budget.Headroom, Tolerance);
        Assert.Equal(expected.WithinBudget, budget.WithinBudget);

        // The build carries no weapons, so running the hardpoints out changes nothing.
        Assert.Equal(budget.Retracted, budget.Deployed, Tolerance);
    }

    [Fact]
    public void TheExportedBuildCarriesTheDefencesTheFixturePins()
    {
        PinnedBuildFixture expected = Fixture.DeepBlack;
        ShipLoadout build = Exported();

        ShieldMetrics shields = BuildMetrics.Of(build).ShieldMetricsResult().Value;
        Assert.Equal(expected.Shields.Strength, shields.Strength, Tolerance);
        Assert.Equal(
            expected.Shields.MassCurveMultiplier, shields.MassCurveMultiplier, Tolerance);
        AssertFour(expected.Shields.Resistances, shields.Resistances, "shield resistances");
        AssertFour(
            expected.Shields.EffectiveHitPoints,
            shields.EffectiveHitPoints,
            "shield effective hit points");

        ArmourMetrics armour = BuildMetrics.Of(build).ArmourMetrics();
        Assert.Equal(expected.Armour.HitPoints, armour.HitPoints, Tolerance);
        AssertFour(expected.Armour.Resistances, armour.Resistances, "armour resistances");
        AssertFour(
            expected.Armour.EffectiveHitPoints,
            armour.EffectiveHitPoints,
            "armour effective hit points");

        Assert.Equal(expected.WeaponCount, BuildMetrics.Of(build).WeaponMetrics().Weapons.Count);
    }

    [Fact]
    public void TheAssembledBuildDrawsThePowerTheFixturePinsBandByBand()
    {
        PinnedPowerFixture expected = Fixture.Anaconda.Power;

        PowerBudget budget = BuildMetrics.Of(Assembled()).PowerBudget();

        Assert.Equal(expected.Available, budget.Available, Tolerance);
        Assert.Equal(expected.Retracted, budget.Retracted, Tolerance);
        Assert.Equal(expected.Deployed, budget.Deployed, Tolerance);

        // The two weapons draw only once the hardpoints are run out.
        Assert.True(budget.Deployed > budget.Retracted);

        List<PowerBandFixture> bands = expected.Bands!;
        Assert.Equal(bands.Count, budget.Bands.Count);
        for (int index = 0; index < bands.Count; index++)
        {
            PowerBand band = budget.Bands[index];
            Assert.Equal(bands[index].Priority, band.Priority);
            Assert.Equal(bands[index].Retracted, band.Retracted, Tolerance);
            Assert.Equal(bands[index].Deployed, band.Deployed, Tolerance);
            Assert.Equal(bands[index].DeployedTotal, band.DeployedTotal, Tolerance);
            Assert.Equal(bands[index].PoweredDeployed, band.PoweredDeployed);
        }
    }

    [Fact]
    public void TheAssembledBuildCarriesTheShieldsTheFixturePins()
    {
        PinnedShieldsFixture expected = Fixture.Anaconda.Shields;
        ShipLoadout build = Assembled();

        ShieldMetrics shields = BuildMetrics.Of(build).ShieldMetricsResult().Value;
        Assert.Equal(expected.Strength, shields.Strength, Tolerance);
        Assert.Equal(expected.Generator!.Value, shields.Generator, Tolerance);
        Assert.Equal(expected.Boosters!.Value, shields.Boosters, Tolerance);
        Assert.Equal(expected.BoostMultiplier!.Value, shields.BoostMultiplier, Tolerance);
        Assert.Equal(expected.MassCurveMultiplier, shields.MassCurveMultiplier, Tolerance);
        AssertFour(expected.Resistances, shields.Resistances, "shield resistances");
        AssertFour(
            expected.EffectiveHitPoints, shields.EffectiveHitPoints, "shield effective hit points");

        // A full allocation to systems buys the shield a further resistance of its own.
        AssertFour(
            expected.ResistancesAtFourPips!,
            BuildMetrics.Of(build).ShieldCapacitorMetricsResult().Value.EffectiveResistances,
            "resistances at four pips");
    }

    [Fact]
    public void TheAssembledBuildCarriesTheArmourTheFixturePins()
    {
        PinnedArmourFixture expected = Fixture.Anaconda.Armour;

        ArmourMetrics armour = BuildMetrics.Of(Assembled()).ArmourMetrics();

        Assert.Equal(expected.HitPoints, armour.HitPoints, Tolerance);
        Assert.Equal(expected.Bulkheads, armour.Bulkheads, Tolerance);
        Assert.Equal(expected.Reinforcement, armour.Reinforcement, Tolerance);
        AssertFour(expected.Resistances, armour.Resistances, "armour resistances");
        AssertFour(
            expected.EffectiveHitPoints, armour.EffectiveHitPoints, "armour effective hit points");

        // A module reinforcement package protects the modules rather than the hull.
        Assert.Equal(expected.ModuleArmour!.Value, armour.ModuleArmour, Tolerance);
        Assert.Equal(expected.ModuleProtection!.Value, armour.ModuleProtection, Tolerance);
    }

    [Fact]
    public void TheAssembledBuildDealsTheFirepowerTheFixturePins()
    {
        PinnedWeaponsFixture expected = Fixture.Anaconda.Weapons;

        BuildWeaponMetrics weapons = BuildMetrics.Of(Assembled()).WeaponMetrics();

        Assert.Equal(2, weapons.Weapons.Count);
        Assert.Equal(expected.DamagePerSecond, weapons.Total.DamagePerSecond, Tolerance);
        Assert.Equal(
            expected.SustainedDamagePerSecond, weapons.Total.SustainedDamagePerSecond, Tolerance);
        Assert.Equal(expected.EnergyPerSecond, weapons.Total.EnergyPerSecond, Tolerance);
        Assert.Equal(expected.HeatPerSecond, weapons.Total.HeatPerSecond, Tolerance);
        Assert.Equal(expected.PowerDraw, weapons.Total.PowerDraw, Tolerance);
        Assert.Equal(
            expected.KineticDamagePerSecond, weapons.Total.DamageByType.Kinetic, Tolerance);
        Assert.Equal(
            expected.ThermalDamagePerSecond, weapons.Total.DamageByType.Thermal, Tolerance);

        double heat = 0;
        foreach (FittedWeaponMetrics weapon in weapons.Weapons) heat += weapon.Metrics.ThermalLoad;
        Assert.Equal(heat, weapons.Total.ThermalLoad, Tolerance);
    }

    private static void AssertFour(
        FourResistancesFixture expected,
        DamageTypeValues actual,
        string what)
    {
        Assert.Equal(expected.Kinetic, actual.Kinetic, Tolerance);
        Assert.Equal(expected.Thermal, actual.Thermal, Tolerance);
        Assert.Equal(expected.Explosive, actual.Explosive, Tolerance);
        Assert.Equal(expected.Caustic, actual.Caustic, Tolerance);
    }
}
