using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Materials;

/// <summary>The shape of <c>fixtures/materials/micro-resources.jsonc</c>.</summary>
internal sealed class MicroResourcesFixture
{
    /// <summary>The size each catalogue has, keyed by catalogue name.</summary>
    public Dictionary<string, int> Counts { get; set; } = [];

    /// <summary>
    /// The digest of one catalogue's symbols, each followed by a newline. It pins the
    /// membership a data acquisition produced without listing every symbol.
    /// </summary>
    public Dictionary<string, string> MembershipSha256 { get; set; } = [];

    /// <summary>Individual records this port has to reproduce field for field.</summary>
    public List<MicroResourceFixtureRecord> Records { get; set; } = [];
}

/// <summary>One pinned micro-resource record.</summary>
internal sealed class MicroResourceFixtureRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}
