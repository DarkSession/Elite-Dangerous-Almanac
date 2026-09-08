using System;
using System.Collections.Generic;
using System.Globalization;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <content>The edits a build accepts.</content>
public sealed partial class ShipLoadout
{
    /// <summary>The stats every build sums, which a supplied record may not drop.</summary>
    private static readonly ModuleStat[] AggregateStats =
    [
        ModuleStat.Mass, ModuleStat.CargoCapacity, ModuleStat.CabinCapacity, ModuleStat.FuelCapacity,
    ];

    /// <summary>Refits one mount an operational build keeps filled, from the hull's stock.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>The outcome. A refusal leaves the build unchanged.</returns>
    /// <remarks>
    /// This is the repair path for the mounts an ordinary edit does not expose, which in practice
    /// is the built-in cargo hatch. The stock article keeps the mount's enabled flag, its power
    /// band and its health, and none of the replaced module's engineering or captured price, as
    /// an import does. Every entry point already fills these mounts, so a build this library
    /// produced answers that nothing changed.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The hull has no mount with that key.</exception>
    public FixedMountRepair RepairFixedMount(string slotKey)
    {
        BuildSlot slot = RequireSlot(slotKey);
        string? held = FittedKey(slotKey);
        string named = held ?? slotKey;

        if (LoadoutSlotRules.FixedReason(slot.Kind) is null)
        {
            return new FixedMountRepair(FixedMountRepairStatus.Refused, named);
        }

        LoadoutModule? current = FittedModuleFor(slotKey);
        OutfittingModule? currentStats = StatsFor(current);
        bool valid = current is not null
            && currentStats is not null
            && (slot.Kind == SlotKind.CargoHatch
                ? LoadoutState.IsBuiltInHullModule(current)
                : LoadoutFitting.Problem(ShipSymbol, slot, currentStats) is null);
        if (valid)
        {
            return new FixedMountRepair(
                FixedMountRepairStatus.Unchanged, current!.Slot, current.Item);
        }

        DefaultLoadoutModule? stock = null;
        foreach (DefaultLoadoutModule candidate in DefaultLoadouts.Find(ShipSymbol)?.Modules ?? [])
        {
            if (RegistryIndex.KeyComparer.Equals(candidate.Slot.Trim(), slotKey.Trim()))
            {
                stock = candidate;
                break;
            }
        }

        if (stock is null)
        {
            return new FixedMountRepair(FixedMountRepairStatus.DefaultUnavailable, named);
        }

        string ownKey = LoadoutState.OwnKey(modules, slot.Key);
        LoadoutModule replacement = new(ownKey, stock.Symbol)
        {
            On = current?.On,
            Priority = current?.Priority,
            Health = current?.Health,
        };

        OutfittingModule? replacementStats = ModuleCatalogue.FindBySymbol(stock.Symbol)
            ?? (LoadoutState.IsBuiltInHullModule(replacement)
                ? ModuleCatalogue.FindBySymbol(LoadoutState.BuiltInHullSymbol)
                : null);
        if (replacementStats is null)
        {
            return new FixedMountRepair(
                FixedMountRepairStatus.DefaultUnavailable, named, stock.Symbol);
        }

        ReplaceModule(ownKey, replacement, replacementStats);
        return new FixedMountRepair(FixedMountRepairStatus.Repaired, ownKey, stock.Symbol);
    }

