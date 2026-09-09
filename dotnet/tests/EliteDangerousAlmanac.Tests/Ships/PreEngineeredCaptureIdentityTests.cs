using System;
using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Reading a real capture back to the fixed article it describes.</summary>
/// <remarks>
/// A fixed article is identified from the figures a capture reports rather than from the
/// recipe named beside them, because a producer may name any recipe it likes. The negative
/// cases matter as much as the positive ones: a recipe alone is no evidence.
/// </remarks>
public class PreEngineeredCaptureIdentityTests
{
    private static readonly IdentificationFixture Fixture =
        SharedFixtures.Load<PreEngineeredFixture>("fixtures/ships/pre-engineered.jsonc")
            .Identification;

    public static TheoryData<int> Matches()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.Matches.Count; index++) positions.Add(index);
        return positions;
    }

    public static TheoryData<int> NotMatches()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.NotMatches.Count; index++) positions.Add(index);
        return positions;
    }

    [Theory]
    [MemberData(nameof(Matches))]
    public void ACapturedSignatureNamesTheFixedArticleItDescribes(int position)
    {
        IdentificationMatchFixture expected = Fixture.Matches[position];

        PreEngineeredVariant? found = PreEngineeredStats.Identify(
            Captured(expected.Source, expected.Slot));

        Assert.NotNull(found);
        Assert.Equal(expected.Symbol, found.Symbol);
        Assert.Equal(expected.BlueprintSymbol, found.BlueprintSymbol);
        Assert.Equal(expected.Grade, found.Grade);
        Assert.Equal(expected.ExperimentalEffectSymbol, found.ExperimentalEffectSymbol);
        Assert.Equal(expected.Acquisition, Spelled(found.Acquisition));

        // The effect the capture states is either one the commander applied over the
        // article or the article's own. Which of the two it is decides whether the
        // article is identified at all, so the fixture states them apart.
        Assert.Equal(
            expected.AppliedExperimental ?? expected.ExperimentalEffectSymbol,
            Captured(expected.Source, expected.Slot).Engineering!.ExperimentalEffect);
    }

    /// <summary>Ordinary engineering is never guessed to be a fixed article.</summary>
    [Theory]
    [MemberData(nameof(NotMatches))]
    public void OrdinaryEngineeringNamesNoFixedArticle(int position)
    {
        CapturedModuleFixture expected = Fixture.NotMatches[position];

        Assert.Null(PreEngineeredStats.Identify(Captured(expected.Source, expected.Slot)));
    }

    /// <summary>A capture missing two of the article's predictions is not evidence enough.</summary>
    [Fact]
    public void TwoMissingPredictionsAreNotEvidenceEnough()
    {
        IdentificationMatchFixture drive = Match(
            "journal-panther-mkii-fat-arse.jsonc", "FrameShiftDrive");
        LoadoutModule captured = Captured(drive.Source, drive.Slot);
        IReadOnlyList<EngineeringModifier> stated = captured.Engineering!.Modifiers!;

        List<EngineeringModifier> thinned = [];
        for (int index = 0; index < stated.Count - 2; index++) thinned.Add(stated[index]);

        Assert.Null(PreEngineeredStats.Identify(
            captured with
            {
                Engineering = captured.Engineering with { Modifiers = thinned },
            }));
    }

    /// <summary>The Mercenary article asks for its own exclusive recipe at its own grade.</summary>
    [Fact]
    public void TheMercenaryArticleAsksForItsOwnRecipeAtItsOwnGrade()
    {
        MercenaryIdentificationFixture expected = Fixture.Mercenary;

        ModuleEngineering[] wrong =
        [
            new("Weapon_HighCapacity", expected.PurchaseGrade, 1),
            new(expected.BlueprintSymbol, 0, 1),
            new(expected.BlueprintSymbol, 6, 1),
        ];

        foreach (ModuleEngineering engineering in wrong)
        {
            Assert.Null(PreEngineeredStats.Identify(
                new LoadoutModule("MediumHardpoint1", expected.Symbol)
                {
                    Engineering = engineering,
                }));
        }
    }

    /// <summary>
    /// A capture that omits one predicted figure still names the article, and the figure
    /// comes from the article rather than from the stock record.
    /// </summary>
    [Fact]
    public void AnOmittedPredictionIsSuppliedByTheArticleItself()
    {
        OmittedBakedEffectFixture expected = Fixture.OmittedBakedExperimental;
        LoadoutModule captured = Captured(expected.Source, expected.Slot);

        List<EngineeringModifier> stated = [];
        foreach (EngineeringModifier modifier in captured.Engineering!.Modifiers!)
        {
            if (modifier.Label != expected.Omitted) stated.Add(modifier);
        }

        stated.Add(new EngineeringModifier(
            expected.ReportedInstead.Label,
            expected.ReportedInstead.Value,
            expected.ReportedInstead.OriginalValue));

        PreEngineeredVariant? found = PreEngineeredStats.Identify(
            captured with
            {
                Engineering = captured.Engineering with { Modifiers = stated },
            });

        Assert.NotNull(found);
        Assert.Equal("special_feedback_cascade_cooled", found.ExperimentalEffectSymbol);
        Assert.Equal(
            expected.ExpectedThermalLoad,
            PreEngineeredStats.Resolve(found)!.Stats[ModuleStat.ThermalLoad]!.Value);
    }

    private static IdentificationMatchFixture Match(string source, string slot)
    {
        foreach (IdentificationMatchFixture match in Fixture.Matches)
        {
            if (match.Source == source && match.Slot == slot) return match;
        }

        throw new KeyNotFoundException($"The fixture states no match for {source} {slot}.");
    }

    /// <summary>Reads one mount out of one capture, in whichever shape the capture is written.</summary>
    private static LoadoutModule Captured(string source, string slot)
    {
        using JsonDocument document = SharedFixtures.LoadDocument($"fixtures/ships/{source}");
        LoadoutEvent loadout = document.RootElement.ValueKind == JsonValueKind.Array
            ? Slef.Parse(document.RootElement)[0].Data
            : document.RootElement.Deserialize<LoadoutEvent>(JournalOptions)!;

        foreach (LoadoutModule module in loadout.Modules)
        {
            if (string.Equals(module.Slot, slot, StringComparison.OrdinalIgnoreCase)) return module;
        }

        throw new KeyNotFoundException($"{source} holds no mount '{slot}'.");
    }

    /// <summary>Names one enumeration member the way the shared fixtures spell it.</summary>
    private static string Spelled<T>(T value)
        where T : struct, Enum
    {
        string name = value.ToString()!;
        return char.ToLowerInvariant(name[0]) + name.Substring(1);
    }

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };
}
