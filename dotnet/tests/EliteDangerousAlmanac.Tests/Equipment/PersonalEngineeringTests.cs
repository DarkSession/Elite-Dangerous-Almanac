using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Equipment;

/// <summary>What a modification does to a stat, and what climbing a grade ladder costs.</summary>
public sealed class PersonalEngineeringTests
{
    private static readonly EquipmentFixture Fixture =
        SharedFixtures.Load<EquipmentFixture>("fixtures/equipment/equipment.jsonc");

    public static TheoryData<int> ModifierCases => Indices(Fixture.Modifiers.Count);

    public static TheoryData<int> MetricsCases => Indices(Fixture.WeaponMetrics.Count);

    public static TheoryData<int> EngineeredCases => Indices(Fixture.EngineeredWeaponMetrics.Count);

    [Theory]
    [MemberData(nameof(ModifierCases))]
    public void OneRecipeMovesTheStatItNames(int index)
    {
        ModifierFixture expected = Fixture.Modifiers[index];
        PersonalModification recipe = Assert.IsType<PersonalModification>(
            PersonalModificationCatalogue.Find(expected.RecipeSymbol));

        double modified = PersonalEngineering.ApplyModifiers(
            expected.Stat, expected.Base, recipe.Modifiers);

        Assert.Equal(expected.Modified, modified, 1e-9);
    }

    [Fact]
    public void ARecipeLeavesEveryStatItDoesNotNameAlone()
    {
        PersonalModification recipe = Assert.IsType<PersonalModification>(
            PersonalModificationCatalogue.Find("weapon_clipsize"));

        Assert.Equal(70, PersonalEngineering.ApplyModifiers("effectiveRange", 70, recipe.Modifiers));
        Assert.Equal(45, PersonalEngineering.ApplyModifiers("magazineSize", 45, []));
    }

    [Fact]
    public void ARecipeOnAResistanceActsOnTheDamageThatGetsThrough()
    {
        PersonalModification recipe = Assert.IsType<PersonalModification>(
            PersonalModificationCatalogue.Find("suit_improvedarmourrating"));

        // A negative resistance takes more damage, and the recipe still lowers what gets
        // through, so the figure climbs towards zero rather than away from it.
        Assert.True(
            PersonalEngineering.ApplyModifiers("armourKineticResistance", -0.6, recipe.Modifiers)
            > -0.6);
    }

    [Fact]
    public void ARecipeBoughtForItsUnlockAloneStatesNoStatChange()
    {
        foreach (string symbol in Fixture.ModificationsWithoutModifiers)
        {
            PersonalModification recipe = Assert.IsType<PersonalModification>(
                PersonalModificationCatalogue.Find(symbol));
            Assert.Empty(recipe.Modifiers);
        }
    }

    [Fact]
    public void TheSuitRecipeThatSavesBatteryActsOnEveryToolTheSuitCarries()
    {
        ToolDrainFixture expected = Fixture.ToolDrain;
        PersonalModification recipe = Assert.IsType<PersonalModification>(
            PersonalModificationCatalogue.Find(expected.RecipeSymbol));
        PersonalTool cutter = Assert.IsType<PersonalTool>(
            PersonalToolCatalogue.FindById("arc-cutter"));
        PersonalTool energylink = Assert.IsType<PersonalTool>(
            PersonalToolCatalogue.FindById("energylink"));

        PersonalModifier modifier = Assert.Single(recipe.Modifiers);

        Assert.Equal(expected.Stat, modifier.Stat);
        Assert.Equal(expected.Multiplier, modifier.Multiplier);
        Assert.Equal(
            expected.ArcCutterPowerUsage,
            cutter.PowerUsage!.Value * modifier.Multiplier,
            1e-9);
        Assert.Equal(
            expected.EnergylinkOverloadPowerUsage,
            energylink.OverloadPowerUsage!.Value * modifier.Multiplier,
            1e-9);
    }

