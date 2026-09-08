using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Everything a recovery calculation needs about a powered shield and SYS capacitor.</summary>
/// <param name="Strength">The total shield strength, reinforcement included, in megajoules.</param>
/// <param name="RegenRate">
/// The generator's regeneration rate while the shield is raised, in megajoules per second.
/// </param>
/// <param name="BrokenRegenRate">
/// The generator's regeneration rate while the shield is broken, in megajoules per second.
/// </param>
/// <param name="DistributorDraw">The SYS-capacitor energy spent per megajoule regenerated.</param>
/// <param name="SystemsCapacity">The SYS capacity, which is zero when no distributor is fitted.</param>
/// <param name="SystemsRecharge">The largest SYS recharge rate, per second.</param>
/// <remarks>Every figure must be finite and zero or more.</remarks>
public sealed record ShieldRecoveryInput(
    double Strength,
    double RegenRate,
    double BrokenRegenRate,
    double DistributorDraw,
    double SystemsCapacity,
    double SystemsRecharge);

/// <summary>The time and the rates for a shield to return after collapsing.</summary>
/// <param name="RegenRate">The megajoules per second regenerated while the shield is raised.</param>
/// <param name="BrokenRegenRate">The megajoules per second regenerated while the shield is broken.</param>
/// <param name="RecoveryTime">
/// The seconds from collapse to the half-strength threshold where the shield rises, the sixteen
/// second delay included.
/// </param>
/// <param name="RegenTime">The seconds from the half-strength threshold to full strength.</param>
public sealed record ShieldRecoveryMetrics(
    double RegenRate,
    double BrokenRegenRate,
    double RecoveryTime,
    double RegenTime);

/// <summary>One fitted shield cell bank, reduced to the figures a summary uses.</summary>
/// <param name="Slot">The slot key carrying the bank.</param>
/// <param name="Symbol">The module symbol.</param>
/// <param name="ReinforcementRate">The shield reinforcement rate while one cell runs, in megajoules per second.</param>
/// <param name="Cells">The cells carried when fully rearmed.</param>
/// <param name="SpinUp">The delay before reinforcement starts, in seconds.</param>
/// <param name="Duration">The reinforcement duration, in seconds.</param>
/// <param name="Heat">The heat one activation generates, in the game's thermal-load units.</param>
/// <param name="Powered">Whether the fitted bank is switched on and receiving power.</param>
public sealed record CellBankInput(
    string Slot,
    string Symbol,
    double ReinforcementRate,
    double Cells,
    double SpinUp,
    double Duration,
    double Heat,
    bool Powered);

/// <summary>One fitted bank as a summary reports it.</summary>
/// <param name="Slot">The slot key carrying the bank.</param>
/// <param name="Symbol">The module symbol.</param>
/// <param name="Reinforcement">The megajoules one complete cell activation restores.</param>
/// <param name="Cells">The cells carried when fully rearmed.</param>
/// <param name="SpinUp">The delay before reinforcement starts, in seconds.</param>
/// <param name="Duration">The reinforcement duration, in seconds.</param>
/// <param name="Heat">The heat one activation generates, in the game's thermal-load units.</param>
/// <param name="Powered">Whether the fitted bank is switched on and receiving power.</param>
public sealed record CellBankMetrics(
    string Slot,
    string Symbol,
    double Reinforcement,
    double Cells,
    double SpinUp,
    double Duration,
    double Heat,
    bool Powered);

/// <summary>Every fitted shield cell bank, and the pool the powered ones make between them.</summary>
/// <param name="Banks">The fitted banks in slot order.</param>
/// <param name="TotalRestorable">The megajoules restorable across every powered bank and cell.</param>
/// <param name="TotalCells">The cells aboard across every powered bank.</param>
public sealed record CellBankSummary(
    IReadOnlyList<CellBankMetrics> Banks,
    double TotalRestorable,
    double TotalCells);

/// <summary>Shield collapse, regeneration and cell-bank aggregation, all data-free.</summary>
/// <remarks>
/// The recovery timing is ported from EDCD/Coriolis at the revision <c>data/ships/SOURCES.md</c>
/// records. See <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </remarks>
public static class ShieldRecovery
{
    /// <summary>The delay before a broken shield starts to come back, in seconds.</summary>
    private const double CollapseDelay = 16;

