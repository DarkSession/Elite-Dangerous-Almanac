using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>Where a sector sits on the galaxy's grid of sector cubes.</summary>
/// <param name="SectorX">The sector index along the galactic X axis, zero through 127.</param>
/// <param name="SectorY">The sector index along the galactic Y axis.</param>
/// <param name="SectorZ">The sector index along the galactic Z axis, zero through 127.</param>
/// <remarks>
/// One step along an axis is one sector cube of 1280 light years. The X and Z axes hold
/// the whole seven-bit range. A system address carries six bits for Y, so a real system
/// reaches only zero through 63 there, although the naming itself reads all three the same
/// way.
/// </remarks>
public sealed record SectorGridPosition(int SectorX, int SectorY, int SectorZ);

/// <summary>The names the game gives the sectors it does not name by hand.</summary>
/// <remarks>
/// <para>
/// Most of the galaxy carries no hand-written sector name. The game builds one from the
/// sector's own place on the grid, under one of two schemes that a hash of the place picks
/// between. One scheme writes a single run-together word such as <c>Synuefe</c>. The other
/// writes two words such as <c>Blae Eock</c>.
/// </para>
/// <para>
/// <see cref="FromGridPosition"/> is the forward reading and <see cref="ToGridPosition"/>
/// is its inverse. Both are pure, and the tables behind them are built once.
/// </para>
/// <para>
/// The algorithm is the EDTS reference one. See <c>ATTRIBUTIONS.md</c> for credit and
/// licence terms.
/// </para>
/// </remarks>
public static class SectorName
{
    /// <summary>The most word parts one sector name holds.</summary>
    private const int MaxFragments = 4;

    /// <summary>Reads the procedural name of one sector.</summary>
    /// <param name="position">The sector's place on the grid.</param>
    /// <returns>The name in its own casing, such as <c>Synuefe</c> or <c>Blae Eock</c>.</returns>
    /// <exception cref="ArgumentNullException">The position is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An axis is outside zero through 127, or the generator gives that place no name.
    /// </exception>
    public static string FromGridPosition(SectorGridPosition position)
    {
        if (position is null) throw new ArgumentNullException(nameof(position));
        RequireGridPosition(position, nameof(position));

        int offset = (position.SectorZ << 14) + (position.SectorY << 7) + position.SectorX;
        string? name = IsSingleWordSector(offset) ? SingleWordName(offset) : TwoWordName(offset);
        return name ?? throw new ArgumentOutOfRangeException(
            nameof(position),
            position,
            "The generator gives that grid position no procedural name.");
    }

    /// <summary>Reads the grid position one procedural sector name states.</summary>
    /// <param name="name">The name in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The sector's place on the grid, or <see langword="null"/> where the name is not a
    /// procedural sector name. An absent name is a miss, answered the way an unknown one is.
    /// </returns>
    /// <remarks>
    /// Word parts overlap, so more than one reading of a name is possible. Only the reading
    /// that writes the name back out again is taken.
    /// </remarks>
    public static SectorGridPosition? ToGridPosition(string? name)
    {
        if (name is null) return null;
        string normalized = name.Trim().ToLowerInvariant();
        if (normalized.Length == 0) return null;

        string collapsed = CollapseWhitespace(normalized);
        foreach (IReadOnlyList<SectorFragment> reading in Readings(normalized))
        {
            SectorGridPosition? position = ReadPosition(reading);
            if (position is null) continue;

            // A reading that writes back a different name found a second way to spell the
            // parts, not this sector.
            string? written = TryFromGridPosition(position);
            if (written is not null &&
                string.Equals(written.ToLowerInvariant(), collapsed, StringComparison.Ordinal))
            {
                return position;
            }
        }

        return null;
    }

    /// <summary>Writes a procedural sector name in its own casing.</summary>
    /// <param name="name">The name in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The name as the game writes it, such as <c>Blae Eock</c> for <c>blae eock</c>, or
    /// <see langword="null"/> where the name is not a procedural sector name.
    /// </returns>
    public static string? Canonicalize(string? name)
    {
        SectorGridPosition? position = ToGridPosition(name);
        return position is null ? null : FromGridPosition(position);
    }

    /// <summary>Refuses a grid position the naming has no room for.</summary>
    internal static void RequireGridPosition(SectorGridPosition position, string parameter)
    {
        if (IsAxis(position.SectorX) && IsAxis(position.SectorY) && IsAxis(position.SectorZ)) return;
        throw new ArgumentOutOfRangeException(
            parameter,
            position,
            "A sector grid position holds three integers from 0 through 127.");

        static bool IsAxis(int value) => value >= 0 && value <= 127;
    }

