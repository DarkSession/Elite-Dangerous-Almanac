using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Materials;

/// <summary>The shape of <c>fixtures/materials/materials.jsonc</c>.</summary>
internal sealed class MaterialsFixture
{
    /// <summary>The size each catalogue has, keyed by catalogue name.</summary>
    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>Individual records this port has to reproduce field for field.</summary>
    public List<MaterialFixtureRecord> Records { get; set; } = [];

    /// <summary>The grades one line holds, in one catalogue.</summary>
    public List<LineGradesFixture> LineGrades { get; set; } = [];

    /// <summary>
    /// The Thargoid materials absent from the pinned FDevIDs source, whose grade comes
    /// from INARA and whose symbol comes from the journal.
    /// </summary>
    public List<string> NotInFdevIds { get; set; } = [];
}

/// <summary>One pinned material record.</summary>
internal sealed class MaterialFixtureRecord
{
    public string Category { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? ElementSymbol { get; set; }

    public int Grade { get; set; }

    public string Line { get; set; } = string.Empty;
}

/// <summary>The grades one line holds.</summary>
internal sealed class LineGradesFixture
{
    public string Catalogue { get; set; } = string.Empty;

    public string Line { get; set; } = string.Empty;

    public List<int> Grades { get; set; } = [];
}
