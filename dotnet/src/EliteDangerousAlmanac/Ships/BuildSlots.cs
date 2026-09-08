using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// The slot model for a ship build: it expands a hull's layout into keyed mounts, and it
/// reads a journal slot name back into the same shape.
/// </summary>
/// <remarks>
/// <para>
/// A hull offers a fixed set of mounts: seven core internals, a handful of weapon
/// hardpoints, some tiny utility mounts, and a column of optional internals. Some mounts
/// are restricted to one family of modules.
/// </para>
/// <para>
/// This class holds no data. <see cref="Enumerate"/> takes a hull's
/// <see cref="ShipSlots"/> layout and gives every mount a stable, journal-compatible key,
/// so a build assembled from scratch and a build read from a journal export speak one
/// vocabulary.
/// </para>
/// </remarks>
public static class BuildSlots
{
    /// <summary>The seven core mounts in outfitting-panel order.</summary>
    private static readonly CoreSlotType[] CoreOrder =
    [
        CoreSlotType.PowerPlant,
        CoreSlotType.Thrusters,
        CoreSlotType.FrameShiftDrive,
        CoreSlotType.LifeSupport,
        CoreSlotType.PowerDistributor,
        CoreSlotType.Sensors,
        CoreSlotType.FuelTank,
    ];

    private static readonly Dictionary<string, CoreSlotType> CoreByKey = new(StringComparer.OrdinalIgnoreCase)
    {
        ["PowerPlant"] = CoreSlotType.PowerPlant,
        ["MainEngines"] = CoreSlotType.Thrusters,
        ["FrameShiftDrive"] = CoreSlotType.FrameShiftDrive,
        ["LifeSupport"] = CoreSlotType.LifeSupport,
        ["PowerDistributor"] = CoreSlotType.PowerDistributor,
        ["Radar"] = CoreSlotType.Sensors,
        ["FuelTank"] = CoreSlotType.FuelTank,
    };

    /// <summary>Hardpoint class to the journal's size-class word.</summary>
    private static readonly Dictionary<int, string> HardpointClass = new()
    {
        [1] = "Small",
        [2] = "Medium",
        [3] = "Large",
        [4] = "Huge",
    };

    private static readonly Dictionary<string, int> HardpointClassSize = new(StringComparer.OrdinalIgnoreCase)
    {
        ["small"] = 1,
        ["medium"] = 2,
        ["large"] = 3,
        ["huge"] = 4,
    };

    /// <summary>Journal key prefix for a numbered restricted optional.</summary>
    /// <remarks>The planetary approach suite is absent: its key carries no number.</remarks>
    private static readonly Dictionary<SlotRestriction, string> OptionalPrefix = new()
    {
        [SlotRestriction.Military] = "Military",
        [SlotRestriction.Cargo] = "Cargo",
        [SlotRestriction.LimpetController] = "LimpetController",
        [SlotRestriction.VesselHangar] = "FighterBay",
        [SlotRestriction.Passenger] = "Passenger",
    };

