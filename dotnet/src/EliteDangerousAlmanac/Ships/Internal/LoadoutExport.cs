using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>Everything a build resolves before handing itself to the serializer.</summary>
/// <param name="ShipSymbol">The hull symbol.</param>
/// <param name="Modules">The fitted modules, in the build's own order.</param>
/// <param name="Layout">The hull's mounts, in outfitting-panel order.</param>
/// <param name="SourcePurchase">The price record a capture stated, when it stated one.</param>
/// <param name="RetailHullValue">The bare hull's catalogue price, in credits.</param>
/// <param name="UnladenMass">The mass with no fuel and no cargo aboard, in tonnes.</param>
/// <param name="CargoCapacity">The cargo the build can hold, in tonnes.</param>
/// <param name="FuelCapacity">The main tank and the reserve, in tonnes.</param>
/// <param name="MaxJumpRange">
/// The longest single jump, in light-years, or <see langword="null"/> where the build cannot
/// answer one.
/// </param>
/// <param name="StatsFor">The resolved article one fitted module publishes.</param>
internal sealed record LoadoutExportInput(
    string ShipSymbol,
    IReadOnlyList<LoadoutModule> Modules,
    IReadOnlyList<BuildSlot> Layout,
    SourcePurchaseRecord? SourcePurchase,
    double RetailHullValue,
    double UnladenMass,
    double CargoCapacity,
    LoadoutFuelCapacity FuelCapacity,
    double? MaxJumpRange,
    Func<LoadoutModule, OutfittingModule?> StatsFor)
{
    /// <summary>The commander's name for the ship.</summary>
    internal string? ShipName { get; init; }

    /// <summary>The ship's registered identifier.</summary>
    internal string? ShipIdent { get; init; }

    /// <summary>
    /// Whether the import put a priced article aboard that the capture never listed.
    /// </summary>
    /// <remarks>
    /// A core internal the capture named no module for is stocked from the hull defaults. No
    /// comparison against the priced mounts can see an addition, only a swap or a removal, and
    /// filling an empty mount by an edit deliberately leaves the totals standing: the caller
    /// made that change and can see it. This one nobody asked for. A stocked bulkhead and a
    /// stocked cargo hatch are free, and a stocked planetary approach suite costs too little to
    /// void a purchase record over, so neither sets this.
    /// </remarks>
    internal bool SourceTotalsVoided { get; init; }
}

/// <summary>Turns resolved build state into a fresh journal event.</summary>
internal static class LoadoutExport
{
    /// <summary>The insurance rebuy is a flat one twentieth of the retail hull and modules.</summary>
    private const double RebuyFraction = 0.05;

    /// <summary>What a mount's article is worth, when the answer is a price at all.</summary>
    private enum PriceKind
    {
        /// <summary>The article carries a price.</summary>
        Priced,

        /// <summary>The article is free, so it adds nothing to a total.</summary>
        Free,

        /// <summary>Nothing prices the article, so no total covering it can be quoted.</summary>
        Unknown,
    }

    /// <summary>Writes one build as a journal loadout event.</summary>
    /// <param name="input">The resolved build state.</param>
    /// <param name="options">How to shape the export.</param>
    /// <returns>The event.</returns>
    internal static LoadoutEvent Event(LoadoutExportInput input, LoadoutExportOptions options)
    {
        bool fromSource = options.Credits == LoadoutCredits.Source;
        SourcePurchaseRecord? source = fromSource ? input.SourcePurchase : null;
        SourcePurchaseRecord? totals =
            source is not null && !input.SourceTotalsVoided && SourceTotalsHold(input.Modules, source)
                ? source
                : null;

        double? hullValue = fromSource ? source?.HullValue : input.RetailHullValue;
        double? modulesValue = fromSource
            ? totals?.ModulesValue
            : ComputedModulesValue(input.Modules, input.StatsFor);
        double? rebuy = fromSource
            ? totals?.Rebuy
            : hullValue is double hull && modulesValue is double fitted
                ? Math.Truncate((hull + fitted) * RebuyFraction)
                : null;

        return new LoadoutEvent(
            input.ShipSymbol.ToLowerInvariant(),
            ExportModules(input, options, fromSource))
        {
            ShipName = input.ShipName,
            ShipIdent = input.ShipIdent,
            HullValue = hullValue,
            ModulesValue = modulesValue,
            UnladenMass = input.UnladenMass,
            CargoCapacity = input.CargoCapacity,
            MaxJumpRange = input.MaxJumpRange,
            FuelCapacity = input.FuelCapacity,
            Rebuy = rebuy,
        };
    }

