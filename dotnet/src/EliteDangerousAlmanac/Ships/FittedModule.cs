namespace EliteDangerousAlmanac.Ships;

/// <summary>A point-in-time view of the module fitted in one mount.</summary>
/// <remarks>
/// The view is detached from the build it came from, so a later edit does not change it.
/// Read a new one after an edit. Every edit lives on the build itself and is keyed by
/// <see cref="Slot"/>, which is what keeps this value free of a stale-handle lifecycle.
/// </remarks>
/// <param name="Slot">The mount key, in the build's own spelling.</param>
/// <param name="Symbol">The Frontier module symbol, such as <c>Int_Hyperdrive_Size6_Class5</c>.</param>
/// <param name="Raw">The detached, journal-shaped fitted record.</param>
public sealed record FittedModule(string Slot, string Symbol, LoadoutModule Raw)
{
    /// <summary>Whether the module is powered on, or <see langword="null"/> when unstated.</summary>
    public bool? On { get; init; }

    /// <summary>The power-priority group, or <see langword="null"/> when unstated.</summary>
    public int? Priority { get; init; }

    /// <summary>The module's health, 0 through 1, or <see langword="null"/> when unstated.</summary>
    public double? Health { get; init; }

    /// <summary>The captured purchase value in credits, or <see langword="null"/> when unstated.</summary>
    public double? Value { get; init; }

    /// <summary>The applied engineering, or <see langword="null"/> when the module is stock.</summary>
    public ModuleEngineering? Engineering { get; init; }

    /// <summary>
    /// The fitted article's stats before its journal modifier block is folded in, or
    /// <see langword="null"/> when the article did not resolve.
    /// </summary>
    /// <remarks>
    /// A stock or ordinarily engineered module shows its base catalogue record. A fixed
    /// pre-engineered variant shows its resolved article record here as well as through
    /// <see cref="EffectiveStats"/>, so a stat a journal capture left out still describes the
    /// article. Clearing or replacing that fixed engineering restores the stock record before
    /// the next recipe is applied.
    /// </remarks>
    public OutfittingModule? Stats { get; init; }

    /// <summary>
    /// The post-engineering stats, or <see langword="null"/> when the article did not resolve.
    /// </summary>
    /// <remarks>
    /// <para>
    /// On a weapon, journal damage per second is resolved back to per-round damage and the
    /// falloff is capped at the maximum range. Exact damage components follow the engineered
    /// total, and they disappear when a damage conversion replaces them with a fractional
    /// distribution.
    /// </para>
    /// <para>
    /// A thruster's or a shield generator's mass curve moves as a whole: a recipe names the
    /// optimal mass and the optimal multiplier, and the four endpoints follow them. A
    /// generator's maximum mass is the exception, because a lightened optimum leaves it where
    /// it was. So this record carries the curve the build's own metrics read.
    /// </para>
    /// </remarks>
    public OutfittingModule? EffectiveStats { get; init; }

    /// <summary>
    /// The fully rearmed ammunition capacity, or <see langword="null"/> on a module that takes
    /// no ammunition.
    /// </summary>
    public AmmunitionCapacity? Ammunition { get; init; }

    /// <summary>
    /// The fixed pre-engineered variant this article is, or <see langword="null"/> when no one
    /// variant answers to it.
    /// </summary>
    public PreEngineeredVariant? PreEngineeredVariant { get; init; }
}
