using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The engineering a build applies to what it holds.</summary>
public class ShipLoadoutEngineeringTests
{
    private const string LongRange = "FSD_LongRange";
    private const string MassManager = "special_fsd_heavy";

    private static ShipLoadout Stock() => ShipLoadout.Default("SideWinder");

    private static ModuleEngineering EngineeringAt(ShipLoadout build, string slot) =>
        build.FittedModuleAt(slot)!.Engineering!;

    private static double OptimalMass(ShipLoadout build, string slot) =>
        build.FittedModuleAt(slot)!.EffectiveStats!.Stats[ModuleStat.OptMass]!.Value;

    [Fact]
    public void ARolledRecipeStatesTheGradeTheQualityAndEveryStatItMoves()
    {
        ShipLoadout build = Stock();
        double stock = OptimalMass(build, "FrameShiftDrive");

        build.ApplyBlueprint("FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5));

        ModuleEngineering engineering = EngineeringAt(build, "FrameShiftDrive");
        Assert.Equal(LongRange, engineering.BlueprintName);
        Assert.Equal(5, engineering.Level);
        Assert.Equal(1, engineering.Quality);
        Assert.Null(engineering.ExperimentalEffect);
        Assert.NotEmpty(engineering.Modifiers!);
        Assert.True(OptimalMass(build, "FrameShiftDrive") > stock);
    }

    [Fact]
    public void ALesserQualityRollMovesAStatLessFarThanTheBestOne()
    {
        ShipLoadout best = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5));
        ShipLoadout part = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5, 0.25));

        Assert.True(OptimalMass(part, "FrameShiftDrive") < OptimalMass(best, "FrameShiftDrive"));
        Assert.Equal(0.25, EngineeringAt(part, "FrameShiftDrive").Quality);
    }

    [Fact]
    public void AnExperimentalEffectRollsBesideTheRecipe()
    {
        ShipLoadout plain = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5));
        ShipLoadout composed = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5, 1, MassManager));

        Assert.Equal(MassManager, EngineeringAt(composed, "FrameShiftDrive").ExperimentalEffect);
        Assert.NotEqual(
            OptimalMass(plain, "FrameShiftDrive"), OptimalMass(composed, "FrameShiftDrive"));
    }

    [Fact]
    public void ARecipeReachesNoEmptyMount()
    {
        ShipLoadout build = ShipLoadout.Empty("SideWinder");

        Assert.Throws<ArgumentOutOfRangeException>(
            () => build.ApplyBlueprint("SmallHardpoint1", LongRange, new ApplyBlueprintOptions(1)));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void ARecipeHasNoGradeOutsideTheFive(int grade)
    {
        ShipLoadout build = Stock();

        Assert.Throws<ArgumentOutOfRangeException>(
            () => build.ApplyBlueprint(
                "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(grade)));
    }

    [Theory]
    [InlineData(-0.5)]
    [InlineData(1.5)]
    [InlineData(double.NaN)]
    public void AQualityIsARollFromZeroThroughOne(double quality)
    {
        ShipLoadout build = Stock();

        Assert.Throws<ArgumentOutOfRangeException>(
            () => build.ApplyBlueprint(
                "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5, quality)));
    }

    [Fact]
    public void AModuleTakesNoRecipeItsOwnMenuDoesNotOffer()
    {
        ShipLoadout build = Stock();

        ArgumentException refusal = Assert.Throws<ArgumentException>(
            () => build.ApplyBlueprint(
                "FrameShiftDrive", "Engine_Dirty", new ApplyBlueprintOptions(5)));

        Assert.Contains("Engine_Dirty", refusal.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void NoCatalogueAnswersForAnInventedRecipe()
    {
        ShipLoadout build = Stock();

        Assert.Throws<ArgumentOutOfRangeException>(
            () => build.ApplyBlueprint(
                "FrameShiftDrive", "FSD_FutureRecipe", new ApplyBlueprintOptions(5)));
    }

    [Fact]
    public void NoCatalogueAnswersForAnInventedExperimentalEffect()
    {
        ShipLoadout build = Stock();

        Assert.Throws<ArgumentOutOfRangeException>(
            () => build.ApplyBlueprint(
                "FrameShiftDrive",
                LongRange,
                new ApplyBlueprintOptions(5, 1, "special_future_effect")));
    }

    [Fact]
    public void AModuleTakesNoExperimentalEffectItsOwnMenuDoesNotOffer()
    {
        ShipLoadout build = Stock();

        Assert.Throws<ArgumentException>(
            () => build.ApplyBlueprint(
                "FrameShiftDrive",
                LongRange,
                new ApplyBlueprintOptions(5, 1, "special_engine_overloaded")));
    }

    [Fact]
    public void EveryRecipeAMountsModuleOffersIsListedWithItsGrades()
    {
        IReadOnlyList<AvailableBlueprint> offered = Stock().AvailableBlueprints("FrameShiftDrive");

        AvailableBlueprint range = Assert.Single(
            offered, candidate => candidate.BlueprintSymbol == LongRange);
        Assert.Equal(BlueprintRoute.Ordinary, range.Route);
        Assert.NotEmpty(range.Grades);
    }

    [Fact]
    public void EveryExperimentalEffectAMountsModuleOffersIsListed()
    {
        IReadOnlyList<string> offered = Stock().AvailableExperimentalEffects("FrameShiftDrive");

        Assert.Contains(MassManager, offered);
    }

    [Fact]
    public void AnEffectOnlyEditRecomputesTheRecipeTheModuleAlreadyStates()
    {
        ShipLoadout build = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5, 0.5));

        ExperimentalEffectEdit edit = build.SetExperimentalEffect("FrameShiftDrive", MassManager);

        Assert.Equal(EngineeringEditKind.Updated, edit.Kind);
        Assert.Equal(MassManager, edit.ExperimentalEffectSymbol);
        Assert.Null(edit.PreviousExperimentalEffectSymbol);

        ModuleEngineering engineering = EngineeringAt(build, "FrameShiftDrive");
        Assert.Equal(MassManager, engineering.ExperimentalEffect);
        Assert.Equal(5, engineering.Level);
        Assert.Equal(0.5, engineering.Quality);
    }

    [Fact]
    public void AnEffectOnlyEditRemovesTheEffectAndKeepsTheRecipe()
    {
        ShipLoadout build = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5, 1, MassManager));

        ExperimentalEffectEdit edit = build.SetExperimentalEffect("FrameShiftDrive", null);

        Assert.Equal(EngineeringEditKind.Updated, edit.Kind);
        Assert.Equal(MassManager, edit.PreviousExperimentalEffectSymbol);
        Assert.Null(EngineeringAt(build, "FrameShiftDrive").ExperimentalEffect);
        Assert.Equal(LongRange, EngineeringAt(build, "FrameShiftDrive").BlueprintName);
    }

    [Fact]
    public void AnEffectOnlyEditThatAsksForWhatIsFittedChangesNothing()
    {
        ShipLoadout build = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5, 1, MassManager));

        ExperimentalEffectEdit edit = build.SetExperimentalEffect("FrameShiftDrive", MassManager);

        Assert.Equal(EngineeringEditKind.Unchanged, edit.Kind);
        Assert.Equal(MassManager, edit.ExperimentalEffectSymbol);
    }

    [Fact]
    public void AnEffectOnlyEditRefusesAnEmptyMount()
    {
        ExperimentalEffectEdit edit =
            ShipLoadout.Empty("SideWinder").SetExperimentalEffect("SmallHardpoint1", null);

        Assert.Equal(EngineeringEditKind.Unsupported, edit.Kind);
        Assert.Equal(EngineeringEditCode.EmptySlot, edit.Code);
        Assert.Equal("SmallHardpoint1", edit.Detail!.Slot);
    }

    [Fact]
    public void AnEffectOnlyEditRefusesAModuleThatStatesNoEngineering()
    {
        ExperimentalEffectEdit edit = Stock().SetExperimentalEffect("FrameShiftDrive", MassManager);

        Assert.Equal(EngineeringEditKind.Unsupported, edit.Kind);
        Assert.Equal(EngineeringEditCode.NotEngineered, edit.Code);
        Assert.Equal("FrameShiftDrive", edit.Detail!.Slot);
    }

    [Fact]
    public void AnEffectOnlyEditRefusesAnEffectNoCatalogueCarries()
    {
        ShipLoadout build = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5));

        ExperimentalEffectEdit edit =
            build.SetExperimentalEffect("FrameShiftDrive", "special_future_effect");

        Assert.Equal(EngineeringEditCode.UnknownExperimentalEffect, edit.Code);
        Assert.Equal("special_future_effect", edit.Detail!.ExperimentalEffectSymbol);
    }

    [Fact]
    public void AnEffectOnlyEditRefusesAnEffectTheModulesMenuDoesNotOffer()
    {
        ShipLoadout build = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5));

        ExperimentalEffectEdit edit =
            build.SetExperimentalEffect("FrameShiftDrive", "special_engine_overloaded");

        Assert.Equal(EngineeringEditCode.UnsupportedExperimentalEffect, edit.Code);
    }

    [Fact]
    public void ACompletedRollSpellsOutTheFiguresTheBestQualityProduces()
    {
        ShipLoadout partial = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5, 0.42));
        ShipLoadout imported = ShipLoadout.FromLoadout(partial.ToLoadoutEvent());

        EngineeringGradeEdit edit = imported.CompleteEngineeringGrade("FrameShiftDrive");

        Assert.Equal(EngineeringEditKind.Updated, edit.Kind);
        Assert.Equal(0.42, edit.PreviousQuality);
        Assert.Equal(1, EngineeringAt(imported, "FrameShiftDrive").Quality);
        Assert.Equal(
            OptimalMass(
                Stock().ApplyBlueprint("FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5)),
                "FrameShiftDrive"),
            OptimalMass(imported, "FrameShiftDrive"));
    }

    [Fact]
    public void ACompletedRollThatStatesItsFiguresIsAlreadyWhole()
    {
        ShipLoadout build = Stock().ApplyBlueprint(
            "FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5));

        EngineeringGradeEdit edit = build.CompleteEngineeringGrade("FrameShiftDrive");

        Assert.Equal(EngineeringEditKind.Unchanged, edit.Kind);
    }

    [Fact]
    public void CompletingAGradeRefusesAMountThatStatesNoEngineering()
    {
        EngineeringGradeEdit edit = Stock().CompleteEngineeringGrade("FrameShiftDrive");

        Assert.Equal(EngineeringEditCode.NotEngineered, edit.Code);
    }

    [Fact]
    public void CompletingAGradeRefusesAnEmptyMount()
    {
        EngineeringGradeEdit edit =
            ShipLoadout.Empty("SideWinder").CompleteEngineeringGrade("SmallHardpoint1");

        Assert.Equal(EngineeringEditCode.EmptySlot, edit.Code);
    }

    [Fact]
    public void ClearingTheEngineeringRestoresTheCataloguesOwnFigures()
    {
        ShipLoadout build = Stock();
        double stock = OptimalMass(build, "FrameShiftDrive");
        build.ApplyBlueprint("FrameShiftDrive", LongRange, new ApplyBlueprintOptions(5));

        build.ClearEngineering("FrameShiftDrive");

        Assert.Null(build.FittedModuleAt("FrameShiftDrive")!.Engineering);
        Assert.Equal(stock, OptimalMass(build, "FrameShiftDrive"));
    }

    [Fact]
    public void ClearingTheEngineeringOfAnUnengineeredMountChangesNothing()
    {
        ShipLoadout build = Stock();

        build.ClearEngineering("FrameShiftDrive").ClearEngineering("SmallHardpoint1");

        Assert.Null(build.FittedModuleAt("FrameShiftDrive")!.Engineering);
    }

    /// <summary>A catalogued article that is not final, so a build can fit and then clear it.</summary>
    private static PreEngineeredVariant Article()
    {
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.All)
        {
            if (candidate.EngineeringLocked) continue;
            if (candidate.Acquisition != PreEngineeredAcquisition.EventReward) continue;
            if (ModuleCatalogue.FindBySymbol(candidate.Symbol)?.Category != ModuleCategory.Hardpoint)
            {
                continue;
            }

            return candidate;
        }

        throw new InvalidOperationException("The catalogue lists no such article.");
    }

    [Fact]
    public void AFittedArticleStatesItsOwnIdentityAndTheStatsItMoves()
    {
        PreEngineeredVariant article = Article();
        ShipLoadout build = ShipLoadout.Empty("Krait_MkII");

        build.SetPreEngineeredVariant("MediumHardpoint1", article);

        FittedModule fitted = build.FittedModuleAt("MediumHardpoint1")!;
        Assert.Equal(article.Symbol, fitted.Symbol);
        Assert.Equal(article.BlueprintSymbol, fitted.Engineering!.BlueprintName);
        Assert.Equal(article.Grade, fitted.Engineering.Level);
        Assert.Equal(1, fitted.Engineering.Quality);
        Assert.Equal(article, fitted.PreEngineeredVariant);
    }

    [Fact]
    public void NoCatalogueAnswersForAnInventedArticle()
    {
        PreEngineeredVariant invented = Article() with { Grade = 4 };
        ShipLoadout build = ShipLoadout.Empty("Krait_MkII");

        Assert.Throws<ArgumentOutOfRangeException>(
            () => build.SetPreEngineeredVariant("MediumHardpoint1", invented));
    }

    [Fact]
    public void AFinalArticleAcceptsNoFurtherEngineeringAndKeepsWhatItHas()
    {
        PreEngineeredVariant final = FinalArticle();
        ShipLoadout build = ShipLoadout.Empty("Krait_MkII");
        build.SetPreEngineeredVariant("MediumHardpoint1", final);

        Assert.Throws<ArgumentException>(() => build.ClearEngineering("MediumHardpoint1"));
        ExperimentalEffectEdit edit =
            build.SetExperimentalEffect("MediumHardpoint1", "special_weapon_efficient");
        Assert.Equal(EngineeringEditCode.FinalArticle, edit.Code);
        Assert.Equal(
            EngineeringEditCode.FinalArticle,
            build.CompleteEngineeringGrade("MediumHardpoint1").Code);
    }

    private static PreEngineeredVariant FinalArticle()
    {
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.All)
        {
            if (!candidate.EngineeringLocked) continue;
            if (ModuleCatalogue.FindBySymbol(candidate.Symbol)?.Category != ModuleCategory.Hardpoint)
            {
                continue;
            }

            OutfittingModule article = PreEngineeredStats.Resolve(candidate)!;
            if (article.Class > 2) continue;
            return candidate;
        }

        throw new InvalidOperationException("The catalogue lists no such article.");
    }

    [Fact]
    public void AStockBuildAlreadyHoldsEveryFixedMountsOwnArticle()
    {
        FixedMountRepair repair = Stock().RepairFixedMount("CargoHatch");

        Assert.Equal(FixedMountRepairStatus.Unchanged, repair.Status);
        Assert.Equal("CargoHatch", repair.Slot);
    }

    [Fact]
    public void AMountAnEditReachesIsNotRepairedFromTheHullsStock()
    {
        FixedMountRepair repair = Stock().RepairFixedMount("SmallHardpoint1");

        Assert.Equal(FixedMountRepairStatus.Refused, repair.Status);
    }

    [Fact]
    public void EveryEngineeringEditNamesTheArgumentItCannotRead()
    {
        ShipLoadout build = Stock();

        Assert.Throws<ArgumentNullException>(
            () => build.ApplyBlueprint(null!, LongRange, new ApplyBlueprintOptions(1)));
        Assert.Throws<ArgumentNullException>(
            () => build.ApplyBlueprint("FrameShiftDrive", null!, new ApplyBlueprintOptions(1)));
        Assert.Throws<ArgumentNullException>(
            () => build.ApplyBlueprint("FrameShiftDrive", LongRange, null!));
        Assert.Throws<ArgumentNullException>(() => build.SetExperimentalEffect(null!, null));
        Assert.Throws<ArgumentNullException>(() => build.CompleteEngineeringGrade(null!));
        Assert.Throws<ArgumentNullException>(() => build.ClearEngineering(null!));
        Assert.Throws<ArgumentNullException>(
            () => build.SetPreEngineeredVariant("SmallHardpoint1", null!));
    }
}