    private static List<LoadoutModule> ExportModules(
        LoadoutExportInput input,
        LoadoutExportOptions options,
        bool fromSource)
    {
        List<LoadoutModule> ordered = options.ModuleOrder == LoadoutModuleOrder.Slots
            ? LoadoutState.OrderByLayout(input.Modules, input.Layout, module => module.Slot)
            : [.. input.Modules];

        List<LoadoutModule> exported = new(ordered.Count);
        foreach (LoadoutModule module in ordered)
        {
            bool? on = module.On ?? (options.ExplicitPower ? true : null);
            int? priority = module.Priority ?? (options.ExplicitPower ? 0 : null);
            (PriceKind kind, double value) = fromSource
                ? SourceModuleValue(module, input.SourcePurchase)
                : ModuleValue(module, input.StatsFor);

            exported.Add(new LoadoutModule(module.Slot, module.Item.ToLowerInvariant())
            {
                On = on,
                Priority = priority,
                Health = module.Health,
                Value = kind == PriceKind.Priced ? value : null,
                Engineering = module.Engineering,
            });
        }

        return exported;
    }

    /// <summary>The catalogue price of every fitted module, where each one carries one.</summary>
    private static double? ComputedModulesValue(
        IReadOnlyList<LoadoutModule> modules,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        double sum = 0;
        foreach (LoadoutModule module in modules)
        {
            (PriceKind kind, double value) = ModuleValue(module, statsFor);
            if (kind == PriceKind.Unknown) return null;
            if (kind == PriceKind.Priced) sum += value;
        }

        return sum;
    }

    private static (PriceKind Kind, double Value) ModuleValue(
        LoadoutModule module,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        OutfittingModule? stats = statsFor(module);
        if (stats is not null)
        {
            return stats.Cost is long cost ? (PriceKind.Priced, cost) : (PriceKind.Unknown, 0);
        }

        return LoadoutState.IsNonOutfittingSlot(module.Slot)
            || LoadoutState.IsBuiltInHullModule(module)
                ? (PriceKind.Free, 0)
                : (PriceKind.Unknown, 0);
    }

    /// <summary>What the capture paid for the article this mount still holds.</summary>
    private static (PriceKind Kind, double Value) SourceModuleValue(
        LoadoutModule module,
        SourcePurchaseRecord? source)
    {
        SourceModuleValue? entry =
            source is null ? null : SourcePurchase.FindModuleValue(source, module.Slot);
        if (entry is null) return (PriceKind.Unknown, 0);

        return RegistryIndex.KeyComparer.Equals(entry.Item.Trim(), module.Item.Trim())
            ? (PriceKind.Priced, entry.Value)
            : (PriceKind.Unknown, 0);
    }

    /// <summary>
    /// Whether every priced mount still holds the article the capture paid for, which is what
    /// keeps the capture's own totals true of this build.
    /// </summary>
    private static bool SourceTotalsHold(
        IReadOnlyList<LoadoutModule> modules,
        SourcePurchaseRecord source)
    {
        foreach (SourceModuleValue entry in source.ModuleValues)
        {
            string? key = LoadoutState.MatchingKey(modules, entry.Slot);
            LoadoutModule? fitted = key is null ? null : Held(modules, key);
            if (fitted is null) return false;
            if (LoadoutState.IsCargoHatchSlot(entry.Slot) && entry.Value == 0) continue;
            if (!RegistryIndex.KeyComparer.Equals(fitted.Item.Trim(), entry.Item.Trim()))
            {
                return false;
            }
        }

        return true;
    }

    private static LoadoutModule? Held(IReadOnlyList<LoadoutModule> modules, string slot)
    {
        foreach (LoadoutModule module in modules)
        {
            if (string.Equals(module.Slot, slot, StringComparison.Ordinal)) return module;
        }

        return null;
    }
}