    [Theory]
    [MemberData(nameof(MetricsCases))]
    public void AStockWeaponDealsWhatTheFixtureQuotes(int index)
    {
        WeaponMetricsFixture expected = Fixture.WeaponMetrics[index];
        PersonalWeapon weapon = Assert.IsType<PersonalWeapon>(
            PersonalWeaponCatalogue.FindBySymbol(expected.Symbol));

        PersonalWeaponMetrics metrics = Assert.IsType<PersonalWeaponMetrics>(
            PersonalWeaponCatalogue.Metrics(weapon, expected.Grade));

        Assert.Equal(expected.Name, weapon.Name);
        Assert.Equal(expected.DamagePerShot, metrics.DamagePerShot, 1e-3);
        Assert.Equal(expected.HeadshotDamagePerShot, metrics.HeadshotDamagePerShot, 1e-3);
        Assert.Equal(expected.RateOfFire, metrics.RateOfFire);
        Assert.Equal(expected.SustainedRateOfFire, metrics.SustainedRateOfFire, 1e-3);
        Assert.Equal(expected.DamagePerSecond, metrics.DamagePerSecond, 1e-3);
        Assert.Equal(expected.SustainedDamagePerSecond, metrics.SustainedDamagePerSecond, 1e-3);
    }

    [Theory]
    [MemberData(nameof(EngineeredCases))]
    public void AnEngineeredWeaponDealsWhatItsRecipeBuysIt(int index)
    {
        EngineeredWeaponMetricsFixture expected = Fixture.EngineeredWeaponMetrics[index];
        PersonalWeapon weapon = Assert.IsType<PersonalWeapon>(
            PersonalWeaponCatalogue.FindBySymbol(expected.Symbol));
        PersonalModification recipe = Assert.IsType<PersonalModification>(
            PersonalModificationCatalogue.Find(expected.RecipeSymbol));

        PersonalWeaponMetrics metrics = Assert.IsType<PersonalWeaponMetrics>(
            PersonalWeaponCatalogue.Metrics(weapon, expected.Grade, recipe.Modifiers));

        Assert.Equal(expected.DamagePerShot, metrics.DamagePerShot, 1e-3);
        Assert.Equal(expected.HeadshotDamagePerShot, metrics.HeadshotDamagePerShot, 1e-3);
        Assert.Equal(expected.SustainedDamagePerSecond, metrics.SustainedDamagePerSecond, 1e-3);
    }

    [Fact]
    public void TheReloadModificationShortensTheCycleRatherThanTheShot()
    {
        PersonalWeapon weapon = Assert.IsType<PersonalWeapon>(
            PersonalWeaponCatalogue.FindBySymbol("wpn_m_assaultrifle_kinetic_fauto"));

        PersonalWeaponMetrics stock = PersonalWeaponCatalogue.Metrics(weapon, 5)!;
        PersonalWeaponMetrics quick = PersonalWeaponCatalogue.Metrics(
            weapon, 5, modifiers: null, reloadSpeed: true)!;

        Assert.Equal(stock.DamagePerShot, quick.DamagePerShot);
        Assert.Equal(stock.DamagePerSecond, quick.DamagePerSecond);
        Assert.True(quick.SustainedDamagePerSecond > stock.SustainedDamagePerSecond);
    }

    [Fact]
    public void OneStepAndTheWholeClimbCostWhatTheFixtureQuotes()
    {
        UpgradeCostsFixture expected = Fixture.UpgradeCosts;

        IReadOnlyList<PersonalEngineeringIngredient> step =
            Assert.IsAssignableFrom<IReadOnlyList<PersonalEngineeringIngredient>>(
                PersonalUpgradeCosts.SuitStep("utilitysuit", 2));

        Assert.Equal(expected.MaverickGrade2.Count, step.Count);
        for (int index = 0; index < step.Count; index++)
        {
            Assert.Equal(expected.MaverickGrade2[index].Symbol, step[index].Symbol);
            Assert.Equal(expected.MaverickGrade2[index].Count, step[index].Count);
        }

        Assert.Equal(
            expected.MaverickGrade1To3Graphene,
            Count(PersonalUpgradeCosts.Suit("utilitysuit", 3)!, "graphene"));
        Assert.Equal(
            expected.Ar50Grade5WeaponComponents,
            Count(
                PersonalUpgradeCosts.WeaponStep("wpn_m_assaultrifle_kinetic_fauto", 5)!,
                "weaponcomponent"));
    }

    [Fact]
    public void AClimbToAGradeAlreadyOwnedCostsNothing()
    {
        Assert.Empty(PersonalUpgradeCosts.Suit("utilitysuit", 3, 3)!);
        Assert.Empty(PersonalUpgradeCosts.Suit("utilitysuit", 2, 5)!);
    }

