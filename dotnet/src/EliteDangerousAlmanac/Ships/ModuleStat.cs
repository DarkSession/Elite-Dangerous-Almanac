namespace EliteDangerousAlmanac.Ships;

/// <summary>One numeric performance or capability stat an outfitting module can carry.</summary>
/// <remarks>
/// <para>
/// A module carries only the stats its family uses, so most of these are absent from any one
/// record. Read one from a module or a fitted module by this key.
/// </para>
/// <para>
/// Masses are tonnes, power is megawatts, jump ranges are light-years, and weapon ranges are
/// metres. A resistance is a fraction of the incoming damage removed, so a negative value is
/// a weakness.
/// </para>
/// <para>
/// Engineering addresses these same keys, which is what lets a blueprint modifier and a
/// catalogue stat meet without a translation table.
/// </para>
/// </remarks>
public enum ModuleStat
{
    /// <summary>Mass, in tonnes.</summary>
    Mass,

    /// <summary>Integrity — hit points against module damage.</summary>
    Integrity,

    /// <summary>Power draw, in megawatts.</summary>
    PowerDraw,

    /// <summary>Boot time from power-on, in seconds.</summary>
    BootTime,

    /// <summary>Optimised mass, in tonnes. Thrusters, shield generators and frame shift drives carry it.</summary>
    OptMass,

    /// <summary>Minimum mass for the performance curve, in tonnes.</summary>
    MinMass,

    /// <summary>Maximum mass for the performance curve, in tonnes.</summary>
    MaxMass,

    /// <summary>Performance multiplier at the optimised mass — thruster speed or shield strength.</summary>
    OptMultiplier,

    /// <summary>Minimum performance multiplier, reached at the maximum mass.</summary>
    MinMultiplier,

    /// <summary>Maximum performance multiplier, reached at the minimum mass.</summary>
    MaxMultiplier,

    /// <summary>Thruster top-speed multiplier at the optimised mass, when it differs from acceleration.</summary>
    OptSpeedMultiplier,

    /// <summary>Thruster minimum top-speed multiplier, reached at the maximum mass.</summary>
    MinSpeedMultiplier,

    /// <summary>Thruster maximum top-speed multiplier, reached at the minimum mass.</summary>
    MaxSpeedMultiplier,

    /// <summary>Thruster rotation multiplier at the optimised mass, when it differs from acceleration.</summary>
    OptRotationMultiplier,

    /// <summary>Thruster minimum rotation multiplier, reached at the maximum mass.</summary>
    MinRotationMultiplier,

    /// <summary>Thruster maximum rotation multiplier, reached at the minimum mass.</summary>
    MaxRotationMultiplier,

    /// <summary>Thrusters: waste heat generated per second at top speed. Every Dirty Drive Tuning roll raises it and every Clean Drive roll lowers it. The units are Frontier's own: a bare number the ship's heat model consumes, not a temperature and not a percentage.</summary>
    EngineHeatRate,

    /// <summary>Frame shift drive: maximum fuel per jump, in tonnes.</summary>
    MaxFuel,

    /// <summary>Frame shift drive: the rating (linear) fuel constant.</summary>
    FuelMul,

    /// <summary>Frame shift drive: the size (power) fuel constant.</summary>
    FuelPower,

    /// <summary>Frame shift drive: waste heat generated per second while a jump charges. A drive's size sets it, so every rating of a size shares one value.</summary>
    FsdHeatRate,

    /// <summary>Guardian FSD booster: the flat jump-range bonus, in light-years.</summary>
    JumpBoost,

    /// <summary>Power plant: power generated, in megawatts.</summary>
    PowerCapacity,

    /// <summary>Power plant: heat efficiency. A lower figure runs cooler.</summary>
    HeatEfficiency,

    /// <summary>Power distributor: the WEP capacitor's capacity.</summary>
    WeaponsCapacity,

    /// <summary>Power distributor: maximum WEP recharge at four pips, in megajoules per second.</summary>
    WeaponsRecharge,

    /// <summary>Power distributor: the ENG capacitor's capacity.</summary>
    EnginesCapacity,

    /// <summary>Power distributor: maximum ENG recharge at four pips, in megajoules per second.</summary>
    EnginesRecharge,

    /// <summary>Power distributor: the SYS capacitor's capacity.</summary>
    SystemsCapacity,

    /// <summary>Power distributor: maximum SYS recharge at four pips, in megajoules per second.</summary>
    SystemsRecharge,

    /// <summary>Fuel scoop: scoop rate, in tonnes per second.</summary>
    RefuelRate,

    /// <summary>Fuel tank: capacity, in tonnes.</summary>
    FuelCapacity,

    /// <summary>Cargo rack: capacity, in tonnes.</summary>
    CargoCapacity,

    /// <summary>Passenger cabin: capacity, in berths.</summary>
    CabinCapacity,

    /// <summary>Shield generator: regeneration rate, in megajoules per second.</summary>
    ShieldRegenRate,

    /// <summary>Shield generator: regeneration rate while the shields are down, in megajoules per second.</summary>
    ShieldBrokenRegenRate,

