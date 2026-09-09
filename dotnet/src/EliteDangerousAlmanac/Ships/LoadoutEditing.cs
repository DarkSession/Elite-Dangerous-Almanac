using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Why the hull or the build refused an edit.</summary>
public enum LoadoutEditErrorCode
{
    /// <summary>The mount is the cargo hatch, which no edit fills or empties.</summary>
    ImmutableSlot,

    /// <summary>The mount is armour or a core internal, which an operational build keeps filled.</summary>
    RequiredSlot,

    /// <summary>The module does not fit the mount.</summary>
    IncompatibleModule,

    /// <summary>The build already fits a module of the same one-per-ship family.</summary>
    DuplicateExclusiveModule,

    /// <summary>The module would take the build beyond its current allowance.</summary>
    ModuleLimitExceeded,
}

/// <summary>An edit the current hull or build constraints cannot accept.</summary>
/// <remarks>
/// Read <see cref="Code"/>, then <see cref="Constraint"/> and the properties beside it, rather
/// than parsing the English fallback in the message.
/// </remarks>
public class LoadoutEditException : ArgumentException
{
    /// <summary>Builds an exception describing a refused edit.</summary>
    /// <param name="message">The English fallback, fit for a log.</param>
    /// <param name="code">The stable category for the refusal.</param>
    /// <param name="issue">The finding the refusal reports, which names the mount and the module.</param>
    /// <param name="slot">
    /// The mount the refusal is about, where the finding does not already name it.
    /// </param>
    public LoadoutEditException(
        string message,
        LoadoutEditErrorCode code,
        LoadoutIssue? issue = null,
        string? slot = null)
        : base(message)
    {
        Code = code;
        Issue = issue;
        Slot = slot ?? issue?.Slot;
    }

    /// <summary>Builds an exception with the default message for a code.</summary>
    public LoadoutEditException()
        : this("The build refused the edit.", LoadoutEditErrorCode.IncompatibleModule)
    {
    }

    /// <summary>Builds an exception with a message alone.</summary>
    /// <param name="message">The English fallback, fit for a log.</param>
    public LoadoutEditException(string message)
        : this(message, LoadoutEditErrorCode.IncompatibleModule)
    {
    }

    /// <summary>Builds an exception with a message and an inner cause.</summary>
    /// <param name="message">The English fallback, fit for a log.</param>
    /// <param name="innerException">The cause.</param>
    public LoadoutEditException(string message, Exception innerException)
        : base(message, innerException) => Code = LoadoutEditErrorCode.IncompatibleModule;

    /// <summary>The stable category for the refusal.</summary>
    public LoadoutEditErrorCode Code { get; }

    /// <summary>The finding the refusal reports, which names the mount and the module.</summary>
    public LoadoutIssue? Issue { get; }

    /// <summary>The mount the refusal is about.</summary>
    public string? Slot { get; }

    /// <summary>The fitting rule an incompatible module broke, where one is known.</summary>
    public ModuleFitConstraint? Constraint => Issue?.Fit?.Constraint;
}

/// <summary>What a repair did to one mount an operational build keeps filled.</summary>
public enum FixedMountRepairStatus
{
    /// <summary>The hull's stock article was installed.</summary>
    Repaired,

    /// <summary>The mount already held an article it can take.</summary>
    Unchanged,

    /// <summary>The hull states no stock article the mount can take.</summary>
    DefaultUnavailable,

    /// <summary>The named mount is not one an operational build keeps filled.</summary>
    Refused,
}

/// <summary>The outcome of repairing one mount an operational build keeps filled.</summary>
/// <param name="Status">What the repair did.</param>
/// <param name="Slot">
/// The mount key in the build's own spelling, or the request where the build holds no such mount.
/// </param>
/// <param name="Symbol">
/// The article the mount holds afterwards. It is absent where the hull states no stock article,
/// and where the named mount is not one an operational build keeps filled.
/// </param>
public sealed record FixedMountRepair(
    FixedMountRepairStatus Status,
    string Slot,
    string? Symbol = null);

