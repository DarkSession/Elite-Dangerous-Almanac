using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Frontier's outfitting category — which kind of slot a module fits.</summary>
public enum ModuleCategory
{
    /// <summary>
    /// The core internals every hull must fit: armour, power plant, thrusters, frame shift
    /// drive, life support, power distributor, sensors and fuel tank. Frontier's own registry
    /// calls this category "standard". A fuel tank is a core module that also fits an
    /// optional slot.
    /// </summary>
    Core,

    /// <summary>
    /// Optional internals — cargo racks, shield generators, fuel scoops, passenger cabins,
    /// limpet controllers and the rest. The registry also files two kinds of article here
    /// that no optional slot takes: the built-in cargo hatch, and the Guardian hybrid power
    /// plants and distributors, which go in a core mount.
    /// </summary>
    Internal,

    /// <summary>The weapons and tools mounted on a hardpoint.</summary>
    Hardpoint,

    /// <summary>
    /// The small utility-mount fittings: chaff, heat sinks, point defence, shield boosters
    /// and scanners.
    /// </summary>
    Utility,
}

/// <summary>How a hardpoint weapon is aimed. Only a hardpoint module carries a mount.</summary>
public enum ModuleMount
{
    /// <summary>Fixed — it fires where the ship points.</summary>
    Fixed,

    /// <summary>Gimballed — it tracks a target within a cone.</summary>
    Gimballed,

    /// <summary>Turreted — it tracks a target on its own.</summary>
    Turreted,
}

/// <summary>A missile or torpedo hardpoint's guidance.</summary>
public enum ModuleGuidance
{
    /// <summary>Unguided.</summary>
    Dumbfire,

    /// <summary>It seeks a locked target.</summary>
    Seeker,

    /// <summary>It releases a swarm.</summary>
    Swarm,
}

/// <summary>A module's grade letter, best to worst.</summary>
public enum ModuleRating
{
    /// <summary>Grade A, the best.</summary>
    A,

    /// <summary>Grade B.</summary>
    B,

    /// <summary>Grade C.</summary>
    C,

    /// <summary>Grade D.</summary>
    D,

    /// <summary>Grade E, the worst ordinary grade.</summary>
    E,

    /// <summary>Grade F.</summary>
    F,

    /// <summary>Grade G.</summary>
    G,

    /// <summary>Grade H.</summary>
    H,

    /// <summary>Grade I, the armour placeholder.</summary>
    I,
}

/// <summary>
/// A one-per-ship family the game enforces. Two modules sharing a value cannot be fitted to
/// one hull at the same time, even in different slots.
/// </summary>
public enum ModuleExclusionGroup
{
    /// <summary>Cargo (manifest) scanners.</summary>
    CargoScanner,

    /// <summary>Detailed surface scanners.</summary>
    DetailedSurfaceScanner,

    /// <summary>Discovery scanners.</summary>
    DiscoveryScanner,

    /// <summary>Docking computers.</summary>
    DockingComputer,

    /// <summary>Experimental module stabilisers.</summary>
    ExperimentalModuleStabiliser,

    /// <summary>The experimental utility fittings.</summary>
    ExperimentalUtility,

    /// <summary>Fighter hangars.</summary>
    FighterHangar,

    /// <summary>Frame shift drive interdictors.</summary>
    FrameShiftDriveInterdictor,

    /// <summary>Frame shift wake scanners.</summary>
    FrameShiftWakeScanner,

    /// <summary>Fuel scoops.</summary>
    FuelScoop,

    /// <summary>Guardian FSD boosters.</summary>
    GuardianFsdBooster,

    /// <summary>Kill warrant scanners.</summary>
    KillWarrantScanner,

    /// <summary>Multi-limpet controllers.</summary>
    MultiLimpetController,

    /// <summary>Pulse wave analysers.</summary>
    PulseWaveAnalyser,

    /// <summary>Refineries.</summary>
    Refinery,

    /// <summary>Shield generators.</summary>
    ShieldGenerator,

