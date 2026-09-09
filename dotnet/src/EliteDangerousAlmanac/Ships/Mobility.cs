using System;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One post-engineering thruster performance curve.</summary>
/// <param name="MinMass">The loaded mass at which performance reaches the maximum multiplier, in tonnes.</param>
/// <param name="OptMass">The loaded mass at which performance is exactly the optimal multiplier, in tonnes.</param>
/// <param name="MaxMass">The largest loaded mass the thrusters can move, in tonnes.</param>
/// <param name="MinMultiplier">The performance multiplier at the maximum mass.</param>
/// <param name="OptMultiplier">The performance multiplier at the optimal mass.</param>
/// <param name="MaxMultiplier">The performance multiplier at the minimum mass.</param>
/// <remarks>
/// Every value must be finite and zero or more, and the masses and the multipliers must follow the
/// order <see cref="IMassCurve"/> documents.
/// </remarks>
public record ThrusterCurveParams(
    double MinMass,
    double OptMass,
    double MaxMass,
    double MinMultiplier,
    double OptMultiplier,
    double MaxMultiplier) : IMassCurve;

/// <summary>A fitted thruster's post-engineering mass curves.</summary>
/// <param name="MinMass">The loaded mass at which performance reaches the maximum multiplier, in tonnes.</param>
/// <param name="OptMass">The loaded mass at which performance is exactly the optimal multiplier, in tonnes.</param>
/// <param name="MaxMass">The largest loaded mass the thrusters can move, in tonnes.</param>
/// <param name="MinMultiplier">The performance multiplier at the maximum mass.</param>
/// <param name="OptMultiplier">The performance multiplier at the optimal mass.</param>
/// <param name="MaxMultiplier">The performance multiplier at the minimum mass.</param>
/// <remarks>
/// Enhanced performance thrusters answer speed and handling on two different curves. A thruster
/// that carries neither <see cref="SpeedCurve"/> nor <see cref="RotationCurve"/> uses its own
/// values for both.
/// </remarks>
public sealed record ThrusterParams(
    double MinMass,
    double OptMass,
    double MaxMass,
    double MinMultiplier,
    double OptMultiplier,
    double MaxMultiplier)
    : ThrusterCurveParams(MinMass, OptMass, MaxMass, MinMultiplier, OptMultiplier, MaxMultiplier)
{
    /// <summary>The speed and boost curve, where it differs from the handling curve.</summary>
    public ThrusterCurveParams? SpeedCurve { get; init; }

    /// <summary>The pitch, roll and yaw curve, where it differs from the speed curve.</summary>
    public ThrusterCurveParams? RotationCurve { get; init; }
}

/// <summary>Everything a mobility calculation needs about one loaded ship.</summary>
/// <param name="MinimumSpeed">The hull's speed at multiplier one and no ENG pips, in metres per second.</param>
/// <param name="MaximumSpeed">The hull's speed at multiplier one and four ENG pips, in metres per second.</param>
/// <param name="Boost">The hull's boost speed at multiplier one, in metres per second.</param>
/// <param name="MinPitch">The hull's pitch rate at no ENG pips, in degrees per second.</param>
/// <param name="Pitch">The hull's pitch rate at four ENG pips, in degrees per second.</param>
/// <param name="MinRoll">The hull's roll rate at no ENG pips, in degrees per second.</param>
/// <param name="Roll">The hull's roll rate at four ENG pips, in degrees per second.</param>
/// <param name="MinYaw">The hull's yaw rate at no ENG pips, in degrees per second.</param>
/// <param name="Yaw">The hull's yaw rate at four ENG pips, in degrees per second.</param>
/// <param name="Mass">The loaded mass, in tonnes: hull, modules, fuel and cargo.</param>
/// <remarks>
/// Every figure must be finite and zero or more. The minimum speed must not be above the maximum
/// speed, and each zero-pip rotation rate must run from zero through its four-pip counterpart.
/// </remarks>
public sealed record MobilityInput(
    double MinimumSpeed,
    double MaximumSpeed,
    double Boost,
    double MinPitch,
    double Pitch,
    double MinRoll,
    double Roll,
    double MinYaw,
    double Yaw,
    double Mass)
{
    /// <summary>The fitted thrusters' post-engineering curve, or <see langword="null"/> for none.</summary>
    public ThrusterParams? Thrusters { get; init; }
}

