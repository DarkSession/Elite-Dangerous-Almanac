using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Equipment.Internal;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>The suit-tool catalogue and the lookup that searches it.</summary>
/// <remarks>
/// The catalogue loads from its shared data file on first use. Every record is immutable,
/// so one caller cannot change another caller's answers.
/// </remarks>
public static class PersonalToolCatalogue
{
    private static readonly Lazy<IReadOnlyList<PersonalTool>> Tools = new(Build);

    private static readonly Lazy<IReadOnlyDictionary<string, PersonalTool>> ById = new(
        () => RegistryIndex.CreateKeyIndex(All, tool => tool.Id));

    /// <summary>Every suit tool.</summary>
    public static IReadOnlyList<PersonalTool> All => Tools.Value;

    /// <summary>Finds a tool by its library identifier.</summary>
    /// <param name="id">The identifier, such as <c>energylink</c>.</param>
    /// <returns>The tool, or <see langword="null"/> for an identifier no tool carries.</returns>
    /// <remarks>Case and surrounding whitespace are ignored. An absent identifier is a miss.</remarks>
    public static PersonalTool? FindById(string? id) =>
        RegistryIndex.FindInKeyIndex(ById.Value, id);

    private static ReadOnlyCollection<PersonalTool> Build()
    {
        IReadOnlyList<PersonalToolRecord> records =
            SharedData.LoadList<PersonalToolRecord>("data/equipment/tools.jsonc");
        List<PersonalTool> tools = new(records.Count);
        foreach (PersonalToolRecord record in records)
        {
            tools.Add(new PersonalTool(
                record.Id,
                record.Name,
                ReadOnlyLists.Freeze(record.SuitFamilies),
                record.RechargeRate,
                record.DischargeRate,
                record.DischargeDuration,
                record.OverloadPowerUsage,
                record.PowerUsage,
                record.ScanDuration,
                record.CloneDuration));
        }

        return new ReadOnlyCollection<PersonalTool>(tools);
    }
}
