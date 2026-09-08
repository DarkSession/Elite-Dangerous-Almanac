using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>A fitted ship a caller holds and edits.</summary>
/// <remarks>
/// <para>
/// Read one from a SLEF export or a journal loadout event, or start from a stock or an empty
/// hull, then enumerate the mounts and fit modules. An edit changes the build in place and
/// answers the same build, so read a query again after an edit rather than re-reading an
/// earlier answer.
/// </para>
/// <para>
/// What a build calculates lives next door, on <see cref="BuildMetrics"/> over the same build.
/// </para>
/// <para>
/// A mount key is matched without regard to case, and with surrounding whitespace ignored.
/// Frontier writes one spelling and a SLEF producer may write another, and both name the same
/// mount. A build's own spelling is never rewritten, so re-exporting an import answers it
/// untouched.
/// </para>
/// </remarks>
public sealed partial class ShipLoadout
{
    private readonly Ship ship;
    private readonly List<LoadoutModule> modules;
    private readonly Dictionary<string, OutfittingModule> moduleStats;
    private readonly Dictionary<string, IReadOnlyList<EngineeringModifier>> primitiveModifiers;
    private readonly TopFigures top;
    private readonly List<LoadoutImportOutcome> importOutcomes;
    private readonly Dictionary<int, IReadOnlyList<LoadoutSlot>> slotCache = [];
    private IReadOnlyList<BuildSlot>? layoutCache;

    private ShipLoadout(
        Ship ship,
        string shipSymbol,
        List<LoadoutModule> modules,
        TopFigures top,
        SourcePurchaseRecord? sourcePurchase = null,
        Dictionary<string, OutfittingModule>? moduleStats = null,
        Dictionary<string, IReadOnlyList<EngineeringModifier>>? primitiveModifiers = null,
        List<LoadoutImportOutcome>? importOutcomes = null)
    {
        this.ship = ship;
        ShipSymbol = shipSymbol;
        this.modules = modules;
        this.top = top;
        SourcePurchase = sourcePurchase;
        this.moduleStats = moduleStats ?? new Dictionary<string, OutfittingModule>(StringComparer.Ordinal);
        this.primitiveModifiers = primitiveModifiers
            ?? new Dictionary<string, IReadOnlyList<EngineeringModifier>>(StringComparer.Ordinal);
        this.importOutcomes = importOutcomes ?? [];
    }

    /// <summary>The figures a build states for the ship as a whole, which an edit changes.</summary>
    private sealed class TopFigures
    {
        internal string? ShipName { get; set; }

        internal string? ShipIdent { get; set; }

        internal double? HullValue { get; set; }

        internal double? ModulesValue { get; set; }

        internal double? Rebuy { get; set; }

        internal double? UnladenMass { get; set; }

        internal double? CargoCapacity { get; set; }

        internal LoadoutFuelCapacity? FuelCapacity { get; set; }

        internal static TopFigures From(ImportedTopFigures imported) => new()
        {
            ShipName = imported.ShipName,
            ShipIdent = imported.ShipIdent,
            HullValue = imported.HullValue,
            ModulesValue = imported.ModulesValue,
            Rebuy = imported.Rebuy,
            UnladenMass = Weighable(imported.UnladenMass),
            CargoCapacity = Weighable(imported.CargoCapacity),
            FuelCapacity = imported.FuelCapacity,
        };
    }

    /// <summary>Keeps a mass only where it can be weighed.</summary>
    /// <remarks>
    /// A capture states its own mass, and an engineering modifier its own value, and a build
    /// copies both without judging them, so either can reach a report as a negative or as a
    /// figure that is not a number. Validation refuses a figure it cannot weigh, and a refusal
    /// is the wrong answer from the one method whose job is to describe what is wrong with a
    /// build. The figure is dropped instead and the structure checked alone; a mass nobody can
    /// weigh is still reported, as a thrown figure, by whichever metric goes on to read it.
    /// </remarks>
    private static double? Weighable(double? tonnes) =>
        tonnes is double stated && !double.IsNaN(stated) && !double.IsInfinity(stated) && stated >= 0
            ? stated
            : null;

    /// <summary>The hull's internal identifier.</summary>
    public string ShipSymbol { get; }

