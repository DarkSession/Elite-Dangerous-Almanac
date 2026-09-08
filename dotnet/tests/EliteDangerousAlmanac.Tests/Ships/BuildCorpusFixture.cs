using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The index of the shared community build corpus.</summary>
internal sealed class BuildCorpusIndex
{
    public int Count { get; set; }

    /// <summary>The engineering entries the corpus records across every build.</summary>
    public int DeclaredEngineering { get; set; }

    public List<BuildCorpusEntry> Builds { get; set; } = [];
}

/// <summary>One build the index names.</summary>
internal sealed class BuildCorpusEntry
{
    public string Id { get; set; } = string.Empty;

    public string Ship { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;
}

/// <summary>One real build, and the figures it pins.</summary>
internal sealed class BuildCorpusBuild
{
    public string Id { get; set; } = string.Empty;

    public string Ship { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public List<BuildCorpusModule> Modules { get; set; } = [];

    public BuildCorpusMetrics Metrics { get; set; } = new();
}

/// <summary>One module the corpus records, as its author fitted it.</summary>
internal sealed class BuildCorpusModule
{
    public string Slot { get; set; } = string.Empty;

    public string Item { get; set; } = string.Empty;

    /// <summary>The power band, where the author moved it off the first one.</summary>
    public int? Priority { get; set; }

    /// <summary>Whether the module runs, where the author left it unpowered.</summary>
    public bool? On { get; set; }

    /// <summary>The engineering the author declared, which the pinned figures do not apply.</summary>
    public BuildCorpusEngineering? Engineering { get; set; }
}

/// <summary>The engineering one corpus module declares.</summary>
internal sealed class BuildCorpusEngineering
{
    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    public string? Experimental { get; set; }
}

/// <summary>The figures one corpus build pins, all from the stock module stats.</summary>
internal sealed class BuildCorpusMetrics
{
    public double? UnladenMass { get; set; }

    public int CargoCapacity { get; set; }

    public int PassengerCapacity { get; set; }

    /// <summary>The main tank, in tonnes.</summary>
    public double FuelCapacity { get; set; }

    public double? MaxJumpRange { get; set; }

    public CorpusPower Power { get; set; } = new();

    /// <summary>
    /// Whether the stock power budget feeds the fitted generator. Where it does not, the shield
    /// figures are pinned against a plant with capacity enough to light every band.
    /// </summary>
    public bool? ShieldsPowered { get; set; }

    public CorpusDefence? Shields { get; set; }

    public CorpusDefence Armour { get; set; } = new();

    public CorpusWeapons Weapons { get; set; } = new();
}

/// <summary>What the plant makes and what the fit draws.</summary>
internal sealed class CorpusPower
{
    public double Available { get; set; }

    public double Retracted { get; set; }

    public double Deployed { get; set; }

    public bool WithinBudget { get; set; }
}

/// <summary>One defence layer's pool and what it resists.</summary>
internal sealed class CorpusDefence
{
    /// <summary>The shield's strength, in megajoules.</summary>
    public double? Strength { get; set; }

    /// <summary>The hull's points.</summary>
    public double? HitPoints { get; set; }

    public CorpusResistances Resistances { get; set; } = new();
}

/// <summary>The three resistances the corpus pins.</summary>
internal sealed class CorpusResistances
{
    public double Kinetic { get; set; }

    public double Thermal { get; set; }

    public double Explosive { get; set; }
}

/// <summary>The firepower the corpus pins.</summary>
internal sealed class CorpusWeapons
{
    public int Count { get; set; }

    public double DamagePerSecond { get; set; }

    public double SustainedDamagePerSecond { get; set; }
}
