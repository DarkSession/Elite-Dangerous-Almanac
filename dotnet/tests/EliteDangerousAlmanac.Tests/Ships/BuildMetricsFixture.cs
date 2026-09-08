using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/build-metrics.jsonc</c>.</summary>
internal sealed class BuildMetricsFixture
{
    /// <summary>The pure functions a build metric is composed from.</summary>
    public MetricFunctionsFixture Functions { get; set; } = new();
}

/// <summary>Each pure function, pinned at the arguments worth pinning.</summary>
internal sealed class MetricFunctionsFixture
{
    public List<ShieldResistanceCaseFixture> StackShieldResistance { get; set; } = [];

    public List<ArmourResistanceCaseFixture> StackArmourResistance { get; set; } = [];

    public List<SystemsResistanceCaseFixture> SystemsResistance { get; set; } = [];
}

/// <summary>One shield stack and the resistance it leaves.</summary>
internal sealed class ShieldResistanceCaseFixture
{
    public double Generator { get; set; }

    public List<double> Boosters { get; set; } = [];

    public double Expected { get; set; }
}

/// <summary>One hull stack and the resistance it leaves.</summary>
internal sealed class ArmourResistanceCaseFixture
{
    public double Bulkhead { get; set; }

    public List<double> Reinforcements { get; set; } = [];

    public double Expected { get; set; }
}

/// <summary>One capacitor allocation and the resistance it buys.</summary>
internal sealed class SystemsResistanceCaseFixture
{
    public double Pips { get; set; }

    public double Expected { get; set; }
}