    /// <summary>Reads a name where the position has one, and answers null where it has none.</summary>
    private static string? TryFromGridPosition(SectorGridPosition position)
    {
        int offset = (position.SectorZ << 14) + (position.SectorY << 7) + position.SectorX;
        return IsSingleWordSector(offset) ? SingleWordName(offset) : TwoWordName(offset);
    }

    /// <summary>
    /// Reads which of the two naming schemes one sector uses, from a hash of its offset.
    /// </summary>
    /// <returns>
    /// <see langword="true"/> for the one-word scheme, <see langword="false"/> for the
    /// two-word one.
    /// </returns>
    private static bool IsSingleWordSector(int offset)
    {
        uint key = unchecked((uint)offset);
        key += key << 12;
        key ^= key >> 22;
        key += key << 4;
        key ^= key >> 9;
        key += key << 10;
        key ^= key >> 2;
        key += key << 7;
        key ^= key >> 12;
        return (key & 1) == 0;
    }

    /// <summary>Builds the one-word name of one sector offset.</summary>
    /// <returns>The name, or <see langword="null"/> where the offset reaches past the tables.</returns>
    private static string? SingleWordName(int offset)
    {
        StringBuilder name = new();
        int prefixCount = offset / SectorFragmentIndex.PrefixTotalRunLength;
        int current = offset % SectorFragmentIndex.PrefixTotalRunLength;

        string prefix = LastPartAtOrBefore(
            SectorFragments.Prefixes, current, SectorFragmentIndex.PrefixOffset);
        string prefixKey = prefix.ToLowerInvariant();
        name.Append(prefix);
        current -= SectorFragmentIndex.PrefixOffset(prefixKey);

        bool consonantInfix = SectorFragments.C1PrefixInfix2.Contains(prefixKey);
        int infixTotal = InfixTotal(consonantInfix);
        int scaled = (prefixCount * SectorFragmentIndex.PrefixRunLength(prefixKey)) + current;
        int infixCount = scaled / infixTotal;
        current = scaled % infixTotal;

        string infix = LastPartAtOrBefore(
            InfixTable(consonantInfix), current, SectorFragmentIndex.InfixOffset).ToLowerInvariant();
        name.Append(infix);
        current -= SectorFragmentIndex.InfixOffset(infix);

        string[] suffixes = SuffixTable(consonantInfix);
        int suffixIndex = (SectorFragmentIndex.InfixRunLength(infix) * infixCount) + current;

        // A name whose parts reach past the suffix table takes a second infix, which
        // starts the count again in the other table.
        if (suffixIndex >= suffixes.Length)
        {
            bool secondConsonantInfix = !consonantInfix;
            int secondTotal = InfixTotal(secondConsonantInfix);
            int secondCount = suffixIndex / secondTotal;
            current = suffixIndex % secondTotal;

            string second = LastPartAtOrBefore(
                InfixTable(secondConsonantInfix),
                current,
                SectorFragmentIndex.InfixOffset).ToLowerInvariant();
            name.Append(second);
            current -= SectorFragmentIndex.InfixOffset(second);

            suffixes = SuffixTable(secondConsonantInfix);
            suffixIndex = (SectorFragmentIndex.InfixRunLength(second) * secondCount) + current;
        }

        if (suffixIndex >= suffixes.Length) return null;
        name.Append(suffixes[suffixIndex].ToLowerInvariant());
        return name.ToString();
    }

    /// <summary>Builds the two-word name of one sector offset.</summary>
    private static string TwoWordName(int offset)
    {
        (int first, int second) = Deinterleave(offset);

        string firstPrefix = LastPartAtOrBefore(
            SectorFragments.Prefixes, first, SectorFragmentIndex.PrefixOffset);
        string secondPrefix = LastPartAtOrBefore(
            SectorFragments.Prefixes, second, SectorFragmentIndex.PrefixOffset);
        string firstKey = firstPrefix.ToLowerInvariant();
        string secondKey = secondPrefix.ToLowerInvariant();

        string[] firstSuffixes = TwoWordSuffixTable(firstKey);
        string[] secondSuffixes = TwoWordSuffixTable(secondKey);
        string firstSuffix = firstSuffixes[first - SectorFragmentIndex.PrefixOffset(firstKey)];
        string secondSuffix = secondSuffixes[second - SectorFragmentIndex.PrefixOffset(secondKey)];

        return string.Format(
            CultureInfo.InvariantCulture,
            "{0}{1} {2}{3}",
            firstPrefix,
            firstSuffix.ToLowerInvariant(),
            secondPrefix,
            secondSuffix.ToLowerInvariant());
    }

