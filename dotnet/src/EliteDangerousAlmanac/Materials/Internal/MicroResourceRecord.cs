using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Materials.Internal;

/// <summary>The on-disk micro-resource shape, before its file-derived category is added.</summary>
internal sealed class MicroResourceRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}

/// <summary>Builds one category of the micro-resource catalogue from its data file.</summary>
internal static class MicroResourceCatalogueBuilder
{
    /// <summary>Reads a catalogue file and stamps every record with its category.</summary>
    internal static ReadOnlyCollection<MicroResource> Build(string path, MicroResourceCategory category)
    {
        IReadOnlyList<MicroResourceRecord> records = SharedData.LoadList<MicroResourceRecord>(path);
        List<MicroResource> resources = new(records.Count);
        foreach (MicroResourceRecord record in records)
        {
            resources.Add(new MicroResource(record.Symbol, category, record.Name));
        }

        return new ReadOnlyCollection<MicroResource>(resources);
    }
}
