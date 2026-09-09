using System.Collections.Generic;
using EliteDangerousAlmanac.Tests.Support;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/pre-engineered.jsonc</c>.</summary>
internal sealed class PreEngineeredFixture
{
    /// <summary>Reading a real capture back to the fixed article it describes.</summary>
    public IdentificationFixture Identification { get; set; } = new();

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
    /// <summary>The rounded figures the outfitting panel shows.</summary>
    public FestivePanelFixture Panel { get; set; } = new();

    /// <summary>The damage a second the resolved article deals.</summary>
    public double DamagePerSecond { get; set; }

    public double BaseDamage { get; set; }

    public double Damage { get; set; }
}

/// <summary>The shop rows bought with an effect already applied.</summary>
internal sealed class BakedEffectsFixture
{
    /// <summary>The one row whose baked effect is resolved to exact figures.</summary>
    public BakedEffectResolutionFixture Resolved { get; set; } = new();

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
    /// <summary>The rate the whole burst block produces, in bursts a second.</summary>
    public double BlockRateOfFire { get; set; }

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
    /// <summary>What the count is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public int Count { get; set; }
}

/// <summary>A pinned count and the symbols behind it.</summary>
internal sealed class SymbolCountFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

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
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>The same article as the outfitting panel shows it, rounded the way it rounds.</summary>
    public DisplayedPanelFixture? Displayed { get; set; }

    /// <summary>The percentage changes the panel writes beside each moved stat.</summary>
    public DisplayedChangesFixture? DisplayedChanges { get; set; }

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

/// <summary>The rounded figures the outfitting panel shows for a festive article.</summary>
internal sealed class FestivePanelFixture
{
    /// <summary>The whole-number percentage the panel writes beside the modified stat.</summary>
    public double Percent { get; set; }

    public double Damage { get; set; }

    public double DamagePerSecond { get; set; }
}

/// <summary>One bought article's baked effect, resolved to the exact figures it produces.</summary>
/// <remarks>
/// The figures themselves, not only which stats moved: the effect's own contribution over
/// the stock article, with no grade-one recipe invented around it.
/// </remarks>
internal sealed class BakedEffectResolutionFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    /// <summary>The stats the catalogue record states, before the effect.</summary>
    public Dictionary<string, double> Stock { get; set; } = [];

    /// <summary>The same stats after the effect.</summary>
    public Dictionary<string, double> Engineered { get; set; } = [];

    /// <summary>The modifiers a journal would write for the resolved article.</summary>
    public List<ModifierFixture> JournalModifiers { get; set; } = [];
}

/// <summary>Reading a real capture back to the fixed article it describes.</summary>
/// <remarks>
/// A fixed article is identified from the stats a capture reports rather than from the
/// recipe named beside them, because a producer is free to name any recipe. The cases are
/// real captures, and the negative ones matter as much as the positive: a recipe on its own
/// is no evidence that an article is fixed.
/// </remarks>
internal sealed class IdentificationFixture
{
    /// <summary>What the cases prove, in the fixture's own words.</summary>
    public string? Description { get; set; }

    /// <summary>Captures whose stats name exactly one fixed article.</summary>
    public List<IdentificationMatchFixture> Matches { get; set; } = [];

    /// <summary>Captures whose stats name no fixed article at all.</summary>
    public List<CapturedModuleFixture> NotMatches { get; set; } = [];

    /// <summary>The Mercenary article, which is identified by its own exclusive recipe.</summary>
    public MercenaryIdentificationFixture Mercenary { get; set; } = new();

    /// <summary>A capture that omits one figure the fixed article predicts.</summary>
    public OmittedBakedEffectFixture OmittedBakedExperimental { get; set; } = new();
}

/// <summary>One capture, and the fixed article its stats name.</summary>
internal sealed class IdentificationMatchFixture
{
    /// <summary>The capture's own file name, under <c>fixtures/ships/</c>.</summary>
    public string Source { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public int Grade { get; set; }

    /// <summary>The effect the article is sold carrying, where it carries one.</summary>
    public string? ExperimentalEffectSymbol { get; set; }

    /// <summary>An effect the commander added on top, which is not part of the article.</summary>
    public string? AppliedExperimental { get; set; }

    /// <summary>How the article is come by.</summary>
    public string Acquisition { get; set; } = string.Empty;
}

/// <summary>One mount of one capture.</summary>
internal sealed class CapturedModuleFixture
{
    /// <summary>The capture's own file name, under <c>fixtures/ships/</c>.</summary>
    public string Source { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;
}

/// <summary>The Mercenary article, and the recipes and grades that do not name it.</summary>
internal sealed class MercenaryIdentificationFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    /// <summary>The grade the article is sold at.</summary>
    public int PurchaseGrade { get; set; }

    /// <summary>The grade an engineer takes it to.</summary>
    public int UpgradedGrade { get; set; }

    public int MercCoinCost { get; set; }
}

/// <summary>A capture that omits one figure the fixed article predicts.</summary>
/// <remarks>
/// A producer may state the authored figure for one stat and leave another out. The article
/// is still identified, and the figure it predicts comes from the article rather than from
/// the stock record.
/// </remarks>
internal sealed class OmittedBakedEffectFixture
{
    /// <summary>The capture's own file name, under <c>fixtures/ships/</c>.</summary>
    public string Source { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    /// <summary>The modifier the producer states in place of the omitted one.</summary>
    public ModifierFixture ReportedInstead { get; set; } = new();

    /// <summary>The stat the capture leaves out.</summary>
    public string Omitted { get; set; } = string.Empty;

    /// <summary>The figure the fixed article predicts for it.</summary>
    public double ExpectedThermalLoad { get; set; }

    /// <summary>What the case proves, in the fixture's own words.</summary>
    public string? Note { get; set; }
}

/// <summary>One article as its outfitting panel shows it.</summary>
/// <remarks>
/// Each figure carries the decimal places the fixture writes it with, so a reading is
/// compared at the precision the panel shows rather than at the precision it is computed to.
/// </remarks>
internal sealed class DisplayedPanelFixture
{
    public PanelReading? Mass { get; set; }

    public PanelReading? PowerDraw { get; set; }

    public PanelReading? DistributorDraw { get; set; }

    public PanelReading? ThermalLoad { get; set; }

    public PanelReading? ArmourPiercing { get; set; }

    public PanelReading? MaximumRange { get; set; }

    public PanelReading? ShotSpeed { get; set; }

    public PanelReading? Jitter { get; set; }

    public PanelReading? FalloffRange { get; set; }

    public PanelReading? DamagePerSecond { get; set; }

    public PanelReading? Damage { get; set; }

    public PanelReading? RateOfFire { get; set; }

    public PanelReading? ClipSize { get; set; }

    public PanelReading? AmmoMaximum { get; set; }

    /// <summary>The damage type the panel names.</summary>
    public string? DamageType { get; set; }
}

/// <summary>The changes the panel writes beside each stat one article moves.</summary>
/// <remarks>
/// A percentage is written to one decimal place. Jitter is the one change the panel states
/// as a difference in degrees rather than as a proportion.
/// </remarks>
internal sealed class DisplayedChangesFixture
{
    public double MassPercent { get; set; }

    public double PowerDrawPercent { get; set; }

    public double DistributorDrawPercent { get; set; }

    public double ThermalLoadPercent { get; set; }

    public double ArmourPiercingPercent { get; set; }

    public double MaximumRangePercent { get; set; }

    public double ShotSpeedPercent { get; set; }

    public double JitterDegrees { get; set; }

    public double FalloffRangePercent { get; set; }
}
