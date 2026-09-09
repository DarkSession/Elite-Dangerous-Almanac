using System;
using System.Globalization;
using EliteDangerousAlmanac.Astronomy.Internal;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>Where a boxel sits on the grid of boxels of its own size.</summary>
/// <param name="X">The boxel index along the galactic X axis.</param>
/// <param name="Y">The boxel index along the galactic Y axis.</param>
/// <param name="Z">The boxel index along the galactic Z axis.</param>
/// <remarks>
/// These are counts of boxels from the galaxy corner, not light years. One step is one
/// boxel edge, which <see cref="MassCode.BoxelEdgeLy"/> reads for a size class.
/// </remarks>
public sealed record AbsoluteBoxel(int X, int Y, int Z);

/// <summary>The parts one system address holds.</summary>
/// <param name="SizeClass">The size class, zero through seven.</param>
/// <param name="SectorGridPosition">The sector's place on the galaxy grid.</param>
/// <param name="BoxelCode">The boxel's base-26 code inside that sector.</param>
/// <param name="Sequence">The system's own number inside the boxel.</param>
/// <param name="AbsoluteBoxel">The boxel's place on the grid of boxels of its size.</param>
public sealed record DecodedSystemAddress(
    int SizeClass,
    SectorGridPosition SectorGridPosition,
    int BoxelCode,
    long Sequence,
    AbsoluteBoxel AbsoluteBoxel);

/// <summary>The 64-bit number the game identifies a system by.</summary>
/// <remarks>
/// <para>
/// The address packs, from the lowest bit up, the size class, then the boxel's place along
/// each axis split into a sector index and an offset inside that sector, and last the
/// system's own number. How wide each field is depends on the size class, which is why
/// every step here reads that first.
/// </para>
/// <para>
/// A second layout, which some community tools write, carries the same information in a
/// different order. <see cref="DecodeModulated"/> and <see cref="EncodeModulated"/> read
/// and write that one.
/// </para>
/// <para>
/// An address is a <see cref="ulong"/> throughout, because its fields reach bit 55 and the
/// value routinely passes what a floating-point number holds exactly. A journal event
/// reports the address as a whole number, and a stored address as a decimal string, which
/// <see cref="TryParse(string, out ulong)"/> reads.
/// </para>
/// </remarks>
public static class SystemAddress
{
    /// <summary>The edge of one sector in internal units, which is 1280 light years.</summary>
    public const int SectorInternalSize = 40960;

    /// <summary>The internal units in one light year.</summary>
    public const int UnitsPerLightYear = 32;

    /// <summary>The most a boxel code the address layout carries can reach.</summary>
    private const int MaxAddressBoxelCode = 0x1fffff;

    /// <summary>The most the sequence field of a modulated address carries.</summary>
    private const int MaxModulatedSequence = 0x7fff;

    /// <summary>Reads the edge of a boxel of one size class, in internal units.</summary>
    /// <param name="sizeClass">The size class, zero through seven.</param>
    /// <returns>The edge in internal units, 320 through 40960.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The size class is outside zero through seven.</exception>
    /// <remarks>Divide by <see cref="UnitsPerLightYear"/> for light years.</remarks>
    public static int BoxelInternalSize(int sizeClass)
    {
        MassCode.RequireSizeClass(sizeClass, nameof(sizeClass));
        return SectorInternalSize >> (7 - sizeClass);
    }

    /// <summary>Reads a decimal system address.</summary>
    /// <param name="address">The address as digits, from stored data or a query string.</param>
    /// <param name="id64">The address, where the text states one.</param>
    /// <returns><see langword="true"/> where the text is a 64-bit decimal address.</returns>
    public static bool TryParse(string? address, out ulong id64)
    {
        id64 = 0;
        if (address is null) return false;
        return ulong.TryParse(
            address.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out id64);
    }

    /// <summary>Reads a decimal system address, and refuses text that states none.</summary>
    /// <param name="address">The address as digits.</param>
    /// <returns>The address.</returns>
    /// <exception cref="ArgumentNullException">The text is absent.</exception>
    /// <exception cref="FormatException">
    /// The text is not a decimal number the 64-bit range holds.
    /// </exception>
    public static ulong Parse(string address)
    {
        if (address is null) throw new ArgumentNullException(nameof(address));
        if (TryParse(address, out ulong id64)) return id64;
        throw new FormatException("A system address is a decimal number of at most 64 bits.");
    }

