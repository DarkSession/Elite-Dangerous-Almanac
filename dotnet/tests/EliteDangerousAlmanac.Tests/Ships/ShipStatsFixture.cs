using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/ship-stats.jsonc</c>.</summary>
internal sealed class ShipStatsFixture
{
    public int Count { get; set; }

    /// <summary>How many hulls carry a price.</summary>
    public int PricedCount { get; set; }

    public List<ShipStatFixture> Prices { get; set; } = [];

    /// <summary>Whole stat blocks this port has to reproduce field for field.</summary>
    public List<ShipStatFixture> Spot { get; set; } = [];

    /// <summary>Stats where a verified in-game reading won over the derived source.</summary>
    public List<ShipStatFixture> InGameCorrections { get; set; } = [];

    public HeatDissipationFixture HeatDissipation { get; set; } = new();

    public List<ShipStatFixture> SpeedEndpoints { get; set; } = [];

    public List<ShipStatFixture> RotationEndpoints { get; set; } = [];
}

/// <summary>The heat-dissipation figures the fixture pins.</summary>
internal sealed class HeatDissipationFixture
{
    public ShipStatFixture Minimum { get; set; } = new();

    public ShipStatFixture Maximum { get; set; } = new();

    public List<ShipStatFixture> Values { get; set; } = [];
}

/// <summary>
/// One hull's pinned stats: the symbol that names the hull, and whatever numeric fields the
/// fixture carries beside it.
/// </summary>
internal sealed class ShipStatFixture
{
    public string Symbol { get; set; } = string.Empty;

    /// <summary>The numeric fields, keyed as the fixture spells them.</summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement> Values { get; set; } = [];
}
