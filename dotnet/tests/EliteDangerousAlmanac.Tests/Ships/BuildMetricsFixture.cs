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
    public PowerBudgetFixture PowerBudget { get; set; } = new();

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

/// <summary>One power budget and the priority bands it leaves.</summary>
internal sealed class PowerBudgetFixture
{
    public double Available { get; set; }

    public List<PowerConsumerFixture> Consumers { get; set; } = [];

    public double Retracted { get; set; }

    public double Deployed { get; set; }

    public List<PowerBandFixture> Bands { get; set; } = [];
}

/// <summary>One fitted module's claim on the power plant.</summary>
internal sealed class PowerConsumerFixture
{
    public double Draw { get; set; }

    public int? Priority { get; set; }

    public bool DeployedOnly { get; set; }
}

/// <summary>One priority group's share of the power budget.</summary>
internal sealed class PowerBandFixture
{
    public int Priority { get; set; }

    public double Retracted { get; set; }

    public double Deployed { get; set; }

    public double RetractedTotal { get; set; }

    public double DeployedTotal { get; set; }

    public bool PoweredRetracted { get; set; }

    public bool PoweredDeployed { get; set; }
}
