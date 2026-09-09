using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// The experimental-effect cost catalogue: one-application material shopping lists, kept apart
/// from the effect mechanics so a caller who only prices an effect loads neither the mechanics
/// nor a whole build.
/// </summary>
/// <remarks>
/// Its identifiers match <see cref="ExperimentalEffectCatalogue.All"/> exactly. Data comes from
/// EDSY, with the combat effects' costs from the Inara registry; see
/// <c>data/ships/SOURCES.md</c> for provenance.
/// </remarks>
public static class ExperimentalEffectCosts
{
    private static readonly Lazy<IReadOnlyDictionary<string, IReadOnlyList<EngineeringMaterial>>> Costs =
        new(Load);

    /// <summary>
    /// Every effect's one-application material list, keyed by Frontier symbol. Lookups ignore
    /// case.
    /// </summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<EngineeringMaterial>> All => Costs.Value;

    /// <summary>Finds an experimental effect's one-application material cost.</summary>
    /// <param name="experimentalEffectSymbol">
    /// The effect identifier, such as <c>special_fsd_heavy</c>. Leading and trailing whitespace
    /// and case are ignored.
    /// </param>
    /// <returns>The material list, or <see langword="null"/> when the effect is unknown.</returns>
    /// <remarks>
    /// Materials are the whole cost: an experimental effect charges no Merc Coin, unlike the
    /// blueprints in <see cref="BlueprintCosts"/>.
    /// </remarks>
    public static IReadOnlyList<EngineeringMaterial>? Find(string? experimentalEffectSymbol) =>
        RegistryIndex.FindInKeyIndex(All, experimentalEffectSymbol);

    private static ReadOnlyDictionary<string, IReadOnlyList<EngineeringMaterial>> Load()
    {
        Dictionary<string, EngineeringMaterial[]> raw =
            SharedData.Load<Dictionary<string, EngineeringMaterial[]>>(
                "data/ships/experimental-effect-costs.jsonc");
        Dictionary<string, IReadOnlyList<EngineeringMaterial>> frozen = new(raw.Count, StringComparer.Ordinal);
        foreach (KeyValuePair<string, EngineeringMaterial[]> entry in raw)
        {
            frozen[entry.Key] = ReadOnlyLists.Freeze(entry.Value);
        }

        return RegistryIndex.FreezeByRawKey<IReadOnlyList<EngineeringMaterial>>(frozen);
    }
}
