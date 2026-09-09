using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Astronomy.Internal;

/// <summary>One word part, and the places a sector name can hold it.</summary>
/// <param name="Value">The part itself, in lower case.</param>
/// <param name="IsPrefix">Whether a name can open with the part.</param>
/// <param name="IsC1VowelPrefix">Whether a one-word name follows the part with a consonant infix.</param>
/// <param name="IsC2VowelPrefix">Whether a two-word name follows the part with a consonant suffix.</param>
/// <param name="IsInfix">Whether the part can sit between the opening and the ending.</param>
/// <param name="IsVowelInfix">Whether the part is a vowel infix, where it is an infix at all.</param>
/// <param name="IsSuffix">Whether a word can end with the part.</param>
/// <param name="IsVowelSuffix">Whether the part is a vowel suffix, where it is a suffix at all.</param>
/// <param name="SuffixIndex">The part's place in its own suffix table.</param>
/// <remarks>
/// One part plays more than one role. The parser reads a name into parts, then keeps only
/// the reading whose roles a name of that class allows.
/// </remarks>
internal sealed record SectorFragment(
    string Value,
    bool IsPrefix,
    bool IsC1VowelPrefix,
    bool IsC2VowelPrefix,
    bool IsInfix,
    bool IsVowelInfix,
    bool IsSuffix,
    bool IsVowelSuffix,
    int SuffixIndex);

/// <summary>
/// The running totals that turn a sector's grid offset into a name, and a name back into
/// an offset.
/// </summary>
/// <remarks>
/// <para>
/// Each word part covers a run of offsets. A part's start offset is the sum of the run
/// lengths before it, and a table's total run length is the sum of them all. The whole set
/// is built once from <see cref="SectorFragments"/>, and nothing changes it afterwards.
/// </para>
/// <para>
/// The tables and the arithmetic over them are the EDTS reference algorithm. See
/// <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
internal static class SectorFragmentIndex
{
    /// <summary>The start offset of every prefix.</summary>
    internal static readonly IReadOnlyDictionary<string, int> PrefixOffsets;

    /// <summary>The run length of every prefix.</summary>
    private static readonly Dictionary<string, int> PrefixRunLengths;

    /// <summary>The start offset of every infix, of both kinds.</summary>
    internal static readonly IReadOnlyDictionary<string, int> InfixOffsets;

    /// <summary>The run length of every infix, of both kinds.</summary>
    private static readonly Dictionary<string, int> InfixRunLengths;

    /// <summary>The run lengths of every prefix, added up.</summary>
    internal static readonly int PrefixTotalRunLength;

    /// <summary>The run lengths of every vowel infix, added up.</summary>
    internal static readonly int Infix1TotalRunLength;

    /// <summary>The run lengths of every consonant infix, added up.</summary>
    internal static readonly int Infix2TotalRunLength;

    /// <summary>
    /// Every distinct word part with the roles it can play, longest first.
    /// </summary>
    /// <remarks>
    /// The order lets the parser take the longest part that fits before it tries a shorter
    /// one, and it keeps the reading order the same on every run.
    /// </remarks>
    internal static readonly IReadOnlyList<SectorFragment> Fragments;

    static SectorFragmentIndex()
    {
        (PrefixOffsets, PrefixRunLengths, PrefixTotalRunLength) = BuildOffsets(
            SectorFragments.Prefixes,
            SectorFragments.PrefixRunLengths,
            SectorFragments.PrefixDefaultRunLength);

        // A vowel infix counts through the consonant suffixes, and a consonant infix
        // through the vowel ones, so each pass carries its own default.
        (Dictionary<string, int> infix1Offsets,
            Dictionary<string, int> infix1RunLengths,
            Infix1TotalRunLength) = BuildOffsets(
            SectorFragments.Infixes1,
            SectorFragments.InfixRunLengths,
            SectorFragments.Suffixes2.Length);

        (Dictionary<string, int> infix2Offsets,
            Dictionary<string, int> infix2RunLengths,
            Infix2TotalRunLength) = BuildOffsets(
            SectorFragments.Infixes2,
            SectorFragments.InfixRunLengths,
            SectorFragments.Suffixes1.Length);

        InfixOffsets = Merge(infix1Offsets, infix2Offsets);
        InfixRunLengths = Merge(infix1RunLengths, infix2RunLengths);
        Fragments = BuildFragments();
    }

    /// <summary>Reads the run length of one prefix.</summary>
    internal static int PrefixRunLength(string prefix) => PrefixRunLengths[prefix];

    /// <summary>Reads the run length of one infix.</summary>
    internal static int InfixRunLength(string infix) => InfixRunLengths[infix];

    /// <summary>Reads the start offset of one prefix.</summary>
    internal static int PrefixOffset(string prefix) => PrefixOffsets[prefix];

