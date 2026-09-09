using System.Collections.Generic;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>Which weapons a suit mount takes.</summary>
public enum PersonalWeaponSlot
{
    /// <summary>A two-handed weapon: a rifle, a carbine, a shotgun, a sniper or a launcher.</summary>
    Primary,

    /// <summary>A one-handed weapon, which is a pistol.</summary>
    Secondary,
}

/// <summary>One weapon mount on a suit.</summary>
/// <param name="Key">
/// Frontier's journal slot name, such as <c>PrimaryWeapon1</c>. A loadout event's module
/// joins straight onto a mount by this key, without a positional index.
/// </param>
/// <param name="Kind">Which weapons the mount takes. A weapon whose slot equals it fits.</param>
public sealed record PersonalMount(string Key, PersonalWeaponSlot Kind);

/// <summary>The stats of one suit at one grade.</summary>
/// <param name="Symbol">Frontier's item symbol for this exact suit and grade.</param>
/// <param name="ModificationSlots">Permanent modification slots, from zero through four.</param>
/// <param name="ShieldStrength">Shield strength in shield points.</param>
/// <param name="ShieldRegeneration">Shield points restored each second.</param>
/// <param name="ArmourKineticResistance">
/// The armour's kinetic resistance as a fraction. A negative figure takes more damage.
/// </param>
/// <param name="ArmourThermalResistance">The armour's thermal resistance as a fraction.</param>
/// <param name="ArmourPlasmaResistance">The armour's plasma resistance as a fraction.</param>
/// <param name="ArmourExplosiveResistance">The armour's explosive resistance as a fraction.</param>
/// <remarks>
/// A suit defends in two layers, and each layer has its own four resistances. The four
/// here are the armour's, which the Damage Resistance modification moves. The shield's
/// four sit on <see cref="Suit"/>, because a grade leaves them alone.
/// </remarks>
public sealed record SuitGrade(
    string Symbol,
    int ModificationSlots,
    double ShieldStrength,
    double ShieldRegeneration,
    double ArmourKineticResistance,
    double ArmourThermalResistance,
    double ArmourPlasmaResistance,
    double ArmourExplosiveResistance);

/// <summary>One personal suit model sold by Pioneer Supplies.</summary>
/// <param name="Family">The suit family, without a grade suffix, such as <c>utilitysuit</c>.</param>
/// <param name="Name">The display name, such as <c>Maverick Suit</c>.</param>
/// <param name="Mounts">
/// Every weapon mount the suit carries, in the order the game lists them: the primary
/// mounts by their number, then the secondary mount.
/// </param>
/// <param name="Health">Suit health in health points, the pool the shield protects.</param>
/// <param name="ShieldKineticResistance">
/// The shield's kinetic resistance as a fraction. The shield takes damage first and the
/// armour under it takes what gets through, so the two layers carry separate figures.
/// These four are the same at every grade.
/// </param>
/// <param name="ShieldThermalResistance">
/// The shield's thermal resistance as a fraction. A negative figure takes more damage.
/// </param>
/// <param name="ShieldPlasmaResistance">The shield's plasma resistance as a fraction.</param>
/// <param name="ShieldExplosiveResistance">The shield's explosive resistance as a fraction.</param>
/// <param name="Mass">Suit mass in kilograms.</param>
/// <param name="BatteryCapacity">
/// Battery capacity in energy units, the pool the suit's tools draw from.
/// </param>
/// <param name="OxygenTime">Emergency air, in seconds of life support.</param>
/// <param name="BoostAcceleration">
/// Jump-assist boost acceleration, the bare figure the panel shows, which has no unit.
/// </param>
/// <param name="GoodsCapacity">Backpack goods capacity, in items.</param>
/// <param name="AssetsCapacity">Backpack assets capacity, in components.</param>
/// <param name="DataCapacity">Backpack data capacity, in items.</param>
/// <param name="FootstepAudibleRange">
/// How far footsteps carry, as a multiple of the base audible range.
/// </param>
/// <param name="LosAnalysisRange">Line-of-sight analysis range in metres.</param>
/// <param name="LosAnalysisTime">
/// The seconds of line of sight the suit needs to finish an analysis.
/// </param>
/// <param name="Grades">
/// The grade records the suit has, keyed by grade. A grade changes the four armour
/// resistances, the shield's strength and regeneration, the modification slots and the
/// item symbol; every other stat belongs to the family.
/// </param>
public sealed record Suit(
    string Family,
    string Name,
    IReadOnlyList<PersonalMount> Mounts,
    double Health,
    double ShieldKineticResistance,
    double ShieldThermalResistance,
    double ShieldPlasmaResistance,
    double ShieldExplosiveResistance,
    double Mass,
    double BatteryCapacity,
    double OxygenTime,
    double BoostAcceleration,
    double GoodsCapacity,
    double AssetsCapacity,
    double DataCapacity,
    double FootstepAudibleRange,
    double LosAnalysisRange,
    double LosAnalysisTime,
    IReadOnlyDictionary<int, SuitGrade> Grades);

/// <summary>A suit and the grade one item symbol names.</summary>
/// <param name="Suit">The suit family the symbol belongs to.</param>
/// <param name="Grade">The grade the symbol names, from one through five.</param>
public sealed record SuitIdentity(Suit Suit, int Grade);
