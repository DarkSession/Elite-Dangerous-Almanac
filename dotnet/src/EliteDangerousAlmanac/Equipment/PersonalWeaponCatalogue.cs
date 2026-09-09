using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Equipment.Internal;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>The personal-weapon catalogue, its lookups, and what a weapon deals.</summary>
/// <remarks>
/// <para>
/// Every weapon carries all five grades, and a grade changes the damage one projectile
/// deals and the modification slots the weapon has. Every other stat belongs to the
/// weapon.
/// </para>
/// <para>
/// The catalogue loads from its shared data file on first use. Every record is immutable,
/// so one caller cannot change another caller's answers.
/// </para>
/// </remarks>
public static class PersonalWeaponCatalogue
{
    private static readonly Lazy<IReadOnlyList<PersonalWeapon>> Weapons = new(Build);

    private static readonly Lazy<IReadOnlyDictionary<string, PersonalWeapon>> BySymbol = new(
        () => RegistryIndex.CreateKeyIndex(All, weapon => weapon.Symbol));

    private static readonly Lazy<IReadOnlyDictionary<string, PersonalWeapon>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(All, weapon => weapon.Name));

    /// <summary>Every personal weapon Pioneer Supplies sells.</summary>
    public static IReadOnlyList<PersonalWeapon> All => Weapons.Value;

    /// <summary>Finds a weapon by its item symbol.</summary>
    /// <param name="symbol">The symbol, such as <c>wpn_s_pistol_kinetic_sauto</c>.</param>
    /// <returns>The weapon, or <see langword="null"/> for a symbol no weapon carries.</returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent symbol is a miss.</remarks>
    public static PersonalWeapon? FindBySymbol(string? symbol) =>
        RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol);

    /// <summary>Finds a weapon by its display name.</summary>
    /// <param name="name">The display name, such as <c>Karma P-15</c>.</param>
    /// <returns>The weapon, or <see langword="null"/> for a name no weapon carries.</returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent name is a miss.</remarks>
    public static PersonalWeapon? FindByName(string? name) =>
        RegistryIndex.FindInKeyIndex(ByName.Value, name);

    /// <summary>Reads one weapon's stats at one grade.</summary>
    /// <param name="weapon">The weapon.</param>
    /// <param name="grade">The grade, from one through five.</param>
    /// <returns>The grade record, or <see langword="null"/> where the weapon has no such grade.</returns>
    /// <exception cref="ArgumentNullException">The weapon is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The grade is not one through five.</exception>
    public static PersonalWeaponGrade? Grade(PersonalWeapon weapon, int grade)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));
        EquipmentGrades.Require(grade, nameof(grade));
        return weapon.Grades.TryGetValue(grade, out PersonalWeaponGrade? stats) ? stats : null;
    }

    /// <summary>Computes what one weapon deals at one grade.</summary>
    /// <param name="weapon">The weapon.</param>
    /// <param name="grade">The grade, from one through five.</param>
    /// <param name="modifiers">
    /// The stat changes the fitted modifications make. A change naming a stat this
    /// calculation does not read is passed over.
    /// </param>
    /// <param name="reloadSpeed">
    /// Whether the reload-speed modification is fitted, which is what decides between the
    /// two reload times the weapon publishes.
    /// </param>
    /// <returns>
    /// The figures, or <see langword="null"/> where the weapon has no such grade.
    /// </returns>
    /// <exception cref="ArgumentNullException">The weapon is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The grade is not one through five.</exception>
    /// <remarks>
    /// The magazine is held to whole rounds, the way a ship weapon's clip is, so a
    /// hand-built fraction cannot reach the reload cycle and give the two domains
    /// different answers.
    /// </remarks>
    public static PersonalWeaponMetrics? Metrics(
        PersonalWeapon weapon,
        int grade,
        IReadOnlyList<PersonalModifier>? modifiers = null,
        bool reloadSpeed = false)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));
        EquipmentGrades.Require(grade, nameof(grade));
        if (Grade(weapon, grade) is not PersonalWeaponGrade stats) return null;

        IReadOnlyList<PersonalModifier> changes = modifiers ?? [];
        double burstRounds = weapon.BurstRounds ?? 1;
        double magazineSize = Math.Ceiling(
            PersonalEngineering.ApplyModifiers("magazineSize", weapon.MagazineSize, changes));
        double headshotMultiplier = PersonalEngineering.ApplyModifiers(
            "headshotMultiplier", weapon.HeadshotMultiplier, changes);
        double reloadTime = reloadSpeed ? weapon.ReloadTime.Upgraded : weapon.ReloadTime.Default;

        double damagePerShot = stats.Damage * (weapon.Projectiles ?? 1) * burstRounds;
        double shots = magazineSize / burstRounds;

        // The trigger pulls after the first, then the tail of the last burst, then the reload.
        double cycle = ((shots - 1) / weapon.RateOfFire)
            + ((burstRounds - 1) / (weapon.BurstRateOfFire ?? 1))
            + reloadTime;
        double sustainedRateOfFire = shots <= 0 ? 0 : Math.Min(weapon.RateOfFire, shots / cycle);

        return new PersonalWeaponMetrics(
            damagePerShot,
            damagePerShot * headshotMultiplier,
            weapon.RateOfFire,
            sustainedRateOfFire,
            damagePerShot * weapon.RateOfFire,
            damagePerShot * sustainedRateOfFire);
    }

    private static ReadOnlyCollection<PersonalWeapon> Build()
    {
        IReadOnlyList<PersonalWeaponRecord> records =
            SharedData.LoadList<PersonalWeaponRecord>("data/equipment/weapons.jsonc");
        List<PersonalWeapon> weapons = new(records.Count);
        foreach (PersonalWeaponRecord record in records) weapons.Add(Compose(record));
        return new ReadOnlyCollection<PersonalWeapon>(weapons);
    }

    private static PersonalWeapon Compose(PersonalWeaponRecord record)
    {
        Dictionary<int, PersonalWeaponGrade> grades = new(record.Grades.Count);
        foreach (KeyValuePair<int, PersonalWeaponGradeRecord> grade in record.Grades)
        {
            grades[grade.Key] = new PersonalWeaponGrade(
                grade.Value.Damage, grade.Value.ModificationSlots);
        }

        return new PersonalWeapon(
            record.Symbol,
            record.Name,
            EquipmentEnums.Require<WeaponUpgradeGroup>(
                record.UpgradeGroup, "an upgrade group", record.Symbol),
            EquipmentEnums.Require<PersonalWeaponEngineeringType>(
                record.EngineeringType, "an engineering type", record.Symbol),
            EquipmentEnums.Require<PersonalWeaponClass>(record.Class, "a class", record.Symbol),
            EquipmentEnums.Require<PersonalWeaponSlot>(record.Slot, "a slot", record.Symbol),
            EquipmentEnums.Require<PersonalDamageType>(
                record.DamageType, "a damage type", record.Symbol),
            EquipmentEnums.Require<PersonalFireMode>(record.FireMode, "a fire mode", record.Symbol),
            record.RateOfFire,
            record.MagazineSize,
            record.ReserveAmmo,
            record.HeadshotMultiplier,
            record.EffectiveRange,
            new ScopeMagnification(record.ScopeMagnification.Default, record.ScopeMagnification.Upgraded),
            new ReloadTime(record.ReloadTime.Default, record.ReloadTime.Upgraded),
            new ReadOnlyDictionary<int, PersonalWeaponGrade>(grades),
            record.Projectiles,
            record.BurstRounds,
            record.BurstRateOfFire);
    }
}
