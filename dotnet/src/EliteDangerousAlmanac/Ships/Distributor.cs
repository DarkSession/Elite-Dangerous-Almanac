using System;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Everything a distributor calculation needs about one power distributor.</summary>
/// <param name="SystemsCapacity">The SYS-capacitor capacity, in megajoules.</param>
/// <param name="SystemsRecharge">The four-SYS-pip recharge rate, in megajoules per second.</param>
/// <param name="EnginesCapacity">The ENG-capacitor capacity, in megajoules.</param>
/// <param name="EnginesRecharge">The four-ENG-pip recharge rate, in megajoules per second.</param>
/// <param name="WeaponsCapacity">The WEP-capacitor capacity, in megajoules.</param>
/// <param name="WeaponsRecharge">The four-WEP-pip recharge rate, in megajoules per second.</param>
/// <remarks>
/// Every capacity and recharge rate must be finite and zero or more. Each pip allocation runs from
/// zero through four, may be fractional, and defaults to four.
/// </remarks>
public sealed record DistributorInput(
    double SystemsCapacity,
    double SystemsRecharge,
    double EnginesCapacity,
    double EnginesRecharge,
    double WeaponsCapacity,
    double WeaponsRecharge)
{
    /// <summary>The pips assigned to SYS, from zero through four.</summary>
    public double SystemsPips { get; init; } = 4;

    /// <summary>The pips assigned to ENG, from zero through four.</summary>
    public double EnginesPips { get; init; } = 4;

    /// <summary>The pips assigned to WEP, from zero through four.</summary>
    public double WeaponsPips { get; init; } = 4;
}

/// <summary>One distributor capacitor at a chosen pip allocation.</summary>
/// <param name="Capacity">The energy the capacitor holds when full, in megajoules.</param>
/// <param name="RatedRecharge">The largest recharge, at four pips, in megajoules per second.</param>
/// <param name="RechargeRate">The recharge at the selected pips, in megajoules per second.</param>
public sealed record DistributorCapacitorMetrics(
    double Capacity,
    double RatedRecharge,
    double RechargeRate);

/// <summary>The pip allocation one distributor result was calculated at.</summary>
/// <param name="Systems">The pips assigned to SYS, from zero through four.</param>
/// <param name="Engines">The pips assigned to ENG, from zero through four.</param>
/// <param name="Weapons">The pips assigned to WEP, from zero through four.</param>
public sealed record DistributorPips(double Systems, double Engines, double Weapons);

/// <summary>All three capacitor figures for one power distributor and pip allocation.</summary>
/// <param name="Systems">The SYS-capacitor capacity and recharge.</param>
/// <param name="Engines">The ENG-capacitor capacity and recharge.</param>
/// <param name="Weapons">The WEP-capacitor capacity and recharge.</param>
/// <param name="Pips">The pip allocation the three recharge rates were calculated at.</param>
public sealed record DistributorMetrics(
    DistributorCapacitorMetrics Systems,
    DistributorCapacitorMetrics Engines,
    DistributorCapacitorMetrics Weapons,
    DistributorPips Pips);

/// <summary>The power distributor's capacitor capacities and pip-scaled recharge rates.</summary>
/// <remarks>
/// <para>
/// A distributor's catalogue recharge figures are its four-pip maxima. SYS, ENG and WEP all use
/// the same non-linear allocation curve.
/// </para>
/// <para>
/// The SYS and WEP curves follow EDCD/Coriolis. The ENG curve is cross-checked against EDSY's
/// boost-frequency calculation. See <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class Distributor
{
    /// <summary>Calculates the SYS, ENG and WEP recharge at one set of pip allocations.</summary>
    /// <param name="input">
    /// All three capacities, their rated four-pip recharge rates and the pips to model.
    /// </param>
    /// <returns>
    /// The capacity, the rated recharge and the actual recharge for each capacitor, and the
    /// allocations used.
    /// </returns>
    /// <remarks>
    /// Each allocation defaults independently to four. The allocations do not have to sum to the
    /// six pips the game offers, so a caller can compare independent scenarios in one result.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A capacity or recharge rate is negative or not finite, or a pip allocation is outside zero
    /// through four.
    /// </exception>
    public static DistributorMetrics Metrics(DistributorInput input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));

        RangeGuards.RequirePips(input.SystemsPips, "input.SystemsPips");
        RangeGuards.RequirePips(input.EnginesPips, "input.EnginesPips");
        RangeGuards.RequirePips(input.WeaponsPips, "input.WeaponsPips");
        RangeGuards.RequireFiniteNonNegative(input.SystemsCapacity, "input.SystemsCapacity");
        RangeGuards.RequireFiniteNonNegative(input.SystemsRecharge, "input.SystemsRecharge");
        RangeGuards.RequireFiniteNonNegative(input.EnginesCapacity, "input.EnginesCapacity");
        RangeGuards.RequireFiniteNonNegative(input.EnginesRecharge, "input.EnginesRecharge");
        RangeGuards.RequireFiniteNonNegative(input.WeaponsCapacity, "input.WeaponsCapacity");
        RangeGuards.RequireFiniteNonNegative(input.WeaponsRecharge, "input.WeaponsRecharge");

        return new DistributorMetrics(
            Systems: Capacitor(input.SystemsCapacity, input.SystemsRecharge, input.SystemsPips),
            Engines: Capacitor(input.EnginesCapacity, input.EnginesRecharge, input.EnginesPips),
            Weapons: Capacitor(input.WeaponsCapacity, input.WeaponsRecharge, input.WeaponsPips),
            Pips: new DistributorPips(input.SystemsPips, input.EnginesPips, input.WeaponsPips));
    }

    private static DistributorCapacitorMetrics Capacitor(
        double capacity, double ratedRecharge, double pips) =>
        new(capacity, ratedRecharge, CapacitorRecharge.AtPips(ratedRecharge, pips));
}
