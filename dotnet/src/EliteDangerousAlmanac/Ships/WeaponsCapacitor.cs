using System;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Everything a weapons-capacitor calculation needs about one firing load.</summary>
/// <param name="WeaponsCapacity">The WEP-capacitor capacity, in megajoules.</param>
/// <param name="WeaponsRecharge">The four-WEP-pip recharge rate, in megajoules per second.</param>
/// <param name="SustainedEnergyPerSecond">
/// The sustained weapons-capacitor draw, in megajoules per second.
/// </param>
/// <remarks>Every figure must be finite and zero or more.</remarks>
public sealed record WeaponsCapacitorInput(
    double WeaponsCapacity,
    double WeaponsRecharge,
    double SustainedEnergyPerSecond);

/// <summary>The recharge, the drain and the endurance of one weapons capacitor.</summary>
/// <param name="WeaponsPips">The pips assigned to WEP for this result, from zero through four.</param>
/// <param name="Capacity">The WEP-capacitor capacity, in megajoules.</param>
/// <param name="RechargeRate">The recharge rate at the allocation, in megajoules per second.</param>
/// <param name="SustainedEnergyPerSecond">
/// The sustained draw across the firing weapons, in megajoules per second.
/// </param>
/// <param name="NetDrainRate">
/// The capacity lost per second after the recharge, in megajoules per second, and never below
/// nothing.
/// </param>
/// <param name="TimeToDrain">
/// The seconds from full to empty, or infinity where the recharge keeps pace with the draw.
/// </param>
public sealed record WeaponsCapacitorMetrics(
    double WeaponsPips,
    double Capacity,
    double RechargeRate,
    double SustainedEnergyPerSecond,
    double NetDrainRate,
    double TimeToDrain);

/// <summary>The weapons capacitor's recharge and endurance at a chosen WEP-pip allocation.</summary>
/// <remarks>
/// <para>
/// A distributor's catalogue recharge figure is its four-pip maximum, and the actual rate follows
/// the same non-linear pip curve as the SYS capacitor. The endurance compares that rate with the
/// weapons' sustained draw, so the magazine reloads are already folded in.
/// </para>
/// <para>
/// Reference implementation: EDCD/Coriolis, <c>src/app/shipyard/Calculations.js</c>. The algorithm
/// is ported as fact rather than as code. See <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class WeaponsCapacitor
{
    /// <summary>
    /// Calculates the WEP recharge and the time to drain while a weapon load fires continuously.
    /// </summary>
    /// <param name="input">
    /// The distributor capacity, its rated four-pip recharge and the weapons' sustained draw.
    /// </param>
    /// <param name="weaponsPips">
    /// The pips assigned to WEP, from zero through four. Fractional pips are accepted.
    /// </param>
    /// <returns>
    /// The actual recharge, the net drain and the seconds until empty. The time to drain is
    /// infinite where the weapons draw no more than the actual recharge rate, and a draw against
    /// no capacity at all drains in no time.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A capacity, recharge rate or draw is negative or not finite, or the allocation is outside
    /// zero through four.
    /// </exception>
    public static WeaponsCapacitorMetrics Metrics(
        WeaponsCapacitorInput input, double weaponsPips = 4)
    {
        RangeGuards.RequirePips(weaponsPips, nameof(weaponsPips));
        if (input is null) throw new ArgumentNullException(nameof(input));

        RangeGuards.RequireFiniteNonNegative(input.WeaponsCapacity, "input.WeaponsCapacity");
        RangeGuards.RequireFiniteNonNegative(input.WeaponsRecharge, "input.WeaponsRecharge");
        RangeGuards.RequireFiniteNonNegative(
            input.SustainedEnergyPerSecond, "input.SustainedEnergyPerSecond");

        double rechargeRate = CapacitorRecharge.AtPips(input.WeaponsRecharge, weaponsPips);
        double netDrainRate = Math.Max(0, input.SustainedEnergyPerSecond - rechargeRate);

        return new WeaponsCapacitorMetrics(
            WeaponsPips: weaponsPips,
            Capacity: input.WeaponsCapacity,
            RechargeRate: rechargeRate,
            SustainedEnergyPerSecond: input.SustainedEnergyPerSecond,
            NetDrainRate: netDrainRate,
            TimeToDrain: netDrainRate == 0
                ? double.PositiveInfinity
                : input.WeaponsCapacity / netDrainRate);
    }
}
