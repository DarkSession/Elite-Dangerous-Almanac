using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Commodities.Internal;

/// <summary>The on-disk commodity shape, before its catalogue-derived rare flag is added.</summary>
internal sealed class CommodityRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;
}

/// <summary>Builds one commodity registry from its shared data file.</summary>
internal static class CommodityCatalogueBuilder
{
    /// <summary>Reads a registry file and stamps every record with its rare flag.</summary>
    internal static ReadOnlyCollection<Commodity> Build(string path, bool rare)
    {
        IReadOnlyList<CommodityRecord> records = SharedData.LoadList<CommodityRecord>(path);
        List<Commodity> commodities = new(records.Count);
        foreach (CommodityRecord record in records)
        {
            if (!CommodityCategories.TryParse(record.Category, out CommodityCategory category))
            {
                throw new InvalidOperationException(string.Format(
                    CultureInfo.InvariantCulture,
                    "The shared file '{0}' names an unknown market group '{1}'.",
                    path,
                    record.Category));
            }

            commodities.Add(new Commodity(record.Symbol, record.Name, category, rare));
        }

        return new ReadOnlyCollection<Commodity>(commodities);
    }
}
