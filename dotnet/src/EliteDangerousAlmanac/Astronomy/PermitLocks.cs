using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>Why a system asks for a permit.</summary>
public enum PermitLockKind
{
    /// <summary>The system itself is on the list.</summary>
    System,

    /// <summary>The system lies inside a region that is on the list.</summary>
    Region,
}

/// <summary>One system that asks for a permit of its own.</summary>
/// <param name="Name">The system name as the game writes it, such as <c>Shinrarta Dezhra</c>.</param>
/// <param name="Id64">The system's own 64-bit address.</param>
/// <remarks>
/// Most of these systems carry a name the game wrote by hand, so no calculation reaches
/// their address. It is recorded from Spansh and EDSM instead.
/// </remarks>
public sealed record PermitLockedSystem(string Name, ulong Id64);

/// <summary>The permit one system asks for.</summary>
/// <param name="Kind">Whether the system or its region carries the lock.</param>
/// <param name="Name">The system or the region the lock names.</param>
/// <param name="Id64">
/// The system's address, where the system itself carries the lock. A region is not a
/// system, so a region lock states none.
/// </param>
public sealed record PermitLock(PermitLockKind Kind, string Name, ulong? Id64 = null);

/// <summary>Which systems and regions ask a commander for a permit.</summary>
/// <remarks>
/// <para>
/// No game data file, journal event or API states a permit lock. Even Sol, locked since
/// the game opened, reports no permit of any kind. The list is therefore kept by hand, and
/// it has two halves. <see cref="LockedSystems"/> holds the systems that carry a lock of
/// their own. <see cref="LockedRegions"/> holds the regions whose permit covers every
/// system inside them, which are read from the start of a name because the game names
/// every system in a region after it.
/// </para>
/// <para>
/// Reading a region from a position is exact, and reading it from the start of a name is
/// the best a name alone allows. Where a position is at hand, take
/// <see cref="HandAuthoredRegions.FindAt"/> and then
/// <see cref="IsLockedRegionName"/>.
/// </para>
/// <para>
/// The list covers systems alone. A body that asks for a permit inside a system that does
/// not, such as Lave 2, is left out, because a system-wide answer would be wrong for it.
/// </para>
/// <para>
/// The list comes from the community permit database. See <c>ATTRIBUTIONS.md</c> for
/// credit and licence terms.
/// </para>
/// </remarks>
public static class PermitLocks
{
    private static readonly Lazy<IReadOnlyList<PermitLockedSystem>> Systems = new(BuildSystems);

