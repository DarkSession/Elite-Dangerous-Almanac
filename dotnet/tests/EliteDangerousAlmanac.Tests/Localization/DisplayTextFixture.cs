using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Localization;

/// <summary>The whole of <c>fixtures/i18n/names.jsonc</c>.</summary>
internal sealed class NamesFixture
{
    /// <summary>One lookup, its tag and the spelling it answers.</summary>
    public List<NameLookupFixture> Lookups { get; set; } = [];
}

/// <summary>One catalogue lookup.</summary>
internal sealed class NameLookupFixture
{
    /// <summary>Which catalogue the lookup reads.</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>The identifier the owning catalogue is keyed by.</summary>
    public string Identifier { get; set; } = string.Empty;

    /// <summary>The BCP 47 tag.</summary>
    public string Locale { get; set; } = string.Empty;

    /// <summary>The spelling the lookup answers, or nothing where it answers none.</summary>
    public string? Expected { get; set; }
}

/// <summary>The whole of <c>fixtures/i18n/display-text.jsonc</c>.</summary>
internal sealed class DisplayTextFixture
{
    /// <summary>The purchased and awarded articles, by their whole identity.</summary>
    public List<VariantNameFixture> PreEngineered { get; set; } = [];

    /// <summary>The ship mounts, by their labels.</summary>
    public List<SlotNameFixture> Slots { get; set; } = [];

    /// <summary>The suit weapon mounts, by their labels.</summary>
    public List<MountNameFixture> Mounts { get; set; } = [];

    /// <summary>What each restricted mount takes.</summary>
    public List<RestrictionLabelFixture> Restrictions { get; set; } = [];

    /// <summary>The findings and the messages they carry.</summary>
    public List<DiagnosticMessageFixture> Diagnostics { get; set; } = [];
}

/// <summary>One purchased or awarded article, by its whole identity.</summary>
internal sealed class VariantNameFixture
{
    public VariantIdentityFixture Variant { get; set; } = new();

    public string Locale { get; set; } = string.Empty;

    public string? Expected { get; set; }
}

/// <summary>The four values that name one article.</summary>
internal sealed class VariantIdentityFixture
{
    public string Symbol { get; set; } = string.Empty;

    public string BlueprintSymbol { get; set; } = string.Empty;

    public string? ExperimentalEffectSymbol { get; set; }

    public string Acquisition { get; set; } = string.Empty;
}

/// <summary>One ship mount and its label.</summary>
internal sealed class SlotNameFixture
{
    public SlotFixture Slot { get; set; } = new();

    public string Locale { get; set; } = string.Empty;

    public string? Expected { get; set; }
}

/// <summary>One mount as the hull states it.</summary>
internal sealed class SlotFixture
{
    public string Kind { get; set; } = string.Empty;

    public string Key { get; set; } = string.Empty;

    public int Size { get; set; }

    public string? Core { get; set; }

    public string? Restriction { get; set; }
}

/// <summary>One suit weapon mount and its label.</summary>
internal sealed class MountNameFixture
{
    public MountFixture Mount { get; set; } = new();

    public string Locale { get; set; } = string.Empty;

    public string? Expected { get; set; }
}

/// <summary>One weapon mount.</summary>
internal sealed class MountFixture
{
    public string Key { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;
}

/// <summary>What one restricted mount takes.</summary>
internal sealed class RestrictionLabelFixture
{
    public string Restriction { get; set; } = string.Empty;

    public string Locale { get; set; } = string.Empty;

    public string? Expected { get; set; }
}

/// <summary>One finding and the message it carries.</summary>
internal sealed class DiagnosticMessageFixture
{
    /// <summary>Which kind of finding this is.</summary>
    public string Kind { get; set; } = string.Empty;

    public DiagnosticFixture Diagnostic { get; set; } = new();

    public string Locale { get; set; } = string.Empty;

    public string? Expected { get; set; }
}

/// <summary>The message a finding carries.</summary>
internal sealed class DiagnosticFixture
{
    /// <summary>The figures the message is composed from.</summary>
    public DiagnosticParamsFixture? Params { get; set; }

    /// <summary>Where in a refused payload the field sits.</summary>
    public string? Path { get; set; }

    /// <summary>The rule the field breaks.</summary>
    public string? Constraint { get; set; }

    /// <summary>Which entry of a multi-build export the finding is about.</summary>
    public int? Index { get; set; }

    /// <summary>The figure the finding is about, where the finding names one.</summary>
    public string? Field { get; set; }

    /// <summary>How badly the finding bears on the build.</summary>
    public string Severity { get; set; } = string.Empty;

    /// <summary>The code the reader keys the message by.</summary>
    public string Code { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;
}

/// <summary>The figures one finding's message is composed from.</summary>
internal sealed class DiagnosticParamsFixture
{
    public string? Slot { get; set; }
}
