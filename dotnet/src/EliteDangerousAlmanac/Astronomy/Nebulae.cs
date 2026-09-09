using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>How the catalogue classes one nebula.</summary>
public enum NebulaType
{
    /// <summary>A real nebula or dark region the game models under its own name.</summary>
    Real,

    /// <summary>A planetary nebula, catalogued at the system it surrounds.</summary>
    Planetary,

    /// <summary>A nebula the generator made, catalogued at a system beside it.</summary>
    Procgen,
}

/// <summary>One catalogued nebula, and where in the galaxy it sits.</summary>
/// <param name="Name">
/// The display name. A nebula the generator made usually carries its system's name, and
/// sometimes a community name after it in brackets.
/// </param>
/// <param name="System">The system the nebula is catalogued at.</param>
/// <param name="X">The system's galactic X in light years, with Sol at the origin.</param>
/// <param name="Y">The system's galactic Y in light years.</param>
/// <param name="Z">The system's galactic Z in light years.</param>
/// <param name="Type">Which class of nebula this is.</param>
/// <param name="RegionId">
/// The number of the codex region the nebula sits in, one through 42, which
/// <see cref="CodexRegions.Find"/> reads.
/// </param>
/// <remarks>
/// A nebula fills space, and the catalogue records one point of it: where its system is.
/// A distance from that point is therefore a distance to the system, and not to the edge
/// of the cloud.
/// </remarks>
public record Nebula(
    string Name,
    string System,
    double X,
    double Y,
    double Z,
    NebulaType Type,
    int RegionId);

/// <summary>One catalogued nebula, and how far it is from a place that was asked about.</summary>
/// <param name="Name">The display name.</param>
/// <param name="System">The system the nebula is catalogued at.</param>
/// <param name="X">The system's galactic X in light years, with Sol at the origin.</param>
/// <param name="Y">The system's galactic Y in light years.</param>
/// <param name="Z">The system's galactic Z in light years.</param>
/// <param name="Type">Which class of nebula this is.</param>
/// <param name="RegionId">The number of the codex region the nebula sits in.</param>
/// <param name="DistanceLy">The straight-line distance from the place asked about, in light years.</param>
public sealed record NebulaNearby(
    string Name,
    string System,
    double X,
    double Y,
    double Z,
    NebulaType Type,
    int RegionId,
    double DistanceLy)
    : Nebula(Name, System, X, Y, Z, Type, RegionId);

/// <summary>The nebula catalogues, and the searches that read them.</summary>
/// <remarks>
/// <para>
/// The game models thousands of nebulae, in three classes. <see cref="Real"/> holds the
/// real nebulae and dark regions a commander recognises, and it is the one most callers
/// want. <see cref="Planetary"/> is by far the largest, and <see cref="Procgen"/> holds
/// the ones the generator made. <see cref="All"/> is the three of them together.
/// </para>
/// <para>
/// Every search takes the catalogue to read. Nearly all of <see cref="All"/> is planetary
/// nebulae that most callers never touch, so there is no one catalogue worth reading
/// without being asked to.
/// </para>
/// <para>
/// Positions are light years with Sol at the origin, which is the frame a journal, EDSM
/// and Spansh report. The catalogue comes from EDAstro. See <c>ATTRIBUTIONS.md</c> for
/// credit and licence terms.
/// </para>
/// </remarks>
public static class NebulaCatalogue
{
    private static readonly Lazy<IReadOnlyList<Nebula>> RealNebulae = new(
        () => Build("data/astro/nebulae-real.jsonc", NebulaType.Real));

    private static readonly Lazy<IReadOnlyList<Nebula>> PlanetaryNebulae = new(
        () => Build("data/astro/nebulae-planetary.jsonc", NebulaType.Planetary));

    private static readonly Lazy<IReadOnlyList<Nebula>> ProcgenNebulae = new(
        () => Build("data/astro/nebulae-procgen.jsonc", NebulaType.Procgen));

    private static readonly Lazy<IReadOnlyList<Nebula>> AllNebulae = new(BuildAll);

    /// <summary>Every real nebula and dark region the game names, in order of name.</summary>
    public static IReadOnlyList<Nebula> Real => RealNebulae.Value;

    /// <summary>Every planetary nebula, in order of name.</summary>
    public static IReadOnlyList<Nebula> Planetary => PlanetaryNebulae.Value;

    /// <summary>Every nebula the generator made, in order of name.</summary>
    public static IReadOnlyList<Nebula> Procgen => ProcgenNebulae.Value;

