using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One mount's captured purchase price, exactly as the source stated it.</summary>
/// <param name="Slot">The mount key, in the source's own spelling.</param>
/// <param name="Item">The module symbol, in the source's own casing.</param>
/// <param name="Value">What the source says was paid for that module, in credits.</param>
public sealed record SourceModuleValue(string Slot, string Item, double Value);

/// <summary>The credit figures one captured loadout arrived with.</summary>
/// <param name="HullValue">
/// The hull cost in credits as the source stated it, or <see langword="null"/> when it stated
/// none.
/// </param>
/// <param name="ModulesValue">
/// The fitted modules' cost in credits as the source stated it, or <see langword="null"/> when
/// it stated none.
/// </param>
/// <param name="Rebuy">
/// The insurance rebuy in credits as the source stated it, or <see langword="null"/> when it
/// stated none.
/// </param>
/// <param name="ModuleValues">
/// The individually priced mounts, in capture order. An unpriced mount is absent.
/// </param>
/// <param name="ModuleCount">
/// Every module the capture listed, the ones it left unpriced included.
/// </param>
/// <remarks>
/// <para>
/// Every top-level figure can be absent, and absence means the source stated no value rather
/// than that the hull or the modules were free.
/// </para>
/// <para>
/// The record describes the capture and not the live fit, so it stays as it is when the build
/// it came with is edited. It is kept apart from the catalogue list prices a live build is
/// costed at, because a capture can combine station discounts, omit modules that were bought,
/// and disagree with its own totals.
/// </para>
/// </remarks>
public sealed record SourcePurchaseRecord(
    double? HullValue,
    double? ModulesValue,
    double? Rebuy,
    IReadOnlyList<SourceModuleValue> ModuleValues,
    int ModuleCount);

/// <summary>Reads the credit figures a captured loadout carries.</summary>
/// <remarks>
/// No discount is inferred. One capture can mix purchases from several stations, omit module
/// values, or state a total that differs from its priced parts. These queries keep those facts
/// visible instead of inventing one misleading percentage.
/// </remarks>
public static class SourcePurchase
{
    /// <summary>Reads the purchase figures off a journal <c>Loadout</c> event.</summary>
    /// <param name="loadout">The event to read. No object in it is kept by reference.</param>
    /// <returns>
    /// The record, or <see langword="null"/> when the source states no credit figure at all. A
    /// record of nothing but absent figures would read as a source that priced the build at
    /// nothing.
    /// </returns>
    /// <remarks>
    /// A malformed event that repeats an exactly spelled mount keeps the last entry.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="loadout"/> is <see langword="null"/>.</exception>
    public static SourcePurchaseRecord? FromLoadout(LoadoutEvent loadout)
    {
        if (loadout is null) throw new ArgumentNullException(nameof(loadout));

        // The capture's own order is the record's order, and a repeated mount replaces the
        // earlier entry where it already stands.
        List<SourceModuleValue> priced = [];
        Dictionary<string, int> positions = new(StringComparer.Ordinal);
        foreach (LoadoutModule module in loadout.Modules)
        {
            if (module.Value is not double value) continue;
            SourceModuleValue entry = new(module.Slot, module.Item, value);
            if (positions.TryGetValue(module.Slot, out int position))
            {
                priced[position] = entry;
                continue;
            }

            positions[module.Slot] = priced.Count;
            priced.Add(entry);
        }

        if (loadout.HullValue is null
            && loadout.ModulesValue is null
            && loadout.Rebuy is null
            && priced.Count == 0)
        {
            return null;
        }

        return new SourcePurchaseRecord(
            loadout.HullValue,
            loadout.ModulesValue,
            loadout.Rebuy,
            new ReadOnlyCollection<SourceModuleValue>(priced),
            loadout.Modules.Count);
    }

    /// <summary>Finds the captured purchase entry for one mount.</summary>
    /// <param name="record">The record to read.</param>
    /// <param name="slotKey">
    /// The mount key, such as <c>PowerPlant</c>. An exact spelling wins; otherwise the match
    /// folds case and ignores the surrounding whitespace, as every identifier lookup in this
    /// library does, so a journal key and a lower-cased SLEF key both resolve.
    /// </param>
    /// <returns>
    /// The entry, or <see langword="null"/> when the source priced no module in that mount. A
    /// miss never means the module was free.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="record"/> is <see langword="null"/>.</exception>
    public static SourceModuleValue? FindModuleValue(SourcePurchaseRecord record, string? slotKey)
    {
        if (record is null) throw new ArgumentNullException(nameof(record));

        string? wanted = RegistryIndex.NormalizeKey(slotKey);
        if (wanted is null) return null;

        foreach (SourceModuleValue entry in record.ModuleValues)
        {
            if (string.Equals(entry.Slot, slotKey, StringComparison.Ordinal)) return entry;
        }

        foreach (SourceModuleValue entry in record.ModuleValues)
        {
            if (RegistryIndex.KeyComparer.Equals(entry.Slot.Trim(), wanted)) return entry;
        }

        return null;
    }

    /// <summary>Adds up every per-mount price the source stated.</summary>
    /// <param name="record">The record whose individually priced entries to add.</param>
    /// <returns>The stated total in credits, or zero when no module was individually priced.</returns>
    /// <remarks>
    /// This does not replace <see cref="SourcePurchaseRecord.ModulesValue"/>. A capture may omit
    /// individual prices or state an inconsistent total, and comparing the two figures is
    /// useful precisely because this one hides no such disagreement.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="record"/> is <see langword="null"/>.</exception>
    public static double SumModuleValues(SourcePurchaseRecord record)
    {
        if (record is null) throw new ArgumentNullException(nameof(record));

        double sum = 0;
        foreach (SourceModuleValue entry in record.ModuleValues) sum += entry.Value;
        return sum;
    }
}
