using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>Where one naming region starts, and how far it reaches.</summary>
/// <param name="Name">The region name, as catalogued.</param>
/// <param name="X">The starting X coordinate in internal units.</param>
/// <param name="Y">The starting Y coordinate in internal units.</param>
/// <param name="Z">The starting Z coordinate in internal units.</param>
/// <param name="SizeX">How far the region reaches along X, in internal units.</param>
/// <param name="SizeY">How far the region reaches along Y, in internal units.</param>
/// <param name="SizeZ">How far the region reaches along Z, in internal units.</param>
/// <remarks>
/// Internal units are thirty-seconds of a light year, counted from the galaxy corner.
/// </remarks>
public sealed record NamingRegionOrigin(
    string Name,
    [property: JsonPropertyName("x0")] double X,
    [property: JsonPropertyName("y0")] double Y,
    [property: JsonPropertyName("z0")] double Z,
    double SizeX,
    double SizeY,
    double SizeZ);

/// <summary>Where the game's naming regions start.</summary>
/// <remarks>
/// <para>
/// Writing a system name as an address needs the region's own starting point. A region the
/// game names by hand, such as <c>Col 285 Sector</c> or <c>Cepheus Dark Region B</c>,
/// starts somewhere the boxel grid does not, so its starting point is catalogued. Every
/// other region is a plain procedural sector, whose starting point is its place on the grid
/// times the sector size.
/// </para>
/// <para>
/// The catalogue loads from its shared data file on first use, and every record is
/// immutable. It comes from the EDTS reference and the community research behind it. See
/// <c>data/astro/SOURCES.md</c> for where it was read from, and <c>ATTRIBUTIONS.md</c> for
/// credit and licence terms.
/// </para>
/// </remarks>
public static class NamingRegionOrigins
{
    private static readonly Lazy<IReadOnlyList<NamingRegionOrigin>> Catalogue = new(
        () => SharedData.LoadList<NamingRegionOrigin>("data/astro/named-region-origins.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, NamingRegionOrigin>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(HandAuthored, region => region.Name));

    /// <summary>Every region the game names by hand.</summary>
    public static IReadOnlyList<NamingRegionOrigin> HandAuthored => Catalogue.Value;

    /// <summary>Finds where one region the game names by hand starts.</summary>
    /// <param name="name">The region name, in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The catalogued record, or <see langword="null"/> where no such region is catalogued.
    /// An absent name is a miss, answered the way an unknown one is.
    /// </returns>
    public static NamingRegionOrigin? FindHandAuthored(string? name) =>
        RegistryIndex.FindInKeyIndex(ByName.Value, name);

    /// <summary>Reads where one region starts, whether the game names it or the grid does.</summary>
    /// <param name="name">The region name, in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The region's starting point, or <see langword="null"/> where the name is neither
    /// catalogued nor a procedural sector.
    /// </returns>
    public static NamingRegionOrigin? Resolve(string? name)
    {
        NamingRegionOrigin? handAuthored = FindHandAuthored(name);
        if (handAuthored is not null) return handAuthored;

        SectorGridPosition? position = SectorName.ToGridPosition(name);
        if (position is null) return null;

        return new NamingRegionOrigin(
            SectorName.FromGridPosition(position),
            (double)position.SectorX * SystemAddress.SectorInternalSize,
            (double)position.SectorY * SystemAddress.SectorInternalSize,
            (double)position.SectorZ * SystemAddress.SectorInternalSize,
            SystemAddress.SectorInternalSize,
            SystemAddress.SectorInternalSize,
            SystemAddress.SectorInternalSize);
    }
}
