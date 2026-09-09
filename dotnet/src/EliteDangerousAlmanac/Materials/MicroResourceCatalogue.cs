using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Materials.Internal;

namespace EliteDangerousAlmanac.Materials;

/// <summary>
/// The Odyssey micro-resource catalogues and the lookups that search them.
/// </summary>
/// <remarks>
/// <para>
/// Elite Dangerous: Odyssey adds the on-foot micro resources — the components, data,
/// consumables and items a Commander carries on foot. They are distinct from the
/// ship-side engineering materials, which carry a grade and a line.
/// </para>
/// <para>
/// Every lookup searches <see cref="All"/> by default, and the by-key lookups take an
/// optional subset. Passing <see cref="All"/>, or omitting the argument, answers from an
/// index; every other list is scanned.
/// </para>
/// <para>
/// The data originates from EDCD FDevIDs, in-game verification and INARA. See
/// <c>data/materials/SOURCES.md</c> for provenance and <c>ATTRIBUTIONS.md</c> for credit.
/// </para>
/// </remarks>
public static class MicroResourceCatalogue
{
    private static readonly Lazy<IReadOnlyList<MicroResource>> ComponentResources = new(
        () => MicroResourceCatalogueBuilder.Build("data/materials/micro-resources-component.jsonc", MicroResourceCategory.Component));

    private static readonly Lazy<IReadOnlyList<MicroResource>> ConsumableResources = new(
        () => MicroResourceCatalogueBuilder.Build("data/materials/micro-resources-consumable.jsonc", MicroResourceCategory.Consumable));

    private static readonly Lazy<IReadOnlyList<MicroResource>> DataResources = new(
        () => MicroResourceCatalogueBuilder.Build("data/materials/micro-resources-data.jsonc", MicroResourceCategory.Data));

    private static readonly Lazy<IReadOnlyList<MicroResource>> ItemResources = new(
        () => MicroResourceCatalogueBuilder.Build("data/materials/micro-resources-item.jsonc", MicroResourceCategory.Item));

    private static readonly Lazy<IReadOnlyList<MicroResource>> AllResources = new(Concatenate);

    private static readonly Lazy<IReadOnlyDictionary<string, MicroResource>> BySymbol = new(
        () => RegistryIndex.CreateKeyIndex(All, resource => resource.Symbol));

    private static readonly Lazy<IReadOnlyDictionary<string, MicroResource>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(All, resource => resource.Name));

    /// <summary>The manufactured parts spent upgrading suits and hand weapons.</summary>
    public static IReadOnlyList<MicroResource> Components => ComponentResources.Value;

    /// <summary>The deployable field tools.</summary>
    public static IReadOnlyList<MicroResource> Consumables => ConsumableResources.Value;

    /// <summary>The intel and files downloaded, stolen or traded on foot.</summary>
    public static IReadOnlyList<MicroResource> Data => DataResources.Value;

    /// <summary>The physical goods collected and traded on foot.</summary>
    public static IReadOnlyList<MicroResource> Items => ItemResources.Value;

    /// <summary>
    /// Every micro resource: components, then consumables, then data, then items.
    /// </summary>
    public static IReadOnlyList<MicroResource> All => AllResources.Value;

    /// <summary>
    /// Finds a micro resource by its Frontier symbol, the id the player journal reports.
    /// </summary>
    /// <param name="symbol">
    /// The internal symbol, such as <c>graphene</c>. Leading and trailing whitespace and
    /// case are ignored.
    /// </param>
    /// <param name="microResources">
    /// The subset to search. Omit it to search every micro resource, which is also the
    /// only indexed path.
    /// </param>
    /// <returns>The micro resource, or <see langword="null"/> when none has that symbol.</returns>
    public static MicroResource? FindBySymbol(string? symbol, IReadOnlyList<MicroResource>? microResources = null) =>
        IsWholeCatalogue(microResources)
            ? RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol)
            : RegistryIndex.FindByKey(microResources!, resource => resource.Symbol, symbol);

    /// <summary>Finds a micro resource by its display name.</summary>
    /// <param name="name">
    /// The display name, such as <c>Circuit Board</c>. Leading and trailing whitespace and
    /// case are ignored.
    /// </param>
    /// <param name="microResources">The subset to search. Omit it to search every micro resource.</param>
    /// <returns>The micro resource, or <see langword="null"/> when none has that name.</returns>
    public static MicroResource? FindByName(string? name, IReadOnlyList<MicroResource>? microResources = null) =>
        IsWholeCatalogue(microResources)
            ? RegistryIndex.FindInKeyIndex(ByName.Value, name)
            : RegistryIndex.FindByKey(microResources!, resource => resource.Name, name);

    /// <summary>Every micro resource in one category, in catalogue order.</summary>
    /// <param name="category">The category to match.</param>
    /// <returns>The category's own catalogue.</returns>
    public static IReadOnlyList<MicroResource> InCategory(MicroResourceCategory category) => category switch
    {
        MicroResourceCategory.Component => Components,
        MicroResourceCategory.Consumable => Consumables,
        MicroResourceCategory.Data => Data,
        MicroResourceCategory.Item => Items,
        _ => [],
    };

    /// <summary>Every micro resource in one category, named as the data files spell it.</summary>
    /// <remarks>Leading and trailing whitespace and case are ignored.</remarks>
    /// <param name="category">The category name.</param>
    /// <returns>The matches, or an empty list when no category has that name.</returns>
    public static IReadOnlyList<MicroResource> InCategory(string? category) =>
        MicroResourceCategories.TryParse(category, out MicroResourceCategory parsed) ? InCategory(parsed) : [];

    private static bool IsWholeCatalogue(IReadOnlyList<MicroResource>? microResources) =>
        microResources is null || ReferenceEquals(microResources, All);

    private static ReadOnlyCollection<MicroResource> Concatenate()
    {
        List<MicroResource> all = new(Components.Count + Consumables.Count + Data.Count + Items.Count);
        all.AddRange(Components);
        all.AddRange(Consumables);
        all.AddRange(Data);
        all.AddRange(Items);
        return new ReadOnlyCollection<MicroResource>(all);
    }
}
