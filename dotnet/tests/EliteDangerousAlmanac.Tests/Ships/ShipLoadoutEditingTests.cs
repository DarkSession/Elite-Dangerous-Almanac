using System;
using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The edits a build accepts, refuses and reads back.</summary>
public class ShipLoadoutEditingTests
{
    private static readonly OperationsFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc");

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static OutfittingModule Article(string symbol) =>
        ModuleCatalogue.FindBySymbol(symbol)
        ?? throw new InvalidOperationException($"The catalogue carries no module {symbol}.");

    private static ShipLoadout Read(JsonElement capture) =>
        ShipLoadout.FromLoadout(capture.Deserialize<LoadoutEvent>(JournalOptions)!);

    private static T Named<T>(string value)
        where T : struct, Enum => Enum.Parse<T>(value, ignoreCase: true);

    private static void AssertRefusal(
        LoadoutEditException refusal,
        EditorErrorExpectationFixture expected)
    {
        Assert.Equal(Named<LoadoutEditErrorCode>(expected.Code), refusal.Code);
        if (expected.Constraint is string constraint)
        {
            Assert.Equal(Named<ModuleFitConstraint>(constraint), refusal.Constraint);
        }

        EditorErrorParamsFixture wanted = expected.Params;
        if (wanted.Slot is string slot) Assert.Equal(slot, refusal.Slot);
        if (wanted.Symbol is string symbol) Assert.Equal(symbol, refusal.Issue!.Symbol);
        if (wanted.PreviousSlot is string previousSlot)
        {
            Assert.Equal(previousSlot, refusal.Issue!.PreviousSlot);
        }

        if (wanted.PreviousSymbol is string previousSymbol)
        {
            Assert.Equal(previousSymbol, refusal.Issue!.PreviousSymbol);
        }

        if (wanted.ExclusionGroup is string exclusion)
        {
            Assert.Equal(Named<ModuleExclusionGroup>(exclusion), refusal.Issue!.ExclusionGroup);
        }

        if (wanted.Group is string group)
        {
            Assert.Equal(Named<ModuleLimitGroup>(group), refusal.Issue!.LimitGroup);
        }

        if (wanted.Count is int count) Assert.Equal(count, refusal.Issue!.Count);
        if (wanted.Limit is int limit) Assert.Equal(limit, refusal.Issue!.Limit);
        if (wanted.ModuleClass is int moduleClass)
        {
            Assert.Equal(moduleClass, refusal.Issue!.Fit!.ModuleClass);
        }

        if (wanted.SlotSize is int slotSize) Assert.Equal(slotSize, refusal.Issue!.Fit!.SlotSize);
        if (wanted.ArmourShipName is string armourShip)
        {
            Assert.Equal(armourShip, refusal.Issue!.Fit!.ArmourShipName);
        }

        if (wanted.ArmourShipSymbol is string armourSymbol)
        {
            Assert.Equal(armourSymbol, refusal.Issue!.Fit!.ArmourShipSymbol);
        }

        if (wanted.ShipSymbol is string ship) Assert.Equal(ship, refusal.Issue!.Fit!.ShipSymbol);
        if (wanted.ShipName is string shipName)
        {
            Assert.Equal(shipName, refusal.Issue!.Fit!.ShipName);
        }
    }