    /// <summary>Reads the run lengths of one infix table, added up.</summary>
    private static int InfixTotal(bool consonant) => consonant
        ? SectorFragmentIndex.Infix2TotalRunLength
        : SectorFragmentIndex.Infix1TotalRunLength;

    /// <summary>Reads one of the two infix tables.</summary>
    private static string[] InfixTable(bool consonant) =>
        consonant ? SectorFragments.Infixes2 : SectorFragments.Infixes1;

    /// <summary>Reads the suffix table one infix hands the name on to.</summary>
    /// <remarks>A consonant infix ends in a vowel suffix, and a vowel infix in a consonant one.</remarks>
    private static string[] SuffixTable(bool consonant) =>
        consonant ? SectorFragments.Suffixes1 : SectorFragments.Suffixes2;

    /// <summary>Reads the suffix table one word of a two-word name ends in.</summary>
    /// <remarks>The prefixes that open on a vowel take a consonant suffix, and the rest a vowel one.</remarks>
    private static string[] TwoWordSuffixTable(string prefixKey) =>
        SectorFragments.C2PrefixSuffix2.Contains(prefixKey)
            ? SectorFragments.Suffixes2
            : SectorFragments.Suffixes1;

    /// <summary>Reads the last part of a table whose run starts at or before an offset.</summary>
    private static string LastPartAtOrBefore(
        string[] table, int offset, Func<string, int> startOffset)
    {
        string found = string.Empty;
        foreach (string part in table)
        {
            if (startOffset(part.ToLowerInvariant()) <= offset) found = part;
        }

        return found;
    }

    /// <summary>Reads a name into every sequence of word parts that spells it.</summary>
    /// <remarks>
    /// Word parts overlap, so a greedy reading loses names. The search stops at four parts,
    /// which is the most a name of either scheme holds, and which also keeps a malformed
    /// name from spreading the search.
    /// </remarks>
    private static List<IReadOnlyList<SectorFragment>> Readings(string name)
    {
        List<IReadOnlyList<SectorFragment>> readings = [];
        Visit(name, []);
        return readings;

        void Visit(string remaining, List<SectorFragment> taken)
        {
            if (remaining.Length == 0)
            {
                readings.Add(taken.ToArray());
                return;
            }

            if (taken.Count >= MaxFragments) return;

            bool afterSpace = remaining[0] == ' ';
            string current = remaining.TrimStart();
            if (current.Length == 0) return;

            foreach (SectorFragment match in SectorFragmentIndex.Fragments)
            {
                if (!current.StartsWith(match.Value, StringComparison.Ordinal)) continue;

                SectorFragment part = match;
                if (afterSpace)
                {
                    // A word opens with a prefix, so nothing after a space continues a word.
                    part = part with { IsSuffix = false, IsInfix = false };
                }
                else if (taken.Count > 0 &&
                    part.IsInfix &&
                    part.IsVowelInfix != taken[taken.Count - 1].IsVowelInfix)
                {
                    // An infix of the kind the part before it calls for is that infix, and
                    // not the opening of a second word.
                    part = part with { IsPrefix = false };
                }

                taken.Add(part);
                Visit(current.Substring(part.Value.Length), taken);
                taken.RemoveAt(taken.Count - 1);
            }
        }
    }

    /// <summary>Reads the grid position one sequence of word parts states.</summary>
    /// <returns>The position, or <see langword="null"/> where the sequence spells no name.</returns>
    private static SectorGridPosition? ReadPosition(IReadOnlyList<SectorFragment> parts)
    {
        if (parts.Count == MaxFragments &&
            parts[0].IsPrefix && parts[1].IsSuffix && parts[2].IsPrefix && parts[3].IsSuffix)
        {
            return TwoWordPosition(parts);
        }

        if (parts.Count == 3 && parts[0].IsPrefix && parts[1].IsInfix && parts[2].IsSuffix)
        {
            return SingleWordPosition(parts, secondInfix: false);
        }

        if (parts.Count == MaxFragments &&
            parts[0].IsPrefix && parts[1].IsInfix && parts[2].IsInfix && parts[3].IsSuffix)
        {
            return SingleWordPosition(parts, secondInfix: true);
        }

        return null;
    }

