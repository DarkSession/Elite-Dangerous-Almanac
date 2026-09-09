using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Commodities;

/// <summary>A market group — the shelf a commodity sits on at the commodity market.</summary>
/// <remarks>
/// These are Frontier's own groups. Standard and rare commodities draw from the same set;
/// the rare registry uses a subset of it. <see cref="NonMarketable"/> is Frontier's group
/// for goods that are not freely traded, such as limpets.
/// </remarks>
public enum CommodityCategory
{
    /// <summary>Chemicals, such as water and explosives.</summary>
    Chemicals,

    /// <summary>Consumer items, such as clothing and consumer technology.</summary>
    ConsumerItems,

    /// <summary>Foods, from grain to animal meat.</summary>
    Foods,

    /// <summary>Industrial materials, such as polymers and semiconductors.</summary>
    IndustrialMaterials,

    /// <summary>Legal drugs, such as beer, wine and tobacco.</summary>
    LegalDrugs,

    /// <summary>Machinery, such as power generators and mineral extractors.</summary>
    Machinery,

    /// <summary>Medicines, such as basic medicines and performance enhancers.</summary>
    Medicines,

    /// <summary>Metals, such as gold and platinum.</summary>
    Metals,

    /// <summary>Minerals, such as painite and low-temperature diamonds.</summary>
    Minerals,

    /// <summary>Frontier's group for goods that are not freely traded, such as limpets.</summary>
    NonMarketable,

    /// <summary>Salvage, such as wreckage components and mission commodities.</summary>
    Salvage,

    /// <summary>Slavery, both legal imperial slaves and illegal slaves.</summary>
    Slavery,

    /// <summary>Technology, such as advanced catalysers and skimmer components.</summary>
    Technology,

    /// <summary>Textiles, such as leather and synthetic fabrics.</summary>
    Textiles,

    /// <summary>Waste, such as biowaste and scrap.</summary>
    Waste,

    /// <summary>Weapons, from non-lethal weapons to reactive armour.</summary>
    Weapons,
}

/// <summary>Reads and writes the in-game spelling of a <see cref="CommodityCategory"/>.</summary>
/// <remarks>
/// Three groups are two words in the game — consumer items, industrial materials and legal
/// drugs — so the member name and the in-game name differ. Use these members whenever a
/// group has to reach a user interface or arrive from a market payload.
/// </remarks>
public static class CommodityCategories
{
    private static readonly Dictionary<CommodityCategory, string> Names = new()
    {
        [CommodityCategory.Chemicals] = "Chemicals",
        [CommodityCategory.ConsumerItems] = "Consumer Items",
        [CommodityCategory.Foods] = "Foods",
        [CommodityCategory.IndustrialMaterials] = "Industrial Materials",
        [CommodityCategory.LegalDrugs] = "Legal Drugs",
        [CommodityCategory.Machinery] = "Machinery",
        [CommodityCategory.Medicines] = "Medicines",
        [CommodityCategory.Metals] = "Metals",
        [CommodityCategory.Minerals] = "Minerals",
        [CommodityCategory.NonMarketable] = "NonMarketable",
        [CommodityCategory.Salvage] = "Salvage",
        [CommodityCategory.Slavery] = "Slavery",
        [CommodityCategory.Technology] = "Technology",
        [CommodityCategory.Textiles] = "Textiles",
        [CommodityCategory.Waste] = "Waste",
        [CommodityCategory.Weapons] = "Weapons",
    };

    private static readonly Dictionary<string, CommodityCategory> Groups = BuildLookup();

    /// <summary>The in-game name of a group, such as <c>"Consumer Items"</c>.</summary>
    /// <param name="category">The group to name.</param>
    /// <returns>The in-game name.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="category"/> is not a member.</exception>
    public static string DisplayName(this CommodityCategory category) =>
        Names.TryGetValue(category, out string? name)
            ? name
            : throw new ArgumentOutOfRangeException(nameof(category), category, "Not a market group.");

    /// <summary>Reads a group from its in-game name or its member name.</summary>
    /// <remarks>Leading and trailing whitespace and case are ignored.</remarks>
    /// <param name="name">The group name, such as <c>Legal Drugs</c>.</param>
    /// <param name="category">The group the name denotes, when the answer is <see langword="true"/>.</param>
    /// <returns><see langword="true"/> when the name denotes a group.</returns>
    public static bool TryParse(string? name, out CommodityCategory category)
    {
        category = default;
        string? key = name?.Trim();
        if (string.IsNullOrEmpty(key)) return false;
        return Groups.TryGetValue(key!, out category);
    }

    private static Dictionary<string, CommodityCategory> BuildLookup()
    {
        Dictionary<string, CommodityCategory> lookup = new(StringComparer.OrdinalIgnoreCase);
        foreach (KeyValuePair<CommodityCategory, string> entry in Names)
        {
            lookup[entry.Value] = entry.Key;
            lookup[entry.Key.ToString()] = entry.Key;
        }

        return lookup;
    }
}