    /// <summary>
    /// Expands a hull's layout into keyed mounts, in outfitting-panel order: hardpoints,
    /// utility mounts, armour, the seven core internals, the optional internals, then the
    /// cargo hatch.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Unrestricted optionals are numbered <c>Slot01_SizeN</c>, <c>Slot02_SizeN</c> and so
    /// on with no gaps, and hardpoints run 1, 2, 3 within each size class. Some hulls
    /// disagree and no rule derives what they do instead, so a mount on one of them
    /// carries its own name and that name wins: the Anaconda's <c>Slot13_Size2</c> and
    /// <c>Slot14_Size1</c> with no 11 or 12, the Type-9 Heavy starting at
    /// <c>Slot00_Size8</c>, the Type-8 Transporter skipping <c>SmallHardpoint3</c>, and
    /// the Caspian Explorer's mediums running 6, 5, 1, 2, 3, 4.
    /// </para>
    /// <para>
    /// A restricted optional takes a name numbered within its own restriction and consumes
    /// no <c>SlotNN</c> number. A hull that names any mount of a kind names all of them, so
    /// a derived key and a stored name never compete for the same string.
    /// </para>
    /// </remarks>
    /// <param name="layout">The hull's slot layout.</param>
    /// <returns>Every mount the hull offers.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="layout"/> is <see langword="null"/>.</exception>
    public static IReadOnlyList<BuildSlot> Enumerate(ShipSlots layout)
    {
        if (layout is null) throw new ArgumentNullException(nameof(layout));

        List<BuildSlot> slots = [];

        // Hardpoints, numbered within each size class in layout order. A restricted mount
        // shares that per-class numbering and takes an infix, so the Type-11's four medium
        // mounts run MediumMiningHardpoint1, MediumMiningHardpoint2, MediumHardpoint3.
        Dictionary<int, int> hardpointCount = [];
        foreach (HardpointSlotSpec spec in layout.Hardpoints)
        {
            if (!HardpointClass.TryGetValue(spec.Size, out string? sizeClass)) continue;
            hardpointCount.TryGetValue(spec.Size, out int used);
            hardpointCount[spec.Size] = ++used;
            string infix = spec.Restriction == SlotRestriction.Mining ? "Mining" : string.Empty;
            string derived = string.Format(
                CultureInfo.InvariantCulture, "{0}{1}Hardpoint{2}", sizeClass, infix, used);
            slots.Add(new BuildSlot(
                spec.Name ?? derived, SlotKind.Hardpoint, spec.Size, Restriction: spec.Restriction));
        }

        for (int index = 1; index <= layout.Utility; index++)
        {
            slots.Add(new BuildSlot(
                string.Format(CultureInfo.InvariantCulture, "TinyHardpoint{0}", index),
                SlotKind.Utility,
                0));
        }

        slots.Add(new BuildSlot("Armour", SlotKind.Armour, 0));
        foreach (CoreSlotType core in CoreOrder)
        {
            slots.Add(new BuildSlot(core.SlotKey(), SlotKind.Core, layout.Core[core], Core: core));
        }

        int slotNumber = 1;
        Dictionary<SlotRestriction, int> restrictedCount = [];
        foreach (OptionalSlotSpec spec in layout.Optional)
        {
            SlotRestriction? restriction = spec.Restriction;
            if (restriction == SlotRestriction.PlanetaryApproachSuite)
            {
                slots.Add(new BuildSlot(
                    spec.Name ?? "PlanetaryApproachSuite",
                    SlotKind.Optional,
                    spec.Size,
                    Restriction: restriction));
            }
            else if (restriction is SlotRestriction value)
            {
                restrictedCount.TryGetValue(value, out int used);
                restrictedCount[value] = ++used;
                string derived = string.Format(
                    CultureInfo.InvariantCulture, "{0}{1:00}", OptionalPrefix[value], used);
                slots.Add(new BuildSlot(
                    spec.Name ?? derived, SlotKind.Optional, spec.Size, Restriction: value));
            }
            else
            {
                // The running number advances whether or not a name overrides it, so the
                // derived key for a mount does not depend on how many earlier mounts were
                // named.
                string derived = string.Format(
                    CultureInfo.InvariantCulture, "Slot{0:00}_Size{1}", slotNumber++, spec.Size);
                slots.Add(new BuildSlot(spec.Name ?? derived, SlotKind.Optional, spec.Size));
            }
        }

        slots.Add(new BuildSlot("CargoHatch", SlotKind.CargoHatch, 1));
        return new ReadOnlyCollection<BuildSlot>(slots);
    }

