using System;
using System.Collections.Generic;
using System.Globalization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment.Internal;

/// <summary>The on-disk shape of one suit mount.</summary>
internal sealed class PersonalMountRecord
{
    public string Key { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;
}

/// <summary>The on-disk shape of one suit grade.</summary>
internal sealed class SuitGradeRecord
{
    public string Symbol { get; set; } = string.Empty;

    public int ModificationSlots { get; set; }

    public double ShieldStrength { get; set; }

    public double ShieldRegeneration { get; set; }

    public double ArmourKineticResistance { get; set; }

    public double ArmourThermalResistance { get; set; }

    public double ArmourPlasmaResistance { get; set; }

    public double ArmourExplosiveResistance { get; set; }
}

/// <summary>The on-disk shape of one suit.</summary>
internal sealed class SuitRecord
{
    public string Family { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<PersonalMountRecord> Mounts { get; set; } = [];

    public double Health { get; set; }

    public double ShieldKineticResistance { get; set; }

    public double ShieldThermalResistance { get; set; }

    public double ShieldPlasmaResistance { get; set; }

    public double ShieldExplosiveResistance { get; set; }

    public double Mass { get; set; }

    public double BatteryCapacity { get; set; }

    public double OxygenTime { get; set; }

    public double BoostAcceleration { get; set; }

    public double GoodsCapacity { get; set; }

    public double AssetsCapacity { get; set; }

    public double DataCapacity { get; set; }

    public double FootstepAudibleRange { get; set; }

    public double LosAnalysisRange { get; set; }

    public double LosAnalysisTime { get; set; }

    public Dictionary<int, SuitGradeRecord> Grades { get; set; } = [];
}

/// <summary>The on-disk shape of a figure a modification changes.</summary>
internal sealed class UpgradablePairRecord
{
    public double Default { get; set; }

    public double Upgraded { get; set; }
}

/// <summary>The on-disk shape of one weapon grade.</summary>
internal sealed class PersonalWeaponGradeRecord
{
    public double Damage { get; set; }

    public int ModificationSlots { get; set; }
}

/// <summary>The on-disk shape of one personal weapon.</summary>
internal sealed class PersonalWeaponRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string UpgradeGroup { get; set; } = string.Empty;

    public string EngineeringType { get; set; } = string.Empty;

    public string Class { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string DamageType { get; set; } = string.Empty;

    public string FireMode { get; set; } = string.Empty;

    public double RateOfFire { get; set; }

    public double? Projectiles { get; set; }

    public double? BurstRounds { get; set; }

    public double? BurstRateOfFire { get; set; }

    public double MagazineSize { get; set; }

    public double ReserveAmmo { get; set; }

    public double HeadshotMultiplier { get; set; }

    public double EffectiveRange { get; set; }

    public UpgradablePairRecord ScopeMagnification { get; set; } = new();

    public UpgradablePairRecord ReloadTime { get; set; } = new();

    public Dictionary<int, PersonalWeaponGradeRecord> Grades { get; set; } = [];
}

/// <summary>The on-disk shape of one suit tool.</summary>
internal sealed class PersonalToolRecord
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<string> SuitFamilies { get; set; } = [];

    public double? RechargeRate { get; set; }

    public double? DischargeRate { get; set; }

    public double? DischargeDuration { get; set; }

    public double? OverloadPowerUsage { get; set; }

    public double? PowerUsage { get; set; }

    public double? ScanDuration { get; set; }

    public double? CloneDuration { get; set; }
}

/// <summary>The on-disk shape of one stat change.</summary>
internal sealed class PersonalModifierRecord
{
    public string Stat { get; set; } = string.Empty;

    public double Multiplier { get; set; }

    public bool RoundUp { get; set; }
}

/// <summary>The on-disk shape of one modification recipe.</summary>
internal sealed class PersonalModificationRecord
{
    public string Name { get; set; } = string.Empty;

    public string Target { get; set; } = string.Empty;

    public List<string> Engineers { get; set; } = [];

    public List<PersonalModifierRecord> Modifiers { get; set; } = [];
}

/// <summary>The on-disk shape of one material a recipe asks for.</summary>
internal sealed class PersonalIngredientRecord
{
    public string Symbol { get; set; } = string.Empty;

    public int Count { get; set; }
}

/// <summary>The on-disk shape of the upgrade ladders.</summary>
internal sealed class PersonalUpgradeCostsRecord
{
    public Dictionary<string, Dictionary<int, List<PersonalIngredientRecord>>> Suits { get; set; } = [];

    public Dictionary<string, Dictionary<int, List<PersonalIngredientRecord>>> WeaponGroups { get; set; } = [];
}

/// <summary>Reads an enumeration member from the spelling a shared data file uses.</summary>
internal static class EquipmentEnums
{
    /// <summary>Reads a member, or reports which file and field cannot be read.</summary>
    /// <remarks>
    /// A data file spells a compound value with a hyphen, as in <c>semi-automatic</c>, and
    /// the hyphen is dropped before the name is matched.
    /// </remarks>
    /// <exception cref="InvalidOperationException">
    /// The file names a member the enumeration does not carry, which means the build lost a
    /// shared file or the file moved ahead of this package.
    /// </exception>
    internal static TEnum Require<TEnum>(string value, string field, string owner)
        where TEnum : struct, Enum
    {
        if (EnumParsing.TryParse(value?.Replace("-", string.Empty), out TEnum parsed)) return parsed;

        throw new InvalidOperationException(string.Format(
            CultureInfo.InvariantCulture,
            "The equipment catalogue states {0} \"{1}\" for {2}, which is not a known value.",
            field,
            value,
            owner));
    }
}

/// <summary>Builds the material lists a cost file states.</summary>
internal static class EquipmentCosts
{
    /// <summary>Freezes one recipe's materials, in the order the file states them.</summary>
    internal static IReadOnlyList<PersonalEngineeringIngredient> Compose(
        IReadOnlyList<PersonalIngredientRecord> records)
    {
        List<PersonalEngineeringIngredient> ingredients = new(records.Count);
        foreach (PersonalIngredientRecord record in records)
        {
            ingredients.Add(new PersonalEngineeringIngredient(record.Symbol, record.Count));
        }

        return new System.Collections.ObjectModel.ReadOnlyCollection<PersonalEngineeringIngredient>(
            ingredients);
    }
}
