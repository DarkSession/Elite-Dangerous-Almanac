using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One fitted module's claim on the power plant.</summary>
/// <param name="Draw">The power draw, in megawatts, post-engineering. It must be finite and zero or more.</param>
/// <remarks>
/// The journal's <c>Priority</c> field counts from zero, so its zero is priority group one here.
/// </remarks>
public sealed record PowerConsumer(double Draw)
{
    /// <summary>
    /// The priority group, from one through five, as the outfitting panel numbers them. A value
    /// outside that range is clamped into it, and an absent one means group one.
    /// </summary>
    public int? Priority { get; init; }

    /// <summary>Whether the module is switched on. A module switched off draws nothing.</summary>
    public bool Enabled { get; init; } = true;

    /// <summary>
    /// Whether the module draws only while the hardpoints are deployed. This is true for every
    /// weapon, and for the utility fittings that are not always powered.
    /// </summary>
    public bool DeployedOnly { get; init; }

    /// <summary>An optional label for the module, which the arithmetic ignores.</summary>
    public string? Label { get; init; }

    /// <summary>An optional module symbol, carried through to the result.</summary>
    public string? Symbol { get; init; }
}

/// <summary>One power consumer as normalised for presentation and reconciliation.</summary>
/// <param name="Draw">The post-engineering draw, in megawatts.</param>
/// <param name="Enabled">Whether the module is switched on. Only an enabled module contributes to a total.</param>
/// <param name="Priority">The effective outfitting-panel priority group, from one through five.</param>
/// <param name="DeployedOnly">Whether the module draws only with the hardpoints deployed.</param>
/// <param name="Label">The caller's label, normally the fitted module's exact journal slot key.</param>
/// <param name="Symbol">The module symbol, where the caller supplied one.</param>
public sealed record PowerConsumerResult(
    double Draw,
    bool Enabled,
    int Priority,
    bool DeployedOnly,
    string? Label = null,
    string? Symbol = null);

/// <summary>One priority group's share of the power budget.</summary>
/// <param name="Priority">The group number, from one through five.</param>
/// <param name="Retracted">This group's own draw with the hardpoints retracted, in megawatts.</param>
/// <param name="Deployed">
/// This group's own draw with the hardpoints deployed, in megawatts. It is everything in
/// <paramref name="Retracted"/> plus the weapons, so it is never below it.
/// </param>
/// <param name="RetractedTotal">
/// The draw of this group and every higher-priority one, retracted, in megawatts.
/// </param>
/// <param name="DeployedTotal">
/// The draw of this group and every higher-priority one, deployed, in megawatts.
/// </param>
/// <param name="PoweredRetracted">Whether this group stays powered with the hardpoints retracted.</param>
/// <param name="PoweredDeployed">Whether this group stays powered with the hardpoints deployed.</param>
public sealed record PowerBand(
    int Priority,
    double Retracted,
    double Deployed,
    double RetractedTotal,
    double DeployedTotal,
    bool PoweredRetracted,
    bool PoweredDeployed);

/// <summary>What a build's power plant makes and what the build asks of it.</summary>
/// <param name="Available">The power the plant generates, in megawatts, post-engineering.</param>
/// <param name="Retracted">The total draw with the hardpoints retracted, in megawatts.</param>
/// <param name="Deployed">The total draw with the hardpoints deployed, in megawatts. This is the figure that must fit.</param>
/// <param name="Headroom">
/// The available power less the deployed draw, in megawatts. A negative figure means the build is
/// over budget.
/// </param>
/// <param name="Utilisation">
/// The deployed draw as a fraction of the available power. It is infinite when a build draws power
/// with no plant fitted, and zero when it draws none.
/// </param>
/// <param name="WithinBudget">Whether the whole build stays powered with the hardpoints deployed.</param>
/// <param name="Bands">
/// The five priority groups, group one first. A group is powered when its running total, its own
/// draw plus every higher-priority group's, fits in the available power.
/// </param>
/// <param name="Consumers">
/// Every supplied consumer in source order, the switched-off entries included. The enabled entries
/// reconcile with the band and aggregate totals.
/// </param>
public sealed record PowerBudget(
    double Available,
    double Retracted,
    double Deployed,
    double Headroom,
    double Utilisation,
    bool WithinBudget,
    IReadOnlyList<PowerBand> Bands,
    IReadOnlyList<PowerConsumerResult> Consumers);

