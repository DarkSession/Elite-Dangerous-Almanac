using System.Collections.Generic;
using System.Text.Json;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The part of <c>fixtures/ships/slef-export.jsonc</c> that pins an import.</summary>
internal sealed class LoadoutExportFixture
{
    public ImportNormalizationFixture ImportNormalization { get; set; } = new();

    public ClassificationFixture Classification { get; set; } = new();
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
