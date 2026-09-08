using System.Globalization;
using System.Text.RegularExpressions;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The English label a mount view carries.</summary>
/// <remarks>
/// A journal slot key is the mount's identity and this is what a panel shows. A key the
/// patterns do not recognise reads back as itself, because a label nobody can act on is worse
/// than the key a caller can look up.
/// </remarks>
internal static class LoadoutSlotNames
{
    private static readonly Regex HardpointKey = new(
        @"^(Small|Medium|Large|Huge)(Mining)?Hardpoint(\d+)$", RegexOptions.CultureInvariant);

    private static readonly Regex UtilityKey = new(
        @"^TinyHardpoint(\d+)$", RegexOptions.CultureInvariant);

    private static readonly Regex OptionalKey = new(
        @"^Slot(\d+)_Size(\d+)$", RegexOptions.CultureInvariant);

    /// <summary>The label for one mount.</summary>
    internal static string For(BuildSlot slot) => slot.Kind switch
    {
        SlotKind.Core => CoreName(slot),
        SlotKind.Hardpoint => HardpointName(slot),
        SlotKind.Utility => UtilityName(slot),
        SlotKind.Optional => OptionalName(slot),
        SlotKind.Armour => "Armour",
        _ => "Cargo Hatch",
    };

    private static string CoreName(BuildSlot slot) => slot.Core switch
    {
        CoreSlotType.PowerPlant => "Power Plant",
        CoreSlotType.Thrusters => "Thrusters",
        CoreSlotType.FrameShiftDrive => "Frame Shift Drive",
        CoreSlotType.LifeSupport => "Life Support",
        CoreSlotType.PowerDistributor => "Power Distributor",
        CoreSlotType.Sensors => "Sensors",
        CoreSlotType.FuelTank => "Fuel Tank",
        _ => slot.Key,
    };

    private static string HardpointName(BuildSlot slot)
    {
        Match match = HardpointKey.Match(slot.Key);
        if (!match.Success) return slot.Key;

        string mining = match.Groups[2].Success ? " Mining" : string.Empty;
        return string.Format(
            CultureInfo.InvariantCulture,
            "{0}{1} Hardpoint {2}",
            match.Groups[1].Value,
            mining,
            Number(match.Groups[3].Value));
    }

    private static string UtilityName(BuildSlot slot)
    {
        Match match = UtilityKey.Match(slot.Key);
        return match.Success
            ? string.Format(
                CultureInfo.InvariantCulture, "Utility Mount {0}", Number(match.Groups[1].Value))
            : slot.Key;
    }

    private static string OptionalName(BuildSlot slot)
    {
        if (slot.Restriction == SlotRestriction.PlanetaryApproachSuite)
        {
            return "Planetary Approach Suite";
        }

        if (slot.Restriction is SlotRestriction restriction)
        {
            string? label = RestrictedName(restriction);
            string? numbered = TrailingDigits(slot.Key);
            return label is not null && numbered is not null
                ? string.Format(CultureInfo.InvariantCulture, "{0} {1}", label, Number(numbered))
                : slot.Key;
        }

        Match match = OptionalKey.Match(slot.Key);
        return match.Success
            ? string.Format(
                CultureInfo.InvariantCulture,
                "Optional Internal {0} (Size {1})",
                Number(match.Groups[1].Value),
                slot.Size)
            : slot.Key;
    }

    private static string? RestrictedName(SlotRestriction restriction) => restriction switch
    {
        SlotRestriction.Military => "Military Slot",
        SlotRestriction.Cargo => "Cargo Slot",
        SlotRestriction.LimpetController => "Limpet Controller Slot",
        SlotRestriction.VesselHangar => "Vessel Hangar Slot",
        SlotRestriction.Passenger => "Passenger Slot",
        _ => null,
    };

    /// <summary>The digits a key ends on, which is the mount's own number.</summary>
    private static string? TrailingDigits(string key)
    {
        int start = key.Length;
        while (start > 0 && key[start - 1] is >= '0' and <= '9') start--;
        return start == key.Length ? null : key.Substring(start);
    }

    /// <summary>Reads a key's digits as a number, so a leading zero does not reach the label.</summary>
    private static int Number(string digits) =>
        int.Parse(digits, NumberStyles.None, CultureInfo.InvariantCulture);
}