    /// <summary>Fits a module into a mount, replacing whatever it holds.</summary>
    /// <param name="slotKey">
    /// The mount key. Case and surrounding whitespace are ignored. An occupied mount keeps the
    /// key the build already spells it with, so fitting into an import never renames a mount.
    /// </param>
    /// <param name="module">
    /// The module to fit. The complete record is kept, so a resolved fixed article or a record a
    /// caller adjusted keeps its stats. It must name an article the catalogue carries, and it
    /// may not drop a stat every build sums, nor state one as anything but a finite number.
    /// </param>
    /// <returns>This build, so edits chain.</returns>
    /// <remarks>
    /// <para>
    /// This is an incremental editor: every call must avoid worsening the build's current
    /// module-count excess, so fit an allowance-increasing module before the weapons it permits.
    /// Read a complete capture with <see cref="FromLoadout"/> instead, where order does not
    /// matter.
    /// </para>
    /// <para>
    /// Fitting is a fresh mount, so the enabled flag, the power band and the health are reset.
    /// Set them again where a screen keeps a power band across a swap.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException">An argument is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The hull has no mount with that key.</exception>
    /// <exception cref="ArgumentException">
    /// The catalogue carries no such article, or the record drops or misstates a stat every
    /// build sums.
    /// </exception>
    /// <exception cref="LoadoutEditException">
    /// The module does not fit the mount, conflicts with a one-per-ship family already fitted
    /// elsewhere, or worsens a per-ship module-count excess.
    /// </exception>
    public ShipLoadout SetModule(string slotKey, OutfittingModule module)
    {
        BuildSlot slot = RequireSlot(slotKey);
        if (module is null) throw new ArgumentNullException(nameof(module));

        // The record may state engineered figures, but the article has to be one the catalogue
        // knows and has to keep every figure a build sums. Absent is not zero: a record without
        // its mass would understate the ship rather than fail, and nobody would question it.
        OutfittingModule catalogued = ModuleCatalogue.FindBySymbol(module.Symbol)
            ?? throw new ArgumentException(
                string.Format(
                    CultureInfo.InvariantCulture,
                    "The catalogue carries no module \"{0}\".",
                    TextPreview.Truncate(module.Symbol)),
                nameof(module));

        foreach (ModuleStat stat in AggregateStats)
        {
            double? stated = module.Stats[stat];
            if (stated is null)
            {
                if (catalogued.Stats[stat] is null) continue;
                throw new ArgumentException(
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "The supplied record for \"{0}\" states no {1}.",
                        TextPreview.Truncate(module.Symbol),
                        stat),
                    nameof(module));
            }

            // A figure that is not a number would be summed as one.
            if (double.IsNaN(stated.Value) || double.IsInfinity(stated.Value))
            {
                throw new ArgumentException(
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "The supplied record for \"{0}\" states a {1} that is not a number.",
                        TextPreview.Truncate(module.Symbol),
                        stat),
                    nameof(module));
            }
        }

        RefuseUnfittableModule(slotKey, slot, module);
        RefuseDuplicateExclusiveModule(slotKey, slot, module);
        RefuseModuleLimitExcess(slotKey, slot, module);

        // Replacing keeps the key the build already uses; a fresh fit takes the layout's own
        // spelling rather than whatever casing the caller typed.
        string key = FittedKey(slotKey) ?? slot.Key;
        ReplaceModule(key, new LoadoutModule(key, module.Symbol), module);
        return this;
    }

    private void RefuseUnfittableModule(string slotKey, BuildSlot slot, OutfittingModule module)
    {
        if (LoadoutFitting.Problem(ShipSymbol, slot, module) is not ModuleFitProblem problem) return;

        string message = string.Format(
            CultureInfo.InvariantCulture,
            "{0} into {1}: {2}",
            TextPreview.Truncate(module.Symbol),
            TextPreview.Truncate(slotKey),
            problem.Message);
        bool immutable = problem.Constraint == ModuleFitConstraint.ImmutableSlot;

        throw new LoadoutEditException(
            message,
            immutable ? LoadoutEditErrorCode.ImmutableSlot : LoadoutEditErrorCode.IncompatibleModule,
            new LoadoutIssue(
                LoadoutIssueCode.IncompatibleModule, LoadoutIssueSeverity.Error, message)
            {
                Slot = slot.Key,
                Symbol = module.Symbol,
                Fit = problem,
            });
    }

    private void RefuseDuplicateExclusiveModule(
        string slotKey,
        BuildSlot slot,
        OutfittingModule module)
    {
        if (module.ExclusionGroup is not ModuleExclusionGroup group) return;

        foreach (LoadoutModule fitted in modules)
        {
            if (RegistryIndex.KeyComparer.Equals(fitted.Slot.Trim(), slot.Key.Trim())) continue;
            if (StatsFor(fitted)?.ExclusionGroup != group) continue;

            string message = string.Format(
                CultureInfo.InvariantCulture,
                "{0} into {1}: a ship carries one {2}, and {3} already holds one.",
                TextPreview.Truncate(module.Symbol),
                TextPreview.Truncate(slotKey),
                group,
                TextPreview.Truncate(fitted.Slot));

            throw new LoadoutEditException(
                message,
                LoadoutEditErrorCode.DuplicateExclusiveModule,
                new LoadoutIssue(
                    LoadoutIssueCode.DuplicateExclusiveModule,
                    LoadoutIssueSeverity.Error,
                    message)
                {
                    Slot = slot.Key,
                    Symbol = module.Symbol,
                    ExclusionGroup = group,
                    PreviousSlot = fitted.Slot,
                    PreviousSymbol = fitted.Item,
                });
        }
    }

    private void RefuseModuleLimitExcess(string slotKey, BuildSlot slot, OutfittingModule module)
    {
        if (ModuleLimitRegression(slot.Key, module) is not ModuleLimitUsage excess) return;

        string message = string.Format(
            CultureInfo.InvariantCulture,
            "{0} into {1}: the build would carry {2} of the {3} family, and the ship allows {4}.",
            TextPreview.Truncate(module.Symbol),
            TextPreview.Truncate(slotKey),
            excess.Count,
            excess.Group,
            excess.Limit);

        throw new LoadoutEditException(
            message,
            LoadoutEditErrorCode.ModuleLimitExceeded,
            new LoadoutIssue(
                LoadoutIssueCode.ModuleLimitExceeded, LoadoutIssueSeverity.Error, message)
            {
                Slot = slot.Key,
                Symbol = module.Symbol,
                LimitGroup = excess.Group,
                Count = excess.Count,
                Limit = excess.Limit,
            });
    }

    /// <summary>Empties a mount.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>This build, so edits chain. Clearing an already-empty mount changes nothing.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    /// <exception cref="LoadoutEditException">
    /// The mount is the cargo hatch, or armour or a core internal an operational build keeps
    /// filled, or emptying it would worsen a per-ship module-count excess. A required mount takes
    /// a replacement but cannot be emptied.
    /// </exception>
    public ShipLoadout RemoveModule(string slotKey)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        string wanted = slotKey.Trim();
        if (LoadoutState.IsCargoHatchSlot(wanted))
        {
            throw new LoadoutEditException(
                "The cargo hatch is part of the hull, and no edit empties it.",
                LoadoutEditErrorCode.ImmutableSlot,
                slot: FittedKey(slotKey) ?? wanted);
        }

        BuildSlot? slot = null;
        foreach (BuildSlot candidate in Layout())
        {
            if (RegistryIndex.KeyComparer.Equals(candidate.Key.Trim(), wanted))
            {
                slot = candidate;
                break;
            }
        }

        ParsedSlot? parsed = BuildSlots.ParseName(slotKey);
        if (parsed is not null
            && LoadoutSlotRules.FixedReason(parsed.Kind) == ImmovableReason.RequiredSlot)
        {
            string key = slot?.Key ?? FittedKey(slotKey) ?? slotKey;
            string message = string.Format(
                CultureInfo.InvariantCulture,
                "An operational build keeps the {0} mount filled, so no edit empties it.",
                TextPreview.Truncate(key));

            throw new LoadoutEditException(
                message,
                LoadoutEditErrorCode.RequiredSlot,
                new LoadoutIssue(
                    LoadoutIssueCode.MissingRequiredSlot, LoadoutIssueSeverity.Error, message)
                {
                    Slot = key,
                });
        }

        string? held = FittedKey(slotKey);
        if (held is null) return this;

        if (ModuleLimitRegression(held, null) is ModuleLimitUsage excess)
        {
            LoadoutModule? fitted = FittedModuleFor(held);
            string message = string.Format(
                CultureInfo.InvariantCulture,
                "{0}: the build would carry {1} of the {2} family, and the ship allows {3}.",
                TextPreview.Truncate(slotKey),
                excess.Count,
                excess.Group,
                excess.Limit);

            throw new LoadoutEditException(
                message,
                LoadoutEditErrorCode.ModuleLimitExceeded,
                new LoadoutIssue(
                    LoadoutIssueCode.ModuleLimitExceeded, LoadoutIssueSeverity.Error, message)
                {
                    Slot = held,
                    Symbol = fitted?.Item,
                    LimitGroup = excess.Group,
                    Count = excess.Count,
                    Limit = excess.Limit,
                });
        }

        ReplaceModule(held, null);
        return this;
    }

    /// <summary>Switches one fitted module on or off.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <param name="on">Whether the module runs.</param>
    /// <returns>This build, so edits chain. An empty mount changes nothing.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    public ShipLoadout SetModuleEnabled(string slotKey, bool on)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        int index = LoadoutState.IndexOf(modules, slotKey.Trim());
        if (index >= 0)
        {
            modules[index] = modules[index] with { On = on };
            slotCache.Clear();
        }

        return this;
    }

    /// <summary>Sets one fitted module's power band.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <param name="priority">
    /// The band the journal writes, counted from zero. The outfitting panel numbers the same five
    /// groups from one.
    /// </param>
    /// <returns>This build, so edits chain. An empty mount changes nothing.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The band is not one of the five groups.</exception>
    public ShipLoadout SetModulePriority(string slotKey, int priority)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));
        if (priority < 0 || priority > 4)
        {
            throw new ArgumentOutOfRangeException(
                nameof(priority), priority, "A power band is an integer from 0 to 4.");
        }

        int index = LoadoutState.IndexOf(modules, slotKey.Trim());
        if (index >= 0)
        {
            modules[index] = modules[index] with { Priority = priority };
            slotCache.Clear();
        }

        return this;
    }

    /// <summary>Replaces one fitted module, keeping the captured figures coherent.</summary>
    private void ReplaceModule(
        string slotKey,
        LoadoutModule? replacement,
        OutfittingModule? replacementStats = null,
        IReadOnlyList<EngineeringModifier>? primitives = null)
    {
        int index = LoadoutState.IndexOf(modules, slotKey);
        LoadoutModule? previous = index < 0 ? null : modules[index];
        AdjustImportedFigures(previous, replacement, replacementStats);

        if (replacement is null)
        {
            if (index >= 0) modules.RemoveAt(index);
            moduleStats.Remove(slotKey);
            primitiveModifiers.Remove(slotKey);
        }
        else
        {
            if (index >= 0) modules[index] = replacement;
            else modules.Add(replacement);

            if (replacementStats is not null) moduleStats[slotKey] = replacementStats;
            if (primitives is null) primitiveModifiers.Remove(slotKey);
            else primitiveModifiers[slotKey] = primitives;
        }

        slotCache.Clear();
    }

    /// <summary>Adjusts the captured figures by the changed module's contribution.</summary>
    private void AdjustImportedFigures(
        LoadoutModule? previous,
        LoadoutModule? next,
        OutfittingModule? nextStats)
    {
        if (top.UnladenMass is double mass)
        {
            top.UnladenMass = mass + ModuleMass(next, nextStats) - ModuleMass(previous);
        }

        if (top.CargoCapacity is double cargo)
        {
            top.CargoCapacity = cargo
                + ModuleCapacity(next, ModuleStat.CargoCapacity, nextStats)
                - ModuleCapacity(previous, ModuleStat.CargoCapacity);
        }

        if (top.FuelCapacity is LoadoutFuelCapacity tanks)
        {
            top.FuelCapacity = tanks with
            {
                Main = tanks.Main
                    + ModuleCapacity(next, ModuleStat.FuelCapacity, nextStats)
                    - ModuleCapacity(previous, ModuleStat.FuelCapacity),
            };
        }

        // Refitting the same article does not change its purchase price, even where the supplied
        // stats replace or remove its engineering.
        if (RegistryIndex.KeyComparer.Equals(previous?.Item?.Trim(), next?.Item?.Trim())) return;

        // A cargo hatch is part of the hull and has no purchase price, so normalizing its
        // captured identity changes neither credit figure.
        if ((previous is not null && LoadoutState.IsCargoHatchSlot(previous.Slot))
            || (next is not null && LoadoutState.IsCargoHatchSlot(next.Slot)))
        {
            return;
        }

        // No catalogue records what a module was bought for after the purchase.
        top.ModulesValue = null;
        top.Rebuy = null;
    }
}
