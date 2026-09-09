using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Reading a capture into the state a build takes ownership of.</summary>
public class LoadoutImportTests
{
    private static readonly LoadoutExportFixture Fixture =
        SharedFixtures.Load<LoadoutExportFixture>("fixtures/ships/slef-export.jsonc");

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static ImportedLoadoutState Normalized()
    {
        LoadoutEvent capture = Fixture.ImportNormalization.Input.Deserialize<LoadoutEvent>(
            JournalOptions)!;
        return LoadoutImport.Normalize(capture);
    }

    public static TheoryData<int> ExpectedModules()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.ImportNormalization.Expected.Modules.Count; index++)
        {
            positions.Add(index);
        }

        return positions;
    }

    public static TheoryData<int> ExpectedOutcomes()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.ImportNormalization.Expected.Outcomes.Count; index++)
        {
            positions.Add(index);
        }

        return positions;
    }

    [Fact]
    public void TheCaptureKeepsOnlyTheMountsTheFixtureStates()
    {
        ImportedLoadoutState state = Normalized();

        Assert.Equal(
            Fixture.ImportNormalization.Expected.Modules.Count, state.Modules.Count);
        Assert.Equal("sidewinder", state.ShipSymbol);
    }

    [Theory]
    [MemberData(nameof(ExpectedModules))]
    public void AMountHoldsTheArticleTheFixtureStates(int position)
    {
        ImportedModuleFixture stated = Fixture.ImportNormalization.Expected.Modules[position];
        ImportedLoadoutState state = Normalized();

        LoadoutModule fitted = state.Modules[position];
        Assert.Equal(stated.Slot, fitted.Slot);
        Assert.Equal(stated.Symbol, fitted.Item, ignoreCase: true);
        Assert.Equal(stated.On, fitted.On);
        Assert.Equal(stated.Priority, fitted.Priority);
        Assert.Equal(stated.Health, fitted.Health);

        // A stock replacement carries no engineering and no captured price: both describe the
        // article that failed to resolve, not the mount.
        if (stated.Symbol != fitted.Item || stated.On is not null)
        {
            Assert.Null(fitted.Engineering);
            Assert.Null(fitted.Value);
        }
    }

    [Theory]
    [MemberData(nameof(ExpectedOutcomes))]
    public void AnImportReportsTheChangeTheFixtureStates(int position)
    {
        ImportOutcomeFixture stated = Fixture.ImportNormalization.Expected.Outcomes[position];
        ImportedLoadoutState state = Normalized();

        LoadoutImportOutcome outcome = state.Outcomes[position];
        Assert.Equal(stated.Slot, outcome.Slot);
        switch (outcome)
        {
            case ModuleDefaulted defaulted:
                Assert.Equal("defaulted", stated.Action);
                Assert.Equal(stated.SourceSymbol, defaulted.SourceSymbol);
                Assert.Equal(
                    stated.ReplacementSymbol, defaulted.ReplacementSymbol, ignoreCase: true);
                break;
            case ModuleEmptied emptied:
                Assert.Equal("emptied", stated.Action);
                Assert.Equal(stated.SourceSymbol, emptied.SourceSymbol);
                break;
            default:
                Assert.Fail($"An import reported an unexpected {outcome.Action}.");
                break;
        }
    }

    /// <summary>A build made of the read modules answers the figures the fixture states.</summary>
    /// <remarks>
    /// The capture is thin enough that import fills ten mounts from the hull's own
    /// defaults. What those defaults add up to is the parity case: a capture this sparse
    /// still reads as a build that flies.
    /// </remarks>
    [Fact]
    public void AReadBuildWeighsAndHoldsWhatTheFixtureStates()
    {
        ImportExpectationFixture expected = Fixture.ImportNormalization.Expected;
        ShipLoadout build = ShipLoadout.FromLoadout(
            Fixture.ImportNormalization.Input.Deserialize<LoadoutEvent>(JournalOptions)!);

        Assert.Equal(expected.UnladenMass, build.UnladenMass, 6);
        Assert.Equal(expected.CargoCapacity, build.CargoCapacity);
        Assert.Equal(expected.PassengerCapacity, build.PassengerCapacity);
        Assert.Equal(expected.FuelCapacity.Main, build.FuelCapacity.Main);
        Assert.Equal(expected.FuelCapacity.Reserve, build.FuelCapacity.Reserve);
        Assert.Equal(expected.ModulesValue, build.ModulesValue);
        Assert.Equal(expected.Rebuy, build.Rebuy);
        Assert.Equal(expected.Complete, build.Validation().Complete);
    }

    [Fact]
    public void AnImportReportsNoChangeTheFixtureDoesNotState()
    {
        ImportedLoadoutState state = Normalized();

        Assert.Equal(Fixture.ImportNormalization.Expected.Outcomes.Count, state.Outcomes.Count);
    }

    [Fact]
    public void StockingACoreInternalDropsTheCapturesOwnFigures()
    {
        ImportedLoadoutState state = Normalized();

        Assert.Null(state.Top.ModulesValue);
        Assert.Null(state.Top.Rebuy);
        Assert.Null(state.Top.UnladenMass);
        Assert.Null(state.Top.CargoCapacity);
        Assert.Null(state.Top.FuelCapacity);
    }

    [Fact]
    public void AnImportThatChangesNothingKeepsTheCapturesOwnFigures()
    {
        LoadoutEvent capture = Complete() with
        {
            UnladenMass = 999,
            CargoCapacity = 998,
            ModulesValue = 997,
            Rebuy = 996,
            HullValue = 995,
            ShipName = "Endeavour",
            ShipIdent = "EN-01",
            FuelCapacity = new LoadoutFuelCapacity(2, 0.3),
        };

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.Empty(state.Outcomes);
        Assert.Equal(999, state.Top.UnladenMass);
        Assert.Equal(998, state.Top.CargoCapacity);
        Assert.Equal(997, state.Top.ModulesValue);
        Assert.Equal(996, state.Top.Rebuy);
        Assert.Equal(995, state.Top.HullValue);
        Assert.Equal("Endeavour", state.Top.ShipName);
        Assert.Equal("EN-01", state.Top.ShipIdent);
        Assert.Equal(new LoadoutFuelCapacity(2, 0.3), state.Top.FuelCapacity);
    }

    [Fact]
    public void AHullSpecificCargoHatchIsKeptAsTheSourceSpellsIt()
    {
        LoadoutEvent capture = With(
            "FerDeLance", new LoadoutModule("CargoHatch", "ModularCargoBayDoorFDL"));

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.Contains(
            state.Modules,
            module => module.Slot == "CargoHatch" && module.Item == "ModularCargoBayDoorFDL");
        Assert.DoesNotContain(
            state.Outcomes, outcome => outcome.Slot == "CargoHatch");
    }

    [Fact]
    public void ACosmeticEntryIsKeptWhateverTheCatalogueSaysOfIt()
    {
        LoadoutEvent capture = With(
            "Sidewinder", new LoadoutModule("Bobble10", "bobble_christmastree"));

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.Contains(state.Modules, module => module.Slot == "Bobble10");
        Assert.DoesNotContain(state.Outcomes, outcome => outcome.Slot == "Bobble10");
    }

    [Fact]
    public void AnArticleTheCatalogueKnowsIsKeptWhateverTheMountIsCalled()
    {
        LoadoutEvent capture = With(
            "Sidewinder", new LoadoutModule("FutureCoreSlot", "int_hyperdrive_size5_class5"));

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.Contains(state.Modules, module => module.Slot == "FutureCoreSlot");
        Assert.DoesNotContain(state.Outcomes, outcome => outcome.Slot == "FutureCoreSlot");
    }

    [Fact]
    public void AnUnknownArticleInAnUnknownMountIsRemoved()
    {
        LoadoutEvent capture = With(
            "Sidewinder", new LoadoutModule("FutureMount", "int_something_new"));

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.DoesNotContain(state.Modules, module => module.Slot == "FutureMount");
        ModuleEmptied emptied = Assert.IsType<ModuleEmptied>(
            Assert.Single(state.Outcomes, outcome => outcome.Slot == "FutureMount"));
        Assert.Equal("int_something_new", emptied.SourceSymbol);
    }

    [Fact]
    public void AnOversizedArticleInAStockedMountTakesTheHullsOwn()
    {
        LoadoutEvent capture = With(
            "Sidewinder", new LoadoutModule("PowerPlant", "Int_Powerplant_Size8_Class5"));

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        ModuleDefaulted defaulted = Assert.IsType<ModuleDefaulted>(
            Assert.Single(state.Outcomes, outcome => outcome.Slot == "PowerPlant"));
        Assert.Equal("Int_Powerplant_Size8_Class5", defaulted.SourceSymbol);
        Assert.Equal("Int_Powerplant_Size2_Class1", defaulted.ReplacementSymbol);
    }

    [Fact]
    public void AnUnrecognisedHullIsJudgedOnTheCaptureAlone()
    {
        LoadoutEvent capture = new(
            "NotAShip",
            [new LoadoutModule("PowerPlant", "Int_Powerplant_Size8_Class5")]);

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.Empty(state.Outcomes);
        Assert.Single(state.Modules);
    }

    [Fact]
    public void ARemovableMountKeepsAnArticleThatDoesNotFitIt()
    {
        // A bad article in a mount that can stand empty is the caller's to see and remove.
        LoadoutEvent capture = With(
            "Sidewinder", new LoadoutModule("SmallHardpoint1", "Int_FuelTank_Size1_Class3"));

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.Contains(state.Modules, module => module.Slot == "SmallHardpoint1");
        Assert.DoesNotContain(state.Outcomes, outcome => outcome.Slot == "SmallHardpoint1");
    }

    [Fact]
    public void ABuildThatLowerCasesItsMountsKeepsDoingSo()
    {
        LoadoutEvent capture = new(
            "Sidewinder",
            [new LoadoutModule("powerplant", "Int_Powerplant_Size2_Class1")]);

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.All(state.Modules, module => Assert.Equal(module.Slot.ToLowerInvariant(), module.Slot));
    }

    [Fact]
    public void AMountTheSourceAlreadyNamesIsNotStockedTwice()
    {
        ImportedLoadoutState state = LoadoutImport.Normalize(Complete());

        Assert.Equal(
            state.Modules.Count,
            state.Modules.Select(module => module.Slot).Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }

    [Fact]
    public void ARepeatedMountIsRefused()
    {
        LoadoutEvent capture = new(
            "Sidewinder",
            [
                new LoadoutModule("PowerPlant", "Int_Powerplant_Size2_Class1"),
                new LoadoutModule("powerplant", "Int_Powerplant_Size2_Class1"),
            ]);

        ArgumentException error =
            Assert.Throws<ArgumentException>(() => LoadoutImport.Normalize(capture));
        Assert.Contains("powerplant", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AnAbsentFieldIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => LoadoutImport.Normalize(null!));
        Assert.Throws<ArgumentNullException>(
            () => LoadoutImport.Normalize(new LoadoutEvent(null!, [])));
        Assert.Throws<ArgumentNullException>(
            () => LoadoutImport.Normalize(new LoadoutEvent("Sidewinder", null!)));
        Assert.Throws<ArgumentNullException>(
            () => LoadoutImport.Normalize(new LoadoutEvent("Sidewinder", [null!])));
        Assert.Throws<ArgumentNullException>(
            () => LoadoutImport.Normalize(new LoadoutEvent(
                "Sidewinder", [new LoadoutModule(null!, "Int_Powerplant_Size2_Class1")])));
        Assert.Throws<ArgumentNullException>(
            () => LoadoutImport.Normalize(new LoadoutEvent(
                "Sidewinder", [new LoadoutModule("PowerPlant", null!)])));
    }

    [Fact]
    public void AStatedModifierWithNoLabelIsRefused()
    {
        LoadoutEvent capture = new(
            "Sidewinder",
            [
                new LoadoutModule("PowerPlant", "Int_Powerplant_Size2_Class1")
                {
                    Engineering = new ModuleEngineering("PowerPlant_Boosted", 5, 1)
                    {
                        Modifiers = [new EngineeringModifier(null!, 1, 2)],
                    },
                },
            ]);

        Assert.Throws<ArgumentNullException>(() => LoadoutImport.Normalize(capture));
    }

    [Fact]
    public void ACaptureStatingPricesCarriesTheSourcePurchaseRecord()
    {
        LoadoutEvent capture = Complete() with { HullValue = 4588, ModulesValue = 166730 };

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        Assert.NotNull(state.SourcePurchase);
        Assert.Equal(4588, state.SourcePurchase.HullValue);
    }

    [Fact]
    public void AFixedArticlesCaptureResolvesToTheArticlesOwnStats()
    {
        PreEngineeredVariant locked = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_Guardian_GaussCannon_Fixed_Small"),
            variant => variant.EngineeringLocked);
        LoadoutEvent capture = With(
            "Sidewinder",
            new LoadoutModule("SmallHardpoint1", locked.Symbol)
            {
                Engineering = new ModuleEngineering(locked.BlueprintSymbol, locked.Grade, 1),
            });

        ImportedLoadoutState state = LoadoutImport.Normalize(capture);

        OutfittingModule article = state.ModuleStats["SmallHardpoint1"];
        Assert.True(article.EngineeringLocked);
    }

    [Fact]
    public void AFittedArticleTheCatalogueResolvesNeedsNoSeparateStats()
    {
        ImportedLoadoutState state = LoadoutImport.Normalize(Complete());

        Assert.Empty(state.ModuleStats);
        Assert.Empty(state.PrimitiveModifiers);
    }

    /// <summary>A capture no import has to correct.</summary>
    private static LoadoutEvent Complete()
    {
        DefaultLoadout stock = DefaultLoadouts.Find("Sidewinder")!;
        List<LoadoutModule> modules = [];
        foreach (DefaultLoadoutModule module in stock.Modules)
        {
            modules.Add(new LoadoutModule(module.Slot, module.Symbol));
        }

        return new LoadoutEvent("Sidewinder", modules);
    }

    /// <summary>A hull's stock capture with one module added or replaced.</summary>
    private static LoadoutEvent With(string ship, LoadoutModule module)
    {
        DefaultLoadout stock = DefaultLoadouts.Find(ship)!;
        List<LoadoutModule> modules = [];
        foreach (DefaultLoadoutModule entry in stock.Modules)
        {
            if (string.Equals(entry.Slot, module.Slot, StringComparison.OrdinalIgnoreCase)) continue;
            modules.Add(new LoadoutModule(entry.Slot, entry.Symbol));
        }

        modules.Add(module);
        return new LoadoutEvent(ship, modules);
    }
}
