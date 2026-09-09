using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The exact damage amounts a round carries, after engineering moves the total.</summary>
/// <remarks>
/// A weapon that states exact amounts states them for its stock round. Engineering moves the
/// total damage, and each amount follows in the same proportion. Anti-Xeno damage stays an
/// overlay on the conventional amounts rather than a share of them, so it scales with the rest
/// while never joining the total.
/// </remarks>
public class DamageComponentScalingTests
{
    private static readonly DamageComponentScalingFixture Fixture =
        SharedFixtures.Load<EngineeringFixture>("fixtures/ships/engineering.jsonc")
            .DamageComponentScaling;

    public static TheoryData<string> Weapons()
    {
        TheoryData<string> symbols = [];
        foreach (DamageComponentCaseFixture stated in Fixture.Cases) symbols.Add(stated.Symbol);
        return symbols;
    }

    [Fact]
    public void TheCasesCoverEveryAmountAWeaponCanState()
    {
        HashSet<string> covered = [];
        foreach (DamageComponentCaseFixture stated in Fixture.Cases)
        {
            if (stated.BaseComponents.Kinetic is not null) covered.Add("kinetic");
            if (stated.BaseComponents.Thermal is not null) covered.Add("thermal");
            if (stated.BaseComponents.Explosive is not null) covered.Add("explosive");
            if (stated.BaseComponents.Absolute is not null) covered.Add("absolute");
            if (stated.BaseComponents.AntiXeno is not null) covered.Add("antiXeno");
            if (stated.BaseComponents.Unclassified is not null) covered.Add("unclassified");
        }

        Assert.Equal(
            ["absolute", "antiXeno", "explosive", "kinetic", "thermal", "unclassified"],
            Sorted(covered));
    }

    [Theory]
    [MemberData(nameof(Weapons))]
    public void AStockWeaponCarriesTheExactAmountsTheFixtureStates(string symbol)
    {
        DamageComponentCaseFixture stated = Case(symbol);

        OutfittingModule weapon = ModuleCatalogue.FindBySymbol(symbol)!;

        Assert.Equal(stated.BaseDamage, weapon.Stats[ModuleStat.Damage]);
        AssertComponents(stated.BaseComponents, weapon.DamageComponents);
    }

    [Theory]
    [MemberData(nameof(Weapons))]
    public void AnEngineeredWeaponHoldsItsAmountsInProportionWithItsDamage(string symbol)
    {
        DamageComponentCaseFixture stated = Case(symbol);
        OutfittingModule weapon = ModuleCatalogue.FindBySymbol(symbol)!;
        LoadoutModule fitted = Engineered(stated);

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, weapon)!;
        WeaponStats firepower = LoadoutMetrics.WeaponStatsFor(fitted, weapon)!;

        Assert.Equal(stated.EffectiveDamage, effective.Stats[ModuleStat.Damage]);
        Assert.Equal(stated.EffectiveDamage, firepower.Damage);
        AssertComponents(stated.ExpectedComponents, effective.DamageComponents);
        AssertComponents(stated.ExpectedComponents, firepower.DamageComponents);
    }

    [Theory]
    [MemberData(nameof(Weapons))]
    public void ABuildPublishesTheScaledAmountsOnTheWeaponItFitted(string symbol)
    {
        DamageComponentCaseFixture stated = Case(symbol);
        ShipLoadout build = ShipLoadout.FromLoadout(
            new LoadoutEvent("CobraMkIII", [Engineered(stated)]));

        OutfittingModule effective =
            build.FittedModuleAt("MediumHardpoint1")!.EffectiveStats!;

        Assert.Equal(stated.EffectiveDamage, effective.Stats[ModuleStat.Damage]);
        AssertComponents(stated.ExpectedComponents, effective.DamageComponents);
    }

    /// <summary>The weapon fitted with one recipe that states the damage move and nothing else.</summary>
    private static LoadoutModule Engineered(DamageComponentCaseFixture stated) =>
        new("MediumHardpoint1", stated.Symbol)
        {
            Engineering = new ModuleEngineering("Test", 1, 1)
            {
                Modifiers =
                [
                    new EngineeringModifier(
                        "Damage",
                        Value: stated.EffectiveDamage,
                        OriginalValue: stated.BaseDamage),
                ],
            },
        };

    private static void AssertComponents(
        DamageComponentsFixture expected, DamageComponents? carried)
    {
        Assert.NotNull(carried);
        Assert.Equal(expected.Kinetic, carried.Kinetic);
        Assert.Equal(expected.Thermal, carried.Thermal);
        Assert.Equal(expected.Explosive, carried.Explosive);
        Assert.Equal(expected.Absolute, carried.Absolute);
        Assert.Equal(expected.AntiXeno, carried.AntiXeno);
        Assert.Equal(expected.Unclassified, carried.Unclassified);
    }

    private static DamageComponentCaseFixture Case(string symbol)
    {
        foreach (DamageComponentCaseFixture stated in Fixture.Cases)
        {
            if (stated.Symbol == symbol) return stated;
        }

        Assert.Fail($"The fixture states no case for {symbol}.");
        return null!;
    }

    private static List<string> Sorted(HashSet<string> names)
    {
        List<string> sorted = [.. names];
        sorted.Sort(StringComparer.Ordinal);
        return sorted;
    }
}