    [Fact]
    public void AMountRefusesAModuleTooLargeForIt()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.IncompatibleModule;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.SetModule(expected.Slot, Article(expected.Module)));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void NoMountTakesTheCargoHatchTheHullAlreadyCarries()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.BuiltInHullModule;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.SetModule(expected.Slot, Article(expected.Module)));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void AHullTakesNoOtherHullsArmour()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.WrongHullArmour;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.SetModule(expected.Slot, Article(expected.Module)));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void AShipCarriesOneArticleOfAnExclusiveFamily()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.DuplicateExclusiveModule;

        // A stock hull already carries a shield generator, so the pair goes on a bare one.
        ShipLoadout build = ShipLoadout.Empty(expected.Ship);
        build.SetModule(expected.FirstSlot, Article(expected.Module));

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.SetModule(expected.SecondSlot, Article(expected.Module)));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void AShipCarriesNoMoreLimitedArticlesThanItsAllowance()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.ModuleLimitExceeded;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);
        foreach (string slot in expected.FittedSlots)
        {
            build.SetModule(slot, Article(expected.Module));
        }

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.SetModule(expected.TargetSlot, Article(expected.Module)));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void NoEditEmptiesTheCargoHatch()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.ImmutableSlot;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.RemoveModule(expected.Slot));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void NoEditPutsAnotherArticleInTheCargoHatch()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.ImmutableSlotReplacement;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.SetModule(expected.Slot, Article(expected.Module)));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void NoEditEmptiesAMountAnOperationalBuildKeepsFilled()
    {
        EditorErrorCaseFixture expected = Fixture.EditorErrors.RequiredSlot;
        ShipLoadout build = Read(expected.Input!.Value);

        LoadoutEditException refusal = Assert.Throws<LoadoutEditException>(
            () => build.RemoveModule(expected.Slot));

        AssertRefusal(refusal, expected.Expected);
    }

    [Fact]
    public void AStockHullReportsWhyEachHeldMountCannotBeEmptied()
    {
        ShipLoadout build = ShipLoadout.Default(Fixture.SlotRemoval.Ship);

        IReadOnlyList<LoadoutSlot> slots = build.Slots();

        foreach (SlotRemovalExpectationFixture expected in Fixture.SlotRemoval.Expected)
        {
            LoadoutSlot slot = Assert.Single(
                slots, candidate => candidate.Key == expected.Key);
            Assert.Equal(Named<SlotKind>(expected.Kind), slot.Kind);
            Assert.Equal(expected.Size, slot.Size);
            Assert.Equal(expected.Removable, slot.Removable);
            Assert.Equal(
                expected.ImmovableReason is null
                    ? null
                    : Named<ImmovableReason>(expected.ImmovableReason),
                slot.ImmovableReason);
        }
    }

    [Fact]
    public void AMountHoldingASpentAllowanceCannotBeEmptied()
    {
        ModuleLimitRemovalFixture expected = Fixture.ModuleLimits.Removal;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);
        build.SetModule(expected.Slot, Article(expected.Stabiliser));
        foreach (string slot in expected.WeaponSlots)
        {
            build.SetModule(slot, Article(Fixture.ModuleLimits.Catalogue.Weapon));
        }

        LoadoutSlot held = Assert.Single(
            build.Slots(), candidate => candidate.Key == expected.Expected.Key);

        Assert.Equal(expected.Expected.Removable, held.Removable);
        Assert.Equal(
            Named<ImmovableReason>(expected.Expected.ImmovableReason!), held.ImmovableReason);
        Assert.Throws<LoadoutEditException>(() => build.RemoveModule(expected.Slot));
    }

    [Fact]
    public void ACaptureNamingAnUnknownHullIsRefused()
    {
        ImportRejectionCaseFixture expected = Fixture.ImportRejections.UnknownHull;

        Assert.False(expected.Expected.Accepted);
        Assert.Throws<FormatException>(() => Read(expected.Input));
    }

    /// <summary>The captures whose stated recipe a read has to decide about.</summary>
    public static TheoryData<string> StatedRecipes() =>
    [
        nameof(StatedRecipesFixture.CraftableRecipe),
        nameof(StatedRecipesFixture.FixedArticle),
        nameof(StatedRecipesFixture.UnresolvedRecipe),
        nameof(StatedRecipesFixture.MercenaryClimb),
        nameof(StatedRecipesFixture.MercenaryPurchase),
        nameof(StatedRecipesFixture.InertModifiers),
    ];

    private static StatedRecipeCaseFixture Recipe(string name) => name switch
    {
        nameof(StatedRecipesFixture.CraftableRecipe) => Fixture.StatedRecipes.CraftableRecipe,
        nameof(StatedRecipesFixture.FixedArticle) => Fixture.StatedRecipes.FixedArticle,
        nameof(StatedRecipesFixture.UnresolvedRecipe) => Fixture.StatedRecipes.UnresolvedRecipe,
        nameof(StatedRecipesFixture.MercenaryClimb) => Fixture.StatedRecipes.MercenaryClimb,
        nameof(StatedRecipesFixture.MercenaryPurchase) => Fixture.StatedRecipes.MercenaryPurchase,
        nameof(StatedRecipesFixture.InertModifiers) => Fixture.StatedRecipes.InertModifiers,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, "No such stated recipe."),
    };

    [Theory]
    [MemberData(nameof(StatedRecipes))]
    public void AStatedRecipeIsReadIntoTheBlockTheModuleThenCarries(string name)
    {
        StatedRecipeCaseFixture recipe = Recipe(name);

        FittedModule fitted = Read(recipe.Input).FittedModuleAt(recipe.Expected.Slot)!;

        if (recipe.Expected.Modifiers is null)
        {
            Assert.Null(fitted.Engineering!.Modifiers);
            return;
        }

        Assert.Equal(
            recipe.Expected.Modifiers.Count, fitted.Engineering!.Modifiers!.Count);
        for (int index = 0; index < recipe.Expected.Modifiers.Count; index++)
        {
            EngineeringModifier expected = recipe.Expected.Modifiers[index];
            EngineeringModifier written = fitted.Engineering.Modifiers[index];
            Assert.Equal(expected.Label, written.Label);
            Assert.Equal(expected.Value, written.Value);
            Assert.Equal(expected.OriginalValue, written.OriginalValue);
        }
    }

    [Theory]
    [MemberData(nameof(StatedRecipes))]
    public void AStatedRecipeMovesTheStatsTheReadingSaysItMoves(string name)
    {
        StatedRecipeCaseFixture recipe = Recipe(name);

        FittedModule fitted = Read(recipe.Input).FittedModuleAt(recipe.Expected.Slot)!;

        foreach (KeyValuePair<string, double> stat in recipe.Expected.Stats)
        {
            Assert.Equal(
                stat.Value, fitted.EffectiveStats!.Stats[Named<ModuleStat>(stat.Key)]);
        }
    }

    [Theory]
    [MemberData(nameof(StatedRecipes))]
    public void AStatedRecipeReportsWhatTheReadingDecided(string name)
    {
        StatedRecipeCaseFixture recipe = Recipe(name);

        IReadOnlyList<LoadoutImportOutcome> outcomes = Read(recipe.Input).ImportOutcomes;

        List<LoadoutImportOutcome> engineering = [];
        foreach (LoadoutImportOutcome outcome in outcomes)
        {
            if (outcome.Action is LoadoutImportAction.Emptied or LoadoutImportAction.Defaulted)
            {
                continue;
            }

            engineering.Add(outcome);
        }

        Assert.Equal(recipe.Expected.Outcomes.Count, engineering.Count);
        for (int index = 0; index < engineering.Count; index++)
        {
            StatedRecipeOutcomeFixture expected = recipe.Expected.Outcomes[index];
            LoadoutImportOutcome written = engineering[index];
            Assert.Equal(Named<LoadoutImportAction>(expected.Action), written.Action);
            Assert.Equal(expected.Slot, written.Slot);

            switch (written)
            {
                case EngineeringUnresolved unresolved:
                    Assert.Equal(expected.SourceSymbol, unresolved.SourceSymbol);
                    Assert.Equal(expected.BlueprintSymbol, unresolved.BlueprintSymbol);
                    break;
                case EngineeringRerolled rerolled:
                    Assert.Equal(expected.SourceSymbol, rerolled.SourceSymbol);
                    Assert.Equal(expected.BlueprintSymbol, rerolled.BlueprintSymbol);
                    break;
                case EngineeringAmbiguous ambiguous:
                    Assert.Equal(expected.SourceSymbol, ambiguous.SourceSymbol);
                    Assert.Equal(expected.BlueprintSymbol, ambiguous.BlueprintSymbol);
                    PreEngineeredArticleFixture article = expected.PreEngineeredVariant!;
                    Assert.Equal(article.Symbol, ambiguous.PreEngineeredVariant.Symbol);
                    Assert.Equal(
                        article.BlueprintSymbol, ambiguous.PreEngineeredVariant.BlueprintSymbol);
                    Assert.Equal(article.Grade, ambiguous.PreEngineeredVariant.Grade);
                    Assert.Equal(
                        Named<PreEngineeredAcquisition>(article.Acquisition),
                        ambiguous.PreEngineeredVariant.Acquisition);
                    break;
                default:
                    throw new InvalidOperationException("No such engineering outcome.");
            }
        }
    }
}