/// <summary>Speed and rotation rates for one loaded ship, at full ENG.</summary>
/// <param name="LoadedMass">The loaded mass the figures were calculated at, in tonnes.</param>
/// <param name="Speed">The top speed at this mass and four ENG pips, in metres per second.</param>
/// <param name="Boost">The boost speed at this mass, in metres per second.</param>
/// <param name="Pitch">The pitch rate at this mass and four ENG pips, in degrees per second.</param>
/// <param name="Roll">The roll rate at this mass and four ENG pips, in degrees per second.</param>
/// <param name="Yaw">The yaw rate at this mass and four ENG pips, in degrees per second.</param>
/// <param name="MassCurveMultiplier">The speed curve's multiplier at this loaded mass.</param>
/// <param name="RotationMassCurveMultiplier">
/// The rotation curve's multiplier, which differs for enhanced performance thrusters.
/// </param>
/// <remarks>
/// The loaded mass is reported so a caller that never states the mass itself can read what the
/// curve was evaluated at. Against the fitted curve's optimal and maximum masses it is the build's
/// position on that curve.
/// </remarks>
public sealed record MobilityMetrics(
    double LoadedMass,
    double Speed,
    double Boost,
    double Pitch,
    double Roll,
    double Yaw,
    double MassCurveMultiplier,
    double RotationMassCurveMultiplier);

/// <summary>
/// The data-free speed and handling arithmetic for a loaded ship, at full ENG. The figures are the
/// hull's four-pip endpoints with the fitted thruster mass curves applied.
/// </summary>
/// <remarks>
/// <para>
/// The ENG capacitor is a separate story with its own entry point,
/// <see cref="MobilityCapacitor"/>, which interpolates the hull's zero-pip endpoints towards the
/// four-pip ones before the same curves are applied.
/// </para>
/// <para>
/// Ported from EDCD/Coriolis and cross-checked against EDSY's mass-curve calculation. See
/// <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class Mobility
{
    /// <summary>Resolves a thruster's performance multiplier at a loaded mass.</summary>
    /// <param name="mass">The loaded mass, in tonnes.</param>
    /// <param name="thrusters">The fitted thruster curve, post-engineering.</param>
    /// <returns>
    /// The curve multiplier, and zero above the thrusters' maximum supported mass.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="thrusters"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The mass or a curve value is not finite and zero or more, or the curve masses or
    /// multipliers are not in the order <see cref="IMassCurve"/> documents.
    /// </exception>
    public static double ThrusterMassCurveMultiplier(double mass, ThrusterCurveParams thrusters) =>
        MassCurve.MultiplierAt(mass, thrusters, nameof(mass), nameof(thrusters));

    /// <summary>Calculates a loaded ship's top speed, boost speed and rotation rates at full ENG.</summary>
    /// <param name="input">The hull figures, the loaded mass and the fitted thrusters.</param>
    /// <returns>
    /// The build's metrics, or <see langword="null"/> when no thrusters are fitted. A mass above
    /// the thrusters' maximum answers zero performance rather than a fabricated curve value.
    /// </returns>
    /// <remarks>
    /// <para>
    /// Speed, pitch, roll and yaw are the hull's four-pip endpoints with the fitted thruster's
    /// speed and rotation mass-curve multipliers applied. Boost is independent of the ENG
    /// allocation and uses the speed curve at the loaded mass, so it is the same figure whatever
    /// the pips.
    /// </para>
    /// <para>
    /// A lower allocation is <see cref="MobilityCapacitor.Metrics"/>. It interpolates each figure
    /// from the hull's zero-pip endpoint towards the endpoint used here, and applies the same
    /// curves.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An input is not finite or is outside its documented range, or a thruster curve is not in
    /// the order <see cref="IMassCurve"/> documents.
    /// </exception>
    public static MobilityMetrics? Metrics(MobilityInput input)
    {
        MobilityCurves? curves = MobilityCore.Resolve(input);
        if (curves is null) return null;

        return new MobilityMetrics(
            LoadedMass: input.Mass,
            Speed: input.MaximumSpeed * curves.MassCurveMultiplier,
            Boost: input.Boost * curves.MassCurveMultiplier,
            Pitch: input.Pitch * curves.RotationMassCurveMultiplier,
            Roll: input.Roll * curves.RotationMassCurveMultiplier,
            Yaw: input.Yaw * curves.RotationMassCurveMultiplier,
            MassCurveMultiplier: curves.MassCurveMultiplier,
            RotationMassCurveMultiplier: curves.RotationMassCurveMultiplier);
    }
}
