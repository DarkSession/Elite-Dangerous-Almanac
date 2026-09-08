using System;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The range checks a public numeric argument is held to.</summary>
/// <remarks>
/// The rules are shared rather than restated, because a rule written twice is a rule free to
/// drift. Each check names the parameter the caller wrote, so a failure reports the argument the
/// caller passed rather than the helper that read it.
/// </remarks>
internal static class RangeGuards
{
    /// <summary>Requires a capacitor-pip allocation from zero through four.</summary>
    /// <param name="value">The allocation as received.</param>
    /// <param name="name">The parameter to name in a failure.</param>
    /// <returns>The allocation, for a caller that reads it back.</returns>
    /// <remarks>
    /// Pips run from zero to four and may be fractional, because the game's own curves are
    /// continuous.
    /// </remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The value is not a finite number from zero through four.
    /// </exception>
    internal static double RequirePips(double value, string name)
    {
        if (double.IsNaN(value) || double.IsInfinity(value) || value < 0 || value > 4)
        {
            throw new ArgumentOutOfRangeException(
                name, value, "The value must be a finite number from 0 through 4.");
        }

        return value;
    }

    /// <summary>Requires a finite number of zero or more.</summary>
    /// <param name="value">The value as received.</param>
    /// <param name="name">The parameter to name in a failure.</param>
    /// <returns>The value, for a caller that reads it back.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The value is not a finite number of zero or more.
    /// </exception>
    internal static double RequireFiniteNonNegative(double value, string name)
    {
        if (double.IsNaN(value) || double.IsInfinity(value) || value < 0)
        {
            throw new ArgumentOutOfRangeException(
                name, value, "The value must be a finite number of 0 or more.");
        }

        return value;
    }

    /// <summary>Requires a finite number above zero.</summary>
    /// <param name="value">The value as received.</param>
    /// <param name="name">The parameter to name in a failure.</param>
    /// <returns>The value, for a caller that reads it back.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The value is not a finite number above zero.
    /// </exception>
    internal static double RequirePositive(double value, string name)
    {
        if (double.IsNaN(value) || double.IsInfinity(value) || value <= 0)
        {
            throw new ArgumentOutOfRangeException(
                name, value, "The value must be a finite number above 0.");
        }

        return value;
    }
}
