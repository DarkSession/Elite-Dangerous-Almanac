using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Materials.Internal;

/// <summary>The on-disk material shape, before its catalogue-derived category is added.</summary>
internal sealed class MaterialRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? ElementSymbol { get; set; }

    public int Grade { get; set; }

    public string Line { get; set; } = string.Empty;
}

/// <summary>Builds one category of the material catalogue from its shared data file.</summary>
internal static class MaterialCatalogueBuilder
{
    /// <summary>Reads a catalogue file and stamps every record with its category.</summary>
    /// <remarks>
    /// The fields are named one by one rather than copied wholesale, so a stray key in a
    /// data file cannot reach the public <see cref="Material"/> shape.
    /// </remarks>
    internal static IReadOnlyList<Material> Build(string path, MaterialCategory category)
    {
        IReadOnlyList<MaterialRecord> records = SharedData.LoadList<MaterialRecord>(path);
        List<Material> materials = new(records.Count);
        foreach (MaterialRecord record in records)
        {
            if (!MaterialLines.TryParse(record.Line, out MaterialLine line))
            {
                throw new InvalidOperationException(string.Format(
                    CultureInfo.InvariantCulture,
                    "The shared file '{0}' names an unknown material line '{1}'.",
                    path,
                    record.Line));
            }

            materials.Add(new Material(
                category,
                record.Symbol,
                record.Name,
                record.ElementSymbol,
                (MaterialGrade)record.Grade,
                line));
        }

        return new ReadOnlyCollection<Material>(materials);
    }
}
