using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>Scales the exact damage amounts a weapon's round carries.</summary>
internal static class DamageComponentScaling
{
    /// <summary>Scales exact damage components by the same ratio as the weapon's total damage.</summary>
    /// <param name="components">The stock amounts.</param>
    /// <param name="baseDamage">The stock damage, when the module states one.</param>
    /// <param name="effectiveDamage">The engineered damage, when there is one.</param>
    /// <returns>The scaled amounts.</returns>
    /// <remarks>
    /// A missing or zero base, or a missing effective value, leaves the components at their stock
    /// amounts, because there is no meaningful ratio to apply. Whether a damage conversion
    /// replaces the components altogether stays the caller's decision.
    /// </remarks>
    internal static DamageComponents Scale(
        DamageComponents components,
        double? baseDamage,
        double? effectiveDamage)
    {
        double scale = baseDamage is not null and not 0 && effectiveDamage is not null
            ? effectiveDamage.Value / baseDamage.Value
            : 1;

        IReadOnlyList<double>? unclassified = null;
        if (components.Unclassified is not null)
        {
            List<double> scaled = new(components.Unclassified.Count);
            foreach (double amount in components.Unclassified) scaled.Add(amount * scale);
            unclassified = new ReadOnlyCollection<double>(scaled);
        }

        return new DamageComponents(
            components.Kinetic * scale,
            components.Thermal * scale,
            components.Explosive * scale,
            components.Absolute * scale,
            components.AntiXeno * scale,
            unclassified);
    }
}
