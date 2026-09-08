using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The shield generator constants a strength calculation needs, all post-engineering.</summary>
/// <param name="MinMass">The hull mass at which the generator performs at its best, in tonnes.</param>
/// <param name="OptMass">The hull mass at which the generator performs to specification, in tonnes.</param>
/// <param name="MaxMass">The hull mass beyond which the generator raises no shield, in tonnes.</param>
/// <param name="MinMultiplier">The smallest strength multiplier, reached at the maximum mass.</param>
/// <param name="OptMultiplier">The strength multiplier at the optimal mass.</param>
/// <param name="MaxMultiplier">The largest strength multiplier, reached at the minimum mass.</param>
/// <remarks>
/// <para>
/// Every curve value is optional, because a catalogue record is what a caller normally has. A
/// generator missing any of the six cannot be placed on the curve at all and raises no shield.
/// </para>
/// <para>
/// A generator that carries all six is held to the curve's shape, which <see cref="IMassCurve"/>
/// documents. Anything else is refused rather than answered with a plausible-looking number.
/// </para>
/// <para>
/// The optimal multiplier is what a Reinforced or Thermic recipe moves, and the optimal mass what
/// Enhanced Low Power moves. A recipe names those two alone and the four endpoints follow them, so
/// pass the whole moved curve rather than a moved optimum on stock endpoints.
/// </para>
/// </remarks>
public sealed record ShieldGeneratorParams(
    double? MinMass = null,
    double? OptMass = null,
    double? MaxMass = null,
    double? MinMultiplier = null,
    double? OptMultiplier = null,
    double? MaxMultiplier = null)
{
    /// <summary>The generator's own resistances, each a fraction. A negative figure is a weakness.</summary>
    public DamageTypeValues Resistances { get; init; } = DamageTypeValues.None;

    /// <summary>Reads a generator's curve and resistances off a module's stats.</summary>
    /// <param name="stats">The module's stats, post-engineering.</param>
    /// <returns>The generator constants the stats carry.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="stats"/> is <see langword="null"/>.</exception>
    public static ShieldGeneratorParams FromStats(ModuleStats stats)
    {
        if (stats is null) throw new ArgumentNullException(nameof(stats));

        return new ShieldGeneratorParams(
            MinMass: stats[ModuleStat.MinMass],
            OptMass: stats[ModuleStat.OptMass],
            MaxMass: stats[ModuleStat.MaxMass],
            MinMultiplier: stats[ModuleStat.MinMultiplier],
            OptMultiplier: stats[ModuleStat.OptMultiplier],
            MaxMultiplier: stats[ModuleStat.MaxMultiplier])
        {
            Resistances = ResistancesFrom(stats),
        };
    }

    /// <summary>The four resistances a module's stats state, reading an absent one as none.</summary>
    /// <param name="stats">The module's stats.</param>
    /// <returns>The four figures in one record.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="stats"/> is <see langword="null"/>.</exception>
    internal static DamageTypeValues ResistancesFrom(ModuleStats stats) => new(
        Kinetic: stats[ModuleStat.KineticResistance] ?? 0,
        Thermal: stats[ModuleStat.ThermalResistance] ?? 0,
        Explosive: stats[ModuleStat.ExplosiveResistance] ?? 0,
        Caustic: stats[ModuleStat.CausticResistance] ?? 0);
}

/// <summary>One fitted, powered shield booster's contribution.</summary>
/// <param name="ShieldBoost">The strength bonus, as a fraction. A fifth is a twenty percent boost.</param>
public sealed record ShieldBoosterParams(double ShieldBoost = 0)
{
    /// <summary>The booster's own resistances, each a fraction.</summary>
    public DamageTypeValues Resistances { get; init; } = DamageTypeValues.None;

    /// <summary>Reads a booster's bonus and resistances off a module's stats.</summary>
    /// <param name="stats">The module's stats, post-engineering.</param>
    /// <returns>The booster constants the stats carry.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="stats"/> is <see langword="null"/>.</exception>
    public static ShieldBoosterParams FromStats(ModuleStats stats)
    {
        if (stats is null) throw new ArgumentNullException(nameof(stats));

        return new ShieldBoosterParams(stats[ModuleStat.ShieldBoost] ?? 0)
        {
            Resistances = ShieldGeneratorParams.ResistancesFrom(stats),
        };
    }
}

/// <summary>Everything a shield calculation needs about a build.</summary>
/// <param name="HullMass">
/// The hull's mass, in tonnes, and not the build's unladen mass. Shields scale with the hull
/// alone, so fitted modules and cargo never weaken them.
/// </param>
/// <param name="BaseShieldStrength">The hull's base shield strength, in megajoules.</param>
public sealed record ShieldInput(double HullMass, double BaseShieldStrength)
{
    /// <summary>The fitted shield generator, or <see langword="null"/> when the build has none.</summary>
    public ShieldGeneratorParams? Generator { get; init; }

