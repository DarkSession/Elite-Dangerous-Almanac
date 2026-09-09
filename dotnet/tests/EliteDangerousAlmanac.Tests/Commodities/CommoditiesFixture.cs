using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Commodities;

/// <summary>The shape of <c>fixtures/commodities/commodities.jsonc</c>.</summary>
internal sealed class CommoditiesFixture
{
    /// <summary>The size each registry has, keyed by registry name.</summary>
    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>Every market group a commodity may sit in.</summary>
    public List<string> Categories { get; set; } = [];

    /// <summary>Individual records this port has to reproduce field for field.</summary>
    public List<CommodityFixtureRecord> Records { get; set; } = [];

    /// <summary>The size of selected market groups, standard and rare together.</summary>
    public Dictionary<string, int> CategoryCounts { get; set; } = [];
}

/// <summary>One pinned commodity record.</summary>
internal sealed class CommodityFixtureRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public bool Rare { get; set; }
}
