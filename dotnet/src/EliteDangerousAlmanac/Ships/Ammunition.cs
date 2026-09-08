using System;

namespace EliteDangerousAlmanac.Ships;

/// <summary>What a module holds when fully rearmed.</summary>
/// <param name="ClipSize">
/// The rounds a full magazine holds, and the largest loaded clip a journal can report for this
/// module. It is nothing on a module with no magazine, whose whole capacity is the reserve and is
/// drawn from directly: a maintenance unit carries its repair units with no clip to load them into.
/// </param>
/// <param name="Hopper">
/// The reserve rounds behind the magazine, and the largest hopper a journal can report. It does
/// not include the magazine, exactly as the journal's own field does not. It is infinite where
/// nothing limits it.
/// </param>
/// <param name="Total">
/// The rounds carried when fully rearmed, which is the magazine and the reserve together.
/// </param>
/// <param name="Unlimited">
/// Whether the reserve is unlimited, which is where the record states a magazine but no reserve to
/// refill it from.
/// </param>
/// <remarks>
/// A reserve of nothing is a different answer and reads as one. A weapon can carry no reserve
/// behind its magazine, and the Plasma Slug effect drives a rail gun's reserve to nothing because
/// the weapon then reloads from the ship's fuel, which is a tank this does not model.
/// </remarks>
public sealed record AmmunitionCapacity(
    double ClipSize,
    double Hopper,
    double Total,
    bool Unlimited);

/// <summary>
/// How many rounds a module holds when fully rearmed: the magazine, the reserve behind it, and the
/// two together.
/// </summary>
/// <remarks>
/// <para>
/// A journal reports what is loaded right now. This reports what the module can hold, which is a
/// property of the build rather than of the moment it was captured.
/// </para>
/// <para>
/// It is not only weapons. Chaff, heat-sink and caustic-sink launchers, point defence, shield cell
/// banks and maintenance units all carry a reserve, and are answered here on the same terms.
/// </para>
/// </remarks>
public static class Ammunition
{
    /// <summary>What a module holds when fully rearmed.</summary>
    /// <param name="stats">
    /// The module's stats. A catalogue record works as it comes, and a post-engineering record
    /// answers the capacity a build actually flies with.
    /// </param>
    /// <returns>
    /// The capacity, or <see langword="null"/> for a module that carries no ammunition at all: the
    /// lasers, which state neither figure because they draw from the weapons capacitor instead.
    /// </returns>
    /// <remarks>
    /// The figures are reported as the stats give them. Where engineering is simulated, its
    /// calculator makes both figures whole: a clip rounds up to a whole burst and a reserve rounds
    /// to the nearest whole round. A journal states the engineered figures itself, so imported
    /// values pass through untouched.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="stats"/> is <see langword="null"/>.</exception>
    public static AmmunitionCapacity? Capacity(ModuleStats stats)
    {
        if (stats is null) throw new ArgumentNullException(nameof(stats));

        double? clipSize = stats[ModuleStat.ClipSize];
        double? ammoMaximum = stats[ModuleStat.AmmoMaximum];
        if (clipSize is null && ammoMaximum is null) return null;

        double clip = clipSize ?? 0;
        // A magazine with no reserve stated is one nothing stops refilling. A reserve with no
        // magazine stated is drawn from directly. One of the two is always stated, so the reserve
        // is a number wherever it is not unlimited.
        bool unlimited = ammoMaximum is null;
        double hopper = unlimited ? double.PositiveInfinity : ammoMaximum!.Value;

        return new AmmunitionCapacity(clip, hopper, clip + hopper, unlimited);
    }

    /// <summary>What a module holds when fully rearmed.</summary>
    /// <param name="module">The module, post-engineering.</param>
    /// <returns>The capacity, or <see langword="null"/> for a module that carries no ammunition.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="module"/> is <see langword="null"/>.</exception>
    public static AmmunitionCapacity? Capacity(OutfittingModule module)
    {
        if (module is null) throw new ArgumentNullException(nameof(module));

        return Capacity(module.Stats);
    }

    /// <summary>What a fitted weapon holds when fully rearmed.</summary>
    /// <param name="weapon">The weapon's resolved firing stats, post-engineering.</param>
    /// <returns>
    /// The capacity, or <see langword="null"/> for a weapon that carries no ammunition.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="weapon"/> is <see langword="null"/>.</exception>
    public static AmmunitionCapacity? Capacity(WeaponStats weapon)
    {
        if (weapon is null) throw new ArgumentNullException(nameof(weapon));
        if (weapon.ClipSize is null && weapon.AmmoMaximum is null) return null;

        double clip = weapon.ClipSize ?? 0;
        bool unlimited = weapon.AmmoMaximum is null;
        double hopper = unlimited ? double.PositiveInfinity : weapon.AmmoMaximum!.Value;

        return new AmmunitionCapacity(clip, hopper, clip + hopper, unlimited);
    }
}
