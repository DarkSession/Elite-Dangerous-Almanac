using System;
using System.Globalization;

namespace EliteDangerousAlmanac.Astronomy.Internal;

/// <summary>The single number the three letters and the first index of a name pack into.</summary>
/// <remarks>
/// A procedural name states a boxel as three letters and a number, as in the <c>EN-H … 11</c>
/// of <c>Synuefe EN-H d11-96</c>. The address carries the four as one base-26 number, which
/// this class packs and checks.
/// </remarks>
internal static class BoxelCodes
{
    /// <summary>The step one count of the fourth field adds: the three letters below it.</summary>
    private const int NumberStride = 26 * 26 * 26;

    /// <summary>The largest fourth field that packs to an exact code for every letter.</summary>
    internal const int MaxNumber = (int.MaxValue - (NumberStride - 1)) / NumberStride;

    /// <summary>The largest code <see cref="Pack"/> answers.</summary>
    internal const int MaxCode = (MaxNumber * NumberStride) + (NumberStride - 1);

    /// <summary>Packs the four fields of a boxel into their base-26 code.</summary>
    /// <param name="l1">The first letter, zero through 25.</param>
    /// <param name="l2">The second letter, zero through 25.</param>
    /// <param name="l3">The third letter, zero through 25.</param>
    /// <param name="n1">The number after the letters, zero through <see cref="MaxNumber"/>.</param>
    /// <returns>The packed code.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A letter is outside zero through 25, or the number is outside its own range. Such a
    /// field packs as a different boxel rather than failing, so it is refused here.
    /// </exception>
    internal static int Pack(int l1, int l2, int l3, int n1)
    {
        RequireLetter(l1, nameof(l1));
        RequireLetter(l2, nameof(l2));
        RequireLetter(l3, nameof(l3));
        if (n1 < 0 || n1 > MaxNumber)
        {
            throw new ArgumentOutOfRangeException(
                nameof(n1),
                n1,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "The boxel number is an integer from 0 through {0}.",
                    MaxNumber));
        }

        return ((((n1 * 26) + l3) * 26) + l2) * 26 + l1;
    }

    /// <summary>Refuses a code no <see cref="Pack"/> call answers.</summary>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The code is outside zero through <see cref="MaxCode"/>. A larger code unpacks, but
    /// to a number no name could have packed.
    /// </exception>
    internal static void Require(int boxelCode, string parameter)
    {
        if (boxelCode >= 0 && boxelCode <= MaxCode) return;
        throw new ArgumentOutOfRangeException(
            parameter,
            boxelCode,
            string.Format(
                CultureInfo.InvariantCulture,
                "A boxel code is an integer from 0 through {0}.",
                MaxCode));
    }

    /// <summary>Refuses a letter index outside the alphabet.</summary>
    private static void RequireLetter(int letter, string parameter)
    {
        if (letter >= 0 && letter <= 25) return;
        throw new ArgumentOutOfRangeException(
            parameter, letter, "A boxel letter is an integer from 0 through 25.");
    }
}
