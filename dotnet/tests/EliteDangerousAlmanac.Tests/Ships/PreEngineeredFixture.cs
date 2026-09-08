using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/pre-engineered.jsonc</c>.</summary>
internal sealed class PreEngineeredFixture
{
    public int Count { get; set; }

    /// <summary>How many variants each acquisition route supplies.</summary>
    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>How many variants publish a stat block, and how many are bought.</summary>
    public Dictionary<string, int> ModifierCounts { get; set; } = [];

    public LockedFixture EngineeringLocked { get; set; } = new();

    /// <summary>The three festive launchers, which share one stat block.</summary>
    public FestiveFixture Festive { get; set; } = new();

    /// <summary>Every label a variant's stat block moves.</summary>
    public List<string> ModifierLabels { get; set; } = [];

    /// <summary>Articles bought with an experimental effect already applied.</summary>
    public BakedEffectsFixture MercenaryBakedEffects { get; set; } = new();

    /// <summary>The decimal places a modifier value is authored to.</summary>
    public int MaxModifierDecimalPlaces { get; set; }

    /// <summary>Articles whose firing cycle moves, and the rate that follows.</summary>
    public BurstIntervalFixture BurstIntervalVariants { get; set; } = new();

    /// <summary>Modifiers authored as the resulting stat rather than a multiplier.</summary>
    public CountFixture AuthoredStats { get; set; } = new();

    /// <summary>Variants that resolve no stat at all. There are none.</summary>
    public SymbolCountFixture FullyUnresolved { get; set; } = new();

    /// <summary>The Merc Coin the shop rows are priced at.</summary>
    public MercCoinTotalsFixture MercCoin { get; set; } = new();

    /// <summary>Whole records this port has to reproduce field for field.</summary>
    public List<PreEngineeredRecordFixture> Records { get; set; } = [];

    /// <summary>One base module sold or awarded in several flavours.</summary>
    public MultiVariantFixture MultiVariant { get; set; } = new();

    /// <summary>One blueprint awarded more than once, told apart by its effect.</summary>
    public SameBlueprintFixture SameBlueprintTwice { get; set; } = new();

    /// <summary>One module, blueprint and effect awarded at two grades by two routes.</summary>
    public SameTripleFixture SameTripleDifferentGrade { get; set; } = new();

    /// <summary>Variants resolved into the article that is actually fitted.</summary>
    public Dictionary<string, ResolvedVariantFixture> Resolved { get; set; } = [];

    /// <summary>Modules with no pre-engineered form.</summary>
    public List<string> NotPreEngineered { get; set; } = [];

    /// <summary>The joins every record has to satisfy.</summary>
    public Dictionary<string, bool> Joins { get; set; } = [];
}

/// <summary>The final articles that accept no further engineering.</summary>
internal sealed class LockedFixture
{
    public int Count { get; set; }

    public List<string> Symbols { get; set; } = [];
}

/// <summary>The festive launchers and the one modifier they carry.</summary>
internal sealed class FestiveFixture
{
    public string Symbol { get; set; } = string.Empty;

    public int Grade { get; set; }

    public List<string> Blueprints { get; set; } = [];

    public PreEngineeredModifierFixture Modifier { get; set; } = new();

    public FestiveResolvedFixture Resolved { get; set; } = new();
}

/// <summary>One hand-set stat change.</summary>
internal sealed class PreEngineeredModifierFixture
{
    public string Label { get; set; } = string.Empty;

    public string Method { get; set; } = string.Empty;

    public double Value { get; set; }
}

/// <summary>What the festive stat block resolves to.</summary>
internal sealed class FestiveResolvedFixture
{
    public double BaseDamage { get; set; }

    public double Damage { get; set; }
}

/// <summary>The shop rows bought with an effect already applied.</summary>
internal sealed class BakedEffectsFixture
{
    public int Count { get; set; }

    public List<BakedEffectFixture> Variants { get; set; } = [];
}

/// <summary>One bought article, its baked effect, and the stats that effect moves.</summary>
internal sealed class BakedEffectFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public string ExperimentalEffectSymbol { get; set; } = string.Empty;

    public List<string> MovedStats { get; set; } = [];
}

/// <summary>The articles whose firing cycle moves.</summary>
internal sealed class BurstIntervalFixture
{
    public int Count { get; set; }

    public List<BurstIntervalVariantFixture> Variants { get; set; } = [];
}

/// <summary>One article's moved firing cycle and the rate it produces.</summary>
internal sealed class BurstIntervalVariantFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public int Grade { get; set; }

    public string? ExperimentalEffectSymbol { get; set; }

    public double StockBurstInterval { get; set; }

    public double BurstInterval { get; set; }

    public double RateOfFire { get; set; }
}

/// <summary>A pinned count.</summary>
internal sealed class CountFixture
{
    public int Count { get; set; }
}

/// <summary>A pinned count and the symbols behind it.</summary>
internal sealed class SymbolCountFixture
{
    public int Count { get; set; }

    public List<string> Symbols { get; set; } = [];
}

/// <summary>The Merc Coin totals across the shop rows.</summary>
internal sealed class MercCoinTotalsFixture
{
    public int Total { get; set; }

    public int Cheapest { get; set; }

    public int Dearest { get; set; }
}

/// <summary>One whole catalogue record.</summary>
internal sealed class PreEngineeredRecordFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public int Grade { get; set; }

    public string Acquisition { get; set; } = string.Empty;

    public string? ExperimentalEffectSymbol { get; set; }

    public bool EngineeringLocked { get; set; }

    public int? MercCoinCost { get; set; }

    public List<PreEngineeredModifierFixture>? Modifiers { get; set; }
}

/// <summary>One module and every flavour it is sold or awarded in.</summary>
internal sealed class MultiVariantFixture
{
    public string Symbol { get; set; } = string.Empty;

    public List<string> Blueprints { get; set; } = [];
}

/// <summary>One module and blueprint awarded with several effects.</summary>
internal sealed class SameBlueprintFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public List<string> Experimentals { get; set; } = [];
}

/// <summary>One module and blueprint awarded at two grades by two routes.</summary>
internal sealed class SameTripleFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public List<int> Grades { get; set; } = [];

    public List<string> Acquisitions { get; set; } = [];
}

/// <summary>One variant resolved into the article that is fitted.</summary>
internal sealed class ResolvedVariantFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public int? Grade { get; set; }

    /// <summary>The stock module's stats, keyed by stat name.</summary>
    public Dictionary<string, double>? Base { get; set; }

    /// <summary>The resolved article's stats, keyed by stat name.</summary>
    public Dictionary<string, double> Engineered { get; set; } = [];

    /// <summary>The labels the variant moves that cannot be resolved.</summary>
    public List<string>? Unresolved { get; set; }
}
