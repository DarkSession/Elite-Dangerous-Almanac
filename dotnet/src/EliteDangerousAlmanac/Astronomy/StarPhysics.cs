using System;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>The mass limit a star has passed.</summary>
public enum MassStabilityLimit
{
    /// <summary>The mass above which a white dwarf cannot hold itself up.</summary>
    Chandrasekhar,

    /// <summary>The mass above which a neutron star is expected to collapse.</summary>
    TolmanOppenheimerVolkoff,

    /// <summary>The mass above which the game states no neutron star at all.</summary>
    NeutronStarMassDropOff,
}

/// <summary>How far past a mass limit a star sits.</summary>
public enum MassStabilitySeverity
{
    /// <summary>The star is past a limit theory expects it to keep to.</summary>
    Warning,

    /// <summary>The star is past a limit no such star should reach.</summary>
    Danger,
}

/// <summary>A star that weighs more than its class should allow.</summary>
/// <param name="Limit">The limit the star has passed.</param>
/// <param name="LimitSolarMasses">The limit itself, in solar masses.</param>
/// <param name="Severity">How far past the limit the star sits.</param>
public sealed record MassStabilityAssessment(
    MassStabilityLimit Limit,
    double LimitSolarMasses,
    MassStabilitySeverity Severity);

/// <summary>What kind of neutron star one scan describes.</summary>
/// <remarks>
/// The class follows the rotation period, and the heavier ones are set apart by mass. An
/// ultra-long-period star is told from a magnetar by its absolute magnitude.
/// </remarks>
public enum NeutronStarClass
{
    /// <summary>A pulsar turning faster than a hundred times a second.</summary>
    MillisecondPulsar,

    /// <summary>A millisecond pulsar heavier than any such star should be.</summary>
    HyperMassiveMillisecondPulsar,

    /// <summary>A pulsar turning within five seconds.</summary>
    StandardPulsar,

    /// <summary>A standard pulsar heavier than any such star should be.</summary>
    AnomalousMassPulsar,

    /// <summary>A pulsar turning within thirty seconds.</summary>
    SlowPeriodPulsar,

    /// <summary>A slow-period pulsar heavier than any such star should be.</summary>
    AnomalousMassSlowPeriodPulsar,

    /// <summary>A star turning within the hour, and bright enough to be a magnetar.</summary>
    UltraLongPeriodMagnetar,

    /// <summary>A star turning within the hour.</summary>
    UltraLongPeriodPulsar,

    /// <summary>A star that takes more than an hour to turn once.</summary>
    AnomalousSlowRotator,
}

/// <summary>What a scanned star burns, weighs and turns at.</summary>
/// <remarks>
/// Every calculation reads the figures the scan states, and answers <see langword="null"/>
/// where the star states none it can use.
/// </remarks>
public static class StarPhysics
{
    /// <summary>The speed of light, in metres a second.</summary>
    public const double SpeedOfLight = 299_792_458;

    /// <summary>The Sun's radius, in metres.</summary>
    public const double SolarRadius = 695_700_000;

    /// <summary>The mass above which a white dwarf cannot hold itself up, in solar masses.</summary>
    public const double ChandrasekharLimitSolarMasses = 1.44;

    /// <summary>The mass above which a neutron star is expected to collapse, in solar masses.</summary>
    public const double TovLimitSolarMasses = 2.17;

    /// <summary>The mass above which the game states no neutron star, in solar masses.</summary>
    public const double NeutronStarMassDropOffSolarMasses = 2.51;

    private const double SolarEffectiveTemperature = 5772;
    private const double SolarAbsoluteBolometricMagnitude = 4.74;
    private const double SolarMainSequenceLifetimeMY = 10_000;

    private const double MillisecondPulsarPeriod = 0.01;
    private const double StandardPulsarPeriod = 5;
    private const double SlowPeriodPulsarPeriod = 30;
    private const double UltraLongPeriodLimit = 3600;
    private const double MagnetarMaxAbsoluteMagnitude = 10;
    private const double AnomalousPulsarMass = 2.1;

