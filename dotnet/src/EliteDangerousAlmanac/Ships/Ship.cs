using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The landing-pad size class a hull requires.</summary>
public enum ShipSize
{
    /// <summary>A small pad.</summary>
    Small,

    /// <summary>A medium pad.</summary>
    Medium,

    /// <summary>A large pad.</summary>
    Large,
}

/// <summary>One ship hull: its identity, its stats and its slot layout in one record.</summary>
/// <remarks>
/// <para>
/// The symbol and any entitlement come from Frontier's shipyard registry. The name is the
/// installed English localisation string where in-game verification differs from that
/// registry. The manufacturer, the size, the stats and the slot layout come primarily from
/// coriolis-data, with verified in-game readings governing disagreements and omissions.
/// </para>
/// <para>
/// Masses are tonnes, speeds are metres per second, and rotation rates are degrees per
/// second. A minimum and full pair is the installed value at zero and at four ENG pips.
/// </para>
/// </remarks>
/// <param name="Symbol">
/// The internal identifier, such as <c>Empire_Trader</c> for the Imperial Clipper. The
/// journal carries it lower-cased, and lookups match without regard to case, so either
/// form resolves. This is the hull's key.
/// </param>
/// <param name="Name">The installed English display name. It is unique across the catalogue.</param>
/// <param name="Manufacturer">The hull manufacturer as the shipyard names it.</param>
/// <param name="Size">The landing-pad size class the hull requires.</param>
/// <param name="Entitlement">
/// Frontier's purchase-grant token, present only when the hull is gated behind one.
/// </param>
/// <param name="HullMass">
/// Empty-hull mass, in tonnes. A build's unladen mass is this plus every fitted module.
/// </param>
/// <param name="MinimumSpeed">Speed at zero ENG pips, in metres per second.</param>
/// <param name="MaximumSpeed">Speed at four ENG pips, in metres per second.</param>
/// <param name="Boost">Boost speed, in metres per second.</param>
/// <param name="BaseShieldStrength">
/// Base shield strength, in megajoules, before the generator and any boosters.
/// </param>
/// <param name="BaseArmour">Base armour, in hull hit points, before reinforcement.</param>
/// <param name="Hardness">Hull hardness — its resistance to armour piercing.</param>
/// <param name="Masslock">How strongly the hull impedes a smaller ship's frame shift drive.</param>
/// <param name="Crew">Number of crew seats, for a fighter pilot or multicrew.</param>
/// <param name="HeatCapacity">How much heat the hull absorbs before it takes damage.</param>
/// <param name="HeatDissipation">
/// Maximum heat dissipation, in thermal-load units per second — the heat the hull sheds at
/// heat level 1, and the load a build carries indefinitely. Heat settles where thermal load
/// and dissipation balance, and the heat capacity only decides how long the ship takes to
/// get there. The figure is community-measured rather than published by Frontier.
/// </param>
/// <param name="ReserveFuelCapacity">
/// Reserve tank capacity, in tonnes. It feeds the main tank from empty.
/// </param>
/// <param name="HullCost">
/// Standard price of the hull alone, in credits, before any discount — the figure a
/// shipyard quotes when you already own the modules.
/// </param>
/// <param name="RetailCost">
/// Standard price of the hull with its default module loadout, in credits. It is never
/// below the hull cost.
/// </param>
/// <param name="MinPitch">Pitch rate at zero ENG pips, in degrees per second.</param>
/// <param name="Pitch">Pitch rate at four ENG pips, in degrees per second.</param>
/// <param name="MinRoll">Roll rate at zero ENG pips, in degrees per second.</param>
/// <param name="Roll">Roll rate at four ENG pips, in degrees per second.</param>
/// <param name="MinYaw">Yaw rate at zero ENG pips, in degrees per second.</param>
/// <param name="Yaw">Yaw rate at four ENG pips, in degrees per second.</param>
/// <param name="Core">The seven core-internal mount sizes.</param>
/// <param name="Hardpoints">
/// Weapon hardpoints, largest first. A mount carries a restriction only when it takes one
/// family of weapons and nothing else.
/// </param>
/// <param name="Utility">Number of tiny utility mounts.</param>
/// <param name="Optional">
/// Optional-internal mounts, largest first. A mount carries a name only where the game's
/// slot key is not what the numbering rules produce.
/// </param>
public sealed record Ship(
    string Symbol,
    string Name,
    string Manufacturer,
    ShipSize Size,
    string? Entitlement,
    double HullMass,
    double MinimumSpeed,
    double MaximumSpeed,
    double Boost,
    double BaseShieldStrength,
    double BaseArmour,
    double Hardness,
    double Masslock,
    int Crew,
    double HeatCapacity,
    double HeatDissipation,
    double ReserveFuelCapacity,
    long HullCost,
    long RetailCost,
    double MinPitch,
    double Pitch,
    double MinRoll,
    double Roll,
    double MinYaw,
    double Yaw,
    CoreSlots Core,
    IReadOnlyList<HardpointSlotSpec> Hardpoints,
    int Utility,
    IReadOnlyList<OptionalSlotSpec> Optional)
{
    /// <summary>This hull's slot layout on its own, ready to enumerate.</summary>
    /// <remarks>
    /// This is the read-only layout, for an outfitting screen of your own. To assemble and
    /// edit an actual build, start a loadout instead.
    /// </remarks>
    /// <returns>The layout.</returns>
    public ShipSlots Slots() => new(Symbol, Core, Hardpoints, Utility, Optional);
}
