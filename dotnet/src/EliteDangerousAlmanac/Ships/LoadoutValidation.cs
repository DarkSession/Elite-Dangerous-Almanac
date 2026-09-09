using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Why a loadout is invalid or incomplete.</summary>
/// <remarks>
/// <see cref="DuplicateSlot"/> and <see cref="MissingRequiredSlot"/> only ever come from
/// validating a module list a caller assembled. A build reports neither: it is keyed by mount
/// and it refuses a repeated one, and it fills its fixed mounts from the hull defaults.
/// </remarks>
public enum LoadoutIssueCode
{
    /// <summary>Two entries name the same mount.</summary>
    DuplicateSlot,

    /// <summary>An entry names a mount the hull does not have.</summary>
    UnknownSlot,

    /// <summary>An operational build keeps this mount filled, and it is empty.</summary>
    MissingRequiredSlot,

    /// <summary>The module does not fit the mount it is in.</summary>
    IncompatibleModule,

    /// <summary>Two fitted modules share a one-per-ship family.</summary>
    DuplicateExclusiveModule,

    /// <summary>A per-ship module-count allowance is over-filled.</summary>
    ModuleLimitExceeded,

    /// <summary>The ship weighs more than its own thrusters are rated to move.</summary>
    ThrusterMassExceeded,
}

/// <summary>How much one validation finding says about a build.</summary>
public enum LoadoutIssueSeverity
{
    /// <summary>The input is invalid. This alone makes a build not valid.</summary>
    Error,

    /// <summary>A required module is missing, so the build is not operational.</summary>
    Incomplete,

    /// <summary>The build flies, but not at every load it can carry.</summary>
    Warning,
}

/// <summary>A load a thruster rating is read against, lightest first.</summary>
/// <remarks>
/// A ship cannot undock without fuel, so failing dry or unladen is an error. Failing only
/// laden is a warning, because the hold is the one load a pilot chooses.
/// </remarks>
public enum ThrusterLoad
{
    /// <summary>The fit alone: hull and modules, an empty tank and no cargo.</summary>
    Dry,

    /// <summary>The fit with a full main tank, which is what an outfitting tool calls unladen.</summary>
    Unladen,

    /// <summary>The fit with a full tank and a full hold.</summary>
    Laden,
}

/// <summary>Why one module does not fit one mount.</summary>
/// <remarks>
/// <see cref="BuiltInHullModule"/> is the one constraint that does not depend on the mount:
/// the cargo hatch comes with the hull and goes in no mount an editor can set.
/// </remarks>
public enum ModuleFitConstraint
{
    /// <summary>The mount cannot be changed at all.</summary>
    ImmutableSlot,

    /// <summary>The article is part of the hull rather than an outfitting module.</summary>
    BuiltInHullModule,

    /// <summary>The armour mount takes a ship armour module and nothing else.</summary>
    ArmourRequired,

    /// <summary>The armour belongs to another hull.</summary>
    WrongHullArmour,

    /// <summary>The module is sold for other hulls only.</summary>
    RestrictedHull,

    /// <summary>The mount or the module reserves itself for a family the other is not in.</summary>
    RestrictedMount,

    /// <summary>The core mount takes another core function.</summary>
    WrongCoreType,

    /// <summary>The hardpoint takes a weapon.</summary>
    HardpointRequired,

    /// <summary>The utility mount takes a utility fitting.</summary>
    UtilityRequired,

    /// <summary>The optional internal takes an optional-internal module.</summary>
    OptionalInternalRequired,

    /// <summary>A core module fits its own core mount and no optional one.</summary>
    CoreModuleInOptionalSlot,

    /// <summary>The module is larger than the mount.</summary>
    Oversized,
}

/// <summary>Why a module does not fit a mount, and the figures behind the reason.</summary>
/// <param name="Constraint">Which rule the fit breaks.</param>
/// <param name="Message">The English reading of that rule for this module and mount.</param>
public sealed record ModuleFitProblem(ModuleFitConstraint Constraint, string Message)
{
    /// <summary>The family the mount or the module reserves itself for.</summary>
    public SlotRestriction? Restriction { get; init; }

    /// <summary>The core function the mount takes.</summary>
    public CoreSlotType? RequiredCore { get; init; }

    /// <summary>The one fixed mount the module fills, when it fills one.</summary>
    public ModuleSlot? ModuleSlot { get; init; }

