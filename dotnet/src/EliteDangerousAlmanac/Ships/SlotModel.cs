using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The kind of mount a slot is.</summary>
public enum SlotKind
{
    /// <summary>One of the seven core internals every hull has.</summary>
    Core,

    /// <summary>A weapon hardpoint.</summary>
    Hardpoint,

    /// <summary>A tiny utility mount.</summary>
    Utility,

    /// <summary>An optional internal.</summary>
    Optional,

    /// <summary>The hull's armour mount.</summary>
    Armour,

    /// <summary>The fixed cargo hatch.</summary>
    CargoHatch,
}

/// <summary>A restriction limiting which modules a mount accepts.</summary>
/// <remarks>
/// <para>
/// The list is complete. No hardpoint is restricted to one mount type — fixed, gimballed
/// or turret — and no utility mount is restricted.
/// </para>
/// <para>
/// Frontier gives every restricted mount a journal name of its own, so a slot key alone
/// says which restriction applies. Two names differ from the member: a
/// <see cref="VesselHangar"/> mount is named <c>FighterBay01</c>, and
/// <see cref="PlanetaryApproachSuite"/> is the only key that carries no number.
/// </para>
/// </remarks>
public enum SlotRestriction
{
    /// <summary>
    /// Mining tools, on a hardpoint. Only the Type-11 Prospector has such mounts.
    /// </summary>
    Mining,

    /// <summary>
    /// Reinforcement packages and shield cell banks, on an optional internal (journal
    /// <c>Military01</c>).
    /// </summary>
    Military,

    /// <summary>
    /// The planetary approach suite, which in turn fits nowhere else (journal
    /// <c>PlanetaryApproachSuite</c>).
    /// </summary>
    PlanetaryApproachSuite,

    /// <summary>Cargo racks and fuel tanks (journal <c>Cargo01</c>).</summary>
    Cargo,

    /// <summary>Any limpet controller (journal <c>LimpetController01</c>).</summary>
    LimpetController,

    /// <summary>Vessel hangars, Mk I and Mk II (journal <c>FighterBay01</c>).</summary>
    VesselHangar,

    /// <summary>Passenger cabins, Mk I and Mk II (journal <c>Passenger01</c>).</summary>
    Passenger,
}

/// <summary>The seven fixed core-internal mounts, by function.</summary>
/// <remarks>
/// These are not slot keys. A core mount has two names: this function, and the journal's
/// own slot key, which is what every slot-key argument wants. Two of the pairs are not
/// even the same word: <see cref="Thrusters"/> is keyed <c>MainEngines</c> and
/// <see cref="Sensors"/> is keyed <c>Radar</c>.
/// </remarks>
public enum CoreSlotType
{
    /// <summary>The power plant (journal slot <c>PowerPlant</c>).</summary>
    PowerPlant,

    /// <summary>The thrusters (journal slot <c>MainEngines</c>).</summary>
    Thrusters,

    /// <summary>The frame shift drive (journal slot <c>FrameShiftDrive</c>).</summary>
    FrameShiftDrive,

    /// <summary>Life support (journal slot <c>LifeSupport</c>).</summary>
    LifeSupport,

    /// <summary>The power distributor (journal slot <c>PowerDistributor</c>).</summary>
    PowerDistributor,

    /// <summary>The sensors (journal slot <c>Radar</c>).</summary>
    Sensors,

    /// <summary>The main fuel tank (journal slot <c>FuelTank</c>).</summary>
    FuelTank,
}

/// <summary>The fixed mount a module is built for.</summary>
/// <remarks>
/// <para>
/// The eight core-internal mounts every hull has: the seven <see cref="CoreSlotType"/>
/// functions plus <see cref="Armour"/>, which is a fixed mount too but is sized per hull
/// rather than by class.
/// </para>
/// <para>
/// A module carries this when it fills one particular mount and nothing else. Most do not:
/// a hardpoint weapon, a utility fitting and an optional internal each fit any mount of
/// their kind that is big enough.
/// </para>
/// <para>
/// The first seven members share their numeric values with <see cref="CoreSlotType"/>, so
/// a core function converts by a plain cast.
/// </para>
/// </remarks>
public enum ModuleSlot
{
    /// <summary>The power plant.</summary>
    PowerPlant = CoreSlotType.PowerPlant,

