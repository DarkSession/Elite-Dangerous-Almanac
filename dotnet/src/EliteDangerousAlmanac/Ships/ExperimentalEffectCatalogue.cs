using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// The experimental-effect mechanics catalogue: each special effect's stat modifiers and
/// behaviour, keyed by the effect's Frontier symbol as a journal loadout event carries it.
/// </summary>
/// <remarks>
/// Material shopping lists live in <see cref="ExperimentalEffectCosts"/>, so applying an effect
/// does not load what it costs. Data comes from EDSY, which is the registry carrying the
/// numeric experimental modifiers; see <c>data/ships/SOURCES.md</c> for provenance.
/// </remarks>
public static class ExperimentalEffectCatalogue
{
    private static readonly Lazy<IReadOnlyDictionary<string, ExperimentalEffect>> Effects = new(Load);

    /// <summary>Every experimental effect, keyed by Frontier symbol. Lookups ignore case.</summary>
    public static IReadOnlyDictionary<string, ExperimentalEffect> All => Effects.Value;

    /// <summary>Finds an experimental effect by its Frontier symbol.</summary>
    /// <param name="experimentalEffectSymbol">
    /// The effect identifier, such as <c>special_fsd_heavy</c>. Leading and trailing whitespace
    /// and case are ignored.
    /// </param>
    /// <returns>The effect, or <see langword="null"/> when the identifier is unknown.</returns>
    public static ExperimentalEffect? Find(string? experimentalEffectSymbol) =>
        RegistryIndex.FindInKeyIndex(All, experimentalEffectSymbol);

    private static ReadOnlyDictionary<string, ExperimentalEffect> Load()
    {
        Dictionary<string, ExperimentalEffect> raw =
            SharedData.Load<Dictionary<string, ExperimentalEffect>>("data/ships/experimental-effects.jsonc");
        Dictionary<string, ExperimentalEffect> frozen = new(raw.Count, StringComparer.Ordinal);
        foreach (KeyValuePair<string, ExperimentalEffect> entry in raw)
        {
            frozen[entry.Key] = entry.Value with { Modifiers = ReadOnlyLists.Freeze(entry.Value.Modifiers) };
        }

        return RegistryIndex.FreezeByRawKey<ExperimentalEffect>(frozen);
    }
}
