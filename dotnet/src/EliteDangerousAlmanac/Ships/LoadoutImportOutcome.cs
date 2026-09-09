namespace EliteDangerousAlmanac.Ships;

/// <summary>What an import did to one mount, or what reading it took of one.</summary>
public enum LoadoutImportAction
{
    /// <summary>An article no catalogue resolves was removed, no stock replacement applying.</summary>
    Emptied,

    /// <summary>The hull's stock article was installed in a mount an import keeps filled.</summary>
    Defaulted,

    /// <summary>A stated recipe could not be rolled, so the module keeps unengineered figures.</summary>
    UnresolvedEngineering,

    /// <summary>An identity-only block was rolled while a catalogued article answers to it too.</summary>
    AmbiguousEngineering,

    /// <summary>A modifier block that moved nothing was replaced by the recipe stated beside it.</summary>
    RerolledEngineering,
}

/// <summary>One change an import made while reading a capture against the catalogues.</summary>
/// <remarks>
/// A removable mount is emptied of an article the catalogue cannot resolve, while armour, a
/// core internal, the cargo hatch and the planetary approach suite take the hull's stock
/// article whenever the source left none they can hold. The three engineering outcomes report
/// how a stated recipe was read.
/// </remarks>
public abstract record LoadoutImportOutcome
{
    private protected LoadoutImportOutcome(LoadoutImportAction action, string slot)
    {
        Action = action;
        Slot = slot;
    }

    /// <summary>Which change or reading this is.</summary>
    public LoadoutImportAction Action { get; }

    /// <summary>The mount key, in the imported build's own spelling.</summary>
    public string Slot { get; }
}

/// <summary>An article the catalogues do not resolve was removed from a removable mount.</summary>
/// <param name="Slot">The mount key, in the imported build's own spelling.</param>
/// <param name="SourceSymbol">The unresolved module identity the source named.</param>
public sealed record ModuleEmptied(string Slot, string SourceSymbol)
    : LoadoutImportOutcome(LoadoutImportAction.Emptied, Slot);

/// <summary>The hull's stock article was installed in a mount an import keeps filled.</summary>
/// <param name="Slot">The mount key, in the normalized build's own spelling.</param>
/// <param name="SourceSymbol">
/// The identity the mount refused, or <see langword="null"/> when the source named nothing
/// there at all.
/// </param>
/// <param name="ReplacementSymbol">The stock module installed in the mount.</param>
public sealed record ModuleDefaulted(string Slot, string? SourceSymbol, string ReplacementSymbol)
    : LoadoutImportOutcome(LoadoutImportAction.Defaulted, Slot);

/// <summary>
/// The source stated engineering with no modifiers, and what it named could not be rolled, so
/// the module keeps the figures of an unengineered one.
/// </summary>
/// <param name="Slot">The mount key, in the imported build's own spelling.</param>
/// <param name="SourceSymbol">The module identity the recipe was stated for.</param>
/// <param name="BlueprintSymbol">The recipe the source named, in its own spelling.</param>
/// <remarks>
/// An unknown or unoffered blueprint, an unoffered experimental effect, a grade or a quality
/// outside the recipe, and a base stat the catalogues do not carry all read this way.
/// </remarks>
public sealed record EngineeringUnresolved(string Slot, string SourceSymbol, string BlueprintSymbol)
    : LoadoutImportOutcome(LoadoutImportAction.UnresolvedEngineering, Slot);

/// <summary>
/// The source stated a recipe and no modifiers, and both readings of that identity are
/// legitimate. The roll was fitted, because that is what nearly every such block is.
/// </summary>
/// <param name="Slot">The mount key, in the imported build's own spelling.</param>
/// <param name="SourceSymbol">The module identity the recipe was stated for.</param>
/// <param name="BlueprintSymbol">The recipe the source named, in its own spelling.</param>
/// <param name="PreEngineeredVariant">
/// The catalogued article the same block describes just as well, which was passed over. Fit it
/// to take that reading instead.
/// </param>
public sealed record EngineeringAmbiguous(
    string Slot,
    string SourceSymbol,
    string BlueprintSymbol,
    PreEngineeredVariant PreEngineeredVariant)
    : LoadoutImportOutcome(LoadoutImportAction.AmbiguousEngineering, Slot);

/// <summary>
/// The source stated modifiers that move no stat this module has, and named no catalogued
/// article, so the recipe stated beside them was rolled in their place.
/// </summary>
/// <param name="Slot">The mount key, in the imported build's own spelling.</param>
/// <param name="SourceSymbol">The module identity the recipe was stated for.</param>
/// <param name="BlueprintSymbol">The recipe the source named, in its own spelling.</param>
/// <remarks>
/// An empty modifier list, and labels the catalogues model nothing for, both read this way.
/// Without the reroll the module would publish unengineered figures while reporting that it is
/// engineered. The source's own modifier block is gone from the build.
/// </remarks>
public sealed record EngineeringRerolled(string Slot, string SourceSymbol, string BlueprintSymbol)
    : LoadoutImportOutcome(LoadoutImportAction.RerolledEngineering, Slot);
