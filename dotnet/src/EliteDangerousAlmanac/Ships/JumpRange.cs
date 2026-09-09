using System;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The frame shift drive constants a jump calculation needs, all post-engineering.</summary>
/// <param name="OptMass">The optimised mass, in tonnes. It must be finite and above zero.</param>
/// <param name="MaxFuel">
/// The most fuel drawn for a single jump, in tonnes. It must be finite and zero or more.
/// </param>
/// <param name="FuelMul">The drive's linear fuel constant, which must be finite and above zero.</param>
/// <param name="FuelPower">The drive's power fuel constant, which must be finite and above zero.</param>
/// <param name="JumpBoost">
/// The flat bonus a Guardian frame shift drive booster adds to every jump, in light-years.
/// </param>
/// <remarks>
/// Engineering changes the optimised mass and the maximum fuel; the two fuel constants are
/// intrinsic to the drive and never modified. Read them off the drive's outfitting record.
/// </remarks>
public sealed record FrameShiftDriveParams(
    double OptMass,
    double MaxFuel,
    double FuelMul,
    double FuelPower,
    double JumpBoost = 0);

/// <summary>A multi-jump tank range and the number of jumps that produce it.</summary>
/// <param name="Range">The sum of the successive jumps as the tank drains, in light-years.</param>
/// <param name="Jumps">The jumps made before the available fuel is exhausted.</param>
public sealed record TotalRangeDetails(double Range, int Jumps);

