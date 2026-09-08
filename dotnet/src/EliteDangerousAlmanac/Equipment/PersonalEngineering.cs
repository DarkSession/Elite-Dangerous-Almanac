using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>One material a personal engineering recipe asks for.</summary>
/// <param name="Symbol">The micro-resource symbol, such as <c>graphene</c>.</param>
/// <param name="Count">How many the recipe asks for.</param>
public sealed record PersonalEngineeringIngredient(string Symbol, int Count);

/// <summary>One stat change a personal modification makes.</summary>
/// <param name="Stat">
/// The stat the change acts on, named as the catalogue record spells it, such as
/// <c>magazineSize</c>.
/// </param>
/// <param name="Multiplier">The factor the stat is multiplied by.</param>
/// <param name="RoundUp">
/// Whether the product is taken up to the next whole number. A magazine holds whole
/// rounds, so its recipe rounds; a resistance does not.
/// </param>
public sealed record PersonalModifier(string Stat, double Multiplier, bool RoundUp = false);

/// <summary>The arithmetic Odyssey engineering does to a suit or a weapon.</summary>
/// <remarks>
/// <para>
/// A resistance is stored as the fraction of damage the layer keeps out, and a recipe
/// multiplies the damage that gets through rather than the resistance itself. A recipe
/// naming a stat whose name ends in <c>Resistance</c> is therefore applied to
/// <c>1 - resistance</c> and the result is converted back.
/// </para>
/// <para>
/// Every result is rounded to six decimal places, which is what keeps a chain of
/// multiplications from reporting a resistance a millionth away from the figure the game
/// panel shows.
/// </para>
/// </remarks>
public static class PersonalEngineering
{
    /// <summary>Adds recipes together, keeping one entry per material.</summary>
    /// <param name="recipes">The recipes to add.</param>
    /// <returns>
    /// One entry per material, in the order each material was first met. A material is
    /// matched without regard to case, and the first spelling met is the one reported.
    /// </returns>
    /// <exception cref="ArgumentNullException">A recipe, or the list of them, is absent.</exception>
    public static IReadOnlyList<PersonalEngineeringIngredient> SumIngredients(
        params IReadOnlyList<PersonalEngineeringIngredient>[] recipes)
    {
        if (recipes is null) throw new ArgumentNullException(nameof(recipes));

        List<PersonalEngineeringIngredient> totals = [];
        Dictionary<string, int> positions = new(StringComparer.OrdinalIgnoreCase);
        foreach (IReadOnlyList<PersonalEngineeringIngredient> recipe in recipes)
        {
            if (recipe is null) throw new ArgumentNullException(nameof(recipes));
            foreach (PersonalEngineeringIngredient ingredient in recipe)
            {
                if (positions.TryGetValue(ingredient.Symbol, out int at))
                {
                    totals[at] = totals[at] with { Count = totals[at].Count + ingredient.Count };
                    continue;
                }

                positions[ingredient.Symbol] = totals.Count;
                totals.Add(ingredient);
            }
        }

        return new ReadOnlyCollection<PersonalEngineeringIngredient>(totals);
    }

    /// <summary>Applies every recipe that names one stat to that stat's base figure.</summary>
    /// <param name="stat">The stat to compute, named as a catalogue record spells it.</param>
    /// <param name="baseValue">The unengineered figure.</param>
    /// <param name="modifiers">
    /// The changes a build carries. A change naming another stat is passed over.
    /// </param>
    /// <returns>The engineered figure, rounded to six decimal places.</returns>
    /// <exception cref="ArgumentNullException">The stat or the list of changes is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The base figure is not finite.</exception>
    public static double ApplyModifiers(
        string stat,
        double baseValue,
        IReadOnlyList<PersonalModifier> modifiers)
    {
        if (stat is null) throw new ArgumentNullException(nameof(stat));
        if (modifiers is null) throw new ArgumentNullException(nameof(modifiers));
        if (double.IsNaN(baseValue) || double.IsInfinity(baseValue))
        {
            throw new ArgumentOutOfRangeException(
                nameof(baseValue),
                baseValue,
                "The base figure must be a finite number.");
        }

        // A resistance keeps damage out, so a recipe multiplies what gets through.
        bool onDamageTaken = stat.EndsWith("Resistance", StringComparison.Ordinal);
        double value = onDamageTaken ? 1 - baseValue : baseValue;
        foreach (PersonalModifier modifier in modifiers)
        {
            if (!string.Equals(modifier.Stat, stat, StringComparison.Ordinal)) continue;
            value *= modifier.Multiplier;
            if (modifier.RoundUp) value = Math.Ceiling(value);
        }

        return EngineeringPrecision.Round6(onDamageTaken ? 1 - value : value);
    }
}