    /// <summary>Shield booster: the shield strength bonus, as a fraction. 0.04 is plus four percent.</summary>
    ShieldBoost,

    /// <summary>Shield cell bank: shield megajoules restored per second while a cell runs.</summary>
    ShieldBankReinforcement,

    /// <summary>Shield cell bank: the waste heat firing one cell generates.</summary>
    ShieldBankHeat,

    /// <summary>Shield cell bank: seconds between firing a cell and the shields starting to rise.</summary>
    ShieldBankSpinUp,

    /// <summary>Shield cell bank: seconds one cell keeps reinforcing for.</summary>
    ShieldBankDuration,

    /// <summary>Kinetic resistance, as a fraction. 0.4 removes 40 percent of the damage and a negative value is a weakness.</summary>
    KineticResistance,

    /// <summary>Thermal resistance, as a fraction. A negative value is a weakness; every shield generator is weak to thermal damage.</summary>
    ThermalResistance,

    /// <summary>Explosive resistance, as a fraction. A negative value is a weakness.</summary>
    ExplosiveResistance,

    /// <summary>Caustic resistance, as a fraction. A negative value is a weakness.</summary>
    CausticResistance,

    /// <summary>Armour: the hull hit points this bulkhead adds, as a fraction of the hull's base armour on top of it. 0.8 means the base armour times 1.8.</summary>
    HullBoost,

    /// <summary>Hull reinforcement package: the hull hit points it adds.</summary>
    HullReinforcement,

    /// <summary>Guardian shield reinforcement package: the shield megajoules it adds.</summary>
    ShieldAddition,

    /// <summary>Module reinforcement package: the fraction of module damage it absorbs. It protects the modules, not the hull.</summary>
    ModuleProtection,

    /// <summary>Scan range, in metres. On a utility scanner it is the distance the scan reaches; on a core sensor suite it is the range at which a contact with typical emissions resolves, not the suite's absolute detection ceiling.</summary>
    ScannerRange,

    /// <summary>Scan cone half-angle, in degrees — how far off boresight a target can sit and still be scanned.</summary>
    ScanAngle,

    /// <summary>Seconds a scan takes to complete. Utility scanners only.</summary>
    ScanTime,

    /// <summary>Detailed surface scanner: probe radius, as a percentage. Frontier stores this one as a percentage rather than a fraction, and the journal reports it that way too.</summary>
    ProbeRadius,

    /// <summary>Frame shift drive interdictor: maximum target angle off boresight, in degrees.</summary>
    InterdictorFacingLimit,

    /// <summary>Frame shift drive interdictor: maximum target range, in seconds to intercept — the units the game measures a supercruise separation in, not a distance.</summary>
    InterdictorRange,

    /// <summary>Damage per round, or per second on a continuous-fire weapon such as a beam laser.</summary>
    Damage,

    /// <summary>Rounds fired per shot, for the weapons that fire several at once. Absent means one round per shot.</summary>
    RoundsPerShot,

    /// <summary>Shots per second with the burst pattern folded in. Absent on a continuous-fire weapon, whose damage is already per second. It excludes charge and reload time.</summary>
    RateOfFire,

    /// <summary>Seconds between shots — between bursts on a burst-fire weapon.</summary>
    BurstInterval,

    /// <summary>Shots in one burst. Absent, or 1, on a weapon that does not fire in bursts.</summary>
    BurstRounds,

    /// <summary>Shots per second within a burst.</summary>
    BurstRateOfFire,

    /// <summary>Seconds spent charging before a shot, on a rail gun.</summary>
    ChargeTime,

    /// <summary>Rounds in a clip before reloading. Absent on a weapon that never reloads.</summary>
    ClipSize,

    /// <summary>Reserve rounds to reload from. The magazine is not counted in it. Absent beside a clip size means nothing limits the refills; absent beside no clip either means the module takes no ammunition at all.</summary>
    AmmoMaximum,

    /// <summary>Seconds to reload a clip.</summary>
    ReloadTime,

    /// <summary>Weapons-capacitor draw, in megawatts — per shot, or per second on a continuous-fire weapon. A shield generator carries it too, as the systems-capacitor cost of one megajoule per second of regeneration.</summary>
    DistributorDraw,

    /// <summary>Heat generated — per shot, or per second on a continuous-fire weapon.</summary>
    ThermalLoad,

    /// <summary>Armour piercing rating. Damage to a hull is scaled by the piercing rating over the hull's hardness, up to 1.</summary>
    ArmourPiercing,

    /// <summary>Maximum effective range, in metres. A weapon does no damage beyond it; on a utility module that is not a scanner, it is the effect's reach.</summary>
    MaximumRange,

    /// <summary>Range at which damage starts to drop off, in metres.</summary>
    FalloffRange,

    /// <summary>Projectile speed, in metres per second. Absent on the weapons that have no projectile to speed up — lasers, rail guns, Gauss cannons and mine launchers all hit, or drop, where they are aimed.</summary>
    ShotSpeed,

    /// <summary>Maximum aim deviation, in degrees.</summary>
    Jitter,
}
