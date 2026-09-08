using System;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Speed and rotation rates at one ENG-pip allocation.</summary>
/// <param name="EnginesPips">The pips assigned to ENG for this result, from zero through four.</param>
/// <param name="Speed">The top speed at this mass and allocation, in metres per second.</param>
/// <param name="Pitch">The pitch rate at this mass and allocation, in degrees per second.</param>
/// <param name="Roll">The roll rate at this mass and allocation, in degrees per second.</param>
/// <param name="Yaw">The yaw rate at this mass and allocation, in degrees per second.</param>
public sealed record MobilityCapacitorMetrics(
    double EnginesPips,
    double Speed,
    double Pitch,
    double Roll,
    double Yaw);

/// <summary>The ENG capacitor: speed and handling at a chosen ENG-pip allocation.</summary>
/// <remarks>
/// <para>
/// A hull publishes two endpoints for each of speed, pitch, roll and yaw: the figure at no ENG
/// pips and the figure at four. The allocation interpolates linearly between them, and the fitted
/// thruster's mass curves are applied to the result.
/// </para>
/// <para>
/// Boost does not move with the pips, so it is not reported here. It is on
/// <see cref="MobilityMetrics.Boost"/>, along with the loaded mass and the two curve multipliers
/// these figures share.
/// </para>
/// <para>
/// Reference implementations: EDCD/Coriolis and EDSY. The algorithm is ported as fact rather than
/// as code. See <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class MobilityCapacitor
{
    /// <summary>Calculates a loaded ship's speed and rotation rates at one ENG-pip allocation.</summary>
    /// <param name="input">
    /// The same hull figures, loaded mass and fitted thrusters <see cref="Mobility.Metrics"/>
    /// takes.
    /// </param>
    /// <param name="enginesPips">
    /// The pips assigned to ENG, from zero through four. Fractional pips are accepted, because the
    /// game's own curve is continuous.
    /// </param>
    /// <returns>
    /// The metrics, or <see langword="null"/> when no thrusters are fitted. A mass above the
    /// thrusters' maximum answers zero performance rather than a fabricated curve value. At four
    /// pips every figure equals its <see cref="MobilityMetrics"/> counterpart.
    /// </returns>
    /// <remarks>
    /// The pips are checked before the hull figures, so a bad allocation is reported first.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The allocation is outside zero through four, an input is not finite or is outside its
    /// documented range, or a thruster curve is not in the order <see cref="IMassCurve"/>
    /// documents.
    /// </exception>
    public static MobilityCapacitorMetrics? Metrics(MobilityInput input, double enginesPips = 4)
    {
        // Checked before the hull, so a build with no thrusters still reports a bad allocation.
        RangeGuards.RequirePips(enginesPips, nameof(enginesPips));
        MobilityCurves? curves = MobilityCore.Resolve(input);
        if (curves is null) return null;

        double pipMultiplier = enginesPips / 4;
        double AtPips(double maximum, double minimum) => minimum + ((maximum - minimum) * pipMultiplier);

        return new MobilityCapacitorMetrics(
            EnginesPips: enginesPips,
            Speed: AtPips(input.MaximumSpeed, input.MinimumSpeed) * curves.MassCurveMultiplier,
            Pitch: AtPips(input.Pitch, input.MinPitch) * curves.RotationMassCurveMultiplier,
            Roll: AtPips(input.Roll, input.MinRoll) * curves.RotationMassCurveMultiplier,
            Yaw: AtPips(input.Yaw, input.MinYaw) * curves.RotationMassCurveMultiplier);
    }
}
