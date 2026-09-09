using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/module-stats.jsonc</c>.</summary>
internal sealed class ModuleStatsFixture
{
    /// <summary>What the counts mean, in the fixture's own words.</summary>
    public string? CountsNote { get; set; }

    /// <summary>Why the unpriced modules carry no price, in the fixture's own words.</summary>
    public string? UnpricedNote { get; set; }

    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>How many records in each catalogue carry a price.</summary>
    public Dictionary<string, int> PriceCounts { get; set; } = [];

    public List<ModuleStatSpot> Prices { get; set; } = [];

    /// <summary>Prices read off real purchases, and the rule that reproduces what was paid.</summary>
    public PurchaseCaptureFixture PurchaseCapture { get; set; } = new();

    /// <summary>Records that are sold and simply unpriced by every registry.</summary>
    public List<string> Unpriced { get; set; } = [];

    /// <summary>Whole stat blocks this port has to reproduce field for field.</summary>
    public List<ModuleStatSpot> Spot { get; set; } = [];

    /// <summary>Weapons whose damage is already per second.</summary>
    public List<string> ContinuousFire { get; set; } = [];

    public StatCountsFixture StatCounts { get; set; } = new();

    public SymbolSetFixture SupercruiseOvercharge { get; set; } = new();

    public SymbolSetFixture WithoutIntegrity { get; set; } = new();

    public CabinCapacityFixture CabinCapacity { get; set; } = new();

    public GrantOnlyFixture GrantOnly { get; set; } = new();

    public FreeModulesFixture FreeModules { get; set; } = new();

    /// <summary>What in-game verification covered, counted against the catalogues.</summary>
    public InGameAuditFixture InGameAudit { get; set; } = new();

    /// <summary>Values a verified in-game reading fixed.</summary>
    public List<ModuleStatSpot> InGameVerifiedValues { get; set; } = [];

    /// <summary>Fields a verified in-game reading showed a module does not carry.</summary>
    public List<AbsentFieldsFixture> InGameVerifiedAbsentFields { get; set; } = [];

    /// <summary>What Frontier's own captures say about the base values in the catalogues.</summary>
    public CapturedBaseStatsFixture CapturedBaseStats { get; set; } = new();
}

/// <summary>The shape of <c>capturedBaseStats</c> in <c>fixtures/ships/module-stats.jsonc</c>.</summary>
internal sealed class CapturedBaseStatsFixture
{
    /// <summary>What the captures reach, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>How far two readings of one stat may differ and still agree.</summary>
    /// <remarks>
    /// The game writes 20.000004 for 20 and 2.499998 for 2.5. The tolerance is relative, so
    /// it means the same thing at every magnitude.
    /// </remarks>
    public double FloatNoiseTolerance { get; set; }

    /// <summary>Why the unmapped labels are unmapped, in the fixture's own words.</summary>
    public string? UnmappedNote { get; set; }

    /// <summary>Weapons a captured experimental effect splits the damage of.</summary>
    public List<ConvertedDistributionFixture> ConvertedDamageDistributions { get; set; } = [];

    /// <summary>One entry for each capture that states a base value.</summary>
    public List<CapturedBaseFixture> Captures { get; set; } = [];

    /// <summary>What the folded damage figures are, in the fixture's own words.</summary>
    public string? WeaponsNote { get; set; }

    /// <summary>The unmodified damage per second a capture states, weapon by weapon.</summary>
    public List<CapturedWeaponFixture> Weapons { get; set; } = [];

    /// <summary>Fitted weapons whose engineered figures the fixture pins.</summary>
    public List<EffectiveWeaponFixture> EffectiveWeapons { get; set; } = [];

    /// <summary>What the rebuild proves, in the fixture's own words.</summary>
    public string? RebuildNote { get; set; }

    /// <summary>How far a rebuilt figure may sit from the stated one.</summary>
    public double RebuildTolerance { get; set; }

    /// <summary>Each journal capture, and the two totals it states.</summary>
    public List<RebuildFixture> Rebuilds { get; set; } = [];

    /// <summary>Why these engineered results are read back, in the fixture's own words.</summary>
    public string? EngineeredNote { get; set; }

    /// <summary>Engineered results whose label resolution has to be read back.</summary>
    public List<EngineeredResultFixture> Engineered { get; set; } = [];
}

/// <summary>One capture, and what its stated base values amount to.</summary>
internal sealed class CapturedBaseFixture
{
    public string File { get; set; } = string.Empty;

    /// <summary>The distinct module and label pairs it gives a base value for.</summary>
    public int Stated { get; set; }

    /// <summary>How many of those name a stat the record holds.</summary>
    public int Mapped { get; set; }

    /// <summary>How many agree digit for digit.</summary>
    public int Exact { get; set; }

    /// <summary>How many agree to within the game's own float noise.</summary>
    public int WithinFloatNoise { get; set; }

    /// <summary>The labels the catalogue models no stat for.</summary>
    public List<UnmappedLabelFixture> Unmapped { get; set; } = [];
}

/// <summary>One module and label pair the catalogue models no stat for.</summary>
internal sealed class UnmappedLabelFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
}

/// <summary>One weapon's unmodified damage per second, as a capture states it.</summary>
internal sealed class CapturedWeaponFixture
{
    public string Symbol { get; set; } = string.Empty;

    public double DamagePerSecond { get; set; }
}

