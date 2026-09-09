using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/engineering-options.jsonc</c>.</summary>
internal sealed class EngineeringOptionsFixture
{
    /// <summary>The catalogue measured against the shared build corpus.</summary>
    public CorpusOptionsFixture Corpus { get; set; } = new();

    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>How many modules each group holds.</summary>
    public Dictionary<string, int> GroupSizes { get; set; } = [];

    public List<OptionGroupFixture> Groups { get; set; } = [];

    public List<GroupedModuleFixture> Modules { get; set; } = [];

    /// <summary>Modules that no registry gives an ordinary engineering menu.</summary>
    public List<string> NotEngineerable { get; set; } = [];

    /// <summary>Families whose ordinary and Guardian halves are separate menus.</summary>
    public List<SplitFamilyFixture> SplitFamilies { get; set; } = [];

    /// <summary>Modules short of an effect their group otherwise offers.</summary>
    public List<ExclusionFixture> Exclusions { get; set; } = [];

    /// <summary>One blueprint's effects across every group that accepts it.</summary>
    public OptionGroupFixture BlueprintUnion { get; set; } = new();

    /// <summary>The recipe that is a whole menu on its own.</summary>
    public AntiGuardianFixture AntiGuardianZoneResistance { get; set; } = new();
}

/// <summary>One group's menu.</summary>
internal sealed class OptionGroupFixture
{
    public string Id { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public string Group { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public List<string> Blueprints { get; set; } = [];

    public List<string> Experimentals { get; set; } = [];
}

/// <summary>One module and the group it is engineered as.</summary>
internal sealed class GroupedModuleFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Group { get; set; } = string.Empty;
}

/// <summary>A family whose Guardian half takes a different menu from its ordinary half.</summary>
internal sealed class SplitFamilyFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Description { get; set; }

    public OptionGroupFixture Ordinary { get; set; } = new();

    public OptionGroupFixture Guardian { get; set; } = new();
}

/// <summary>One module and the effects its group offers that it cannot take.</summary>
internal sealed class ExclusionFixture
{
    public string Symbol { get; set; } = string.Empty;

    public List<string> Excluded { get; set; } = [];
}

/// <summary>Anti-Guardian Zone Resistance: the groups and modules it is the whole menu of.</summary>
internal sealed class AntiGuardianFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Description { get; set; }

    public string Blueprint { get; set; } = string.Empty;

    public List<string> Experimentals { get; set; } = [];

    public List<string> Groups { get; set; } = [];

    public List<string> Modules { get; set; } = [];
}

/// <summary>The engineering catalogue measured against the shared build corpus.</summary>
/// <remarks>
/// The corpus is what real build tools wrote, so a declaration this library refuses is
/// this library disagreeing with the game. The blocks below name the declarations that are
/// meant to be refused, and how many of each there are.
/// </remarks>
internal sealed class CorpusOptionsFixture
{
    /// <summary>What the figures mean, in the fixture's own words.</summary>
    public string? Description { get; set; }

    /// <summary>The engineering entries the corpus records across every build.</summary>
    public int DeclaredEngineering { get; set; }

    /// <summary>Declarations on modules this catalogue does not group.</summary>
    public int UngroupedEntries { get; set; }

    /// <summary>Declarations that name a family's generic spelling of a recipe.</summary>
    public int AliasSpellingsAccepted { get; set; }

    /// <summary>Declarations resolved through the journal-name collisions.</summary>
    public int JournalSpellingsAccepted { get; set; }

    /// <summary>Declarations that identify a fixed reward article rather than a recipe.</summary>
    public int FinalPreEngineeredEntries { get; set; }

    /// <summary>Each generic spelling and the family-specific ones the catalogue lists.</summary>
    public Dictionary<string, List<string>> BlueprintAliases { get; set; } = [];

    /// <summary>The fixed reward articles the corpus declares, and how often each appears.</summary>
    public List<CorpusEngineeringRowFixture> FinalPreEngineered { get; set; } = [];

    /// <summary>The declarations no article takes at all, and how often each appears.</summary>
    public List<CorpusEngineeringRowFixture> NotEngineerable { get; set; } = [];
}

/// <summary>One module and recipe the corpus declares, and how many builds declare it.</summary>
internal sealed class CorpusEngineeringRowFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    /// <summary>The effect the declaration names, where it names one.</summary>
    public string? Experimental { get; set; }

    public int Entries { get; set; }
}
