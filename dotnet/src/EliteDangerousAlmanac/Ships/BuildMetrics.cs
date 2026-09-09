using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>A fuel and cargo load one calculation runs at.</summary>
/// <param name="Fuel">
/// The main-tank fuel carried, in tonnes. Leave it absent for a full main tank.
/// </param>
/// <param name="Cargo">The cargo carried, in tonnes. Leave it absent for an empty hold.</param>
public sealed record BuildLoad(double? Fuel = null, double? Cargo = null);

/// <summary>One of the three loads a build's figures are usually quoted at.</summary>
public enum StandardLoad
{
    /// <summary>One jump's fuel and no cargo, which is the lightest the ship jumps.</summary>
    Maximum,

    /// <summary>A full main tank and no cargo.</summary>
    Unladen,

    /// <summary>A full main tank and a full hold.</summary>
    Laden,
}

/// <summary>What one standard load carries, and what the ship weighs carrying it.</summary>
/// <param name="Fuel">The main-tank fuel carried, in tonnes.</param>
/// <param name="Cargo">The cargo carried, in tonnes.</param>
/// <param name="Mass">
/// What the ship weighs at this load, in tonnes: the unladen mass plus the fuel and the cargo.
/// </param>
/// <remarks>
/// This is the mass the jump and the mobility calculations run on, so it is the figure to show
/// beside them rather than one a caller reassembles. The reserve tank is not in it. The game's
/// own statistics panel counts the reserve in the current mass it shows, and neither calculation
/// here does, so add the hull's reserve to match the panel.
/// </remarks>
public sealed record StandardLoadFigures(double Fuel, double Cargo, double Mass)
{
    /// <summary>This load as the options a calculation takes.</summary>
    public BuildLoad Load => new(Fuel, Cargo);
}

/// <summary>One fitted module a catalogue carries no price for.</summary>
/// <param name="Slot">The mount it occupies.</param>
/// <param name="Symbol">The module's identity.</param>
public sealed record UnpricedModule(string Slot, string Symbol);

/// <summary>What a build costs in shop credits, at the catalogue prices.</summary>
/// <param name="Total">The priced hull and modules together, in credits.</param>
/// <param name="Hull">The bare hull's price, in credits.</param>
/// <param name="Modules">
/// Every priced fitted module, summed. It is a lower bound while anything is unpriced.
/// </param>
/// <param name="Rebuy">
/// A twentieth of the total, truncated to credits: what insurance bills to rebuild the fit at
/// the catalogue prices.
/// </param>
/// <param name="Unpriced">The fitted modules no catalogue prices.</param>
/// <remarks>
/// A Mercenary article is bought with Merc Coin and has no credit price of its own. It is counted
/// here at the price of the stock module it is built on, and again in Merc Coin at what it really
/// cost. Subtract the stock module's price to quote the credits a shop would ask.
/// </remarks>
public sealed record BuildCredits(
    double Total,
    double Hull,
    double Modules,
    double Rebuy,
    IReadOnlyList<UnpricedModule> Unpriced);

/// <summary>What a build costs to own, in all three currencies the game charges for it.</summary>
/// <param name="Credits">The shop credits for the hull and its fitted modules.</param>
/// <param name="MercCoins">
/// The Merc Coin the build bills: every Mercenary article's shop price plus every recipe's own
/// currency cost. A Mercenary article's recipe is charged above the grade it was sold at alone.
/// </param>
/// <param name="Materials">
/// What the build's recipes and experimental effects consume, one entry for each material, with
/// the counts summed across the modules.
/// </param>
/// <remarks>
/// Every figure prices the current fit from the catalogues rather than reporting what a capture
/// said was paid. A pre-engineered article arrives engineered, so only what a player still has to
/// roll on top of one is charged. A fixed reward carries no craft recipe at all and contributes
/// nothing, and so does a modification the catalogues do not price.
/// </remarks>
public sealed record BuildCost(
    BuildCredits Credits,
    int MercCoins,
    IReadOnlyList<EngineeringMaterial> Materials);

