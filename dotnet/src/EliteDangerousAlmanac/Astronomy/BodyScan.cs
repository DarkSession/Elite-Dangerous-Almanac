using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>The body one scanned body orbits, as the journal names it.</summary>
/// <remarks>
/// A scan states the chain from the body outwards, nearest parent first. Exactly one field
/// of each entry carries a body identifier; the rest are absent.
/// </remarks>
/// <param name="Star">The identifier of a star the body orbits.</param>
/// <param name="Planet">The identifier of a planet the body orbits.</param>
/// <param name="Ring">The identifier of a ring the body orbits within.</param>
/// <param name="Null">
/// The identifier of a barycentre, which is the point two bodies orbit rather than a body.
/// </param>
public sealed record BodyParent(
    [property: JsonPropertyName("Star")] int? Star = null,
    [property: JsonPropertyName("Planet")] int? Planet = null,
    [property: JsonPropertyName("Ring")] int? Ring = null,
    [property: JsonPropertyName("Null")] int? Null = null);

/// <summary>One ring around a scanned body.</summary>
/// <param name="Name">The ring's own name, such as <c>Sol 5 A Ring</c>.</param>
/// <param name="RingClass">
/// The ring's class, such as <c>eRingClass_Icy</c>, which decides what its particles are.
/// </param>
/// <param name="MassMT">The ring's mass in megatonnes.</param>
/// <param name="InnerRad">The inner radius in metres.</param>
/// <param name="OuterRad">The outer radius in metres.</param>
public sealed record BodyRing(
    [property: JsonPropertyName("Name")] string Name,
    [property: JsonPropertyName("RingClass")] string RingClass,
    [property: JsonPropertyName("MassMT")] double MassMT,
    [property: JsonPropertyName("InnerRad")] double InnerRad,
    [property: JsonPropertyName("OuterRad")] double OuterRad);

/// <summary>One gas in a body's atmosphere.</summary>
/// <param name="Name">The gas, such as <c>Nitrogen</c>.</param>
/// <param name="Percent">The share of the atmosphere, as a percentage.</param>
public sealed record AtmosphereComponent(
    [property: JsonPropertyName("Name")] string Name,
    [property: JsonPropertyName("Percent")] double Percent);

/// <summary>One material a landable body's surface carries.</summary>
/// <param name="Name">The material symbol, such as <c>iron</c>.</param>
/// <param name="Percent">The share of the surface, as a percentage.</param>
/// <param name="NameLocalised">The material's display name in the player's language.</param>
public sealed record SurfaceMaterial(
    [property: JsonPropertyName("Name")] string Name,
    [property: JsonPropertyName("Percent")] double Percent,
    [property: JsonPropertyName("Name_Localised")] string? NameLocalised = null);

/// <summary>What a body is made of, by share.</summary>
/// <param name="Ice">The ice share, from zero through one.</param>
/// <param name="Rock">The rock share, from zero through one.</param>
/// <param name="Metal">The metal share, from zero through one.</param>
public sealed record BodyComposition(
    [property: JsonPropertyName("Ice")] double Ice,
    [property: JsonPropertyName("Rock")] double Rock,
    [property: JsonPropertyName("Metal")] double Metal);

/// <summary>Everything a scan states about one body.</summary>
/// <remarks>
/// <para>
/// A field the scan did not state is absent rather than zero. A star states its stellar
/// mass and its class, a planet states its Earth masses and its planet class, and both
/// state a radius and a surface temperature. Every calculation over a body answers
/// <see langword="null"/> where the body states nothing it can read.
/// </para>
/// <para>
/// The property names are the journal's own, so a caller passes an event straight in.
/// </para>
/// </remarks>
public record BodyProperties
{
    /// <summary>The orbit's semi-major axis in metres.</summary>
    [JsonPropertyName("SemiMajorAxis")]
    public double? SemiMajorAxis { get; init; }

    /// <summary>The orbit's eccentricity: zero is a circle.</summary>
    [JsonPropertyName("Eccentricity")]
    public double? Eccentricity { get; init; }

    /// <summary>The orbit's inclination in degrees.</summary>
    [JsonPropertyName("OrbitalInclination")]
    public double? OrbitalInclination { get; init; }

    /// <summary>The argument of periapsis in degrees.</summary>
    [JsonPropertyName("Periapsis")]
    public double? Periapsis { get; init; }

    /// <summary>The orbital period in seconds.</summary>
    [JsonPropertyName("OrbitalPeriod")]
    public double? OrbitalPeriod { get; init; }

    /// <summary>The longitude of the ascending node in degrees.</summary>
    [JsonPropertyName("AscendingNode")]
    public double? AscendingNode { get; init; }

    /// <summary>The mean anomaly in degrees.</summary>
    [JsonPropertyName("MeanAnomaly")]
    public double? MeanAnomaly { get; init; }

    /// <summary>
    /// The rotation period in seconds. A negative figure is a body that turns the other way.
    /// </summary>
    [JsonPropertyName("RotationPeriod")]
    public double? RotationPeriod { get; init; }

    /// <summary>The axial tilt in radians.</summary>
    [JsonPropertyName("AxialTilt")]
    public double? AxialTilt { get; init; }

    /// <summary>Whether the body keeps one face towards what it orbits.</summary>
    [JsonPropertyName("TidalLock")]
    public bool? TidalLock { get; init; }