    /// <summary>The module's own class.</summary>
    public int? ModuleClass { get; init; }

    /// <summary>The mount's class.</summary>
    public int? SlotSize { get; init; }

    /// <summary>The hull the armour belongs to, by name.</summary>
    public string? ArmourShipName { get; init; }

    /// <summary>The hull the armour belongs to, by symbol, when the name resolves to one.</summary>
    public string? ArmourShipSymbol { get; init; }

    /// <summary>The hull being fitted, by symbol.</summary>
    public string? ShipSymbol { get; init; }

    /// <summary>The hull being fitted, by name, when the symbol resolves to one.</summary>
    public string? ShipName { get; init; }

    /// <summary>The hulls a restricted module is sold for, by name, in the module's own order.</summary>
    public IReadOnlyList<string>? AllowedShipNames { get; init; }

    /// <summary>The same hulls by symbol, in the same order.</summary>
    public IReadOnlyList<string>? AllowedShipSymbols { get; init; }
}

/// <summary>One validation finding.</summary>
/// <param name="Code">Which rule the build breaks.</param>
/// <param name="Severity">How much the finding says about the build.</param>
/// <param name="Message">The English reading of the finding.</param>
/// <remarks>
/// Branch on <paramref name="Code"/> rather than on <paramref name="Severity"/>: one severity
/// covers findings that belong in different places on a panel. The typed members beside the
/// message carry the same figures it quotes, at full precision, for a caller composing its own
/// text.
/// </remarks>
public sealed record LoadoutIssue(
    LoadoutIssueCode Code,
    LoadoutIssueSeverity Severity,
    string Message)
{
    /// <summary>The mount involved, in the input's own spelling.</summary>
    public string? Slot { get; init; }

    /// <summary>The module symbol involved.</summary>
    public string? Symbol { get; init; }

    /// <summary>The mount the conflicting module already sits in.</summary>
    public string? PreviousSlot { get; init; }

    /// <summary>The conflicting module's own symbol.</summary>
    public string? PreviousSymbol { get; init; }

    /// <summary>The one-per-ship family two fitted modules share.</summary>
    public ModuleExclusionGroup? ExclusionGroup { get; init; }

    /// <summary>The over-filled per-ship count family.</summary>
    public ModuleLimitGroup? LimitGroup { get; init; }

    /// <summary>The modules fitted in that family.</summary>
    public int? Count { get; init; }

    /// <summary>The modules the ship allows in that family.</summary>
    public int? Limit { get; init; }

    /// <summary>The hull being validated.</summary>
    public string? ShipSymbol { get; init; }

    /// <summary>Why the module does not fit, on an incompatible-module finding.</summary>
    public ModuleFitProblem? Fit { get; init; }

    /// <summary>The lightest load the thrusters cannot move.</summary>
    public ThrusterLoad? Load { get; init; }

    /// <summary>What the ship weighs at that load, in tonnes, exactly as measured.</summary>
    public double? Mass { get; init; }

    /// <summary>What the thrusters are rated to move, in tonnes, exactly as measured.</summary>
    public double? MaxMass { get; init; }
}

/// <summary>What a validation found.</summary>
/// <param name="Valid">
/// No structurally invalid mount, repeated key or incompatible module. Only an error clears
/// this.
/// </param>
/// <param name="Complete">
/// Valid, with the armour and every operational core mount filled. A warning leaves this alone.
/// </param>
/// <param name="Issues">Every finding, in the order the rules raised them.</param>
public sealed record LoadoutValidation(
    bool Valid,
    bool Complete,
    IReadOnlyList<LoadoutIssue> Issues);

/// <summary>One fitted module reduced to what structural validation reads.</summary>
/// <param name="Slot">The mount key, in the input's own spelling.</param>
/// <param name="Symbol">The module symbol.</param>
public sealed record ValidationModule(string Slot, string Symbol)
{
    /// <summary>Whether this entry must name one of the hull's own outfitting mounts.</summary>
    public bool RequiresKnownSlot { get; init; } = true;

    /// <summary>Why the module does not fit, or <see langword="null"/> when it fits.</summary>
    public ModuleFitProblem? Fit { get; init; }

    /// <summary>The one-per-ship family this module belongs to, when it belongs to one.</summary>
    public ModuleExclusionGroup? ExclusionGroup { get; init; }

