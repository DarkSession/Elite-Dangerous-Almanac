using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>How a module comes to accept a blueprint.</summary>
public enum BlueprintRoute
{
    /// <summary>The module's own engineering menu offers the recipe.</summary>
    Ordinary,

    /// <summary>
    /// The article is sold from the Mercenary shop already carrying the recipe at grade 1, so
    /// the grades above that one can still be added.
    /// </summary>
    Mercenary,
}

/// <summary>One blueprint a fitted module accepts, and the grades it can be rolled at.</summary>
/// <param name="BlueprintSymbol">The recipe identifier, in the catalogue's own spelling.</param>
/// <param name="Grades">The grades whose every stat this module carries a base value for, ascending.</param>
/// <param name="Route">
/// How the module comes to accept the recipe. The shared module symbol cannot say whether the
/// fitted article was bought from the Mercenary shop, so the route is named rather than assumed.
/// </param>
public sealed record AvailableBlueprint(
    string BlueprintSymbol,
    IReadOnlyList<int> Grades,
    BlueprintRoute Route);
