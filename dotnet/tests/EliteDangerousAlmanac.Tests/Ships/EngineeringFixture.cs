using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/engineering.jsonc</c>.</summary>
internal sealed class EngineeringFixture
{
    /// <summary>One complete recipe, folded with an experimental effect.</summary>
    public RolledRecipeFixture Anchor { get; set; } = new();

    /// <summary>A module bought already engineered, taken further at an engineer.</summary>
    public RolledRecipeFixture PreEngineeredClimb { get; set; } = new();

    /// <summary>One journal name, two scanner recipes.</summary>
    public CollisionFixture ScannerIdCollision { get; set; } = new();

    /// <summary>One journal name, the multi-cannon Overcharged and every other weapon's.</summary>
    public CollisionFixture OverchargedIdCollision { get; set; } = new();

    /// <summary>A computed clip rounded up to whole bursts.</summary>
    public ClipRoundingFixture ClipRounding { get; set; } = new();

    /// <summary>Journal spellings read off a real stored-module capture.</summary>
    public JournalSpellingsFixture JournalSpellings { get; set; } = new();

    /// <summary>Every record whose key is not the name the game writes.</summary>
    public MapFixture JournalNames { get; set; } = new();

    /// <summary>Anti-Guardian Zone Resistance, which grants a capability rather than a number.</summary>
    public CapabilityFixture GuardianZoneResistanceCapability { get; set; } = new();

    /// <summary>Modification families that are blueprints rather than experimental effects.</summary>
    public BlueprintOnlyFixture BlueprintOnlyModifications { get; set; } = new();

    /// <summary>In-game display names that are easy to normalize incorrectly.</summary>
    public MapFixture ExperimentalNames { get; set; } = new();

    /// <summary>The fixed splits the three converting experimental effects state.</summary>
    public DistributionMapFixture ExperimentalDamageDistributions { get; set; } = new();

    /// <summary>The shared per-grade split of the three laser Plasma conversion recipes.</summary>
    public ThermalPlasmaFixture ThermalPlasmaConversions { get; set; } = new();

    /// <summary>The Merc Coin the charging recipes bill.</summary>
    public MercCoinFixture MercCoinCosts { get; set; } = new();

    public int BlueprintCount { get; set; }

    public int ExperimentalCount { get; set; }
}

/// <summary>One recipe rolled at a stated grade and quality, and what it folds to.</summary>
internal sealed class RolledRecipeFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    public double Quality { get; set; }

    public string? Experimental { get; set; }

    /// <summary>The grade a Mercenary article is sold at, so no recipe recreates it.</summary>
    public int? GradeUnavailable { get; set; }

    public Dictionary<string, double> Base { get; set; } = [];

    public Dictionary<string, double> Expected { get; set; } = [];
}

/// <summary>One journal name that two recipes share, read against the fitted module.</summary>
internal sealed class CollisionFixture
{
    public int Grade { get; set; }

    public double Quality { get; set; }

    public List<CollisionCaseFixture> Cases { get; set; } = [];

    /// <summary>The direction the resolution does not run.</summary>
    public List<ModuleBlueprintFixture> Refused { get; set; } = [];
}

/// <summary>One module and the recipe its own menu says a shared name means.</summary>
internal sealed class CollisionCaseFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public string Resolved { get; set; } = string.Empty;

    public Dictionary<string, double> Base { get; set; } = [];

    public List<ModifierFixture> Modifiers { get; set; } = [];
}

/// <summary>One module and one blueprint identifier.</summary>
internal sealed class ModuleBlueprintFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public string? Resolved { get; set; }

    public string? Slot { get; set; }
}

/// <summary>One entry of a journal modifiers block.</summary>
internal sealed class ModifierFixture
{
    public string Label { get; set; } = string.Empty;

    public double? Value { get; set; }

    public double? OriginalValue { get; set; }

    public string? ValueStr { get; set; }
}

/// <summary>Magazines that a roll leaves as a part round.</summary>
internal sealed class ClipRoundingFixture
{
    public List<ClipRoundingCaseFixture> Cases { get; set; } = [];
}

/// <summary>One weapon's clip, before and after the round-up.</summary>
internal sealed class ClipRoundingCaseFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    public double Quality { get; set; }

    public double BaseAmmoClipSize { get; set; }

    public double UnroundedAmmoClipSize { get; set; }

    public double BurstSize { get; set; }

    /// <summary>Where the burst size comes from: the recipe, the module, or nowhere.</summary>
    public string BurstFrom { get; set; } = string.Empty;

    public double AmmoClipSize { get; set; }

    public double? AmmoMaximum { get; set; }
}

/// <summary>Journal spellings and the catalogue keys they reach.</summary>
internal sealed class JournalSpellingsFixture
{
    public List<ModuleBlueprintFixture> Cases { get; set; } = [];

    public OperationsKeysFixture OperationsKeys { get; set; } = new();
}

/// <summary>How the Operations recipes are keyed.</summary>
internal sealed class OperationsKeysFixture
{
    /// <summary>Identifiers stored with the registry's own prefix. There are none.</summary>
    public List<string> Prefixed { get; set; } = [];

    /// <summary>A spelling read off a real export.</summary>
    public List<RolledRecipeFixture> Observed { get; set; } = [];
}

/// <summary>A pinned map of identifier to value.</summary>
internal sealed class MapFixture
{
    public Dictionary<string, string> Map { get; set; } = [];
}

/// <summary>A pinned map of identifier to damage split.</summary>
internal sealed class DistributionMapFixture
{
    public Dictionary<string, Dictionary<string, double>> Map { get; set; } = [];
}

/// <summary>The one recipe that grants a capability rather than moving a number.</summary>
internal sealed class CapabilityFixture
{
    public string OfferedAs { get; set; } = string.Empty;

    public int Grade { get; set; }

    public ModifierFixture Modifier { get; set; } = new();

    public List<ModuleBlueprintFixture> Cases { get; set; } = [];

    public ModuleBlueprintFixture Refused { get; set; } = new();
}

/// <summary>Speculative effect identifiers, and the blueprints that carry the modification.</summary>
internal sealed class BlueprintOnlyFixture
{
    public Dictionary<string, ExcludedExperimentalFixture> ExcludedExperimentalIds { get; set; } = [];
}

/// <summary>The blueprints one absent effect identifier stands for.</summary>
internal sealed class ExcludedExperimentalFixture
{
    public Dictionary<string, string> Blueprints { get; set; } = [];
}

/// <summary>The laser Plasma conversion recipes and their shared per-grade split.</summary>
internal sealed class ThermalPlasmaFixture
{
    /// <summary>Each recipe, and a module whose menu offers it.</summary>
    public Dictionary<string, string> Blueprints { get; set; } = [];

    public Dictionary<string, Dictionary<string, double>> Grades { get; set; } = [];
}

/// <summary>The Merc Coin catalogue, per roll and over a whole climb.</summary>
internal sealed class MercCoinFixture
{
    public Dictionary<string, Dictionary<string, int>> PerRoll { get; set; } = [];

    public List<MercCoinClimbFixture> Climbs { get; set; } = [];
}

/// <summary>One weighted climb and the currency it bills.</summary>
internal sealed class MercCoinClimbFixture
{
    public string Blueprint { get; set; } = string.Empty;

    public int Grade { get; set; }

    public int CurrentGrade { get; set; }

    public int MercCoin { get; set; }
}
