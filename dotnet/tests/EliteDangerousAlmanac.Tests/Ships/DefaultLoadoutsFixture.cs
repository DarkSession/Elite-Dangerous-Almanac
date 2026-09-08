using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/default-loadouts.jsonc</c>.</summary>
internal sealed class DefaultLoadoutsFixture
{
    /// <summary>The hulls the catalogue carries a stock loadout for.</summary>
    public int ShipCount { get; set; }

    /// <summary>The modules those loadouts fit between them.</summary>
    public int ModuleCount { get; set; }

    /// <summary>Each hull whose stock fit is pinned in part.</summary>
    public List<DefaultLoadoutCaseFixture> Spot { get; set; } = [];
}

/// <summary>One hull's stated stock modules, and the mounts it leaves empty.</summary>
internal sealed class DefaultLoadoutCaseFixture
{
    public string Ship { get; set; } = string.Empty;

    /// <summary>Modules the stock fit carries, each in its own mount.</summary>
    public List<DefaultLoadoutModuleFixture> Modules { get; set; } = [];

    /// <summary>Mounts the stock fit leaves empty.</summary>
    public List<string> Empty { get; set; } = [];
}

/// <summary>One stock module and the mount it sits in.</summary>
internal sealed class DefaultLoadoutModuleFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;
}
