namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>A mount an import fills from the hull's stock loadout.</summary>
internal enum StockedMountKind
{
    /// <summary>One of the seven core internals.</summary>
    Core,

    /// <summary>The armour mount.</summary>
    Armour,

    /// <summary>The cargo hatch.</summary>
    CargoHatch,

    /// <summary>The planetary approach suite.</summary>
    ApproachSuite,
}

/// <summary>The mount rules a loadout import, validation and edit all read.</summary>
internal static class LoadoutSlotRules
{
    /// <summary>Whether an operational build keeps this mount occupied.</summary>
    internal static bool IsRequired(SlotKind kind) =>
        kind is SlotKind.Core or SlotKind.Armour;

    /// <summary>
    /// Why the hull mount cannot be emptied, leaving aside the module limits, which depend on
    /// the rest of the build.
    /// </summary>
    internal static ImmovableReason? FixedReason(SlotKind kind)
    {
        if (kind == SlotKind.CargoHatch) return ImmovableReason.CargoHatch;
        return IsRequired(kind) ? ImmovableReason.RequiredSlot : null;
    }

    /// <summary>
    /// Which mount an import stocks from the hull defaults when the source leaves it holding
    /// nothing it can take.
    /// </summary>
    /// <param name="kind">The mount's kind.</param>
    /// <param name="restriction">The mount's restriction, when it has one.</param>
    /// <returns>
    /// The kind of stocked mount, or <see langword="null"/> for every mount a source's own
    /// account stands for.
    /// </returns>
    /// <remarks>
    /// <para>
    /// Armour, the seven core internals and the cargo hatch are stocked because no ship flies
    /// without them. The planetary approach suite is stocked for a different reason: every hull
    /// leaves the shipyard carrying the advanced suite, which is weightless and draws no power,
    /// so a build has nothing to gain by shedding it. The exporters that omit the mount omit it
    /// because they never carried it, Inara writing no entry for the suite at all. Reading that
    /// silence as "sold" would land the import on a ship that cannot approach a planet, so the
    /// hull's own suite goes in.
    /// </para>
    /// <para>
    /// The mount stays removable afterwards. This says what an import with nothing to go on
    /// puts in a mount, not what an edit may later do to it.
    /// </para>
    /// </remarks>
    internal static StockedMountKind? StockedMount(SlotKind kind, SlotRestriction? restriction) =>
        kind switch
        {
            SlotKind.Core => StockedMountKind.Core,
            SlotKind.Armour => StockedMountKind.Armour,
            SlotKind.CargoHatch => StockedMountKind.CargoHatch,
            SlotKind.Optional when restriction == SlotRestriction.PlanetaryApproachSuite =>
                StockedMountKind.ApproachSuite,
            _ => null,
        };
}