    /// <summary>The star's class, such as <c>G</c>, <c>N</c> for a neutron star or <c>H</c> for a black hole.</summary>
    [JsonPropertyName("StarType")]
    public string? StarType { get; init; }

    /// <summary>The star's subclass, from zero through nine.</summary>
    [JsonPropertyName("Subclass")]
    public int? Subclass { get; init; }

    /// <summary>The star's mass in solar masses.</summary>
    [JsonPropertyName("StellarMass")]
    public double? StellarMass { get; init; }

    /// <summary>The star's absolute magnitude.</summary>
    [JsonPropertyName("AbsoluteMagnitude")]
    public double? AbsoluteMagnitude { get; init; }

    /// <summary>The star's age in millions of years.</summary>
    [JsonPropertyName("Age_MY")]
    public double? AgeMY { get; init; }

    /// <summary>The star's luminosity class, such as <c>V</c>.</summary>
    [JsonPropertyName("Luminosity")]
    public string? Luminosity { get; init; }

    /// <summary>The planet's class, such as <c>High metal content body</c>.</summary>
    [JsonPropertyName("PlanetClass")]
    public string? PlanetClass { get; init; }

    /// <summary>Whether the planet can be terraformed, and whether it already is.</summary>
    [JsonPropertyName("TerraformState")]
    public string? TerraformState { get; init; }

    /// <summary>The atmosphere in the game's own words.</summary>
    [JsonPropertyName("Atmosphere")]
    public string? Atmosphere { get; init; }

    /// <summary>The atmosphere's type, such as <c>CarbonDioxide</c>.</summary>
    [JsonPropertyName("AtmosphereType")]
    public string? AtmosphereType { get; init; }

    /// <summary>The gases the atmosphere holds, by share.</summary>
    [JsonPropertyName("AtmosphereComposition")]
    public IReadOnlyList<AtmosphereComponent>? AtmosphereComposition { get; init; }

    /// <summary>The volcanism in the game's own words.</summary>
    [JsonPropertyName("Volcanism")]
    public string? Volcanism { get; init; }

    /// <summary>The planet's mass in Earth masses.</summary>
    [JsonPropertyName("MassEM")]
    public double? MassEM { get; init; }

    /// <summary>The surface gravity in metres a second squared.</summary>
    [JsonPropertyName("SurfaceGravity")]
    public double? SurfaceGravity { get; init; }

    /// <summary>The surface pressure in pascals.</summary>
    [JsonPropertyName("SurfacePressure")]
    public double? SurfacePressure { get; init; }

    /// <summary>Whether a ship can land on the body.</summary>
    [JsonPropertyName("Landable")]
    public bool? Landable { get; init; }

    /// <summary>What the body is made of, by share.</summary>
    [JsonPropertyName("Composition")]
    public BodyComposition? Composition { get; init; }

    /// <summary>The materials a landable surface carries.</summary>
    [JsonPropertyName("Materials")]
    public IReadOnlyList<SurfaceMaterial>? Materials { get; init; }

    /// <summary>The body's radius in metres.</summary>
    [JsonPropertyName("Radius")]
    public double? Radius { get; init; }

    /// <summary>The surface temperature in kelvin.</summary>
    [JsonPropertyName("SurfaceTemperature")]
    public double? SurfaceTemperature { get; init; }

    /// <summary>The rings around the body.</summary>
    [JsonPropertyName("Rings")]
    public IReadOnlyList<BodyRing>? Rings { get; init; }

    /// <summary>How much a ring holds to mine, in the game's own words.</summary>
    [JsonPropertyName("ReserveLevel")]
    public string? ReserveLevel { get; init; }
}

/// <summary>One <c>Scan</c> line as the player journal writes it.</summary>
/// <remarks>
/// It states everything <see cref="BodyProperties"/> carries, and names the body and the
/// system it belongs to besides.
/// </remarks>
public sealed record BodyScanEvent : BodyProperties
{
    /// <summary>The kind of scan, such as <c>Detailed</c>.</summary>
    [JsonPropertyName("ScanType")]
    public string ScanType { get; init; } = string.Empty;

    /// <summary>The body's own name, such as <c>Sol 5 a</c>.</summary>
    [JsonPropertyName("BodyName")]
    public string BodyName { get; init; } = string.Empty;

    /// <summary>The body's identifier within its system.</summary>
    [JsonPropertyName("BodyID")]
    public int BodyId { get; init; }

    /// <summary>The system's own name.</summary>
    [JsonPropertyName("StarSystem")]
    public string StarSystem { get; init; } = string.Empty;

    /// <summary>The system's address.</summary>
    [JsonPropertyName("SystemAddress")]
    public ulong SystemAddress { get; init; }

    /// <summary>The distance from the arrival star, in light seconds.</summary>
    [JsonPropertyName("DistanceFromArrivalLS")]
    public double DistanceFromArrivalLS { get; init; }

    /// <summary>The chain from the body outwards, nearest parent first.</summary>
    [JsonPropertyName("Parents")]
    public IReadOnlyList<BodyParent>? Parents { get; init; }

    /// <summary>Whether another Commander had already discovered the body.</summary>
    [JsonPropertyName("WasDiscovered")]
    public bool WasDiscovered { get; init; }

    /// <summary>Whether another Commander had already mapped the body.</summary>
    [JsonPropertyName("WasMapped")]
    public bool WasMapped { get; init; }

    /// <summary>Whether another Commander had already walked on the body.</summary>
    [JsonPropertyName("WasFootfalled")]
    public bool? WasFootfalled { get; init; }
}
