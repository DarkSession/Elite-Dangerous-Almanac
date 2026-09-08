using System;
using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The outfitting registry, measured against the shared fixture.</summary>
public class ModuleCatalogueTests
{
    private static readonly ModulesFixture Fixture =
        SharedFixtures.Load<ModulesFixture>("fixtures/ships/modules.jsonc");

    public static TheoryData<string, int> Counts()
    {
        TheoryData<string, int> data = [];
        foreach (KeyValuePair<string, int> entry in Fixture.Counts) data.Add(entry.Key, entry.Value);
        return data;
    }

    public static TheoryData<string> PinnedModules()
    {
        TheoryData<string> data = [];
        foreach (ModuleFixtureRecord record in Fixture.Records) data.Add(record.Symbol);
        return data;
    }

    public static TheoryData<string> PinnedFamilies()
    {
        TheoryData<string> data = [];
        foreach (ModuleFamilyFixture family in Fixture.Families) data.Add(family.FamilyId);
        return data;
    }

    [Theory]
    [MemberData(nameof(Counts))]
    public void CatalogueHoldsTheFixturesCount(string catalogue, int expected) =>
        Assert.Equal(expected, CatalogueNamed(catalogue).Count);

    [Fact]
    public void AllIsTheFourCataloguesConcatenated() =>
        Assert.Equal(
            ModuleCatalogue.Core
                .Concat(ModuleCatalogue.Internal)
                .Concat(ModuleCatalogue.Hardpoint)
                .Concat(ModuleCatalogue.Utility),
            ModuleCatalogue.All);

    [Fact]
    public void EveryRecordCarriesAFamilyAndEachCatalogueUsesTheFixturesFamilies()
    {
        foreach (KeyValuePair<string, int> entry in Fixture.FamilyCounts)
        {
            Assert.Equal(entry.Value, CatalogueNamed(entry.Key).Count);
        }

        foreach (KeyValuePair<string, int> entry in Fixture.FamilyGroupCounts)
        {
            Assert.Equal(
                entry.Value,
                CatalogueNamed(entry.Key).Select(module => module.FamilyId).Distinct().Count());
        }
    }

    [Theory]
    [MemberData(nameof(PinnedFamilies))]
    public void APinnedFamilyHoldsItsMembers(string familyId)
    {
        ModuleFamilyFixture expected = Fixture.Families.Single(family => family.FamilyId == familyId);
        Assert.True(Enum.TryParse(familyId, ignoreCase: true, out OutfittingFamilyId parsed));
        List<OutfittingModule> members = [.. ModuleCatalogue.All.Where(module => module.FamilyId == parsed)];

        Assert.Equal(expected.Count, members.Count);
        Assert.All(members, module => Assert.Equal(expected.Category, module.Category.ToString(), ignoreCase: true));
        foreach (string symbol in expected.Symbols)
        {
            Assert.Contains(members, module => module.Symbol == symbol);
        }
    }

    [Theory]
    [MemberData(nameof(PinnedModules))]
    public void PinnedModulesCarryTheirFixtureIdentity(string symbol)
    {
        ModuleFixtureRecord expected = Fixture.Records.Single(record => record.Symbol == symbol);
        OutfittingModule? module = ModuleCatalogue.FindBySymbol(symbol);
        Assert.NotNull(module);

        Assert.Equal(expected.Category, module!.Category.ToString(), ignoreCase: true);
        Assert.Equal(expected.FamilyId, module.FamilyId.ToString(), ignoreCase: true);
        Assert.Equal(expected.Name, module.Name);
        Assert.Equal(expected.Class, module.Class);
        Assert.Equal(expected.Rating, module.Rating.ToString(), ignoreCase: true);
        AssertName(expected.Ship, module.Ship);
        AssertName(expected.Entitlement, module.Entitlement);
        AssertName(expected.EngineeringGroup, module.EngineeringGroup?.ToString());
        AssertName(expected.Slot, module.Slot?.ToString());
        AssertName(expected.Mount, module.Mount?.ToString());
        AssertName(expected.Guidance, module.Guidance?.ToString());
        AssertName(expected.RestrictedToSlot, module.RestrictedToSlot?.ToString());
        if (expected.RestrictedToShips is not null)
        {
            Assert.Equal(expected.RestrictedToShips, module.RestrictedToShips);
        }
    }