    /// <summary>Reads a journal slot name into a classification.</summary>
    /// <remarks>
    /// <para>
    /// Every restricted mount has a journal name of its own, so the restriction comes off
    /// the name and needs no hull layout. The size still may: <c>Cargo01</c> says only that
    /// the mount takes cargo, and the hull's layout carries how big it is.
    /// </para>
    /// <para>
    /// Casing is not significant. Frontier writes <c>FrameShiftDrive</c>, but a journal
    /// export may lower-case every slot key, and both name the same mount.
    /// </para>
    /// <para>
    /// A <c>_SizeN</c> suffix is what the name says, not what the mount is. On some hulls
    /// the game's own key disagrees with the mount it names — the Keelback's
    /// <c>Slot03_Size3</c> is a size-4 mount. To size a mount, find it in the hull's layout
    /// rather than trusting the number this returns.
    /// </para>
    /// </remarks>
    /// <param name="slot">
    /// The journal slot name, such as <c>FrameShiftDrive</c>, <c>MediumHardpoint2</c>,
    /// <c>Slot03_Size5</c> or <c>LargeMiningHardpoint1</c>.
    /// </param>
    /// <returns>
    /// The classification, or <see langword="null"/> when the name is not a slot this
    /// library knows. An absent name is a miss, answered the way an unknown key is.
    /// </returns>
    public static ParsedSlot? ParseName(string? slot)
    {
        if (string.IsNullOrWhiteSpace(slot)) return null;
        string key = slot!.Trim();

        if (CoreByKey.TryGetValue(key, out CoreSlotType core))
        {
            return new ParsedSlot(SlotKind.Core, null, Core: core);
        }

        if (Same(key, "Armour")) return new ParsedSlot(SlotKind.Armour, 0);
        if (Same(key, "CargoHatch")) return new ParsedSlot(SlotKind.CargoHatch, 1);
        if (Same(key, "PlanetaryApproachSuite"))
        {
            return new ParsedSlot(SlotKind.Optional, null, Restriction: SlotRestriction.PlanetaryApproachSuite);
        }

        ParsedSlot? hardpoint = ParseHardpoint(key);
        if (hardpoint is not null) return hardpoint;

        if (IsNumbered(key, "TinyHardpoint")) return new ParsedSlot(SlotKind.Utility, 0);
        foreach (KeyValuePair<SlotRestriction, string> entry in OptionalPrefix)
        {
            if (IsNumbered(key, entry.Value))
            {
                return new ParsedSlot(SlotKind.Optional, null, Restriction: entry.Key);
            }
        }

        return ParseOptional(key);
    }

    private static ParsedSlot? ParseHardpoint(string key)
    {
        foreach (KeyValuePair<string, int> entry in HardpointClassSize)
        {
            if (!key.StartsWith(entry.Key, StringComparison.OrdinalIgnoreCase)) continue;
            string rest = key.Substring(entry.Key.Length);
            bool mining = rest.StartsWith("Mining", StringComparison.OrdinalIgnoreCase);
            if (mining) rest = rest.Substring("Mining".Length);
            if (!IsNumbered(rest, "Hardpoint")) continue;
            return new ParsedSlot(
                SlotKind.Hardpoint,
                entry.Value,
                Restriction: mining ? SlotRestriction.Mining : null);
        }

        return null;
    }

    /// <summary>Reads the <c>SlotNN_SizeS</c> key an unrestricted optional carries.</summary>
    private static ParsedSlot? ParseOptional(string key)
    {
        if (!key.StartsWith("Slot", StringComparison.OrdinalIgnoreCase)) return null;
        int separator = key.IndexOf('_');
        if (separator < 0) return null;

        string number = key.Substring("Slot".Length, separator - "Slot".Length);
        if (!IsDigits(number)) return null;

        string suffix = key.Substring(separator + 1);
        if (!suffix.StartsWith("Size", StringComparison.OrdinalIgnoreCase)) return null;

        string size = suffix.Substring("Size".Length);
        if (!IsDigits(size)) return null;
        if (!int.TryParse(size, NumberStyles.None, CultureInfo.InvariantCulture, out int parsed)) return null;
        return new ParsedSlot(SlotKind.Optional, parsed);
    }

    private static bool Same(string key, string wanted) =>
        string.Equals(key, wanted, StringComparison.OrdinalIgnoreCase);

    /// <summary>Whether a key is a prefix followed by one or more digits.</summary>
    private static bool IsNumbered(string key, string prefix) =>
        key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
        && IsDigits(key.Substring(prefix.Length));

    private static bool IsDigits(string text)
    {
        if (text.Length == 0) return false;
        foreach (char character in text)
        {
            if (character < '0' || character > '9') return false;
        }

        return true;
    }
}
