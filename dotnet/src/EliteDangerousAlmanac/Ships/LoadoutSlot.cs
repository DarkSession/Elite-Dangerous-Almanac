namespace EliteDangerousAlmanac.Ships;

/// <summary>Why a hull mount cannot be emptied.</summary>
public enum ImmovableReason
{
    /// <summary>The built-in cargo hatch, which every hull carries and no edit removes.</summary>
    CargoHatch,

    /// <summary>An armour or core-internal mount, which an operational build keeps filled.</summary>
    RequiredSlot,

    /// <summary>
    /// Emptying the mount would drop an allowance-increasing module and leave the build over a
    /// per-ship module limit.
    /// </summary>
    ModuleLimit,
}

/// <summary>A point-in-time view of one hull mount.</summary>
/// <remarks>
/// The view is detached from the build it came from, so read it again after an edit that
/// changes the build. Every edit and every candidate query lives on the build itself and takes
/// the mount's <see cref="BuildSlot.Key"/>, which is what keeps this value free of lifecycle
/// rules.
/// </remarks>
/// <param name="Slot">The mount itself: its key, its kind and its size.</param>
/// <param name="Name">The English label, such as <c>Frame Shift Drive</c>.</param>
/// <param name="Module">The fitted module, or <see langword="null"/> when the mount is empty.</param>
/// <param name="Removable">Whether an edit may empty this mount.</param>
/// <param name="ImmovableReason">
/// Why the mount cannot be emptied, and <see langword="null"/> when
/// <paramref name="Removable"/> is set.
/// </param>
public sealed record LoadoutSlot(
    BuildSlot Slot,
    string Name,
    FittedModule? Module,
    bool Removable,
    ImmovableReason? ImmovableReason = null)
{
    /// <summary>The mount's stable journal key, which every edit takes.</summary>
    public string Key => Slot.Key;

    /// <summary>Which kind of mount this is.</summary>
    public SlotKind Kind => Slot.Kind;

    /// <summary>The mount's class.</summary>
    public int Size => Slot.Size;
}
