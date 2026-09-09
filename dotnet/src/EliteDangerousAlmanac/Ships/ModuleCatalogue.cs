using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// The outfitting registry — every fittable module, split by Frontier's four categories, with
/// the lookups that turn a journal item string into a record.
/// </summary>
/// <remarks>
/// <para>
/// Every lookup searches <see cref="All"/> by default. A journal item string does not say which
/// category it belongs to, so a caller needs no category to find one, and a symbol is unique
/// across all four.
/// </para>
/// <para>
/// The four category catalogues are for listing a category — an outfitting screen's hardpoint
/// tab. They make poor narrowing arguments: no symbol and no display name is shared across
/// categories, so passing one to a lookup can only make it miss.
/// </para>
/// </remarks>
public static class ModuleCatalogue
{
    private static readonly Lazy<IReadOnlyList<OutfittingModule>> CoreModules = new(
        () => ModuleCatalogueReader.Read("data/ships/modules-core.jsonc", ModuleCategory.Core));

    private static readonly Lazy<IReadOnlyList<OutfittingModule>> InternalModules = new(
        () => ModuleCatalogueReader.Read("data/ships/modules-internal.jsonc", ModuleCategory.Internal));

    private static readonly Lazy<IReadOnlyList<OutfittingModule>> HardpointModules = new(
        () => ModuleCatalogueReader.Read("data/ships/modules-hardpoint.jsonc", ModuleCategory.Hardpoint));

    private static readonly Lazy<IReadOnlyList<OutfittingModule>> UtilityModules = new(
        () => ModuleCatalogueReader.Read("data/ships/modules-utility.jsonc", ModuleCategory.Utility));

    private static readonly Lazy<IReadOnlyList<OutfittingModule>> AllModules = new(Concatenate);

    private static readonly Lazy<IReadOnlyDictionary<string, OutfittingModule>> BySymbol = new(
        () => RegistryIndex.CreateKeyIndex(All, module => module.Symbol));

    /// <summary>
    /// Every core internal module — the eight mounts every hull must fill — in Frontier's
    /// registry order. The armour variants here are the one ship-specific module.
    /// </summary>
    public static IReadOnlyList<OutfittingModule> Core => CoreModules.Value;

    /// <summary>Every optional internal module, in Frontier's registry order.</summary>
    public static IReadOnlyList<OutfittingModule> Internal => InternalModules.Value;

    /// <summary>Every hardpoint weapon and tool, in Frontier's registry order.</summary>
    public static IReadOnlyList<OutfittingModule> Hardpoint => HardpointModules.Value;

    /// <summary>Every utility-mount fitting, in Frontier's registry order.</summary>
    public static IReadOnlyList<OutfittingModule> Utility => UtilityModules.Value;

    /// <summary>
    /// Every outfitting module: core, then internal, then hardpoint, then utility, each in
    /// Frontier's registry order.
    /// </summary>
    public static IReadOnlyList<OutfittingModule> All => AllModules.Value;

    /// <summary>Finds a module by its internal symbol.</summary>
    /// <param name="symbol">
    /// The internal identifier, such as <c>Hpt_PulseLaser_Fixed_Small</c>. Leading and trailing
    /// whitespace and case are ignored, so the journal's lower-cased form resolves too.
    /// </param>
    /// <param name="modules">
    /// The subset to search. Omit it to search every module, which is also the only indexed
    /// path.
    /// </param>
    /// <returns>The module, or <see langword="null"/> when no module has that symbol.</returns>
    public static OutfittingModule? FindBySymbol(
        string? symbol,
        IReadOnlyList<OutfittingModule>? modules = null) =>
        modules is null || ReferenceEquals(modules, All)
            ? RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol)
            : RegistryIndex.FindByKey(modules, module => module.Symbol, symbol);

    /// <summary>Every module with one display name, in catalogue order.</summary>
    /// <remarks>
    /// A display name is shared across sizes, ratings and, for armour, hulls, so this answers a
    /// list. Use the symbol as the key when you want exactly one module.
    /// </remarks>
    /// <param name="name">
    /// The display name as the registry spells it, such as <c>Pulse Laser</c>. Leading and
    /// trailing whitespace and case are ignored; matching is otherwise exact.
    /// </param>
    /// <param name="modules">The subset to search. Omit it to search every module.</param>
    /// <returns>The matches, in catalogue order.</returns>
    public static IReadOnlyList<OutfittingModule> FindByName(
        string? name,
        IReadOnlyList<OutfittingModule>? modules = null) =>
        RegistryIndex.FilterByKey(modules ?? All, module => module.Name, name);

    /// <summary>Every bulkhead a hull can be fitted with, in catalogue order.</summary>
    /// <remarks>
    /// Bulkheads are the only hull-specific module; everything else fits by slot size, so this
    /// does not answer "what else can this hull carry" — that is the hull's slot layout.
    /// </remarks>
    /// <param name="ship">
    /// The hull's display name as the registry spells it, such as <c>Anaconda</c>. Leading and
    /// trailing whitespace and case are ignored; matching is otherwise exact.
    /// </param>
    /// <param name="modules">
    /// The subset to search. Bulkheads live in the core catalogue, so narrowing to any other
    /// category answers an empty list.
    /// </param>
    /// <returns>
    /// The hull's bulkheads — five variants, or six on the Caspian Explorer — or an empty list
    /// when none are carried for that hull.
    /// </returns>
    public static IReadOnlyList<OutfittingModule> BulkheadsForShip(
        string? ship,
        IReadOnlyList<OutfittingModule>? modules = null) =>
        RegistryIndex.FilterByKey(modules ?? All, module => module.Ship, ship);

    /// <summary>Every module in one outfitting category, in registry order.</summary>
    /// <param name="category">The category to list.</param>
    /// <returns>The category's own catalogue.</returns>
    public static IReadOnlyList<OutfittingModule> InCategory(ModuleCategory category) => category switch
    {
        ModuleCategory.Core => Core,
        ModuleCategory.Internal => Internal,
        ModuleCategory.Hardpoint => Hardpoint,
        ModuleCategory.Utility => Utility,
        _ => [],
    };

    private static ReadOnlyCollection<OutfittingModule> Concatenate()
    {
        List<OutfittingModule> all = new(Core.Count + Internal.Count + Hardpoint.Count + Utility.Count);
        all.AddRange(Core);
        all.AddRange(Internal);
        all.AddRange(Hardpoint);
        all.AddRange(Utility);
        return new ReadOnlyCollection<OutfittingModule>(all);
    }
}
