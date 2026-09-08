using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Equipment.Internal;

/// <summary>Answers which stats one weapon record carries.</summary>
/// <remarks>
/// A suit modification acts on the weapon wherever it names a stat the weapon has, which
/// is how Extra Ammo Capacity, fitted to the suit, multiplies a weapon's reserve
/// ammunition. A stat a weapon does not state is not one it carries: a weapon that fires a
/// single projectile carries no burst figures.
/// </remarks>
internal static class WeaponStats
{
    private static readonly HashSet<string> Always = new(StringComparer.Ordinal)
    {
        "symbol",
        "name",
        "upgradeGroup",
        "engineeringType",
        "class",
        "slot",
        "damageType",
        "fireMode",
        "rateOfFire",
        "magazineSize",
        "reserveAmmo",
        "headshotMultiplier",
        "effectiveRange",
        "scopeMagnification",
        "reloadTime",
        "grades",
    };

    /// <summary>Answers whether a weapon carries the named stat.</summary>
    /// <param name="weapon">The weapon.</param>
    /// <param name="stat">The stat name, as a modification record spells it.</param>
    internal static bool Carries(PersonalWeapon weapon, string stat) =>
        Always.Contains(stat)
        || (stat == "projectiles" && weapon.Projectiles is not null)
        || (stat == "burstRounds" && weapon.BurstRounds is not null)
        || (stat == "burstRateOfFire" && weapon.BurstRateOfFire is not null);
}