    /// <summary>Reads the parts one system address holds.</summary>
    /// <param name="id64">The system address.</param>
    /// <returns>The size class, the sector, the boxel code, the sequence and the boxel.</returns>
    public static DecodedSystemAddress Decode(ulong id64)
    {
        int sizeClass = (int)(id64 & 7);

        int z0 = (int)((id64 >> 3) & (ulong)(0x3fff >> sizeClass));
        int z1 = (int)((id64 >> 3) & (ulong)(0x7f >> sizeClass));
        int z2 = (int)((id64 >> (10 - sizeClass)) & 0x7f);
        int y0 = (int)((id64 >> (17 - sizeClass)) & (ulong)(0x1fff >> sizeClass));
        int y1 = (int)((id64 >> (17 - sizeClass)) & (ulong)(0x7f >> sizeClass));
        int y2 = (int)((id64 >> (24 - (sizeClass * 2))) & 0x3f);
        int x0 = (int)((id64 >> (30 - (sizeClass * 2))) & (ulong)(0x3fff >> sizeClass));
        int x1 = (int)((id64 >> (30 - (sizeClass * 2))) & (ulong)(0x7f >> sizeClass));
        int x2 = (int)((id64 >> (37 - (sizeClass * 3))) & 0x7f);
        // The field is 32 bits wide at the largest size class, so it is read as a long. A
        // 32-bit signed number holds only half of what it can carry.
        long sequence = (long)((id64 >> (44 - (sizeClass * 3)))
            & ((1UL << (11 + (sizeClass * 3))) - 1));

        return new DecodedSystemAddress(
            sizeClass,
            new SectorGridPosition(x2, y2, z2),
            x1 | (y1 << 7) | (z1 << 14),
            sequence,
            new AbsoluteBoxel(x0, y0, z0));
    }

    /// <summary>Reads the parts one modulated system address holds.</summary>
    /// <param name="id64">The modulated system address.</param>
    /// <returns>The same parts <see cref="Decode"/> answers.</returns>
    /// <remarks>
    /// The modulated layout carries the same system in a different order, and some
    /// community tools and data dumps write it. A journal, EDSM, EDDN and Spansh all write
    /// the usual layout, which <see cref="Decode"/> reads.
    /// </remarks>
    public static DecodedSystemAddress DecodeModulated(ulong id64)
    {
        int sequence = (int)(id64 & 0x7fff);
        int boxelCode = (int)((id64 >> 16) & 0x1fffff);
        int sizeClass = (int)((id64 >> 37) & 7);
        int x2 = (int)((id64 >> 40) & 0x7f);
        int y2 = (int)((id64 >> 47) & 0x3f);
        int z2 = (int)((id64 >> 53) & 0x7f);

        // The boxel's place is its sector index shifted above the bits the boxel code
        // carries, plus those bits.
        int shift = 7 - sizeClass;
        int mask = 0x7f >> sizeClass;
        return new DecodedSystemAddress(
            sizeClass,
            new SectorGridPosition(x2, y2, z2),
            boxelCode,
            sequence,
            new AbsoluteBoxel(
                (x2 << shift) | (boxelCode & mask),
                (y2 << shift) | ((boxelCode >> 7) & mask),
                (z2 << shift) | ((boxelCode >> 14) & mask)));
    }

    /// <summary>Writes the parts of a system name and its region origin as a system address.</summary>
    /// <param name="parts">The parts of the name, as <see cref="SystemName.Parse"/> answers.</param>
    /// <param name="origin">The region's origin, as <see cref="NamingRegionOrigins.Resolve"/> answers.</param>
    /// <returns>The system address.</returns>
    /// <exception cref="ArgumentNullException">The parts or the origin are absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The size class, a letter or the first index is outside its range, the origin has a
    /// coordinate below zero, the name's boxel or sector falls outside the layout, or the
    /// sequence does not fit the field its size class leaves for it.
    /// </exception>
    public static ulong Encode(SystemNameParts parts, NamingRegionOrigin origin)
    {
        if (parts is null) throw new ArgumentNullException(nameof(parts));

        int sizeClass = parts.SizeClass;
        MassCode.RequireSizeClass(sizeClass, nameof(parts));
        int boxelCode = BoxelCodes.Pack(parts.L1, parts.L2, parts.L3, parts.N1);
        AbsoluteBoxel boxel = ToAbsoluteBoxel(sizeClass, boxelCode, origin);

        // The sequence runs from bit 44 - 3 × the size class up to bit 55. The nine bits
        // above it carry the body.
        int width = 11 + (sizeClass * 3);
        if (parts.N2 < 0 || parts.N2 >= 1L << width)
        {
            throw new ArgumentOutOfRangeException(
                nameof(parts),
                parts.N2,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "The sequence does not fit the {0} bits this size class leaves for it.",
                    width));
        }

