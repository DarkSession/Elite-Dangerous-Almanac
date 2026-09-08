using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/source-purchase.jsonc</c>.</summary>
internal sealed class SourcePurchaseFixture
{
    /// <summary>The record each real capture in the corpus must report, keyed by build name.</summary>
    public Dictionary<string, SourceCaptureFixture> Captures { get; set; } = [];

    /// <summary>
    /// Hand-written events for the shapes the corpus holds no example of, keyed by case name.
    /// </summary>
    public Dictionary<string, SyntheticCaptureFixture> SyntheticCaptures { get; set; } = [];
}

/// <summary>One real capture and the record it carries.</summary>
internal sealed class SourceCaptureFixture
{
    /// <summary>The fixture path of the capture itself.</summary>
    public string Build { get; set; } = string.Empty;

    public SourceRecordFixture Record { get; set; } = new();

    /// <summary>What an export that quotes the captured figures writes.</summary>
    public SourceExportFixture SourceExport { get; set; } = new();
}

/// <summary>One hand-written event and the record it produces.</summary>
internal sealed class SyntheticCaptureFixture
{
    public SyntheticEventFixture Event { get; set; } = new();

    /// <summary>The record, or absent where the event states no credit figure at all.</summary>
    public SourceRecordFixture? Record { get; set; }
}

/// <summary>A hand-written <c>Loadout</c> event, in the journal's own spelling.</summary>
internal sealed class SyntheticEventFixture
{
    public string Ship { get; set; } = string.Empty;

    public double? HullValue { get; set; }

    public double? ModulesValue { get; set; }

    public double? Rebuy { get; set; }

    public List<SyntheticModuleFixture> Modules { get; set; } = [];

    /// <summary>The event as the library's own record shape.</summary>
    public LoadoutEvent ToLoadout()
    {
        List<LoadoutModule> modules = new(Modules.Count);
        foreach (SyntheticModuleFixture module in Modules)
        {
            modules.Add(new LoadoutModule(module.Slot, module.Item) { Value = module.Value });
        }

        return new LoadoutEvent(Ship, modules)
        {
            HullValue = HullValue,
            ModulesValue = ModulesValue,
            Rebuy = Rebuy,
        };
    }
}

/// <summary>One fitted module of a hand-written event.</summary>
internal sealed class SyntheticModuleFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Item { get; set; } = string.Empty;

    public double? Value { get; set; }
}

/// <summary>The credit figures one capture must report.</summary>
internal sealed class SourceRecordFixture
{
    public double? HullValue { get; set; }

    public double? ModulesValue { get; set; }

    public double? Rebuy { get; set; }

    public int ModuleCount { get; set; }

    /// <summary>The sum of the individually priced mounts.</summary>
    public double PricedModulesValue { get; set; }

    public List<SourceModuleValueFixture> ModuleValues { get; set; } = [];
}

/// <summary>One mount's captured price.</summary>
internal sealed class SourceModuleValueFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Item { get; set; } = string.Empty;

    public double Value { get; set; }
}

/// <summary>The figures an export that quotes the capture writes.</summary>
internal sealed class SourceExportFixture
{
    public TopLevelCreditsFixture? TopLevelCredits { get; set; }

    /// <summary>The captured price of each mount the source priced, by mount key.</summary>
    public Dictionary<string, double> PricedSlots { get; set; } = [];
}

/// <summary>The three figures an export writes above the modules.</summary>
internal sealed class TopLevelCreditsFixture
{
    public double? HullValue { get; set; }

    public double? ModulesValue { get; set; }

    public double? Rebuy { get; set; }
}
