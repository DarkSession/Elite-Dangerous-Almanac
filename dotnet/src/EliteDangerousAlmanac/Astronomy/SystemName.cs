using System;
using System.Globalization;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>The parts one procedural system name is written from.</summary>
/// <param name="RegionName">The region name, as written.</param>
/// <param name="L1">The first boxel letter, zero through 25.</param>
/// <param name="L2">The second boxel letter, zero through 25.</param>
/// <param name="L3">The third boxel letter, zero through 25.</param>
/// <param name="SizeClass">The size class the mass-code letter states, zero through seven.</param>
/// <param name="N1">The boxel index before the hyphen, which is zero where the name omits it.</param>
/// <param name="N2">The system's own number.</param>
/// <remarks>
/// The letters and the mass code are held as counts rather than characters, so they go
/// straight into the address maths.
/// </remarks>
public sealed record SystemNameParts(
    string RegionName,
    int L1,
    int L2,
    int L3,
    int SizeClass,
    int N1,
    int N2);

/// <summary>The four fields one boxel code holds.</summary>
/// <param name="L1">The first letter, zero through 25.</param>
/// <param name="L2">The second letter, zero through 25.</param>
/// <param name="L3">The third letter, zero through 25.</param>
/// <param name="N1">The number after the letters.</param>
public sealed record BoxelLetters(int L1, int L2, int L3, int N1);

/// <summary>The written form of a procedural system name.</summary>
/// <remarks>
/// <para>
/// A procedural system name reads as <c>Region LL-L m[N1-]N2</c>, as in
/// <c>Synuefe EN-H d11-96</c> or <c>Blae Eock KC-C d0</c>. The region is the sector name,
/// procedural or hand-written. The three letters and the first index state the boxel
/// inside that region, the mass code states how large the boxel is, and the last index
/// numbers the system inside it. The game leaves the first index and its hyphen out where
/// it is zero.
/// </para>
/// <para>
/// This class reads and writes the text alone. <see cref="SystemAddress"/> holds the
/// packed form the game identifies a system by.
/// </para>
/// </remarks>
public static class SystemName
{
    /// <summary>The shortest name the grammar accepts, as in <c>Th aa-a a0</c>.</summary>
    /// <remarks>
    /// The fixed ending takes nine characters, and the shortest region the game writes
    /// takes two. The EDTS reference draws the bound in the same place.
    /// </remarks>
    private const int ShortestName = 10;

    /// <summary>Packs a boxel's letters and index into one base-26 code.</summary>
    /// <param name="l1">The first letter, zero through 25.</param>
    /// <param name="l2">The second letter, zero through 25.</param>
    /// <param name="l3">The third letter, zero through 25.</param>
    /// <param name="n1">The number after the letters.</param>
    /// <returns>The packed code.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A letter is outside zero through 25, or the number is too large to pack exactly.
    /// </exception>
    public static int ToBoxelCode(int l1, int l2, int l3, int n1) =>
        BoxelCodes.Pack(l1, l2, l3, n1);

    /// <summary>Takes the letters and the index back out of one boxel code.</summary>
    /// <param name="boxelCode">The packed code, as the address decoder answers.</param>
    /// <returns>The three letters and the number after them.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The code is not one <see cref="ToBoxelCode"/> answers.
    /// </exception>
    public static BoxelLetters ToBoxelLetters(int boxelCode)
    {
        BoxelCodes.Require(boxelCode, nameof(boxelCode));
        return new BoxelLetters(
            boxelCode % 26,
            boxelCode / 26 % 26,
            boxelCode / (26 * 26) % 26,
            boxelCode / (26 * 26 * 26));
    }

    /// <summary>Reads a procedural system name into its parts.</summary>
    /// <param name="name">The name in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The parts, or <see langword="null"/> where the name is not a procedural system name.
    /// An absent name is a miss, so a caller hands over a field an import may not carry.
    /// </returns>
    /// <remarks>
    /// A region name carries digits of its own, as <c>Col 285 Sector</c> does, so the
    /// reading walks the ending backwards. The letters and the mass code come out as
    /// counts, and therefore write back in the game's own casing. The region comes out as
    /// written; <see cref="Canonicalize"/> re-cases that too.
    /// </remarks>
    public static SystemNameParts? Parse(string? name)
    {
        if (name is null) return null;
        string trimmed = name.Trim();
        string lower = trimmed.ToLowerInvariant();
        int at = trimmed.Length - 1;

        if (trimmed.Length < ShortestName) return null;
        if (!IsDigit(lower[at])) return null;

        while (at > 8 && IsDigit(lower[at])) at--;
        if (!TryReadNumber(lower, at + 1, trimmed.Length - 1, out int n2)) return null;

        int n1 = 0;
        if (lower[at] == '-')
        {
            at--;
            int end = at;
            while (at > 8 && IsDigit(lower[at])) at--;
            if (at == end) return null;
            if (!TryReadNumber(lower, at + 1, end, out n1)) return null;
        }

        if (lower[at] < 'a' || lower[at] > 'h') return null;
        int sizeClass = lower[at] - 'a';
        at--;

        if (lower[at] != ' ') return null;
        at--;

        if (!IsLetter(lower[at])) return null;
        int l3 = lower[at] - 'a';
        at--;

        if (lower[at] != '-') return null;
        at--;

        if (!IsLetter(lower[at])) return null;
        int l2 = lower[at] - 'a';
        at--;

        if (!IsLetter(lower[at])) return null;
        int l1 = lower[at] - 'a';
        at--;

        if (lower[at] != ' ') return null;
        at--;

        return new SystemNameParts(trimmed.Substring(0, at + 1), l1, l2, l3, sizeClass, n1, n2);
    }

