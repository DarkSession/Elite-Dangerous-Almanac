using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>A SLEF engineering block that states no modifiers at all.</summary>
/// <remarks>
/// Absent means "not stated", never "changed nothing". The article performs at its
/// catalogue stats, a modifier lookup answers nothing, and an export must not write an
/// empty array back out where the source stated none.
/// </remarks>
public class SlefEngineeringWithoutModifiersTests
{
    private static readonly EngineeringWithoutModifiersFixture Fixture =
        SharedFixtures.Load<LoadoutExportFixture>("fixtures/ships/slef-export.jsonc")
            .EngineeringWithoutModifiers;

    /// <summary>The specification's own example: a recipe, a grade, a quality, no modifiers.</summary>
    private const string Export = """
        [{"header":{"appName":"test","appVersion":"1","appURL":"https://example.invalid"},
        "data":{"event":"Loadout","Ship":"sidewinder","Modules":[
        {"Slot":"PowerPlant","Item":"Int_Powerplant_Size2_Class1",
        "Engineering":{"BlueprintName":"PowerPlant_Boosted","Level":3,"Quality":0.5,
        "ExperimentalEffect":"special_powerplant_highcharge"}}]}}]
        """;

    [Fact]
    public void AReaderDoesNotInsistOnAModifiersArray()
    {
        Assert.False(Fixture.ModifiersRequired);

        LoadoutEvent read = Slef.Parse(Export)[0].Data;

        ModuleEngineering engineering = read.Modules[0].Engineering!;
        Assert.Equal("PowerPlant_Boosted", engineering.BlueprintName);
        Assert.Equal(3, engineering.Level);
        Assert.Null(engineering.Modifiers);
    }

    /// <summary>An article that states no modifiers performs at its catalogue stats.</summary>
    /// <remarks>
    /// This is the read of the stated module itself. A build put together from the event
    /// goes further: it rolls the recipe the block names rather than publish unengineered
    /// figures under an engineered block, and reports that it did.
    /// </remarks>
    [Fact]
    public void AnArticleWithNoModifiersPerformsAtItsCatalogueStats()
    {
        LoadoutModule stated = Slef.Parse(Export)[0].Data.Modules[0];
        OutfittingModule stock = ModuleCatalogue.FindBySymbol("Int_Powerplant_Size2_Class1")!;

        OutfittingModule effective = LoadoutMetrics.Effective(stated, stock)!;

        Assert.Equal(
            stock.Stats[ModuleStat.PowerCapacity], effective.Stats[ModuleStat.PowerCapacity]);
        Assert.Null(Slef.FindModifier(stated, "PowerCapacity"));
    }

    [Fact]
    public void AnExportDoesNotInventAnEmptyModifiersArray()
    {
        Assert.False(Fixture.ExportInventsEmptyArray);

        LoadoutEvent read = Slef.Parse(Export)[0].Data;
        string written = Slef.Stringify(Slef.Wrap(
            read, new SlefHeader("test", "1") { AppUrl = "https://example.invalid" }));

        using JsonDocument document = JsonDocument.Parse(written);
        JsonElement engineering = document.RootElement[0]
            .GetProperty("data").GetProperty("Modules")[0].GetProperty("Engineering");

        Assert.False(engineering.TryGetProperty("Modifiers", out _));
        Assert.Null(Slef.Parse(written)[0].Data.Modules[0].Engineering!.Modifiers);
    }

    /// <summary>A build put together from the event rolls the recipe the block names.</summary>
    /// <remarks>
    /// A block that states no modifiers moves nothing. Keeping it would publish stock
    /// figures under an engineered block, so the recipe beside it is rolled instead.
    /// </remarks>
    [Fact]
    public void ABuildRollsTheRecipeAStatedBlockNamesNoModifiersFor()
    {
        ShipLoadout build = ShipLoadout.FromLoadout(Slef.Parse(Export)[0].Data);

        OutfittingModule stock = ModuleCatalogue.FindBySymbol("Int_Powerplant_Size2_Class1")!;
        FittedModule fitted = build.FittedModuleAt("PowerPlant")!;

        Assert.NotNull(fitted.Engineering!.Modifiers);
        Assert.True(
            fitted.EffectiveStats!.Stats[ModuleStat.PowerCapacity]
                > stock.Stats[ModuleStat.PowerCapacity]);

        // The roll itself is reported only where a stated block was replaced. This one
        // stated nothing, so the mount reports nothing; the outcomes a read does carry are
        // the core mounts the payload leaves out.
        foreach (LoadoutImportOutcome outcome in build.ImportOutcomes)
        {
            Assert.NotEqual("PowerPlant", outcome.Slot);
        }
    }
}