    [Fact]
    public void EveryFixedMountIsNamedByAsManyModulesAsTheFixtureSays()
    {
        foreach (KeyValuePair<string, int> entry in Fixture.SlotCounts)
        {
            int actual = entry.Key == "none"
                ? ModuleCatalogue.All.Count(module => module.Slot is null)
                : ModuleCatalogue.All.Count(module =>
                    module.Slot is not null
                    && string.Equals(module.Slot.ToString(), entry.Key, StringComparison.OrdinalIgnoreCase));
            Assert.Equal(entry.Value, actual);
        }
    }

    [Fact]
    public void TheExclusionGroupCountMatchesTheFixture() =>
        Assert.Equal(
            Fixture.ExclusionGroupCount,
            ModuleCatalogue.All.Count(module => module.ExclusionGroup is not null));

    [Fact]
    public void AHullsBulkheadsAreTheFixturesFiveVariants()
    {
        IReadOnlyList<OutfittingModule> bulkheads = ModuleCatalogue.BulkheadsForShip(Fixture.ShipArmour.Ship);
        Assert.Equal(Fixture.ShipArmour.Count, bulkheads.Count);
        Assert.Equal(Fixture.ShipArmour.Names, bulkheads.Select(module => module.Name));
        Assert.Empty(ModuleCatalogue.BulkheadsForShip(Fixture.ShipArmour.Ship, ModuleCatalogue.Hardpoint));
        Assert.Empty(ModuleCatalogue.BulkheadsForShip(null));
    }

    [Fact]
    public void ASymbolIsUniqueAcrossEveryCategory() =>
        Assert.Equal(
            ModuleCatalogue.All.Count,
            ModuleCatalogue.All.Select(module => module.Symbol.ToUpperInvariant()).Distinct().Count());

    [Fact]
    public void ASymbolResolvesTheWayTheJournalReportsIt()
    {
        Assert.Equal("Pulse Laser", ModuleCatalogue.FindBySymbol("hpt_pulselaser_fixed_small")?.Name);
        Assert.Equal(1, ModuleCatalogue.FindBySymbol("  Hpt_PulseLaser_Fixed_Small ")?.Class);
        Assert.Null(ModuleCatalogue.FindBySymbol(null));
        Assert.Null(ModuleCatalogue.FindBySymbol("not_a_module"));
    }

    [Fact]
    public void ADisplayNameAnswersEverySizeAndMountVariant()
    {
        IReadOnlyList<OutfittingModule> lasers = ModuleCatalogue.FindByName("pulse laser");
        Assert.NotEmpty(lasers);
        Assert.All(lasers, module => Assert.Equal("Pulse Laser", module.Name));
        Assert.Empty(ModuleCatalogue.FindByName("Pulse Laser", ModuleCatalogue.Utility));
        Assert.Empty(ModuleCatalogue.FindByName(null));
    }

    [Fact]
    public void ASubsetNarrowsASymbolLookup()
    {
        Assert.NotNull(ModuleCatalogue.FindBySymbol("Hpt_PulseLaser_Fixed_Small", ModuleCatalogue.Hardpoint));
        Assert.Null(ModuleCatalogue.FindBySymbol("Hpt_PulseLaser_Fixed_Small", ModuleCatalogue.Core));
    }