/// <summary>
/// The frame shift drive's jump-range and fuel calculations, which are the data-free core of the
/// ship-build arithmetic.
/// </summary>
/// <remarks>
/// <para>
/// These are pure functions. They take the drive's constants and the ship's mass, and answer in
/// light-years and tonnes.
/// </para>
/// <para>
/// The model is the community-standard one that EDSY and coriolis use, itself derived from
/// Frontier's description of how mass affects hyperspace range. The algorithm is ported as fact
/// rather than as code; see <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class JumpRange
{
    /// <summary>The most jumps one call evaluates.</summary>
    private const int MaxTotalRangeJumps = 100_000;

    /// <summary>The frame shift drive's mass factor at one loaded mass.</summary>
    /// <param name="mass">
    /// The ship's mass excluding the fuel being modelled, in tonnes. It must be finite and zero
    /// or more.
    /// </param>
    /// <param name="fuel">
    /// The fuel aboard for this calculation, in tonnes. The full amount contributes to the loaded
    /// mass, even when one jump burns less.
    /// </param>
    /// <param name="optMass">The drive's post-engineering optimised mass, in tonnes.</param>
    /// <returns>
    /// The dimensionless factor a single jump uses: one at the drive's optimised mass, below one
    /// above it, and above one below it.
    /// </returns>
    /// <remarks>
    /// A frame shift drive does not use the three-point mass curve that a thruster and a shield
    /// generator do. Its mass contribution to jump range is this direct inverse ratio. A Guardian
    /// booster's range is added after the base jump equation, so it is not part of this factor.
    /// </remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An input is negative or not finite, the optimised mass is not above zero, or the loaded
    /// mass is zero.
    /// </exception>
    public static double MassFactor(double mass, double fuel, double optMass)
    {
        RangeGuards.RequireFiniteNonNegative(mass, nameof(mass));
        RangeGuards.RequireFiniteNonNegative(fuel, nameof(fuel));
        RangeGuards.RequirePositive(optMass, nameof(optMass));
        if (mass + fuel <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(mass), mass, "The mass plus the fuel must be above 0.");
        }

        return optMass / (mass + fuel);
    }

    /// <summary>The range of a single jump, in light-years.</summary>
    /// <param name="mass">
    /// The ship's total mass excluding the fuel being modelled, in tonnes: hull, modules and
    /// cargo.
    /// </param>
    /// <param name="fuel">
    /// The fuel in the tank for this jump, in tonnes. Only the drive's maximum is burned, and the
    /// full amount still adds to the mass being moved.
    /// </param>
    /// <param name="drive">The drive constants.</param>
    /// <returns>
    /// The jump distance in light-years, the drive booster's bonus included. It is zero when the
    /// drive cannot jump.
    /// </returns>
    /// <remarks>
    /// A lighter ship and a larger optimised mass jump farther, and carrying more fuel than one
    /// jump needs only weighs the ship down.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="drive"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A quantity is negative or not finite, or a drive constant is not above zero.
    /// </exception>
    public static double SingleJump(double mass, double fuel, FrameShiftDriveParams drive)
    {
        RangeGuards.RequireFiniteNonNegative(mass, nameof(mass));
        RangeGuards.RequireFiniteNonNegative(fuel, nameof(fuel));
        Validate(drive);
        return SingleJumpUnchecked(mass, fuel, drive);
    }

    /// <summary>The fuel a single jump of a given distance costs, in tonnes.</summary>
    /// <param name="distance">
    /// The jump distance, in light-years. A distance beyond the single-jump range costs more than
    /// the tank holds, so the result is capped at what the drive can draw.
    /// </param>
    /// <param name="mass">The ship's total mass excluding fuel, in tonnes.</param>
    /// <param name="fuel">The fuel in the tank, which sets the mass moved and caps the burn.</param>
    /// <param name="drive">The drive constants.</param>
    /// <returns>The fuel used, in tonnes.</returns>
    /// <remarks>
    /// The cost scales as the distance over the maximum range, raised to the drive's power
    /// constant, of the tank's per-jump fuel. It round-trips at the maximum jump, and with no
    /// booster fitted it is the exact inverse of a single jump at every distance. With a booster
    /// the flat bonus is treated proportionally, as the reference implementation does, so an
    /// interior distance is a close approximation rather than the exact inverse.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="drive"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A quantity is negative or not finite, or a drive constant is not above zero.
    /// </exception>
    public static double FuelPerJump(double distance, double mass, double fuel, FrameShiftDriveParams drive)
    {
        RangeGuards.RequireFiniteNonNegative(distance, nameof(distance));
        RangeGuards.RequireFiniteNonNegative(mass, nameof(mass));
        RangeGuards.RequireFiniteNonNegative(fuel, nameof(fuel));
        Validate(drive);
        if (distance <= 0) return 0;

        double burn = Math.Min(fuel, drive.MaxFuel);
        double maxDistance = SingleJumpUnchecked(mass, fuel, drive);
        if (maxDistance <= 0) return 0;
        return Math.Min(Math.Pow(distance / maxDistance, drive.FuelPower) * burn, burn);
    }

    /// <summary>The total multi-jump range and jump count on one tank.</summary>
    /// <param name="mass">The ship's total mass excluding fuel, in tonnes.</param>
    /// <param name="fuel">The fuel available to spend, in tonnes.</param>
    /// <param name="drive">The drive constants.</param>
    /// <returns>
    /// The summed range in light-years and the number of jumps evaluated. No fuel, or a drive
    /// that draws none, answers no range and no jumps; a final partial fuel load still counts as
    /// one jump.
    /// </returns>
    /// <remarks>
    /// Each jump burns up to the drive's maximum, and the sum runs until the tank is empty. The
    /// mass stays fixed while the decreasing fuel is included in each jump, so the ship becomes
    /// lighter as it goes.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="drive"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A quantity is negative or not finite, a drive constant is not above zero, or the tank would
    /// need more than one hundred thousand jumps.
    /// </exception>
    public static TotalRangeDetails Total(double mass, double fuel, FrameShiftDriveParams drive)
    {
        RangeGuards.RequireFiniteNonNegative(mass, nameof(mass));
        RangeGuards.RequireFiniteNonNegative(fuel, nameof(fuel));
        Validate(drive);
        if (drive.MaxFuel <= 0) return new TotalRangeDetails(0, 0);

        double wanted = fuel > 0 ? Math.Max(1, Math.Ceiling(fuel / drive.MaxFuel)) : 0;
        if (wanted > MaxTotalRangeJumps)
        {
            throw new ArgumentOutOfRangeException(
                nameof(fuel),
                fuel,
                $"The fuel and the drive's maximum need more than {MaxTotalRangeJumps} jumps.");
        }

        int jumps = (int)wanted;
        double range = 0;
        double remaining = fuel;
        for (int jump = 0; jump < jumps; jump++)
        {
            range += SingleJumpUnchecked(mass, remaining, drive);
            if (double.IsInfinity(range) || double.IsNaN(range))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(drive), drive, "The parameters produce a total range that is not finite.");
            }

            remaining = Math.Max(0, remaining - drive.MaxFuel);
        }

        return new TotalRangeDetails(range, jumps);
    }

    private static double SingleJumpUnchecked(double mass, double fuel, FrameShiftDriveParams drive)
    {
        double burn = Math.Min(fuel, drive.MaxFuel);
        if (burn <= 0 || mass + fuel <= 0) return 0;

        double range = (Math.Pow(burn / drive.FuelMul, 1 / drive.FuelPower)
            * (drive.OptMass / (mass + fuel))) + drive.JumpBoost;
        if (double.IsInfinity(range) || double.IsNaN(range))
        {
            throw new ArgumentOutOfRangeException(
                nameof(drive), drive, "The parameters produce a range that is not finite.");
        }

        return range;
    }

    private static void Validate(FrameShiftDriveParams drive)
    {
        if (drive is null) throw new ArgumentNullException(nameof(drive));

        RangeGuards.RequirePositive(drive.OptMass, "drive.OptMass");
        RangeGuards.RequireFiniteNonNegative(drive.MaxFuel, "drive.MaxFuel");
        RangeGuards.RequirePositive(drive.FuelMul, "drive.FuelMul");
        RangeGuards.RequirePositive(drive.FuelPower, "drive.FuelPower");
        RangeGuards.RequireFiniteNonNegative(drive.JumpBoost, "drive.JumpBoost");
    }
}