    /// <summary>Reads the grid position of a two-word name.</summary>
    private static SectorGridPosition? TwoWordPosition(IReadOnlyList<SectorFragment> parts)
    {
        // Each word pairs a prefix with a suffix of the other kind.
        if (parts[0].IsC2VowelPrefix == parts[1].IsVowelSuffix ||
            parts[2].IsC2VowelPrefix == parts[3].IsVowelSuffix)
        {
            return null;
        }

        int first = SectorFragmentIndex.PrefixOffset(parts[0].Value) + parts[1].SuffixIndex;
        int second = SectorFragmentIndex.PrefixOffset(parts[2].Value) + parts[3].SuffixIndex;
        return PositionOf(Interleave(first, second));
    }

    /// <summary>Reads the grid position of a one-word name.</summary>
    /// <param name="parts">The word parts, in the order they are written.</param>
    /// <param name="secondInfix">Whether the name carries two infixes.</param>
    private static SectorGridPosition? SingleWordPosition(
        IReadOnlyList<SectorFragment> parts, bool secondInfix)
    {
        // Vowel and consonant parts take turns the whole way along the word.
        int last = parts.Count - 1;
        if (parts[0].IsC1VowelPrefix == parts[1].IsVowelInfix ||
            parts[last - 1].IsVowelInfix == parts[last].IsVowelSuffix)
        {
            return null;
        }

        if (secondInfix && parts[1].IsVowelInfix == parts[2].IsVowelInfix) return null;

        int offset = parts[last].SuffixIndex;
        if (secondInfix) offset = UndoInfix(parts[2], offset);
        offset = UndoInfix(parts[1], offset);
        offset = UndoPrefix(parts[0], offset);
        return PositionOf(offset);
    }

    /// <summary>Takes one infix back off an offset.</summary>
    private static int UndoInfix(SectorFragment infix, int offset)
    {
        int runLength = SectorFragmentIndex.InfixRunLength(infix.Value);
        int remainder = offset % runLength;
        int scaled = (offset / runLength) * InfixTotal(!infix.IsVowelInfix);
        return scaled + remainder + SectorFragmentIndex.InfixOffset(infix.Value);
    }

    /// <summary>Takes the prefix back off an offset.</summary>
    private static int UndoPrefix(SectorFragment prefix, int offset)
    {
        int runLength = SectorFragmentIndex.PrefixRunLength(prefix.Value);
        int remainder = offset % runLength;
        int scaled = (offset / runLength) * SectorFragmentIndex.PrefixTotalRunLength;
        return scaled + remainder + SectorFragmentIndex.PrefixOffset(prefix.Value);
    }

    /// <summary>Reads the three axes one packed offset holds.</summary>
    private static SectorGridPosition PositionOf(int offset) =>
        new(offset & 0x7f, (offset >> 7) & 0x7f, (offset >> 14) & 0x7f);

    /// <summary>Puts the bits of two numbers one after the other into one number.</summary>
    private static int Interleave(int first, int second)
    {
        ulong value = (uint)first | ((ulong)(uint)second << 32);
        value = (value | (value << 8)) & 0x00ff00ff00ff00ffUL;
        value = (value | (value << 4)) & 0x0f0f0f0f0f0f0f0fUL;
        value = (value | (value << 2)) & 0x3333333333333333UL;
        value = (value | (value << 1)) & 0x5555555555555555UL;
        return unchecked((int)(uint)((value | (value >> 31)) & 0xffffffffUL));
    }

    /// <summary>Takes the two numbers back out of one interleaved number.</summary>
    private static (int First, int Second) Deinterleave(int offset)
    {
        ulong value = (uint)offset;
        ulong split = (value & 0x55555555UL) | ((value & 0xaaaaaaaaUL) << 31);
        split = (split | (split >> 1)) & 0x3333333333333333UL;
        split = (split | (split >> 2)) & 0x0f0f0f0f0f0f0f0fUL;
        split = (split | (split >> 4)) & 0x00ff00ff00ff00ffUL;
        split = (split | (split >> 8)) & 0x0000ffff0000ffffUL;
        return ((int)(split & 0xffffUL), (int)((split >> 32) & 0xffffUL));
    }

    /// <summary>Reads runs of whitespace as one space each.</summary>
    private static string CollapseWhitespace(string value)
    {
        StringBuilder collapsed = new(value.Length);
        bool inWhitespace = false;
        foreach (char letter in value)
        {
            if (char.IsWhiteSpace(letter))
            {
                if (!inWhitespace) collapsed.Append(' ');
                inWhitespace = true;
                continue;
            }

            inWhitespace = false;
            collapsed.Append(letter);
        }

        return collapsed.ToString();
    }
}
