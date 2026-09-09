using System;
using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The build a caller holds, reads, edits and writes back out.</summary>
public class ShipLoadoutTests
{
    private static readonly LoadoutExportFixture Fixture =
        SharedFixtures.Load<LoadoutExportFixture>("fixtures/ships/slef-export.jsonc");

    private static readonly SlefHeader TestHeader = new("Almanac", "1.0.0");

    /// <summary>The captures whose figures an export reproduces from the catalogues alone.</summary>
    public static TheoryData<string> CapturedBuilds() =>
    [
        nameof(LoadoutExportFixture.DeepBlack),
        nameof(LoadoutExportFixture.KraitPhantom),
        nameof(LoadoutExportFixture.ViperMkIV),
        nameof(LoadoutExportFixture.PythonMkII),
    ];

    private static BuildCaseFixture Case(string name) => name switch
    {
        nameof(LoadoutExportFixture.DeepBlack) => Fixture.DeepBlack,
        nameof(LoadoutExportFixture.KraitPhantom) => Fixture.KraitPhantom,
        nameof(LoadoutExportFixture.ViperMkIV) => Fixture.ViperMkIV,
        nameof(LoadoutExportFixture.PythonMkII) => Fixture.PythonMkII,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, "No such captured build."),
    };

    private static ShipLoadout Read(string path)
    {
        using JsonDocument document = SharedFixtures.LoadDocument(path);
        return ShipLoadout.FromSlef(Slef.Parse(document.RootElement));
    }

    private static LoadoutEvent Capture(string path)
    {
        using JsonDocument document = SharedFixtures.LoadDocument(path);
        return Slef.Parse(document.RootElement)[0].Data;
    }

    private static JsonElement Exported(ShipLoadout build, LoadoutExportOptions? options = null)
    {
        SlefExportOptions envelope = new(TestHeader)
        {
            ModuleOrder = options?.ModuleOrder ?? LoadoutModuleOrder.Fitted,
            ExplicitPower = options?.ExplicitPower ?? false,
            Credits = options?.Credits ?? LoadoutCredits.Retail,
        };
        using JsonDocument document = JsonDocument.Parse(build.ToSlefString(envelope));
        return document.RootElement[0].GetProperty("data").Clone();
    }

    private static List<string> KeysOf(JsonElement value)
    {
        List<string> keys = [];
        foreach (JsonProperty property in value.EnumerateObject()) keys.Add(property.Name);
        return keys;
    }

    /// <summary>A figure rounded the way the fixture stores it.</summary>
    private static double? Stored(double? value) =>
        value is double figure ? EngineeringPrecision.Round6(figure) : null;

    private static void AssertFigures(LoadoutEvent exported, RecomputedFiguresFixture expected)
    {
        if (expected.Ship is string ship) Assert.Equal(ship, exported.Ship);
        if (expected.HullValue is double hull) Assert.Equal(hull, Stored(exported.HullValue));
        if (expected.ModulesValue is double modules)
        {
            Assert.Equal(modules, Stored(exported.ModulesValue));
        }

        if (expected.UnladenMass is double mass) Assert.Equal(mass, Stored(exported.UnladenMass));
        if (expected.CargoCapacity is double cargo)
        {
            Assert.Equal(cargo, Stored(exported.CargoCapacity));
        }

        if (expected.MaxJumpRange is double range)
        {
            Assert.Equal(range, Stored(exported.MaxJumpRange));
        }

        if (expected.Rebuy is double rebuy) Assert.Equal(rebuy, Stored(exported.Rebuy));
        if (expected.FuelCapacity is LoadoutFuelCapacity fuel)
        {
            LoadoutFuelCapacity written = exported.FuelCapacity!;
            Assert.Equal(fuel.Main, EngineeringPrecision.Round6(written.Main));
            Assert.Equal(fuel.Reserve, EngineeringPrecision.Round6(written.Reserve));
        }
    }

    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void AnExportWritesEveryTopLevelKeyInTheOrderAJournalWritesThem(string name)
    {
        BuildCaseFixture expected = Case(name);

        JsonElement exported = Exported(Read(expected.Build));

        Assert.Equal(expected.TopLevelKeys, KeysOf(exported));
    }

    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void AReadKeepsEveryModuleTheCaptureCarries(string name)
    {
        BuildCaseFixture expected = Case(name);

        LoadoutEvent exported = Read(expected.Build).ToLoadoutEvent();

        Assert.Equal(expected.ModuleCount, exported.Modules.Count);
    }

    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void AnExportComputesEveryFigureItStates(string name)
    {
        BuildCaseFixture expected = Case(name);

        AssertFigures(Read(expected.Build).ToLoadoutEvent(), expected.Recomputed);
    }

    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void ACosmeticOrHullGeometryEntryTravelsWithTheBuildAndCostsItNothing(string name)
    {
        BuildCaseFixture expected = Case(name);

        ShipLoadout build = Read(expected.Build);
        LoadoutEvent exported = build.ToLoadoutEvent();

        foreach (string kept in expected.NonOutfittingSlots)
        {
            Assert.Contains(exported.Modules, module =>
                string.Equals(module.Slot, kept, StringComparison.OrdinalIgnoreCase));

            // It outfits nothing, so no catalogue answers for it and it weighs nothing.
            Assert.Null(build.FittedModuleAt(kept)!.Stats);
        }
    }

    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void ACapturesOwnPhysicalFiguresAreReproducedWithinItsRounding(string name)
    {
        BuildCaseFixture expected = Case(name);
        if (expected.JournalTolerance is not JournalToleranceFixture stated) return;

        LoadoutEvent exported = Read(expected.Build).ToLoadoutEvent();

        if (stated.UnladenMass is double mass)
        {
            Assert.Equal(mass, exported.UnladenMass!.Value, 1e-4);
        }

        if (stated.MaxJumpRange is double range)
        {
            Assert.Equal(range, exported.MaxJumpRange!.Value, 1e-4);
        }
    }

    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void ACreditFigureQuotesTheCatalogueRatherThanWhatTheCommanderPaid(string name)
    {
        BuildCaseFixture expected = Case(name);
        ShipLoadout build = Read(expected.Build);

        LoadoutEvent retail = build.ToLoadoutEvent();

        Assert.NotEqual(expected.Discount.SourceModulesValue, retail.ModulesValue);
        Assert.NotEqual(expected.Discount.SourceRebuy, retail.Rebuy);
    }

    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void ThePurchaseRecordIsQuotedOnlyWhereTheOptionsAskForIt(string name)
    {
        BuildCaseFixture expected = Case(name);
        ShipLoadout build = Read(expected.Build);

        LoadoutEvent source = build.ToLoadoutEvent(
            new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        Assert.Equal(expected.Discount.SourceHullValue, source.HullValue);
        Assert.Equal(expected.Discount.SourceModulesValue, source.ModulesValue);
        Assert.Equal(expected.Discount.SourceRebuy, source.Rebuy);
    }

    /// <summary>Each way one capture's own credits fail to be a property of the build.</summary>
    /// <remarks>
    /// A capture states what one commander paid at one market. The hull is quoted with its
    /// stock fittings, the modules that came with the hull are given no price at all, and
    /// the rest were bought at whatever discount the shipyard offered. Each is a separate
    /// reason none of the figures is carried through, and each is pinned where the fixture
    /// states it.
    /// </remarks>
    [Theory]
    [MemberData(nameof(CapturedBuilds))]
    public void ACapturesOwnCreditsDivergeFromRetailForTheReasonsTheFixturePins(string name)
    {
        BuildCaseFixture expected = Case(name);
        DiscountFixture discount = expected.Discount;
        ShipLoadout build = Read(expected.Build);
        LoadoutEvent capture = Capture(expected.Build);
        LoadoutEvent recomputed = build.ToLoadoutEvent();
        Ship hull = ShipCatalogue.FindBySymbol(build.ShipSymbol)!;

        Assert.Equal(discount.SourceHullValue, capture.HullValue);
        Assert.Equal(discount.SourceModulesValue, capture.ModulesValue);
        Assert.Equal(discount.SourceRebuy, capture.Rebuy);

        // The game quotes the hull with its stock fittings. This library quotes the bare
        // hull, which is the lower of the two figures the catalogue carries.
        if (discount.HullRetailCost is double retail)
        {
            Assert.Equal(retail, hull.RetailCost);
            Assert.True(recomputed.HullValue < retail);
        }

        if (discount.HullCost is double bare)
        {
            Assert.Equal(bare, hull.HullCost);
            Assert.Equal(bare, recomputed.HullValue);
            Assert.True(discount.SourceHullValue < bare);
            Assert.True(bare < discount.HullRetailCost);
        }

        // The modules the hull came with are given no price at all, so pricing them at list
        // is what puts this library's total above the capture's own.
        if (discount.UnpricedInSource.Count > 0)
        {
            Assert.Equal(discount.UnpricedInSource, UnpricedOutfitting(capture));
            Assert.True(recomputed.ModulesValue > discount.SourceModulesValue);
        }

        // The rest were bought at one flat fraction of list.
        if (discount.PricedInSource is int priced)
        {
            List<LoadoutModule> quoted = [];
            foreach (LoadoutModule module in capture.Modules)
            {
                if (module.Value is not null) quoted.Add(module);
            }

            Assert.Equal(priced, quoted.Count);
            foreach (LoadoutModule module in quoted)
            {
                double list = ModuleCatalogue.FindBySymbol(module.Item)!.Cost!.Value;
                double paid = Math.Abs(module.Value!.Value - (list * discount.ModuleDiscount!.Value));
                Assert.True(
                    paid <= discount.ModuleDiscountToleranceCr,
                    $"{module.Item} paid {module.Value}");
            }
        }

        // And a capture's own rebuy need not even be the share of its own figures that the
        // game charges, so it cannot be reconciled at all.
        if (discount.RebuyFromOwnFigures is double own)
        {
            Assert.Equal(
                own,
                Math.Truncate(
                    (capture.HullValue!.Value + capture.ModulesValue!.Value)
                        * Fixture.RebuyFraction));
            Assert.NotEqual(own, discount.SourceRebuy);
        }
    }

    /// <summary>The outfitting mounts a capture gave no price, cosmetics left out.</summary>
    private static List<string> UnpricedOutfitting(LoadoutEvent capture)
    {
        string[] cosmetic =
            ["PaintJob", "Ship", "Bobble", "Decal", "Weapon", "Engine", "Vessel"];
        List<string> unpriced = [];
        foreach (LoadoutModule module in capture.Modules)
        {
            if (module.Value is not null) continue;

            bool decoration = false;
            foreach (string prefix in cosmetic)
            {
                if (module.Slot.StartsWith(prefix, StringComparison.Ordinal)) decoration = true;
            }

            if (!decoration) unpriced.Add(module.Slot);
        }

        return unpriced;
    }

    [Fact]
    public void AnExportsPhysicalFiguresReproduceTheSourceExportsOwn()
    {
        BuildCaseFixture expected = Fixture.DeepBlack;
        LoadoutEvent capture = Capture(expected.Build);

        LoadoutEvent exported = Read(expected.Build).ToLoadoutEvent();

        foreach (string figure in expected.PhysicalFiguresMatchSource)
        {
            switch (figure)
            {
                case "UnladenMass":
                    Assert.Equal(Stored(capture.UnladenMass), Stored(exported.UnladenMass));
                    break;
                case "CargoCapacity":
                    Assert.Equal(Stored(capture.CargoCapacity), Stored(exported.CargoCapacity));
                    break;
                case "MaxJumpRange":
                    Assert.Equal(Stored(capture.MaxJumpRange), Stored(exported.MaxJumpRange));
                    break;
                case "FuelCapacity":
                    Assert.Equal(capture.FuelCapacity, exported.FuelCapacity);
                    break;
                default:
                    throw new InvalidOperationException($"No such figure: {figure}.");
            }
        }
    }

    [Fact]
    public void TheRebuyIsAShareOfTheHullAndTheModulesTogether()
    {
        LoadoutEvent exported = Read(Fixture.DeepBlack.Build).ToLoadoutEvent();

        double priced = exported.HullValue!.Value + exported.ModulesValue!.Value;
        Assert.Equal(Math.Floor(priced * Fixture.RebuyFraction), exported.Rebuy);
    }

    [Fact]
    public void TheModulesComeInTheOrderTheyWereFitted()
    {
        LoadoutEvent exported = Read(Fixture.DeepBlack.Build).ToLoadoutEvent();

        List<string> order = [];
        foreach (LoadoutModule module in exported.Modules) order.Add(module.Slot);
        Assert.Equal(Fixture.DeepBlack.FittedOrder, order);
    }

    [Fact]
    public void TheModulesComeInTheHullsOwnLayoutOrderWhereTheOptionsAskForIt()
    {
        LoadoutEvent exported = Read(Fixture.DeepBlack.Build).ToLoadoutEvent(
            new LoadoutExportOptions { ModuleOrder = LoadoutModuleOrder.Slots });

        List<string> order = [];
        foreach (LoadoutModule module in exported.Modules) order.Add(module.Slot);
        Assert.Equal(Fixture.DeepBlack.SlotOrder, order);
    }

    [Fact]
    public void AnEditRecomputesEveryFigureRatherThanAdjustingTheStatedOnes()
    {
        AfterEditFixture edit = Fixture.DeepBlack.AfterEdit!;
        ShipLoadout build = Read(Fixture.DeepBlack.Build);
        OutfittingModule article = ModuleCatalogue.FindBySymbol(edit.Item)!;

        build.SetModule(edit.Slot, article);

        Assert.Equal(edit.TopLevelKeys, KeysOf(Exported(build)));
        AssertFigures(build.ToLoadoutEvent(), edit.Recomputed);
    }

    [Fact]
    public void ABuildPutTogetherHereExportsEveryFigureItCanCompute()
    {
        ShipLoadout build = Assembled();

        JsonElement exported = Exported(build);

        Assert.Equal(Fixture.Assembled.TopLevelKeys, KeysOf(exported));
        AssertFigures(build.ToLoadoutEvent(), Fixture.Assembled.Recomputed);
        foreach (string omitted in Fixture.Assembled.OmittedKeys)
        {
            Assert.False(exported.TryGetProperty(omitted, out _));
        }
    }

    [Fact]
    public void EachExportedModuleCarriesThePriceItWasCountedAt()
    {
        JsonElement exported = Exported(Assembled());

        AssertModules(Fixture.Assembled.Modules, exported.GetProperty("Modules"));
    }

    [Fact]
    public void AnExportStatesThePowerOfEveryModuleWhereTheOptionsAskForIt()
    {
        JsonElement exported = Exported(
            Assembled(), new LoadoutExportOptions { ExplicitPower = true });

        AssertModules(
            Fixture.Assembled.ModulesWithExplicitPower, exported.GetProperty("Modules"));
    }

    [Fact]
    public void ABuildPutTogetherHereReadsBackThroughTheExportFormat()
    {
        string text = Assembled().ToSlefString(new SlefExportOptions(TestHeader));

        IReadOnlyList<SlefEntry> parsed = Slef.Parse(text);

        Assert.Equal(Fixture.Assembled.Recomputed.Ship, parsed[0].Data.Ship);
        Assert.Equal(Fixture.Assembled.Modules.Count, parsed[0].Data.Modules.Count);
    }

    [Fact]
    public void ACapturesOwnJournalBookkeepingReachesNoExport()
    {
        JournalFieldExclusionsFixture excluded = Fixture.JournalFieldExclusions;

        JsonElement exported = Exported(Read(excluded.TopLevelBuild));

        foreach (string dropped in excluded.TopLevel)
        {
            Assert.False(exported.TryGetProperty(dropped, out _));
        }
    }

    [Fact]
    public void TheEngineerWhoAppliedARecipeReachesNoExport()
    {
        JournalFieldExclusionsFixture excluded = Fixture.JournalFieldExclusions;

        JsonElement exported = Exported(Read(excluded.EngineeringBuild));

        int engineered = 0;
        foreach (JsonElement module in exported.GetProperty("Modules").EnumerateArray())
        {
            if (!module.TryGetProperty("Engineering", out JsonElement engineering)) continue;

            engineered++;
            foreach (string dropped in excluded.Engineering)
            {
                Assert.False(engineering.TryGetProperty(dropped, out _));
            }

            Assert.True(engineering.TryGetProperty("BlueprintName", out _));
        }

        Assert.NotEqual(0, engineered);
    }

    private static ShipLoadout Assembled()
    {
        ShipLoadout build = ShipLoadout.Empty(Fixture.Assembled.Ship);
        foreach (KeyValuePair<string, string> entry in Fixture.Assembled.Fit)
        {
            build.SetModule(entry.Key, ModuleCatalogue.FindBySymbol(entry.Value)!);
        }

        return build;
    }

    private static void AssertModules(List<JsonElement> expected, JsonElement exported)
    {
        Assert.Equal(expected.Count, exported.GetArrayLength());
        for (int index = 0; index < expected.Count; index++)
        {
            JsonElement wanted = expected[index];
            JsonElement written = exported[index];
            Assert.Equal(KeysOf(wanted), KeysOf(written));
            foreach (JsonProperty property in wanted.EnumerateObject())
            {
                Assert.Equal(
                    property.Value.GetRawText(),
                    written.GetProperty(property.Name).GetRawText());
            }
        }
    }
    [Fact]
    public void EveryLoadedWeaponWasCapturedSittingAtTheCapacityTheCatalogueGivesIt()
    {
        BuildCaseFixture stated = Fixture.PythonMkII;
        LoadoutEvent capture = Capture(stated.Build);
        ShipLoadout build = ShipLoadout.FromLoadout(capture);

        Assert.NotEmpty(stated.Ammunition!.Loaded);
        foreach (LoadedWeaponFixture loaded in stated.Ammunition.Loaded)
        {
            // The rounds themselves are read off the capture. A rearm state is not part of
            // a build, so a fitted module carries no count of what was loaded.
            LoadoutModule armed = Assert.Single(
                capture.Modules,
                module => string.Equals(
                    module.Item, loaded.Symbol, StringComparison.OrdinalIgnoreCase));

            // Both weapons were at capacity, so what the game reported loaded is an outside
            // reading of the magazine and the reserve the catalogue gives them.
            AmmunitionCapacity capacity = build.FittedModuleAt(armed.Slot)!.Ammunition!;
            Assert.Equal(loaded.AmmoInClip, capacity.ClipSize);
            Assert.Equal(loaded.AmmoInHopper, capacity.Hopper);
            Assert.Equal(loaded.AmmoInClip + loaded.AmmoInHopper, capacity.Total);
            Assert.False(capacity.Unlimited);
        }
    }

}
