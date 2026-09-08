using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Commodities.Internal;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Commodities;

/// <summary>
/// The market-commodity registries and the lookups that search them.
/// </summary>
/// <remarks>
/// <para>
/// Frontier splits the goods traded at station commodity markets into two registries: the
/// standard commodities on every market, and the rare commodities each produced at a
/// single station. Every lookup searches <see cref="All"/> by default, so you do not have
/// to know which registry a good belongs to before you can find it.
/// </para>
/// <para>
/// The by-key lookups take an optional subset. Passing <see cref="All"/>, or omitting the
/// argument, answers from an index; every other list is scanned.
/// </para>
/// <para>
/// The data originates from EDCD FDevIDs, from player-journal observations and from the
/// running game's own commodity registry. See <c>data/commodities/SOURCES.md</c> for
/// provenance and <c>ATTRIBUTIONS.md</c> for credit.
/// </para>
/// </remarks>
public static class CommodityCatalogue
{
    private static readonly Lazy<IReadOnlyList<Commodity>> StandardCommodities = new(
        () => CommodityCatalogueBuilder.Build("data/commodities/commodities.jsonc", rare: false));

    private static readonly Lazy<IReadOnlyList<Commodity>> RareCommodities = new(
        () => CommodityCatalogueBuilder.Build("data/commodities/rare-commodities.jsonc", rare: true));

    private static readonly Lazy<IReadOnlyList<Commodity>> AllCommodities = new(Concatenate);

    private static readonly Lazy<IReadOnlyDictionary<string, Commodity>> BySymbol = new(
        () => RegistryIndex.CreateKeyIndex(All, commodity => commodity.Symbol));

    private static readonly Lazy<IReadOnlyDictionary<string, Commodity>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(All, commodity => commodity.Name));

    /// <summary>
    /// Every standard commodity, in Frontier's registry order. Every record has
    /// <see cref="Commodity.Rare"/> set to <see langword="false"/>.
    /// </summary>
    public static IReadOnlyList<Commodity> Standard => StandardCommodities.Value;

    /// <summary>
    /// Every rare commodity. Every record has <see cref="Commodity.Rare"/> set to
    /// <see langword="true"/>.
    /// </summary>
    public static IReadOnlyList<Commodity> Rare => RareCommodities.Value;

    /// <summary>Every commodity: the standard registry, then the rare registry.</summary>
    public static IReadOnlyList<Commodity> All => AllCommodities.Value;

    /// <summary>
    /// Finds a commodity by its Frontier symbol, the id the market and the player journal
    /// report.
    /// </summary>
    /// <param name="symbol">
    /// The internal symbol, such as <c>Platinum</c>. Leading and trailing whitespace and
    /// case are ignored.
    /// </param>
    /// <param name="commodities">
    /// The subset to search. Omit it to search every commodity, which is also the only
    /// indexed path.
    /// </param>
    /// <returns>The commodity, or <see langword="null"/> when none has that symbol.</returns>
    public static Commodity? FindBySymbol(string? symbol, IReadOnlyList<Commodity>? commodities = null) =>
        IsWholeCatalogue(commodities)
            ? RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol)
            : RegistryIndex.FindByKey(commodities!, commodity => commodity.Symbol, symbol);

    /// <summary>Finds a commodity by its display name.</summary>
    /// <param name="name">
    /// The display name as the market spells it, such as <c>Lavian Brandy</c>. Leading and
    /// trailing whitespace and case are ignored; matching is otherwise exact.
    /// </param>
    /// <param name="commodities">The subset to search. Omit it to search every commodity.</param>
    /// <returns>The commodity, or <see langword="null"/> when none has that name.</returns>
    public static Commodity? FindByName(string? name, IReadOnlyList<Commodity>? commodities = null) =>
        IsWholeCatalogue(commodities)
            ? RegistryIndex.FindInKeyIndex(ByName.Value, name)
            : RegistryIndex.FindByKey(commodities!, commodity => commodity.Name, name);

    /// <summary>Every commodity in one market group, standard and rare, in registry order.</summary>
    /// <param name="category">The market group to match.</param>
    /// <returns>The matches, in catalogue order.</returns>
    public static IReadOnlyList<Commodity> InCategory(CommodityCategory category)
    {
        List<Commodity> matches = [];
        foreach (Commodity commodity in All)
        {
            if (commodity.Category == category) matches.Add(commodity);
        }

        return new ReadOnlyCollection<Commodity>(matches);
    }

    /// <summary>Every commodity in one market group, named as the game spells it.</summary>
    /// <remarks>
    /// The same answer as the <see cref="CommodityCategory"/> overload, reached from a
    /// string — which is what a market payload or a user's dropdown hands you. Leading and
    /// trailing whitespace and case are ignored.
    /// </remarks>
    /// <param name="category">The group name, such as <c>Legal Drugs</c>.</param>
    /// <returns>The matches, or an empty list when no group has that name.</returns>
    public static IReadOnlyList<Commodity> InCategory(string? category) =>
        CommodityCategories.TryParse(category, out CommodityCategory parsed) ? InCategory(parsed) : [];

    private static bool IsWholeCatalogue(IReadOnlyList<Commodity>? commodities) =>
        commodities is null || ReferenceEquals(commodities, All);

    private static ReadOnlyCollection<Commodity> Concatenate()
    {
        List<Commodity> all = new(Standard.Count + Rare.Count);
        all.AddRange(Standard);
        all.AddRange(Rare);
        return new ReadOnlyCollection<Commodity>(all);
    }
}
