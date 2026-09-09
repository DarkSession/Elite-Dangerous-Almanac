using System;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Everything a SYS-capacitor calculation needs about one raised shield.</summary>
/// <param name="Strength">The shield's total strength, in megajoules.</param>
/// <param name="Resistances">The shield's own stacked resistances, pip-free, each a finite fraction.</param>
/// <param name="SystemsCapacity">The SYS-capacitor capacity, in megajoules.</param>
/// <param name="SystemsRecharge">The four-SYS-pip recharge rate, in megajoules per second.</param>
public sealed record ShieldCapacitorInput(
    double Strength,
    DamageTypeValues Resistances,
    double SystemsCapacity,
    double SystemsRecharge)
{
    /// <summary>The bare shield a build already holds, with the distributor's SYS figures.</summary>
    /// <param name="shields">The pip-free shield metrics.</param>
    /// <param name="systemsCapacity">The SYS-capacitor capacity, in megajoules.</param>
    /// <param name="systemsRecharge">The four-SYS-pip recharge rate, in megajoules per second.</param>
    /// <returns>The input, so the two halves compose without a hand-written adapter.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="shields"/> is <see langword="null"/>.</exception>
    public static ShieldCapacitorInput For(
        ShieldMetrics shields, double systemsCapacity, double systemsRecharge)
    {
        if (shields is null) throw new ArgumentNullException(nameof(shields));

        return new ShieldCapacitorInput(
            shields.Strength, shields.Resistances, systemsCapacity, systemsRecharge);
    }
}

/// <summary>What one SYS allocation is worth to a raised shield.</summary>
/// <param name="SystemsPips">The pips assigned to SYS for this result, from zero through four.</param>
/// <param name="Capacity">The SYS-capacitor capacity, in megajoules.</param>
/// <param name="RechargeRate">The recharge rate at the allocation, in megajoules per second.</param>
/// <param name="SystemsResistance">
/// The resistance the pips contribute on their own, as a fraction: none at no pips, rising to
/// three fifths at four.
/// </param>
/// <param name="EffectiveResistances">
/// The shield's resistances with the pips folded in, which are the figures the game's own panel
/// shows while the allocation stands. The pips multiply with the shield's stack rather than adding
/// to it, so these are not a sum.
/// </param>
/// <param name="EffectiveHitPoints">
/// The raw damage of each type the shield soaks at this allocation, in megajoules. It is infinite
/// where a resistance reaches the whole of that damage type.
/// </param>
/// <remarks>Every resistance here is a fraction rather than a percentage, and unrounded.</remarks>
public sealed record ShieldCapacitorMetrics(
    double SystemsPips,
    double Capacity,
    double RechargeRate,
    double SystemsResistance,
    DamageTypeValues EffectiveResistances,
    DamageTypeValues EffectiveHitPoints);

/// <summary>
/// The SYS capacitor: what pips to SYS buy a raised shield, and what the shield is worth once they
/// are folded in.
/// </summary>
/// <remarks>
/// <para>
/// SYS does two things at once. It resists: the allocation adds a flat resistance to every damage
/// type, which multiplies with the shield's own stack rather than adding to it. And it recharges:
/// the capacitor's energy is what the generator spends putting the shield back up, on the same
/// non-linear pip curve the other two capacitors follow.
/// </para>
/// <para>
/// The bare shield those effective figures are built from is <see cref="Shields.Metrics"/>, which
/// is pip-free. What the recharge reported here buys, in seconds from collapse back to a raised
/// shield, is <see cref="ShieldRecovery.Metrics"/>, which takes the same allocation and the
/// generator's regeneration rates.
/// </para>
/// <para>
/// Reference implementation: EDCD/Coriolis, <c>src/app/shipyard/Calculations.js</c>. The algorithm
/// is ported as fact rather than as code. See <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class ShieldCapacitor
{
    /// <summary>Calculates what a SYS-pip allocation gives a raised shield.</summary>
    /// <param name="input">
    /// The bare shield's strength and stacked resistances, and the distributor's SYS capacity and
    /// rated four-pip recharge.
    /// </param>
    /// <param name="systemsPips">
    /// The pips assigned to SYS, from zero through four. Fractional pips are accepted.
    /// </param>
    /// <returns>
    /// What the allocation is worth. At no pips the resistance and the recharge rate are zero, and
    /// the effective figures equal the bare ones that went in.
    /// </returns>
    /// <remarks>
    /// The pips are checked before the shield, so a bad allocation is reported first.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The allocation is outside zero through four, a strength, capacity or recharge rate is
    /// negative or not finite, or a resistance is not a finite number.
    /// </exception>
    public static ShieldCapacitorMetrics Metrics(ShieldCapacitorInput input, double systemsPips = 4)
    {
        // Checked before the shield, so a build with none still reports a bad allocation.
        RangeGuards.RequirePips(systemsPips, nameof(systemsPips));
        if (input is null) throw new ArgumentNullException(nameof(input));

        RangeGuards.RequireFiniteNonNegative(input.Strength, "input.Strength");
        RangeGuards.RequireFiniteNonNegative(input.SystemsCapacity, "input.SystemsCapacity");
        RangeGuards.RequireFiniteNonNegative(input.SystemsRecharge, "input.SystemsRecharge");
        if (input.Resistances is null) throw new ArgumentNullException("input.Resistances");
        foreach (DamageType type in new[]
                 {
                     DamageType.Kinetic, DamageType.Thermal, DamageType.Explosive, DamageType.Caustic,
                 })
        {
            double resistance = input.Resistances[type];
            if (double.IsNaN(resistance) || double.IsInfinity(resistance))
            {
                throw new ArgumentOutOfRangeException(
                    $"input.Resistances.{type}", resistance, "The value must be a finite number.");
            }
        }

        double systemsResistance = Resistances.SystemsResistance(systemsPips);
        // The SYS pips multiply with the stacked shield resistance rather than adding to it.
        DamageTypeValues effectiveResistances = Resistances.MapDamageTypes(
            type => 1 - ((1 - input.Resistances[type]) * (1 - systemsResistance)));

        return new ShieldCapacitorMetrics(
            SystemsPips: systemsPips,
            Capacity: input.SystemsCapacity,
            RechargeRate: CapacitorRecharge.AtPips(input.SystemsRecharge, systemsPips),
            SystemsResistance: systemsResistance,
            EffectiveResistances: effectiveResistances,
            EffectiveHitPoints: Resistances.EffectiveHitPoints(input.Strength, effectiveResistances));
    }
}