    /// <summary>The prices a capture stated, where it stated any.</summary>
    /// <remarks>
    /// It is the commander's own purchase record, at whatever discount the station gave. Read
    /// <see cref="BuildMetrics.BuildCost"/> for the catalogue's retail prices instead.
    /// </remarks>
    public SourcePurchaseRecord? SourcePurchase { get; }

    /// <summary>Reads a build from a SLEF export.</summary>
    /// <param name="json">The SLEF JSON text.</param>
    /// <param name="index">Which entry to take where the export holds several builds.</param>
    /// <returns>The build for that entry.</returns>
    /// <remarks>
    /// Module normalization follows <see cref="FromLoadout"/>. Read
    /// <see cref="ImportOutcomes"/> for the mounts that were emptied or stocked, and for the
    /// engineering the import could not resolve.
    /// </remarks>
    /// <exception cref="JsonException">The text is not valid JSON.</exception>
    /// <exception cref="ArgumentNullException"><paramref name="json"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The export holds no entry at that index.</exception>
    /// <exception cref="FormatException">The entry names a hull the catalogue does not carry.</exception>
    public static ShipLoadout FromSlef(string json, int index = 0) =>
        FromEntries(Slef.Parse(json), index);

    /// <summary>Reads a build from an already-read SLEF export.</summary>
    /// <param name="slef">The export entries.</param>
    /// <param name="index">Which entry to take where the export holds several builds.</param>
    /// <returns>The build for that entry.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="slef"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The export holds no entry at that index.</exception>
    /// <exception cref="FormatException">The entry names a hull the catalogue does not carry.</exception>
    public static ShipLoadout FromSlef(IReadOnlyList<SlefEntry> slef, int index = 0)
    {
        if (slef is null) throw new ArgumentNullException(nameof(slef));

        return FromEntries(slef, index);
    }

    private static ShipLoadout FromEntries(IReadOnlyList<SlefEntry> entries, int index)
    {
        if (index < 0 || index >= entries.Count)
        {
            throw new ArgumentOutOfRangeException(
                nameof(index),
                index,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "The export holds {0} entries.",
                    entries.Count));
        }

