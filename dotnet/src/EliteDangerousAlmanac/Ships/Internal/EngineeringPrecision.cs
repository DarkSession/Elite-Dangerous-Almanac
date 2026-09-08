using System;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The precision the game stores engineering figures at, and a journal writes them at.</summary>
/// <remarks>
/// A journal <c>Modifiers</c> value is a stored 32-bit float serialized to six decimal places.
/// Every step of an engineering calculation stores its result as that float, so a figure this
/// library derives lands in the same place the game's own does.
/// </remarks>
internal static class EngineeringPrecision
{
    /// <summary>Stores one value the way the game stores it, as a 32-bit float.</summary>
    /// <param name="value">The value to store.</param>
    /// <returns>The nearest 32-bit float, widened back for further arithmetic.</returns>
    internal static double Fround(double value) => (float)value;

    /// <summary>Rounds to the nearest whole number, with a half going upwards.</summary>
    /// <param name="value">The value to round.</param>
    /// <returns>The rounded value.</returns>
    /// <remarks>
    /// A half goes towards positive infinity rather than away from zero, which is the rule
    /// the reference implementations round ammunition counts by.
    /// </remarks>
    internal static double RoundHalfUp(double value) => Math.Floor(value + 0.5);

    /// <summary>Serializes a stored float to the six decimal places a journal writes.</summary>
    /// <param name="value">The stored value.</param>
    /// <returns>The serialized value, with a negative zero answered as zero.</returns>
    internal static double Round6(double value)
    {
        double rounded = RoundHalfUp(value * 1e6) / 1e6;
        return rounded == 0 ? 0 : rounded;
    }
}