    /// <summary>How long a star burns on the main sequence, in millions of years.</summary>
    /// <param name="body">The star, as a scan states it.</param>
    /// <returns>
    /// The lifetime, or <see langword="null"/> where the star states no mass.
    /// </returns>
    /// <exception cref="ArgumentNullException">The star is absent.</exception>
    public static double? MainSequenceLifetime(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));
        return BodyQuantities.Positive(body.StellarMass) is double solarMasses
            ? SolarMainSequenceLifetimeMY * Math.Pow(solarMasses, -2.5)
            : null;
    }

    /// <summary>How bright a star is across every wavelength.</summary>
    /// <param name="body">The star, as a scan states it.</param>
    /// <returns>
    /// The magnitude, or <see langword="null"/> where the star states no radius or no
    /// temperature.
    /// </returns>
    /// <exception cref="ArgumentNullException">The star is absent.</exception>
    /// <remarks>
    /// This is the whole output rather than the visible part, so it differs from the
    /// absolute magnitude the scan itself states.
    /// </remarks>
    public static double? AbsoluteBolometricMagnitude(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));

        double? radiusM = BodyQuantities.Positive(body.Radius);
        double? temperatureK = BodyQuantities.Positive(body.SurfaceTemperature);
        if (radiusM is not double radius || temperatureK is not double temperature) return null;

        double solarRadii = radius / SolarRadius;
        double luminosity = solarRadii * solarRadii
            * Math.Pow(temperature / SolarEffectiveTemperature, 4);
        return SolarAbsoluteBolometricMagnitude - (2.5 * Math.Log10(luminosity));
    }

    /// <summary>How small a body must be squeezed to become a black hole, in metres.</summary>
    /// <param name="body">The body, as a scan states it.</param>
    /// <returns>The radius, or <see langword="null"/> where the body states no mass.</returns>
    /// <exception cref="ArgumentNullException">The body is absent.</exception>
    public static double? SchwarzschildRadius(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));
        return BodyPhysics.Mass(body) is double massKg
            ? 2 * BodyPhysics.GravitationalConstant * massKg / (SpeedOfLight * SpeedOfLight)
            : null;
    }

    /// <summary>Whether a star weighs more than its class should allow.</summary>
    /// <param name="body">The star, as a scan states it.</param>
    /// <returns>
    /// The limit it has passed, or <see langword="null"/> where it has passed none, or the
    /// star states no mass or no class.
    /// </returns>
    /// <exception cref="ArgumentNullException">The star is absent.</exception>
    public static MassStabilityAssessment? AssessMassStability(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));

        double? mass = BodyQuantities.Positive(body.StellarMass);
        if (mass is not double solarMasses || body.StarType is not string starType) return null;

        // "H" is a black hole and "N" a neutron star; every other class beginning with "D"
        // is a white dwarf.
        if (starType.Length > 0 && starType[0] == 'D'
            && solarMasses > ChandrasekharLimitSolarMasses)
        {
            return new MassStabilityAssessment(
                MassStabilityLimit.Chandrasekhar,
                ChandrasekharLimitSolarMasses,
                MassStabilitySeverity.Danger);
        }

        if (!string.Equals(starType, "N", StringComparison.Ordinal)) return null;

        if (solarMasses > NeutronStarMassDropOffSolarMasses)
        {
            return new MassStabilityAssessment(
                MassStabilityLimit.NeutronStarMassDropOff,
                NeutronStarMassDropOffSolarMasses,
                MassStabilitySeverity.Danger);
        }

        return solarMasses > TovLimitSolarMasses
            ? new MassStabilityAssessment(
                MassStabilityLimit.TolmanOppenheimerVolkoff,
                TovLimitSolarMasses,
                MassStabilitySeverity.Warning)
            : null;
    }

    /// <summary>What kind of neutron star a scan describes.</summary>
    /// <param name="body">The star, as a scan states it.</param>
    /// <returns>
    /// The class, or <see langword="null"/> where the star states no mass, no rotation
    /// period or no absolute magnitude.
    /// </returns>
    /// <exception cref="ArgumentNullException">The star is absent.</exception>
    /// <remarks>
    /// The rotation period is read without its sign, because a star that turns the other
    /// way turns just as fast.
    /// </remarks>
    public static NeutronStarClass? ClassifyNeutronStar(BodyProperties body)
    {
        if (body is null) throw new ArgumentNullException(nameof(body));

        double? mass = BodyQuantities.Positive(body.StellarMass);
        double? rotation = BodyQuantities.Finite(body.RotationPeriod);
        double? magnitude = BodyQuantities.Finite(body.AbsoluteMagnitude);
        if (mass is not double solarMasses
            || rotation is not double rotationPeriod
            || magnitude is not double absoluteMagnitude)
        {
            return null;
        }

        double period = Math.Abs(rotationPeriod);
        bool heavy = solarMasses > AnomalousPulsarMass;

        if (period < MillisecondPulsarPeriod)
        {
            return heavy
                ? NeutronStarClass.HyperMassiveMillisecondPulsar
                : NeutronStarClass.MillisecondPulsar;
        }

        if (period < StandardPulsarPeriod)
        {
            return heavy ? NeutronStarClass.AnomalousMassPulsar : NeutronStarClass.StandardPulsar;
        }

        if (period < SlowPeriodPulsarPeriod)
        {
            return heavy
                ? NeutronStarClass.AnomalousMassSlowPeriodPulsar
                : NeutronStarClass.SlowPeriodPulsar;
        }

        if (period < UltraLongPeriodLimit)
        {
            return absoluteMagnitude < MagnetarMaxAbsoluteMagnitude
                ? NeutronStarClass.UltraLongPeriodMagnetar
                : NeutronStarClass.UltraLongPeriodPulsar;
        }

        return NeutronStarClass.AnomalousSlowRotator;
    }
}