/// <summary>How to roll a blueprint onto a fitted module.</summary>
/// <param name="Grade">The blueprint grade, one through five.</param>
/// <param name="Quality">
/// The engineering system's shared quality roll, from zero through one. It defaults to the best
/// roll. A module engineered under the legacy system advanced its stats independently, and that
/// cannot be reconstructed from one reported quality; import its stated modifiers instead.
/// </param>
/// <param name="ExperimentalEffectSymbol">The experimental effect's symbol, where one applies.</param>
public sealed record ApplyBlueprintOptions(
    int Grade,
    double Quality = 1,
    string? ExperimentalEffectSymbol = null);

/// <summary>Why an engineering edit cannot be made without losing what the build states.</summary>
public enum EngineeringEditCode
{
    /// <summary>The mount holds no module.</summary>
    EmptySlot,

    /// <summary>The fitted module states no engineering.</summary>
    NotEngineered,

    /// <summary>No catalogue carries the named experimental effect.</summary>
    UnknownExperimentalEffect,

    /// <summary>The module's own menu does not offer the named experimental effect.</summary>
    UnsupportedExperimentalEffect,

    /// <summary>The fitted article is final and accepts no further engineering.</summary>
    FinalArticle,

    /// <summary>The stated recipe cannot be rolled on this module.</summary>
    UnsupportedEngineering,

    /// <summary>The fitted article answers to no one catalogue variant.</summary>
    UnidentifiedPreEngineeredVariant,

    /// <summary>The fixed article states a stat the catalogues carry no base for.</summary>
    UnresolvedModifiers,

    /// <summary>The stated quality is not a roll between zero and one.</summary>
    InvalidQuality,
}

/// <summary>What an engineering edit did.</summary>
public enum EngineeringEditKind
{
    /// <summary>The edit changed the fitted module.</summary>
    Updated,

    /// <summary>The build already held what the edit asked for.</summary>
    Unchanged,

    /// <summary>The edit cannot be made without losing what the build states.</summary>
    Unsupported,
}


/// <summary>What a refused engineering edit describes, in language-neutral values.</summary>
/// <remarks>
/// A caller presents a refusal in its own words. These are the values that sentence needs, and
/// every one of them is absent where the refusal does not reach it.
/// </remarks>
public sealed record EngineeringEditDetail
{
    /// <summary>The mount key, in the build's own spelling where it holds one.</summary>
    public string? Slot { get; init; }

    /// <summary>The fitted module's identity.</summary>
    public string? Symbol { get; init; }

    /// <summary>The recipe the fitted module states.</summary>
    public string? BlueprintSymbol { get; init; }

    /// <summary>The grade the fitted module states.</summary>
    public int? Grade { get; init; }

    /// <summary>The experimental effect the edit asked for, or the one the module states.</summary>
    public string? ExperimentalEffectSymbol { get; init; }

    /// <summary>The modifier labels the catalogues carry no base stat for.</summary>
    public IReadOnlyList<string>? UnresolvedLabels { get; init; }
}

/// <summary>The outcome of setting a fitted module's experimental effect.</summary>
/// <param name="Kind">What the edit did.</param>
/// <param name="ExperimentalEffectSymbol">
/// The effect the module carries afterwards, or <see langword="null"/> where it carries none.
/// It is absent on a refusal.
/// </param>
/// <param name="PreviousExperimentalEffectSymbol">
/// The effect the module carried before the edit, on a change alone.
/// </param>
/// <param name="Code">The stable reason for a refusal.</param>
/// <param name="Detail">What a refusal describes, which names the article and the request.</param>
public sealed record ExperimentalEffectEdit(
    EngineeringEditKind Kind,
    string? ExperimentalEffectSymbol = null,
    string? PreviousExperimentalEffectSymbol = null,
    EngineeringEditCode? Code = null,
    EngineeringEditDetail? Detail = null);

/// <summary>The outcome of completing a fitted module's engineering grade.</summary>
/// <param name="Kind">What the edit did.</param>
/// <param name="PreviousQuality">
/// The quality the fitted module reported before the edit, from zero through one. A block that
/// stated no modifiers still reports the quality it stated, so a completed roll whose figures
/// this call was the first to spell out reports the best roll.
/// </param>
/// <param name="Code">The stable reason for a refusal.</param>
/// <param name="Detail">What a refusal describes, which names the engineering identity.</param>
/// <remarks>The quality after a change is always the best roll.</remarks>
public sealed record EngineeringGradeEdit(
    EngineeringEditKind Kind,
    double? PreviousQuality = null,
    EngineeringEditCode? Code = null,
    EngineeringEditDetail? Detail = null);
