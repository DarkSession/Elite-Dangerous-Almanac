using System;
using EliteDangerousAlmanac.Ships;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>A hull's armour: its hit points, and what it resists.</summary>
public class ArmourTests
{
    [Fact]
    public void TheBulkheadMultipliesTheHullAndEachPackageAddsToIt()
    {
        // An Anaconda under reactive surface composite, with one hull reinforcement package.
        ArmourMetrics hull = Armour.Metrics(new ArmourInput(
            525,
            new BulkheadParams(2.5, new DamageTypeValues(Kinetic: 0.25)),
            [new HullReinforcementParams(390, Resistances: new DamageTypeValues(Kinetic: 0.025))]));

        Assert.Equal(1837.5, hull.Bulkheads, 1e-9);
        Assert.Equal(390, hull.Reinforcement, 1e-9);
        Assert.Equal(2227.5, hull.HitPoints, 1e-9);
        Assert.Equal(
            Resistances.StackArmourResistance(0.25, [0.025]),
            hull.Resistances.Kinetic,
            1e-12);
    }

    [Fact]
    public void AWeakBulkheadSoaksLessThanItsHitPointsSuggest()
    {
        ArmourMetrics hull = Armour.Metrics(new ArmourInput(
            525,
            new BulkheadParams(0.8, new DamageTypeValues(Kinetic: -0.2, Explosive: -0.4))));

        Assert.Equal(945, hull.HitPoints, 1e-9);
        Assert.Equal(-0.2, hull.Resistances.Kinetic, 1e-12);
        Assert.Equal(787.5, hull.EffectiveHitPoints.Kinetic, 1e-9);
        Assert.Equal(675, hull.EffectiveHitPoints.Explosive, 1e-9);
    }

    [Fact]
    public void AnEngineeredPackageAddsAShareOfTheHullsOwnArmour()
    {
        // A stock package has no hull boost, so this only happens on an engineered one.
        ArmourMetrics hull = Armour.Metrics(new ArmourInput(
            525,
            new BulkheadParams(0.8),
            [new HullReinforcementParams(390, 0.24)]));

        Assert.Equal(390 + (525 * 0.24), hull.Reinforcement, 1e-9);
    }

    [Fact]
    public void ModuleReinforcementProtectsTheModulesRatherThanTheHull()
    {
        ArmourMetrics hull = Armour.Metrics(new ArmourInput(
            525,
            new BulkheadParams(0.8),
            ModuleReinforcements:
            [
                new ModuleReinforcementParams(0.3, 64),
                new ModuleReinforcementParams(0.3, 64),
            ]));

        Assert.Equal(945, hull.HitPoints, 1e-9);
        Assert.Equal(128, hull.ModuleArmour, 1e-9);

        // The packages stack multiplicatively, so two thirty percent packages absorb 51 percent.
        Assert.Equal(0.51, hull.ModuleProtection, 1e-9);
    }

    [Fact]
    public void AHullWithNoBulkheadReportsItsBareArmour()
    {
        ArmourMetrics bare = Armour.Metrics(new ArmourInput(525));

        Assert.Equal(525, bare.HitPoints, 1e-9);
        Assert.Equal(0, bare.Reinforcement);
        Assert.Equal(0, bare.ModuleArmour);
        Assert.Equal(0, bare.ModuleProtection);
        Assert.Equal(DamageTypeValues.None, bare.Resistances);
        Assert.Throws<ArgumentNullException>(() => Armour.Metrics(null!));
    }
}