/// <summary>
/// What the power plant makes, what the build draws, and which priority groups stay lit when it
/// draws more than the plant makes.
/// </summary>
/// <remarks>
/// <para>
/// The model is the game's own. Every powered module draws its megawatts continuously, except the
/// ones bolted to a hardpoint. Weapons and most utility fittings only draw while the hardpoints
/// are deployed, which is why a build has two totals. Each module sits in one of five priority
/// groups. When the draw goes over what the plant makes, the game keeps groups powered from group
/// one down, and shuts off the first group whose running total would go over, and everything below
/// it.
/// </para>
/// <para>
/// Reference implementation: EDCD/Coriolis, <c>src/app/shipyard/Ship.js</c>. The algorithm is
/// ported as fact rather than as code. See <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class Power
{
    /// <summary>How many priority groups the game offers.</summary>
    private const int PriorityGroups = 5;

    /// <summary>
    /// The floating-point slack a running total is compared against the capacity with. Summed
    /// two-decimal megawatts can land a whisker over an exact match, and a build that draws exactly
    /// what it makes is powered, so the comparison must not trip on that.
    /// </summary>
    private const double Epsilon = 1e-9;

    /// <summary>
    /// Works out a build's power budget: what the plant makes, what the modules draw retracted and
    /// deployed, and which priority groups survive.
    /// </summary>
    /// <param name="available">
    /// The power the plant generates, in megawatts. It is zero when no plant is fitted, and every
    /// group then reads as unpowered.
    /// </param>
    /// <param name="consumers">
    /// The power consumers to include. A module switched off is left out of the totals, and the
    /// rest fall into their priority group.
    /// </param>
    /// <returns>The build's power budget.</returns>
    /// <remarks>
    /// A group that draws exactly the power available stays online, which matches the game. Only
    /// going over shuts anything down.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="consumers"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The available power, or a consumer's draw, is not a finite number of zero or more.
    /// </exception>
    public static PowerBudget Budget(double available, IReadOnlyList<PowerConsumer> consumers)
    {
        if (consumers is null) throw new ArgumentNullException(nameof(consumers));
        RangeGuards.RequireFiniteNonNegative(available, nameof(available));

        var results = new List<PowerConsumerResult>(consumers.Count);
        double[] retractedByBand = new double[PriorityGroups];
        double[] deployedByBand = new double[PriorityGroups];
        foreach (PowerConsumer consumer in consumers)
        {
            if (consumer is null) throw new ArgumentNullException(nameof(consumers));
            RangeGuards.RequireFiniteNonNegative(consumer.Draw, "consumer.Draw");
        }

        foreach (PowerConsumer consumer in consumers)
        {
            int index = BandIndex(consumer.Priority);
            results.Add(new PowerConsumerResult(
                Draw: consumer.Draw,
                Enabled: consumer.Enabled,
                Priority: index + 1,
                DeployedOnly: consumer.DeployedOnly,
                Label: consumer.Label,
                Symbol: consumer.Symbol));
            if (!consumer.Enabled || consumer.Draw == 0) continue;
            if (consumer.DeployedOnly) deployedByBand[index] += consumer.Draw;
            else retractedByBand[index] += consumer.Draw;
        }

        var bands = new List<PowerBand>(PriorityGroups);
        double retractedTotal = 0;
        double deployedTotal = 0;
        for (int index = 0; index < PriorityGroups; index++)
        {
            double retracted = retractedByBand[index];
            // A deployed build still draws everything it drew stowed.
            double deployed = retracted + deployedByBand[index];
            retractedTotal += retracted;
            deployedTotal += deployed;
            bands.Add(new PowerBand(
                Priority: index + 1,
                Retracted: retracted,
                Deployed: deployed,
                RetractedTotal: retractedTotal,
                DeployedTotal: deployedTotal,
                PoweredRetracted: retractedTotal <= available + Epsilon,
                PoweredDeployed: deployedTotal <= available + Epsilon));
        }

        double utilisation = available > 0
            ? deployedTotal / available
            : deployedTotal > 0 ? double.PositiveInfinity : 0;

        return new PowerBudget(
            Available: available,
            Retracted: retractedTotal,
            Deployed: deployedTotal,
            Headroom: available - deployedTotal,
            Utilisation: utilisation,
            WithinBudget: deployedTotal <= available + Epsilon,
            Bands: new ReadOnlyCollection<PowerBand>(bands),
            Consumers: new ReadOnlyCollection<PowerConsumerResult>(results));
    }

    /// <summary>Clamps a priority into the five groups, and defaults an absent one to group one.</summary>
    private static int BandIndex(int? priority) =>
        priority is null ? 0 : Math.Min(PriorityGroups, Math.Max(1, priority.Value)) - 1;
}
