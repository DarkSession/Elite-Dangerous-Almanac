using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The canonical English display name of every outfitting module family.</summary>
/// <remarks>
/// The names are Frontier's own outfitting category labels where the game publishes one, and
/// this library's descriptive name for the families it does not. They are canonical English,
/// not localized interface text; the i18n area answers for a locale.
/// </remarks>
public static class OutfittingFamilies
{
    private static readonly Lazy<IReadOnlyDictionary<OutfittingFamilyId, string>> Names = new(Load);

    /// <summary>Every family's canonical English display name, keyed by id.</summary>
    public static IReadOnlyDictionary<OutfittingFamilyId, string> All => Names.Value;

    /// <summary>The canonical English display name of one family.</summary>
    /// <param name="family">The family to name.</param>
    /// <returns>The display name.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="family"/> is not a member.</exception>
    public static string DisplayName(this OutfittingFamilyId family) =>
        All.TryGetValue(family, out string? name)
            ? name
            : throw new ArgumentOutOfRangeException(nameof(family), family, "Not an outfitting family.");

    private static IReadOnlyDictionary<OutfittingFamilyId, string> Load() =>
        SharedData.LoadEnumKeyed<OutfittingFamilyId, string>("data/ships/module-families.jsonc");
}