/// <summary>What a build weighs, in tonnes, broken down the way it is assembled.</summary>
/// <param name="Hull">The bare hull's mass.</param>
/// <param name="Modules">
/// Every fitted module's post-engineering mass, summed. A lightweight recipe is already folded
/// in, and the cargo hatch weighs nothing.
/// </param>
/// <param name="Unladen">The ship with an empty tank and no cargo.</param>
/// <param name="Fuel">The main-tank fuel counted.</param>
/// <param name="Cargo">The cargo counted.</param>
/// <param name="Total">What the ship weighs at the chosen load.</param>
/// <remarks>
/// The hull and the modules are always computed from the hull record and the current fit, while
/// the unladen mass is the build's own, which for an unedited import is what the capture stated.
/// The two agree on anything assembled here. Where a capture disagrees with the catalogues, the
/// unladen mass is the one the jump and the mobility calculations use.
/// </remarks>
public sealed record BuildMass(
    double Hull,
    double Modules,
    double Unladen,
    double Fuel,
    double Cargo,
    double Total);

/// <summary>One fitted weapon and what it does.</summary>
/// <param name="Slot">The hardpoint's mount key.</param>
/// <param name="Symbol">The weapon's identity.</param>
/// <param name="Name">The weapon's display name.</param>
/// <param name="Enabled">Whether the weapon is switched on. A switched-off one joins no total.</param>
/// <param name="Metrics">What this weapon does per second, post-engineering.</param>
/// <param name="Ammunition">
/// What it holds when fully rearmed, post-engineering, or <see langword="null"/> for a laser,
/// which carries none. It is a capacity rather than a rearm state.
/// </param>
public sealed record FittedWeaponMetrics(
    string Slot,
    string Symbol,
    string Name,
    bool Enabled,
    WeaponMetrics Metrics,
    AmmunitionCapacity? Ammunition)
{
    /// <summary>The effective range in metres, where the fitted weapon states one.</summary>
    public double? MaximumRange { get; init; }

    /// <summary>Where the damage starts to fall off, in metres, where the weapon states it.</summary>
    public double? FalloffRange { get; init; }

    /// <summary>
    /// The exact projectile boundaries, where they are known. These are not effective distances,
    /// and stay separate from the range and the falloff.
    /// </summary>
    public ProjectileRangeBoundaries? ProjectileRange { get; init; }

    /// <summary>The armour-piercing rating, where it is known.</summary>
    public double? ArmourPiercing { get; init; }
}

/// <summary>A build's firepower: every fitted weapon, and the totals across the enabled ones.</summary>
/// <param name="Weapons">
/// Every fitted weapon in the hull's mount order. A weapon in a mount the layout does not name
/// follows the named ones in its own source order.
/// </param>
/// <param name="Total">The totals across the enabled weapons.</param>
public sealed record BuildWeaponMetrics(
    IReadOnlyList<FittedWeaponMetrics> Weapons,
    WeaponTotals Total);

/// <summary>A build's jump ranges at the loads that matter.</summary>
/// <param name="Max">
/// The best single jump: no cargo and one jump's fuel aboard, in light-years. This is the figure
/// the game labels the maximum jump range.
/// </param>
/// <param name="Unladen">One jump on a full tank with an empty hold, in light-years.</param>
/// <param name="Laden">One jump on a full tank with a full hold, in light-years.</param>
/// <param name="TotalMax">The summed range and the jumps on one jump's fuel, empty hold.</param>
/// <param name="TotalUnladen">The summed range and the jumps on a full tank, empty hold.</param>
/// <param name="TotalLaden">The summed range and the jumps on a full tank, full hold.</param>
public sealed record JumpRangeSummary(
    double Max,
    double Unladen,
    double Laden,
    TotalRangeDetails TotalMax,
    TotalRangeDetails TotalUnladen,
    TotalRangeDetails TotalLaden);

