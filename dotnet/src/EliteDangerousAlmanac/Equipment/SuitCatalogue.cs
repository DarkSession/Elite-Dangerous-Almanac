using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Equipment.Internal;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>The personal-suit catalogue and the lookups that search it.</summary>
/// <remarks>
/// <para>
/// A suit is stored once per family, with the stats a grade leaves alone on the family
/// record and the rest under <see cref="Suit.Grades"/>. The Flight Suit is in the
/// catalogue like any other, and carries the one grade it has.
/// </para>
/// <para>
/// The catalogue loads from its shared data file on first use. Every record is immutable,
/// so one caller cannot change another caller's answers.
/// </para>
/// </remarks>
public static class SuitCatalogue
{
    private static readonly Lazy<IReadOnlyList<Suit>> Suits = new(Build);

    private static readonly Lazy<IReadOnlyDictionary<string, Suit>> ByFamily = new(
        () => RegistryIndex.CreateKeyIndex(All, suit => suit.Family));

    private static readonly Lazy<IReadOnlyDictionary<string, Suit>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(All, suit => suit.Name));

    private static readonly Lazy<IReadOnlyDictionary<string, SuitIdentity>> BySymbol = new(BuildSymbols);

    /// <summary>Every personal suit, including the Flight Suit no upgrade reaches.</summary>
    public static IReadOnlyList<Suit> All => Suits.Value;

    /// <summary>Finds a suit by its grade-independent family.</summary>
    /// <param name="family">The family, such as <c>utilitysuit</c>.</param>
    /// <returns>The suit, or <see langword="null"/> for a family no suit carries.</returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent family is a miss.</remarks>
    public static Suit? FindByFamily(string? family) =>
        RegistryIndex.FindInKeyIndex(ByFamily.Value, family);

    /// <summary>Finds a suit by its display name.</summary>
    /// <param name="name">The display name, such as <c>Maverick Suit</c>.</param>
    /// <returns>The suit, or <see langword="null"/> for a name no suit carries.</returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent name is a miss.</remarks>
    public static Suit? FindByName(string? name) =>
        RegistryIndex.FindInKeyIndex(ByName.Value, name);

    /// <summary>Resolves the grade-specific item symbol a journal suit event reports.</summary>
    /// <param name="symbol">The item symbol, such as <c>utilitysuit_class3</c>.</param>
    /// <returns>
    /// The suit and the grade the symbol names, or <see langword="null"/> for a symbol no
    /// suit carries.
    /// </returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent symbol is a miss.</remarks>
    public static SuitIdentity? FindBySymbol(string? symbol) =>
        RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol);

    /// <summary>Reads one suit's stats at one grade.</summary>
    /// <param name="suit">The suit.</param>
    /// <param name="grade">The grade, from one through five.</param>
    /// <returns>The grade record, or <see langword="null"/> where the suit has no such grade.</returns>
    /// <exception cref="ArgumentNullException">The suit is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The grade is not one through five.</exception>
    public static SuitGrade? Grade(Suit suit, int grade)
    {
        if (suit is null) throw new ArgumentNullException(nameof(suit));
        EquipmentGrades.Require(grade, nameof(grade));
        return suit.Grades.TryGetValue(grade, out SuitGrade? stats) ? stats : null;
    }

    private static ReadOnlyCollection<Suit> Build()
    {
        IReadOnlyList<SuitRecord> records = SharedData.LoadList<SuitRecord>("data/equipment/suits.jsonc");
        List<Suit> suits = new(records.Count);
        foreach (SuitRecord record in records) suits.Add(Compose(record));
        return new ReadOnlyCollection<Suit>(suits);
    }

    private static Suit Compose(SuitRecord record)
    {
        List<PersonalMount> mounts = new(record.Mounts.Count);
        foreach (PersonalMountRecord mount in record.Mounts)
        {
            mounts.Add(new PersonalMount(
                mount.Key,
                EquipmentEnums.Require<PersonalWeaponSlot>(mount.Kind, "a mount kind", record.Family)));
        }

        Dictionary<int, SuitGrade> grades = new(record.Grades.Count);
        foreach (KeyValuePair<int, SuitGradeRecord> grade in record.Grades)
        {
            grades[grade.Key] = new SuitGrade(
                grade.Value.Symbol,
                grade.Value.ModificationSlots,
                grade.Value.ShieldStrength,
                grade.Value.ShieldRegeneration,
                grade.Value.ArmourKineticResistance,
                grade.Value.ArmourThermalResistance,
                grade.Value.ArmourPlasmaResistance,
                grade.Value.ArmourExplosiveResistance);
        }

        return new Suit(
            record.Family,
            record.Name,
            new ReadOnlyCollection<PersonalMount>(mounts),
            record.Health,
            record.ShieldKineticResistance,
            record.ShieldThermalResistance,
            record.ShieldPlasmaResistance,
            record.ShieldExplosiveResistance,
            record.Mass,
            record.BatteryCapacity,
            record.OxygenTime,
            record.BoostAcceleration,
            record.GoodsCapacity,
            record.AssetsCapacity,
            record.DataCapacity,
            record.FootstepAudibleRange,
            record.LosAnalysisRange,
            record.LosAnalysisTime,
            new ReadOnlyDictionary<int, SuitGrade>(grades));
    }

    private static ReadOnlyDictionary<string, SuitIdentity> BuildSymbols()
    {
        Dictionary<string, SuitIdentity> index = new(RegistryIndex.KeyComparer);
        foreach (Suit suit in All)
        {
            foreach (KeyValuePair<int, SuitGrade> grade in suit.Grades)
            {
                index[grade.Value.Symbol] = new SuitIdentity(suit, grade.Key);
            }
        }

        return new ReadOnlyDictionary<string, SuitIdentity>(index);
    }
}