    /// <summary>Writes parts back out as a system name.</summary>
    /// <param name="parts">The parts to write.</param>
    /// <returns>The name, such as <c>Synuefe EN-H d11-96</c>.</returns>
    /// <exception cref="ArgumentNullException">The parts are absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A letter is outside zero through 25, or the size class is outside zero through seven.
    /// </exception>
    /// <remarks>
    /// The first index and its hyphen are left out where the index is zero, which is what
    /// the game does. The region is written as it is held, so a name read in lower case
    /// keeps its own region casing.
    /// </remarks>
    public static string Format(SystemNameParts parts)
    {
        if (parts is null) throw new ArgumentNullException(nameof(parts));

        char l1 = Letter(parts.L1, nameof(parts));
        char l2 = Letter(parts.L2, nameof(parts));
        char l3 = Letter(parts.L3, nameof(parts));
        char massCode = MassCode.FromSizeClass(parts.SizeClass);
        string index = parts.N1 != 0
            ? string.Format(CultureInfo.InvariantCulture, "{0}-{1}", parts.N1, parts.N2)
            : parts.N2.ToString(CultureInfo.InvariantCulture);

        return string.Format(
            CultureInfo.InvariantCulture,
            "{0} {1}{2}-{3} {4}{5}",
            parts.RegionName,
            l1,
            l2,
            l3,
            massCode,
            index);
    }

    /// <summary>Writes a system name in the game's own casing.</summary>
    /// <param name="name">The name in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The name as the game writes it, or <see langword="null"/> where it is not a system
    /// name.
    /// </returns>
    /// <remarks>
    /// A procedural region is re-cased by reading it through the grid, and a region the
    /// game names by hand by looking it up. A region neither answers is left as written, so
    /// reading a name stays apart from addressing one.
    /// </remarks>
    public static string? Canonicalize(string? name)
    {
        SystemNameParts? parts = Parse(name);
        if (parts is null) return null;

        string region = SectorName.Canonicalize(parts.RegionName)
            ?? NamingRegionOrigins.FindHandAuthored(parts.RegionName)?.Name
            ?? parts.RegionName;
        return Format(parts with { RegionName = region });
    }

    /// <summary>Reads whether a name is a well-formed procedural system name.</summary>
    /// <param name="name">The name in any casing, with any surrounding whitespace.</param>
    /// <param name="requireProceduralRegion">
    /// Whether the region must itself be a procedural sector. Where it is
    /// <see langword="true"/>, a system inside a region the game names by hand, such as
    /// <c>Pleiades Sector HR-W d1-79</c>, is not one.
    /// </param>
    /// <returns>
    /// <see langword="true"/> where the name reads as a procedural system name. A system the
    /// game names outright, such as <c>Sol</c>, is not one. An absent name is not one either.
    /// </returns>
    public static bool IsProcedural(string? name, bool requireProceduralRegion = false)
    {
        SystemNameParts? parts = Parse(name);
        if (parts is null) return false;
        return !requireProceduralRegion || SectorName.ToGridPosition(parts.RegionName) is not null;
    }

    /// <summary>Reads whether one character is a digit.</summary>
    private static bool IsDigit(char value) => value >= '0' && value <= '9';

    /// <summary>Reads whether one character is a lower-case letter.</summary>
    private static bool IsLetter(char value) => value >= 'a' && value <= 'z';

    /// <summary>Reads the number one run of digits states.</summary>
    private static bool TryReadNumber(string value, int start, int end, out int number)
    {
        number = 0;
        if (end < start) return false;
        return int.TryParse(
            value.AsSpan(start, end - start + 1),
            NumberStyles.None,
            CultureInfo.InvariantCulture,
            out number);
    }

    /// <summary>Writes one letter count as its letter.</summary>
    private static char Letter(int index, string parameter)
    {
        if (index < 0 || index > 25)
        {
            throw new ArgumentOutOfRangeException(
                parameter, index, "A boxel letter is an integer from 0 through 25.");
        }

        return (char)('A' + index);
    }
}
