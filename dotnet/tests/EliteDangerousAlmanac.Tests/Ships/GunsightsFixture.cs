using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/gunsights.jsonc</c>.</summary>
internal sealed class GunsightsFixture
{
    /// <summary>The hulls the catalogue carries a gunsight for.</summary>
    public int ShipCount { get; set; }

    /// <summary>The hardpoints those gunsights cover between them.</summary>
    public int HardpointCount { get; set; }

    /// <summary>Each hull whose offsets and projected points are pinned.</summary>
    public List<GunsightCaseFixture> Cases { get; set; } = [];
}

/// <summary>One hull's offsets and the points they project to at one range.</summary>
internal sealed class GunsightCaseFixture
{
    public string Ship { get; set; } = string.Empty;

    public double RangeMetres { get; set; }

    /// <summary>The journal slot keys, in hardpoint order, where the case states them.</summary>
    public List<string> Slots { get; set; } = [];

    /// <summary>Each hardpoint's horizontal and vertical offset, in metres.</summary>
    public List<List<double>> Offsets { get; set; } = [];

    /// <summary>Each hardpoint's horizontal and vertical angular tangent at the range.</summary>
    public List<List<double>> Points { get; set; } = [];
}
