using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The limit facts one fitted module carries.</summary>
/// <param name="LimitGroup">The per-ship count family this module consumes a place in, if any.</param>
/// <param name="LimitIncrease">The allowance increase this module grants, if any.</param>
/// <remarks>One module can carry both: it can consume a place and raise the allowance.</remarks>
public sealed record ModuleLimitEntry(
    ModuleLimitGroup? LimitGroup = null,
    ModuleLimitIncrease? LimitIncrease = null)
{
    /// <summary>Reads the limit facts off a catalogue or fitted module.</summary>
    /// <param name="module">The module.</param>
    /// <returns>The entry the module carries.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="module"/> is <see langword="null"/>.</exception>
    public static ModuleLimitEntry FromModule(OutfittingModule module)
    {
        if (module is null) throw new ArgumentNullException(nameof(module));

        return new ModuleLimitEntry(module.LimitGroup, module.LimitIncrease);
    }
}

/// <summary>One per-ship limit family's resolved allowance and fitted usage.</summary>
/// <param name="Group">The limit family.</param>
/// <param name="BaseLimit">The allowance before any fitted increase.</param>
/// <param name="Increase">The sum of the increases the fitted modules grant.</param>
/// <param name="Limit">The effective allowance, which is the base and the increase together.</param>
/// <param name="Count">The fitted modules consuming the allowance.</param>
/// <param name="Excess">The modules above the effective allowance, and none where the build is within it.</param>
public sealed record ModuleLimitUsage(
    ModuleLimitGroup Group,
    int BaseLimit,
    int Increase,
    int Limit,
    int Count,
    int Excess);

/// <summary>The per-ship module-count limits.</summary>
/// <remarks>
/// The base allowances and the fitted increases reproduce EDSY's own model. See
/// <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </remarks>
public static class ModuleLimits
{
    private static readonly ReadOnlyDictionary<ModuleLimitGroup, int> BaseLimits =
        new(new Dictionary<ModuleLimitGroup, int>
        {
            [ModuleLimitGroup.ExperimentalWeapon] = 4,
        });

    /// <summary>The modules allowed in each per-ship limit family, before any fitted increase.</summary>
    /// <remarks>
    /// Every figure is a whole-module count above zero. A fitted increase raises this base, so
    /// read <see cref="Calculate"/> for the effective allowance rather than adding grants by hand.
    /// </remarks>
    public static IReadOnlyDictionary<ModuleLimitGroup, int> ShipLimits => BaseLimits;

    /// <summary>Resolves every per-ship allowance for one fitted module list.</summary>
    /// <param name="modules">
    /// The fitted modules reduced to their limit facts. Every entry carrying a limit group
    /// consumes one place, and every increase raises the family it names.
    /// </param>
    /// <returns>One usage record for every known family, in the order the base limits state them.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="modules"/> is <see langword="null"/>.</exception>
    public static IReadOnlyList<ModuleLimitUsage> Calculate(IReadOnlyList<ModuleLimitEntry> modules)
    {
        if (modules is null) throw new ArgumentNullException(nameof(modules));

        Dictionary<ModuleLimitGroup, int> counts = [];
        Dictionary<ModuleLimitGroup, int> increases = [];
        foreach (ModuleLimitEntry module in modules)
        {
            if (module is null) throw new ArgumentNullException(nameof(modules));

            if (module.LimitGroup is ModuleLimitGroup consumed)
            {
                counts[consumed] = (counts.TryGetValue(consumed, out int held) ? held : 0) + 1;
            }

            if (module.LimitIncrease is ModuleLimitIncrease granted)
            {
                increases[granted.Group] =
                    (increases.TryGetValue(granted.Group, out int added) ? added : 0) + granted.Amount;
            }
        }

        var usage = new List<ModuleLimitUsage>(BaseLimits.Count);
        foreach (KeyValuePair<ModuleLimitGroup, int> family in BaseLimits)
        {
            int increase = increases.TryGetValue(family.Key, out int raised) ? raised : 0;
            int limit = family.Value + increase;
            int count = counts.TryGetValue(family.Key, out int fitted) ? fitted : 0;
            usage.Add(new ModuleLimitUsage(
                Group: family.Key,
                BaseLimit: family.Value,
                Increase: increase,
                Limit: limit,
                Count: count,
                Excess: Math.Max(0, count - limit)));
        }

        return new ReadOnlyCollection<ModuleLimitUsage>(usage);
    }
}
