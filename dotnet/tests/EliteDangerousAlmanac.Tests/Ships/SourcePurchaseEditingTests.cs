using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What an export writes once a captured build is edited.</summary>
/// <remarks>
/// A captured credit figure names what a commander paid for the article that was fitted.
/// An edit that takes that article out makes the figure stale, so the export drops it. An
/// edit that leaves every priced article aboard leaves the figures standing. The fixture
/// pins both directions on real captures, edit by edit.
/// </remarks>
public class SourcePurchaseEditingTests
{
    private static readonly SourcePurchaseFixture Fixture =
        SharedFixtures.Load<SourcePurchaseFixture>("fixtures/ships/source-purchase.jsonc");

    public static TheoryData<string, string> Scenarios()
    {
        TheoryData<string, string> cases = [];
        foreach (KeyValuePair<string, EditedExportGroupFixture> group in Fixture.EditedExports.Groups)
        {
            foreach (string name in group.Value.Scenarios.Keys) cases.Add(group.Key, name);
        }

        return cases;
    }

    [Theory]
    [MemberData(nameof(Scenarios))]
    public void AnEditedCaptureExportsOnlyTheCreditsThatStillHold(string capture, string scenario)
    {
        EditedExportScenarioFixture stated =
            Fixture.EditedExports.Groups[capture].Scenarios[scenario];
        ShipLoadout build = Build(capture);
        SourcePurchaseRecord record = build.SourcePurchase!;

        foreach (BuildEditFixture edit in stated.Edits) Apply(build, edit);
        LoadoutEvent exported = build.ToLoadoutEvent(
            new LoadoutExportOptions { Credits = LoadoutCredits.Source });

        Assert.Equal(stated.TopLevelCredits, Credits(exported));

        Dictionary<string, double> priced = PricedSlots(exported);
        List<string> dropped = [];
        Dictionary<string, double> kept = [];
        foreach (SourceModuleValue mount in record.ModuleValues)
        {
            if (priced.ContainsKey(mount.Slot)) kept[mount.Slot] = mount.Value;
            else dropped.Add(mount.Slot);
        }

        Assert.Equal(stated.UnpricedSlots, dropped);

        // Every mount still holding the article the capture priced keeps its figure, and
        // nothing else carries one at all.
        Assert.Equal(kept, priced);

        foreach (string slot in stated.UnpricedNewSlots ?? [])
        {
            LoadoutModule fitted = Fitted(exported, slot);
            Assert.Null(fitted.Value);
        }

        // And the record itself is the one the build arrived with, throughout.
        Assert.Same(record, build.SourcePurchase);
    }

    /// <summary>Reads the capture one group starts from, real or hand-written.</summary>
    private static ShipLoadout Build(string capture)
    {
        if (Fixture.Captures.TryGetValue(capture, out SourceCaptureFixture? real))
        {
            using JsonDocument document = SharedFixtures.LoadDocument(real.Build);
            return ShipLoadout.FromLoadout(Slef.Parse(document.RootElement)[0].Data);
        }

        return ShipLoadout.FromLoadout(Fixture.SyntheticCaptures[capture].Event.ToLoadout());
    }

    private static void Apply(ShipLoadout build, BuildEditFixture edit)
    {
        if (edit.SetModule is SetModuleEditFixture fit)
        {
            build.SetModule(fit.Slot, ModuleCatalogue.FindBySymbol(fit.Symbol)!);
            return;
        }

        if (edit.RemoveModule is RemoveModuleEditFixture empty)
        {
            build.RemoveModule(empty.Slot);
            return;
        }

        ApplyBlueprintEditFixture engineer = edit.ApplyBlueprint!;
        build.ApplyBlueprint(
            engineer.Slot, engineer.Blueprint, new ApplyBlueprintOptions(engineer.Grade));
    }

    /// <summary>The credits one exported event states, by the journal's own field names.</summary>
    private static Dictionary<string, double> Credits(LoadoutEvent exported)
    {
        Dictionary<string, double> credits = [];
        if (exported.HullValue is double hull) credits["HullValue"] = hull;
        if (exported.ModulesValue is double modules) credits["ModulesValue"] = modules;
        if (exported.Rebuy is double rebuy) credits["Rebuy"] = rebuy;
        return credits;
    }

    private static Dictionary<string, double> PricedSlots(LoadoutEvent exported)
    {
        Dictionary<string, double> priced = [];
        foreach (LoadoutModule module in exported.Modules)
        {
            if (module.Value is double value) priced[module.Slot] = value;
        }

        return priced;
    }

    private static LoadoutModule Fitted(LoadoutEvent exported, string slot)
    {
        foreach (LoadoutModule module in exported.Modules)
        {
            if (module.Slot == slot) return module;
        }

        Assert.Fail($"The export holds no mount '{slot}'.");
        return null!;
    }
}
