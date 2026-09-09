using System;
using System.Collections.Generic;

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
    /// <para>
    /// A half goes towards positive infinity rather than away from zero, which is the rule
    /// the reference implementations round ammunition counts by.
    /// </para>
    /// <para>
    /// Adding a half before the floor differs from the reference rounding on two families of
    /// input: the double just below a half, which the reference answers as zero, and the odd
    /// whole numbers at or above two to the fifty-second. An engineered figure stays far
    /// below either, so no call here can reach one.
    /// </para>
    /// </remarks>
    internal static double RoundHalfUp(double value) => Math.Floor(value + 0.5);

    /// <summary>The burst parts a recipe moves, which move the firing cycle with them.</summary>
    internal static readonly string[] BurstPatternLabels = ["BurstSize", "BurstRateOfFire", "BurstInterval"];

    /// <summary>Serializes a stored float to the six decimal places a journal writes.</summary>
    /// <param name="value">The stored value.</param>
    /// <returns>The serialized value, with a negative zero answered as zero.</returns>
    internal static double Round6(double value)
    {
        double rounded = RoundHalfUp(value * 1e6) / 1e6;
        return rounded == 0 ? 0 : rounded;
    }

    /// <summary>A burst part that cannot describe a cycle falls back to one.</summary>
    /// <param name="value">The stated burst part, when there is one.</param>
    /// <returns>The part, or one.</returns>
    /// <remarks>
    /// A weapon that names no burst fires one round per cycle, and an unspecified within-burst
    /// rate is one shot a second. It is applied wherever a cycle is built, so the block a module
    /// publishes and the stats it resolves cannot part company over a zero.
    /// </remarks>
    internal static double BurstPartOrOne(double? value) => value is > 0 ? value.Value : 1;

    /// <summary>The firing-cycle duration, with a float stored after every operation.</summary>
    /// <param name="interval">The interval between cycles, in seconds.</param>
    /// <param name="burstRounds">The rounds one burst fires.</param>
    /// <param name="burstRateOfFire">The within-burst rate, in rounds a second.</param>
    /// <returns>The cycle duration, or <see langword="null"/> when there is no cycle.</returns>
    internal static double? Float32FiringCycle(double interval, double burstRounds, double burstRateOfFire)
    {
        if (interval <= 0) return null;
        double rounds = BurstPartOrOne(burstRounds);
        double withinBurst = rounds > 1
            ? Fround(Fround(rounds - 1) / Fround(BurstPartOrOne(burstRateOfFire)))
            : 0;
        double cycle = Fround(withinBurst + Fround(interval));
        return cycle > 0 ? cycle : null;
    }

    /// <summary>
    /// The rate of fire a journal reports for a firing cycle: the stored float, serialized the
    /// way a rate-of-fire modifier is written.
    /// </summary>
    /// <param name="interval">The interval between cycles, in seconds.</param>
    /// <param name="burstRounds">The rounds one burst fires.</param>
    /// <param name="burstRateOfFire">The within-burst rate, in rounds a second.</param>
    /// <returns>The rate, or <see langword="null"/> when there is no cycle.</returns>
    /// <remarks>
    /// It is the one derivation behind every rate of fire this library answers with, so no two
    /// of them differ in the last place a journal serializes.
    /// </remarks>
    internal static double? JournalRateOfFire(double? interval, double? burstRounds, double? burstRateOfFire)
    {
        if (interval is null) return null;
        double? cycle = Float32FiringCycle(
            interval.Value, BurstPartOrOne(burstRounds), BurstPartOrOne(burstRateOfFire));
        return cycle is null ? null : Round6(Fround(Fround(BurstPartOrOne(burstRounds)) / cycle.Value));
    }

    /// <summary>The stored-float value one label carries in a block.</summary>
    /// <param name="modifiers">The block to read.</param>
    /// <param name="label">The label to read.</param>
    /// <returns>The most precise figure available, or <see langword="null"/> when the label is absent.</returns>
    internal static double? PreciseValueFor(IReadOnlyList<EngineeringModifier> modifiers, string label)
    {
        foreach (EngineeringModifier modifier in modifiers)
        {
            if (string.Equals(modifier.Label, label, StringComparison.OrdinalIgnoreCase))
            {
                return modifier.PreciseValue;
            }
        }

        return null;
    }
}
