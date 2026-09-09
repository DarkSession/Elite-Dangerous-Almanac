using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>A place on the flat plane of the galaxy, in light years.</summary>
/// <param name="X">The galactic X coordinate, in light years.</param>
/// <param name="Z">The galactic Z coordinate, towards or away from the core, in light years.</param>
public sealed record GalacticPlanePosition(double X, double Z);

/// <summary>How far one codex region reaches on the plane of the galaxy, in light years.</summary>
/// <param name="MinX">The smallest galactic X the region reaches.</param>
/// <param name="MaxX">The largest galactic X the region reaches.</param>
/// <param name="MinZ">The smallest galactic Z the region reaches.</param>
/// <param name="MaxZ">The largest galactic Z the region reaches.</param>
/// <remarks>
/// The region map is flat, so a region has no height and states no bound along Y.
/// </remarks>
public sealed record CodexRegionBounds(double MinX, double MaxX, double MinZ, double MaxZ);

/// <summary>One of the galaxy's codex regions.</summary>
/// <param name="Id">The region's number, one through 42.</param>
/// <param name="Name">The region name, such as <c>Inner Orion Spur</c>.</param>
/// <param name="Grayscale">The grey the region carries in the region map the data came from.</param>
/// <param name="CellCount">How many cells of the region grid the region fills.</param>
/// <param name="AreaLy2">About how much of the plane the region covers, in square light years.</param>
/// <param name="Bounds">How far the region reaches on the plane.</param>
/// <param name="Centroid">The region's middle on the plane, weighted by its cells.</param>
/// <remarks>
/// The area, the bounds and the middle are read off the region grid, whose cell is about
/// 49 light years on a side. They are near enough to compare regions with, and they are
/// not survey figures.
/// </remarks>
public sealed record CodexRegion(
    int Id,
    string Name,
    int Grayscale,
    int CellCount,
    double AreaLy2,
    CodexRegionBounds Bounds,
    GalacticPlanePosition Centroid);

/// <summary>The 42 codex regions the galaxy is divided into.</summary>
/// <remarks>
/// <para>
/// Every system belongs to exactly one of them. This class reads what one region is,
/// which costs the region facts alone. <see cref="CodexRegionMap"/> reads which region
/// one place belongs to, which costs the grid the map is drawn on.
/// </para>
/// <para>
/// A region number of zero means outside the mapped grid, and no region carries it.
/// </para>
/// <para>
/// The numbers and the names come from the EliteDangerousRegionMap project. See
/// <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class CodexRegions
{
    private static readonly Lazy<IReadOnlyList<CodexRegion>> Catalogue = new(
        () => SharedData.LoadList<CodexRegion>("data/astro/galactic-regions.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<int, CodexRegion>> ById = new(BuildIdIndex);

    private static readonly Lazy<IReadOnlyDictionary<string, CodexRegion>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(All, region => region.Name));

    /// <summary>Every codex region, in the order of their numbers.</summary>
    public static IReadOnlyList<CodexRegion> All => Catalogue.Value;

    /// <summary>Finds a region by its number.</summary>
    /// <param name="id">The region number, one through 42.</param>
    /// <returns>
    /// The region, or <see langword="null"/> for zero, which means outside the mapped grid,
    /// and for any other number no region carries.
    /// </returns>
    public static CodexRegion? Find(int id) =>
        ById.Value.TryGetValue(id, out CodexRegion? region) ? region : null;

    /// <summary>Finds a region by its name.</summary>
    /// <param name="name">The region name, in any casing, with any surrounding whitespace.</param>
    /// <returns>The region, or <see langword="null"/> for a name no region carries.</returns>
    public static CodexRegion? FindByName(string? name) =>
        RegistryIndex.FindInKeyIndex(ByName.Value, name);

    /// <summary>Indexes the regions by number.</summary>
    private static ReadOnlyDictionary<int, CodexRegion> BuildIdIndex()
    {
        Dictionary<int, CodexRegion> index = new(All.Count);
        foreach (CodexRegion region in All)
        {
            if (index.ContainsKey(region.Id)) continue;
            index.Add(region.Id, region);
        }

        return new ReadOnlyDictionary<int, CodexRegion>(index);
    }
}