    /// <summary>The per-ship count family this module consumes a place in, when any.</summary>
    public ModuleLimitGroup? LimitGroup { get; init; }

    /// <summary>The per-ship count allowance this module grants, when any.</summary>
    public ModuleLimitIncrease? LimitIncrease { get; init; }

    /// <summary>The mass this module can still move, in tonnes.</summary>
    /// <remarks>
    /// State it on the fitted thrusters and nowhere else, and only where their record carries
    /// the figure. It is the top of the thruster mass curve: above it the curve contributes
    /// nothing and the ship does not move. A shield generator's curve has a maximum of its own
    /// and is no limit on the build's mass.
    /// </remarks>
    public double? ThrusterMaxMass { get; init; }
}

/// <summary>What a build weighs at each load a thruster rating is read against, in tonnes.</summary>
/// <param name="Dry">
/// The hull and every fitted module, with an empty tank and no cargo. This is the dry figure: a
/// journal's own unladen mass excludes fuel, while the game's readout includes a full tank.
/// </param>
/// <remarks>
/// State as much as the build knows. The fuel and the cargo are capacities rather than a chosen
/// load, because those are the heaviest the build can become without being refitted. Leave one
/// out and the loads above it go unchecked.
/// </remarks>
public sealed record LoadoutMass(double Dry)
{
    /// <summary>The main tank's capacity. The reserve is not counted, as the flight model does not.</summary>
    public double? Fuel { get; init; }

    /// <summary>The cargo capacity, as the fitted racks allow rather than as any hold now holds.</summary>
    public double? Cargo { get; init; }
}

/// <summary>What a validation reads.</summary>
/// <param name="ShipSymbol">The hull symbol.</param>
/// <param name="Slots">The hull's expanded mounts.</param>
/// <param name="Modules">
/// The fitted modules. A repeated mount key must be kept here so it can be reported.
/// </param>
public sealed record LoadoutValidationInput(
    string ShipSymbol,
    IReadOnlyList<BuildSlot> Slots,
    IReadOnlyList<ValidationModule> Modules)
{
    /// <summary>
    /// What the assembled ship weighs, for the one rule that reads a figure. Leave it out to
    /// check the structure alone.
    /// </summary>
    public LoadoutMass? Mass { get; init; }
}

/// <summary>Structural validation for a fitted build.</summary>
/// <remarks>
/// Every rule but one reads the structure alone, so this loads no catalogue. The exception is
/// the thruster rating, which is read against the ship's stated mass.
/// </remarks>
public static class LoadoutValidator
{
    private static readonly IReadOnlyList<LoadoutIssue> NoIssues =
        new ReadOnlyCollection<LoadoutIssue>([]);

