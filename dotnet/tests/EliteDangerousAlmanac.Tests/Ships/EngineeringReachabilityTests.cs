using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Which recipes the availability gate lets a module reach.</summary>
/// <remarks>
/// <para>
/// The gate is what an edit asks, and it is wider than a menu: a module also reaches the
/// bespoke recipe a Mercenary article is sold carrying, and the generic spelling of a
/// recipe its menu lists under a family's own name. A recipe no module reaches by any of
/// those routes can never be applied, so the sweep pins the stranded ones as an empty
/// residue bar the identities that name articles.
/// </para>
/// <para>
/// Reaching one module is a low bar: a menu row that widened into a neighbouring family
/// still reaches something. The fixture therefore pins the recipes whose route is narrow,
/// each with a module that must take it, one that must refuse it, and how many take it.
/// </para>
/// </remarks>
public class EngineeringReachabilityTests
{
    private static readonly ReachabilityFixture Fixture =
        SharedFixtures.Load<EngineeringFixture>("fixtures/ships/engineering.jsonc").Reachability;

    public static TheoryData<string> NarrowRecipes()
    {
        TheoryData<string> data = [];
        foreach (ReachableRecipeFixture recipe in Fixture.Reachable) data.Add(recipe.Id);
        return data;
    }

    [Fact]
    public void EveryRecipeInTheCataloguesReachesAModule()
    {
        List<string> strandedBlueprints = [];
        foreach (string id in BlueprintCatalogue.All.Keys)
        {
            if (!AnyModuleTakesBlueprint(id)) strandedBlueprints.Add(id);
        }

        List<string> strandedExperimentals = [];
        foreach (string id in ExperimentalEffectCatalogue.All.Keys)
        {
            if (!AnyModuleTakesExperimental(id)) strandedExperimentals.Add(id);
        }

        strandedBlueprints.Sort(System.StringComparer.Ordinal);
        strandedExperimentals.Sort(System.StringComparer.Ordinal);
        List<string> expectedBlueprints = [.. Fixture.UnreachableBlueprints];
        List<string> expectedExperimentals = [.. Fixture.UnreachableExperimentals];
        expectedBlueprints.Sort(System.StringComparer.Ordinal);
        expectedExperimentals.Sort(System.StringComparer.Ordinal);

        Assert.Equal(expectedBlueprints, strandedBlueprints);
        Assert.Equal(expectedExperimentals, strandedExperimentals);
    }

    [Theory]
    [MemberData(nameof(NarrowRecipes))]
    public void ANarrowRecipeReachesTheModulesItBelongsToAndNoOthers(string id)
    {
        ReachableRecipeFixture recipe = Recipe(id);

        Assert.True(LoadoutEngineering.BlueprintAvailableFor(recipe.Accepts, recipe.Id));
        Assert.False(LoadoutEngineering.BlueprintAvailableFor(recipe.Refuses, recipe.Id));

        int taking = 0;
        foreach (OutfittingModule module in ModuleCatalogue.All)
        {
            if (LoadoutEngineering.BlueprintAvailableFor(module.Symbol, recipe.Id)) taking++;
        }

        Assert.Equal(recipe.Modules, taking);
    }

    private static ReachableRecipeFixture Recipe(string id)
    {
        foreach (ReachableRecipeFixture recipe in Fixture.Reachable)
        {
            if (recipe.Id == id) return recipe;
        }

        throw new KeyNotFoundException($"The fixture states no recipe '{id}'.");
    }

    private static bool AnyModuleTakesBlueprint(string id)
    {
        foreach (OutfittingModule module in ModuleCatalogue.All)
        {
            if (LoadoutEngineering.BlueprintAvailableFor(module.Symbol, id)) return true;
        }

        return false;
    }

    private static bool AnyModuleTakesExperimental(string id)
    {
        foreach (OutfittingModule module in ModuleCatalogue.All)
        {
            if (LoadoutEngineering.ExperimentalAvailableFor(module.Symbol, id)) return true;
        }

        return false;
    }
}