    /// <summary>Reads the start offset of one infix.</summary>
    internal static int InfixOffset(string infix) => InfixOffsets[infix];

    /// <summary>Gives every part of one table its start offset and its run length.</summary>
    /// <param name="items">The table, in the order the generator counts it.</param>
    /// <param name="statedRunLengths">The run lengths a part states for itself.</param>
    /// <param name="defaultRunLength">The run length of a part that states none.</param>
    /// <returns>The start offsets, the run lengths, and the total run length.</returns>
    private static (Dictionary<string, int> Offsets, Dictionary<string, int> RunLengths, int Total)
        BuildOffsets(
            string[] items,
            Dictionary<string, int> statedRunLengths,
            int defaultRunLength)
    {
        Dictionary<string, int> offsets = new(items.Length, StringComparer.Ordinal);
        Dictionary<string, int> runLengths = new(items.Length, StringComparer.Ordinal);
        int total = 0;
        foreach (string item in items)
        {
            string key = item.ToLowerInvariant();
            int length = statedRunLengths.TryGetValue(key, out int stated) ? stated : defaultRunLength;
            runLengths[key] = length;
            offsets[key] = total;
            total += length;
        }

        return (offsets, runLengths, total);
    }

    /// <summary>Puts the two infix tables into one lookup.</summary>
    private static Dictionary<string, int> Merge(
        Dictionary<string, int> first,
        Dictionary<string, int> second)
    {
        Dictionary<string, int> merged = new(first.Count + second.Count, StringComparer.Ordinal);
        foreach (KeyValuePair<string, int> entry in first) merged[entry.Key] = entry.Value;
        foreach (KeyValuePair<string, int> entry in second) merged[entry.Key] = entry.Value;
        return merged;
    }

    /// <summary>Collects every word part and tags it with the roles it plays.</summary>
    private static SectorFragment[] BuildFragments()
    {
        Dictionary<string, Roles> roles = new(StringComparer.Ordinal);

        Roles Get(string value)
        {
            string key = value.ToLowerInvariant();
            if (!roles.TryGetValue(key, out Roles? found))
            {
                found = new Roles(key);
                roles.Add(key, found);
            }

            return found;
        }

        foreach (string prefix in SectorFragments.Prefixes)
        {
            string key = prefix.ToLowerInvariant();
            Roles role = Get(prefix);
            role.IsPrefix = true;
            role.IsC1VowelPrefix = SectorFragments.C1PrefixInfix2.Contains(key);
            role.IsC2VowelPrefix = SectorFragments.C2PrefixSuffix2.Contains(key);
        }

        foreach (string infix in SectorFragments.Infixes1)
        {
            Roles role = Get(infix);
            role.IsInfix = true;
            role.IsVowelInfix = true;
        }

        foreach (string infix in SectorFragments.Infixes2)
        {
            Roles role = Get(infix);
            role.IsInfix = true;
            role.IsVowelInfix = false;
        }

        for (int index = 0; index < SectorFragments.Suffixes1.Length; index++)
        {
            Roles role = Get(SectorFragments.Suffixes1[index]);
            role.IsSuffix = true;
            role.IsVowelSuffix = true;
            role.SuffixIndex = index;
        }

        for (int index = 0; index < SectorFragments.Suffixes2.Length; index++)
        {
            Roles role = Get(SectorFragments.Suffixes2[index]);
            role.IsSuffix = true;
            role.IsVowelSuffix = false;
            role.SuffixIndex = index;
        }

        SectorFragment[] fragments = new SectorFragment[roles.Count];
        int next = 0;
        foreach (Roles role in roles.Values) fragments[next++] = role.ToFragment();

        Array.Sort(fragments, static (left, right) =>
        {
            int byLength = right.Value.Length.CompareTo(left.Value.Length);
            return byLength != 0 ? byLength : string.CompareOrdinal(left.Value, right.Value);
        });

        return fragments;
    }

    /// <summary>The roles one word part collects while the table is read.</summary>
    private sealed class Roles(string value)
    {
        public bool IsPrefix { get; set; }

        public bool IsC1VowelPrefix { get; set; }

        public bool IsC2VowelPrefix { get; set; }

        public bool IsInfix { get; set; }

        public bool IsVowelInfix { get; set; }

        public bool IsSuffix { get; set; }

        public bool IsVowelSuffix { get; set; }

        public int SuffixIndex { get; set; }

        public SectorFragment ToFragment() => new(
            value,
            IsPrefix,
            IsC1VowelPrefix,
            IsC2VowelPrefix,
            IsInfix,
            IsVowelInfix,
            IsSuffix,
            IsVowelSuffix,
            SuffixIndex);
    }
}
