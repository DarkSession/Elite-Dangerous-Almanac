using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>What one engineering step costs: the materials it consumes and the Merc Coin it bills.</summary>
/// <param name="Materials">
/// Every material the step consumes. One entry per distinct material, each count already
/// multiplied out for however many rolls the step covers.
/// </param>
/// <param name="MercCoins">
/// The Merc Coin the step bills, weighted for its rolls exactly as the material counts are.
/// It is zero where the recipe charges no currency, and zero where this step covers no charging
/// grade, so reading zero as "this blueprint never charges Merc Coin" is wrong on every recipe
/// that does. Merc Coin has no credit equivalent and is not a material, which is why it is its
/// own member.
/// </param>
public sealed record BlueprintCost(IReadOnlyList<EngineeringMaterial> Materials, int MercCoins);

/// <summary>
/// The blueprint cost catalogue: material shopping lists kept apart from blueprint mechanics, so
/// a caller who only prices a recipe loads neither the mechanics nor a whole build.
/// </summary>
/// <remarks>
/// Its identifiers and grade sets are the craftable subset of <see cref="BlueprintCatalogue"/>.
/// A fixed reward identity has mechanics but no ordinary craft route, and is absent here. Data
/// comes from EDCD coriolis-data, with the Operations and Anti-Guardian recipes from the Inara
/// registry and Frontier's update notes; see <c>data/ships/SOURCES.md</c> for provenance.
/// </remarks>
public static class BlueprintCosts
{
    private static readonly Lazy<IReadOnlyDictionary<string, IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>>> Materials =
        new(LoadMaterials);

    private static readonly Lazy<IReadOnlyDictionary<string, IReadOnlyDictionary<int, int>>> MercCoins =
        new(LoadMercCoins);

    /// <summary>
    /// Every craftable blueprint's per-roll material recipes, keyed by Frontier symbol and then
    /// by grade. Lookups on the outer map ignore case.
    /// </summary>
    public static IReadOnlyDictionary<string, IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>> All =>
        Materials.Value;

    /// <summary>
    /// The Merc Coin charged per roll by every blueprint that charges any, keyed by Frontier
    /// symbol and then by grade. Lookups on the outer map ignore case.
    /// </summary>
    /// <remarks>
    /// A small subset of <see cref="All"/>'s identifiers, in two shapes. Most are the bespoke
    /// grade 2 through 5 recipes that only a Mercenary article, bought already at grade 1, can
    /// be taken through. The others are ordinary engineering-menu recipes spanning grades 1
    /// through 5 that bill the currency too. Every other blueprint is absent rather than zero.
    /// </remarks>
    public static IReadOnlyDictionary<string, IReadOnlyDictionary<int, int>> MercCoinCosts => MercCoins.Value;

    /// <summary>Finds all per-grade material recipes for one blueprint.</summary>
    /// <param name="blueprintSymbol">
    /// The blueprint identifier, such as <c>FSD_LongRange</c>. Leading and trailing whitespace
    /// and case are ignored.
    /// </param>
    /// <returns>
    /// The grade-to-material-list map, or <see langword="null"/> when no ordinary craft cost is
    /// catalogued, a known fixed reward identity included.
    /// </returns>
    /// <remarks>
    /// The material half only. Use <see cref="FindGradeCost"/> or <see cref="FindClimbCost"/> to
    /// get both halves of a cost together.
    /// </remarks>
    public static IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>? Find(string? blueprintSymbol) =>
        RegistryIndex.FindInKeyIndex(All, blueprintSymbol);

    /// <summary>Finds what one roll at one blueprint grade costs.</summary>
    /// <param name="blueprintSymbol">The blueprint identifier. Whitespace and case are ignored.</param>
    /// <param name="grade">The grade, from 1 through 5.</param>
    /// <returns>
    /// The materials one roll consumes and the Merc Coin it bills, or <see langword="null"/>
    /// when no ordinary craft cost is catalogued for that blueprint and grade.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// <paramref name="grade"/> is outside 1 through 5.
    /// </exception>
    public static BlueprintCost? FindGradeCost(string? blueprintSymbol, int grade)
    {
        if (grade is < 1 or > 5)
        {
            throw new ArgumentOutOfRangeException(nameof(grade), grade, "The grade must be from 1 through 5.");
        }

        IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>? costs = Find(blueprintSymbol);
        if (costs is null || !costs.TryGetValue(grade, out IReadOnlyList<EngineeringMaterial>? materials))
        {
            return null;
        }

        IReadOnlyDictionary<int, int>? currency = RegistryIndex.FindInKeyIndex(MercCoinCosts, blueprintSymbol);
        int mercCoins = currency is not null && currency.TryGetValue(grade, out int charged) ? charged : 0;
        return new BlueprintCost(materials, mercCoins);
    }

