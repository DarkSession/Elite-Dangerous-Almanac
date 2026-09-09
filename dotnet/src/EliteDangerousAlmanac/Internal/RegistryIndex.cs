using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace EliteDangerousAlmanac.Internal;

/// <summary>
/// Case-insensitive catalogue lookup helpers.
/// </summary>
/// <remarks>
/// <para>
/// Every catalogue key — a Frontier symbol, a display name, a chemical element symbol —
/// is compared with leading and trailing whitespace removed and case folded, because a
/// player journal reports the same symbol in a different case from the catalogue.
/// </para>
/// <para>
/// A <see langword="null"/> key is a miss, not a failure. That is what a lookup answers
/// for any key no record carries, and what an optional field an import did not carry has
/// to keep meaning.
/// </para>
/// </remarks>
internal static class RegistryIndex
{
    /// <summary>The comparer every catalogue key uses once it is trimmed.</summary>
    internal static readonly StringComparer KeyComparer = StringComparer.OrdinalIgnoreCase;

    /// <summary>Trims a key, or answers <see langword="null"/> for an absent one.</summary>
    internal static string? NormalizeKey(string? value) => value?.Trim();

    /// <summary>
    /// Builds a first-record-by-key index over a fixed built-in catalogue.
    /// </summary>
    /// <remarks>
    /// Records with no value for the key are skipped, and a duplicate key keeps the first
    /// record — the answer a linear scan gives.
    /// </remarks>
    internal static IReadOnlyDictionary<string, T> CreateKeyIndex<T>(
        IReadOnlyList<T> catalogue,
        Func<T, string?> key)
    {
        Dictionary<string, T> index = new(catalogue.Count, KeyComparer);
        foreach (T record in catalogue)
        {
            string? raw = NormalizeKey(key(record));
            if (raw is null || raw.Length == 0 || index.ContainsKey(raw)) continue;
            index.Add(raw, record);
        }

        return new ReadOnlyDictionary<string, T>(index);
    }

    /// <summary>Freezes a catalogue that a data file already keys, for case-insensitive lookups.</summary>
    /// <typeparam name="T">The record shape one value has.</typeparam>
    /// <param name="raw">The catalogue as the file states it.</param>
    /// <returns>A read-only map that answers whatever case a caller writes.</returns>
    internal static ReadOnlyDictionary<string, T> FreezeByRawKey<T>(IReadOnlyDictionary<string, T> raw)
    {
        Dictionary<string, T> index = new(raw.Count, KeyComparer);
        foreach (KeyValuePair<string, T> entry in raw) index[entry.Key] = entry.Value;
        return new ReadOnlyDictionary<string, T>(index);
    }

    /// <summary>Looks a key up in an index built by <see cref="CreateKeyIndex"/>.</summary>
    /// <returns>The record, or <see langword="null"/> for a key no record carries.</returns>
    internal static T? FindInKeyIndex<T>(IReadOnlyDictionary<string, T> index, string? wanted)
        where T : class
    {
        string? key = NormalizeKey(wanted);
        if (key is null || key.Length == 0) return null;
        return index.TryGetValue(key, out T? record) ? record : null;
    }

    /// <summary>Finds the first record whose key matches, by scanning the catalogue.</summary>
    /// <returns>The record, or <see langword="null"/> for a key no record carries.</returns>
    internal static T? FindByKey<T>(IEnumerable<T> catalogue, Func<T, string?> key, string? wanted)
        where T : class
    {
        string? normalized = NormalizeKey(wanted);
        if (normalized is null || normalized.Length == 0) return null;
        foreach (T record in catalogue)
        {
            if (Matches(key(record), normalized)) return record;
        }

        return null;
    }

    /// <summary>Finds every record whose key matches, by scanning the catalogue.</summary>
    /// <returns>A read-only list of matches, in catalogue order.</returns>
    internal static IReadOnlyList<T> FilterByKey<T>(
        IEnumerable<T> catalogue,
        Func<T, string?> key,
        string? wanted)
    {
        List<T> matches = [];
        string? normalized = NormalizeKey(wanted);
        if (normalized is null || normalized.Length == 0) return new ReadOnlyCollection<T>(matches);
        foreach (T record in catalogue)
        {
            if (Matches(key(record), normalized)) matches.Add(record);
        }

        return new ReadOnlyCollection<T>(matches);
    }

    /// <summary>Answers whether a record's raw key equals an already normalized one.</summary>
    internal static bool Matches(string? raw, string normalized)
    {
        string? candidate = NormalizeKey(raw);
        return candidate is not null && KeyComparer.Equals(candidate, normalized);
    }
}