    /// <summary>Each fitted, powered shield booster.</summary>
    public IReadOnlyList<ShieldBoosterParams>? Boosters { get; init; }

    /// <summary>
    /// The megajoules Guardian shield reinforcement packages add flat, summed.
    /// </summary>
    /// <remarks>
    /// This addition is not multiplied by the generator's curve or by the boosters. It is a flat
    /// top-up, and it stands alone where the generator's curve contributes nothing, as it does for
    /// a hull past the generator's maximum mass. With no generator fitted it is dropped entirely.
    /// </remarks>
    public double Reinforcement { get; init; }
}

/// <summary>A build's shield strength, where it comes from, and what it resists.</summary>
/// <param name="Strength">The total shield strength, in megajoules.</param>
/// <param name="Generator">The generator's own contribution, in megajoules.</param>
/// <param name="Boosters">What the boosters add on top of the generator, in megajoules.</param>
/// <param name="Reinforcement">
/// What Guardian shield reinforcement packages add, in megajoules. It is zero with no generator,
/// whatever was passed, because a package has no shield to reinforce.
/// </param>
/// <param name="MassCurveMultiplier">The generator's strength multiplier at this hull mass.</param>
/// <param name="BoostMultiplier">
/// The boosters' combined multiplier, which is one with none fitted. It is one with no generator
/// too, whatever boosters are fitted, because there is no generator strength to multiply.
/// </param>
/// <param name="Resistances">
/// The effective resistances, generator and boosters stacked with diminishing returns. The SYS
/// pips are not in these: they belong to the capacitor, and <see cref="ShieldCapacitor"/> folds
/// them in.
/// </param>
/// <param name="EffectiveHitPoints">
/// The raw damage of each type the shield can soak, in megajoules. It is infinite where a
/// resistance reaches the whole of that damage type.
/// </param>
/// <remarks>
/// The resistances are fractions rather than percentages, and they are unrounded. The stacking is
/// floating-point arithmetic, so a nominal weakness of a fifth reads a hair off it. Round where
/// the figure is displayed, not before it is composed further.
/// </remarks>
public sealed record ShieldMetrics(
    double Strength,
    double Generator,
    double Boosters,
    double Reinforcement,
    double MassCurveMultiplier,
    double BoostMultiplier,
    DamageTypeValues Resistances,
    DamageTypeValues EffectiveHitPoints);