    /// <summary>Every catalogued nebula: the real, the planetary and the generated ones.</summary>
    /// <remarks>Read <see cref="Nebula.Type"/> to narrow it down afterwards.</remarks>
    public static IReadOnlyList<Nebula> All => AllNebulae.Value;

    /// <summary>Reads the nebulae nearest one place, nearest first.</summary>
    /// <param name="position">The place to measure from, in light years, with Sol at the origin.</param>
    /// <param name="nebulae">The catalogue to read.</param>
    /// <param name="count">
    /// How many to answer with. A count of zero or below answers with none, and a count
    /// past the catalogue answers with the whole of it.
    /// </param>
    /// <returns>
    /// Up to <paramref name="count"/> nebulae, in order of distance. Two at the same
    /// distance keep the order the catalogue holds them in. The catalogue is left alone.
    /// </returns>
    /// <exception cref="ArgumentNullException">The place or the catalogue are absent.</exception>
    public static IReadOnlyList<NebulaNearby> Nearest(
        GalacticPosition position, IReadOnlyList<Nebula> nebulae, int count = 3)
    {
        if (position is null) throw new ArgumentNullException(nameof(position));
        if (nebulae is null) throw new ArgumentNullException(nameof(nebulae));

        int limit = Math.Min(Math.Max(count, 0), nebulae.Count);
        if (limit == 0) return [];

        // Only the nearest few are kept, on a heap whose root is the furthest of them.
        // The whole catalogue is therefore never ranked or ordered for the usual small
        // question, and two at the same distance still keep catalogue order.
        List<Ranked> nearest = new(limit);
        for (int index = 0; index < nebulae.Count; index++)
        {
            Ranked ranked = new(nebulae[index], DistanceSquared(position, nebulae[index]), index);
            if (nearest.Count < limit)
            {
                PushFurthest(nearest, ranked);
            }
            else if (Compare(ranked, nearest[0]) < 0)
            {
                ReplaceFurthest(nearest, ranked);
            }
        }

        nearest.Sort(Compare);
        NebulaNearby[] answer = new NebulaNearby[nearest.Count];
        for (int index = 0; index < nearest.Count; index++) answer[index] = WithDistance(nearest[index]);
        return new ReadOnlyCollection<NebulaNearby>(answer);
    }

    /// <summary>Reads every nebula within a distance of one place, nearest first.</summary>
    /// <param name="position">The place to measure from, in light years, with Sol at the origin.</param>
    /// <param name="nebulae">The catalogue to read.</param>
    /// <param name="radiusLy">
    /// How far to reach, in light years, counting one exactly that far away. A distance
    /// below zero answers with none.
    /// </param>
    /// <returns>
    /// The nebulae that near, in order of distance. Two at the same distance keep the
    /// order the catalogue holds them in. The catalogue is left alone.
    /// </returns>
    /// <exception cref="ArgumentNullException">The place or the catalogue are absent.</exception>
    public static IReadOnlyList<NebulaNearby> Within(
        GalacticPosition position, IReadOnlyList<Nebula> nebulae, double radiusLy)
    {
        if (position is null) throw new ArgumentNullException(nameof(position));
        if (nebulae is null) throw new ArgumentNullException(nameof(nebulae));
        if (!(radiusLy >= 0)) return [];

        double limit = radiusLy * radiusLy;
        List<Ranked> hits = [];
        for (int index = 0; index < nebulae.Count; index++)
        {
            double distance = DistanceSquared(position, nebulae[index]);
            if (distance <= limit) hits.Add(new Ranked(nebulae[index], distance, index));
        }

        hits.Sort(Compare);
        NebulaNearby[] answer = new NebulaNearby[hits.Count];
        for (int index = 0; index < hits.Count; index++) answer[index] = WithDistance(hits[index]);
        return new ReadOnlyCollection<NebulaNearby>(answer);
    }

    /// <summary>Finds a nebula by name in one catalogue.</summary>
    /// <param name="name">
    /// The name as the catalogue writes it. Any community name in brackets is part of it,
    /// so hand over the whole string.
    /// </param>
    /// <param name="nebulae">The catalogue to read.</param>
    /// <returns>
    /// The nebula, or <see langword="null"/> where that catalogue holds no nebula of the
    /// name. Only the catalogue handed over is read, so a real nebula is not found among
    /// the planetary ones.
    /// </returns>
    /// <exception cref="ArgumentNullException">The catalogue is absent.</exception>
    /// <remarks>Case and surrounding whitespace are ignored, and nothing else is.</remarks>
    public static Nebula? FindByName(string? name, IReadOnlyList<Nebula> nebulae)
    {
        if (nebulae is null) throw new ArgumentNullException(nameof(nebulae));
        return RegistryIndex.FindByKey(nebulae, nebula => nebula.Name, name);
    }