        return (uint)sizeClass
            | ((ulong)(uint)boxel.Z << 3)
            | ((ulong)(uint)boxel.Y << (17 - sizeClass))
            | ((ulong)(uint)boxel.X << (30 - (sizeClass * 2)))
            | ((ulong)parts.N2 << (44 - (sizeClass * 3)));
    }

    /// <summary>Writes the parts of a system name and its region origin as a modulated address.</summary>
    /// <param name="parts">The parts of the name, as <see cref="SystemName.Parse"/> answers.</param>
    /// <param name="origin">The region's origin, as <see cref="NamingRegionOrigins.Resolve"/> answers.</param>
    /// <returns>The modulated system address.</returns>
    /// <exception cref="ArgumentNullException">The parts or the origin are absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A field is outside its range, or the sequence does not fit the 15 bits the modulated
    /// layout leaves for it.
    /// </exception>
    /// <remarks>Write the usual layout with <see cref="Encode"/> unless a tool asks for this one.</remarks>
    public static ulong EncodeModulated(SystemNameParts parts, NamingRegionOrigin origin)
    {
        if (parts is null) throw new ArgumentNullException(nameof(parts));

        int sizeClass = parts.SizeClass;
        MassCode.RequireSizeClass(sizeClass, nameof(parts));
        int shift = 7 - sizeClass;
        int mask = 0x7f >> sizeClass;
        int boxelCode = BoxelCodes.Pack(parts.L1, parts.L2, parts.L3, parts.N1);
        AbsoluteBoxel boxel = ToAbsoluteBoxel(sizeClass, boxelCode, origin);

        if (parts.N2 < 0 || parts.N2 > MaxModulatedSequence)
        {
            throw new ArgumentOutOfRangeException(
                nameof(parts),
                parts.N2,
                "The sequence does not fit the 15 bits the modulated layout leaves for it.");
        }

        int packed = (boxel.X & mask) | ((boxel.Y & mask) << 7) | ((boxel.Z & mask) << 14);
        return (ulong)parts.N2
            | ((ulong)(uint)packed << 16)
            | ((ulong)(uint)sizeClass << 37)
            | ((ulong)(uint)((boxel.X >> shift) & 0x7f) << 40)
            | ((ulong)(uint)((boxel.Y >> shift) & 0x3f) << 47)
            | ((ulong)(uint)((boxel.Z >> shift) & 0x7f) << 53);
    }

    /// <summary>Reads where one boxel code sits, counted from the galaxy corner.</summary>
    /// <param name="sizeClass">The size class, zero through seven.</param>
    /// <param name="boxelCode">The base-26 boxel code, as <see cref="SystemName.ToBoxelCode"/> answers.</param>
    /// <param name="origin">The region's origin in internal units.</param>
    /// <returns>The boxel's place on the grid of boxels of its size.</returns>
    /// <exception cref="ArgumentNullException">The origin is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The size class is outside zero through seven, the origin has a coordinate below
    /// zero, or the code or the sector it lands in falls outside the address layout.
    /// </exception>
    /// <remarks>
    /// A boxel code counts from the region's origin taken down to the boxel grid, so this
    /// is the inverse of <see cref="ToBoxelCode"/>. It refuses rather than write a wrong
    /// address.
    /// </remarks>
    public static AbsoluteBoxel ToAbsoluteBoxel(
        int sizeClass, int boxelCode, NamingRegionOrigin origin)
    {
        if (origin is null) throw new ArgumentNullException(nameof(origin));
        int boxelSize = BoxelInternalSize(sizeClass);

        if (origin.X < 0 || origin.Y < 0 || origin.Z < 0)
        {
            // No catalogued origin has a coordinate below zero, so a caller built this one.
            throw new ArgumentOutOfRangeException(
                nameof(origin), origin.Name, "The region origin has a coordinate below zero.");
        }

        if (boxelCode < 0 || boxelCode > MaxAddressBoxelCode)
        {
            throw new ArgumentOutOfRangeException(
                nameof(boxelCode), boxelCode, "The boxel code falls outside the address layout.");
        }

        int bx = boxelCode & 0x7f;
        int by = (boxelCode >> 7) & 0x7f;
        int bz = (boxelCode >> 14) & 0x7f;

        if (!IsWithinRegion(bx, by, bz, boxelSize, origin))
        {
            throw new ArgumentOutOfRangeException(
                nameof(boxelCode),
                boxelCode,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "The boxel code falls outside {0} at this size class.",
                    origin.Name));
        }

        int x = bx + (int)Math.Floor(origin.X / boxelSize);
        int y = by + (int)Math.Floor(origin.Y / boxelSize);
        int z = bz + (int)Math.Floor(origin.Z / boxelSize);

        // The layout carries seven sector bits for X and Z, and six for Y. A name that
        // reads cleanly still lands outside that room, and packing it would write over
        // another field.
        if (x >= 1 << (14 - sizeClass) || y >= 1 << (13 - sizeClass) || z >= 1 << (14 - sizeClass))
        {
            throw new ArgumentOutOfRangeException(
                nameof(origin),
                origin.Name,
                "The sector this region lands in does not fit a system address.");
        }

        return new AbsoluteBoxel(x, y, z);
    }

    /// <summary>Reads the boxel code one boxel carries inside one region.</summary>
    /// <param name="sizeClass">The size class, zero through seven.</param>
    /// <param name="boxel">The boxel's place, as <see cref="Decode"/> answers.</param>
    /// <param name="origin">The region to count from, in internal units.</param>
    /// <returns>
    /// The base-26 boxel code inside that region, or <see langword="null"/> where the boxel
    /// lies outside the region or the origin has a coordinate below zero.
    /// </returns>
    /// <exception cref="ArgumentNullException">The boxel or the origin are absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The size class is outside zero through seven.</exception>
    /// <remarks>
    /// A region the game names by hand starts somewhere other than its procedural sector,
    /// so the same boxel carries a different code under it. This reads that code.
    /// </remarks>
    public static int? ToBoxelCode(int sizeClass, AbsoluteBoxel boxel, NamingRegionOrigin origin)
    {
        if (boxel is null) throw new ArgumentNullException(nameof(boxel));
        if (origin is null) throw new ArgumentNullException(nameof(origin));

        int boxelSize = BoxelInternalSize(sizeClass);
        if (origin.X < 0 || origin.Y < 0 || origin.Z < 0) return null;

        int bx = boxel.X - (int)Math.Floor(origin.X / boxelSize);
        int by = boxel.Y - (int)Math.Floor(origin.Y / boxelSize);
        int bz = boxel.Z - (int)Math.Floor(origin.Z / boxelSize);
        if (bx < 0 || bx > 0x7f || by < 0 || by > 0x7f || bz < 0 || bz > 0x7f) return null;
        if (!IsWithinRegion(bx, by, bz, boxelSize, origin)) return null;
        return bx | (by << 7) | (bz << 14);
    }

    /// <summary>Reads whether a boxel counted inside one region still falls in it.</summary>
    /// <remarks>
    /// A boxel code counts from the region's origin taken down to the boxel grid. A region
    /// whose origin does not sit on that grid therefore reaches one boxel further than its
    /// own extent, so the bound carries how far into its own boxel the origin sits.
    /// </remarks>
    private static bool IsWithinRegion(
        int bx, int by, int bz, int boxelSize, NamingRegionOrigin origin)
    {
        return (double)bx * boxelSize < (origin.X % boxelSize) + origin.SizeX
            && (double)by * boxelSize < (origin.Y % boxelSize) + origin.SizeY
            && (double)bz * boxelSize < (origin.Z % boxelSize) + origin.SizeZ;
    }
}
