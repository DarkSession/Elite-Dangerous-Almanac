using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>The corner of a system's boxel, and the codex region there.</summary>
/// <param name="X">The corner's galactic X in light years, with Sol at the origin.</param>
/// <param name="Y">The corner's galactic Y in light years.</param>
/// <param name="Z">The corner's galactic Z in light years.</param>
/// <param name="Region">
/// The region at the corner, or <see langword="null"/> where it lies outside the mapped
/// grid.
/// </param>
public sealed record BoxelCodexRegion(double X, double Y, double Z, CodexRegion? Region);

/// <summary>Which codex region one place in the galaxy belongs to.</summary>
/// <remarks>
/// <para>
/// A system's region follows from where it sits on a flat grid over the plane of the
/// galaxy, whose cell is about 49 light years on a side. The cells of each region are
/// held as runs in a shared data file, and this class rebuilds the row index it reads
/// them through.
/// </para>
/// <para>
/// Two readings are offered, because the game calls two things the region.
/// <see cref="FindAt(GalacticPosition)"/> answers where a place is, which is what the
/// codex records a find against and what the game shows on a jump into a system.
/// <see cref="FindForBoxel"/> answers where the corner of a system's boxel is, which is
/// what the journal and the codex front page show. The two differ near a border.
/// </para>
/// <para>
/// The reading is the EliteDangerousRegionMap algorithm. See <c>ATTRIBUTIONS.md</c> for
/// credit and licence terms.
/// </para>
/// </remarks>
public static class CodexRegionMap
{
    private static readonly Lazy<RegionCellData> Cells = new(
        () => SharedData.Load<RegionCellData>("data/astro/galactic-region-cells.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<int, RegionRun[]>> Rows = new(BuildRows);

    /// <summary>The galactic X of the galaxy's corner, in light years.</summary>
    public static double OriginX => Cells.Value.Projection.X0;

    /// <summary>The galactic Y of the galaxy's corner, in light years.</summary>
    public static double OriginY => Cells.Value.Projection.Y0;

    /// <summary>The galactic Z of the galaxy's corner, in light years.</summary>
    public static double OriginZ => Cells.Value.Projection.Z0;

    /// <summary>The edge of one cell of the region grid, in light years.</summary>
    public static double LightYearsPerCell => Cells.Value.Projection.LyPerCell;

    /// <summary>Finds the codex region at one place on the plane of the galaxy.</summary>
    /// <param name="point">The place in light years, with Sol at the origin.</param>
    /// <returns>
    /// The region there, or <see langword="null"/> where the place lies outside the mapped
    /// grid.
    /// </returns>
    /// <exception cref="ArgumentNullException">The place is absent.</exception>
    public static CodexRegion? FindAt(GalacticPlanePosition point)
    {
        if (point is null) throw new ArgumentNullException(nameof(point));
        return FindAt(point.X, point.Z);
    }

    /// <summary>Finds the codex region at one place in the galaxy.</summary>
    /// <param name="position">The position in light years, with Sol at the origin.</param>
    /// <returns>
    /// The region there, or <see langword="null"/> where the place lies outside the mapped
    /// grid.
    /// </returns>
    /// <exception cref="ArgumentNullException">The position is absent.</exception>
    /// <remarks>
    /// The height is read and left alone. The region map is flat, so a region has no
    /// height to hold a place against.
    /// </remarks>
    public static CodexRegion? FindAt(GalacticPosition position)
    {
        if (position is null) throw new ArgumentNullException(nameof(position));
        return FindAt(position.X, position.Z);
    }

    /// <summary>Finds the codex region at one place on the plane of the galaxy.</summary>
    /// <param name="x">The galactic X in light years, with Sol at the origin.</param>
    /// <param name="z">The galactic Z in light years.</param>
    /// <returns>
    /// The region there, or <see langword="null"/> where the place lies outside the mapped
    /// grid.
    /// </returns>
    public static CodexRegion? FindAt(double x, double z)
    {
        RegionProjection projection = Cells.Value.Projection;
        double px = Math.Floor((x - projection.X0) * projection.ScaleNumerator
            / projection.ScaleDenominator);
        double pz = Math.Floor((z - projection.Z0) * projection.ScaleNumerator
            / projection.ScaleDenominator);
        return CodexRegions.Find(RegionIdAtCell(px, pz));
    }

    /// <summary>Finds the codex region of a system's boxel, from its address.</summary>
    /// <param name="id64">The system address.</param>
    /// <returns>
    /// The corner of the system's boxel in light years, with Sol at the origin, and the
    /// region there.
    /// </returns>
    /// <remarks>
    /// This is the region the journal writes and the codex front page shows. It is read at
    /// the corner of the system's boxel, which near a border is not always the region at
    /// the system's own place. Those coordinates are also as near a position as an address
    /// alone reaches: they are true to one boxel edge, which
    /// <see cref="MassCode.BoxelEdgeLy"/> reads.
    /// </remarks>
    public static BoxelCodexRegion FindForBoxel(ulong id64)
    {
        DecodedSystemAddress decoded = SystemAddress.Decode(id64);
        int edge = MassCode.BoxelEdgeLy(decoded.SizeClass);
        RegionProjection projection = Cells.Value.Projection;
        double x = ((double)decoded.AbsoluteBoxel.X * edge) + projection.X0;
        double y = ((double)decoded.AbsoluteBoxel.Y * edge) + projection.Y0;
        double z = ((double)decoded.AbsoluteBoxel.Z * edge) + projection.Z0;
        return new BoxelCodexRegion(x, y, z, FindAt(x, z));
    }

    /// <summary>Reads the region number one cell of the grid carries.</summary>
    /// <returns>The number, or zero where the cell lies outside every region.</returns>
    private static int RegionIdAtCell(double px, double pz)
    {
        RegionProjection projection = Cells.Value.Projection;
        if (px < 0 || pz < 0 || px >= projection.GridWidth || pz >= projection.GridHeight)
        {
            return 0;
        }

        if (!Rows.Value.TryGetValue((int)pz, out RegionRun[]? row)) return 0;

        int cell = (int)px;
        foreach (RegionRun run in row)
        {
            if (cell >= run.Start && cell < run.End) return run.RegionId;
        }

        return 0;
    }

    /// <summary>
    /// Rebuilds the row index the reading walks: one row of the grid, and the runs of
    /// cells the regions hold along it.
    /// </summary>
    /// <remarks>
    /// The grid divides the plane without overlap, so at most one run of a row holds any
    /// one cell.
    /// </remarks>
    private static Dictionary<int, RegionRun[]> BuildRows()
    {
        Dictionary<int, List<RegionRun>> building = [];
        foreach (RegionCells region in Cells.Value.Regions)
        {
            for (int index = 0; index < region.Cells.Rows.Count; index++)
            {
                int pz = region.Cells.MinPz + index;
                if (!building.TryGetValue(pz, out List<RegionRun>? row))
                {
                    row = [];
                    building.Add(pz, row);
                }

                foreach (IReadOnlyList<int> run in region.Cells.Rows[index])
                {
                    int start = run.Count > 0 ? run[0] : 0;
                    int length = run.Count > 1 ? run[1] : 0;
                    row.Add(new RegionRun(start, start + length, region.Id));
                }
            }
        }

        Dictionary<int, RegionRun[]> rows = new(building.Count);
        foreach (KeyValuePair<int, List<RegionRun>> entry in building)
        {
            rows.Add(entry.Key, entry.Value.ToArray());
        }

        return rows;
    }

    /// <summary>One run of cells of one row, and the region that holds them.</summary>
    private readonly struct RegionRun(int start, int end, int regionId)
    {
        /// <summary>The first cell of the run.</summary>
        public int Start { get; } = start;

        /// <summary>The cell after the last one of the run.</summary>
        public int End { get; } = end;

        /// <summary>The region that holds the run.</summary>
        public int RegionId { get; } = regionId;
    }

    /// <summary>The whole of the shared region-cell file.</summary>
    private sealed record RegionCellData(
        RegionProjection Projection,
        IReadOnlyList<RegionCells> Regions);

    /// <summary>How galactic coordinates land on the region grid.</summary>
    private sealed record RegionProjection(
        double X0,
        double Y0,
        double Z0,
        double ScaleNumerator,
        double ScaleDenominator,
        double LyPerCell,
        int GridWidth,
        int GridHeight);

    /// <summary>One region's cells.</summary>
    private sealed record RegionCells(int Id, RegionRows Cells);

    /// <summary>The rows one region fills, from its lowest row upwards.</summary>
    /// <remarks>Each row states its runs as a first cell and a count.</remarks>
    private sealed record RegionRows(int MinPz, IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>> Rows);
}
