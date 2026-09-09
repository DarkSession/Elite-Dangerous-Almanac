using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>How a read classifies one entry of a captured module list.</summary>
/// <remarks>
/// The catalogue has the first say: an article it identifies is kept whatever its mount is
/// called. A known cosmetic or hull family is kept too, and costs the build nothing. Every
/// other entry is stripped, bar the mounts a read fills from the hull's stock articles.
/// </remarks>
public class SlotClassificationTests
{
    private static readonly LoadoutExportFixture Export =
        SharedFixtures.Load<LoadoutExportFixture>("fixtures/ships/slef-export.jsonc");

    private static readonly ClassificationFixture Fixture = Export.Classification;

    private const string Hull = "krait_light";

    public static TheoryData<int> Examples()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.Examples.Count; index++) positions.Add(index);
        return positions;
    }

    [Theory]
    [MemberData(nameof(Examples))]
    public void AWorkedExampleIsReadTheWayTheFixtureSaysItIs(int position)
    {
        ClassificationExampleFixture stated = Fixture.Examples[position];
        LoadoutEvent empty = WithModules().ToLoadoutEvent();
        LoadoutEvent exported = WithOneModule(stated.Slot, stated.Item).ToLoadoutEvent();

        // The hull is knowable whatever is fitted, so it is written in every case.
        Assert.Equal(Export.KraitPhantom.Recomputed.HullValue, exported.HullValue);

        if (stated.Verdict == "stripped")
        {
            Assert.Equal(empty.Modules.Count, exported.Modules.Count);
            Assert.DoesNotContain(exported.Modules, module => Same(module.Slot, stated.Slot));
            Assert.Equal(empty.ModulesValue, exported.ModulesValue);
            Assert.Equal(empty.UnladenMass, exported.UnladenMass);
            return;
        }

        LoadoutModule kept = Assert.Single(exported.Modules, module => Same(module.Slot, stated.Slot));
        switch (stated.Verdict)
        {
            case "nonOutfitting":
                // Nothing outfits, so nothing is priced and nothing is weighed.
                Assert.Null(kept.Value);
                Assert.Equal(empty.ModulesValue, exported.ModulesValue);
                Assert.Equal(empty.UnladenMass, exported.UnladenMass);
                break;

            case "builtInHull":
                // The catalogue carries one record for every hull family's own hatch, so a
                // symbol lookup alone would rename this one. That would void the credit
                // figures and drop the mount's power state over a free, weightless article.
                AssertHatchIsKeptVerbatim(stated, exported, empty);
                break;

            case "outfitting":
                AssertArticleIsPriced(stated, kept, exported, empty);
                break;

            default:
                Assert.Fail($"The fixture states no verdict \"{stated.Verdict}\".");
                break;
        }
    }

    [Fact]
    public void TheMountPatternsAreTheSlotParsersOwnVocabulary()
    {
        // Both sides are pinned: a mount family neither pattern matches is unknown, which
        // is the answer a future mount gets.
        foreach (string slot in Checked())
        {
            bool parsed = BuildSlots.ParseName(slot) is not null;
            Assert.True(
                IsMount(slot) == parsed,
                $"\"{slot}\": the patterns say {IsMount(slot)} and the parser says {parsed}.");
        }

        foreach (string slot in Export.KraitPhantom.NonOutfittingSlots)
        {
            Assert.True(IsNonOutfitting(slot), $"\"{slot}\" matches no cosmetic family.");
        }

        Assert.False(IsMount("FutureMount"));
        Assert.False(IsNonOutfitting("FutureMount"));
    }

    [Fact]
    public void EveryMountPatternIsOneTheSampleActuallyReaches()
    {
        // A pattern nothing above matches is a pattern this file does not pin, and an
        // unpinned one fails in silence: a pattern transcribed wrongly strips a fitted
        // module rather than reporting anything.
        List<string> checkedSlots = Checked();
        List<string> unexercised = [];
        foreach (string pattern in Fixture.OutfittingSlotPatterns)
        {
            if (!checkedSlots.Exists(slot => Matches(pattern, slot))) unexercised.Add(pattern);
        }

        Assert.Empty(unexercised);
    }

    /// <summary>Every mount the sample reads, drawn from the hulls rather than by hand.</summary>
    private static List<string> Checked()
    {
        List<string> slots = [];
        foreach (Ship ship in ShipCatalogue.All)
        {
            foreach (BuildSlot slot in BuildSlots.Enumerate(ship.Slots())) slots.Add(slot.Key);
        }

        foreach (ClassificationExampleFixture stated in Fixture.Examples) slots.Add(stated.Slot);
        slots.AddRange(Export.KraitPhantom.NonOutfittingSlots);
        slots.AddRange(
            ["slot03_size5", "LargeMiningHardpoint1", "Decal3", "Bobble10", "stringlights"]);
        return slots;
    }

    private static void AssertHatchIsKeptVerbatim(
        ClassificationExampleFixture stated, LoadoutEvent exported, LoadoutEvent empty)
    {
        ShipLoadout build = ShipLoadout.FromLoadout(new LoadoutEvent(
            Hull,
            [
                new LoadoutModule(stated.Slot, stated.Item)
                {
                    On = false,
                    Priority = 4,
                    Health = 1,
                },
            ]));

        // A read stocks the mounts this one-entry capture names nothing for. What matters
        // is that the hatch itself produced no outcome of its own.
        foreach (LoadoutImportOutcome outcome in build.ImportOutcomes)
        {
            Assert.False(Same(outcome.Slot, stated.Slot), $"{stated.Slot} was reported on.");
        }

        Assert.False(build.FittedModuleAt(stated.Slot)!.On);
        LoadoutModule written =
            Assert.Single(exported.Modules, module => Same(module.Slot, stated.Slot));
        Assert.Equal(stated.Item, written.Item, ignoreCase: true);
        Assert.Equal(empty.ModulesValue, exported.ModulesValue);
        Assert.Equal(empty.UnladenMass, exported.UnladenMass);
    }

    private static void AssertArticleIsPriced(
        ClassificationExampleFixture stated,
        LoadoutModule kept,
        LoadoutEvent exported,
        LoadoutEvent empty)
    {
        OutfittingModule stats = ModuleCatalogue.FindBySymbol(stated.Item)!;
        double replaced = WithModules().FittedModuleAt(stated.Slot)?.Stats?.Cost ?? 0;

        Assert.Equal(stats.Cost, kept.Value);
        Assert.Equal(empty.ModulesValue - replaced + stats.Cost, exported.ModulesValue);
    }

    private static ShipLoadout WithModules() =>
        ShipLoadout.FromLoadout(new LoadoutEvent(Hull, []));

    private static ShipLoadout WithOneModule(string slot, string item) =>
        ShipLoadout.FromLoadout(new LoadoutEvent(Hull, [new LoadoutModule(slot, item)]));

    private static bool IsMount(string slot)
    {
        foreach (string pattern in Fixture.OutfittingSlotPatterns)
        {
            if (Matches(pattern, slot)) return true;
        }

        return false;
    }

    private static bool IsNonOutfitting(string slot) =>
        Matches(Fixture.NonOutfittingSlotPattern, slot);

    /// <summary>Reads one pattern against a mount key the way the fixture states it is read.</summary>
    private static bool Matches(string pattern, string slot) =>
        Regex.IsMatch(
            Fixture.PatternsMatchLowerCasedSlot ? slot.ToLowerInvariant() : slot,
            pattern,
            RegexOptions.None,
            TimeSpan.FromSeconds(1));

    private static bool Same(string left, string right) =>
        string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
}
