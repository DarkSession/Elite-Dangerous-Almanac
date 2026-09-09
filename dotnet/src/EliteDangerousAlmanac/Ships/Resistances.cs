using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One of the four damage types a build carries a resistance to.</summary>
/// <remarks>
/// This is the defensive set: what a shield or a hull resists. Absolute damage is absent because
/// nothing resists it. A weapon's output is broken down over a different set,
/// <see cref="DamageDistribution"/>, which carries absolute and anti-xeno shares and no caustic
/// share. The two are not interchangeable.
/// </remarks>
public enum DamageType
{
    /// <summary>Kinetic damage.</summary>
    Kinetic,

    /// <summary>Thermal damage.</summary>
    Thermal,

    /// <summary>Explosive damage.</summary>
    Explosive,

    /// <summary>Caustic damage.</summary>
    Caustic,
}

/// <summary>One figure per damage type, whatever the figure happens to be.</summary>
/// <param name="Kinetic">The kinetic figure.</param>
/// <param name="Thermal">The thermal figure.</param>
/// <param name="Explosive">The explosive figure.</param>
/// <param name="Caustic">The caustic figure.</param>
/// <remarks>
/// It carries a resistance, a pool of effective hit points, or a share of incoming damage. The
/// unit is the one the member that carries it documents. As a set of resistances each figure is
/// the fraction of that damage type removed, so 0.4 is forty percent resisted and a negative
/// figure is a weakness.
/// </remarks>
public sealed record DamageTypeValues(
    double Kinetic = 0,
    double Thermal = 0,
    double Explosive = 0,
    double Caustic = 0)
{
    /// <summary>No figure at all for any damage type.</summary>
    public static readonly DamageTypeValues None = new();

    /// <summary>The figure for one damage type.</summary>
    /// <param name="type">The damage type to read.</param>
    /// <returns>That type's figure.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="type"/> is not a member.</exception>
    public double this[DamageType type] => type switch
    {
        DamageType.Kinetic => Kinetic,
        DamageType.Thermal => Thermal,
        DamageType.Explosive => Explosive,
        DamageType.Caustic => Caustic,
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, "Not a damage type."),
    };
}

