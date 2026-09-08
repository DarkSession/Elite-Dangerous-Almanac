using System;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>How resistances stack, measured against the shared fixture.</summary>
public class ResistancesTests
{
    private static readonly MetricFunctionsFixture Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc").Functions;

    /// <summary>The precision the fixture states a resistance to.</summary>
    private const double Tolerance = 5e-7;

    public static TheoryData<int> ShieldStacks() => Positions(Fixture.StackShieldResistance.Count);

    public static TheoryData<int> ArmourStacks() => Positions(Fixture.StackArmourResistance.Count);

    public static TheoryData<int> Allocations() => Positions(Fixture.SystemsResistance.Count);

    [Theory]
    [MemberData(nameof(ShieldStacks))]
    public void AShieldStackResistsTheFixturesShare(int position)
    {
        ShieldResistanceCaseFixture stack = Fixture.StackShieldResistance[position];

        Assert.Equal(
            stack.Expected,
            Resistances.StackShieldResistance(stack.Generator, stack.Boosters),
            Tolerance);
    }

    [Theory]
    [MemberData(nameof(ArmourStacks))]
    public void AHullStackResistsTheFixturesShare(int position)
    {
        ArmourResistanceCaseFixture stack = Fixture.StackArmourResistance[position];

        Assert.Equal(
            stack.Expected,
            Resistances.StackArmourResistance(stack.Bulkhead, stack.Reinforcements),
            Tolerance);
    }

    [Theory]
    [MemberData(nameof(Allocations))]
    public void PipsToSystemsBuyTheFixturesResistance(int position)
    {
        SystemsResistanceCaseFixture allocation = Fixture.SystemsResistance[position];

        Assert.Equal(
            allocation.Expected,
            Resistances.SystemsResistance(allocation.Pips),
            Tolerance);
    }

    [Fact]
    public void ABoosterlessStackIsTheGeneratorsOwnResistance()
    {
        Assert.Equal(0.4, Resistances.StackShieldResistance(0.4), Tolerance);
        Assert.Equal(0.4, Resistances.StackShieldResistance(0.4, null), Tolerance);
        Assert.Equal(0.25, Resistances.StackArmourResistance(0.25), Tolerance);
    }

    [Fact]
    public void APoolSoaksLessOfTheDamageItIsWeakTo()
    {
        DamageTypeValues resistances = new(Kinetic: -0.2, Explosive: -0.4);
        DamageTypeValues soaked = Resistances.EffectiveHitPoints(945, resistances);

        Assert.Equal(787.5, soaked.Kinetic, 1e-9);
        Assert.Equal(945, soaked.Thermal, 1e-9);
        Assert.Equal(675, soaked.Explosive, 1e-9);

        // Nothing of a fully resisted type gets through.
        Assert.Equal(
            double.PositiveInfinity,
            Resistances.EffectiveHitPoints(945, new DamageTypeValues(Kinetic: 1)).Kinetic);
    }

    [Fact]
    public void EveryDamageTypeIsReadable()
    {
        DamageTypeValues values = new(1, 2, 3, 4);

        Assert.Equal(1, values[DamageType.Kinetic]);
        Assert.Equal(2, values[DamageType.Thermal]);
        Assert.Equal(3, values[DamageType.Explosive]);
        Assert.Equal(4, values[DamageType.Caustic]);
        Assert.Throws<ArgumentOutOfRangeException>(() => values[(DamageType)99]);
        Assert.Equal(new DamageTypeValues(), DamageTypeValues.None);
        Assert.Equal(values, Resistances.MapDamageTypes(type => values[type]));
    }

    [Fact]
    public void AnAllocationOutsideTheCapacitorIsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Resistances.SystemsResistance(-0.1));
        Assert.Throws<ArgumentOutOfRangeException>(() => Resistances.SystemsResistance(4.1));
        Assert.Throws<ArgumentOutOfRangeException>(() => Resistances.SystemsResistance(double.NaN));
        Assert.Throws<ArgumentNullException>(() => Resistances.MapDamageTypes(null!));
        Assert.Throws<ArgumentNullException>(() => Resistances.EffectiveHitPoints(1, null!));
    }

    private static TheoryData<int> Positions(int count)
    {
        TheoryData<int> data = [];
        for (int position = 0; position < count; position++) data.Add(position);
        return data;
    }
}
