using System;
using System.Collections.Generic;
using System.Globalization;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Localization.Internal;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Localization;

/// <summary>The display text this package builds rather than a source publishes.</summary>
/// <remarks>
/// A mount label, a slot name and a diagnostic message are English prose written here. A
/// lookup answers one for an English tag alone and <see langword="null"/> otherwise, so an
/// application never mistakes English for the language it asked for. The stable codes
/// beside a diagnostic stay readable whatever the tag, for an application that supplies a
/// message catalogue of its own.
/// </remarks>
public static partial class DisplayText
{
    private static readonly Dictionary<SlotRestriction, string> RestrictionLabels = new()
    {
        [SlotRestriction.Mining] = "mining tools",
        [SlotRestriction.Military] = "reinforcement packages and shield cell banks",
        [SlotRestriction.PlanetaryApproachSuite] = "planetary approach suites",
        [SlotRestriction.Cargo] = "cargo racks and fuel tanks",
        [SlotRestriction.LimpetController] = "limpet controllers",
        [SlotRestriction.VesselHangar] = "vessel hangars",
        [SlotRestriction.Passenger] = "passenger cabins",
    };

    private static readonly Dictionary<string, string> MountLabels = new(StringComparer.Ordinal)
    {
        ["PrimaryWeapon1"] = "Primary Weapon 1",
        ["PrimaryWeapon2"] = "Primary Weapon 2",
        ["SecondaryWeapon"] = "Secondary Weapon",
    };

    /// <summary>Reads a pre-engineered variant's display name.</summary>
    /// <param name="variant">The variant, which names the article the game sells.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>
    /// The name, or <see langword="null"/> where no record carries the variant or the
    /// source publishes no spelling for the language.
    /// </returns>
    /// <exception cref="ArgumentNullException">The variant is absent.</exception>
    /// <remarks>
    /// A variant is named by its whole identity rather than by its base module: one hull
    /// module carries several purchased articles, and each has a name of its own.
    /// </remarks>
    public static string? PreEngineeredVariantName(PreEngineeredVariant variant, string? locale)
    {
        if (variant is null) throw new ArgumentNullException(nameof(variant));

        string key = string.Format(
            CultureInfo.InvariantCulture,
            "{0}|{1}|{2}|{3}",
            variant.Symbol.Trim(),
            variant.BlueprintSymbol.Trim(),
            variant.ExperimentalEffectSymbol?.Trim() ?? string.Empty,
            AcquisitionKey(variant.Acquisition));

        return LocalizedNames.Find(VariantNames.Value, key, locale);
    }

    /// <summary>Reads a suit weapon mount's label.</summary>
    /// <param name="mount">The mount.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>
    /// The label, or <see langword="null"/> for a tag that is not English, or a mount no
    /// suit carries.
    /// </returns>
    /// <exception cref="ArgumentNullException">The mount is absent.</exception>
    public static string? PersonalMountName(PersonalMount mount, string? locale)
    {
        if (mount is null) throw new ArgumentNullException(nameof(mount));
        return MountLabels.TryGetValue(mount.Key, out string? label)
            ? LocalizedNames.English(label, locale)
            : LocalizedNames.English(null, locale);
    }

    /// <summary>Reads a ship mount's label.</summary>
    /// <param name="slot">The mount, as the hull states it.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The label, or <see langword="null"/> for a tag that is not English.</returns>
    /// <exception cref="ArgumentNullException">The mount is absent.</exception>
    public static string? LoadoutSlotName(BuildSlot slot, string? locale)
    {
        if (slot is null) throw new ArgumentNullException(nameof(slot));
        return LocalizedNames.English(LoadoutSlotNames.For(slot), locale);
    }

    /// <summary>Reads the label for what a restricted mount takes.</summary>
    /// <param name="restriction">The restriction the mount carries.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>
    /// The label, or <see langword="null"/> for a tag that is not English, or a
    /// restriction this package carries no label for.
    /// </returns>
    public static string? SlotRestrictionLabel(SlotRestriction restriction, string? locale) =>
        LocalizedNames.English(
            RestrictionLabels.TryGetValue(restriction, out string? label) ? label : null,
            locale);

    /// <summary>Reads a validation finding's message.</summary>
    /// <param name="issue">The finding.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The message, or <see langword="null"/> for a tag that is not English.</returns>
    /// <exception cref="ArgumentNullException">The finding is absent.</exception>
    public static string? LoadoutIssueMessage(LoadoutIssue issue, string? locale)
    {
        if (issue is null) throw new ArgumentNullException(nameof(issue));
        return LocalizedNames.English(issue.Message, locale);
    }

    /// <summary>Reads a calculation finding's message.</summary>
    /// <param name="issue">The finding.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The message, or <see langword="null"/> for a tag that is not English.</returns>
    /// <exception cref="ArgumentNullException">The finding is absent.</exception>
    public static string? CalculationIssueMessage(CalculationIssue issue, string? locale)
    {
        if (issue is null) throw new ArgumentNullException(nameof(issue));
        return LocalizedNames.English(issue.Message, locale);
    }

    /// <summary>Reads an import diagnostic's message.</summary>
    /// <param name="diagnostic">The diagnostic.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The message, or <see langword="null"/> for a tag that is not English.</returns>
    /// <exception cref="ArgumentNullException">The diagnostic is absent.</exception>
    public static string? SlefDiagnosticMessage(SlefDiagnostic diagnostic, string? locale)
    {
        if (diagnostic is null) throw new ArgumentNullException(nameof(diagnostic));
        return LocalizedNames.English(diagnostic.Message, locale);
    }

    /// <summary>Reads a refused edit's message.</summary>
    /// <param name="error">The refusal.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The message, or <see langword="null"/> for a tag that is not English.</returns>
    /// <exception cref="ArgumentNullException">The refusal is absent.</exception>
    public static string? LoadoutEditErrorMessage(LoadoutEditException error, string? locale)
    {
        if (error is null) throw new ArgumentNullException(nameof(error));
        return LocalizedNames.English(error.Message, locale);
    }

    private static string AcquisitionKey(PreEngineeredAcquisition acquisition)
    {
        string name = acquisition.ToString();
        return char.ToLowerInvariant(name[0]) + name.Substring(1);
    }
}