    /// <summary>Calculates shield recovery and regeneration times at one SYS-pip allocation.</summary>
    /// <param name="input">The shield strength, the generator rates and the distributor figures.</param>
    /// <param name="systemsPips">The pips assigned to SYS, from zero through four.</param>
    /// <returns>
    /// The rates, and the seconds to half and to full strength. A phase that cannot finish answers
    /// infinity.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The allocation is outside zero through four, or a figure is negative or not finite.
    /// </exception>
    public static ShieldRecoveryMetrics Metrics(ShieldRecoveryInput input, double systemsPips = 4)
    {
        RangeGuards.RequirePips(systemsPips, nameof(systemsPips));
        if (input is null) throw new ArgumentNullException(nameof(input));

        RangeGuards.RequireFiniteNonNegative(input.Strength, "input.Strength");
        RangeGuards.RequireFiniteNonNegative(input.RegenRate, "input.RegenRate");
        RangeGuards.RequireFiniteNonNegative(input.BrokenRegenRate, "input.BrokenRegenRate");
        RangeGuards.RequireFiniteNonNegative(input.DistributorDraw, "input.DistributorDraw");
        RangeGuards.RequireFiniteNonNegative(input.SystemsCapacity, "input.SystemsCapacity");
        RangeGuards.RequireFiniteNonNegative(input.SystemsRecharge, "input.SystemsRecharge");

        double recharge = CapacitorRecharge.AtPips(input.SystemsRecharge, systemsPips);
        double half = input.Strength / 2;

        return new ShieldRecoveryMetrics(
            RegenRate: input.RegenRate,
            BrokenRegenRate: input.BrokenRegenRate,
            RecoveryTime: CollapseDelay + PhaseTime(
                half, input.BrokenRegenRate, input.DistributorDraw, input.SystemsCapacity, recharge),
            RegenTime: PhaseTime(
                half, input.RegenRate, input.DistributorDraw, input.SystemsCapacity, recharge));
    }

    /// <summary>Aggregates fitted shield cell banks while keeping each one's power state.</summary>
    /// <param name="banks">The banks, in the order their slots should be reported.</param>
    /// <returns>
    /// The per-bank figures and the totals over the powered banks. An empty list answers an empty
    /// bank list and no totals.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="banks"/> is <see langword="null"/>.</exception>
    public static CellBankSummary SummariseCellBanks(IReadOnlyList<CellBankInput> banks)
    {
        if (banks is null) throw new ArgumentNullException(nameof(banks));

        var metrics = new List<CellBankMetrics>(banks.Count);
        double totalRestorable = 0;
        double totalCells = 0;
        foreach (CellBankInput bank in banks)
        {
            if (bank is null) throw new ArgumentNullException(nameof(banks));

            double reinforcement = bank.ReinforcementRate * bank.Duration;
            metrics.Add(new CellBankMetrics(
                Slot: bank.Slot,
                Symbol: bank.Symbol,
                Reinforcement: reinforcement,
                Cells: bank.Cells,
                SpinUp: bank.SpinUp,
                Duration: bank.Duration,
                Heat: bank.Heat,
                Powered: bank.Powered));
            if (!bank.Powered) continue;
            totalRestorable += reinforcement * bank.Cells;
            totalCells += bank.Cells;
        }

        return new CellBankSummary(
            new ReadOnlyCollection<CellBankMetrics>(metrics), totalRestorable, totalCells);
    }

    /// <summary>
    /// The seconds one regeneration phase takes, the SYS capacitor draining as it goes.
    /// </summary>
    private static double PhaseTime(
        double megajoules, double rate, double draw, double capacity, double recharge)
    {
        if (megajoules <= 0) return 0;
        if (rate <= 0) return double.PositiveInfinity;
        if (draw <= 0) return megajoules / rate;

        double drain = (rate * draw) - recharge;
        if (drain <= 0) return megajoules / rate;

        double capacitorLifetime = capacity / drain;
        double beforeEmpty = capacitorLifetime * rate;
        if (megajoules <= beforeEmpty) return megajoules / rate;
        if (recharge <= 0) return double.PositiveInfinity;
        return capacitorLifetime + ((megajoules - beforeEmpty) / (recharge / draw));
    }
}
