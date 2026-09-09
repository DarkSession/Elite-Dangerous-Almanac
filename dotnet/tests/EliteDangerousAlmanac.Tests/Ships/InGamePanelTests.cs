using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>
/// Every build whose figures were read off the game's own ship panel, reproduced here.
/// </summary>
/// <remarks>
/// <para>
/// These readings are outside evidence rather than this library's output, so a case that
/// reproduces one measures the whole calculation against the game itself. Each figure is
/// held to the precision the panel showed it at, and no tighter: a panel reading of 39.76
/// says the true figure lies within half of the last place shown.
/// </para>
/// <para>
/// Two panel conventions matter. The power figures count every fitted module, whether or
/// not the commander powered it down, so the build is read with all of them running. The
/// mass figure counts the reserve tank, which the drive cannot burn, so the jump is
/// computed with the reserve carried as cargo.
/// </para>
/// </remarks>
public class InGamePanelTests
{
    private static readonly Dictionary<string, InGameBuildFixture> Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc").InGame;

    public static TheoryData<string> Builds()
    {
        TheoryData<string> names = [];
        foreach (string name in Fixture.Keys) names.Add(name);
        return names;
    }

    /// <summary>The three angular rates the panel shows, to a hundredth of a degree.</summary>
    /// <remarks>
    /// Excluding the reserve tank puts every one of the thirty readings inside the panel's
    /// own rounding interval. Carrying it puts most of them outside, which is what says the
    /// rotation figures are quoted at the lighter load.
    /// </remarks>
    [Theory]
    [MemberData(nameof(Builds))]
    public void APanelAuditedBuildReproducesItsObservedAngularRates(string name)
    {
        InGameBuildFixture expected = Fixture[name];
        MobilityMetrics mobility = BuildMetrics.Of(Read(expected)).MobilityMetricsResult().Value;

        Assert.True(
            expected.Speed.Pitch.Matches(mobility.Pitch),
            $"{name} pitch: computed {mobility.Pitch}, observed {expected.Speed.Pitch}");
        Assert.True(
            expected.Speed.Roll.Matches(mobility.Roll),
            $"{name} roll: computed {mobility.Roll}, observed {expected.Speed.Roll}");
        Assert.True(
            expected.Speed.Yaw.Matches(mobility.Yaw),
            $"{name} yaw: computed {mobility.Yaw}, observed {expected.Speed.Yaw}");
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void APanelAuditedBuildReproducesItsObservedSpeedAndJump(string name)
    {
        InGameBuildFixture expected = Fixture[name];
        ShipLoadout build = Read(expected);
        LoadoutFuelCapacity fuel = build.FuelCapacity;

        // The panel counts the reserve tank as mass but the drive cannot jump on it.
        Assert.True(
            expected.JumpRange.FullTank.Matches(
                BuildMetrics.Of(build).JumpRangeAt(new BuildLoad(fuel.Main, fuel.Reserve))),
            $"{name} jump: observed {expected.JumpRange.FullTank}");

        MobilityMetrics mobility = BuildMetrics.Of(build).MobilityMetricsResult().Value;

        // One observer read a top speed above the boost speed, which no ship does. The pair
        // is kept as it was read rather than corrected, and says nothing this can be held to.
        if (expected.Speed.Top.Value > expected.Speed.Boost.Value) return;

        Assert.True(expected.Speed.Top.Matches(mobility.Speed), $"{name} top speed");
        Assert.True(expected.Speed.Boost.Matches(mobility.Boost), $"{name} boost");
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void APanelAuditedBuildReproducesItsObservedPowerAndOffence(string name)
    {
        InGameBuildFixture expected = Fixture[name];
        Assert.True(expected.Power.IncludesDisabledModules);

        ShipLoadout installed = AllModulesRunning(expected);
        PowerBudget power = BuildMetrics.Of(installed).PowerBudget();
        Assert.True(expected.Power.Available.Matches(power.Available), $"{name} available");
        Assert.True(expected.Power.Retracted.Matches(power.Retracted), $"{name} retracted");
        Assert.True(expected.Power.Deployed.Matches(power.Deployed), $"{name} deployed");

        if (expected.Offense is not InGameOffenceFixture offence) return;

        // The panel counts the utility mounts beside the hardpoints, so a mine launcher's
        // draw and a shield booster's heat join the totals a weapon list leaves out.
        double damage = BuildMetrics.Of(installed).WeaponMetrics().Total.DamagePerSecond;
        double draw = 0;
        double heat = 0;
        foreach (LoadoutSlot slot in Armament(installed))
        {
            OutfittingModule? stats = slot.Module?.EffectiveStats;
            if (stats is null) continue;
            draw += stats.Stats[ModuleStat.DistributorDraw] ?? 0;
            heat += stats.Stats[ModuleStat.ThermalLoad] ?? 0;
            if (slot.Kind == SlotKind.Utility)
            {
                damage += Weapons.DamagePerSecond(WeaponStats.FromModule(stats));
            }
        }

        Assert.True(offence.DamagePerSecond.Matches(damage), $"{name} damage per second");
        Assert.True(offence.DistributorDraw.Matches(draw), $"{name} distributor draw");
        Assert.True(offence.ThermalLoad.Matches(heat), $"{name} thermal load");
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void APanelAuditedBuildReproducesItsObservedShieldsAndArmour(string name)
    {
        InGameBuildFixture expected = Fixture[name];
        ShipLoadout build = Read(expected);

        CalculationResult<ShieldMetrics> shielded = BuildMetrics.Of(build).ShieldMetricsResult();

        // A panel showing no shield at all is a ship with no generator fitted, which is a
        // build the shield arithmetic answers nothing for rather than answering zero.
        if (expected.Shields.Strength.Value == 0)
        {
            Assert.False(shielded.Complete);
            Assert.Null(ShieldGenerator(build));
            return;
        }

        ShieldMetrics shields = shielded.Value;
        Assert.True(expected.Shields.Strength.Matches(shields.Strength), $"{name} shield strength");
        if (expected.Shields.Resistances is InGameResistancesFixture resisted)
        {
            AssertResistances(resisted, shields.Resistances, $"{name} shields");
        }

        if (expected.Shields.Regeneration is InGameRegenerationFixture regeneration)
        {
            OutfittingModule generator = ShieldGenerator(build)!;
            Assert.True(
                regeneration.Standard.Matches(generator.Stats[ModuleStat.ShieldRegenRate]!.Value),
                $"{name} shield regeneration");
            Assert.True(
                regeneration.Broken.Matches(
                    generator.Stats[ModuleStat.ShieldBrokenRegenRate]!.Value),
                $"{name} broken shield regeneration");
        }

        ArmourMetrics armour = BuildMetrics.Of(build).ArmourMetrics();
        Assert.True(expected.Armour.HitPoints.Matches(armour.HitPoints), $"{name} hull points");
        AssertResistances(expected.Armour.Resistances, armour.Resistances, $"{name} armour");
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void APanelAuditedBuildReproducesItsObservedMass(string name)
    {
        InGameBuildFixture expected = Fixture[name];
        ShipLoadout build = Read(expected);

        // The panel weighs the reserve tank even though the drive cannot burn it.
        double laden = BuildMetrics.Of(build).BuildMass().Total + build.FuelCapacity.Reserve;
        Assert.True(expected.Mass.Current.Matches(laden), $"{name} mass: computed {laden}");
        Assert.True(
            expected.Mass.Maximum.Matches(BuildMetrics.Of(build).Thrusters()!.MaxMass),
            $"{name} rated mass");
    }

    /// <summary>A capture that lost its own ship name still names the build the panel showed.</summary>
    [Theory]
    [MemberData(nameof(Builds))]
    public void ACaptureNamesTheShipTheObserverSaw(string name)
    {
        InGameBuildFixture expected = Fixture[name];
        ShipLoadout build = Read(expected);

        if (expected.ObservedShipName is string observed)
        {
            // The capture states an empty name, so the observer's own reading is the record.
            Assert.True(string.IsNullOrEmpty(build.ShipName));
            Assert.NotEmpty(observed);
            return;
        }

        Assert.False(string.IsNullOrEmpty(build.ShipName));
    }

    private static void AssertResistances(
        InGameResistancesFixture expected,
        DamageTypeValues actual,
        string what)
    {
        Assert.True(expected.Kinetic.Matches(actual.Kinetic), $"{what} kinetic");
        Assert.True(expected.Thermal.Matches(actual.Thermal), $"{what} thermal");
        Assert.True(expected.Explosive.Matches(actual.Explosive), $"{what} explosive");
    }

    /// <summary>The fitted generator whose regeneration rates the panel shows.</summary>
    private static OutfittingModule? ShieldGenerator(ShipLoadout build)
    {
        foreach (LoadoutSlot slot in build.Slots())
        {
            OutfittingModule? stats = slot.Module?.EffectiveStats;
            if (stats?.Stats.Has(ModuleStat.ShieldRegenRate) == true) return stats;
        }

        return null;
    }

    /// <summary>The hardpoints and the utility mounts, which the panel totals together.</summary>
    private static List<LoadoutSlot> Armament(ShipLoadout build)
    {
        List<LoadoutSlot> mounts = [.. build.Slots(SlotKind.Hardpoint)];
        mounts.AddRange(build.Slots(SlotKind.Utility));
        return mounts;
    }

    private static ShipLoadout Read(InGameBuildFixture expected) =>
        ShipLoadout.FromLoadout(SharedFixtures.LoadCapture<LoadoutEvent>(expected.Build));

    /// <summary>The same build with every module running, which is what the panel counts.</summary>
    private static ShipLoadout AllModulesRunning(InGameBuildFixture expected)
    {
        LoadoutEvent capture = SharedFixtures.LoadCapture<LoadoutEvent>(expected.Build);
        List<LoadoutModule> running = [];
        foreach (LoadoutModule module in capture.Modules) running.Add(module with { On = true });
        return ShipLoadout.FromLoadout(capture with { Modules = running });
    }
}
