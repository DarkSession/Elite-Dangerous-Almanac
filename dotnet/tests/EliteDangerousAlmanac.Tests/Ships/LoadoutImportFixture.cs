using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The part of <c>fixtures/ships/slef-export.jsonc</c> that pins an import.</summary>
internal sealed class LoadoutExportFixture
{
    /// <summary>The share of the hull and module prices a rebuy costs.</summary>
    public double RebuyFraction { get; set; }

    public ImportNormalizationFixture ImportNormalization { get; set; } = new();

    public ClassificationFixture Classification { get; set; } = new();

    /// <summary>A real export of an exploration build, taken at an outfitting discount.</summary>
    public BuildCaseFixture DeepBlack { get; set; } = new();

    /// <summary>A real journal capture of an engineered combat build.</summary>
    public BuildCaseFixture KraitPhantom { get; set; } = new();

    /// <summary>A real journal capture of an unengineered build.</summary>
    public BuildCaseFixture ViperMkIV { get; set; } = new();

    /// <summary>A real journal capture of an anti-xeno build.</summary>
    public BuildCaseFixture PythonMkII { get; set; } = new();

    /// <summary>A build put together here rather than read from a capture.</summary>
    public AssembledFixture Assembled { get; set; } = new();

    /// <summary>The journal fields a durable build deliberately does not carry.</summary>
    public JournalFieldExclusionsFixture JournalFieldExclusions { get; set; } = new();
}

/// <summary>One captured build, and what a read of it answers.</summary>
internal sealed class BuildCaseFixture
{
    /// <summary>The capture's own fixture path.</summary>
    public string Build { get; set; } = string.Empty;

    /// <summary>The keys an export writes, in the order a journal writes them.</summary>
    public List<string> TopLevelKeys { get; set; } = [];

    /// <summary>The modules the capture carries.</summary>
    public int ModuleCount { get; set; }

    /// <summary>The capture's keys an import drops as cosmetic or hull geometry.</summary>
    public List<string> NonOutfittingSlots { get; set; } = [];

    /// <summary>Every figure an export computes for itself.</summary>
    public RecomputedFiguresFixture Recomputed { get; set; } = new();

    /// <summary>The figures that reproduce the capture's own exactly.</summary>
    public List<string> PhysicalFiguresMatchSource { get; set; } = [];

    /// <summary>The capture's own figures, which an export rounds differently.</summary>
    public JournalToleranceFixture? JournalTolerance { get; set; }

    /// <summary>What the capture paid, and how that relates to the catalogue prices.</summary>
    public DiscountFixture Discount { get; set; } = new();

    /// <summary>The mounts in the order they were fitted.</summary>
    public List<string> FittedOrder { get; set; } = [];

    /// <summary>The mounts in the hull's own layout order.</summary>
    public List<string> SlotOrder { get; set; } = [];

    /// <summary>One edit, and the figures it produces.</summary>
    public AfterEditFixture? AfterEdit { get; set; }
}

/// <summary>The top-level figures an export computes.</summary>
internal sealed class RecomputedFiguresFixture
{
    public string? Ship { get; set; }

    public double? HullValue { get; set; }

    public double? ModulesValue { get; set; }

    public double? UnladenMass { get; set; }

    public double? CargoCapacity { get; set; }

    public double? MaxJumpRange { get; set; }

    public LoadoutFuelCapacity? FuelCapacity { get; set; }

    public double? Rebuy { get; set; }
}

/// <summary>The capture's own physical figures, which it rounds.</summary>
internal sealed class JournalToleranceFixture
{
    public double? UnladenMass { get; set; }

    public double? MaxJumpRange { get; set; }
}

/// <summary>What the capture paid.</summary>
internal sealed class DiscountFixture
{
    public double? SourceHullValue { get; set; }

    public double? SourceModulesValue { get; set; }

    public double? SourceRebuy { get; set; }

    public double? ModuleDiscount { get; set; }

    /// <summary>The mounts the capture gave no price at all.</summary>
    public List<string> UnpricedInSource { get; set; } = [];
}

/// <summary>One edit made to a read build, and the figures the edit produces.</summary>
internal sealed class AfterEditFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Item { get; set; } = string.Empty;

    public List<string> TopLevelKeys { get; set; } = [];

    public RecomputedFiguresFixture Recomputed { get; set; } = new();
}

/// <summary>A build put together from a stock hull and named modules.</summary>
internal sealed class AssembledFixture
{
    public string Ship { get; set; } = string.Empty;

    /// <summary>The modules to fit, keyed by mount.</summary>
    public Dictionary<string, string> Fit { get; set; } = [];

    public List<string> TopLevelKeys { get; set; } = [];

    /// <summary>The keys an export leaves out because the build states nothing for them.</summary>
    public List<string> OmittedKeys { get; set; } = [];

    public RecomputedFiguresFixture Recomputed { get; set; } = new();

    /// <summary>The modules an export writes.</summary>
    public List<JsonElement> Modules { get; set; } = [];

    /// <summary>The modules an export writes when asked to state the power of each.</summary>
    public List<JsonElement> ModulesWithExplicitPower { get; set; } = [];
}

/// <summary>The capture fields a durable build drops.</summary>
internal sealed class JournalFieldExclusionsFixture
{
    /// <summary>The capture whose top-level fields are dropped.</summary>
    public string TopLevelBuild { get; set; } = string.Empty;

    /// <summary>The top-level keys a build does not carry.</summary>
    public List<string> TopLevel { get; set; } = [];

    /// <summary>The capture whose engineering fields are dropped.</summary>
    public string EngineeringBuild { get; set; } = string.Empty;

    /// <summary>The engineering keys a build does not carry.</summary>
    public List<string> Engineering { get; set; } = [];
}

/// <summary>One capture and the state an import reads it into.</summary>
internal sealed class ImportNormalizationFixture
{
    /// <summary>The capture, in journal form.</summary>
    public JsonElement Input { get; set; }

    public ImportExpectationFixture Expected { get; set; } = new();
}

/// <summary>The modules and the findings one import produces.</summary>
internal sealed class ImportExpectationFixture
{
    public List<ImportedModuleFixture> Modules { get; set; } = [];

    public List<ImportOutcomeFixture> Outcomes { get; set; } = [];

    /// <summary>The modules price, absent where the import invalidated it.</summary>
    public double? ModulesValue { get; set; }

    /// <summary>The rebuy, absent where the import invalidated it.</summary>
    public double? Rebuy { get; set; }
}

/// <summary>One mount an import leaves filled.</summary>
internal sealed class ImportedModuleFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public bool? On { get; set; }

    public int? Priority { get; set; }

    public double? Health { get; set; }
}

/// <summary>One change an import made.</summary>
internal sealed class ImportOutcomeFixture
{
    public string Action { get; set; } = string.Empty;

    public string Slot { get; set; } = string.Empty;

    public string? SourceSymbol { get; set; }

    public string? ReplacementSymbol { get; set; }
}

/// <summary>How an import classifies a mount key.</summary>
internal sealed class ClassificationFixture
{
    public List<string> OutfittingSlotPatterns { get; set; } = [];

    public string NonOutfittingSlotPattern { get; set; } = string.Empty;

    public List<ClassificationExampleFixture> Examples { get; set; } = [];
}

/// <summary>One worked classification, and the reading it gets.</summary>
internal sealed class ClassificationExampleFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Item { get; set; } = string.Empty;

    public string Verdict { get; set; } = string.Empty;
}