    [Fact]
    public void NoCostIsQuotedForAnArticleNoCatalogueCarries()
    {
        Assert.Null(PersonalUpgradeCosts.SuitStep("notasuit", 2));
        Assert.Null(PersonalUpgradeCosts.Suit("notasuit", 5));
        Assert.Null(PersonalUpgradeCosts.WeaponStep("notaweapon", 2));
        Assert.Null(PersonalUpgradeCosts.Weapon("notaweapon", 5));
    }

    [Fact]
    public void NoCostIsQuotedForAStepOutsideTheLadder()
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => PersonalUpgradeCosts.SuitStep("utilitysuit", 1));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => PersonalUpgradeCosts.WeaponStep("wpn_s_pistol_kinetic_sauto", 6));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => PersonalUpgradeCosts.Suit("utilitysuit", 5, 0));
    }

    [Fact]
    public void AddedRecipesKeepOneEntryForEachMaterial()
    {
        IReadOnlyList<PersonalEngineeringIngredient> first = [new("Graphene", 2), new("Tungsten", 1)];
        IReadOnlyList<PersonalEngineeringIngredient> second = [new("graphene", 3)];

        IReadOnlyList<PersonalEngineeringIngredient> summed =
            PersonalEngineering.SumIngredients(first, second);

        Assert.Equal(2, summed.Count);
        Assert.Equal("Graphene", summed[0].Symbol);
        Assert.Equal(5, summed[0].Count);
        Assert.Equal("Tungsten", summed[1].Symbol);
    }

    [Fact]
    public void NoStatIsComputedFromAFigureThatIsNotFinite()
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => PersonalEngineering.ApplyModifiers("magazineSize", double.NaN, []));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => PersonalEngineering.ApplyModifiers("magazineSize", double.PositiveInfinity, []));
        Assert.Throws<ArgumentNullException>(
            () => PersonalEngineering.ApplyModifiers(null!, 1, []));
    }

    [Fact]
    public void OneJournalSpellingNamesARecipeInEachWeaponMenu()
    {
        ModificationSpellingFixture expected = Fixture.Modification;

        string kinetic = ModificationJournal.ResolveForWeapon(
            "wpn_s_pistol_kinetic_sauto", expected.JournalSymbol);
        string laser = ModificationJournal.ResolveForWeapon(
            "wpn_s_pistol_laser_sauto", expected.JournalSymbol);

        Assert.Equal(expected.KineticRecipeSymbol, kinetic);
        Assert.Equal(expected.LaserRecipeSymbol, laser);
        Assert.Equal(
            expected.KineticFirstIngredient.Symbol,
            PersonalModificationCatalogue.FindCost(kinetic)![0].Symbol);
        Assert.Equal(
            expected.KineticFirstIngredient.Count,
            PersonalModificationCatalogue.FindCost(kinetic)![0].Count);
        Assert.Equal(
            expected.LaserFirstIngredient.Symbol,
            PersonalModificationCatalogue.FindCost(laser)![0].Symbol);
        Assert.Equal(
            expected.LaserFirstIngredient.Count,
            PersonalModificationCatalogue.FindCost(laser)![0].Count);
    }

    [Fact]
    public void AJournalSpellingStaysAsWrittenWhereNoWeaponResolvesIt()
    {
        Assert.Equal(
            "weapon_range", ModificationJournal.ResolveForWeapon("notaweapon", "weapon_range"));
        Assert.Equal(
            "weapon_scope",
            ModificationJournal.ResolveForWeapon("wpn_s_pistol_kinetic_sauto", "weapon_scope"));
        Assert.Throws<ArgumentNullException>(
            () => ModificationJournal.ResolveForWeapon("wpn_s_pistol_kinetic_sauto", null!));
    }

    private static int Count(IReadOnlyList<PersonalEngineeringIngredient> cost, string symbol)
    {
        foreach (PersonalEngineeringIngredient ingredient in cost)
        {
            if (string.Equals(ingredient.Symbol, symbol, StringComparison.OrdinalIgnoreCase))
            {
                return ingredient.Count;
            }
        }

        return 0;
    }

    private static TheoryData<int> Indices(int count)
    {
        TheoryData<int> cases = [];
        for (int index = 0; index < count; index++) cases.Add(index);
        return cases;
    }
}
