using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The sparse numeric stats one outfitting module carries.</summary>
/// <remarks>
/// <para>
/// No module family uses every stat, so this holds only the ones a record states. Reading a
/// stat a module does not carry answers <see langword="null"/> rather than a default, which
/// is what tells a calculation the module is not of the kind it wants.
/// </para>
/// <para>
/// The collection is immutable. <see cref="With(ModuleStat, double)"/> answers a new
/// collection, which is how engineering builds a fitted module's effective stats without
/// changing the catalogue record behind it.
/// </para>
/// </remarks>
public sealed class ModuleStats : IEquatable<ModuleStats>
{
    /// <summary>A module that states no stats at all.</summary>
    public static readonly ModuleStats Empty = new([]);

    private readonly Dictionary<ModuleStat, double> values;

    private ModuleStats(Dictionary<ModuleStat, double> values) => this.values = values;

    /// <summary>How many stats this module states.</summary>
    public int Count => values.Count;

    /// <summary>Reads one stat.</summary>
    /// <param name="stat">The stat to read.</param>
    /// <returns>The value, or <see langword="null"/> when the module does not carry it.</returns>
    public double? this[ModuleStat stat] => values.TryGetValue(stat, out double value) ? value : null;

    /// <summary>Builds a collection from the stats a caller already holds.</summary>
    /// <param name="values">The stats to hold. An absent collection makes an empty one.</param>
    /// <returns>The collection.</returns>
    public static ModuleStats From(IEnumerable<KeyValuePair<ModuleStat, double>>? values)
    {
        if (values is null) return Empty;
        Dictionary<ModuleStat, double> copy = [];
        foreach (KeyValuePair<ModuleStat, double> entry in values) copy[entry.Key] = entry.Value;
        return copy.Count == 0 ? Empty : new ModuleStats(copy);
    }

    /// <summary>Whether the module states a stat.</summary>
    /// <param name="stat">The stat to look for.</param>
    /// <returns><see langword="true"/> when the module carries it.</returns>
    public bool Has(ModuleStat stat) => values.ContainsKey(stat);

    /// <summary>The same stats with one value set or replaced.</summary>
    /// <param name="stat">The stat to write.</param>
    /// <param name="value">The value it takes.</param>
    /// <returns>A new collection. This one is unchanged.</returns>
    public ModuleStats With(ModuleStat stat, double value)
    {
        Dictionary<ModuleStat, double> copy = new(values) { [stat] = value };
        return new ModuleStats(copy);
    }

    /// <summary>The same stats with one value removed.</summary>
    /// <param name="stat">The stat to drop.</param>
    /// <returns>A new collection, or this one when the stat was already absent.</returns>
    public ModuleStats Without(ModuleStat stat)
    {
        if (!values.ContainsKey(stat)) return this;
        Dictionary<ModuleStat, double> copy = new(values);
        copy.Remove(stat);
        return copy.Count == 0 ? Empty : new ModuleStats(copy);
    }

    /// <summary>The stats the module states, in no particular order.</summary>
    public IEnumerable<KeyValuePair<ModuleStat, double>> Entries => values;

    /// <summary>The stats the module states, by key.</summary>
    public IEnumerable<ModuleStat> Keys => values.Keys;

    /// <inheritdoc/>
    public bool Equals(ModuleStats? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        if (values.Count != other.values.Count) return false;
        foreach (KeyValuePair<ModuleStat, double> entry in values)
        {
            if (!other.values.TryGetValue(entry.Key, out double value)) return false;
            if (!value.Equals(entry.Value)) return false;
        }

        return true;
    }

    /// <inheritdoc/>
    public override bool Equals(object? obj) => Equals(obj as ModuleStats);

    /// <inheritdoc/>
    public override int GetHashCode()
    {
        // Exclusive-or, so the hash does not depend on the order the dictionary enumerates in.
        int hash = values.Count;
        foreach (KeyValuePair<ModuleStat, double> entry in values)
        {
            hash ^= HashCode.Combine(entry.Key, entry.Value);
        }

        return hash;
    }
}
