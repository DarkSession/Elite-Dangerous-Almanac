using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/heat.jsonc</c>.</summary>
internal sealed class HeatFixture
{
    /// <summary>The heat level the gauge shows as full.</summary>
    public double OverheatHeatLevel { get; set; }

    /// <summary>What a drained weapons capacitor multiplies a weapon's thermal load by.</summary>
    public double DrainedCapacitorMultiplier { get; set; }

    /// <summary>The level each stated load settles at.</summary>
    public List<EquilibriumCaseFixture> Equilibrium { get; set; } = [];

    /// <summary>What the weapons capacitor's state makes of each stated weapon.</summary>
    public List<WeaponThermalLoadCaseFixture> WeaponThermalLoad { get; set; } = [];

    /// <summary>Heat on the way to where it settles.</summary>
    public List<TransientCaseFixture> Transient { get; set; } = [];

    /// <summary>The hulls whose dissipation the catalogue is pinned on.</summary>
    public Dictionary<string, HullHeatFixture> Hulls { get; set; } = [];
}

/// <summary>One load and the heat level it settles at.</summary>
internal sealed class EquilibriumCaseFixture
{
    public double Dissipation { get; set; }

    public double ThermalLoad { get; set; }

    /// <summary>The settled level, or absent where the load settles nowhere.</summary>
    public double? HeatLevel { get; set; }
}

/// <summary>One weapon and the load a capacitor state leaves it generating.</summary>
internal sealed class WeaponThermalLoadCaseFixture
{
    public double ThermalLoad { get; set; }

    public double DistributorDraw { get; set; }

    public double WeaponsCapacity { get; set; }

    public double CapacitorLevel { get; set; }

    public double Effective { get; set; }
}

/// <summary>One transient case: a level after a time, or the time to a level.</summary>
internal sealed class TransientCaseFixture
{
    public double HeatCapacity { get; set; }

    public double HeatDissipation { get; set; }

    public double ThermalLoad { get; set; }

    public double StartLevel { get; set; }

    /// <summary>The level asked about. A case that states one is a time case.</summary>
    public double? TargetLevel { get; set; }

    /// <summary>The seconds: the time held for a level case, and the answer for a time case.</summary>
    public double? Seconds { get; set; }

    /// <summary>The level reached, on a level case.</summary>
    public double? HeatLevel { get; set; }
}

/// <summary>One hull's measured heat dissipation.</summary>
internal sealed class HullHeatFixture
{
    public string Symbol { get; set; } = string.Empty;

    public double HeatDissipation { get; set; }
}
