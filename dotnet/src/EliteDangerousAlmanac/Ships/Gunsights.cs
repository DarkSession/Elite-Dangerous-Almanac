using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One fixed weapon's camera-relative origin, in metres.</summary>
/// <param name="HorizontalMetres">The horizontal offset. A positive figure points right.</param>
/// <param name="VerticalMetres">The vertical offset. A positive figure points up.</param>
/// <remarks>
/// Divide each figure by a target range in metres to obtain the corresponding angular tangent.
/// </remarks>
public sealed record GunsightOffset(double HorizontalMetres, double VerticalMetres);

/// <summary>A projected fixed-weapon point, relative to the cockpit's forward direction.</summary>
/// <param name="HorizontalTangent">The horizontal angular tangent. A positive figure points right.</param>
/// <param name="VerticalTangent">The vertical angular tangent. A positive figure points up.</param>
/// <remarks>Both figures have no unit.</remarks>
public sealed record GunsightPoint(double HorizontalTangent, double VerticalTangent);

/// <summary>The fixed-weapon frontal gunsights for every player-flyable ship.</summary>
/// <remarks>
/// <para>
/// The catalogue keeps only the geometry needed to place each hardpoint at any target range: a
/// horizontal and a vertical offset from the cockpit, both in metres.
/// </para>
/// <para>
/// A hull's offsets follow its own hardpoints in exactly the same order, which is why this
/// compact catalogue does not repeat the slot names. Pair an offset with the hardpoint at the
/// same position. The number in a journal slot key is not that position: some hulls skip or
/// reorder those numbers, so resolve a journal key through the hull's enumerated slots first.
/// </para>
/// <para>The offsets are observed in-game. See <c>data/ships/SOURCES.md</c>.</para>
/// </remarks>
public static class Gunsights
{
    private static readonly Lazy<IReadOnlyDictionary<string, IReadOnlyList<GunsightOffset>>>
        Catalogue = new(Load);

    /// <summary>Every hull's fixed-weapon offsets, keyed by hull symbol.</summary>
    /// <remarks>
    /// It covers every hardpoint of every player-flyable hull. The map and its lists refuse
    /// mutation.
    /// </remarks>
    public static IReadOnlyDictionary<string, IReadOnlyList<GunsightOffset>> All => Catalogue.Value;

    /// <summary>Looks up a hull's gunsight by its internal symbol, ignoring case.</summary>
    /// <param name="shipSymbol">
    /// The hull symbol. Leading and trailing whitespace and letter case are ignored.
    /// </param>
    /// <returns>The hull's offsets, or <see langword="null"/> where the hull is unknown.</returns>
    public static IReadOnlyList<GunsightOffset>? Find(string? shipSymbol) =>
        RegistryIndex.FindInKeyIndex(All, shipSymbol);

    /// <summary>Projects a gunsight onto a target plane at a chosen range.</summary>
    /// <param name="gunsight">The camera-relative hardpoint offsets, in metres.</param>
    /// <param name="targetRangeMetres">The target-plane distance, in metres, which must be above zero.</param>
    /// <returns>
    /// One angular-tangent point per offset, in the order the offsets came. To place a point on a
    /// perspective display, divide each tangent by the tangent of the corresponding half field of
    /// view, and invert the vertical result where screen coordinates increase downwards.
    /// </returns>
    /// <remarks>
    /// This is fixed, ship-forward geometry. It does not model gimbal or turret tracking,
    /// projectile travel, target motion, or head-look.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="gunsight"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The target range is not a finite number above zero.
    /// </exception>
    public static IReadOnlyList<GunsightPoint> Project(
        IReadOnlyList<GunsightOffset> gunsight, double targetRangeMetres)
    {
        if (gunsight is null) throw new ArgumentNullException(nameof(gunsight));
        if (double.IsNaN(targetRangeMetres)
            || double.IsInfinity(targetRangeMetres)
            || targetRangeMetres <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(targetRangeMetres),
                targetRangeMetres,
                "The value must be a finite number above 0.");
        }

        var points = new List<GunsightPoint>(gunsight.Count);
        foreach (GunsightOffset offset in gunsight)
        {
            if (offset is null) throw new ArgumentNullException(nameof(gunsight));

            points.Add(new GunsightPoint(
                offset.HorizontalMetres / targetRangeMetres,
                offset.VerticalMetres / targetRangeMetres));
        }

        return new ReadOnlyCollection<GunsightPoint>(points);
    }

    private static ReadOnlyDictionary<string, IReadOnlyList<GunsightOffset>> Load()
    {
        var file = SharedData.Load<Dictionary<string, double[][]>>("data/ships/gunsights.jsonc");
        Dictionary<string, IReadOnlyList<GunsightOffset>> hulls = [];
        foreach (KeyValuePair<string, double[][]> hull in file)
        {
            var offsets = new List<GunsightOffset>(hull.Value.Length);
            foreach (double[] pair in hull.Value)
            {
                offsets.Add(new GunsightOffset(pair[0], pair[1]));
            }

            hulls[hull.Key] = new ReadOnlyCollection<GunsightOffset>(offsets);
        }

        return RegistryIndex.FreezeByRawKey<IReadOnlyList<GunsightOffset>>(hulls);
    }
}
