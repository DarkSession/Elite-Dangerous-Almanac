using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <content>What a build writes back out.</content>
public sealed partial class ShipLoadout
{
    /// <summary>This build as a journal loadout event, which is the data half of a SLEF entry.</summary>
    /// <param name="options">The module order, how sparse to be about power, and which prices.</param>
    /// <returns>A new event.</returns>
    /// <remarks>
    /// <para>
    /// Every top-level figure is computed from the hull and the fitted modules rather than echoed
    /// from what an import supplied, the credits being the one exception a caller can ask for. A
    /// figure the build cannot work out is left out rather than written as a stale or a zero
    /// value, because SLEF requires nothing beyond the hull and the modules.
    /// </para>
    /// <para>
    /// Prices are quoted at retail: the bare hull's price plus every fitted module's catalogue
    /// price, with the rebuy a twentieth of the two. A capture's own figures record one
    /// commander's purchase history rather than a property of the build, so they are quoted only
    /// where the options ask for them, as provenance rather than as a price.
    /// </para>
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="options"/> is <see langword="null"/>.</exception>
    public LoadoutEvent ToLoadoutEvent(LoadoutExportOptions? options = null)
    {
        LoadoutExportOptions shape = options ?? new LoadoutExportOptions();
        double mass = ComputedUnladenMass();
        double cargo = LoadoutCalculations.CargoCapacity(CalculationModules());
        LoadoutFuelCapacity fuel =
            LoadoutCalculations.FuelCapacity(ship.ReserveFuelCapacity, CalculationModules());

        Internal.LoadoutExportInput input = new(
            ShipSymbol,
            modules,
            Layout(),
            SourcePurchase,
            ship.HullCost,
            mass,
            cargo,
            fuel,
            ExportableJumpRange(mass, fuel),
            StatsFor)
        {
            ShipName = top.ShipName,
            ShipIdent = top.ShipIdent,
            SourceTotalsVoided = StockedCoreFromAbsence(),
        };
        return Internal.LoadoutExport.Event(input, shape);
    }

    /// <summary>This build as a one-entry SLEF export.</summary>
    /// <param name="options">The envelope header, the module order and which prices.</param>
    /// <returns>The export.</returns>
    /// <remarks>
    /// Several builds travel together in one export. Wrap their events with
    /// <see cref="Slef.Wrap(IReadOnlyList{LoadoutEvent}, SlefHeader)"/> instead.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="options"/> is <see langword="null"/>.</exception>
    public IReadOnlyList<SlefEntry> ToSlef(SlefExportOptions options)
    {
        if (options is null) throw new ArgumentNullException(nameof(options));
        return Slef.Wrap(ToLoadoutEvent(options.Shape), options.Header);
    }

    /// <summary>This build as SLEF text, ready to write to a file or put on the clipboard.</summary>
    /// <param name="options">As the export, plus the indent. It is compact by default.</param>
    /// <returns>The export as text.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="options"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The indent is outside 0 to 127 spaces.</exception>
    public string ToSlefString(SlefExportOptions options)
    {
        if (options is null) throw new ArgumentNullException(nameof(options));
        IReadOnlyList<SlefEntry> entries = ToSlef(options);
        return options.Indent == 0 ? Slef.Stringify(entries) : Slef.Stringify(entries, options.Indent);
    }

    /// <summary>The jump range an export can state, or <see langword="null"/> where it cannot.</summary>
    /// <remarks>
    /// This is one jump on a full tank with no cargo, off the recomputed mass and tank rather
    /// than off anything an import supplied. A supplied drive record with no jump constants is
    /// left out rather than allowed to fail the export.
    /// </remarks>
    private double? ExportableJumpRange(double mass, LoadoutFuelCapacity fuel)
    {
        FrameShiftDriveParams? drive;
        try
        {
            drive = ResolveDrive();
        }
        catch (InvalidOperationException)
        {
            return null;
        }

        return drive is null ? null : JumpRange.SingleJump(mass, Math.Min(fuel.Main, drive.MaxFuel), drive);
    }

    /// <summary>Whether an import stocked a core internal the capture named nothing for.</summary>
    /// <remarks>
    /// Such an article is aboard that nobody paid for, and comparing the priced mounts cannot see
    /// it, because the capture has no entry to disagree with. A stock bulkhead or hatch costs
    /// nothing and a stocked approach suite too little to void a purchase record over, so none of
    /// those three moves the totals. The mounts are classified the same way the import stocks
    /// them, so the two cannot drift apart.
    /// </remarks>
    private bool StockedCoreFromAbsence()
    {
        foreach (LoadoutImportOutcome outcome in importOutcomes)
        {
            if (outcome is not ModuleDefaulted { SourceSymbol: null }) continue;

            ParsedSlot? parsed = BuildSlots.ParseName(outcome.Slot);
            if (parsed is null) continue;
            if (Internal.LoadoutSlotRules.StockedMount(parsed.Kind, parsed.Restriction)
                == Internal.StockedMountKind.Core)
            {
                return true;
            }
        }

        return false;
    }
}
