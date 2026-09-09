using System;
using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The ordinary engineering menus, measured against the shared fixture.</summary>
public class EngineeringOptionsTests
{
    private static readonly EngineeringOptionsFixture Fixture =
        SharedFixtures.Load<EngineeringOptionsFixture>("fixtures/ships/engineering-options.jsonc");

    public static TheoryData<string> PinnedGroups()
    {
        TheoryData<string> data = [];
        foreach (OptionGroupFixture group in Fixture.Groups) data.Add(group.Id);
        return data;
    }

    public static TheoryData<string, string> PinnedModules()
    {
        TheoryData<string, string> data = [];
        foreach (GroupedModuleFixture module in Fixture.Modules) data.Add(module.Symbol, module.Group);
        return data;
    }

    public static TheoryData<string> UngroupedModules()
    {
        TheoryData<string> data = [];
        foreach (string symbol in Fixture.NotEngineerable) data.Add(symbol);
        return data;
    }

    [Fact]
    public void TheCatalogueHoldsTheFixturesCounts()
    {
        Assert.Equal(Fixture.Counts["groups"], EngineeringOptions.Groups.Count);
        Assert.Equal(Fixture.Counts["modules"], Grouped().Count);
        Assert.Equal(Fixture.Counts["exclusions"], Grouped().Count(module => IsShortOfItsGroup(module)));
        Assert.Equal(
            Fixture.Counts["modulesWithoutExperimental"],
            Grouped().Count(module => EngineeringOptions.ExperimentalsFor(module.Symbol).Count == 0));
        Assert.Equal(
            Fixture.Counts["blueprintsOffered"],
            EngineeringOptions.Groups.Values
                .SelectMany(group => group.Blueprints)
                .Distinct(StringComparer.Ordinal)
                .Count());
    }

    [Fact]
    public void EachGroupHoldsTheFixturesModules()
    {
        foreach (KeyValuePair<string, int> size in Fixture.GroupSizes)
        {
            EngineeringGroupId group = Group(size.Key);
            Assert.Equal(
                size.Value,
                Grouped().Count(module => EngineeringOptions.GroupFor(module.Symbol) == group));
        }
    }

    [Theory]
    [MemberData(nameof(PinnedGroups))]
    public void AGroupOffersTheFixturesMenu(string id)
    {
        OptionGroupFixture pinned = Fixture.Groups.Single(group => group.Id == id);
        EngineeringOptionGroup group = EngineeringOptions.Groups[Group(id)];

        Assert.Equal(pinned.Blueprints, group.Blueprints);
        Assert.Equal(pinned.Experimentals, group.Experimentals);
    }

    [Theory]
    [MemberData(nameof(PinnedModules))]
    public void AModuleIsEngineeredAsItsGroup(string symbol, string group)
    {
        Assert.Equal(Group(group), EngineeringOptions.GroupFor(symbol));

        // The journal writes a module symbol lower-cased, and whitespace survives an export.
        Assert.Equal(Group(group), EngineeringOptions.GroupFor($"  {symbol.ToLowerInvariant()}  "));
        Assert.Equal(EngineeringOptions.Groups[Group(group)].Blueprints, EngineeringOptions.BlueprintsFor(symbol));
    }

    [Theory]
    [MemberData(nameof(UngroupedModules))]
    public void AModuleWithNoMenuAnswersEmptyRatherThanNothing(string symbol)
    {
        Assert.NotNull(ModuleCatalogue.FindBySymbol(symbol));
        Assert.Null(EngineeringOptions.GroupFor(symbol));
        Assert.Empty(EngineeringOptions.BlueprintsFor(symbol));
        Assert.Empty(EngineeringOptions.ExperimentalsFor(symbol));
    }

    [Fact]
    public void AnAbsentSymbolIsAMissRatherThanAFailure()
    {
        Assert.Null(EngineeringOptions.GroupFor(null));
        Assert.Empty(EngineeringOptions.BlueprintsFor(null));
        Assert.Empty(EngineeringOptions.ExperimentalsFor(null));
        Assert.Empty(EngineeringOptions.ExperimentalsForBlueprint(null));
        Assert.Empty(EngineeringOptions.ExperimentalsForBlueprint("not_a_blueprint"));
    }

