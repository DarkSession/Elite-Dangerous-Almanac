using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Reads a journal blueprint name against the module it was written for.</summary>
public static class BlueprintJournal
{
    private static readonly Lazy<IReadOnlyDictionary<string, string>> JournalNames = new(
        () => RegistryIndex.FreezeByRawKey<string>(
            SharedData.Load<Dictionary<string, string>>("data/ships/blueprint-journal-names.jsonc")));

    /// <summary>Blueprint identifiers whose journal spelling collides with another recipe.</summary>
    internal static IReadOnlyDictionary<string, string> Names => JournalNames.Value;

    /// <summary>
    /// The blueprint whose numbers a module actually rolls when a journal names one on it: the
    /// same identifier back, except where the game spells two different recipes alike.
    /// </summary>
    /// <param name="moduleSymbol">
    /// A module symbol, such as <c>Hpt_CloudScanner_Size0_Class5</c>. An unknown or absent
    /// module offers no menu, so the blueprint identifier comes back unchanged.
    /// </param>
    /// <param name="blueprintSymbol">
    /// A catalogue or journal blueprint identifier, matched case-insensitively after trimming.
    /// </param>
    /// <returns>
    /// The identifier to look up in <see cref="BlueprintCatalogue"/>, in that catalogue's
    /// spelling when a journal name resolved, and otherwise <paramref name="blueprintSymbol"/>
    /// exactly as it was passed.
    /// </returns>
    /// <remarks>
    /// <para>
    /// One journal name, two recipes. Long Range and Wide Angle are offered on the internal
    /// sensor suite and on the kill warrant, manifest and wake scanners under the same
    /// identifier, and the two roll different stats in opposite directions: Long Range costs the
    /// suite mass and the scanner power draw, and Wide Angle the reverse. The same holds for
    /// Overcharged, which the game writes as <c>Weapon_Overcharged</c> for every weapon, though
    /// a multi-cannon's also cuts the clip.
    /// </para>
    /// <para>
    /// Only the module can settle it, which is why this takes one, and it resolves into a menu
    /// and never out of one: a sensor suite's own identifier comes back unchanged, and so does a
    /// scanner identifier asked of a suite. A generic identifier is left alone too, because such
    /// a pair is one recipe under two published spellings. Materials are unaffected, since both
    /// spellings of a pair bill the same at every grade.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException">
    /// <paramref name="blueprintSymbol"/> is <see langword="null"/>. This answers with an
    /// identifier rather than reporting whether one is known, so there is no miss for an absent
    /// one to be.
    /// </exception>
    public static string ResolveForModule(string? moduleSymbol, string blueprintSymbol)
    {
        if (blueprintSymbol is null) throw new ArgumentNullException(nameof(blueprintSymbol));

        string wanted = blueprintSymbol.Trim();
        IReadOnlyList<string> offered = EngineeringOptions.BlueprintsFor(moduleSymbol);

        // An identifier the menu already lists is the recipe it names. Hand back what the caller
        // wrote, so a caller who never meets the collision never sees their own spelling
        // rewritten.
        foreach (string id in offered)
        {
            if (RegistryIndex.KeyComparer.Equals(id, wanted)) return blueprintSymbol;
        }

        foreach (string id in offered)
        {
            if (Names.TryGetValue(id, out string? journalName)
                && RegistryIndex.KeyComparer.Equals(journalName, wanted))
            {
                return id;
            }
        }

        return blueprintSymbol;
    }
}
