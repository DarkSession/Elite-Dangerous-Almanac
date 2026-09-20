using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.GalaxyMap;

/// <summary>
/// The galaxy map's location markers and the lookups that search them.
/// </summary>
/// <remarks>
/// <para>
/// The galaxy map draws an icon over a system to say what is there: a bookmark, a
/// community goal, a conflict zone, a damaged station. Each marker has a colour the game
/// is consistent about, and this catalogue reports it.
/// </para>
/// <para>
/// A marker's <see cref="GalaxyMapMarker.Symbol"/> also names its vector asset under
/// <c>assets/galaxy-map/</c>, whose root <c>&lt;svg&gt;</c> carries the same colour. The
/// assets are shared repository files rather than package content.
/// </para>
/// <para>
/// The colours are read from the in-game galaxy map. See
/// <c>data/galaxy-map/SOURCES.md</c> for provenance and <c>ATTRIBUTIONS.md</c> for credit.
/// </para>
/// </remarks>
/// <example>
/// <code>
/// using EliteDangerousAlmanac.GalaxyMap;
///
/// string? color = GalaxyMapMarkerCatalogue.FindColor("conflict-zone");
/// GalaxyMapMarker? marker = GalaxyMapMarkerCatalogue.FindBySymbol("front-line");
/// string frame = marker!.FrameColor;
/// </code>
/// </example>
public static class GalaxyMapMarkerCatalogue
{
    private static readonly Lazy<IReadOnlyList<GalaxyMapMarker>> Markers = new(
        () => SharedData.LoadList<GalaxyMapMarker>("data/galaxy-map/markers.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, GalaxyMapMarker>> BySymbol = new(
        () => RegistryIndex.CreateKeyIndex(All, marker => marker.Symbol));

    /// <summary>Every galaxy-map marker, sorted by <see cref="GalaxyMapMarker.Symbol"/>.</summary>
    public static IReadOnlyList<GalaxyMapMarker> All => Markers.Value;

    /// <summary>Finds a marker by its symbol.</summary>
    /// <param name="symbol">
    /// The marker symbol, such as <c>station-under-attack</c>. Leading and trailing
    /// whitespace and case are ignored.
    /// </param>
    /// <returns>The marker, or <see langword="null"/> when none has that symbol.</returns>
    public static GalaxyMapMarker? FindBySymbol(string? symbol) =>
        RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol);

    /// <summary>Finds the colour a marker's glyph is drawn in.</summary>
    /// <param name="symbol">
    /// The marker symbol, such as <c>titan</c>. Leading and trailing whitespace and case
    /// are ignored.
    /// </param>
    /// <returns>
    /// The <c>#RRGGBB</c> colour, or <see langword="null"/> when no marker has that symbol.
    /// </returns>
    public static string? FindColor(string? symbol) => FindBySymbol(symbol)?.Color;
}
