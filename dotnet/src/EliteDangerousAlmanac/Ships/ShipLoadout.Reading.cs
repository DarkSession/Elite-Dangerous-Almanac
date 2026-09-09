using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <content>What a build answers about itself.</content>
public sealed partial class ShipLoadout
{
    /// <summary>The cache key a read of every mount, rather than of one kind, answers to.</summary>
    private const int EveryKind = -1;

    /// <summary>The commander's name for the ship, where the build carries one.</summary>
    public string? ShipName => top.ShipName;

    /// <summary>The ship's registered identifier, where the build carries one.</summary>
    public string? ShipIdent => top.ShipIdent;

    /// <summary>The hull and modules mass with an empty tank and no cargo, in tonnes.</summary>
    /// <remarks>
    /// A capture's own figure stands while the fit it described survives an import.
    /// Otherwise this is the hull's mass plus every fitted module's post-engineering mass, and
    /// <see cref="ImportOutcomes"/> is the only report that the figure is the normalized fit's
    /// rather than the capture's.
    /// </remarks>
    public double UnladenMass => top.UnladenMass ?? ComputedUnladenMass();

    /// <summary>The main tank and the hull's reserve, in tonnes.</summary>
    /// <remarks>A capture's own figures stand on the same terms as the unladen mass.</remarks>
    public LoadoutFuelCapacity FuelCapacity
    {
        get
        {
            if (top.FuelCapacity is LoadoutFuelCapacity stated) return stated;
            return LoadoutCalculations.FuelCapacity(
                ship.ReserveFuelCapacity, CalculationModules());
        }
    }

    /// <summary>The cargo the build can hold, in tonnes.</summary>
    /// <remarks>A capture's own figure stands on the same terms as the unladen mass.</remarks>
    public double CargoCapacity =>
        top.CargoCapacity ?? LoadoutCalculations.CargoCapacity(CalculationModules());

    /// <summary>The berths the fitted cabins carry.</summary>
    /// <remarks>
    /// This is always computed from the fit, unlike the cargo and the fuel: a journal states no
    /// passenger figure to prefer, so an imported build reports the cabins it lists. A berth is
    /// a seat rather than an occupant, and a passenger is massless, so filling one changes
    /// nothing a metric calculates.
    /// </remarks>
    public double PassengerCapacity =>
        LoadoutCalculations.PassengerCapacity(CalculationModules());

    /// <summary>The hull price the build represents, in credits.</summary>
    /// <remarks>
    /// This is the live figure, kept coherent with an edit. Read <see cref="SourcePurchase"/>
    /// for the capture's figure as captured, which no edit changes.
    /// </remarks>
    public double? HullValue => top.HullValue;

    /// <summary>The fitted modules' price the build represents, in credits.</summary>
    /// <remarks>
    /// It is absent after an edit or an import normalization discarded the capture's figure,
    /// because no catalogue records what a replaced module was bought for. Unlike the mass and
    /// the capacity it is not recomputed from what remains.
    /// </remarks>
    public double? ModulesValue => top.ModulesValue;

    /// <summary>The insurance rebuy the build represents, in credits.</summary>
    /// <remarks>An edit discards it for the same reason it discards the modules price.</remarks>
    public double? Rebuy => top.Rebuy;

    /// <summary>What an import made of this build.</summary>
    /// <remarks>
    /// The changes come in source order, then the mounts stocked from the hull defaults because
    /// the source named none, in the defaults' own order, then what the import made of each
    /// module's stated engineering. It is empty for a build assembled here, and for an import
    /// that needed no normalization and read every stated recipe unambiguously.
    /// </remarks>
    public IReadOnlyList<LoadoutImportOutcome> ImportOutcomes =>
        new ReadOnlyCollection<LoadoutImportOutcome>(importOutcomes);

