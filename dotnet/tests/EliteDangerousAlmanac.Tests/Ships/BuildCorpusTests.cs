using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Every build in the shared community corpus, against the figures it pins.</summary>
/// <remarks>
/// The corpus records what is fitted where and does not apply the engineering its authors
/// declared, so every pinned figure is a function of the catalogues alone. A build designed
/// around an engineered power plant therefore reads as outside its own budget, which is the
/// contract rather than a defect.
/// </remarks>
public class BuildCorpusTests
{
    /// <summary>The corpus rounds to six decimal places, so this leaves room over the rounding.</summary>
    private const double Tolerance = 1e-5;

    private static readonly BuildCorpusIndex Index =
        SharedFixtures.Load<BuildCorpusIndex>("fixtures/ships/builds/index.jsonc");

    public static TheoryData<string> Builds()
    {
        TheoryData<string> ids = [];
        foreach (BuildCorpusEntry entry in Index.Builds) ids.Add(entry.Id);
        return ids;
    }

    private static BuildCorpusBuild Read(string id) =>
        SharedFixtures.Load<BuildCorpusBuild>($"fixtures/ships/builds/{id}.jsonc");

    /// <summary>Fits the build the way the corpus records it, and does not engineer it.</summary>
    /// <remarks>
    /// A corpus record omits the hull's built-in cargo hatch, and usually its planetary approach
    /// suite as well. Reading it as a capture restores both from the hull's stock loadout while
    /// fitting every stated module at once.
    /// </remarks>
    private static ShipLoadout Assemble(BuildCorpusBuild build)
    {
        List<LoadoutModule> modules = [];
        foreach (BuildCorpusModule entry in build.Modules)
        {
            modules.Add(new LoadoutModule(entry.Slot, entry.Item)
            {
                On = entry.On,
                Priority = entry.Priority,
            });
        }

        return ShipLoadout.FromLoadout(new LoadoutEvent(build.Ship, modules));
    }

    private static void Close(double expected, double actual, string what) =>
        Assert.True(
            Math.Abs(actual - expected) < Tolerance,
            $"{what}: got {actual}, expected {expected}");

    [Fact]
    public void TheIndexNamesEveryBuildTheCorpusCarriesAndOnlyThose()
    {
        List<string> onDisk = [];
        foreach (string path in SharedFixtures.Paths())
        {
            if (!path.StartsWith("fixtures/ships/builds/", StringComparison.Ordinal)) continue;
            if (path.EndsWith("/index.jsonc", StringComparison.Ordinal)) continue;
            onDisk.Add(path["fixtures/ships/builds/".Length..^".jsonc".Length]);
        }

        List<string> named = [];
        foreach (BuildCorpusEntry entry in Index.Builds) named.Add(entry.Id);
        named.Sort(StringComparer.Ordinal);
        onDisk.Sort(StringComparer.Ordinal);

        Assert.Equal(Index.Count, Index.Builds.Count);
        Assert.Equal(named, onDisk);
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void ABuildCarriesTheMassTheCapacityAndTheReachTheCorpusPins(string id)
    {
        BuildCorpusBuild expected = Read(id);
        ShipLoadout build = Assemble(expected);

        Close(expected.Metrics.UnladenMass!.Value, build.UnladenMass, $"{id} unladen mass");
        Assert.Equal(expected.Metrics.CargoCapacity, build.CargoCapacity);
        Assert.Equal(expected.Metrics.PassengerCapacity, build.PassengerCapacity);
        Close(expected.Metrics.FuelCapacity, build.FuelCapacity.Main, $"{id} fuel");
        Close(
            expected.Metrics.MaxJumpRange!.Value,
            BuildMetrics.Of(build).MaxJumpRange(),
            $"{id} jump range");
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void ABuildDrawsThePowerTheCorpusPins(string id)
    {
        BuildCorpusBuild expected = Read(id);

        PowerBudget power = BuildMetrics.Of(Assemble(expected)).PowerBudget();

        Close(expected.Metrics.Power.Available, power.Available, $"{id} available");
        Close(expected.Metrics.Power.Retracted, power.Retracted, $"{id} retracted");
        Close(expected.Metrics.Power.Deployed, power.Deployed, $"{id} deployed");
        Assert.Equal(expected.Metrics.Power.WithinBudget, power.WithinBudget);
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void ABuildCarriesTheShieldsTheCorpusPins(string id)
    {
        BuildCorpusBuild expected = Read(id);
        ShipLoadout build = Assemble(expected);

        CalculationResult<ShieldMetrics> result = BuildMetrics.Of(build).ShieldMetricsResult();

        if (expected.Metrics.ShieldsPowered == false)
        {
            Assert.False(result.Complete);

            // The generator is shed rather than absent, so the arithmetic is pinned against a
            // plant with capacity enough to keep every band lit.
            ShipLoadout lit = Assemble(expected);
            OutfittingModule plant = lit.FittedModuleAt("PowerPlant")!.Stats!;
            lit.SetModule(
                "PowerPlant",
                plant with { Stats = plant.Stats.With(ModuleStat.PowerCapacity, 1_000_000) });
            result = BuildMetrics.Of(lit).ShieldMetricsResult();
        }

        if (expected.Metrics.Shields is not CorpusDefence shields)
        {
            Assert.False(result.Complete);
            return;
        }

        Assert.True(result.Complete);
        Close(shields.Strength!.Value, result.Value.Strength, $"{id} shield strength");
        AssertResistances(shields.Resistances, result.Value.Resistances, $"{id} shields");
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void ABuildCarriesTheArmourTheCorpusPins(string id)
    {
        BuildCorpusBuild expected = Read(id);

        ArmourMetrics armour = BuildMetrics.Of(Assemble(expected)).ArmourMetrics();

        Close(expected.Metrics.Armour.HitPoints!.Value, armour.HitPoints, $"{id} hull points");
        AssertResistances(expected.Metrics.Armour.Resistances, armour.Resistances, $"{id} armour");
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void ABuildCarriesTheFirepowerTheCorpusPins(string id)
    {
        BuildCorpusBuild expected = Read(id);

        BuildWeaponMetrics weapons = BuildMetrics.Of(Assemble(expected)).WeaponMetrics();

        Assert.Equal(expected.Metrics.Weapons.Count, weapons.Weapons.Count);
        Close(
            expected.Metrics.Weapons.DamagePerSecond,
            weapons.Total.DamagePerSecond,
            $"{id} damage per second");
        Close(
            expected.Metrics.Weapons.SustainedDamagePerSecond,
            weapons.Total.SustainedDamagePerSecond,
            $"{id} sustained damage per second");
    }

    private static void AssertResistances(
        CorpusResistances expected,
        DamageTypeValues actual,
        string what)
    {
        Close(expected.Kinetic, actual.Kinetic, $"{what} kinetic");
        Close(expected.Thermal, actual.Thermal, $"{what} thermal");
        Close(expected.Explosive, actual.Explosive, $"{what} explosive");
    }
}
