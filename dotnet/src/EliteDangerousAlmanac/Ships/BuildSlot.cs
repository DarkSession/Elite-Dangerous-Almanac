using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One mount on a hull — its stable key, its kind and its size.</summary>
/// <remarks>
/// <see cref="Kind"/> decides which of the two optional fields carries a value. A core
/// mount names its <see cref="Core"/> function and carries no restriction; a hardpoint or
/// an optional internal may carry a <see cref="Restriction"/> and never names a core
/// function; a utility, armour or cargo-hatch mount carries neither.
/// </remarks>
/// <param name="Key">
/// The stable, journal-compatible slot key, such as <c>PowerPlant</c>,
/// <c>HugeHardpoint1</c>, <c>Slot01_Size6</c> or <c>Military01</c>. Every slot-key
/// argument takes this string, matched without regard to case and otherwise exactly.
/// Enumerate the keys rather than typing them: the numbering looks regular and on some
/// hulls is not.
/// </param>
/// <param name="Kind">Which kind of mount this is.</param>
/// <param name="Size">
/// The mount's class. Core, optional and hardpoint mounts are 1 to 8; a utility mount and
/// the armour mount use 0, because their fit rules are not size-based; the cargo hatch
/// uses 1.
/// </param>
/// <param name="Core">The core function this mount accepts, on a core mount only.</param>
/// <param name="Restriction">The module family this mount requires, when it is restricted.</param>
public sealed record BuildSlot(
    string Key,
    SlotKind Kind,
    int Size,
    CoreSlotType? Core = null,
    SlotRestriction? Restriction = null);

/// <summary>What a journal slot key says about the mount it names.</summary>
/// <param name="Kind">Which kind of mount the key names.</param>
/// <param name="Size">
/// The mount's class, or <see langword="null"/> when the key does not encode one and the
/// mount has one to encode — <c>Radar</c>, <c>Military01</c>, <c>Cargo01</c>. The hull's
/// layout carries the size instead.
/// <para>
/// <see langword="null"/> is not the only "no size here" answer. A mount whose fit rules
/// are not size-based reads 0, and the cargo hatch reads 1. Test this for falsiness, or
/// against the <paramref name="Kind"/> you expect.
/// </para>
/// </param>
/// <param name="Core">The core function a core key fills, such as <c>MainEngines</c> to thrusters.</param>
/// <param name="Restriction">
/// The restriction the key implies, such as <c>Military01</c> to
/// <see cref="SlotRestriction.Military"/>.
/// </param>
public sealed record ParsedSlot(
    SlotKind Kind,
    int? Size,
    CoreSlotType? Core = null,
    SlotRestriction? Restriction = null);

/// <summary>The size of each of a hull's seven core-internal mounts.</summary>
/// <remarks>
/// Each value is the mount's class, 1 to 8: the largest module that fits it. The names are
/// the core functions, not journal slot keys.
/// </remarks>
/// <param name="PowerPlant">Power-plant mount size.</param>
/// <param name="Thrusters">Thruster mount size (journal slot <c>MainEngines</c>).</param>
/// <param name="FrameShiftDrive">Frame shift drive mount size.</param>
/// <param name="LifeSupport">Life-support mount size.</param>
/// <param name="PowerDistributor">Power-distributor mount size.</param>
/// <param name="Sensors">Sensor mount size (journal slot <c>Radar</c>).</param>
/// <param name="FuelTank">Main fuel-tank mount size.</param>
public sealed record CoreSlots(
    int PowerPlant,
    int Thrusters,
    int FrameShiftDrive,
    int LifeSupport,
    int PowerDistributor,
    int Sensors,
    int FuelTank)
{
    /// <summary>The size of one core mount.</summary>
    /// <param name="core">The core function to size.</param>
    /// <returns>The mount's class, 1 to 8.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="core"/> is not a member.</exception>
    public int this[CoreSlotType core] => core switch
    {
        CoreSlotType.PowerPlant => PowerPlant,
        CoreSlotType.Thrusters => Thrusters,
        CoreSlotType.FrameShiftDrive => FrameShiftDrive,
        CoreSlotType.LifeSupport => LifeSupport,
        CoreSlotType.PowerDistributor => PowerDistributor,
        CoreSlotType.Sensors => Sensors,
        CoreSlotType.FuelTank => FuelTank,
        _ => throw new ArgumentOutOfRangeException(nameof(core), core, "Not a core mount."),
    };
}

/// <summary>One weapon hardpoint in a hull's layout.</summary>
/// <param name="Size">Mount class, 1 for small through 4 for huge.</param>
/// <param name="Restriction">
/// A restriction, when the mount only takes one family of weapons. Only the Type-11
/// Prospector has any.
/// </param>
/// <param name="Name">
/// The mount's own journal slot key, when the numbering rules do not reproduce it — the
/// Type-8 Transporter's <c>SmallHardpoint4</c>, the Caspian Explorer's out-of-order
/// mediums. Absent when the rules are right.
/// </param>
public sealed record HardpointSlotSpec(int Size, SlotRestriction? Restriction = null, string? Name = null);

/// <summary>One optional-internal mount in a hull's layout.</summary>
/// <param name="Size">Mount class, 1 to 8.</param>
/// <param name="Restriction">A restriction, when the mount only takes one family of modules.</param>
/// <param name="Name">
/// The mount's own journal slot key, when the numbering rules do not reproduce it — the
/// Anaconda's <c>Slot14_Size1</c>, the Type-9 Heavy's <c>Slot00_Size8</c>. The
/// <c>_SizeN</c> in such a key may disagree with <paramref name="Size"/>, which is always
/// the mount's real class: the Keelback's <c>Slot03_Size3</c> names a size-4 mount. That
/// is Frontier's own text, kept as it is.
/// </param>
public sealed record OptionalSlotSpec(int Size, SlotRestriction? Restriction = null, string? Name = null);

/// <summary>A hull's full slot layout.</summary>
/// <remarks>
/// The armour mount is not listed, because it is not sized: a hull's armour options are
/// ordinary modules tied to the hull by their own ship field.
/// </remarks>
/// <param name="Symbol">Hull symbol, matching the ship catalogue.</param>
/// <param name="Core">The seven core-internal sizes.</param>
/// <param name="Hardpoints">Weapon hardpoints, largest first.</param>
/// <param name="Utility">Number of tiny utility mounts.</param>
/// <param name="Optional">Optional-internal mounts, largest first.</param>
public sealed record ShipSlots(
    string Symbol,
    CoreSlots Core,
    IReadOnlyList<HardpointSlotSpec> Hardpoints,
    int Utility,
    IReadOnlyList<OptionalSlotSpec> Optional);