/// <summary>Every figure a fitted build can be asked for.</summary>
/// <remarks>
/// <para>
/// A view holds the build rather than copying it, so a later edit is visible to every call that
/// follows. What the build already carries — its mounts, its aggregate figures and its editors —
/// stays on the build itself.
/// </para>
/// <para>
/// Every member is a method, because each one computes from the build state rather than reading a
/// fact the fit already holds.
/// </para>
/// </remarks>
public sealed partial class BuildMetrics
{
    /// <summary>The share of the priced hull and modules a rebuy costs.</summary>
    private const double RebuyFraction = 0.05;

    private readonly ShipLoadout build;

    private BuildMetrics(ShipLoadout build) => this.build = build;

    /// <summary>Attaches a metrics view to a build.</summary>
    /// <param name="build">The build to read.</param>
    /// <returns>The view.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="build"/> is <see langword="null"/>.</exception>
    public static BuildMetrics Of(ShipLoadout build) =>
        new(build ?? throw new ArgumentNullException(nameof(build)));

    /// <summary>The build this view reads.</summary>
    public ShipLoadout Loadout => build;

    /// <summary>The fitted drive's constants, post-engineering.</summary>
    /// <returns>The constants, with any fitted jump booster folded into the jump bonus.</returns>
    /// <exception cref="InvalidOperationException">
    /// The build has no frame shift drive, or the fitted drive states none of the constants a
    /// jump needs.
    /// </exception>
    public FrameShiftDriveParams FrameShiftDrive() =>
        build.ResolveDrive()
        ?? throw new InvalidOperationException("The build has no frame shift drive.");

    /// <summary>The fitted thrusters' post-engineering mass curve.</summary>
    /// <returns>
    /// The curve, or <see langword="null"/> where no thrusters are fitted or the fitted record
    /// carries no complete curve.
    /// </returns>
    /// <remarks>
    /// This is the fitted article's own curve, so a switched-off or a shed thruster still has
    /// one. What the build can do with it is the mobility metric's judgement.
    /// </remarks>
    public ThrusterParams? Thrusters() =>
        LoadoutMetrics.FittedThrusterParamsFor(build.Modules, build.StatsFor);

    /// <summary>The drive's dimensionless mass factor at one load.</summary>
    /// <param name="load">The fuel and the cargo. Omit it for a full tank and an empty hold.</param>
    /// <returns>
    /// The optimised mass over the loaded mass: one at the drive's optimised mass, below one
    /// above it and above one below it.
    /// </returns>
    /// <remarks>
    /// This is the mass term the jump equation uses rather than the three-point curve the
    /// thrusters and the shield generators use. The main-tank fuel joins the loaded mass, and a
    /// jump booster's additive range does not reach the factor.
    /// </remarks>
    /// <exception cref="InvalidOperationException">The build has no usable frame shift drive.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The fuel or the cargo is not a finite figure of zero or more.
    /// </exception>
    public double FrameShiftDriveMassFactor(BuildLoad? load = null)
    {
        BuildLoad chosen = Guarded(load);
        return JumpRange.MassFactor(
            LoadedMass(chosen.Cargo ?? 0), MainFuel(chosen), FrameShiftDrive().OptMass);
    }

    /// <summary>The best single jump: no cargo, and one jump's fuel aboard.</summary>
    /// <returns>The range in light-years. A capture stating an empty main tank jumps nowhere.</returns>
    /// <exception cref="InvalidOperationException">The build has no usable frame shift drive.</exception>
    public double MaxJumpRange()
    {
        FrameShiftDriveParams drive = FrameShiftDrive();
        return JumpRange.SingleJump(LoadedMass(0), MaxJumpFuel(drive), drive);
    }

