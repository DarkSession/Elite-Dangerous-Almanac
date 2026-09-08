using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/engineering-options.jsonc</c>.</summary>
internal sealed class EngineeringOptionsFixture
{
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
    public string Blueprint { get; set; } = string.Empty;

    public List<string> Experimentals { get; set; } = [];

    public List<string> Groups { get; set; } = [];

    public List<string> Modules { get; set; } = [];
}