/// <summary>
/// Shield strength in megajoules, and the resistances that decide what that strength is worth
/// against each damage type.
/// </summary>
/// <remarks>
/// <para>
/// A generator's strength multiplier is read off a curve against the ship's hull mass: the bare
/// hull, and not the loaded ship, so fitting more modules never weakens the shields. Past the
/// generator's maximum mass it raises no shield at all.
/// </para>
/// <para>
/// Resistances stack separately, with their own diminishing returns, in
/// <see cref="Resistances"/>. Everything here is pip-free. The SYS capacitor's own resistance,
/// and the effective figures it buys, are in <see cref="ShieldCapacitor"/>.
/// </para>
/// <para>
/// Reference implementation: EDCD/Coriolis, <c>src/app/shipyard/Calculations.js</c>. The algorithm
/// is ported as fact rather than as code. See <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class Shields
{
    /// <summary>A shield generator's strength multiplier at a given hull mass.</summary>
    /// <param name="hullMass">The hull's mass, in tonnes, and not the loaded ship's.</param>
    /// <param name="generator">The generator's curve, post-engineering.</param>
    /// <returns>
    /// The multiplier to apply to the hull's base shield strength. It is zero past the generator's
    /// maximum mass, because a generator cannot raise a shield around a hull heavier than it is
    /// rated for, and zero for a generator whose record is missing part of its curve.
    /// </returns>
    /// <remarks>
    /// This is the same curve <see cref="Mobility.ThrusterMassCurveMultiplier"/> reads a
    /// thruster's performance off, and the two agree on every input they both accept.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="generator"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The hull mass is not a finite number of zero or more, or the generator carries all six
    /// curve values and they are not a physical curve. A curve that is merely absent still answers
    /// zero: a record missing a value is data that is missing, not data that is wrong.
    /// </exception>
    public static double MassCurveMultiplier(double hullMass, ShieldGeneratorParams generator) =>
        CurveMultiplier(hullMass, generator, nameof(hullMass), nameof(generator));

    /// <summary>A build's shield strength, in megajoules.</summary>
    /// <param name="hullMass">The hull's mass, in tonnes.</param>
    /// <param name="baseShieldStrength">The hull's base shield strength, in megajoules.</param>
    /// <param name="generator">The fitted generator, post-engineering.</param>
    /// <param name="boostMultiplier">The boosters' combined multiplier, which is one with none fitted.</param>
    /// <returns>
    /// The shield's megajoules, before any Guardian reinforcement addition. It is zero wherever
    /// <see cref="MassCurveMultiplier"/> is.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="generator"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The hull mass is not a finite number of zero or more, or the generator carries a complete
    /// but non-physical curve.
    /// </exception>
    public static double Strength(
        double hullMass,
        double baseShieldStrength,
        ShieldGeneratorParams generator,
        double boostMultiplier = 1) =>
        baseShieldStrength
        * CurveMultiplier(hullMass, generator, nameof(hullMass), nameof(generator))
        * boostMultiplier;

    /// <summary>
    /// A build's bare shields: the strength, where it comes from, and the resistances the
    /// generator and the boosters stack up between them.
    /// </summary>
    /// <param name="input">
    /// The hull's mass and base shield strength, the fitted generator, and any powered boosters
    /// and Guardian reinforcement.
    /// </param>
    /// <returns>
    /// The build's shield metrics. With no generator fitted there is no shield for a resistance to
    /// apply to: every strength figure is zero, any reinforcement passed is dropped, and the
    /// resistances and the effective hit points are zero for every damage type.
    /// </returns>
    /// <remarks>
    /// These are the pip-free figures, the ones an outfitting screen shows. The SYS capacitor is a
    /// separate story with its own entry point, <see cref="ShieldCapacitor.Metrics"/>, which takes
    /// what this answers and folds a pip allocation into it.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// With a generator fitted, the hull mass is not a finite number of zero or more, or the
    /// generator carries a complete but non-physical curve. A generator whose record is simply
    /// missing part of its curve is not a failure: the hull mass is never read, and every strength
    /// figure is zero.
    /// </exception>
    public static ShieldMetrics Metrics(ShieldInput input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));

        if (input.Generator is null)
        {
            return new ShieldMetrics(
                Strength: 0,
                Generator: 0,
                Boosters: 0,
                Reinforcement: 0,
                MassCurveMultiplier: 0,
                BoostMultiplier: 1,
                Resistances: DamageTypeValues.None,
                EffectiveHitPoints: Resistances.EffectiveHitPoints(
                    0, DamageTypeValues.None));
        }

        IReadOnlyList<ShieldBoosterParams> boosters = input.Boosters ?? [];
        double massCurveMultiplier = CurveMultiplier(
            input.HullMass, input.Generator, "input.HullMass", "input.Generator");

        double boost = 0;
        foreach (ShieldBoosterParams booster in boosters) boost += booster.ShieldBoost;
        double boostMultiplier = 1 + boost;

        double generatorStrength = input.BaseShieldStrength * massCurveMultiplier;
        double boostersStrength = generatorStrength * (boostMultiplier - 1);
        double strength = generatorStrength + boostersStrength + input.Reinforcement;

        DamageTypeValues resistances = Resistances.MapDamageTypes(
            type =>
            {
                var boosterResistances = new List<double>(boosters.Count);
                foreach (ShieldBoosterParams booster in boosters)
                {
                    boosterResistances.Add(booster.Resistances[type]);
                }

                return Resistances.StackShieldResistance(
                    input.Generator.Resistances[type], boosterResistances);
            });

        return new ShieldMetrics(
            Strength: strength,
            Generator: generatorStrength,
            Boosters: boostersStrength,
            Reinforcement: input.Reinforcement,
            MassCurveMultiplier: massCurveMultiplier,
            BoostMultiplier: boostMultiplier,
            Resistances: resistances,
            EffectiveHitPoints: Resistances.EffectiveHitPoints(
                strength, resistances));
    }

    /// <summary>
    /// The generator's multiplier. A record missing part of its curve is not a failure: it is a
    /// generator the catalogue cannot place on a curve, so it raises no shield rather than a
    /// fabricated one.
    /// </summary>
    private static double CurveMultiplier(
        double hullMass, ShieldGeneratorParams generator, string massName, string curveName)
    {
        if (generator is null) throw new ArgumentNullException(curveName);

        if (generator.MinMass is not double minMass
            || generator.OptMass is not double optMass
            || generator.MaxMass is not double maxMass
            || generator.MinMultiplier is not double minMultiplier
            || generator.OptMultiplier is not double optMultiplier
            || generator.MaxMultiplier is not double maxMultiplier)
        {
            return 0;
        }

        // A hull heavier than the generator's maximum is handled by the shared curve, which
        // answers zero there: the generator simply will not engage.
        return MassCurve.MultiplierAt(
            hullMass,
            new MassCurve.Values(minMass, optMass, maxMass, minMultiplier, optMultiplier, maxMultiplier),
            massName,
            curveName);
    }
}