    /// <summary>The range of one jump at a chosen load.</summary>
    /// <param name="load">The fuel and the cargo. Omit it for a full tank and an empty hold.</param>
    /// <returns>The jump's range, in light-years.</returns>
    /// <exception cref="InvalidOperationException">The build has no usable frame shift drive.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The fuel or the cargo is not a finite figure of zero or more.
    /// </exception>
    public double JumpRangeAt(BuildLoad? load = null)
    {
        BuildLoad chosen = Guarded(load);
        return JumpRange.SingleJump(
            LoadedMass(chosen.Cargo ?? 0), MainFuel(chosen), FrameShiftDrive());
    }

    /// <summary>The range of one jump on a full tank with a full hold.</summary>
    /// <returns>The jump's range, in light-years.</returns>
    /// <exception cref="InvalidOperationException">The build has no usable frame shift drive.</exception>
    public double LadenJumpRange() => JumpRangeAt(new BuildLoad(Cargo: build.CargoCapacity));

    /// <summary>The fuel one jump of a stated distance costs.</summary>
    /// <param name="distance">The jump distance, in light-years.</param>
    /// <param name="load">The fuel and the cargo. Omit it for a full tank and an empty hold.</param>
    /// <returns>The fuel used, in tonnes, capped at what the drive burns in one jump.</returns>
    /// <exception cref="InvalidOperationException">The build has no usable frame shift drive.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The fuel or the cargo is not a finite figure of zero or more.
    /// </exception>
    public double FuelPerJump(double distance, BuildLoad? load = null)
    {
        BuildLoad chosen = Guarded(load);
        return JumpRange.FuelPerJump(
            distance, LoadedMass(chosen.Cargo ?? 0), MainFuel(chosen), FrameShiftDrive());
    }

    /// <summary>The summed range and the jumps a chosen load produces.</summary>
    /// <param name="load">The fuel and the cargo. Omit it for a full tank and an empty hold.</param>
    /// <returns>The summed range in light-years, and the jumps made before the tank empties.</returns>
    /// <exception cref="InvalidOperationException">The build has no usable frame shift drive.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The fuel or the cargo is not a finite figure of zero or more, or the fuel would take more
    /// jumps than the calculation counts.
    /// </exception>
    public TotalRangeDetails TotalRange(BuildLoad? load = null)
    {
        BuildLoad chosen = Guarded(load);
        return JumpRange.Total(
            LoadedMass(chosen.Cargo ?? 0), MainFuel(chosen), FrameShiftDrive());
    }

    /// <summary>Resolves one of the standard loads the jump and the mobility views quote.</summary>
    /// <param name="load">Which standard load to weigh.</param>
    /// <returns>
    /// The fuel and the cargo carried, and what the ship weighs carrying them, all in tonnes.
    /// Only the maximum load can come back incomplete: it reads the whole fitted drive, the jump
    /// booster included, so a complete one can be passed straight to a jump calculation.
    /// </returns>
    public CalculationResult<StandardLoadFigures> StandardLoadResult(StandardLoad load)
    {
        LoadoutFuelCapacity tanks = build.FuelCapacity;
        double cargo = load == StandardLoad.Laden ? build.CargoCapacity : 0;
        double? driveFuel = null;
        FrameShiftDriveParams? drive = null;
        string? driveMessage = null;

        if (load == StandardLoad.Maximum)
        {
            try
            {
                drive = build.ResolveDrive();
                driveFuel = drive?.MaxFuel;
            }
            catch (InvalidOperationException error)
            {
                driveMessage = error.Message;
            }

            if (driveFuel is null) return NoDrive(driveMessage);
        }

        double carried = load == StandardLoad.Maximum
            ? Math.Min(tanks.Main, driveFuel!.Value)
            : tanks.Main;
        StandardLoadFigures figures = new(carried, cargo, build.UnladenMass + carried + cargo);

        if (load != StandardLoad.Maximum) return CalculationResult.Of(figures);

        try
        {
            JumpRangeAt(figures.Load);
        }
        catch (ArgumentOutOfRangeException error)
        {
            return CalculationResult.Unavailable<StandardLoadFigures>(
                UnphysicalLoad(drive, figures, error.Message));
        }

        return CalculationResult.Of(figures);
    }

