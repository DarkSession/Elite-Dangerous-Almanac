using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/module-stats.jsonc</c>.</summary>
internal sealed class ModuleStatsFixture
{
    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>How many records in each catalogue carry a price.</summary>
    public Dictionary<string, int> PriceCounts { get; set; } = [];

    public List<ModuleStatSpot> Prices { get; set; } = [];

    /// <summary>Records that are sold and simply unpriced by every registry.</summary>
    public List<string> Unpriced { get; set; } = [];

    /// <summary>Whole stat blocks this port has to reproduce field for field.</summary>
    public List<ModuleStatSpot> Spot { get; set; } = [];

    /// <summary>Weapons whose damage is already per second.</summary>
    public List<string> ContinuousFire { get; set; } = [];

    public StatCountsFixture StatCounts { get; set; } = new();

    public SymbolSetFixture SupercruiseOvercharge { get; set; } = new();

    public SymbolSetFixture WithoutIntegrity { get; set; } = new();

    public CabinCapacityFixture CabinCapacity { get; set; } = new();

    public GrantOnlyFixture GrantOnly { get; set; } = new();

    public FreeModulesFixture FreeModules { get; set; } = new();

    /// <summary>Values a verified in-game reading fixed.</summary>
    public List<ModuleStatSpot> InGameVerifiedValues { get; set; } = [];

    /// <summary>Fields a verified in-game reading showed a module does not carry.</summary>
    public List<AbsentFieldsFixture> InGameVerifiedAbsentFields { get; set; } = [];
}

/// <summary>One module's pinned stats: its symbol and whatever fields the fixture carries.</summary>
internal sealed class ModuleStatSpot
{
    public string Symbol { get; set; } = string.Empty;

    [JsonExtensionData]
    public Dictionary<string, JsonElement> Fields { get; set; } = [];
}

/// <summary>How many records carry each base stat a blueprint recipe scales.</summary>
internal sealed class StatCountsFixture
{
    public Dictionary<string, int> Counts { get; set; } = [];
}

/// <summary>An exact set of symbols, and its size.</summary>
internal sealed class SymbolSetFixture
{
    public int Count { get; set; }

    public List<string> Symbols { get; set; } = [];
}

/// <summary>The passenger berths every cabin carries.</summary>
internal sealed class CabinCapacityFixture
{
    public int Count { get; set; }

    public List<ModuleStatSpot> Records { get; set; } = [];
}

/// <summary>Every record that arrives granted, with the article the game does sell.</summary>
internal sealed class GrantOnlyFixture
{
    public List<GrantOnlyModule> Modules { get; set; } = [];
}

/// <summary>One granted article and its sold twin.</summary>
internal sealed class GrantOnlyModule
{
    public string Symbol { get; set; } = string.Empty;

    public string SoldTwin { get; set; } = string.Empty;
}

/// <summary>Every non-armour module priced at zero.</summary>
internal sealed class FreeModulesFixture
{
    public List<string> Symbols { get; set; } = [];
}

/// <summary>Fields one module does not carry.</summary>
internal sealed class AbsentFieldsFixture
{
    public string Symbol { get; set; } = string.Empty;

    public List<string> Fields { get; set; } = [];
}
