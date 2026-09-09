using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// The blueprint mechanics catalogue: every engineering blueprint's per-grade stat modifiers,
/// keyed by the blueprint's Frontier symbol as a journal loadout event carries it.
/// </summary>
/// <remarks>
/// <para>
/// Three keys collide, because the game writes one identifier for two recipes that roll
/// different numbers. <c>Scanner_LongRange</c> and <c>Scanner_WideAngle</c> are the utility
/// scanners' recipes, which the game writes as <c>Sensor_LongRange</c> and
/// <c>Sensor_WideAngle</c>, the identifiers it also writes for the sensor suites' own recipes of
/// the same name. <c>MC_Overcharged</c> is the multi-cannon Overcharged, which cuts the clip
/// where the <c>Weapon_Overcharged</c> every other weapon menu lists leaves it alone.
/// <see cref="BlueprintJournal"/> settles a journal identifier against the fitted module.
/// </para>
/// <para>
/// Further keys are the Operations identifiers: recipes a module is sold carrying, and the four
/// Operations recipes a player rolls at an engineer. No journal spelling has been observed for
/// those, which is a gap in the evidence rather than a claim that the game writes none.
/// </para>
/// <para>
/// Every recipe is keyed once. Anti-Guardian Zone Resistance is <c>GuardianModule_Sturdy</c>,
/// the identifier the game writes on Guardian weapons as well as on Guardian modules.
/// </para>
/// <para>
/// Material shopping lists live in <see cref="BlueprintCosts"/>, so applying a recipe does not
/// load what it costs. Data comes from EDCD coriolis-data with journal labels resolved against
/// EDSY; see <c>data/ships/SOURCES.md</c> for provenance.
/// </para>
/// </remarks>
public static class BlueprintCatalogue
{
    private static readonly Lazy<IReadOnlyDictionary<string, Blueprint>> Blueprints = new(Load);

    /// <summary>Every blueprint, keyed by Frontier symbol. Lookups ignore case.</summary>
    public static IReadOnlyDictionary<string, Blueprint> All => Blueprints.Value;

    /// <summary>Finds a blueprint by its Frontier symbol.</summary>
    /// <param name="blueprintSymbol">
    /// The blueprint identifier, such as <c>FSD_LongRange</c>. Leading and trailing whitespace
    /// and case are ignored.
    /// </param>
    /// <returns>
    /// The blueprint, or <see langword="null"/> when this catalogue stores none under that
    /// identifier. An absent identifier is not always an unknown one: the game writes the
    /// grade-5 decorative identities of festive pre-engineered variants in the same field, and
    /// those name no craftable recipe.
    /// </returns>
    public static Blueprint? Find(string? blueprintSymbol) =>
        RegistryIndex.FindInKeyIndex(All, blueprintSymbol);

    /// <summary>Finds one complete grade of a blueprint.</summary>
    /// <param name="blueprintSymbol">The blueprint identifier. Whitespace and case are ignored.</param>
    /// <param name="grade">The grade, from 1 through 5.</param>
    /// <returns>
    /// The grade's modifier features and converted damage distribution, or
    /// <see langword="null"/> when this catalogue holds no such blueprint or grade.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// <paramref name="grade"/> is outside 1 through 5.
    /// </exception>
    public static BlueprintGrade? FindGrade(string? blueprintSymbol, int grade)
    {
        if (grade is < 1 or > 5)
        {
            throw new ArgumentOutOfRangeException(nameof(grade), grade, "The grade must be from 1 through 5.");
        }

        Blueprint? blueprint = Find(blueprintSymbol);
        if (blueprint is null) return null;
        return blueprint.Grades.TryGetValue(grade, out BlueprintGrade? found) ? found : null;
    }

    private static ReadOnlyDictionary<string, Blueprint> Load()
    {
        Dictionary<string, Blueprint> raw =
            SharedData.Load<Dictionary<string, Blueprint>>("data/ships/blueprints.jsonc");
        Dictionary<string, Blueprint> frozen = new(raw.Count, StringComparer.Ordinal);
        foreach (KeyValuePair<string, Blueprint> entry in raw)
        {
            Dictionary<int, BlueprintGrade> grades = new(entry.Value.Grades.Count);
            foreach (KeyValuePair<int, BlueprintGrade> grade in entry.Value.Grades)
            {
                grades[grade.Key] = grade.Value with { Features = ReadOnlyLists.Freeze(grade.Value.Features) };
            }

            frozen[entry.Key] = entry.Value with
            {
                Grades = new ReadOnlyDictionary<int, BlueprintGrade>(grades),
            };
        }

        return RegistryIndex.FreezeByRawKey<Blueprint>(frozen);
    }
}