    /// <summary>Every jump figure at once: the best, the unladen, the laden, and each total.</summary>
    /// <returns>The summary. Each single jump and each total's range is in light-years.</returns>
    /// <remarks>
    /// For a load of a caller's own, ask for one jump or for every jump at the fuel and the cargo
    /// actually carried.
    /// </remarks>
    /// <exception cref="InvalidOperationException">
    /// The build has no usable frame shift drive, so no standard load can be weighed.
    /// </exception>
    public JumpRangeSummary JumpRangeSummary()
    {
        BuildLoad maximum = Required(StandardLoad.Maximum);
        BuildLoad unladen = Required(StandardLoad.Unladen);
        BuildLoad laden = Required(StandardLoad.Laden);
        return new JumpRangeSummary(
            JumpRangeAt(maximum),
            JumpRangeAt(unladen),
            JumpRangeAt(laden),
            TotalRange(maximum),
            TotalRange(unladen),
            TotalRange(laden));
    }

    /// <summary>Weighs the hull, the fitted modules and the load on top of them.</summary>
    /// <param name="load">The fuel and the cargo. Omit it for a full tank and an empty hold.</param>
    /// <returns>The breakdown, every figure in tonnes.</returns>
    /// <remarks>
    /// Every module's mass is post-engineering, so a lightweight roll is already counted. The
    /// reserve tank is not counted: the main tank is the fuel the drive and the flight model see,
    /// and it is what the jump and the mobility calculations weigh.
    /// </remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The fuel or the cargo is not a finite figure of zero or more.
    /// </exception>
    public BuildMass BuildMass(BuildLoad? load = null)
    {
        BuildLoad chosen = Guarded(load);
        double unladen = build.UnladenMass;
        double fuel = MainFuel(chosen);
        double cargo = chosen.Cargo ?? 0;
        return new BuildMass(
            build.Hull.HullMass,
            LoadoutCalculations.UnladenMass(0, build.CalculationModules()),
            unladen,
            fuel,
            cargo,
            unladen + fuel + cargo);
    }

    /// <summary>Prices the whole build from the catalogues.</summary>
    /// <returns>
    /// The shop credits, the Merc Coin and the engineering materials the modifications consume.
    /// The module price, the total and the rebuy are lower bounds while anything is unpriced. A
    /// built-in hull fitting is free rather than unpriced.
    /// </returns>
    /// <remarks>
    /// No modification is charged twice. A Mercenary article arrives at the grade it was sold at,
    /// so only the climb above that grade bills materials and further Merc Coin, and an
    /// experimental effect the article came with is free while one added on top is not.
    /// </remarks>
    public BuildCost BuildCost()
    {
        double hull = build.Hull.HullCost;
        double modules = 0;
        int mercCoins = 0;
        List<UnpricedModule> unpriced = [];
        List<IReadOnlyList<EngineeringMaterial>> materials = [];

        foreach (LoadoutModule module in build.Modules)
        {
            OutfittingModule? stats = build.StatsFor(module);
            if (stats?.Cost is long cost)
            {
                modules += cost;
            }
            else if (stats is not null
                || (!LoadoutState.IsNonOutfittingSlot(module.Slot)
                    && !LoadoutState.IsBuiltInHullModule(module)))
            {
                unpriced.Add(new UnpricedModule(module.Slot, module.Item));
            }

            PreEngineeredVariant? variant = LoadoutImport.PreEngineeredVariantFor(module);
            mercCoins += variant?.MercCoinCost ?? 0;
            if (module.Engineering is not ModuleEngineering engineering) continue;

            // A capture states its own grade, so one outside the catalogued range is priced as no
            // climb rather than thrown at whoever is reading a total.
            int bought = variant?.Grade ?? 0;
            if (engineering.Level > bought && engineering.Level <= 5
                && BlueprintCosts.FindClimbCost(
                    engineering.BlueprintName, engineering.Level, bought) is BlueprintCost climb)
            {
                materials.Add(climb.Materials);
                mercCoins += climb.MercCoins;
            }

            if (engineering.ExperimentalEffect is string effect
                && !RegistryIndex.KeyComparer.Equals(
                    effect.Trim(), variant?.ExperimentalEffectSymbol?.Trim())
                && ExperimentalEffectCosts.Find(effect) is IReadOnlyList<EngineeringMaterial> price)
            {
                materials.Add(price);
            }
        }

        return new BuildCost(
            new BuildCredits(
                hull + modules,
                hull,
                modules,
                Math.Truncate((hull + modules) * RebuyFraction),
                new ReadOnlyCollection<UnpricedModule>(unpriced)),
            mercCoins,
            Engineering.SumMaterials([.. materials]));
    }

