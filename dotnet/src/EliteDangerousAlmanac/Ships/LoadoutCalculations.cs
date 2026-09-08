using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Which calculation input a build metric could not read.</summary>
public enum CalculationField
{
    /// <summary>The ship's loaded mass.</summary>
    Mass,

    /// <summary>The fuel the tanks hold.</summary>
    FuelCapacity,

    /// <summary>The fitted frame shift drive.</summary>
    FrameShiftDrive,

    /// <summary>The power the plant generates.</summary>
    PowerCapacity,

    /// <summary>The power the fitted modules draw.</summary>
    PowerDraw,

    /// <summary>The plant's thermal efficiency.</summary>
    HeatEfficiency,

    /// <summary>The fitted thrusters.</summary>
    Thrusters,

    /// <summary>The fitted shield generator.</summary>
    ShieldGenerator,

    /// <summary>The fitted power distributor.</summary>
    PowerDistributor,
}

/// <summary>Why a build metric could not produce a value.</summary>
public enum CalculationIssueReason
{
    /// <summary>The module is not fitted at all.</summary>
    Missing,

    /// <summary>A fitted module or a figure it needs is absent from the supplied data.</summary>
    Unresolved,

    /// <summary>The module is switched off.</summary>
    Disabled,

    /// <summary>The priority budget sheds the module.</summary>
    Shed,

    /// <summary>The value is known and not physical.</summary>
    Invalid,
}

/// <summary>One input or fitted-module state that stopped a build metric.</summary>
/// <param name="Field">The calculation input that is missing or unavailable.</param>
/// <param name="Reason">Which kind of unavailability this is.</param>
/// <param name="Message">The English reading, for a log or a validation panel.</param>
public sealed record CalculationIssue(
    CalculationField Field,
    CalculationIssueReason Reason,
    string Message)
{
    /// <summary>The mount holding the incomplete module, when the input belongs to a module.</summary>
    public string? Slot { get; init; }

    /// <summary>The module symbol, when the input belongs to a module.</summary>
    public string? Symbol { get; init; }
}

/// <summary>A build metric, and the evidence for whether it is complete.</summary>
/// <typeparam name="T">The calculated value.</typeparam>
/// <remarks>
/// An incomplete result never exposes a misleading partial value, so the value is read
/// through <see cref="TryGetValue"/> or through <see cref="Value"/>, which refuses an
/// incomplete result rather than answering a default.
/// </remarks>
public sealed class CalculationResult<T>
{
    private readonly T calculated;

    internal CalculationResult(T calculated, bool complete, IReadOnlyList<CalculationIssue> issues)
    {
        this.calculated = calculated;
        Complete = complete;
        Issues = issues;
    }

    /// <summary>Whether the calculation produced a value.</summary>
    public bool Complete { get; }

    /// <summary>The missing or unavailable inputs. A complete result names none.</summary>
    public IReadOnlyList<CalculationIssue> Issues { get; }

    /// <summary>The calculated value.</summary>
    /// <exception cref="InvalidOperationException">
    /// The calculation is incomplete. Read <see cref="Issues"/> to say why.
    /// </exception>
    public T Value => Complete
        ? calculated
        : throw new InvalidOperationException("The calculation is incomplete and holds no value.");

    /// <summary>Reads the value, when the calculation is complete.</summary>
    /// <param name="value">The calculated value, or the type's default when it is not.</param>
    /// <returns><see langword="true"/> when the calculation is complete.</returns>
    public bool TryGetValue([MaybeNullWhen(false)] out T value)
    {
        value = Complete ? calculated : default;
        return Complete;
    }
}

/// <summary>Builds a <see cref="CalculationResult{T}"/>.</summary>
public static class CalculationResult
{
    private static readonly IReadOnlyList<CalculationIssue> NoIssues =
        new ReadOnlyCollection<CalculationIssue>([]);

    /// <summary>Wraps a value that is already known.</summary>
    /// <typeparam name="T">The calculated value.</typeparam>
    /// <param name="value">The known value.</param>
    /// <returns>A complete result that names no issue.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="value"/> is <see langword="null"/>.</exception>
    public static CalculationResult<T> Of<T>(T value) => value is null
        ? throw new ArgumentNullException(nameof(value))
        : new CalculationResult<T>(value, true, NoIssues);

    /// <summary>Wraps the inputs that stopped the calculation.</summary>
    /// <typeparam name="T">The value the calculation would have produced.</typeparam>
    /// <param name="issues">The missing or unavailable inputs. There must be at least one.</param>
    /// <returns>An incomplete result.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="issues"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentException"><paramref name="issues"/> is empty.</exception>
    public static CalculationResult<T> Unavailable<T>(IReadOnlyList<CalculationIssue> issues)
    {
        if (issues is null) throw new ArgumentNullException(nameof(issues));
        if (issues.Count == 0)
        {
            throw new ArgumentException(
                "An incomplete calculation names at least one issue.", nameof(issues));
        }

        return new CalculationResult<T>(
            default!, false, new ReadOnlyCollection<CalculationIssue>([.. issues]));
    }