    /// <summary>Supercruise assist.</summary>
    SupercruiseAssist,
}

/// <summary>A per-ship module-count family the game enforces.</summary>
/// <remarks>
/// Unlike an exclusion group, a limit group may allow more than one fitted module, and another
/// module may raise its allowance. The one family is the experimental-weapon limit that the AX
/// and Guardian weapons share.
/// </remarks>
public enum ModuleLimitGroup
{
    /// <summary>The experimental-weapon limit the AX and Guardian weapons share.</summary>
    ExperimentalWeapon,
}

/// <summary>A fitted module's increase to one limit-group allowance.</summary>
/// <param name="Group">The limit family whose allowance rises.</param>
/// <param name="Amount">Additional modules allowed, as a whole-module count of 1 or more.</param>
public sealed record ModuleLimitIncrease(ModuleLimitGroup Group, int Amount);

/// <summary>How a weapon's damage splits across the damage types, as fractions of one shot.</summary>
/// <remarks>
/// The conventional shares — kinetic, thermal, explosive, absolute and any unclassified share —
/// partition the damage and sum to 1; a type a weapon does not deal is absent rather than zero.
/// Kinetic, thermal and explosive damage meet the defender's resistance of the same name. No
/// shield or hull resistance reduces absolute damage, and in-game verification does not
/// establish the type or the mitigation of unclassified damage.
/// <para>
/// The anti-xeno share is different: it overlays the conventional split instead of partitioning
/// it, flagging the portion that is effective against Thargoid targets. It is expressed relative
/// to conventional damage and can exceed 1, so the values can sum past 1.
/// </para>
/// </remarks>
/// <param name="Kinetic">Kinetic share of one shot's damage.</param>
/// <param name="Thermal">Thermal share of one shot's damage.</param>
/// <param name="Explosive">Explosive share of one shot's damage.</param>
/// <param name="Absolute">Absolute share — damage no resistance reduces.</param>
/// <param name="Unclassified">Share that in-game verification does not classify.</param>
/// <param name="AntiXeno">
/// Anti-xeno ratio: the amount effective against Thargoids divided by conventional damage.
/// </param>
public sealed record DamageDistribution(
    double? Kinetic = null,
    double? Thermal = null,
    double? Explosive = null,
    double? Absolute = null,
    double? Unclassified = null,
    double? AntiXeno = null);

/// <summary>Exact damage amounts carried by one round, or by one second of continuous fire.</summary>
/// <remarks>
/// Every amount is at or above zero. Kinetic, thermal, explosive, absolute and all unclassified
/// entries sum to the module's conventional damage. The anti-xeno amount overlays that
/// conventional amount and is not added to it. The exact amounts are authoritative when
/// present; the fractional distribution remains the compatible projection.
/// </remarks>
/// <param name="Kinetic">Kinetic damage.</param>
/// <param name="Thermal">Thermal damage.</param>
/// <param name="Explosive">Explosive damage.</param>
/// <param name="Absolute">Absolute damage, which no resistance reduces.</param>
/// <param name="AntiXeno">Damage effective against Thargoid targets.</param>
/// <param name="Unclassified">Damage amounts in-game verification does not classify.</param>
public sealed record DamageComponents(
    double? Kinetic = null,
    double? Thermal = null,
    double? Explosive = null,
    double? Absolute = null,
    double? AntiXeno = null,
    IReadOnlyList<double>? Unclassified = null);

/// <summary>In-game projectile boundary parameters that are not effective weapon ranges.</summary>
/// <remarks>
/// The values are boundary parameters at or above zero. They are deliberately not stated in
/// metres and must not reach a range-attenuation calculation: a projectile's reach depends on
/// behaviour these two numbers do not represent.
/// </remarks>
/// <param name="FalloffBoundary">The falloff boundary parameter observed in-game.</param>
/// <param name="MaximumBoundary">The maximum boundary parameter observed in-game, when present.</param>
public sealed record ProjectileRangeBoundaries(double FalloffBoundary, double? MaximumBoundary = null);
