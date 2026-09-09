using System;
using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What a refused payload and a refused build report, figure by figure.</summary>
/// <remarks>
/// A finding carries the figures a caller composes its own text from, so the figures are
/// the contract rather than the English sentence beside them. The fixture pins each one.
/// </remarks>
public class OperationsDiagnosticsTests
{
    private static readonly OperationsFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc");

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    [Fact]
    public void AnUnreadablePayloadNamesTheFieldItIsRefusedOn()
    {
        SlefDiagnosticCaseFixture stated = Fixture.Diagnostics.Slef;

        SlefInspection inspected = Slef.Inspect(WrapAsSlef(stated.Input));

        SlefDiagnostic diagnostic = Assert.Single(inspected.Diagnostics);
        Assert.Equal(stated.Expected.Code, Name(diagnostic.Code));
        Assert.Equal(stated.Expected.Path, diagnostic.Path);
        Assert.Equal(stated.Expected.Constraint, Name(diagnostic.Constraint));
    }

    [Fact]
    public void AnOversizedArticleReportsTheTwoClassesItSitsBetween()
    {
        LoadoutDiagnosticCaseFixture stated = Fixture.Diagnostics.Loadout;

        LoadoutIssue issue = OnlyIssue(stated);

        AssertFit(stated.Expected, issue);
        Assert.Equal(stated.Expected.Params.ModuleClass, issue.Fit!.ModuleClass);
        Assert.Equal(stated.Expected.Params.SlotSize, issue.Fit.SlotSize);
    }

    [Fact]
    public void AHatchEveryHullCarriesIsRefusedInAnOptionalMount()
    {
        LoadoutDiagnosticCaseFixture stated = Fixture.Diagnostics.BuiltInHullModuleLoadout;

        // The catalogue identifies the article, so a read keeps the mount filled and the
        // validation is what reports the article does not belong there.
        ShipLoadout build = Read(stated.Input);
        Assert.Equal(stated.Kept!.Symbol, build.FittedModuleAt(stated.Kept.Slot)!.Symbol);
        Assert.Equal(stated.Kept.ImportOutcomes.Count, OutcomesAt(build, stated.Kept.Slot).Count);

        AssertFit(stated.Expected, OnlyIssue(stated));
        Assert.False(build.Validation().Valid);
    }

    [Fact]
    public void AHatchOneHullFamilyNamesIsEmptiedFromAnOptionalMount()
    {
        HullSpecificHatchFixture stated = Fixture.Diagnostics.HullSpecificHullModuleLoadout;

        ShipLoadout build = Read(stated.Input);

        Assert.Null(build.FittedModuleAt(stated.Emptied.Slot));
        List<LoadoutImportOutcome> reported = OutcomesAt(build, stated.Emptied.Slot);
        Assert.Equal(stated.Emptied.ImportOutcomes.Count, reported.Count);
        ModuleEmptied emptied = Assert.IsType<ModuleEmptied>(Assert.Single(reported));
        Assert.Equal(stated.Emptied.ImportOutcomes[0].Slot, emptied.Slot);
        Assert.Equal(stated.Emptied.ImportOutcomes[0].SourceSymbol, emptied.SourceSymbol);

        // The hatch the hull family names is still the one in the hatch mount.
        Assert.Equal(stated.HatchSymbol, build.FittedModuleAt("CargoHatch")!.Symbol, ignoreCase: true);
        Assert.Equal(stated.Valid, build.Validation().Valid);
    }

    [Fact]
    public void AnArticleSoldForOneHullNamesTheHullsItIsSoldFor()
    {
        LoadoutDiagnosticCaseFixture stated = Fixture.Diagnostics.RestrictedLoadout;

        LoadoutIssue issue = OnlyIssue(stated);

        AssertFit(stated.Expected, issue);
        Assert.Equal(stated.Expected.Params.AllowedShipNames, issue.Fit!.AllowedShipNames);
        Assert.Equal(stated.Expected.Params.AllowedShipSymbols, issue.Fit.AllowedShipSymbols);
        Assert.Equal(stated.Expected.Params.ShipSymbol, issue.Fit.ShipSymbol, ignoreCase: true);
    }

    [Fact]
    public void ASecondModuleOfAOnePerShipFamilyIsRefused()
    {
        ExclusivityFixture stated = Fixture.Exclusivity;

        ShipLoadout build = ShipLoadout.Default("Anaconda");
        LoadoutEditException refused = Assert.Throws<LoadoutEditException>(
            () => build.SetModule(
                "Slot02_Size6", ModuleCatalogue.FindBySymbol("Int_ShieldGenerator_Size6_Class3")!));

        Assert.Equal(stated.ExpectedCode, Name(refused.Code));
        Assert.Equal(stated.Group, Name(refused.Issue!.ExclusionGroup!.Value));
    }

    /// <summary>
    /// What a read reported about one mount. A read also stocks the core mounts a capture
    /// leaves out, and those outcomes belong to other mounts.
    /// </summary>
    private static List<LoadoutImportOutcome> OutcomesAt(ShipLoadout build, string slot)
    {
        List<LoadoutImportOutcome> reported = [];
        foreach (LoadoutImportOutcome outcome in build.ImportOutcomes)
        {
            if (outcome.Slot == slot) reported.Add(outcome);
        }

        return reported;
    }

    /// <summary>Reads one build, keeping only the finding the case is about.</summary>
    private static LoadoutIssue OnlyIssue(LoadoutDiagnosticCaseFixture stated)
    {
        foreach (LoadoutIssue issue in Read(stated.Input).Validation().Issues)
        {
            if (Name(issue.Code) == stated.Expected.Code && issue.Slot == stated.Expected.Params.Slot)
            {
                return issue;
            }
        }

        Assert.Fail($"No finding reported {stated.Expected.Code} on {stated.Expected.Params.Slot}.");
        return null!;
    }

    private static void AssertFit(LoadoutDiagnosticFixture expected, LoadoutIssue issue)
    {
        Assert.Equal(expected.Code, Name(issue.Code));
        Assert.Equal(expected.Params.Slot, issue.Slot);
        Assert.Equal(expected.Params.Symbol, issue.Symbol, ignoreCase: true);
        Assert.Equal(expected.Params.Constraint, Name(issue.Fit!.Constraint));
    }

    private static ShipLoadout Read(JsonElement input) =>
        ShipLoadout.FromLoadout(input.Deserialize<LoadoutEvent>(JournalOptions)!);

    /// <summary>Wraps one bare loadout as the one-entry payload the reader takes.</summary>
    private static string WrapAsSlef(JsonElement input) => $"[{input.GetRawText()}]";

    /// <summary>Names one enumeration member the way the shared fixtures spell it.</summary>
    private static string Name<T>(T value)
        where T : struct, Enum
    {
        string name = value.ToString()!;
        return char.ToLowerInvariant(name[0]) + name.Substring(1);
    }
}