/// <summary>
/// How a build's shield and hull resistances stack, including the diminishing returns the game
/// applies once they get high.
/// </summary>
/// <remarks>
/// <para>
/// A resistance is the fraction of incoming damage removed, and its complement is the damage
/// multiplier, which is what stacking actually multiplies. Sources stack multiplicatively on that
/// multiplier, so two twenty percent resisters leave sixty-four percent of the damage rather than
/// sixty. The game then bends the result so that stacking cannot run away.
/// </para>
/// <para>
/// On shields, once the boosters push the multiplier below seventy percent of what the generator
/// alone gives, the remaining gain is halved. On a hull, once the stack drops the multiplier
/// below the best single source, capped at seventy percent, the range is squeezed the same way;
/// and where the squeeze would raise the multiplier, the plain product stands.
/// </para>
/// <para>
/// This type holds no data: fractions go in and fractions come out. The reference implementation
/// is EDCD coriolis, and the algorithm is ported as fact rather than as code; see
/// <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class Resistances
{
    /// <summary>Builds one figure per damage type.</summary>
    /// <param name="value">Called with each damage type in turn, and answers that type's figure.</param>
    /// <returns>The four figures in one record.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="value"/> is <see langword="null"/>.</exception>
    public static DamageTypeValues MapDamageTypes(Func<DamageType, double> value)
    {
        if (value is null) throw new ArgumentNullException(nameof(value));

        return new DamageTypeValues(
            value(DamageType.Kinetic),
            value(DamageType.Thermal),
            value(DamageType.Explosive),
            value(DamageType.Caustic));
    }

    /// <summary>How much raw damage of each type a pool of hit points can soak.</summary>
    /// <param name="total">
    /// The pool, in whatever unit it is measured: hull points for armour, megajoules for shields.
    /// </param>
    /// <param name="resistances">The effective resistances the pool sits behind, already stacked.</param>
    /// <returns>
    /// The effective hit points per damage type, in the same unit as the pool, and infinity at or
    /// above a full resistance: nothing of that type gets through.
    /// </returns>
    /// <remarks>
    /// A negative resistance is a weakness and reports fewer effective hit points than the pool
    /// holds, which is the point: lightweight alloy soaks less kinetic damage than its hull points
    /// suggest.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="resistances"/> is <see langword="null"/>.</exception>
    public static DamageTypeValues EffectiveHitPoints(double total, DamageTypeValues resistances)
    {
        if (resistances is null) throw new ArgumentNullException(nameof(resistances));

        return MapDamageTypes(type =>
        {
            double resistance = resistances[type];
            return resistance >= 1 ? double.PositiveInfinity : total / (1 - resistance);
        });
    }

    /// <summary>A shield stack's effective resistance to one damage type.</summary>
    /// <param name="generator">
    /// The shield generator's resistance to this damage type, as a fraction. A negative figure is
    /// a weakness.
    /// </param>
    /// <param name="boosters">Each powered shield booster's resistance to the same type.</param>
    /// <returns>
    /// The effective resistance, as a fraction: the share of incoming damage of that type the
    /// shields remove.
    /// </returns>
    public static double StackShieldResistance(double generator, IReadOnlyList<double>? boosters = null) =>
        1 - ShieldMultiplier(generator, boosters);

    /// <summary>A hull stack's effective resistance to one damage type.</summary>
    /// <param name="bulkhead">
    /// The fitted armour's resistance to this damage type, as a fraction. Lightweight alloy is a
    /// kinetic weakness rather than a resistance.
    /// </param>
    /// <param name="reinforcements">
    /// Each fitted hull reinforcement package's resistance to the same type.
    /// </param>
    /// <returns>The effective resistance, as a fraction.</returns>
    public static double StackArmourResistance(
        double bulkhead,
        IReadOnlyList<double>? reinforcements = null) =>
        1 - ArmourMultiplier(bulkhead, reinforcements);

    /// <summary>
    /// The extra shield resistance that pips to the systems capacitor buy, on top of the generator
    /// and the boosters.
    /// </summary>
    /// <param name="pips">
    /// Pips to the systems capacitor, from zero through four. A fractional allocation is allowed,
    /// because the game's own curve is continuous.
    /// </param>
    /// <returns>The resistance the pips add, as a fraction, rising to sixty percent at four pips.</returns>
    /// <remarks>
    /// It applies to every damage type, absolute included, and multiplies with the shield's own
    /// resistance rather than adding to it.
    /// </remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// <paramref name="pips"/> is not a finite number from zero through four.
    /// </exception>
    public static double SystemsResistance(double pips)
    {
        RangeGuards.RequirePips(pips, nameof(pips));
        return Math.Pow(pips, 0.85) * 0.6 / Math.Pow(4, 0.85);
    }

    /// <summary>The fraction of damage that lands, given a resistance.</summary>
    private static double MultiplierOf(double resistance) => 1 - resistance;

    /// <summary>
    /// Squeezes the range from zero to the ceiling into the range from the floor to the ceiling,
    /// which is the game's diminishing curve.
    /// </summary>
    private static double MapIntoDiminishingRange(double floor, double ceiling, double now) =>
        ceiling == 0 ? floor : floor + ((ceiling - floor) * (now / ceiling));

    private static double ShieldMultiplier(double generator, IReadOnlyList<double>? boosters)
    {
        double generatorMultiplier = MultiplierOf(generator);
        double combined = generatorMultiplier;
        foreach (double booster in boosters ?? []) combined *= MultiplierOf(booster);

        // Diminishing returns start once the boosters have taken thirty percent off the
        // generator's own multiplier. Beyond that each further point is worth half as much.
        double threshold = generatorMultiplier * 0.7;
        return combined >= threshold
            ? combined
            : MapIntoDiminishingRange(threshold / 2, threshold, combined);
    }

    private static double ArmourMultiplier(double bulkhead, IReadOnlyList<double>? reinforcements)
    {
        double combined = MultiplierOf(bulkhead);

        // The floor is the best single source, and never worse than seventy percent resisted.
        double threshold = Math.Min(0.7, combined);
        foreach (double reinforcement in reinforcements ?? [])
        {
            double multiplier = MultiplierOf(reinforcement);
            combined *= multiplier;
            threshold = Math.Min(threshold, multiplier);
        }

        double diminished = MapIntoDiminishingRange(0.35, threshold, combined);

        // Diminishing returns only ever bite. Where the squeeze would improve a stack that never
        // reached the threshold, the plain product stands.
        return diminished < 0.7 ? diminished : combined;
    }
}
