using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Writing a build back out as a journal loadout event.</summary>
public class LoadoutExportTests
{
    private const string Ship = "Sidewinder";
    private const string Plant = "Int_Powerplant_Size2_Class1";
    private const string Drive = "Int_Hyperdrive_Size2_Class1";

    private static OutfittingModule? Catalogued(LoadoutModule module) =>
        ModuleCatalogue.FindBySymbol(module.Item);

    private static LoadoutExportInput Input(
        IReadOnlyList<LoadoutModule> modules,
        SourcePurchaseRecord? source = null)
    {
        ShipSlots layout = ShipCatalogue.FindSlots(Ship)!;
        return new LoadoutExportInput(
            ShipSymbol: Ship,
            Modules: modules,
            Layout: BuildSlots.Enumerate(layout),
            SourcePurchase: source,
            RetailHullValue: 4588,
            UnladenMass: 36.4,
            CargoCapacity: 0,
            FuelCapacity: new LoadoutFuelCapacity(2, 0.3),
            MaxJumpRange: 20.896055,
            StatsFor: Catalogued);
    }

    private static double Price(string symbol) => ModuleCatalogue.FindBySymbol(symbol)!.Cost!.Value;

    [Fact]
    public void AnExportLowerCasesTheHullAndEveryArticle()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant)]), new LoadoutExportOptions());

        Assert.Equal("sidewinder", exported.Ship);
        Assert.Equal(Plant.ToLowerInvariant(), Assert.Single(exported.Modules).Item);

        // The mount key keeps the build's own spelling.
        Assert.Equal("PowerPlant", exported.Modules[0].Slot);
    }

    [Fact]
    public void ARetailExportPricesEveryModuleFromTheCatalogue()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant), new LoadoutModule("FrameShiftDrive", Drive)]),
            new LoadoutExportOptions());

        Assert.Equal(4588, exported.HullValue);
        Assert.Equal(Price(Plant) + Price(Drive), exported.ModulesValue);
        Assert.Equal(Price(Plant), exported.Modules[0].Value);
    }

    [Fact]
    public void ARetailRebuyIsOneTwentiethOfTheHullAndTheModules()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant)]), new LoadoutExportOptions());

        Assert.Equal(System.Math.Truncate((4588 + Price(Plant)) * 0.05), exported.Rebuy);
    }

    [Fact]
    public void AFreeArticleAddsNothingToTheModulesPrice()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([
                new LoadoutModule("PowerPlant", Plant),
                new LoadoutModule("CargoHatch", "ModularCargoBayDoorFDL"),
            ]),
            new LoadoutExportOptions());

        Assert.Equal(Price(Plant), exported.ModulesValue);
        Assert.Null(exported.Modules[1].Value);
    }

    [Fact]
    public void AnArticleNothingPricesLeavesTheModulesPriceUnquoted()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("Slot01_Size2", "Not_A_Module")]),
            new LoadoutExportOptions());

        Assert.Null(exported.ModulesValue);
        Assert.Null(exported.Rebuy);
        Assert.Equal(4588, exported.HullValue);
    }

    [Fact]
    public void APhysicalFigureIsAlwaysWritten()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant)]), new LoadoutExportOptions());

        Assert.Equal(36.4, exported.UnladenMass);
        Assert.Equal(0, exported.CargoCapacity);
        Assert.Equal(20.896055, exported.MaxJumpRange);
        Assert.Equal(new LoadoutFuelCapacity(2, 0.3), exported.FuelCapacity);
    }

    [Fact]
    public void ABuildThatCannotJumpWritesNoJumpRange()
    {
        LoadoutExportInput input = Input([new LoadoutModule("PowerPlant", Plant)]) with
        {
            MaxJumpRange = null,
        };

        Assert.Null(LoadoutExport.Event(input, new LoadoutExportOptions()).MaxJumpRange);
    }

    [Fact]
    public void ANameAndAnIdentifierAreWrittenOnlyWhereTheBuildCarriesThem()
    {
        LoadoutExportInput bare = Input([new LoadoutModule("PowerPlant", Plant)]);

        LoadoutEvent anonymous = LoadoutExport.Event(bare, new LoadoutExportOptions());
        Assert.Null(anonymous.ShipName);
        Assert.Null(anonymous.ShipIdent);

        LoadoutEvent named = LoadoutExport.Event(
            bare with { ShipName = "Endeavour", ShipIdent = "EN-01" }, new LoadoutExportOptions());
        Assert.Equal("Endeavour", named.ShipName);
        Assert.Equal("EN-01", named.ShipIdent);
    }

    [Fact]
    public void APowerStateIsWrittenOnlyWhereTheBuildCarriesOne()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant)]), new LoadoutExportOptions());

        Assert.Null(exported.Modules[0].On);
        Assert.Null(exported.Modules[0].Priority);
    }

    [Fact]
    public void AnExplicitPowerExportWritesTheStateAJournalAlwaysCarries()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant)]),
            new LoadoutExportOptions { ExplicitPower = true });

        Assert.True(exported.Modules[0].On);
        Assert.Equal(0, exported.Modules[0].Priority);
    }

    [Fact]
    public void AnExplicitPowerExportLeavesAStatedStateAlone()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant) { On = false, Priority = 3 }]),
            new LoadoutExportOptions { ExplicitPower = true });

        Assert.False(exported.Modules[0].On);
        Assert.Equal(3, exported.Modules[0].Priority);
    }

    [Fact]
    public void TheDefaultOrderIsTheOneTheBuildCarries()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([
                new LoadoutModule("FrameShiftDrive", Drive),
                new LoadoutModule("PowerPlant", Plant),
            ]),
            new LoadoutExportOptions());

        Assert.Equal(
            ["FrameShiftDrive", "PowerPlant"],
            exported.Modules.Select(module => module.Slot).ToArray());
    }

    [Fact]
    public void TheSlotOrderIsTheHullsOwnPanelOrder()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([
                new LoadoutModule("FrameShiftDrive", Drive),
                new LoadoutModule("PowerPlant", Plant),
            ]),
            new LoadoutExportOptions { ModuleOrder = LoadoutModuleOrder.Slots });

        Assert.Equal(
            ["PowerPlant", "FrameShiftDrive"],
            exported.Modules.Select(module => module.Slot).ToArray());
    }

    [Fact]
    public void AMountTheLayoutDoesNotNameKeepsItsPlaceAtTheEnd()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([
                new LoadoutModule("Bobble10", "bobble_christmastree"),
                new LoadoutModule("FrameShiftDrive", Drive),
                new LoadoutModule("PowerPlant", Plant),
            ]),
            new LoadoutExportOptions { ModuleOrder = LoadoutModuleOrder.Slots });

        Assert.Equal(
            ["PowerPlant", "FrameShiftDrive", "Bobble10"],
            exported.Modules.Select(module => module.Slot).ToArray());
    }

    [Fact]
    public void AStatedEngineeringBlockSurvivesTheExport()
    {
        ModuleEngineering engineering = new("PowerPlant_Boosted", 5, 1);
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant) { Engineering = engineering }]),
            new LoadoutExportOptions());

        Assert.Same(engineering, exported.Modules[0].Engineering);
    }

    [Fact]
    public void ASourceExportQuotesTheCapturesOwnFigures()
    {
        SourcePurchaseRecord source = new(
            HullValue: 4000,
            ModulesValue: 100,
            Rebuy: 205,
            ModuleValues: [new SourceModuleValue("PowerPlant", Plant, 100)],
            ModuleCount: 1);

        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant)], source),
            new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        Assert.Equal(4000, exported.HullValue);
        Assert.Equal(100, exported.ModulesValue);
        Assert.Equal(205, exported.Rebuy);
        Assert.Equal(100, exported.Modules[0].Value);
    }

    [Fact]
    public void ASwappedMountNarrowsASourceExportRatherThanStalingIt()
    {
        SourcePurchaseRecord source = new(
            HullValue: 4000,
            ModulesValue: 100,
            Rebuy: 205,
            ModuleValues: [new SourceModuleValue("PowerPlant", Plant, 100)],
            ModuleCount: 1);

        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", "Int_Powerplant_Size2_Class3")], source),
            new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        // The hull price names no mount, so it stands.
        Assert.Equal(4000, exported.HullValue);
        Assert.Null(exported.ModulesValue);
        Assert.Null(exported.Rebuy);
        Assert.Null(exported.Modules[0].Value);
    }

    [Fact]
    public void ARemovedMountNarrowsASourceExportToo()
    {
        SourcePurchaseRecord source = new(
            HullValue: 4000,
            ModulesValue: 100,
            Rebuy: 205,
            ModuleValues: [new SourceModuleValue("PowerPlant", Plant, 100)],
            ModuleCount: 1);

        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("FrameShiftDrive", Drive)], source),
            new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        Assert.Null(exported.ModulesValue);
        Assert.Null(exported.Rebuy);
    }

    [Fact]
    public void AFreeCargoHatchDoesNotNarrowASourceExport()
    {
        SourcePurchaseRecord source = new(
            HullValue: 4000,
            ModulesValue: 100,
            Rebuy: 205,
            ModuleValues:
            [
                new SourceModuleValue("PowerPlant", Plant, 100),
                new SourceModuleValue("CargoHatch", "ModularCargoBayDoor", 0),
            ],
            ModuleCount: 2);

        LoadoutEvent exported = LoadoutExport.Event(
            Input([
                new LoadoutModule("PowerPlant", Plant),
                new LoadoutModule("CargoHatch", "ModularCargoBayDoorFDL"),
            ], source),
            new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        Assert.Equal(100, exported.ModulesValue);
        Assert.Equal(205, exported.Rebuy);
    }

    [Fact]
    public void ACoreInternalStockedAtImportVoidsASourceExportsTotals()
    {
        SourcePurchaseRecord source = new(
            HullValue: 4000,
            ModulesValue: 100,
            Rebuy: 205,
            ModuleValues: [new SourceModuleValue("PowerPlant", Plant, 100)],
            ModuleCount: 1);
        LoadoutExportInput input = Input([new LoadoutModule("PowerPlant", Plant)], source) with
        {
            SourceTotalsVoided = true,
        };

        LoadoutEvent exported = LoadoutExport.Event(
            input, new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        Assert.Equal(4000, exported.HullValue);
        Assert.Null(exported.ModulesValue);
        Assert.Null(exported.Rebuy);

        // The per-mount figure still stands: it is what that article was paid for.
        Assert.Equal(100, exported.Modules[0].Value);
    }

    [Fact]
    public void ABuildWithNoPurchaseRecordQuotesNoSourceCredits()
    {
        LoadoutEvent exported = LoadoutExport.Event(
            Input([new LoadoutModule("PowerPlant", Plant)]),
            new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        Assert.Null(exported.HullValue);
        Assert.Null(exported.ModulesValue);
        Assert.Null(exported.Rebuy);
        Assert.Null(exported.Modules[0].Value);
    }

    [Fact]
    public void AnEnvelopeCarriesTheShapeOptionsItStates()
    {
        SlefExportOptions options = new(new SlefHeader("Almanac", "1"))
        {
            Indent = 2,
            ModuleOrder = LoadoutModuleOrder.Slots,
            ExplicitPower = true,
            Credits = LoadoutCredits.Source,
        };

        LoadoutExportOptions shape = options.Shape;

        Assert.Equal(LoadoutModuleOrder.Slots, shape.ModuleOrder);
        Assert.True(shape.ExplicitPower);
        Assert.Equal(LoadoutCredits.Source, shape.Credits);
    }
}