    /// <summary>Reads how far one nebula is from a place, squared.</summary>
    private static double DistanceSquared(GalacticPosition position, Nebula nebula)
    {
        double dx = position.X - nebula.X;
        double dy = position.Y - nebula.Y;
        double dz = position.Z - nebula.Z;
        return (dx * dx) + (dy * dy) + (dz * dz);
    }

    /// <summary>Orders two ranked nebulae by distance, then by catalogue order.</summary>
    private static int Compare(Ranked left, Ranked right)
    {
        int byDistance = left.DistanceSquared.CompareTo(right.DistanceSquared);
        return byDistance != 0 ? byDistance : left.CatalogueIndex.CompareTo(right.CatalogueIndex);
    }

    /// <summary>Writes one ranked nebula with the distance it was ranked at.</summary>
    private static NebulaNearby WithDistance(Ranked ranked) => new(
        ranked.Nebula.Name,
        ranked.Nebula.System,
        ranked.Nebula.X,
        ranked.Nebula.Y,
        ranked.Nebula.Z,
        ranked.Nebula.Type,
        ranked.Nebula.RegionId,
        Math.Sqrt(ranked.DistanceSquared));

    /// <summary>Adds one nebula to the heap whose root is the furthest kept.</summary>
    private static void PushFurthest(List<Ranked> heap, Ranked ranked)
    {
        heap.Add(ranked);
        int index = heap.Count - 1;
        while (index > 0)
        {
            int parent = (index - 1) / 2;
            if (Compare(heap[parent], heap[index]) >= 0) return;
            (heap[parent], heap[index]) = (heap[index], heap[parent]);
            index = parent;
        }
    }

    /// <summary>Puts one nebula in place of the furthest kept, and settles the heap.</summary>
    private static void ReplaceFurthest(List<Ranked> heap, Ranked ranked)
    {
        heap[0] = ranked;
        int index = 0;
        while (true)
        {
            int left = (index * 2) + 1;
            if (left >= heap.Count) return;
            int right = left + 1;
            int further = right < heap.Count && Compare(heap[right], heap[left]) > 0 ? right : left;
            if (Compare(heap[index], heap[further]) >= 0) return;
            (heap[index], heap[further]) = (heap[further], heap[index]);
            index = further;
        }
    }

    /// <summary>Reads one catalogue, and gives every record the class its file states.</summary>
    private static ReadOnlyCollection<Nebula> Build(string path, NebulaType type)
    {
        IReadOnlyList<NebulaRecord> records = SharedData.LoadList<NebulaRecord>(path);
        List<Nebula> nebulae = new(records.Count);
        foreach (NebulaRecord record in records)
        {
            nebulae.Add(new Nebula(
                record.Name,
                record.System ?? record.Name,
                record.X,
                record.Y,
                record.Z,
                type,
                record.RegionId));
        }

        return new ReadOnlyCollection<Nebula>(nebulae);
    }

    /// <summary>Puts the three catalogues together, in the order they are named in.</summary>
    private static ReadOnlyCollection<Nebula> BuildAll()
    {
        List<Nebula> nebulae = new(Real.Count + Planetary.Count + Procgen.Count);
        nebulae.AddRange(Real);
        nebulae.AddRange(Planetary);
        nebulae.AddRange(Procgen);
        return new ReadOnlyCollection<Nebula>(nebulae);
    }

    /// <summary>One nebula as its shared file states it.</summary>
    /// <remarks>
    /// The file settles the class, so no record repeats it. A planetary nebula states its
    /// system only where that differs from its name.
    /// </remarks>
    private sealed record NebulaRecord(
        string Name,
        double X,
        double Y,
        double Z,
        int RegionId,
        string? System = null);

    /// <summary>One nebula, how far away it was found to be, and where the catalogue holds it.</summary>
    private readonly struct Ranked(Nebula nebula, double distanceSquared, int catalogueIndex)
    {
        /// <summary>The nebula itself.</summary>
        public Nebula Nebula { get; } = nebula;

        /// <summary>How far it is from the place asked about, squared.</summary>
        public double DistanceSquared { get; } = distanceSquared;

        /// <summary>Where the catalogue holds it, which settles a tie.</summary>
        public int CatalogueIndex { get; } = catalogueIndex;
    }
}