    private static readonly Lazy<IReadOnlyList<string>> Regions = new(
        () => SharedData.LoadList<string>("data/astro/permit-locked-regions.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, PermitLockedSystem>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(LockedSystems, system => system.Name));

    private static readonly Lazy<IReadOnlyDictionary<ulong, PermitLockedSystem>> ByAddress = new(
        BuildAddressIndex);

    /// <summary>Every system that asks for a permit of its own, by name.</summary>
    public static IReadOnlyList<PermitLockedSystem> LockedSystems => Systems.Value;

    /// <summary>Every region whose permit covers the systems inside it, by name.</summary>
    /// <remarks>
    /// Each name is both a region the game names by hand and the opening of the names of
    /// the systems inside it.
    /// </remarks>
    public static IReadOnlyList<string> LockedRegions => Regions.Value;

    /// <summary>Finds a system that asks for a permit of its own, by its exact name.</summary>
    /// <param name="name">The system name, in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The record, or <see langword="null"/> where the system carries no lock of its own.
    /// A region is not read here.
    /// </returns>
    public static PermitLockedSystem? FindSystemByName(string? name) =>
        RegistryIndex.FindInKeyIndex(ByName.Value, name);

    /// <summary>Finds a system that asks for a permit of its own, by its address.</summary>
    /// <param name="id64">The system address, as a journal event reports it.</param>
    /// <returns>
    /// The record, or <see langword="null"/> where the address carries no lock of its own.
    /// </returns>
    public static PermitLockedSystem? FindSystemByAddress(ulong id64) =>
        ByAddress.Value.TryGetValue(id64, out PermitLockedSystem? system) ? system : null;

    /// <summary>Reads whether one region asks for a permit, by its exact name.</summary>
    /// <param name="name">The region name, in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// <see langword="true"/> where that exact region asks for one. A system name inside
    /// the region is not the region's name.
    /// </returns>
    public static bool IsLockedRegionName(string? name)
    {
        string? key = RegistryIndex.NormalizeKey(name);
        if (string.IsNullOrEmpty(key)) return false;
        foreach (string region in LockedRegions)
        {
            if (string.Equals(region, key, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    /// <summary>Reads the region whose permit covers one system name.</summary>
    /// <param name="systemName">The system name, in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The region name as the catalogue writes it, or <see langword="null"/> where no
    /// locked region opens the name.
    /// </returns>
    public static string? RegionForSystemName(string? systemName)
    {
        string? key = RegistryIndex.NormalizeKey(systemName);
        if (string.IsNullOrEmpty(key)) return null;

        foreach (string region in LockedRegions)
        {
            if (string.Equals(region, key, StringComparison.OrdinalIgnoreCase)) return region;
            if (key!.Length > region.Length &&
                key[region.Length] == ' ' &&
                key.StartsWith(region, StringComparison.OrdinalIgnoreCase))
            {
                return region;
            }
        }

        return null;
    }

    /// <summary>Reads the permit one system name asks for.</summary>
    /// <param name="name">The system name, in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The lock and what carries it, or <see langword="null"/> where the system is open.
    /// </returns>
    /// <remarks>
    /// The systems are read first, so a system that carries a lock of its own and also sits
    /// inside a locked region answers with its own.
    /// </remarks>
    public static PermitLock? ForSystemName(string? name)
    {
        PermitLockedSystem? system = FindSystemByName(name);
        if (system is not null)
        {
            return new PermitLock(PermitLockKind.System, system.Name, system.Id64);
        }

        string? region = RegionForSystemName(name);
        return region is null ? null : new PermitLock(PermitLockKind.Region, region);
    }

    /// <summary>Reads whether one system name asks for a permit at all.</summary>
    /// <param name="name">The system name, in any casing, with any surrounding whitespace.</param>
    /// <returns><see langword="true"/> where the system or its region asks for one.</returns>
    /// <remarks>
    /// Take <see cref="ForSystemName"/> instead where the commander is to be told which
    /// permit they want.
    /// </remarks>
    public static bool IsLocked(string? name) => ForSystemName(name) is not null;

    /// <summary>Reads the locked systems, whose addresses the file states as text.</summary>
    private static ReadOnlyCollection<PermitLockedSystem> BuildSystems()
    {
        IReadOnlyList<PermitLockedSystemRecord> records =
            SharedData.LoadList<PermitLockedSystemRecord>("data/astro/permit-locked-systems.jsonc");
        List<PermitLockedSystem> systems = new(records.Count);
        foreach (PermitLockedSystemRecord record in records)
        {
            systems.Add(new PermitLockedSystem(record.Name, SystemAddress.Parse(record.Id64)));
        }

        return new ReadOnlyCollection<PermitLockedSystem>(systems);
    }

    /// <summary>Indexes the locked systems by address.</summary>
    private static ReadOnlyDictionary<ulong, PermitLockedSystem> BuildAddressIndex()
    {
        Dictionary<ulong, PermitLockedSystem> index = new(LockedSystems.Count);
        foreach (PermitLockedSystem system in LockedSystems)
        {
            if (index.ContainsKey(system.Id64)) continue;
            index.Add(system.Id64, system);
        }

        return new ReadOnlyDictionary<ulong, PermitLockedSystem>(index);
    }

    /// <summary>One locked system as its shared file states it.</summary>
    /// <remarks>The address is text, because it reaches past what a whole number in JSON holds.</remarks>
    private sealed record PermitLockedSystemRecord(string Name, string Id64);
}