    [Fact]
    public void InCategoryAnswersTheCategorysOwnCatalogue()
    {
        Assert.Same(ModuleCatalogue.Core, ModuleCatalogue.InCategory(ModuleCategory.Core));
        Assert.Same(ModuleCatalogue.Internal, ModuleCatalogue.InCategory(ModuleCategory.Internal));
        Assert.Same(ModuleCatalogue.Hardpoint, ModuleCatalogue.InCategory(ModuleCategory.Hardpoint));
        Assert.Same(ModuleCatalogue.Utility, ModuleCatalogue.InCategory(ModuleCategory.Utility));
        Assert.Empty(ModuleCatalogue.InCategory((ModuleCategory)9));
    }

    [Fact]
    public void EveryFamilyHasACanonicalEnglishName()
    {
        foreach (OutfittingFamilyId family in Enum.GetValues<OutfittingFamilyId>())
        {
            Assert.False(string.IsNullOrWhiteSpace(family.DisplayName()));
        }

        Assert.Equal(
            Enum.GetValues<OutfittingFamilyId>().Length,
            OutfittingFamilies.All.Count);
        Assert.Throws<ArgumentOutOfRangeException>(() => ((OutfittingFamilyId)999).DisplayName());
    }

    [Fact]
    public void MountAndGuidanceAppearOnlyWhereTheyApply()
    {
        OutfittingModule dumbfire = ModuleCatalogue.FindBySymbol("Hpt_DumbfireMissileRack_Fixed_Medium")!;
        Assert.Equal(ModuleMount.Fixed, dumbfire.Mount);
        Assert.Equal(ModuleGuidance.Dumbfire, dumbfire.Guidance);

        // A pulse laser has a mount but no guidance.
        Assert.Null(ModuleCatalogue.FindBySymbol("Hpt_PulseLaser_Fixed_Small")!.Guidance);

        // A hull reinforcement package has neither.
        OutfittingModule reinforcement = ModuleCatalogue.FindBySymbol("Int_HullReinforcement_Size1_Class1")!;
        Assert.Null(reinforcement.Mount);
        Assert.Null(reinforcement.Guidance);
        Assert.Null(reinforcement.Slot);
    }

    [Fact]
    public void AGuardianHybridSitsInAnInternalCatalogueButNamesACoreMount()
    {
        OutfittingModule plant = ModuleCatalogue.FindBySymbol("Int_GuardianPowerplant_Size5")!;
        Assert.Equal(ModuleCategory.Internal, plant.Category);
        Assert.Equal(ModuleSlot.PowerPlant, plant.Slot);
        Assert.Equal(OutfittingFamilyId.GuardianHybridPowerPlants, plant.FamilyId);
    }

    [Fact]
    public void StatsAreReadableByKeyAndAbsentWhereTheModuleHasNone()
    {
        OutfittingModule laser = ModuleCatalogue.FindBySymbol("Hpt_PulseLaser_Fixed_Small")!;
        Assert.NotNull(laser.Stats[ModuleStat.Damage]);
        Assert.True(laser.Stats.Has(ModuleStat.ThermalLoad));
        Assert.Null(laser.Stats[ModuleStat.CargoCapacity]);
        Assert.NotEmpty(laser.Stats.Keys);

        OutfittingModule rack = ModuleCatalogue.FindBySymbol("Int_CargoRack_Size1_Class1")!;
        Assert.NotNull(rack.Stats[ModuleStat.CargoCapacity]);
        Assert.Null(rack.Stats[ModuleStat.Damage]);
    }

    /// <summary>
    /// Compares one optional field. A fixture record states only the fields it pins, so a field
    /// it leaves out is not a claim that the module lacks it — the tests below check absence
    /// where absence is the point.
    /// </summary>
    private static void AssertName(string? expected, string? actual)
    {
        if (expected is not null) Assert.Equal(expected, actual, ignoreCase: true);
    }

    private static IReadOnlyList<OutfittingModule> CatalogueNamed(string name) => name switch
    {
        "core" => ModuleCatalogue.Core,
        "internal" => ModuleCatalogue.Internal,
        "hardpoint" => ModuleCatalogue.Hardpoint,
        "utility" => ModuleCatalogue.Utility,
        _ => ModuleCatalogue.All,
    };
}