    /// <summary>The thrusters.</summary>
    Thrusters = CoreSlotType.Thrusters,

    /// <summary>The frame shift drive.</summary>
    FrameShiftDrive = CoreSlotType.FrameShiftDrive,

    /// <summary>Life support.</summary>
    LifeSupport = CoreSlotType.LifeSupport,

    /// <summary>The power distributor.</summary>
    PowerDistributor = CoreSlotType.PowerDistributor,

    /// <summary>The sensors.</summary>
    Sensors = CoreSlotType.Sensors,

    /// <summary>The main fuel tank.</summary>
    FuelTank = CoreSlotType.FuelTank,

    /// <summary>
    /// The hull's armour mount, which takes the bulkheads made for that one hull.
    /// </summary>
    Armour = 100,
}

/// <summary>What each slot restriction accepts, as a phrase fit for an outfitting screen.</summary>
/// <remarks>
/// This is the same wording a loadout uses when it refuses a module, so a label you show
/// and the reason a caller reads cannot drift apart.
/// </remarks>
public static class SlotRestrictions
{
    private static readonly Dictionary<SlotRestriction, string> Labels = new()
    {
        [SlotRestriction.Mining] = "mining tools",
        [SlotRestriction.Military] = "reinforcement packages and shield cell banks",
        [SlotRestriction.PlanetaryApproachSuite] = "planetary approach suites",
        [SlotRestriction.Cargo] = "cargo racks and fuel tanks",
        [SlotRestriction.LimpetController] = "limpet controllers",
        [SlotRestriction.VesselHangar] = "vessel hangars",
        [SlotRestriction.Passenger] = "passenger cabins",
    };

    /// <summary>What a restricted mount accepts, as a short phrase.</summary>
    /// <param name="restriction">The restriction to describe.</param>
    /// <returns>The phrase.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="restriction"/> is not a member.</exception>
    public static string Label(this SlotRestriction restriction) =>
        Labels.TryGetValue(restriction, out string? label)
            ? label
            : throw new ArgumentOutOfRangeException(nameof(restriction), restriction, "Not a slot restriction.");

    /// <summary>Whether a restriction is one a weapon hardpoint can carry.</summary>
    /// <param name="restriction">The restriction to classify.</param>
    /// <returns><see langword="true"/> for a hardpoint restriction.</returns>
    public static bool IsHardpointRestriction(this SlotRestriction restriction) =>
        restriction == SlotRestriction.Mining;

    /// <summary>Whether a restriction is one an optional internal can carry.</summary>
    /// <param name="restriction">The restriction to classify.</param>
    /// <returns><see langword="true"/> for an optional-internal restriction.</returns>
    public static bool IsOptionalRestriction(this SlotRestriction restriction) =>
        restriction != SlotRestriction.Mining;

    /// <summary>The journal slot key a core mount has.</summary>
    /// <param name="core">The core function.</param>
    /// <returns>The journal slot key, such as <c>MainEngines</c> for the thrusters.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="core"/> is not a member.</exception>
    public static string SlotKey(this CoreSlotType core) => core switch
    {
        CoreSlotType.PowerPlant => "PowerPlant",
        CoreSlotType.Thrusters => "MainEngines",
        CoreSlotType.FrameShiftDrive => "FrameShiftDrive",
        CoreSlotType.LifeSupport => "LifeSupport",
        CoreSlotType.PowerDistributor => "PowerDistributor",
        CoreSlotType.Sensors => "Radar",
        CoreSlotType.FuelTank => "FuelTank",
        _ => throw new ArgumentOutOfRangeException(nameof(core), core, "Not a core mount."),
    };
}
