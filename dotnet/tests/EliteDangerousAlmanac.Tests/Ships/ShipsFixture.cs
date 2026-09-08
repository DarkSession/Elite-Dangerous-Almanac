using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/ships.jsonc</c>.</summary>
internal sealed class ShipsFixture
{
    public int Count { get; set; }

    public List<ShipFixtureRecord> Records { get; set; } = [];

    /// <summary>Hulls whose display name differs from Frontier's shipyard registry.</summary>
    public List<ShipFixtureRecord> DisplayNameCorrections { get; set; } = [];

    public List<ShipLookupFixture> Lookups { get; set; } = [];
}

/// <summary>One pinned hull identity.</summary>
internal sealed class ShipFixtureRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Manufacturer { get; set; }

    public string? Size { get; set; }

    public string? Entitlement { get; set; }
}

/// <summary>One pinned lookup and the hull it has to resolve.</summary>
internal sealed class ShipLookupFixture
{
    public string Query { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public string? Name { get; set; }

    public string? Symbol { get; set; }
}

/// <summary>The shape of <c>fixtures/ships/ship-slots.jsonc</c>.</summary>
internal sealed class ShipSlotsFixture
{
    public int Count { get; set; }

    /// <summary>How many hulls carry a planetary-approach-suite mount.</summary>
    public int PlanetaryApproachSuiteCount { get; set; }

    /// <summary>Whole layouts this port has to reproduce mount for mount.</summary>
    public List<ShipSlotLayoutFixture> Spot { get; set; } = [];

    /// <summary>The slot keys a hull's layout expands into, in order.</summary>
    public Dictionary<string, List<string>> Keys { get; set; } = [];

    /// <summary>Which modules a restricted mount accepts and which it refuses.</summary>
    public List<SlotRestrictionFixture> Restrictions { get; set; } = [];
}

/// <summary>One pinned hull layout.</summary>
internal sealed class ShipSlotLayoutFixture
{
    public string Symbol { get; set; } = string.Empty;

    public Dictionary<string, int> Core { get; set; } = [];

    public List<SlotSpecFixture> Hardpoints { get; set; } = [];

    public int Utility { get; set; }

    public List<SlotSpecFixture> Optional { get; set; } = [];
}

/// <summary>One pinned mount in a hull layout.</summary>
internal sealed class SlotSpecFixture
{
    public int Size { get; set; }

    public string? Restriction { get; set; }

    public string? Name { get; set; }
}

/// <summary>One pinned restricted mount and the modules it takes.</summary>
internal sealed class SlotRestrictionFixture
{
    public string Ship { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string? Restriction { get; set; }

    public List<string> Accepts { get; set; } = [];

    public List<string> Rejects { get; set; } = [];
}