    /// <summary>
    /// Computes the total cost of engineering a module up to a grade: every grade it still has
    /// to climb, each rolled the number of times it takes to complete, summed into one shopping
    /// list and one Merc Coin total.
    /// </summary>
    /// <param name="blueprintSymbol">The blueprint identifier. Whitespace and case are ignored.</param>
    /// <param name="grade">The target grade, from 1 through 5.</param>
    /// <param name="currentGrade">
    /// The completed grade, from 0 through 5, which defaults to 0 for an unengineered module.
    /// Only the grades above it are charged, so a completed grade at or above the target costs
    /// nothing.
    /// </param>
    /// <returns>
    /// The summed materials and Merc Coin total, or <see langword="null"/> when no ordinary
    /// craft cost is catalogued for the blueprint and target grade. A blueprint that starts
    /// above grade 1 charges only the grades it defines.
    /// </returns>
    /// <remarks>
    /// <para>
    /// Grade N takes N rolls to fill its progress bar, and each roll costs that grade's recipe
    /// once, so the climb is weighted rather than a plain sum, for the materials and the Merc
    /// Coin alike. To price one grade's complete progression, set the completed grade to one
    /// below the target; use <see cref="FindGradeCost"/> for a single roll.
    /// </para>
    /// <para>
    /// A Mercenary article is bought at grade 1 and its recipe defines grades 2 through 5, so
    /// pass 1 to price what an engineer can still add.
    /// </para>
    /// <para>
    /// This is the blueprint cost alone. An experimental effect is a separate application
    /// costing materials only; fold its cost in with
    /// <see cref="Engineering.SumMaterials(IReadOnlyList{EngineeringMaterial}[])"/>.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// <paramref name="grade"/> is outside 1 through 5, or <paramref name="currentGrade"/> is
    /// outside 0 through 5.
    /// </exception>
    public static BlueprintCost? FindClimbCost(string? blueprintSymbol, int grade, int currentGrade = 0)
    {
        if (grade is < 1 or > 5)
        {
            throw new ArgumentOutOfRangeException(nameof(grade), grade, "The grade must be from 1 through 5.");
        }

        if (currentGrade is < 0 or > 5)
        {
            throw new ArgumentOutOfRangeException(
                nameof(currentGrade), currentGrade, "The completed grade must be from 0 through 5.");
        }

        IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>? costs = Find(blueprintSymbol);
        if (costs is null || !costs.ContainsKey(grade)) return null;
        IReadOnlyDictionary<int, int>? currency = RegistryIndex.FindInKeyIndex(MercCoinCosts, blueprintSymbol);

        List<IReadOnlyList<EngineeringMaterial>> perGrade = [];
        int mercCoins = 0;
        for (int climbed = currentGrade + 1; climbed <= grade; climbed++)
        {
            if (!costs.TryGetValue(climbed, out IReadOnlyList<EngineeringMaterial>? recipe)) continue;

            // Grade N takes N rolls, and each roll costs the grade's recipe once.
            int rolls = climbed;
            if (currency is not null && currency.TryGetValue(climbed, out int charged)) mercCoins += charged * rolls;
            List<EngineeringMaterial> weighted = new(recipe.Count);
            foreach (EngineeringMaterial material in recipe)
            {
                weighted.Add(material with { Count = material.Count * rolls });
            }

            perGrade.Add(weighted);
        }

        return new BlueprintCost(Engineering.SumMaterials([.. perGrade]), mercCoins);
    }

    private static ReadOnlyDictionary<string, IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>> LoadMaterials()
    {
        Dictionary<string, Dictionary<int, EngineeringMaterial[]>> raw =
            SharedData.Load<Dictionary<string, Dictionary<int, EngineeringMaterial[]>>>(
                "data/ships/blueprint-costs.jsonc");
        Dictionary<string, IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>> frozen =
            new(raw.Count, StringComparer.Ordinal);
        foreach (KeyValuePair<string, Dictionary<int, EngineeringMaterial[]>> entry in raw)
        {
            Dictionary<int, IReadOnlyList<EngineeringMaterial>> grades = new(entry.Value.Count);
            foreach (KeyValuePair<int, EngineeringMaterial[]> grade in entry.Value)
            {
                grades[grade.Key] = ReadOnlyLists.Freeze(grade.Value);
            }

            frozen[entry.Key] = new ReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>(grades);
        }

        return RegistryIndex.FreezeByRawKey<IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>>(frozen);
    }

    private static ReadOnlyDictionary<string, IReadOnlyDictionary<int, int>> LoadMercCoins()
    {
        Dictionary<string, Dictionary<int, int>> raw =
            SharedData.Load<Dictionary<string, Dictionary<int, int>>>(
                "data/ships/blueprint-merc-coin-costs.jsonc");
        Dictionary<string, IReadOnlyDictionary<int, int>> frozen = new(raw.Count, StringComparer.Ordinal);
        foreach (KeyValuePair<string, Dictionary<int, int>> entry in raw)
        {
            frozen[entry.Key] = new ReadOnlyDictionary<int, int>(entry.Value);
        }

        return RegistryIndex.FreezeByRawKey<IReadOnlyDictionary<int, int>>(frozen);
    }
}
