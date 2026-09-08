using System;
using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The credit figures a captured build arrived with.</summary>
public class SourcePurchaseTests
{
    private static readonly SourcePurchaseFixture Fixture =
        SharedFixtures.Load<SourcePurchaseFixture>("fixtures/ships/source-purchase.jsonc");

    public static TheoryData<string> Captures()
    {
        TheoryData<string> names = [];
        foreach (string name in Fixture.Captures.Keys) names.Add(name);
        return names;
    }

    public static TheoryData<string> SyntheticCaptures()
    {
        TheoryData<string> names = [];
        foreach (string name in Fixture.SyntheticCaptures.Keys) names.Add(name);
        return names;
    }

    private static LoadoutEvent Capture(string path)
    {
        using JsonDocument document = SharedFixtures.LoadDocument(path);
        return Slef.Parse(document.RootElement)[0].Data;
    }

    [Theory]
    [MemberData(nameof(Captures))]
    public void ARealCaptureReportsTheCreditsItArrivedWith(string name)
    {
        SourceCaptureFixture stated = Fixture.Captures[name];

        SourcePurchaseRecord record = SourcePurchase.FromLoadout(Capture(stated.Build))!;

        AssertRecord(stated.Record, record);
    }

    [Theory]
    [MemberData(nameof(SyntheticCaptures))]
    public void AHandWrittenCaptureReportsTheCreditsItStates(string name)
    {
        SyntheticCaptureFixture stated = Fixture.SyntheticCaptures[name];

        SourcePurchaseRecord? record = SourcePurchase.FromLoadout(stated.Event.ToLoadout());

        if (stated.Record is null)
        {
            // A record of nothing but absent figures would read as a source that priced the
            // build at nothing.
            Assert.Null(record);
            return;
        }

        AssertRecord(stated.Record, record!);
    }

    [Theory]
    [MemberData(nameof(Captures))]
    public void EveryPricedMountOfARealCaptureIsFoundByItsKey(string name)
    {
        SourceCaptureFixture stated = Fixture.Captures[name];

        SourcePurchaseRecord record = SourcePurchase.FromLoadout(Capture(stated.Build))!;

        foreach (KeyValuePair<string, double> mount in stated.SourceExport.PricedSlots)
        {
            SourceModuleValue found = SourcePurchase.FindModuleValue(record, mount.Key)!;
            Assert.Equal(mount.Value, found.Value);

            // A journal key and a lower-cased export key both resolve, as every identifier
            // lookup in this library does.
            Assert.Equal(
                found,
                SourcePurchase.FindModuleValue(record, "  " + mount.Key.ToUpperInvariant() + "  "));
        }

        Assert.Equal(stated.SourceExport.PricedSlots.Count, record.ModuleValues.Count);
    }

    [Theory]
    [MemberData(nameof(Captures))]
    public void ARealCaptureQuotesItsOwnTopLevelCreditsBack(string name)
    {
        SourceCaptureFixture stated = Fixture.Captures[name];

        SourcePurchaseRecord record = SourcePurchase.FromLoadout(Capture(stated.Build))!;
        TopLevelCreditsFixture credits = stated.SourceExport.TopLevelCredits!;

        Assert.Equal(credits.HullValue, record.HullValue);
        Assert.Equal(credits.ModulesValue, record.ModulesValue);
        Assert.Equal(credits.Rebuy, record.Rebuy);
    }

    [Fact]
    public void AMountThePriceWasNeverStatedForIsAMissAndNotAZero()
    {
        LoadoutEvent capture = Fixture.SyntheticCaptures["partsDoNotAddUp"].Event.ToLoadout();

        SourcePurchaseRecord record = SourcePurchase.FromLoadout(capture)!;

        // The journal states a modules total the priced parts do not add up to. Both figures
        // are reported, so the disagreement stays visible.
        Assert.NotEqual(record.ModulesValue, SourcePurchase.SumModuleValues(record));
        Assert.Null(SourcePurchase.FindModuleValue(record, "Slot01_Size4"));
        Assert.Null(SourcePurchase.FindModuleValue(record, "NoSuchMount"));
        Assert.Null(SourcePurchase.FindModuleValue(record, null));
        Assert.Null(SourcePurchase.FindModuleValue(record, "   "));
    }

    [Fact]
    public void AnExactSpellingWinsOverAFoldedOne()
    {
        LoadoutEvent capture = new(
            "sidewinder",
            [
                new LoadoutModule("powerplant", "a") { Value = 10 },
                new LoadoutModule("PowerPlant", "b") { Value = 20 },
            ]);

        SourcePurchaseRecord record = SourcePurchase.FromLoadout(capture)!;

        Assert.Equal(20, SourcePurchase.FindModuleValue(record, "PowerPlant")!.Value);
        Assert.Equal(10, SourcePurchase.FindModuleValue(record, "powerplant")!.Value);

        // Neither spelling is exact, so the first entry the fold reaches answers.
        Assert.Equal(10, SourcePurchase.FindModuleValue(record, "POWERPLANT")!.Value);
    }

    [Fact]
    public void TheRecordDescribesTheCaptureAndNotTheLiveFit()
    {
        SourceCaptureFixture stated = Fixture.Captures["deepBlack"];
        LoadoutEvent capture = Capture(stated.Build);

        SourcePurchaseRecord record = SourcePurchase.FromLoadout(capture)!;

        // The record keeps no object of the event by reference, so the two never drift.
        Assert.NotSame(capture.Modules, record.ModuleValues);
        Assert.Equal(capture.Modules.Count, record.ModuleCount);
    }

    [Fact]
    public void AnAbsentArgumentIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => SourcePurchase.FromLoadout(null!));
        Assert.Throws<ArgumentNullException>(() => SourcePurchase.FindModuleValue(null!, "PowerPlant"));
        Assert.Throws<ArgumentNullException>(() => SourcePurchase.SumModuleValues(null!));
    }

    private static void AssertRecord(SourceRecordFixture stated, SourcePurchaseRecord record)
    {
        Assert.Equal(stated.HullValue, record.HullValue);
        Assert.Equal(stated.ModulesValue, record.ModulesValue);
        Assert.Equal(stated.Rebuy, record.Rebuy);
        Assert.Equal(stated.ModuleCount, record.ModuleCount);
        Assert.Equal(stated.PricedModulesValue, SourcePurchase.SumModuleValues(record));
        Assert.Equal(stated.ModuleValues.Count, record.ModuleValues.Count);

        // The capture's own order is the record's order.
        for (int index = 0; index < stated.ModuleValues.Count; index++)
        {
            SourceModuleValueFixture expected = stated.ModuleValues[index];
            SourceModuleValue actual = record.ModuleValues[index];
            Assert.Equal(expected.Slot, actual.Slot);
            Assert.Equal(expected.Item, actual.Item);
            Assert.Equal(expected.Value, actual.Value);
        }
    }
}
