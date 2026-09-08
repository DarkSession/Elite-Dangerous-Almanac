using System;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The curve a distributor's rated four-pip recharge is scaled along.</summary>
/// <remarks>
/// Reference models: EDCD/Coriolis for SYS and WEP, and EDSY for ENG. See <c>ATTRIBUTIONS.md</c>
/// for credit and licence terms.
/// </remarks>
internal static class CapacitorRecharge
{
    /// <summary>Scales a rated four-pip recharge to one pip allocation.</summary>
    /// <param name="ratedRecharge">The recharge at four pips, in energy per second.</param>
    /// <param name="pips">The capacitor allocation, from zero through four.</param>
    /// <returns>The recharge at the allocation, in the same units as the rated recharge.</returns>
    internal static double AtPips(double ratedRecharge, double pips) =>
        ratedRecharge * Math.Pow(pips / 4, 1.1);
}
