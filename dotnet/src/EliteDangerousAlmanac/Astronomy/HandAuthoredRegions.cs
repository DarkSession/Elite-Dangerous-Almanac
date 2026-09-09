using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Text.Json.Serialization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>One ball of space a region the game names by hand fills.</summary>
/// <param name="CenterX">The centre's galactic X in light years, with Sol at the origin.</param>
/// <param name="CenterY">The centre's galactic Y in light years.</param>
/// <param name="CenterZ">The centre's galactic Z in light years.</param>
/// <param name="Radius">How far the ball reaches from its centre, in light years.</param>
public sealed record HandAuthoredSphere(
    [property: JsonPropertyName("cx")] double CenterX,
    [property: JsonPropertyName("cy")] double CenterY,
    [property: JsonPropertyName("cz")] double CenterZ,
    [property: JsonPropertyName("r")] double Radius);

/// <summary>A sector the game names by hand, and the space it fills.</summary>
/// <param name="Name">The region name as the game writes it, such as <c>Pleiades Sector</c>.</param>
/// <param name="Spheres">The balls of space the region is the union of.</param>
/// <remarks>
/// Whether the region asks for a permit is not held here. <see cref="PermitLocks"/> is the
/// one place that reads that, and it takes this name.
/// </remarks>
public sealed record HandAuthoredRegion(string Name, IReadOnlyList<HandAuthoredSphere> Spheres);

/// <summary>The sectors the game names by hand, found by where a system sits.</summary>
/// <remarks>
/// <para>
/// The generator only ever writes the boxel name of a place. A system that physically
/// falls inside a nebula or a cluster the game names by hand carries that region's name
/// instead. Each such region is one ball of space or several, in light years with Sol at
/// the origin, and a system belongs to the first region whose space holds it.
/// </para>
/// <para>
/// The catalogue is held smallest ball first, which is how the game settles an overlap:
/// the smallest region that holds the place wins.
/// </para>
/// <para>
/// The word region carries three meanings in this galaxy. This one is a sector the game
/// names by hand. <see cref="SectorName"/> reads a sector the generator names, and
/// <see cref="CodexRegions"/> reads one of the 42 zones the codex records a find against.
/// </para>
/// </remarks>
public static class HandAuthoredRegions
{
    private static readonly Lazy<IReadOnlyList<HandAuthoredRegion>> Catalogue = new(Build);

    /// <summary>Every sector the game names by hand, smallest ball of space first.</summary>
    public static IReadOnlyList<HandAuthoredRegion> All => Catalogue.Value;

    /// <summary>Reads the region one place in the galaxy belongs to.</summary>
    /// <param name="position">The position in light years, with Sol at the origin.</param>
    /// <returns>
    /// The region that holds the place, or <see langword="null"/> where the generator names
    /// it instead.
    /// </returns>
    /// <exception cref="ArgumentNullException">The position is absent.</exception>
    /// <remarks>
    /// All three axes count. A region the game names by hand is a ball of space, so the
    /// height matters here, which it does not for a codex region.
    /// </remarks>
    public static HandAuthoredRegion? FindAt(GalacticPosition position)
    {
        if (position is null) throw new ArgumentNullException(nameof(position));

        foreach (HandAuthoredRegion region in All)
        {
            foreach (HandAuthoredSphere sphere in region.Spheres)
            {
                double dx = position.X - sphere.CenterX;
                double dy = position.Y - sphere.CenterY;
                double dz = position.Z - sphere.CenterZ;
                if ((dx * dx) + (dy * dy) + (dz * dz) <= sphere.Radius * sphere.Radius)
                {
                    return region;
                }
            }
        }

        return null;
    }

    /// <summary>Reads the catalogue, and closes the balls of each region to a change.</summary>
    private static ReadOnlyCollection<HandAuthoredRegion> Build()
    {
        IReadOnlyList<HandAuthoredRegion> records =
            SharedData.LoadList<HandAuthoredRegion>("data/astro/hand-authored-regions.jsonc");
        List<HandAuthoredRegion> regions = new(records.Count);
        foreach (HandAuthoredRegion region in records)
        {
            regions.Add(region with { Spheres = ReadOnlyLists.Freeze(region.Spheres) });
        }

        return new ReadOnlyCollection<HandAuthoredRegion>(regions);
    }
}
