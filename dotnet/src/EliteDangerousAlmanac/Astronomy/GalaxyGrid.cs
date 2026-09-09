using System;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>The bridge from a galactic position to the naming grid.</summary>
/// <remarks>
/// <para>
/// <see cref="SectorName"/> reads a sector's place on the grid, and
/// <see cref="SystemAddress"/> works in the game's own internal units. A caller holds
/// neither. It holds light years with Sol at the origin, which is what the player journal,
/// EDSM and Spansh report. This class converts one to the other.
/// </para>
/// <para>
/// The three frames the surface uses are the galactic position in light years from Sol,
/// the sector grid in cubes of 1280 light years from the galaxy corner, and the internal
/// units of one thirty-second of a light year from the same corner.
/// </para>
/// </remarks>
public static class GalaxyGrid
{
    /// <summary>The corner of the galaxy, in light years from Sol.</summary>
    /// <remarks>
    /// Sector and boxel positions are counted from this point. The codex region map states
    /// the same corner, and a test holds the two together.
    /// </remarks>
    public static readonly GalacticPosition Origin = new(-49985, -40985, -24105);

    /// <summary>The edge of one sector cube, in light years.</summary>
    public const int SectorEdgeLy = 1280;

    /// <summary>Reads the sector cube one galactic position falls in.</summary>
    /// <param name="position">The position in light years, with Sol at the origin.</param>
    /// <returns>The sector's place on the grid.</returns>
    /// <exception cref="ArgumentNullException">The position is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The position lies outside the grid of sector cubes, which is outside the galaxy the
    /// addressing reaches.
    /// </exception>
    public static SectorGridPosition ToSectorGridPosition(GalacticPosition position)
    {
        if (position is null) throw new ArgumentNullException(nameof(position));

        double x = Math.Floor((position.X - Origin.X) / SectorEdgeLy);
        double y = Math.Floor((position.Y - Origin.Y) / SectorEdgeLy);
        double z = Math.Floor((position.Z - Origin.Z) / SectorEdgeLy);
        if (!IsAxis(x) || !IsAxis(y) || !IsAxis(z))
        {
            throw new ArgumentOutOfRangeException(
                nameof(position),
                position,
                "The position lies outside the grid of sector cubes.");
        }

        return new SectorGridPosition((int)x, (int)y, (int)z);

        static bool IsAxis(double value) => value >= 0 && value <= 127;
    }

    /// <summary>Reads the procedural sector name of one galactic position.</summary>
    /// <param name="position">The position in light years, with Sol at the origin.</param>
    /// <returns>The sector name, such as <c>Synuefe</c> or <c>Blae Eock</c>.</returns>
    /// <exception cref="ArgumentNullException">The position is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The position lies outside the grid, or the generator gives that place no name.
    /// </exception>
    /// <remarks>
    /// The answer is always the procedural sector. A system inside a region the game names
    /// by hand carries that region's name instead.
    /// </remarks>
    public static string ToSectorName(GalacticPosition position) =>
        SectorName.FromGridPosition(ToSectorGridPosition(position));
}
