namespace EliteDangerousAlmanac.Astronomy;

/// <summary>A point in the galaxy, in light years, with Sol at the origin.</summary>
/// <param name="X">The galactic X coordinate in light years.</param>
/// <param name="Y">The galactic Y coordinate in light years.</param>
/// <param name="Z">The galactic Z coordinate in light years.</param>
/// <remarks>
/// This is the frame the player journal, EDSM and Spansh report a system position in, so
/// a caller hands one straight to the naming grid.
/// </remarks>
public sealed record GalacticPosition(double X, double Y, double Z);