    /// <summary>The load a calculation runs at, with its figures checked.</summary>
    private static BuildLoad Guarded(BuildLoad? load)
    {
        BuildLoad chosen = load ?? new BuildLoad();
        if (chosen.Fuel is double fuel) RangeGuards.RequireFiniteNonNegative(fuel, "load.Fuel");
        if (chosen.Cargo is double cargo) RangeGuards.RequireFiniteNonNegative(cargo, "load.Cargo");
        return chosen;
    }

    private double MainFuel(BuildLoad load) => load.Fuel ?? build.FuelCapacity.Main;

    /// <summary>The unladen mass plus the stated cargo.</summary>
    private double LoadedMass(double cargo) => build.UnladenMass + cargo;

    /// <summary>The fuel one jump burns: the whole main tank, or the drive's limit if lower.</summary>
    private double MaxJumpFuel(FrameShiftDriveParams drive) =>
        Math.Min(build.FuelCapacity.Main, drive.MaxFuel);

    /// <summary>One standard load a jump figure cannot do without.</summary>
    private BuildLoad Required(StandardLoad load)
    {
        CalculationResult<StandardLoadFigures> result = StandardLoadResult(load);
        if (result.Complete) return result.Value.Load;

        List<string> reasons = [];
        foreach (CalculationIssue issue in result.Issues) reasons.Add(issue.Message);
        throw new InvalidOperationException(string.Format(
            CultureInfo.InvariantCulture,
            "The {0} load cannot be weighed. {1}",
            load,
            string.Join(" ", reasons)));
    }

    private CalculationResult<StandardLoadFigures> NoDrive(string? message)
    {
        LoadoutModule? fitted = build.FrameShiftDriveModule();
        return CalculationResult.Unavailable<StandardLoadFigures>(new CalculationIssue(
            CalculationField.FrameShiftDrive,
            fitted is null ? CalculationIssueReason.Missing : CalculationIssueReason.Unresolved,
            message ?? "No frame shift drive is fitted.")
        {
            Slot = fitted?.Slot ?? "FrameShiftDrive",
            Symbol = fitted?.Item,
        });
    }

    private CalculationIssue UnphysicalLoad(
        FrameShiftDriveParams? drive,
        StandardLoadFigures figures,
        string message)
    {
        CalculationField field = CalculationField.FrameShiftDrive;
        if (drive is not null && Unphysical(drive.MaxFuel))
        {
            field = CalculationField.FrameShiftDrive;
        }
        else if (Unphysical(figures.Fuel))
        {
            field = CalculationField.FuelCapacity;
        }
        else if (Unphysical(build.UnladenMass))
        {
            field = CalculationField.Mass;
        }

        LoadoutModule? fitted = field == CalculationField.FrameShiftDrive
            ? build.FrameShiftDriveModule()
            : null;
        return new CalculationIssue(field, CalculationIssueReason.Invalid, message)
        {
            Slot = fitted?.Slot,
            Symbol = fitted?.Item,
        };
    }

    private static bool Unphysical(double value) =>
        double.IsNaN(value) || double.IsInfinity(value) || value < 0;
}
