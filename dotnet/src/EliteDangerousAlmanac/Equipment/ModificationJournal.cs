using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>Resolves the modification symbol a journal writes onto its own recipe.</summary>
/// <remarks>
/// Nine weapon recipes are written under a shorter shared spelling: the game writes
/// <c>weapon_range</c> for the kinetic, laser and plasma recipes alike. The weapon the
/// symbol was read from names the menu, and its engineering type picks the recipe out of
/// the group.
/// </remarks>
public static class ModificationJournal
{
    private static readonly Lazy<IReadOnlyDictionary<string, string>> JournalNames = new(
        () => SharedData.Load<Dictionary<string, string>>(
            "data/equipment/modification-journal-names.jsonc"));

    /// <summary>Resolves one journal modification symbol against the weapon that carries it.</summary>
    /// <param name="weaponSymbol">The weapon's item symbol.</param>
    /// <param name="journalSymbol">The modification symbol as the journal writes it.</param>
    /// <returns>
    /// The recipe symbol the catalogue is keyed by, or the journal symbol unchanged where no
    /// weapon carries the symbol, or the journal spelling names one recipe already.
    /// </returns>
    /// <exception cref="ArgumentNullException">The journal symbol is absent.</exception>
    public static string ResolveForWeapon(string? weaponSymbol, string journalSymbol)
    {
        if (journalSymbol is null) throw new ArgumentNullException(nameof(journalSymbol));

        string wanted = journalSymbol.Trim();
        PersonalWeapon? weapon = PersonalWeaponCatalogue.FindBySymbol(weaponSymbol);
        if (weapon is null) return journalSymbol;

        string suffix = "_" + weapon.EngineeringType.ToString().ToLowerInvariant();
        foreach (KeyValuePair<string, string> entry in JournalNames.Value)
        {
            if (string.Equals(entry.Value, wanted, StringComparison.OrdinalIgnoreCase)
                && entry.Key.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                return entry.Key;
            }
        }

        return journalSymbol;
    }
}
