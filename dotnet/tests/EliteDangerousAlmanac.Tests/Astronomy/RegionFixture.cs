using System.Collections.Generic;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The whole of <c>fixtures/astro/hand-authored-regions.jsonc</c>.</summary>
internal sealed class HandAuthoredRegionsFixture
{
    public List<HandAuthoredSystemFixture> Systems { get; set; } = [];

    public List<RegionForCoordsFixture> RegionForCoords { get; set; } = [];
}

/// <summary>One system the game names after a region instead of its sector.</summary>
internal sealed class HandAuthoredSystemFixture
{
    /// <summary>Where the record comes from, in the fixture's own words.</summary>
    public string? Source { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Id64 { get; set; } = string.Empty;

    public CoordsFixture Coords { get; set; } = new();

    public string? ProceduralName { get; set; }

    public bool NeedsPermit { get; set; }
}

/// <summary>One place, and the region that holds it.</summary>
internal sealed class RegionForCoordsFixture
{
    public CoordsFixture Coords { get; set; } = new();

    public string? Region { get; set; }
}

/// <summary>One place in the galaxy, as a fixture states it.</summary>
internal sealed class CoordsFixture
{
    public double X { get; set; }

    public double Y { get; set; }

    public double Z { get; set; }
}

/// <summary>The whole of <c>fixtures/astro/permit-locks.jsonc</c>.</summary>
internal sealed class PermitLocksFixture
{
    public PermitLockCountsFixture Counts { get; set; } = new();

    public List<PermitLockCaseFixture> Cases { get; set; } = [];
}

/// <summary>How many locks of each kind the list holds.</summary>
internal sealed class PermitLockCountsFixture
{
    public int Systems { get; set; }

    public int Regions { get; set; }
}

/// <summary>One system name, and the permit it asks for.</summary>
internal sealed class PermitLockCaseFixture
{
    /// <summary>What the case is about, in the fixture's own words.</summary>
    public string? Comment { get; set; }

    public string Name { get; set; } = string.Empty;

    public PermitLockFixture? Lock { get; set; }

    public CoordsFixture? Coords { get; set; }
}

/// <summary>What one permit lock names.</summary>
internal sealed class PermitLockFixture
{
    public string Kind { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Id64 { get; set; }
}

/// <summary>The whole of <c>fixtures/astro/galactic-region.jsonc</c>.</summary>
internal sealed class GalacticRegionFixture
{
    public List<RegionCoordsCaseFixture> Coords { get; set; } = [];

    public List<RegionBoxelCaseFixture> Boxels { get; set; } = [];
}

/// <summary>One place on the plane, and the codex region there.</summary>
internal sealed class RegionCoordsCaseFixture
{
    public string Name { get; set; } = string.Empty;

    public double X { get; set; }

    public double Z { get; set; }

    public int RegionId { get; set; }

    public string Region { get; set; } = string.Empty;
}

/// <summary>One system address, its boxel corner, and the codex region there.</summary>
internal sealed class RegionBoxelCaseFixture
{
    public string Name { get; set; } = string.Empty;

    public string Id64 { get; set; } = string.Empty;

    public double X { get; set; }

    public double Y { get; set; }

    public double Z { get; set; }

    public int RegionId { get; set; }

    public string Region { get; set; } = string.Empty;
}
