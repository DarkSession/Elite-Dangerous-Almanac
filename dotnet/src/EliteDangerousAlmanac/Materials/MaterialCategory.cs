using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Materials;

/// <summary>Which of the three engineering-material categories a material belongs to.</summary>
public enum MaterialCategory
{
    /// <summary>The chemical elements a Commander mines or collects from a surface.</summary>
    Raw,

    /// <summary>The parts salvaged from ships and installations.</summary>
    Manufactured,

    /// <summary>The data scanned from ships, wakes, beacons and installations.</summary>
    Encoded,
}

/// <summary>Reads a <see cref="MaterialCategory"/> from its name.</summary>
public static class MaterialCategories
{
    /// <summary>Reads a category from its name.</summary>
    /// <remarks>
    /// Leading and trailing whitespace and case are ignored, so a value that arrived from
    /// a saved filter or a dropdown resolves without cleaning it first.
    /// </remarks>
    /// <param name="name">The category name: <c>raw</c>, <c>manufactured</c> or <c>encoded</c>.</param>
    /// <param name="category">The category the name denotes, when the answer is <see langword="true"/>.</param>
    /// <returns><see langword="true"/> when the name denotes a category.</returns>
    public static bool TryParse(string? name, out MaterialCategory category) =>
        EnumParsing.TryParse(name, out category);
}
