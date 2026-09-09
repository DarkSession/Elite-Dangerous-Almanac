using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/modules.jsonc</c>.</summary>
internal sealed class ModulesFixture
{
    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>How many records in each catalogue carry a family.</summary>
    public Dictionary<string, int> FamilyCounts { get; set; } = [];

    /// <summary>How many distinct families each catalogue uses.</summary>
    public Dictionary<string, int> FamilyGroupCounts { get; set; } = [];

    public List<ModuleFamilyFixture> Families { get; set; } = [];

    /// <summary>How many records carry an exclusion group.</summary>
    public int ExclusionGroupCount { get; set; }

    /// <summary>How many records name each fixed mount, and how many name none.</summary>
    public Dictionary<string, int> SlotCounts { get; set; } = [];

    public List<ModuleFixtureRecord> Records { get; set; } = [];

    public ShipArmourFixture ShipArmour { get; set; } = new();
}

/// <summary>One pinned outfitting family.</summary>
internal sealed class ModuleFamilyFixture
{
    public string FamilyId { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public int Count { get; set; }

    /// <summary>Symbols the family has to hold.</summary>
    public List<string> Symbols { get; set; } = [];
}

/// <summary>One pinned module identity.</summary>
internal sealed class ModuleFixtureRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string? EngineeringGroup { get; set; }

    public string FamilyId { get; set; } = string.Empty;

    public string? Slot { get; set; }

    public string Name { get; set; } = string.Empty;

    public int Class { get; set; }

    public string Rating { get; set; } = string.Empty;

    public string? Mount { get; set; }

    public string? Guidance { get; set; }

    public string? Ship { get; set; }

    public string? Entitlement { get; set; }

    public List<string>? RestrictedToShips { get; set; }

    public string? RestrictedToSlot { get; set; }
}

/// <summary>The bulkheads one hull offers.</summary>
internal sealed class ShipArmourFixture
{
    public string Ship { get; set; } = string.Empty;

    public int Count { get; set; }

    public List<string> Names { get; set; } = [];
}
