using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.GalaxyMap;

/// <summary>The shape of <c>fixtures/galaxy-map/markers.jsonc</c>.</summary>
internal sealed class GalaxyMapMarkersFixture
{
    /// <summary>How many markers the catalogue holds.</summary>
    public int Count { get; set; }

    /// <summary>Every marker this port has to reproduce field for field.</summary>
    public List<GalaxyMapMarkerFixtureRecord> Records { get; set; } = [];

    /// <summary>The palette the markers draw from, sorted.</summary>
    public List<string> DistinctColors { get; set; } = [];

    /// <summary>Every marker whose frame colour differs from its glyph colour.</summary>
    public List<string> FramedDifferently { get; set; } = [];
}

/// <summary>One pinned marker record.</summary>
internal sealed class GalaxyMapMarkerFixtureRecord
{
    public string Symbol { get; set; } = string.Empty;

    public string Color { get; set; } = string.Empty;

    public string FrameColor { get; set; } = string.Empty;
}
