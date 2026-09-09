using System;
using Addresses = EliteDangerousAlmanac.Astronomy.SystemAddress;
using MassCodes = EliteDangerousAlmanac.Astronomy.MassCode;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>One system the generator named, read from its name or its address.</summary>
/// <remarks>
/// <para>
/// This is a value over the calculations beside it. Build one from a name or an address,
/// and read the name, the naming region, the mass code, the position and both addresses
/// back. A caller that wants one calculation reaches for that calculation instead. The
/// algorithms are not here. What is here is what holds them together, which includes
/// giving a system inside a region the game names by hand that region's name.
/// </para>
/// <para>
/// A system is immutable, and the address is worked out while it is built, so reading one
/// back never fails. The modulated address is absent where the narrower field of that
/// layout has no room for the system's own number.
/// </para>
/// <para>
/// A system the game named outright, such as Sol, is not one of these. It carries no
/// procedural name, and no calculation reaches its address.
/// </para>
/// <para>
/// Read the codex region of a system by handing its address to
/// <see cref="CodexRegionMap.FindForBoxel"/>, which is kept apart from this so a caller
/// that wants a name does not read the region grid.
/// </para>
/// </remarks>
public sealed class ProceduralSystem
{
    private readonly SystemNameParts parts;

    private ProceduralSystem(
        SystemNameParts parts,
        ulong address,
        ulong? modulatedAddress,
        GalacticPosition? position,
        bool handAuthored,
        bool requiresPermit)
    {
        this.parts = parts;
        SystemAddress = address;
        ModulatedSystemAddress = modulatedAddress;
        Position = position;
        UsesHandAuthoredRegion = handAuthored;
        RequiresRegionPermit = requiresPermit;
    }

    /// <summary>Whether the name reads a region the game names by hand, and not a sector.</summary>
    public bool UsesHandAuthoredRegion { get; }

    /// <summary>Whether the system's region asks a commander for a permit.</summary>
    /// <remarks>
    /// This reads the region alone. A system that asks for a permit of its own carries a
    /// name the game wrote, so it never reaches this class. <see cref="PermitLocks"/>
    /// reads both kinds from a name.
    /// </remarks>
    public bool RequiresRegionPermit { get; }

    /// <summary>The system name as the game writes it.</summary>
    public string Name => SystemName.Format(parts);

    /// <summary>
    /// The region name: a sector the generator names, or, where the system sits inside a
    /// region the game names by hand, that region.
    /// </summary>
    /// <remarks><see cref="UsesHandAuthoredRegion"/> tells which of the two it is.</remarks>
    public string NamingRegionName => parts.RegionName;

    /// <summary>The mass-code letter, <c>a</c> through <c>h</c>.</summary>
    public char MassCode => MassCodes.FromSizeClass(parts.SizeClass);

    /// <summary>The system's own number inside its boxel.</summary>
    public long Sequence => parts.N2;

    /// <summary>The parts the name is written from.</summary>
    /// <remarks>
    /// The letters and the mass code are held as counts, which is the form the address
    /// maths reads. Take <see cref="Name"/> and <see cref="MassCode"/> for the written
    /// forms.
    /// </remarks>
    public SystemNameParts Parts => parts;

    /// <summary>The system's 64-bit address.</summary>
    public ulong SystemAddress { get; }

    /// <summary>
    /// The system's address in the modulated layout, or <see langword="null"/> where that
    /// layout has no room for the system's own number.
    /// </summary>
    public ulong? ModulatedSystemAddress { get; }

    /// <summary>The position in light years, with Sol at the origin, where one is known.</summary>
    /// <remarks>
    /// This is the position that was handed over, and nothing else. Neither a name nor an
    /// address carries an exact position, so a system built from either alone states none.
    /// <see cref="CodexRegionMap.FindForBoxel"/> reads a position from an address that is
    /// true to one boxel edge.
    /// </remarks>
    public GalacticPosition? Position { get; }

    /// <summary>Builds a system from a procedural name.</summary>
    /// <param name="name">The name in any casing, with any surrounding whitespace.</param>
    /// <returns>
    /// The system, or <see langword="null"/> where the name is not one the generator
    /// writes. A system the game named outright answers <see langword="null"/> too,
    /// because no address follows from such a name.
    /// </returns>
    /// <exception cref="ArgumentNullException">The name is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The name reads cleanly, and no region answers to it, or a field of it has no room
    /// in the address layout.
    /// </exception>
    /// <remarks>
    /// A region is re-cased where a sector or the catalogue answers to it. A name that
    /// cannot be written as an address is refused here, rather than building a system
    /// whose address fails to be read later.
    /// </remarks>
    public static ProceduralSystem? FromName(string name)
    {
        if (name is null) throw new ArgumentNullException(nameof(name));

        SystemNameParts? read = SystemName.Parse(name);
        if (read is null) return null;

        SectorGridPosition? sector = SectorName.ToGridPosition(read.RegionName);
        NamingRegionOrigin? handAuthored = sector is null
            ? NamingRegionOrigins.FindHandAuthored(read.RegionName)
            : null;
        string regionName = sector is not null
            ? SectorName.FromGridPosition(sector)
            : handAuthored?.Name ?? read.RegionName;

        SystemNameParts parts = read with { RegionName = regionName };
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve(regionName)
            ?? throw new ArgumentOutOfRangeException(
                nameof(name), regionName, "No naming region answers to that name.");

        return new ProceduralSystem(
            parts,
            Addresses.Encode(parts, origin),
            TryEncodeModulated(parts),
            null,
            handAuthored is not null,
            handAuthored is not null && PermitLocks.IsLockedRegionName(regionName));
    }