    /// <summary>The structural validity and the operational completeness of this build.</summary>
    /// <returns>The report, recomputed from the current fit on every call.</returns>
    /// <remarks>
    /// <para>
    /// Validity asks whether the fit is legal. Completeness asks that and whether armour and the
    /// seven core mounts are filled. Neither question reports an import normalization, so read
    /// <see cref="ImportOutcomes"/> beside them.
    /// </para>
    /// <para>
    /// The thruster rule weighs the fitted thrusters' post-engineering maximum mass against what
    /// the ship comes to at each load it can reach without being refitted. A ship that cannot
    /// move on a full tank is an error; one that only fails with the hold full is a warning, and
    /// leaves the build valid and complete.
    /// </para>
    /// <para>
    /// A capture may state a mass nobody can weigh. That is not refused here: this method
    /// reports a build rather than rejecting one, so an unweighable figure is left out and the
    /// rule it feeds does not run. The figure is still reported, as a thrown one, by whichever
    /// metric reads it.
    /// </para>
    /// </remarks>
    public LoadoutValidation Validation()
    {
        IReadOnlyList<BuildSlot> layout = Layout();
        Dictionary<string, BuildSlot> byKey = new(layout.Count, RegistryIndex.KeyComparer);
        foreach (BuildSlot slot in layout) byKey[slot.Key.Trim()] = slot;

        List<ValidationModule> stated = new(modules.Count);
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = StatsFor(module);
            byKey.TryGetValue(module.Slot.Trim(), out BuildSlot? mount);
            bool builtIn = (stats is null && LoadoutState.IsNonOutfittingSlot(module.Slot))
                || LoadoutState.IsBuiltInHullModule(module);

            ModuleFitProblem? fit = stats is not null && mount is not null && !builtIn
                ? LoadoutFitting.Problem(ShipSymbol, mount, stats)
                : null;

            // A shield generator carries a maximum mass of its own, so the rating is read only
            // off the article the mount says is the thrusters.
            double? thrusterMaxMass = stats?.Slot == ModuleSlot.Thrusters
                ? Weighable(LoadoutMetrics
                    .Effective(ModuleForEffectiveStats(module), stats)?.Stats[ModuleStat.MaxMass])
                : null;

            stated.Add(new ValidationModule(module.Slot, module.Item)
            {
                RequiresKnownSlot = !builtIn,
                Fit = fit,
                ExclusionGroup = stats?.ExclusionGroup,
                LimitGroup = stats?.LimitGroup,
                LimitIncrease = stats?.LimitIncrease,
                ThrusterMaxMass = thrusterMaxMass,
            });
        }

        double? dry = Weighable(UnladenMass);
        double? fuel = Weighable(FuelCapacity.Main);
        double? cargo = Weighable(CargoCapacity);
        LoadoutMass? mass = dry is double weighed
            ? new LoadoutMass(weighed)
            {
                Fuel = fuel,
                Cargo = fuel is null ? null : cargo,
            }
            : null;

