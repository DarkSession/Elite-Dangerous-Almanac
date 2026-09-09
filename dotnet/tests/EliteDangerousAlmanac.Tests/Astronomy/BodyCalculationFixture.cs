using System.Collections.Generic;
using EliteDangerousAlmanac.Astronomy;

namespace EliteDangerousAlmanac.Tests.Astronomy;

/// <summary>The whole of <c>fixtures/astro/body-calculations.jsonc</c>.</summary>
internal sealed class BodyCalculationsFixture
{
    public List<DensityCaseFixture> BulkDensity { get; set; } = [];

    public List<OrbitExtentsCaseFixture> OrbitExtents { get; set; } = [];

    public List<EccentricityCaseFixture> EccentricityClass { get; set; } = [];

    public List<ResonanceCaseFixture> SpinOrbitResonance { get; set; } = [];

    public List<VelocityCaseFixture> EquatorialVelocity { get; set; } = [];

    public List<RocheCaseFixture> RocheLimits { get; set; } = [];

    public List<RocheDensityCaseFixture> RocheLimitsForDensity { get; set; } = [];

    public List<HillRadiusCaseFixture> HillRadius { get; set; } = [];

    public List<AngularDiameterCaseFixture> PrimaryAngularDiameter { get; set; } = [];

    public List<ParticleDensityCaseFixture> RingParticleDensity { get; set; } = [];

    public List<RingDensityCaseFixture> RingSurfaceDensity { get; set; } = [];

    public List<RingDynamicsCaseFixture> RingDynamics { get; set; } = [];

    public List<LifetimeCaseFixture> MainSequenceLifetime { get; set; } = [];

    public List<MagnitudeCaseFixture> AbsoluteBolometricMagnitude { get; set; } = [];

    public List<SchwarzschildCaseFixture> SchwarzschildRadius { get; set; } = [];

    public List<MassStabilityCaseFixture> MassStability { get; set; } = [];

    public List<NeutronStarCaseFixture> NeutronStarClass { get; set; } = [];
}

/// <summary>What one case is about, in the fixture's own words.</summary>
internal abstract class BodyCaseFixture
{
    public string Case { get; set; } = string.Empty;
}

/// <summary>One density case.</summary>
internal sealed class DensityCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public double? KgPerCubicMetre { get; set; }
}

/// <summary>One orbit-extents case.</summary>
internal sealed class OrbitExtentsCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public double? Periapsis { get; set; }

    public double? Apoapsis { get; set; }

    public string? EccentricityClass { get; set; }
}

/// <summary>One eccentricity-class case.</summary>
internal sealed class EccentricityCaseFixture
{
    public double Eccentricity { get; set; }

    public string Class { get; set; } = string.Empty;
}

/// <summary>One spin-orbit resonance case.</summary>
internal sealed class ResonanceCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public ResonanceFixture? Resonance { get; set; }
}

/// <summary>One whole-number ratio.</summary>
internal sealed class ResonanceFixture
{
    public int Rotations { get; set; }

    public int Orbits { get; set; }
}

/// <summary>One equatorial-velocity case.</summary>
internal sealed class VelocityCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public double? MetresPerSecond { get; set; }
}

/// <summary>One Roche-limit case between two bodies.</summary>
internal sealed class RocheCaseFixture : BodyCaseFixture
{
    public BodyProperties Satellite { get; set; } = new();

    public BodyProperties Primary { get; set; } = new();

    public double? Rigid { get; set; }

    public double? Fluid { get; set; }
}

/// <summary>One Roche-limit case at a stated density.</summary>
internal sealed class RocheDensityCaseFixture : BodyCaseFixture
{
    public BodyProperties Primary { get; set; } = new();

    public double SatelliteDensityKgM3 { get; set; }

    public double? Rigid { get; set; }

    public double? Fluid { get; set; }
}

/// <summary>One Hill-radius case.</summary>
internal sealed class HillRadiusCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public BodyProperties Primary { get; set; } = new();

    public double? Metres { get; set; }
}

/// <summary>One angular-diameter case.</summary>
internal sealed class AngularDiameterCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public BodyProperties Primary { get; set; } = new();

    public double? Degrees { get; set; }
}

/// <summary>One ring-particle-density case.</summary>
internal sealed class ParticleDensityCaseFixture
{
    public string RingClass { get; set; } = string.Empty;

    public double KgPerCubicMetre { get; set; }
}

/// <summary>One ring-surface-density case.</summary>
internal sealed class RingDensityCaseFixture : BodyCaseFixture
{
    public BodyRing Ring { get; set; } = new(string.Empty, string.Empty, 0, 0, 0);

    public double? MegatonnesPerSquareKilometre { get; set; }

    public bool Invisible { get; set; }
}

/// <summary>One ring-dynamics case.</summary>
internal sealed class RingDynamicsCaseFixture : BodyCaseFixture
{
    public BodyRing Ring { get; set; } = new(string.Empty, string.Empty, 0, 0, 0);

    public BodyProperties Primary { get; set; } = new();

    public double? OrbitalPeriod { get; set; }

    public double? NominalRadius { get; set; }

    public double? InnerVelocity { get; set; }

    public double? OuterVelocity { get; set; }
}

/// <summary>One main-sequence-lifetime case.</summary>
internal sealed class LifetimeCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public double? MillionYears { get; set; }
}

/// <summary>One bolometric-magnitude case.</summary>
internal sealed class MagnitudeCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public double? Magnitude { get; set; }
}

/// <summary>One Schwarzschild-radius case.</summary>
internal sealed class SchwarzschildCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public double? Metres { get; set; }
}

/// <summary>One mass-stability case.</summary>
internal sealed class MassStabilityCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public MassStabilityFixture? Assessment { get; set; }
}

/// <summary>One mass limit a star has passed.</summary>
internal sealed class MassStabilityFixture
{
    public string Limit { get; set; } = string.Empty;

    public double LimitSolarMasses { get; set; }

    public string Severity { get; set; } = string.Empty;
}

/// <summary>One neutron-star classification case.</summary>
internal sealed class NeutronStarCaseFixture : BodyCaseFixture
{
    public BodyProperties Body { get; set; } = new();

    public string? Class { get; set; }
}
