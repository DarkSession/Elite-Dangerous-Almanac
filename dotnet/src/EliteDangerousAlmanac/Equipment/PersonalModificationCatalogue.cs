using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Equipment.Internal;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>What a personal modification is fitted to.</summary>
public enum PersonalModificationTarget
{
    /// <summary>A suit.</summary>
    Suit,

    /// <summary>A weapon.</summary>
    Weapon,
}

/// <summary>One permanent modification a Pioneer Supplies engineer fits.</summary>
/// <param name="Name">The display name, such as <c>Added Melee Damage</c>.</param>
/// <param name="Target">What the modification is fitted to.</param>
/// <param name="Engineers">The engineers who offer it, by their display names.</param>
/// <param name="Modifiers">
/// The stat changes the modification makes. A recipe bought for its unlock alone, such as
/// the weapon scope, states none.
/// </param>
public sealed record PersonalModification(
    string Name,
    PersonalModificationTarget Target,
    IReadOnlyList<string> Engineers,
    IReadOnlyList<PersonalModifier> Modifiers);

/// <summary>The personal-modification recipes and what each one costs.</summary>
/// <remarks>
/// <para>
/// A recipe is keyed by its symbol, such as <c>suit_increasedmeleedamage</c>. The
/// symbol a journal writes is not always the recipe's own: three weapon recipes share one
/// journal spelling across the kinetic, laser and plasma menus, and
/// <see cref="ModificationJournal"/> resolves that spelling against the weapon it was
/// read from.
/// </para>
/// <para>
/// The catalogues load from their shared data files on first use. Every record is
/// immutable, so one caller cannot change another caller's answers.
/// </para>
/// </remarks>
public static class PersonalModificationCatalogue
{
    private static readonly Lazy<IReadOnlyDictionary<string, PersonalModification>> Recipes =
        new(BuildRecipes);

    private static readonly Lazy<IReadOnlyDictionary<string, IReadOnlyList<PersonalEngineeringIngredient>>>
        Costs = new(BuildCosts);

    private static readonly Lazy<IReadOnlyDictionary<string, string>> Spellings = new(BuildSpellings);

    /// <summary>Every modification recipe, keyed by its symbol.</summary>
    public static IReadOnlyDictionary<string, PersonalModification> All => Recipes.Value;

    /// <summary>Every recipe's materials, keyed by the recipe's symbol.</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<PersonalEngineeringIngredient>> AllCosts =>
        Costs.Value;

    /// <summary>Reads the catalogue's own spelling of one recipe symbol.</summary>
    /// <param name="symbol">The symbol, in any spelling.</param>
    /// <returns>
    /// The key the catalogue carries, or <see langword="null"/> for a symbol no recipe
    /// carries. A fitted modification reports this rather than the journal's spelling, so
    /// two builds that state one recipe differently still compare equal.
    /// </returns>
    internal static string? CanonicalSymbol(string? symbol)
    {
        string? key = RegistryIndex.NormalizeKey(symbol);
        if (string.IsNullOrEmpty(key)) return null;
        return Spellings.Value.TryGetValue(key!, out string? canonical) ? canonical : null;
    }

    /// <summary>Finds a modification recipe by its symbol.</summary>
    /// <param name="symbol">The symbol, such as <c>weapon_scope</c>.</param>
    /// <returns>The recipe, or <see langword="null"/> for a symbol no recipe carries.</returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent symbol is a miss.</remarks>
    public static PersonalModification? Find(string? symbol) =>
        RegistryIndex.FindInKeyIndex(Recipes.Value, symbol);

    /// <summary>Finds what one modification recipe costs.</summary>
    /// <param name="symbol">The recipe's symbol, such as <c>weapon_scope</c>.</param>
    /// <returns>
    /// The materials the recipe asks for, or <see langword="null"/> for a symbol no recipe
    /// carries.
    /// </returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent symbol is a miss.</remarks>
    public static IReadOnlyList<PersonalEngineeringIngredient>? FindCost(string? symbol) =>
        RegistryIndex.FindInKeyIndex(Costs.Value, symbol);

    private static ReadOnlyDictionary<string, PersonalModification> BuildRecipes()
    {
        Dictionary<string, PersonalModificationRecord> records =
            SharedData.Load<Dictionary<string, PersonalModificationRecord>>(
                "data/equipment/modifications.jsonc");

        Dictionary<string, PersonalModification> recipes =
            new(records.Count, RegistryIndex.KeyComparer);
        foreach (KeyValuePair<string, PersonalModificationRecord> record in records)
        {
            List<PersonalModifier> modifiers = new(record.Value.Modifiers.Count);
            foreach (PersonalModifierRecord modifier in record.Value.Modifiers)
            {
                modifiers.Add(new PersonalModifier(
                    modifier.Stat, modifier.Multiplier, modifier.RoundUp));
            }

            recipes[record.Key] = new PersonalModification(
                record.Value.Name,
                EquipmentEnums.Require<PersonalModificationTarget>(
                    record.Value.Target, "a target", record.Key),
                ReadOnlyLists.Freeze(record.Value.Engineers),
                new ReadOnlyCollection<PersonalModifier>(modifiers));
        }

        return new ReadOnlyDictionary<string, PersonalModification>(recipes);
    }

    private static ReadOnlyDictionary<string, string> BuildSpellings()
    {
        Dictionary<string, string> spellings = new(Recipes.Value.Count, RegistryIndex.KeyComparer);
        foreach (KeyValuePair<string, PersonalModification> recipe in Recipes.Value)
        {
            spellings[recipe.Key] = recipe.Key;
        }

        return new ReadOnlyDictionary<string, string>(spellings);
    }

    private static ReadOnlyDictionary<string, IReadOnlyList<PersonalEngineeringIngredient>> BuildCosts()
    {
        Dictionary<string, List<PersonalIngredientRecord>> records =
            SharedData.Load<Dictionary<string, List<PersonalIngredientRecord>>>(
                "data/equipment/modification-costs.jsonc");

        Dictionary<string, IReadOnlyList<PersonalEngineeringIngredient>> costs =
            new(records.Count, RegistryIndex.KeyComparer);
        foreach (KeyValuePair<string, List<PersonalIngredientRecord>> record in records)
        {
            costs[record.Key] = EquipmentCosts.Compose(record.Value);
        }

        return new ReadOnlyDictionary<string, IReadOnlyList<PersonalEngineeringIngredient>>(costs);
    }
}
