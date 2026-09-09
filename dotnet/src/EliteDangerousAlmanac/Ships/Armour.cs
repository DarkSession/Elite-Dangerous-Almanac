using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The fitted bulkhead's contribution, read straight off its armour module record.</summary>
/// <param name="HullBoost">
/// The armour bonus as a fraction of the hull's base armour, added on top of it. Lightweight
/// alloy's 0.8 means the hull carries 1.8 times its base armour.
/// </param>
/// <param name="Resistances">
/// The bulkhead's own resistances, as fractions. A negative figure is a weakness.
/// </param>
public sealed record BulkheadParams(double HullBoost = 0, DamageTypeValues? Resistances = null);

/// <summary>One fitted hull reinforcement package, the Guardian and meta-alloy ones included.</summary>
/// <param name="HullReinforcement">The hull hit points the package adds.</param>
/// <param name="HullBoost">
/// Extra armour as a fraction of the hull's base armour, when the package has been engineered for
/// it. A stock package has none, because in game the engineering modifier is the whole bonus.
/// </param>
/// <param name="Resistances">The package's own resistances, as fractions.</param>
public sealed record HullReinforcementParams(
    double HullReinforcement = 0,
    double HullBoost = 0,
    DamageTypeValues? Resistances = null);

/// <summary>One fitted module reinforcement package.</summary>
/// <param name="ModuleProtection">The fraction of module damage the package absorbs.</param>
/// <param name="Integrity">The package's own integrity, which soaks module damage.</param>
public sealed record ModuleReinforcementParams(double ModuleProtection = 0, double Integrity = 0);

/// <summary>Everything an armour calculation needs about a build.</summary>
/// <param name="BaseArmour">The hull's base armour, in hull points.</param>
/// <param name="Bulkhead">
/// The fitted bulkhead. An absent bulkhead means no armour bonus and no resistances, so the hull
/// reports its bare base armour. No ship in the game flies like that, so pass the hull's own
/// stock armour record to model one that does.
/// </param>
/// <param name="Reinforcements">Each fitted, powered hull reinforcement package.</param>
/// <param name="ModuleReinforcements">Each fitted, powered module reinforcement package.</param>
public sealed record ArmourInput(
    double BaseArmour,
    BulkheadParams? Bulkhead = null,
    IReadOnlyList<HullReinforcementParams>? Reinforcements = null,
    IReadOnlyList<ModuleReinforcementParams>? ModuleReinforcements = null);

/// <summary>A build's armour: hit points, where they come from, and what the hull resists.</summary>
/// <param name="HitPoints">The total hull hit points.</param>
/// <param name="Bulkheads">What the bulkhead alone gives.</param>
/// <param name="Reinforcement">What the hull reinforcement packages add.</param>
/// <param name="Resistances">
/// The effective resistances, bulkhead and reinforcement stacked with diminishing returns. They
/// are fractions rather than percentages, and unrounded: the stacking is floating-point
/// arithmetic. Round where the figure is displayed, not before it is composed further.
/// </param>
/// <param name="EffectiveHitPoints">
/// The raw damage of each type the hull can soak, which is infinite where a resistance reaches
/// one hundred percent.
/// </param>
/// <param name="ModuleArmour">Hit points the module reinforcement packages add to the modules.</param>
/// <param name="ModuleProtection">
/// The fraction of module damage the module reinforcement packages absorb, stacked
/// multiplicatively. It is zero with none fitted.
/// </param>
public sealed record ArmourMetrics(
    double HitPoints,
    double Bulkheads,
    double Reinforcement,
    DamageTypeValues Resistances,
    DamageTypeValues EffectiveHitPoints,
    double ModuleArmour,
    double ModuleProtection);

/// <summary>The hull's hit points and the resistances that decide how far they go.</summary>
/// <remarks>
/// <para>
/// A hull starts from its base armour, which the fitted bulkhead multiplies, and each hull
/// reinforcement package adds a flat number of hit points on top. The bulkhead also sets the
/// hull's four resistances, which the reinforcement packages stack onto with diminishing returns.
/// A module reinforcement package protects the modules rather than the hull, and is reported
/// separately.
/// </para>
/// <para>
/// This type holds no data. The reference implementation is EDCD coriolis, and the algorithm is
/// ported as fact rather than as code; see <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
public static class Armour
{
    /// <summary>Everything an outfitting screen shows about a build's armour.</summary>
    /// <param name="input">
    /// The hull's base armour, the fitted bulkhead, and any hull and module reinforcement
    /// packages.
    /// </param>
    /// <returns>The build's armour.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    public static ArmourMetrics Metrics(ArmourInput input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));

        BulkheadParams bulkhead = input.Bulkhead ?? new BulkheadParams();
        IReadOnlyList<HullReinforcementParams> reinforcements = input.Reinforcements ?? [];
        IReadOnlyList<ModuleReinforcementParams> moduleReinforcements = input.ModuleReinforcements ?? [];

        double bulkheads = input.BaseArmour * (1 + bulkhead.HullBoost);
        double reinforcement = 0;
        foreach (HullReinforcementParams pack in reinforcements)
        {
            reinforcement += pack.HullReinforcement + (input.BaseArmour * pack.HullBoost);
        }

        double hitPoints = bulkheads + reinforcement;
        DamageTypeValues resistances = Resistances.MapDamageTypes(type =>
        {
            List<double> stacked = new(reinforcements.Count);
            foreach (HullReinforcementParams pack in reinforcements)
            {
                stacked.Add((pack.Resistances ?? DamageTypeValues.None)[type]);
            }

            return Ships.Resistances.StackArmourResistance(
                (bulkhead.Resistances ?? DamageTypeValues.None)[type], stacked);
        });

        double moduleArmour = 0;
        double moduleDamage = 1;
        foreach (ModuleReinforcementParams pack in moduleReinforcements)
        {
            moduleArmour += pack.Integrity;
            moduleDamage *= 1 - pack.ModuleProtection;
        }

        return new ArmourMetrics(
            hitPoints,
            bulkheads,
            reinforcement,
            resistances,
            Ships.Resistances.EffectiveHitPoints(hitPoints, resistances),
            moduleArmour,
            1 - moduleDamage);
    }
}
