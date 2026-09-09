using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// The Elite Dangerous ship catalogue: every player-flyable hull's identity, stats and slot
/// layout, with the lookups that turn an internal symbol or a display name into a hull.
/// </summary>
/// <remarks>
/// <para>
/// There is one list of hulls and it is small, so the lookups take no catalogue argument:
/// they always search <see cref="All"/>. Stock module identities live in the default
/// loadouts, which keeps this hull catalogue independent of them.
/// </para>
/// <para>
/// Symbols and entitlements come from EDCD FDevIDs, with exact English display names and
/// stat corrections verified in-game. The remaining stats and the slot layout come
/// primarily from EDCD coriolis-data. See <c>data/ships/SOURCES.md</c> for provenance and
/// <c>ATTRIBUTIONS.md</c> for credit.
/// </para>
/// </remarks>
public static class ShipCatalogue
{
    private static readonly Lazy<IReadOnlyList<Ship>> Ships = new(Load);

    private static readonly Lazy<IReadOnlyDictionary<string, Ship>> BySymbol = new(
        () => RegistryIndex.CreateKeyIndex(All, ship => ship.Symbol));

    private static readonly Lazy<IReadOnlyDictionary<string, Ship>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(All, ship => ship.Name));

    /// <summary>
    /// Every player-flyable hull, in Frontier's shipyard order — roughly the order the
    /// hulls were introduced, beginning with the Sidewinder.
    /// </summary>
    public static IReadOnlyList<Ship> All => Ships.Value;

    /// <summary>Finds a hull by its internal symbol.</summary>
    /// <param name="symbol">
    /// The internal identifier, such as <c>Empire_Trader</c>. Leading and trailing
    /// whitespace and case are ignored, so the journal's lower-cased form resolves too.
    /// </param>
    /// <returns>The hull, or <see langword="null"/> when no hull has that symbol.</returns>
    public static Ship? FindBySymbol(string? symbol) => RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol);

    /// <summary>Finds a hull by its display name.</summary>
    /// <param name="name">
    /// The display name as the shipyard spells it, such as <c>Imperial Clipper</c>. Leading
    /// and trailing whitespace and case are ignored; matching is otherwise exact.
    /// </param>
    /// <returns>The hull, or <see langword="null"/> when no hull has that name.</returns>
    public static Ship? FindByName(string? name) => RegistryIndex.FindInKeyIndex(ByName.Value, name);

    /// <summary>A hull's slot layout, ready to enumerate.</summary>
    /// <param name="symbol">The internal identifier. Whitespace and case are ignored.</param>
    /// <returns>
    /// The layout, or <see langword="null"/> when no hull has that symbol. Every carried
    /// hull has a layout, so a symbol that resolves always answers one.
    /// </returns>
    public static ShipSlots? FindSlots(string? symbol) => FindBySymbol(symbol)?.Slots();

    private static ReadOnlyCollection<Ship> Load()
    {
        IReadOnlyList<Ship> ships = SharedData.LoadList<Ship>("data/ships/ships.jsonc");
        List<Ship> frozen = new(ships.Count);
        foreach (Ship ship in ships)
        {
            frozen.Add(ship with
            {
                Hardpoints = ReadOnlyLists.Freeze(ship.Hardpoints),
                Optional = ReadOnlyLists.Freeze(ship.Optional),
            });
        }

        return new ReadOnlyCollection<Ship>(frozen);
    }
}