        return FromImported(LoadoutImport.Normalize(entries[index].Data));
    }

    /// <summary>Reads a build from a journal loadout event.</summary>
    /// <param name="capture">The event.</param>
    /// <returns>The build.</returns>
    /// <remarks>
    /// <para>
    /// Capture and instance state stay out of the durable build, as does engineering
    /// provenance. A pre-engineered article is identified where the capture's evidence names
    /// one, and the catalogue's stat block then supplies the values the capture leaves out; the
    /// capture's own modifiers stay authoritative over it.
    /// </para>
    /// <para>
    /// A recipe stated without modifiers is rolled. A journal writes the modifier block beside
    /// the recipe, and SLEF permits stating the recipe alone, so such a block is spelled out
    /// here at the grade and the quality it states. Otherwise the module would report that it is
    /// engineered while publishing the figures of one that is not.
    /// </para>
    /// <para>
    /// A stated modifier block that moves nothing is replaced by the roll. A block naming only
    /// stats the module has no value for describes some other module. Every block that moves at
    /// least one stat this module carries stays exactly as the source wrote it: a capture's own
    /// figures are what the game reported, and outrank anything recomputed here.
    /// </para>
    /// <para>
    /// Normalization makes the captured figures untrustworthy, so they are dropped and
    /// recomputed from the fit that remains. A mount stocked from absence is the exception and
    /// every figure stands.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException">A field a build is assembled from is absent.</exception>
    /// <exception cref="ArgumentException">Two modules name one mount.</exception>
    /// <exception cref="FormatException">The event names a hull the catalogue does not carry.</exception>
    public static ShipLoadout FromLoadout(LoadoutEvent capture) =>
        FromImported(LoadoutImport.Normalize(capture));

    /// <summary>Assembles already-normalized state, and resolves the hull.</summary>
    private static ShipLoadout FromImported(ImportedLoadoutState imported)
    {
        Ship ship = ShipCatalogue.FindBySymbol(imported.ShipSymbol)
            ?? throw new FormatException(string.Format(
                CultureInfo.InvariantCulture,
                "The catalogue carries no hull \"{0}\".",
                TextPreview.Truncate(imported.ShipSymbol)));

        ImportedTopFigures stated = imported.Top;
        ShipLoadout build = new(
            ship,
            imported.ShipSymbol,
            [.. imported.Modules],
            TopFigures.From(stated),
            imported.SourcePurchase,
            new Dictionary<string, OutfittingModule>(
                (IDictionary<string, OutfittingModule>)imported.ModuleStats, StringComparer.Ordinal),
            new Dictionary<string, IReadOnlyList<EngineeringModifier>>(
                (IDictionary<string, IReadOnlyList<EngineeringModifier>>)imported.PrimitiveModifiers,
                StringComparer.Ordinal),
            [.. imported.Outcomes]);

        foreach (LoadoutModule module in imported.Modules)
        {
            if (build.RollStatedRecipe(module) is LoadoutImportOutcome unresolved)
            {
                build.importOutcomes.Add(unresolved);
            }
        }

        // A roll spells out figures the capture already counted, so the figures it stated stand.
        // The editor path a roll goes through carries the mass and capacity bookkeeping an edit
        // needs, which here would subtract the engineering delta a second time from a figure the
        // game weighed with it in place.
        build.top.UnladenMass = Weighable(stated.UnladenMass);
        build.top.CargoCapacity = Weighable(stated.CargoCapacity);
        build.top.FuelCapacity = stated.FuelCapacity;
        return build;
    }

    /// <summary>Starts a build on a hull carrying only the modules it cannot fly without.</summary>
    /// <param name="shipSymbol">The hull's symbol. Case and surrounding whitespace are ignored.</param>
    /// <returns>
    /// A build on the hull's stock bulkhead, core internals and cargo hatch, with every
    /// hardpoint, utility mount and optional internal left open.
    /// </returns>
    /// <remarks>Read <see cref="Default"/> for a build that also carries the stock fit.</remarks>
    /// <exception cref="ArgumentException">The catalogue carries no such hull.</exception>
    public static ShipLoadout Empty(string shipSymbol)
    {
        Ship ship = RequireShip(shipSymbol, nameof(shipSymbol));

        // The mounts a build cannot fly without, from the same hull defaults an import stocks
        // them from. An import stocks the approach suite too; this factory leaves it open along
        // with every other optional mount.
        List<LoadoutModule> fitted = [];
        foreach (DefaultLoadoutModule module in DefaultLoadouts.Find(ship.Symbol)?.Modules ?? [])
        {
            ParsedSlot? parsed = BuildSlots.ParseName(module.Slot);
            if (parsed is not null && LoadoutSlotRules.FixedReason(parsed.Kind) is not null)
            {
                fitted.Add(new LoadoutModule(module.Slot, module.Symbol));
            }
        }

        return new ShipLoadout(ship, ship.Symbol, fitted, new TopFigures());
    }

    /// <summary>Starts a build carrying the modules a stock ship is supplied with.</summary>
    /// <param name="shipSymbol">The hull's symbol. Case and surrounding whitespace are ignored.</param>
    /// <returns>A complete, ready-to-edit stock build.</returns>
    /// <exception cref="ArgumentException">The catalogue carries no such hull.</exception>
    public static ShipLoadout Default(string shipSymbol)
    {
        Ship ship = RequireShip(shipSymbol, nameof(shipSymbol));
        DefaultLoadout stock = DefaultLoadouts.Find(ship.Symbol)!;

        List<LoadoutModule> fitted = new(stock.Modules.Count);
        foreach (DefaultLoadoutModule module in stock.Modules)
        {
            fitted.Add(new LoadoutModule(module.Slot, module.Symbol));
        }

        return new ShipLoadout(ship, stock.Symbol, fitted, new TopFigures());
    }

    private static Ship RequireShip(string shipSymbol, string parameter)
    {
        if (shipSymbol is null) throw new ArgumentNullException(parameter);

        return ShipCatalogue.FindBySymbol(shipSymbol)
            ?? throw new ArgumentException(
                string.Format(
                    CultureInfo.InvariantCulture,
                    "The catalogue carries no hull \"{0}\".",
                    TextPreview.Truncate(shipSymbol)),
                parameter);
    }
}