        return LoadoutValidator.Validate(
            new LoadoutValidationInput(ShipSymbol, layout, stated) { Mass = mass });
    }

    /// <summary>The hull's mounts in outfitting-panel order.</summary>
    /// <param name="kind">One mount kind to keep, or nothing for every mount.</param>
    /// <returns>
    /// The mounts, each with the module it holds. Repeated reads for the same kind answer the
    /// same views until an edit changes the build.
    /// </returns>
    public IReadOnlyList<LoadoutSlot> Slots(SlotKind? kind = null)
    {
        // A dictionary takes no absent key, so the read of every mount has a key of its own.
        int cacheKey = kind is SlotKind requested ? (int)requested : EveryKind;
        if (slotCache.TryGetValue(cacheKey, out IReadOnlyList<LoadoutSlot>? cached)) return cached;

        IReadOnlyList<ModuleLimitUsage> currentLimits = CurrentModuleLimits();
        List<LoadoutSlot> views = [];
        foreach (BuildSlot slot in Layout())
        {
            if (kind is SlotKind wanted && slot.Kind != wanted) continue;

            OutfittingModule? stats = ModuleStatsAt(slot.Key);
            ImmovableReason? fixedReason = LoadoutSlotRules.FixedReason(slot.Kind);
            ImmovableReason? immovable = fixedReason
                ?? (stats?.LimitIncrease is not null
                    && ModuleLimitRegression(slot.Key, null, currentLimits, stats) is not null
                        ? ImmovableReason.ModuleLimit
                        : null);

            views.Add(new LoadoutSlot(
                slot,
                LoadoutSlotNames.For(slot),
                FittedModuleAt(slot.Key),
                immovable is null,
                immovable));
        }

        IReadOnlyList<LoadoutSlot> value = new ReadOnlyCollection<LoadoutSlot>(views);
        slotCache[cacheKey] = value;
        return value;
    }

    /// <summary>The module one mount holds.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>The module, or <see langword="null"/> where the mount is empty or unknown.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    public FittedModule? FittedModuleAt(string slotKey)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        LoadoutModule? module = FittedModuleFor(slotKey);
        if (module is null) return null;

        OutfittingModule? stats = StatsFor(module);
        OutfittingModule? effective =
            LoadoutMetrics.Effective(ModuleForEffectiveStats(module), stats);

        return new FittedModule(module.Slot, module.Item, module)
        {
            On = module.On,
            Priority = module.Priority,
            Health = module.Health,
            Value = module.Value,
            Engineering = module.Engineering,
            Stats = stats,
            EffectiveStats = effective,
            Ammunition = effective is null ? null : Ammunition.Capacity(effective),
            PreEngineeredVariant = LoadoutImport.PreEngineeredVariantFor(module),
        };
    }

    /// <summary>Every fitted module, in the order the build carries them.</summary>
    /// <returns>The modules.</returns>
    public IReadOnlyList<FittedModule> FittedModules()
    {
        List<FittedModule> fitted = new(modules.Count);
        foreach (LoadoutModule module in modules)
        {
            if (FittedModuleAt(module.Slot) is FittedModule view) fitted.Add(view);
        }

        return new ReadOnlyCollection<FittedModule>(fitted);
    }

    /// <summary>The blueprints one fitted module accepts whose modifiers can be computed.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>
    /// The ordinary engineering menu first, then any bespoke Mercenary recipe. It is empty where
    /// the mount is empty, unresolved or final, or the module has neither route.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    public IReadOnlyList<AvailableBlueprint> AvailableBlueprints(string slotKey)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        LoadoutModule? module = FittedModuleFor(slotKey);
        return new ReadOnlyCollection<AvailableBlueprint>(module is null
            ? []
            : LoadoutEngineering.AvailableBlueprintsFor(module.Item, StatsFor(module)));
    }

    /// <summary>The experimental effects one fitted module offers.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>
    /// The effect symbols in engineering-menu order. It is empty where the mount is empty,
    /// unresolved or final, or the module has no experimental menu.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    public IReadOnlyList<string> AvailableExperimentalEffects(string slotKey)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        LoadoutModule? module = FittedModuleFor(slotKey);
        return new ReadOnlyCollection<string>(module is null
            ? []
            : LoadoutEngineering.AvailableExperimentalsFor(module.Item, StatsFor(module)));
    }

    /// <summary>The modules one mount takes.</summary>
    /// <param name="slotKey">The mount key. Case and surrounding whitespace are ignored.</param>
    /// <returns>The fitting modules, in catalogue order.</returns>
    /// <remarks>
    /// This is the outfitting offer, so an article the game does not sell separately is never in
    /// it: each is a second identity for a module the game already sells, and listing both puts
    /// the same article on the screen twice. A build that already carries one keeps it; only the
    /// choices are filtered. A candidate that would worsen a one-per-ship or a module-count
    /// allowance is left out too.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="slotKey"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The hull has no mount with that key.</exception>
    public IReadOnlyList<OutfittingModule> ModulesForSlot(string slotKey)
    {
        BuildSlot slot = RequireSlot(slotKey);

        HashSet<ModuleExclusionGroup> occupied = [];
        foreach (LoadoutModule fitted in modules)
        {
            if (RegistryIndex.KeyComparer.Equals(fitted.Slot.Trim(), slot.Key.Trim())) continue;
            if (StatsFor(fitted)?.ExclusionGroup is ModuleExclusionGroup group) occupied.Add(group);
        }

        IReadOnlyList<ModuleLimitUsage> currentLimits = CurrentModuleLimits();
        OutfittingModule? currentStats = ModuleStatsAt(slot.Key);

        List<OutfittingModule> offered = [];
        foreach (OutfittingModule module in ModuleCatalogue.All)
        {
            if (module.GrantOnly) continue;
            if (LoadoutFitting.Problem(ShipSymbol, slot, module) is not null) continue;
            if (module.ExclusionGroup is ModuleExclusionGroup group && occupied.Contains(group)) continue;
            if (ModuleLimitRegression(slot.Key, module, currentLimits, currentStats) is not null) continue;

            offered.Add(module);
        }

        return new ReadOnlyCollection<OutfittingModule>(offered);
    }

    private double ComputedUnladenMass() =>
        LoadoutCalculations.UnladenMass(ship.HullMass, CalculationModules());

    /// <summary>The hull's mounts, expanded on first use.</summary>
    internal IReadOnlyList<BuildSlot> Layout() =>
        layoutCache ??= BuildSlots.Enumerate(ship.Slots());

    private BuildSlot RequireSlot(string slotKey)
    {
        if (slotKey is null) throw new ArgumentNullException(nameof(slotKey));

        foreach (BuildSlot slot in Layout())
        {
            if (RegistryIndex.KeyComparer.Equals(slot.Key.Trim(), slotKey.Trim())) return slot;
        }

        throw new ArgumentOutOfRangeException(
            nameof(slotKey),
            slotKey,
            string.Format(
                CultureInfo.InvariantCulture,
                "The hull \"{0}\" has no mount \"{1}\".",
                TextPreview.Truncate(ShipSymbol),
                TextPreview.Truncate(slotKey)));
    }

    /// <summary>The key this build holds a mount under, or nothing where it holds none.</summary>
    private string? FittedKey(string slotKey) => LoadoutState.MatchingKey(modules, slotKey.Trim());

    /// <summary>The module one mount holds.</summary>
    private LoadoutModule? FittedModuleFor(string slotKey)
    {
        int index = LoadoutState.IndexOf(modules, slotKey.Trim());
        return index < 0 ? null : modules[index];
    }

    /// <summary>The fitted modules as the aggregate calculations take them.</summary>
    internal IReadOnlyList<LoadoutCalculationModule> CalculationModules()
    {
        List<LoadoutCalculationModule> resolved = new(modules.Count);
        foreach (LoadoutModule module in modules)
        {
            resolved.Add(new LoadoutCalculationModule(ModuleMass(module))
            {
                CargoCapacity = ModuleCapacity(module, ModuleStat.CargoCapacity),
                CabinCapacity = ModuleCapacity(module, ModuleStat.CabinCapacity),
                FuelCapacity = ModuleCapacity(module, ModuleStat.FuelCapacity),
            });
        }

        return resolved;
    }

    /// <summary>The current fit's per-ship module-count usage.</summary>
    private IReadOnlyList<ModuleLimitUsage> CurrentModuleLimits()
    {
        List<ModuleLimitEntry> entries = [];
        foreach (LoadoutModule module in modules)
        {
            if (StatsFor(module) is OutfittingModule stats)
            {
                entries.Add(ModuleLimitEntry.FromModule(stats));
            }
        }

        return ModuleLimits.Calculate(entries);
    }

    /// <summary>The catalogue stats one mount currently holds.</summary>
    private OutfittingModule? ModuleStatsAt(string slotKey) => StatsFor(FittedModuleFor(slotKey));

    /// <summary>The build's fitted state with the recipe-only modifiers restored.</summary>
    internal LoadoutModule ModuleForEffectiveStats(LoadoutModule module)
    {
        if (module.Engineering is not ModuleEngineering engineering) return module;
        if (!primitiveModifiers.TryGetValue(
            module.Slot, out IReadOnlyList<EngineeringModifier>? restored))
        {
            return module;
        }

        return module with { Engineering = engineering with { Modifiers = restored } };
    }

    /// <summary>Every fitted module in its effective-calculation form.</summary>
    internal IReadOnlyList<LoadoutModule> ModulesForEffectiveStats()
    {
        List<LoadoutModule> resolved = new(modules.Count);
        foreach (LoadoutModule module in modules) resolved.Add(ModuleForEffectiveStats(module));
        return resolved;
    }

    /// <summary>The fitted modules, in the order the build carries them.</summary>
    internal IReadOnlyList<LoadoutModule> Modules =>
        new ReadOnlyCollection<LoadoutModule>(modules);

    /// <summary>The hull this build is fitted on.</summary>
    internal Ship Hull => ship;

    /// <summary>The main tank a capture stated, where it stated one.</summary>
    internal double? StatedMainFuel => top.FuelCapacity?.Main;

    /// <summary>An edit's newly increased allowance excess, or nothing where it worsens none.</summary>
    private ModuleLimitUsage? ModuleLimitRegression(
        string slotKey,
        OutfittingModule? replacement,
        IReadOnlyList<ModuleLimitUsage>? current = null,
        OutfittingModule? previous = null)
    {
        current ??= CurrentModuleLimits();
        previous ??= ModuleStatsAt(slotKey);

        if (previous?.LimitGroup is null
            && previous?.LimitIncrease is null
            && replacement?.LimitGroup is null
            && replacement?.LimitIncrease is null)
        {
            return null;
        }

        foreach (ModuleLimitUsage usage in current)
        {
            int count = usage.Count
                - (previous?.LimitGroup == usage.Group ? 1 : 0)
                + (replacement?.LimitGroup == usage.Group ? 1 : 0);
            int increase = usage.Increase
                - (previous?.LimitIncrease?.Group == usage.Group ? previous.LimitIncrease.Amount : 0)
                + (replacement?.LimitIncrease?.Group == usage.Group
                    ? replacement.LimitIncrease.Amount
                    : 0);
            int limit = usage.BaseLimit + increase;
            int excess = Math.Max(0, count - limit);
            if (excess > usage.Excess)
            {
                return usage with
                {
                    Increase = increase,
                    Limit = limit,
                    Count = count,
                    Excess = excess,
                };
            }
        }

        return null;
    }

    /// <summary>A module's post-engineering mass.</summary>
    /// <remarks>
    /// The cargo-hatch mount is always massless, and so is the cockpit or the approach suite a
    /// capture names in a mount no outfitting screen shows. Every other fitted article resolves,
    /// so its engineering modifier or its record states the mass.
    /// </remarks>
    private double ModuleMass(LoadoutModule? module, OutfittingModule? statsOverride = null)
    {
        if (module is null) return 0;
        if (LoadoutState.IsCargoHatchSlot(module.Slot)) return 0;
        if (Slef.FindModifier(module, "Mass") is double modified) return modified;
        return (statsOverride ?? StatsFor(module))?.Stats[ModuleStat.Mass] ?? 0;
    }

    /// <summary>A fitted module's post-engineering cargo, cabin or fuel capacity.</summary>
    private double ModuleCapacity(
        LoadoutModule? module,
        ModuleStat stat,
        OutfittingModule? statsOverride = null)
    {
        if (module is null) return 0;
        if (LoadoutState.IsCargoHatchSlot(module.Slot)) return 0;

        foreach (string label in ModuleStatLabels.LabelsForStat(stat))
        {
            if (Slef.FindModifier(module, label) is double modified) return modified;
        }

        return (statsOverride ?? StatsFor(module))?.Stats[stat] ?? 0;
    }

    /// <summary>The fitted frame shift drive and the record that identified it.</summary>
    private (LoadoutModule Module, OutfittingModule Stats)? FrameShiftDrive()
    {
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = StatsFor(module);
            if (stats?.Slot == ModuleSlot.FrameShiftDrive) return (module, stats);
        }

        return null;
    }

    /// <summary>The fitted drive's jump constants.</summary>
    internal FrameShiftDriveParams? ResolveDrive()
    {
        if (FrameShiftDrive() is not (LoadoutModule drive, OutfittingModule stats)) return null;

        double? fuelMul = stats.Stats[ModuleStat.FuelMul];
        double? fuelPower = stats.Stats[ModuleStat.FuelPower];
        if (fuelMul is not double linear || fuelPower is not double power)
        {
            // A drive is fitted and its record states no jump constants. Say so, rather than
            // reporting that the build fits no drive at all.
            throw new InvalidOperationException(string.Format(
                CultureInfo.InvariantCulture,
                "The fitted record for the frame shift drive \"{0}\" states no jump constants.",
                TextPreview.Truncate(drive.Item)));
        }

        double? optMass = Slef.FindModifier(drive, "FSDOptimalMass") ?? stats.Stats[ModuleStat.OptMass];
        double? maxFuel = Slef.FindModifier(drive, "MaxFuelPerJump") ?? stats.Stats[ModuleStat.MaxFuel];
        if (optMass is not double optimised || maxFuel is not double fuel)
        {
            throw new InvalidOperationException(string.Format(
                CultureInfo.InvariantCulture,
                "The fitted record for the frame shift drive \"{0}\" states no {1}.",
                TextPreview.Truncate(drive.Item),
                optMass is null ? "optimised mass" : "maximum fuel"));
        }

        return new FrameShiftDriveParams(optimised, fuel, linear, power, ResolveJumpBoost());
    }

    /// <summary>The fitted drive, where the build carries one.</summary>
    internal LoadoutModule? FrameShiftDriveModule() => FrameShiftDrive()?.Module;

    /// <summary>The fitted Guardian booster's jump bonus, in light-years.</summary>
    /// <remarks>
    /// A booster is whatever supplies a jump bonus. The engineering group says only which
    /// recipes may touch the article, and a caller-supplied record is free to leave it out, so
    /// reading the bonus itself keeps such a record from contributing its mass while its boost
    /// goes uncounted. A bonus of nothing is not evidence of a booster, though: the first match
    /// wins, so believing it would let an unrelated record shadow a real one.
    /// </remarks>
    private double ResolveJumpBoost()
    {
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = StatsFor(module);
            double? boost = stats?.Stats[ModuleStat.JumpBoost];
            if (stats?.EngineeringGroup != EngineeringGroupId.FsdBoosters
                && (boost is null || boost == 0))
            {
                continue;
            }

            // An unpowered booster supplies nothing, so the scan carries on to whatever
            // else the build holds rather than answering for the whole build.
            if (module.On == false) continue;
            if (boost is not double bonus)
            {
                throw new InvalidOperationException(string.Format(
                    CultureInfo.InvariantCulture,
                    "The fitted record for the drive booster \"{0}\" states no jump bonus.",
                    TextPreview.Truncate(module.Item)));
            }

            return bonus;
        }

        return 0;
    }

    /// <summary>The resolved fitted record, falling back to the catalogue.</summary>
    internal OutfittingModule? StatsFor(LoadoutModule? module)
    {
        if (module is null) return null;
        if (moduleStats.TryGetValue(module.Slot, out OutfittingModule? snapshot)) return snapshot;
        if (ModuleCatalogue.FindBySymbol(module.Item) is OutfittingModule catalogued) return catalogued;

        // Some hull families name their own cargo-hatch symbol even though the fitted article
        // has the standard hatch's stats. Resolving that family here makes its power draw
        // available beside its already-known zero mass and price.
        return LoadoutState.IsBuiltInHullModule(module)
            ? ModuleCatalogue.FindBySymbol(LoadoutState.BuiltInHullSymbol)
            : null;
    }
}
