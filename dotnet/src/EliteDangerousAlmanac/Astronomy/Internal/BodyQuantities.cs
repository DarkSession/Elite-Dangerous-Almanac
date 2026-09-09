using System;

namespace EliteDangerousAlmanac.Astronomy.Internal;

/// <summary>Reads a figure a scan states, where the figure can be used.</summary>
/// <remarks>
/// A journal writes zero for a figure it does not have as readily as it leaves the field
/// out, so a calculation reads a stated figure through one of these rather than reaching
/// for the field itself.
/// </remarks>
internal static class BodyQuantities
{
    /// <summary>Reads a figure a calculation needs above zero.</summary>
    /// <returns>The figure, or <see langword="null"/> where it is absent or not above zero.</returns>
    internal static double? Positive(double? value) =>
        value is double figure && !double.IsNaN(figure) && !double.IsInfinity(figure) && figure > 0
            ? figure
            : null;

    /// <summary>Reads a figure a calculation needs finite, zero included.</summary>
    /// <returns>The figure, or <see langword="null"/> where it is absent or not finite.</returns>
    internal static double? Finite(double? value) =>
        value is double figure && !double.IsNaN(figure) && !double.IsInfinity(figure)
            ? figure
            : null;

    /// <summary>The volume of a sphere of one radius, in cubic metres.</summary>
    internal static double SphereVolume(double radiusM) =>
        4d / 3d * Math.PI * radiusM * radiusM * radiusM;
}
