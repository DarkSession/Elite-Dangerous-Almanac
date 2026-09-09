using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Equipment.Internal;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>What climbing a suit or a weapon up its grade ladder costs.</summary>
/// <remarks>
/// <para>
/// A suit family has its own ladder. Every weapon of one maker shares a ladder, so the
/// cost is read from the weapon's upgrade group rather than from the weapon itself.
/// </para>
/// <para>
/// The stock article is grade one, so a ladder states the four steps that reach grades two
/// through five. The Flight Suit climbs no ladder and answers no cost.
/// </para>
/// </remarks>
public static class PersonalUpgradeCosts
{
    private static readonly Lazy<PersonalUpgradeCostsRecord> Ladders = new(
        () => SharedData.Load<PersonalUpgradeCostsRecord>("data/equipment/upgrade-costs.jsonc"));

    /// <summary>What one step of a suit's ladder costs.</summary>
    /// <param name="family">The suit family, such as <c>utilitysuit</c>.</param>
    /// <param name="targetGrade">The grade the step reaches, from two through five.</param>
    /// <returns>
    /// The materials the step asks for, or <see langword="null"/> where no suit carries the
    /// family, or the suit climbs no ladder.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The target grade is not a whole number from two through five.
    /// </exception>
    public static IReadOnlyList<PersonalEngineeringIngredient>? SuitStep(
        string? family,
        int targetGrade)
    {
        RequireStep(targetGrade, nameof(targetGrade));
        return SuitLadder(family) is Dictionary<int, List<PersonalIngredientRecord>> ladder
            && ladder.TryGetValue(targetGrade, out List<PersonalIngredientRecord>? step)
            ? EquipmentCosts.Compose(step)
            : null;
    }

    /// <summary>What climbing a suit from one grade to another costs altogether.</summary>
    /// <param name="family">The suit family, such as <c>utilitysuit</c>.</param>
    /// <param name="targetGrade">The grade to reach, from one through five.</param>
    /// <param name="currentGrade">The grade owned now, from one through five.</param>
    /// <returns>
    /// The materials every step between the two grades asks for, added together, or
    /// <see langword="null"/> where no suit carries the family, or the suit climbs no
    /// ladder. A target at or below the grade owned now costs nothing and answers an empty
    /// list.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">Either grade is not one through five.</exception>
    public static IReadOnlyList<PersonalEngineeringIngredient>? Suit(
        string? family,
        int targetGrade,
        int currentGrade = EquipmentGrades.Lowest)
    {
        EquipmentGrades.Require(targetGrade, nameof(targetGrade));
        EquipmentGrades.Require(currentGrade, nameof(currentGrade));
        return SuitLadder(family) is Dictionary<int, List<PersonalIngredientRecord>> ladder
            ? Climb(ladder, targetGrade, currentGrade)
            : null;
    }

    /// <summary>What one step of a weapon's ladder costs.</summary>
    /// <param name="symbol">The weapon's item symbol.</param>
    /// <param name="targetGrade">The grade the step reaches, from two through five.</param>
    /// <returns>
    /// The materials the step asks for, or <see langword="null"/> for a symbol no weapon
    /// carries.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The target grade is not a whole number from two through five.
    /// </exception>
    public static IReadOnlyList<PersonalEngineeringIngredient>? WeaponStep(
        string? symbol,
        int targetGrade)
    {
        RequireStep(targetGrade, nameof(targetGrade));
        return WeaponLadder(symbol) is Dictionary<int, List<PersonalIngredientRecord>> ladder
            && ladder.TryGetValue(targetGrade, out List<PersonalIngredientRecord>? step)
            ? EquipmentCosts.Compose(step)
            : null;
    }

    /// <summary>What climbing a weapon from one grade to another costs altogether.</summary>
    /// <param name="symbol">The weapon's item symbol.</param>
    /// <param name="targetGrade">The grade to reach, from one through five.</param>
    /// <param name="currentGrade">The grade owned now, from one through five.</param>
    /// <returns>
    /// The materials every step between the two grades asks for, added together, or
    /// <see langword="null"/> for a symbol no weapon carries. A target at or below the
    /// grade owned now costs nothing and answers an empty list.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">Either grade is not one through five.</exception>
    public static IReadOnlyList<PersonalEngineeringIngredient>? Weapon(
        string? symbol,
        int targetGrade,
        int currentGrade = EquipmentGrades.Lowest)
    {
        EquipmentGrades.Require(targetGrade, nameof(targetGrade));
        EquipmentGrades.Require(currentGrade, nameof(currentGrade));
        return WeaponLadder(symbol) is Dictionary<int, List<PersonalIngredientRecord>> ladder
            ? Climb(ladder, targetGrade, currentGrade)
            : null;
    }

    private static IReadOnlyList<PersonalEngineeringIngredient> Climb(
        Dictionary<int, List<PersonalIngredientRecord>> ladder,
        int targetGrade,
        int currentGrade)
    {
        List<IReadOnlyList<PersonalEngineeringIngredient>> steps = [];
        for (int grade = currentGrade + 1; grade <= targetGrade; grade++)
        {
            if (ladder.TryGetValue(grade, out List<PersonalIngredientRecord>? step))
            {
                steps.Add(EquipmentCosts.Compose(step));
            }
        }

        return PersonalEngineering.SumIngredients([.. steps]);
    }

    private static Dictionary<int, List<PersonalIngredientRecord>>? SuitLadder(string? family)
    {
        Suit? suit = SuitCatalogue.FindByFamily(family);
        if (suit is null) return null;
        return Ladders.Value.Suits.TryGetValue(
            suit.Family, out Dictionary<int, List<PersonalIngredientRecord>>? ladder)
            ? ladder
            : null;
    }

    private static Dictionary<int, List<PersonalIngredientRecord>>? WeaponLadder(string? symbol)
    {
        PersonalWeapon? weapon = PersonalWeaponCatalogue.FindBySymbol(symbol);
        if (weapon is null) return null;
        string group = weapon.UpgradeGroup.ToString().ToLowerInvariant();
        return Ladders.Value.WeaponGroups.TryGetValue(
            group, out Dictionary<int, List<PersonalIngredientRecord>>? ladder)
            ? ladder
            : null;
    }

    private static void RequireStep(int grade, string parameterName)
    {
        if (grade > EquipmentGrades.Lowest && grade <= EquipmentGrades.Highest) return;
        throw new ArgumentOutOfRangeException(
            parameterName, grade, "The grade a step reaches must be a whole number from 2 through 5.");
    }
}
