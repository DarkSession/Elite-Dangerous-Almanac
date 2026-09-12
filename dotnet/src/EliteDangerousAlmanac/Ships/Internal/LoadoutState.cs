using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The state-boundary rules a build's own store keeps.</summary>
internal static class LoadoutState
{
    /// <summary>
    /// The catalogued cargo hatch every hull's mount resolves to.
    /// </summary>
    /// <remarks>
    /// A hull-specific hatch symbol is not catalogued separately, so this one record carries
    /// the article's stats for all of them.
    /// </remarks>
    internal const string BuiltInHullSymbol = "ModularCargoBayDoor";

    private static readonly Regex NonOutfittingKey = new(
        @"^(paintjob|shipname\d+|shipid\d+|bobble\d+|decal\d+|shipkit.+|weaponcolour|enginecolour|vesselvoice|shipcockpit|stringlights)$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Whether a journal key names a known cosmetic or hull-geometry entry.</summary>
    internal static bool IsNonOutfittingSlot(string slotKey) => NonOutfittingKey.IsMatch(slotKey);

    /// <summary>Whether a journal key names the cargo-hatch mount.</summary>
    internal static bool IsCargoHatchSlot(string slotKey) =>
        string.Equals(slotKey, "CargoHatch", StringComparison.OrdinalIgnoreCase);

    /// <summary>Whether a symbol names the cargo hatch built into every hull.</summary>
    /// <remarks>
    /// This tests a prefix rather than the whole symbol, because some hull families name their
    /// own hatch — the Fer-de-Lance family's <c>ModularCargoBayDoorFDL</c> — for the one
    /// article the catalogue carries. It is the article's identity, so the fit rules and the
    /// import path read the same answer from it.
    /// </remarks>
    internal static bool IsBuiltInHullSymbol(string symbol) =>
        symbol.StartsWith(BuiltInHullSymbol, StringComparison.OrdinalIgnoreCase);

    /// <summary>Whether a fitted module is the weightless, free hatch every hull carries.</summary>
    internal static bool IsBuiltInHullModule(LoadoutModule module) =>
        IsCargoHatchSlot(module.Slot) && IsBuiltInHullSymbol(module.Item);

    /// <summary>
    /// The key a build actually holds for a mount, or <see langword="null"/> when it holds none.
    /// </summary>
    /// <remarks>
    /// A build's own spelling is authoritative and is never rewritten. Frontier writes
    /// <c>FrameShiftDrive</c> where a SLEF producer may write <c>frameshiftdrive</c>, and both
    /// name the same mount, so every read and every edit resolves a caller's key through here
    /// first. There is never a tie to break, because a build cannot hold two keys that differ
    /// only in case.
    /// </remarks>
    internal static string? MatchingKey(IReadOnlyList<LoadoutModule> fitted, string slotKey)
    {
        int index = IndexOf(fitted, slotKey);
        return index < 0 ? null : fitted[index].Slot;
    }

    /// <summary>
    /// The build's existing spelling for a mount, or its own casing convention for a new one.
    /// </summary>
    /// <remarks>
    /// A build read from an export that lower-cases every key keeps doing so when an edit fills
    /// an empty mount, so one build never mixes two conventions.
    /// </remarks>
    internal static string OwnKey(IReadOnlyList<LoadoutModule> fitted, string canonicalKey)
    {
        string? held = MatchingKey(fitted, canonicalKey);
        if (held is not null) return held;
        if (fitted.Count == 0) return canonicalKey;

        foreach (LoadoutModule module in fitted)
        {
            if (!IsLowerCase(module.Slot)) return canonicalKey;
        }

        return canonicalKey.ToLowerInvariant();
    }

    private static bool IsLowerCase(string key)
    {
        foreach (char letter in key)
        {
            if (char.IsUpper(letter)) return false;
        }

        return true;
    }

    /// <summary>The index of one mount in a build's store, or -1 when it holds none.</summary>
    internal static int IndexOf(IReadOnlyList<LoadoutModule> fitted, string slotKey)
    {
        for (int index = 0; index < fitted.Count; index++)
        {
            if (string.Equals(fitted[index].Slot, slotKey, StringComparison.OrdinalIgnoreCase)) return index;
        }

        return -1;
    }

    /// <summary>
    /// Puts values in the hull's own mount order, keeping the source order of anything the
    /// layout does not name.
    /// </summary>
    internal static List<T> OrderByLayout<T>(
        IReadOnlyList<T> values,
        IReadOnlyList<BuildSlot> layout,
        Func<T, string> slotOf)
    {
        Dictionary<string, int> order = new(layout.Count, StringComparer.OrdinalIgnoreCase);
        for (int index = 0; index < layout.Count; index++) order[layout[index].Key] = index;

        return values.OrderBy(value =>
            order.TryGetValue(slotOf(value), out int rank) ? rank : int.MaxValue).ToList();
    }
}