    /// <summary>Builds a system from its 64-bit address.</summary>
    /// <param name="id64">The system address, as a journal event reports it.</param>
    /// <param name="position">
    /// The position in light years, with Sol at the origin. It is what gives a system
    /// inside a region the game names by hand the name the game shows.
    /// </param>
    /// <returns>The system at that address.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The grid position the address states carries no procedural name.
    /// </exception>
    /// <remarks>
    /// Hand over the position wherever one is at hand. An address states the boxel and not
    /// the place, so it alone cannot tell whether the system falls inside a region the game
    /// names by hand. Without it, such a system quietly carries its procedural name.
    /// </remarks>
    public static ProceduralSystem FromSystemAddress(ulong id64, GalacticPosition? position = null)
        => FromDecoded(Addresses.Decode(id64), id64, null, position);

    /// <summary>Builds a system from its address in the modulated layout.</summary>
    /// <param name="id64">The modulated system address.</param>
    /// <param name="position">
    /// The position in light years, with Sol at the origin, which names a region the game
    /// names by hand.
    /// </param>
    /// <returns>The system at that address.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The grid position carries no procedural name, or the system's own number has no
    /// room in the usual layout that every system here carries.
    /// </exception>
    public static ProceduralSystem FromModulatedSystemAddress(
        ulong id64, GalacticPosition? position = null)
        => FromDecoded(Addresses.DecodeModulated(id64), null, id64, position);

    /// <summary>Builds a system from an address that has been read into its parts.</summary>
    private static ProceduralSystem FromDecoded(
        DecodedSystemAddress decoded,
        ulong? address,
        ulong? modulatedAddress,
        GalacticPosition? position)
    {
        BoxelLetters letters = SystemName.ToBoxelLetters(decoded.BoxelCode);
        SystemNameParts parts = new(
            SectorName.FromGridPosition(decoded.SectorGridPosition),
            letters.L1,
            letters.L2,
            letters.L3,
            decoded.SizeClass,
            letters.N1,
            decoded.Sequence);

        (SystemNameParts named, bool handAuthored, bool requiresPermit) =
            ApplyHandAuthoredRegion(parts, decoded, position);

        // Every name a grid position writes answers to a region, and a region the game
        // names by hand is proved to answer before it is taken. The guard stays so that an
        // address this class cannot carry fails loudly rather than quietly.
        NamingRegionOrigin origin = NamingRegionOrigins.Resolve(named.RegionName)
            ?? throw new ArgumentOutOfRangeException(
                nameof(decoded), named.RegionName, "No naming region answers to that name.");

        return new ProceduralSystem(
            named,
            address ?? Addresses.Encode(named, origin),
            modulatedAddress ?? TryEncodeModulated(named),
            position,
            handAuthored,
            requiresPermit);
    }

    /// <summary>
    /// Gives a system that falls inside a region the game names by hand that region's name
    /// and letters.
    /// </summary>
    /// <returns>
    /// The parts as the game writes them, and whether a region the game names by hand
    /// wrote them. The mass code and the system's own number do not follow from the region,
    /// so they never change.
    /// </returns>
    private static (SystemNameParts Parts, bool HandAuthored, bool RequiresPermit)
        ApplyHandAuthoredRegion(
            SystemNameParts parts, DecodedSystemAddress decoded, GalacticPosition? position)
    {
        if (position is null) return (parts, false, false);

        HandAuthoredRegion? region = HandAuthoredRegions.FindAt(position);
        if (region is null) return (parts, false, false);

        NamingRegionOrigin? origin = NamingRegionOrigins.Resolve(region.Name);
        if (origin is null || origin.X < 0 || origin.Y < 0 || origin.Z < 0)
        {
            return (parts, false, false);
        }

        int? boxelCode = Addresses.ToBoxelCode(decoded.SizeClass, decoded.AbsoluteBoxel, origin);
        if (boxelCode is null) return (parts, false, false);

        BoxelLetters letters = SystemName.ToBoxelLetters(boxelCode.Value);
        return (
            parts with
            {
                RegionName = region.Name,
                L1 = letters.L1,
                L2 = letters.L2,
                L3 = letters.L3,
                N1 = letters.N1,
            },
            true,
            PermitLocks.IsLockedRegionName(region.Name));
    }

    /// <summary>Writes the modulated address, where the layout has room for the system.</summary>
    private static ulong? TryEncodeModulated(SystemNameParts parts)
    {
        NamingRegionOrigin? origin = NamingRegionOrigins.Resolve(parts.RegionName);
        if (origin is null) return null;

        try
        {
            return Addresses.EncodeModulated(parts, origin);
        }
        catch (ArgumentOutOfRangeException)
        {
            // The one refusal a caller of this can meet is a system number the narrower
            // field has no room for, and that is a plain answer of "this layout carries no
            // form of it". Every other field was settled before this call.
            return null;
        }
    }
}