/// <summary>One fitted weapon, and the engineered figures it carries.</summary>
internal sealed class EffectiveWeaponFixture
{
    public string File { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public double Damage { get; set; }

    public double? MaximumRange { get; set; }

    public double? FalloffRange { get; set; }
}

/// <summary>One capture, and the two totals it states for itself.</summary>
internal sealed class RebuildFixture
{
    public string File { get; set; } = string.Empty;

    public double UnladenMass { get; set; }

    public double MaxJumpRange { get; set; }
}

/// <summary>One engineered result, at the stat the fixture names for it.</summary>
internal sealed class EngineeredResultFixture
{
    public string File { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    /// <summary>The stat the value belongs to, written out rather than resolved.</summary>
    public string Field { get; set; } = string.Empty;

    /// <summary>The value, in the catalogue's own units.</summary>
    public double Value { get; set; }
}

/// <summary>One weapon whose experimental effect splits its damage across two types.</summary>
internal sealed class ConvertedDistributionFixture
{
    public string File { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public string Experimental { get; set; } = string.Empty;

    /// <summary>The split the stock weapon carries.</summary>
    public Dictionary<string, double> Base { get; set; } = [];

    /// <summary>The split the effect leaves.</summary>
    public Dictionary<string, double> Effective { get; set; } = [];
}

/// <summary>Prices read off real purchases, with the discount rule and its cross-checks.</summary>
internal sealed class PurchaseCaptureFixture
{
    /// <summary>Where the readings come from, in the fixture's own words.</summary>
    public string? Note { get; set; }

    /// <summary>The discount rule, written out.</summary>
    public string Model { get; set; } = string.Empty;

    public List<PurchaseReadingFixture> Readings { get; set; } = [];

    /// <summary>Readings held elsewhere that confirm a price at another discount.</summary>
    public List<PurchaseCrossCheckFixture> CrossChecks { get; set; } = [];
}

/// <summary>One purchase: what the panel listed, and what the commander paid.</summary>
internal sealed class PurchaseReadingFixture
{
    public string Symbol { get; set; } = string.Empty;

    /// <summary>The credits the journal records leaving the balance.</summary>
    public int Paid { get; set; }

    /// <summary>The undiscounted list price the catalogue carries.</summary>
    public int Cost { get; set; }

    /// <summary>Whether the reading pins one list price on its own.</summary>
    public bool Unique { get; set; }
}

/// <summary>One reading held elsewhere, at its own discount.</summary>
internal sealed class PurchaseCrossCheckFixture
{
    public string Symbol { get; set; } = string.Empty;

    public int Value { get; set; }

    /// <summary>The discount the reading was taken at, as a percentage.</summary>
    public string Discount { get; set; } = string.Empty;

    /// <summary>The fixtures the reading is held in.</summary>
    public string Source { get; set; } = string.Empty;
}

/// <summary>What in-game verification reached, counted against the catalogues.</summary>
internal sealed class InGameAuditFixture
{
    /// <summary>What the audit covers and what it leaves out, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public int CatalogueIdentities { get; set; }

    /// <summary>Catalogue identities the game's own module panel also names.</summary>
    public int IdentityMatches { get; set; }

    /// <summary>Identities only a public registry names.</summary>
    public int RegistryOnlyIdentities { get; set; }

    public int NumericModulesVerified { get; set; }

    /// <summary>Ship-armour records, whose numeric values keep their own provenance.</summary>
    public int ArmourModulesOutsideNumericVerification { get; set; }

    /// <summary>Records a reading changed or confirmed absent.</summary>
    public int VerifiedRecords { get; set; }

    public int VerifiedFields { get; set; }

    public int VerifiedValueFields { get; set; }

    public int VerifiedAbsentFields { get; set; }

    /// <summary>How many records carry each stat the audit counted.</summary>
    public Dictionary<string, int> CatalogueFieldCounts { get; set; } = [];
}

/// <summary>One module's pinned stats: its symbol and whatever fields the fixture carries.</summary>
internal sealed class ModuleStatSpot
{
    public string Symbol { get; set; } = string.Empty;

    [JsonExtensionData]
    public Dictionary<string, JsonElement> Fields { get; set; } = [];
}

/// <summary>How many records carry each base stat a blueprint recipe scales.</summary>
internal sealed class StatCountsFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public Dictionary<string, int> Counts { get; set; } = [];
}

/// <summary>An exact set of symbols, and its size.</summary>
internal sealed class SymbolSetFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public int Count { get; set; }

    public List<string> Symbols { get; set; } = [];
}

/// <summary>The passenger berths every cabin carries.</summary>
internal sealed class CabinCapacityFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public int Count { get; set; }

    public List<ModuleStatSpot> Records { get; set; } = [];
}

/// <summary>Every record that arrives granted, with the article the game does sell.</summary>
internal sealed class GrantOnlyFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public List<GrantOnlyModule> Modules { get; set; } = [];
}

/// <summary>One granted article and its sold twin.</summary>
internal sealed class GrantOnlyModule
{
    public string Symbol { get; set; } = string.Empty;

    public string SoldTwin { get; set; } = string.Empty;
}

/// <summary>Every non-armour module priced at zero.</summary>
internal sealed class FreeModulesFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Note { get; set; }

    public List<string> Symbols { get; set; } = [];
}

/// <summary>Fields one module does not carry.</summary>
internal sealed class AbsentFieldsFixture
{
    public string Symbol { get; set; } = string.Empty;

    public List<string> Fields { get; set; } = [];
}