    [Fact]
    public void AGuardianHalfIsItsOwnMenu()
    {
        foreach (SplitFamilyFixture family in Fixture.SplitFamilies)
        {
            foreach (OptionGroupFixture half in new[] { family.Ordinary, family.Guardian })
            {
                Assert.Equal(Group(half.Group), EngineeringOptions.GroupFor(half.Symbol));
                Assert.Equal(half.Blueprints, EngineeringOptions.BlueprintsFor(half.Symbol));
                Assert.Equal(half.Experimentals, EngineeringOptions.ExperimentalsFor(half.Symbol));
            }

            // Each half denies the other's recipes, which is why they are two groups.
            Assert.Empty(family.Ordinary.Blueprints.Intersect(family.Guardian.Blueprints, StringComparer.Ordinal));
            Assert.Empty(family.Guardian.Experimentals);
        }
    }

    [Fact]
    public void AnExcludedEffectLeavesTheModuleButStaysInItsGroup()
    {
        foreach (ExclusionFixture exclusion in Fixture.Exclusions)
        {
            EngineeringGroupId group = EngineeringOptions.GroupFor(exclusion.Symbol)!.Value;
            IReadOnlyList<string> offered = EngineeringOptions.ExperimentalsFor(exclusion.Symbol);
            foreach (string effect in exclusion.Excluded)
            {
                Assert.Contains(effect, EngineeringOptions.Groups[group].Experimentals);
                Assert.DoesNotContain(effect, offered);
            }

            Assert.Equal(
                EngineeringOptions.Groups[group].Experimentals.Count - exclusion.Excluded.Count,
                offered.Count);
        }
    }

    [Fact]
    public void ABlueprintsEffectsAreTheUnionOfItsGroups()
    {
        Assert.Equal(
            Fixture.BlueprintUnion.Experimentals,
            EngineeringOptions.ExperimentalsForBlueprint(Fixture.BlueprintUnion.Blueprint));
    }

    [Fact]
    public void AntiGuardianZoneResistanceIsAWholeMenuWithNoExperimentalSlot()
    {
        AntiGuardianFixture resistance = Fixture.AntiGuardianZoneResistance;

        Assert.Equal(
            resistance.Groups.Select(Group).OrderBy(group => group),
            EngineeringOptions.Groups
                .Where(group => group.Value.Blueprints.Contains(resistance.Blueprint, StringComparer.Ordinal))
                .Select(group => group.Key)
                .OrderBy(group => group));
        Assert.Equal(
            resistance.Experimentals,
            EngineeringOptions.ExperimentalsForBlueprint(resistance.Blueprint));

        foreach (string symbol in resistance.Modules)
        {
            Assert.Equal([resistance.Blueprint], EngineeringOptions.BlueprintsFor(symbol));
            Assert.Empty(EngineeringOptions.ExperimentalsFor(symbol));
        }
    }

    [Fact]
    public void EveryOfferedRecipeNamesARecordTheMechanicsCataloguesCarry()
    {
        foreach (EngineeringOptionGroup group in EngineeringOptions.Groups.Values)
        {
            foreach (string blueprint in group.Blueprints) Assert.NotNull(BlueprintCatalogue.Find(blueprint));
            foreach (string effect in group.Experimentals)
            {
                Assert.NotNull(ExperimentalEffectCatalogue.Find(effect));
            }
        }
    }

    private static bool IsShortOfItsGroup(OutfittingModule module)
    {
        EngineeringGroupId group = EngineeringOptions.GroupFor(module.Symbol)!.Value;
        return EngineeringOptions.ExperimentalsFor(module.Symbol).Count
            != EngineeringOptions.Groups[group].Experimentals.Count;
    }

    private static IReadOnlyList<OutfittingModule> Grouped() =>
        ModuleCatalogue.All.Where(module => EngineeringOptions.GroupFor(module.Symbol) is not null).ToList();

    private static EngineeringGroupId Group(string id)
    {
        Assert.True(EnumParsing.TryParse(id, out EngineeringGroupId group), $"'{id}' names no group.");
        return group;
    }
}
