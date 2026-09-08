using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Materials;

/// <summary>Which on-foot inventory an Odyssey micro resource belongs to.</summary>
public enum MicroResourceCategory
{
    /// <summary>The manufactured parts spent upgrading suits and hand weapons.</summary>
    Component,

    /// <summary>The deployable field tools: medkits, energy cells, grenades, E-Breach.</summary>
    Consumable,

    /// <summary>The intel and files downloaded, stolen or traded on foot.</summary>
    Data,

    /// <summary>The physical goods collected and traded on foot.</summary>
    Item,
}

/// <summary>Reads a <see cref="MicroResourceCategory"/> from its name.</summary>
public static class MicroResourceCategories
{
    /// <summary>Reads a category from its name.</summary>
    /// <remarks>Leading and trailing whitespace and case are ignored.</remarks>
    /// <param name="name">The category name: <c>component</c>, <c>consumable</c>, <c>data</c> or <c>item</c>.</param>
    /// <param name="category">The category the name denotes, when the answer is <see langword="true"/>.</param>
    /// <returns><see langword="true"/> when the name denotes a category.</returns>
    public static bool TryParse(string? name, out MicroResourceCategory category) =>
        EnumParsing.TryParse(name, out category);
}

/// <summary>One Odyssey micro resource in Frontier's registry.</summary>
/// <remarks>
/// A pure registry record: it says what a micro resource is, not where it is found or what
/// it is worth. Unlike a ship-side <see cref="Material"/>, a micro resource has no grade
/// and no line.
/// </remarks>
/// <param name="Symbol">
/// Frontier's internal symbol, such as <c>graphene</c> — the id the player journal
/// reports, matched without regard to case.
/// </param>
/// <param name="Category">Which on-foot inventory the micro resource belongs to.</param>
/// <param name="Name">Display name, such as <c>Graphene</c>.</param>
public sealed record MicroResource(string Symbol, MicroResourceCategory Category, string Name);