    /// <summary>Wraps the one input that stopped the calculation.</summary>
    /// <typeparam name="T">The value the calculation would have produced.</typeparam>
    /// <param name="issue">The missing or unavailable input.</param>
    /// <returns>An incomplete result.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="issue"/> is <see langword="null"/>.</exception>
    public static CalculationResult<T> Unavailable<T>(CalculationIssue issue) => Unavailable<T>(
        issue is null ? throw new ArgumentNullException(nameof(issue)) : new[] { issue });
}

/// <summary>One fitted module reduced to the contributions an aggregate needs.</summary>
/// <param name="Mass">The post-engineering mass, in tonnes.</param>
public sealed record LoadoutCalculationModule(double Mass)
{
    /// <summary>The cargo tonnes, on a cargo rack and nothing else.</summary>
    public double? CargoCapacity { get; init; }

    /// <summary>The berths, on a passenger cabin and nothing else.</summary>
    public double? CabinCapacity { get; init; }

    /// <summary>The fuel tonnes, on a fuel tank and nothing else.</summary>
    public double? FuelCapacity { get; init; }
}

/// <summary>The four aggregate sums a build reports.</summary>
/// <remarks>
/// These read already-resolved module contributions, so they load no catalogue. Every
/// contribution is a known number, because a record missing one is refused long before it
/// reaches a build, which is why each of these answers its figure outright.
/// </remarks>
public static class LoadoutCalculations
{
    /// <summary>Adds the hull and the fitted modules together.</summary>
    /// <param name="hullMass">The empty hull's mass, in tonnes.</param>
    /// <param name="modules">The resolved fitted-module contributions.</param>
    /// <returns>The unladen mass, in tonnes.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="modules"/> is <see langword="null"/>.</exception>
    public static double UnladenMass(double hullMass, IReadOnlyList<LoadoutCalculationModule> modules)
    {
        if (modules is null) throw new ArgumentNullException(nameof(modules));

        double value = hullMass;
        foreach (LoadoutCalculationModule module in modules) value += module.Mass;
        return value;
    }

    /// <summary>Adds up the fitted cargo racks.</summary>
    /// <param name="modules">The resolved fitted-module contributions.</param>
    /// <returns>The cargo capacity in tonnes. A build with no rack carries none.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="modules"/> is <see langword="null"/>.</exception>
    public static double CargoCapacity(IReadOnlyList<LoadoutCalculationModule> modules)
    {
        if (modules is null) throw new ArgumentNullException(nameof(modules));

        double value = 0;
        foreach (LoadoutCalculationModule module in modules) value += module.CargoCapacity ?? 0;
        return value;
    }

    /// <summary>Adds up the fitted passenger cabins.</summary>
    /// <param name="modules">The resolved fitted-module contributions.</param>
    /// <returns>The passenger capacity, in berths. A build with no cabin carries none.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="modules"/> is <see langword="null"/>.</exception>
    public static double PassengerCapacity(IReadOnlyList<LoadoutCalculationModule> modules)
    {
        if (modules is null) throw new ArgumentNullException(nameof(modules));

        double value = 0;
        foreach (LoadoutCalculationModule module in modules) value += module.CabinCapacity ?? 0;
        return value;
    }

    /// <summary>Adds the fitted fuel tanks to the hull's reserve.</summary>
    /// <param name="reserveFuelCapacity">The hull's reserve, in tonnes.</param>
    /// <param name="modules">The resolved fitted-module contributions.</param>
    /// <returns>The main and the reserve capacity, in tonnes. No fitted tank is a main of nothing.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="modules"/> is <see langword="null"/>.</exception>
    public static LoadoutFuelCapacity FuelCapacity(
        double reserveFuelCapacity,
        IReadOnlyList<LoadoutCalculationModule> modules)
    {
        if (modules is null) throw new ArgumentNullException(nameof(modules));

        double main = 0;
        foreach (LoadoutCalculationModule module in modules) main += module.FuelCapacity ?? 0;
        return new LoadoutFuelCapacity(main, reserveFuelCapacity);
    }

    /// <summary>Reports a fitted module a metric could not read.</summary>
    internal static CalculationIssue ModuleIssue(
        CalculationField field,
        CalculationIssueReason reason,
        string message,
        string? slot = null,
        string? symbol = null) =>
        new(field, reason, message) { Slot = slot, Symbol = symbol };

    /// <summary>Reports a module a metric needs and the build does not fit.</summary>
    internal static CalculationIssue NotFitted(CalculationField field, string what) => new(
        field,
        CalculationIssueReason.Missing,
        string.Format(CultureInfo.InvariantCulture, "The build fits no {0}.", what));
}