    /// <summary>Validates a resolved fitted build.</summary>
    /// <param name="input">The hull layout, the resolved module classifications and the mass.</param>
    /// <returns>Structural validity, operational completeness, and every finding.</returns>
    /// <remarks>
    /// The thruster rating is weighed against each load the input can state, and the lightest
    /// load that is already too heavy is the one reported. The loads only grow, so reporting
    /// the heavier ones as well would say the same thing three times, each less true than the
    /// last.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="input"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A figure in the mass, or a module's thruster rating, is stated and is not a finite
    /// number of zero or more.
    /// </exception>
    public static LoadoutValidation Validate(LoadoutValidationInput input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));

        RequireTonnes("input.Mass.Dry", input.Mass?.Dry);
        RequireTonnes("input.Mass.Fuel", input.Mass?.Fuel);
        RequireTonnes("input.Mass.Cargo", input.Mass?.Cargo);
        foreach (ValidationModule module in input.Modules)
        {
            RequireTonnes(
                TextPreview.Truncate(module.Slot) + " ThrusterMaxMass", module.ThrusterMaxMass);
        }

        List<LoadoutIssue> issues = [];
        Dictionary<string, string> seen = new(StringComparer.OrdinalIgnoreCase);
        CheckDuplicateSlots(input, issues, seen);
        CheckExclusiveModules(input, issues);
        CheckModuleLimits(input, issues);
        CheckKnownSlots(input, issues);
        CheckRequiredSlots(input, issues, seen);
        CheckFit(input, issues);
        CheckThrusterRating(input, issues);

        bool valid = true;
        bool complete = true;
        foreach (LoadoutIssue issue in issues)
        {
            if (issue.Severity == LoadoutIssueSeverity.Error) valid = false;

            // A warning is a note against a build that is both legal and fully mounted, so it
            // answers neither question.
            if (issue.Severity != LoadoutIssueSeverity.Warning) complete = false;
        }

        return new LoadoutValidation(
            valid,
            complete,
            issues.Count == 0 ? NoIssues : new ReadOnlyCollection<LoadoutIssue>(issues));
    }

    private static void CheckDuplicateSlots(
        LoadoutValidationInput input,
        List<LoadoutIssue> issues,
        Dictionary<string, string> seen)
    {
        foreach (ValidationModule module in input.Modules)
        {
            if (!seen.TryGetValue(module.Slot, out string? previous))
            {
                seen[module.Slot] = module.Slot;
                continue;
            }

            issues.Add(new LoadoutIssue(
                LoadoutIssueCode.DuplicateSlot,
                LoadoutIssueSeverity.Error,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "Slot {0} occurs more than once (also {1})",
                    TextPreview.Truncate(module.Slot),
                    TextPreview.Truncate(previous)))
            {
                Slot = module.Slot,
                Symbol = module.Symbol,
                PreviousSlot = previous,
            });
        }
    }

    private static void CheckExclusiveModules(LoadoutValidationInput input, List<LoadoutIssue> issues)
    {
        Dictionary<ModuleExclusionGroup, ValidationModule> exclusive = [];
        foreach (ValidationModule module in input.Modules)
        {
            if (module.ExclusionGroup is not ModuleExclusionGroup group) continue;
            if (!exclusive.TryGetValue(group, out ValidationModule? previous))
            {
                exclusive[group] = module;
                continue;
            }

            issues.Add(new LoadoutIssue(
                LoadoutIssueCode.DuplicateExclusiveModule,
                LoadoutIssueSeverity.Error,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "{0}: {1} conflicts with {2} in {3} ({4} is limited to one per ship)",
                    TextPreview.Truncate(module.Slot),
                    TextPreview.Truncate(module.Symbol),
                    TextPreview.Truncate(previous.Symbol),
                    TextPreview.Truncate(previous.Slot),
                    group))
            {
                Slot = module.Slot,
                Symbol = module.Symbol,
                PreviousSlot = previous.Slot,
                PreviousSymbol = previous.Symbol,
                ExclusionGroup = group,
            });
        }
    }

    private static void CheckModuleLimits(LoadoutValidationInput input, List<LoadoutIssue> issues)
    {
        List<ModuleLimitEntry> entries = new(input.Modules.Count);
        foreach (ValidationModule module in input.Modules)
        {
            entries.Add(new ModuleLimitEntry(module.LimitGroup, module.LimitIncrease));
        }

        foreach (ModuleLimitUsage usage in ModuleLimits.Calculate(entries))
        {
            if (usage.Excess == 0) continue;
            issues.Add(new LoadoutIssue(
                LoadoutIssueCode.ModuleLimitExceeded,
                LoadoutIssueSeverity.Error,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "{0} has {1} fitted modules but the ship allows {2}",
                    usage.Group,
                    usage.Count,
                    usage.Limit))
            {
                LimitGroup = usage.Group,
                Count = usage.Count,
                Limit = usage.Limit,
            });
        }
    }

    private static void CheckKnownSlots(LoadoutValidationInput input, List<LoadoutIssue> issues)
    {
        HashSet<string> known = new(StringComparer.OrdinalIgnoreCase);
        foreach (BuildSlot slot in input.Slots) known.Add(slot.Key);

        foreach (ValidationModule module in input.Modules)
        {
            if (!module.RequiresKnownSlot || known.Contains(module.Slot)) continue;
            issues.Add(new LoadoutIssue(
                LoadoutIssueCode.UnknownSlot,
                LoadoutIssueSeverity.Error,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "{0} is not a slot on {1}",
                    TextPreview.Truncate(module.Slot),
                    TextPreview.Truncate(input.ShipSymbol)))
            {
                Slot = module.Slot,
                Symbol = module.Symbol,
                ShipSymbol = input.ShipSymbol,
            });
        }
    }

    private static void CheckRequiredSlots(
        LoadoutValidationInput input,
        List<LoadoutIssue> issues,
        Dictionary<string, string> seen)
    {
        foreach (BuildSlot slot in input.Slots)
        {
            if (!LoadoutSlotRules.IsRequired(slot.Kind) || seen.ContainsKey(slot.Key)) continue;
            issues.Add(new LoadoutIssue(
                LoadoutIssueCode.MissingRequiredSlot,
                LoadoutIssueSeverity.Incomplete,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "{0} is required for an operational build",
                    TextPreview.Truncate(slot.Key)))
            {
                Slot = slot.Key,
            });
        }
    }

    private static void CheckFit(LoadoutValidationInput input, List<LoadoutIssue> issues)
    {
        foreach (ValidationModule module in input.Modules)
        {
            if (module.Fit is not ModuleFitProblem fit) continue;
            issues.Add(new LoadoutIssue(
                LoadoutIssueCode.IncompatibleModule,
                LoadoutIssueSeverity.Error,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "{0}: {1} {2}",
                    TextPreview.Truncate(module.Slot),
                    TextPreview.Truncate(module.Symbol),
                    TextPreview.Truncate(fit.Message)))
            {
                Slot = module.Slot,
                Symbol = module.Symbol,
                Fit = fit,
            });
        }
    }

    private static void CheckThrusterRating(LoadoutValidationInput input, List<LoadoutIssue> issues)
    {
        foreach ((ThrusterLoad load, double mass) in Loads(input.Mass))
        {
            int before = issues.Count;
            foreach (ValidationModule module in input.Modules)
            {
                if (module.ThrusterMaxMass is not double rating || mass <= rating) continue;
                issues.Add(new LoadoutIssue(
                    LoadoutIssueCode.ThrusterMassExceeded,
                    load == ThrusterLoad.Laden
                        ? LoadoutIssueSeverity.Warning
                        : LoadoutIssueSeverity.Error,

                    // The message quotes both figures to the tenth of a tonne an outfitting
                    // screen shows, while the members below keep them exactly as measured: a
                    // capture's own unladen mass runs to six decimals, and an engineered rating
                    // to ten.
                    string.Format(
                        CultureInfo.InvariantCulture,
                        "{0}: {1} is rated to {2} t but the ship weighs {3} t {4}",
                        TextPreview.Truncate(module.Slot),
                        TextPreview.Truncate(module.Symbol),
                        Tenths(rating),
                        Tenths(mass),
                        LoadPhrase(load)))
                {
                    Slot = module.Slot,
                    Symbol = module.Symbol,
                    Load = load,
                    Mass = mass,
                    MaxMass = rating,
                });
            }

            if (issues.Count > before) return;
        }
    }

    /// <summary>
    /// The loads a thruster rating is read against, lightest first.
    /// </summary>
    /// <remarks>
    /// Each is built from the one below, so a capacity nobody stated ends the list rather than
    /// being guessed at zero: an unstated tank is a tank of unknown size, not an empty one.
    /// </remarks>
    private static List<(ThrusterLoad Load, double Mass)> Loads(LoadoutMass? mass)
    {
        if (mass is null) return [];
        List<(ThrusterLoad, double)> loads = [(ThrusterLoad.Dry, mass.Dry)];
        if (mass.Fuel is not double fuel) return loads;
        loads.Add((ThrusterLoad.Unladen, mass.Dry + fuel));
        if (mass.Cargo is not double cargo) return loads;
        loads.Add((ThrusterLoad.Laden, mass.Dry + fuel + cargo));
        return loads;
    }

    private static string LoadPhrase(ThrusterLoad load) => load switch
    {
        ThrusterLoad.Dry => "before fuel",
        ThrusterLoad.Unladen => "with a full tank",
        _ => "fully laden",
    };

    /// <summary>A mass as an outfitting screen shows it, in tenths of a tonne.</summary>
    private static double Tenths(double tonnes) => Math.Floor((tonnes * 10) + 0.5) / 10;

    /// <summary>Refuses a mass that is stated and cannot be weighed.</summary>
    /// <remarks>
    /// A value that is not a number compares false against every rating, so an unguarded one
    /// would report a thruster overload on any build it reached rather than being ignored.
    /// </remarks>
    private static void RequireTonnes(string name, double? value)
    {
        if (value is not double tonnes) return;
        if (double.IsNaN(tonnes) || double.IsInfinity(tonnes) || tonnes < 0)
        {
            throw new ArgumentOutOfRangeException(
                name, tonnes, "The figure must be a finite number of tonnes of zero or more.");
        }
    }
}
