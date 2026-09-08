using System.Collections.Generic;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>The upgrade ladder a weapon climbs, named after its maker.</summary>
public enum WeaponUpgradeGroup
{
    /// <summary>The Karma kinetic weapons.</summary>
    Karma,

    /// <summary>The Takada laser weapons.</summary>
    Takada,

    /// <summary>The Manticore plasma weapons.</summary>
    Manticore,
}

/// <summary>The engineering menu a weapon is offered, which follows its damage.</summary>
public enum PersonalWeaponEngineeringType
{
    /// <summary>The kinetic menu.</summary>
    Kinetic,

    /// <summary>The laser menu.</summary>
    Laser,

    /// <summary>The plasma menu.</summary>
    Plasma,
}

/// <summary>What kind of weapon a personal weapon is.</summary>
public enum PersonalWeaponClass
{
    /// <summary>A one-handed sidearm.</summary>
    Pistol,

    /// <summary>A short two-handed weapon.</summary>
    Carbine,

    /// <summary>A general-purpose two-handed weapon.</summary>
    Rifle,

    /// <summary>A close-range two-handed weapon firing several projectiles a shot.</summary>
    Shotgun,

    /// <summary>A long-range two-handed weapon.</summary>
    Sniper,

    /// <summary>A two-handed weapon firing an explosive projectile.</summary>
    Launcher,
}

/// <summary>Which damage a personal weapon deals.</summary>
public enum PersonalDamageType
{
    /// <summary>Kinetic damage.</summary>
    Kinetic,

    /// <summary>Thermal damage.</summary>
    Thermal,

    /// <summary>Plasma damage.</summary>
    Plasma,

    /// <summary>Explosive damage.</summary>
    Explosive,
}

/// <summary>How a personal weapon fires while the trigger is held.</summary>
public enum PersonalFireMode
{
    /// <summary>It fires for as long as the trigger is held.</summary>
    Automatic,

    /// <summary>It fires one round for each trigger pull.</summary>
    SemiAutomatic,

    /// <summary>It fires a fixed burst for each trigger pull.</summary>
    Burst,
}

/// <summary>A figure the weapon's scope modification changes.</summary>
/// <param name="Default">The figure the stock weapon has.</param>
/// <param name="Upgraded">The figure the modification gives it.</param>
public sealed record ScopeMagnification(double Default, double Upgraded);

/// <summary>A figure the weapon's reload-speed modification changes.</summary>
/// <param name="Default">The seconds a stock reload takes.</param>
/// <param name="Upgraded">The seconds a reload takes with the modification fitted.</param>
public sealed record ReloadTime(double Default, double Upgraded);

/// <summary>The stats of one personal weapon at one grade.</summary>
/// <param name="Damage">The damage one projectile deals.</param>
/// <param name="ModificationSlots">Permanent modification slots, from zero through four.</param>
public sealed record PersonalWeaponGrade(double Damage, int ModificationSlots);

/// <summary>One personal weapon sold by Pioneer Supplies.</summary>
/// <param name="Symbol">Frontier's item symbol, such as <c>wpn_s_pistol_kinetic_sauto</c>.</param>
/// <param name="Name">The display name, such as <c>Karma P-15</c>.</param>
/// <param name="UpgradeGroup">The ladder the weapon climbs, which decides its upgrade cost.</param>
/// <param name="EngineeringType">The engineering menu the weapon is offered.</param>
/// <param name="Class">What kind of weapon it is.</param>
/// <param name="Slot">Which suit mount it fits.</param>
/// <param name="DamageType">Which damage it deals.</param>
/// <param name="FireMode">How it fires while the trigger is held.</param>
/// <param name="RateOfFire">Trigger pulls each second.</param>
/// <param name="MagazineSize">Rounds in one magazine.</param>
/// <param name="ReserveAmmo">Rounds carried beyond the loaded magazine.</param>
/// <param name="HeadshotMultiplier">What a hit to the head multiplies the damage by.</param>
/// <param name="EffectiveRange">The range in metres at which the weapon deals full damage.</param>
/// <param name="ScopeMagnification">The sight magnification, stock and modified.</param>
/// <param name="ReloadTime">The seconds a reload takes, stock and modified.</param>
/// <param name="Grades">The five grade records, keyed by grade.</param>
/// <param name="Projectiles">
/// The projectiles one round releases, where a weapon releases more than one. It is absent
/// on a weapon that fires a single projectile.
/// </param>
/// <param name="BurstRounds">The rounds one burst fires, on a burst weapon.</param>
/// <param name="BurstRateOfFire">The rounds each second within one burst, on a burst weapon.</param>
public sealed record PersonalWeapon(
    string Symbol,
    string Name,
    WeaponUpgradeGroup UpgradeGroup,
    PersonalWeaponEngineeringType EngineeringType,
    PersonalWeaponClass Class,
    PersonalWeaponSlot Slot,
    PersonalDamageType DamageType,
    PersonalFireMode FireMode,
    double RateOfFire,
    double MagazineSize,
    double ReserveAmmo,
    double HeadshotMultiplier,
    double EffectiveRange,
    ScopeMagnification ScopeMagnification,
    ReloadTime ReloadTime,
    IReadOnlyDictionary<int, PersonalWeaponGrade> Grades,
    double? Projectiles = null,
    double? BurstRounds = null,
    double? BurstRateOfFire = null);

/// <summary>What one personal weapon deals at one grade, with its engineering applied.</summary>
/// <param name="DamagePerShot">The damage one trigger pull deals to the body.</param>
/// <param name="HeadshotDamagePerShot">The damage one trigger pull deals to the head.</param>
/// <param name="RateOfFire">Trigger pulls each second, with the trigger held and rounds loaded.</param>
/// <param name="SustainedRateOfFire">
/// Trigger pulls each second averaged over the magazine and the reload that follows it.
/// </param>
/// <param name="DamagePerSecond">The damage a full magazine deals each second while it lasts.</param>
/// <param name="SustainedDamagePerSecond">
/// The damage each second averaged over the magazine and the reload that follows it.
/// </param>
public sealed record PersonalWeaponMetrics(
    double DamagePerShot,
    double HeadshotDamagePerShot,
    double RateOfFire,
    double SustainedRateOfFire,
    double DamagePerSecond,
    double SustainedDamagePerSecond);
