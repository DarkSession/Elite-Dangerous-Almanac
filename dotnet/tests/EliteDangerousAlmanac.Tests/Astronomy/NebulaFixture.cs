using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The whole of <c>fixtures/astro/nebulae.jsonc</c>.</summary>
internal sealed class NebulaeFixture
{
    public Dictionary<string, int> Counts { get; set; } = [];

    public Dictionary<string, string> MembershipSha256 { get; set; } = [];

    public List<NebulaRecordFixture> Records { get; set; } = [];

    public List<NearestCaseFixture> Nearest { get; set; } = [];

    public List<WithinCaseFixture> Within { get; set; } = [];
}

/// <summary>One catalogued nebula the fixture pins.</summary>
internal sealed class NebulaRecordFixture
{
    public string Catalogue { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string System { get; set; } = string.Empty;

    public double X { get; set; }

    public double Y { get; set; }

    public double Z { get; set; }

    public string Type { get; set; } = string.Empty;

    public int RegionId { get; set; }
}

/// <summary>One question about the nebulae nearest a place.</summary>
internal sealed class NearestCaseFixture
{
    public string Origin { get; set; } = string.Empty;

    public CoordsFixture From { get; set; } = new();

    public string Catalogue { get; set; } = string.Empty;

    public int Count { get; set; }

    public List<NearbyNebulaFixture> Expect { get; set; } = [];
}

/// <summary>One question about the nebulae within a distance of a place.</summary>
internal sealed class WithinCaseFixture
{
    public string Origin { get; set; } = string.Empty;

    public CoordsFixture From { get; set; } = new();

    public string Catalogue { get; set; } = string.Empty;

    public double RadiusLy { get; set; }

    public List<NearbyNebulaFixture> Expect { get; set; } = [];
}

/// <summary>One nebula an answer is to hold, and how far away it is.</summary>
internal sealed class NearbyNebulaFixture
{
    public string Name { get; set; } = string.Empty;

    public string? System { get; set; }

    public double DistanceLy { get; set; }
}
