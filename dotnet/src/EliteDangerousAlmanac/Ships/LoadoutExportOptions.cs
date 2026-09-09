namespace EliteDangerousAlmanac.Ships;

/// <summary>The order an export writes a build's modules in.</summary>
public enum LoadoutModuleOrder
{
    /// <summary>
    /// The order the build carries: an import's own module order, or the order modules were
    /// fitted.
    /// </summary>
    Fitted,

    /// <summary>
    /// Outfitting-panel order. A module in a mount the hull's layout does not describe keeps
    /// its relative position at the end rather than being dropped.
    /// </summary>
    Slots,
}

/// <summary>Which credits an export quotes.</summary>
public enum LoadoutCredits
{
    /// <summary>
    /// The catalogue's own prices: the bare hull, every fitted module's list price, and a
    /// rebuy of one twentieth of the two.
    /// </summary>
    Retail,

    /// <summary>
    /// The source purchase record, exactly as the capture stated it, and nothing at all for a
    /// build that has no such record.
    /// </summary>
    Source,
}

/// <summary>How to shape a build on the way out.</summary>
/// <remarks>
/// Each figure a source purchase quotes stays pinned to what it was paid for, so a fit that
/// stops matching the capture narrows the export rather than staling it: a swapped mount
/// exports unpriced, and the modules value and the rebuy go once any priced module has been
/// swapped or removed, or a core internal was stocked at import. The hull price names no mount
/// and always stands.
/// </remarks>
public sealed record LoadoutExportOptions
{
    /// <summary>The order to write the modules in.</summary>
    public LoadoutModuleOrder ModuleOrder { get; init; } = LoadoutModuleOrder.Fitted;

    /// <summary>
    /// Whether to write an enabled flag and a power band on modules that carry neither, as a
    /// journal always does and a build assembled here never does.
    /// </summary>
    /// <remarks>
    /// It is off by default, following SLEF's rule to require what is necessary and not force
    /// the rest.
    /// </remarks>
    public bool ExplicitPower { get; init; }

    /// <summary>Which credits to quote.</summary>
    public LoadoutCredits Credits { get; init; } = LoadoutCredits.Retail;
}

/// <summary>The export options, plus the SLEF envelope.</summary>
/// <param name="Header">
/// The envelope header identifying the exporting application. SLEF attribution belongs to the
/// application producing the export, not to this calculation library, so a caller supplies it.
/// </param>
public sealed record SlefExportOptions(SlefHeader Header)
{
    /// <summary>Spaces per indent. Zero, the default, is compact.</summary>
    public int Indent { get; init; }

    /// <summary>The order to write the modules in.</summary>
    public LoadoutModuleOrder ModuleOrder { get; init; } = LoadoutModuleOrder.Fitted;

    /// <summary>Whether to write an enabled flag and a power band on modules carrying neither.</summary>
    public bool ExplicitPower { get; init; }

    /// <summary>Which credits to quote.</summary>
    public LoadoutCredits Credits { get; init; } = LoadoutCredits.Retail;

    /// <summary>The shape options this envelope carries.</summary>
    public LoadoutExportOptions Shape => new()
    {
        ModuleOrder = ModuleOrder,
        ExplicitPower = ExplicitPower,
        Credits = Credits,
    };
}
