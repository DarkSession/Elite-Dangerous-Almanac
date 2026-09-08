using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One module fitted to a stock ship.</summary>
/// <param name="Slot">The journal-compatible mount key, such as <c>FrameShiftDrive</c>.</param>
/// <param name="Symbol">The Frontier module symbol, such as <c>Int_Hyperdrive_Size2_Class1</c>.</param>
public sealed record DefaultLoadoutModule(string Slot, string Symbol);

/// <summary>A hull's ready-to-fly module fit, as the shipyard supplies it.</summary>
/// <param name="Symbol">The Frontier hull symbol.</param>
/// <param name="Modules">
/// The fitted modules in outfitting-panel order. An empty optional, hardpoint or utility mount is
/// left out. The armour, the seven core internals, the planetary approach suite and the built-in
/// cargo hatch are always present.
/// </param>
public sealed record DefaultLoadout(string Symbol, IReadOnlyList<DefaultLoadoutModule> Modules);

/// <summary>The stock module loadout for every player-flyable ship.</summary>
/// <remarks>
/// <para>
/// Each record is deliberately small: a hull symbol, and the journal-compatible slot and module
/// symbols fitted when the ship is supplied. Read it where an application needs the identities
/// without the outfitting catalogue behind them.
/// </para>
/// <para>
/// The stock builds come from EDSY, with coriolis-data and captured Frontier journal loadouts
/// supplying or corroborating the advanced planetary approach suite and the cargo hatches. See
/// <c>data/ships/SOURCES.md</c>.
/// </para>
/// </remarks>
public static class DefaultLoadouts
{
    private static readonly Lazy<IReadOnlyList<DefaultLoadout>> Catalogue = new(Load);

    /// <summary>Every hull's default loadout, in the ship catalogue's own order.</summary>
    /// <remarks>The list and its nested module lists refuse mutation.</remarks>
    public static IReadOnlyList<DefaultLoadout> All => Catalogue.Value;

    /// <summary>Looks up a hull's default module loadout by symbol, ignoring case.</summary>
    /// <param name="shipSymbol">
    /// The hull symbol. Leading and trailing whitespace and letter case are ignored.
    /// </param>
    /// <returns>The default loadout, or <see langword="null"/> where the hull is unknown.</returns>
    public static DefaultLoadout? Find(string? shipSymbol) =>
        RegistryIndex.FindByKey(All, loadout => loadout.Symbol, shipSymbol);

    private static ReadOnlyCollection<DefaultLoadout> Load()
    {
        var file = SharedData.Load<List<DefaultLoadout>>("data/ships/default-loadouts.jsonc");
        var loadouts = new List<DefaultLoadout>(file.Count);
        foreach (DefaultLoadout loadout in file)
        {
            loadouts.Add(loadout with
            {
                Modules = new ReadOnlyCollection<DefaultLoadoutModule>(
                    new List<DefaultLoadoutModule>(loadout.Modules)),
            });
        }

        return new ReadOnlyCollection<DefaultLoadout>(loadouts);
    }
}
