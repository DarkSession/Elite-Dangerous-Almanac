using System;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The two thruster multipliers a loaded build sits at.</summary>
/// <param name="MassCurveMultiplier">The speed curve's multiplier at the loaded mass.</param>
/// <param name="RotationMassCurveMultiplier">
/// The rotation curve's multiplier, which differs for enhanced performance thrusters.
/// </param>
internal sealed record MobilityCurves(double MassCurveMultiplier, double RotationMassCurveMultiplier);

/// <summary>
/// The checks and the thruster mass curves shared by <see cref="Mobility"/> and
/// <see cref="MobilityCapacitor"/>.
/// </summary>
/// <remarks>
/// Both entry points read the same hull endpoints, the same loaded mass and the same fitted curve.
/// Only what they do with the ENG allocation differs. The rules are written once here, because a
/// rule written twice is a rule free to drift.
/// </remarks>
internal static class MobilityCore
{
    /// <summary>Checks one mobility input and resolves the thrusters' two multipliers at its mass.</summary>
    /// <param name="input">The hull figures, the loaded mass and the fitted thruster curve.</param>
    /// <returns>
    /// The two multipliers, or <see langword="null"/> when no thrusters are fitted. Every hull
    /// figure is checked first, so a build with no thrusters still reports a bad one.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An input is not finite or is outside its documented range, or a thruster curve is not in
    /// the documented order.
    /// </exception>
    internal static MobilityCurves? Resolve(MobilityInput input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));

        RangeGuards.RequireFiniteNonNegative(input.MinimumSpeed, "input.MinimumSpeed");
        RangeGuards.RequireFiniteNonNegative(input.MaximumSpeed, "input.MaximumSpeed");
        RangeGuards.RequireFiniteNonNegative(input.Boost, "input.Boost");
        RangeGuards.RequireFiniteNonNegative(input.Pitch, "input.Pitch");
        RangeGuards.RequireFiniteNonNegative(input.Roll, "input.Roll");
        RangeGuards.RequireFiniteNonNegative(input.Yaw, "input.Yaw");
        RangeGuards.RequireFiniteNonNegative(input.Mass, "input.Mass");

        if (input.MinimumSpeed > input.MaximumSpeed)
        {
            throw new ArgumentOutOfRangeException(
                "input.MinimumSpeed",
                input.MinimumSpeed,
                "The minimum speed must not be above the maximum speed.");
        }

        RequireFiniteRange(input.MinPitch, "input.MinPitch", input.Pitch, "the pitch rate");
        RequireFiniteRange(input.MinRoll, "input.MinRoll", input.Roll, "the roll rate");
        RequireFiniteRange(input.MinYaw, "input.MinYaw", input.Yaw, "the yaw rate");

        ThrusterParams? thrusters = input.Thrusters;
        if (thrusters is null) return null;

        MassCurve.Validate(thrusters, "input.Thrusters");
        return new MobilityCurves(
            MassCurve.MultiplierAt(
                input.Mass, thrusters.SpeedCurve ?? thrusters, "input.Mass", "input.Thrusters.SpeedCurve"),
            MassCurve.MultiplierAt(
                input.Mass, thrusters.RotationCurve ?? thrusters, "input.Mass", "input.Thrusters.RotationCurve"));
    }

    private static void RequireFiniteRange(double value, string name, double maximum, string what)
    {
        if (double.IsNaN(value) || double.IsInfinity(value) || value < 0 || value > maximum)
        {
            throw new ArgumentOutOfRangeException(
                name, value, $"The value must be a finite number from 0 through {what} at four ENG pips.");
        }
    }
}
