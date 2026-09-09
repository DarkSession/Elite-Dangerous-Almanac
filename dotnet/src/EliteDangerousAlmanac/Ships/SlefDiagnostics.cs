using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Why a SLEF entry was rejected.</summary>
public enum SlefDiagnosticCode
{
    /// <summary>The envelope header does not match the header shape.</summary>
    InvalidHeader,

    /// <summary>The entry is not a <c>Loadout</c> event, or one of its own fields is wrong.</summary>
    InvalidLoadout,

    /// <summary>One fitted module does not match the module shape.</summary>
    InvalidModule,

    /// <summary>One engineering block or one of its modifiers does not match its shape.</summary>
    InvalidEngineering,

    /// <summary>Two fitted modules name the same mount.</summary>
    DuplicateSlot,
}

/// <summary>The field-level rule a rejected SLEF value broke.</summary>
/// <remarks>
/// This is what a caller selects a localized message on. The
/// <see cref="SlefDiagnostic.Message"/> beside it is the English reading of the same rule.
/// </remarks>
public enum SlefConstraint
{
    /// <summary>The value must be an object.</summary>
    ObjectRequired,

    /// <summary>The value must be a string.</summary>
    StringRequired,

    /// <summary>The value must be a boolean.</summary>
    BooleanRequired,

    /// <summary>The value must be an array.</summary>
    ArrayRequired,

    /// <summary>The value must be a finite number.</summary>
    FiniteNumberRequired,

    /// <summary>The value must be a finite number of zero or more.</summary>
    NonNegativeNumberRequired,

    /// <summary>The value must be a whole number from 0 to 4.</summary>
    PriorityRange,

    /// <summary>The value must be a whole number from 1 to 5.</summary>
    EngineeringLevelRange,

    /// <summary>The value must be a number from 0 to 1.</summary>
    UnitInterval,

    /// <summary>The value must be 0 or 1.</summary>
    BinaryInteger,

    /// <summary>The value must be a string or a finite number.</summary>
    VersionRequired,

    /// <summary>The value must be the word <c>Loadout</c>.</summary>
    LoadoutEventRequired,

    /// <summary>The value is not a valid <c>Loadout</c> event.</summary>
    ValidLoadoutRequired,

    /// <summary>No two fitted modules may name the same mount.</summary>
    UniqueSlot,
}

/// <summary>One entry a SLEF inspection rejected.</summary>
/// <param name="Index">The entry's own position in the payload, counted from zero.</param>
/// <param name="Code">The category the rejection falls in.</param>
/// <param name="Path">
/// The property path to the rejected value, the entry and module positions included, such as
/// <c>entries[0].data.Modules[3].Priority</c>.
/// </param>
/// <param name="Constraint">The field-level rule the value broke.</param>
/// <param name="Message">The English reading of the rejection.</param>
public sealed record SlefDiagnostic(
    int Index,
    SlefDiagnosticCode Code,
    string Path,
    SlefConstraint Constraint,
    string Message)
{
    /// <summary>
    /// The mount two modules both named, on a duplicate-mount rejection, and
    /// <see langword="null"/> on every other one.
    /// </summary>
    /// <remarks>
    /// It is the mount as the source spelled it, at full length. The name inside
    /// <see cref="SlefDiagnostic.Message"/> is shortened, so read this one to report the mount
    /// itself.
    /// </remarks>
    public string? Slot { get; init; }
}

/// <summary>What a tolerant SLEF inspection found.</summary>
/// <param name="Entries">The valid entries, in the payload's own order.</param>
/// <param name="Diagnostics">One rejection for each rejected entry, in the payload's own order.</param>
public sealed record SlefInspection(
    IReadOnlyList<SlefEntry> Entries,
    IReadOnlyList<SlefDiagnostic> Diagnostics);
