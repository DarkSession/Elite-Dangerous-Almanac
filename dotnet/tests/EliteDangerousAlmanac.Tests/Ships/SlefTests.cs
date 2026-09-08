using System;
using System.Collections.Generic;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The Ship Loadout Export Format reader, inspector and writer.</summary>
public class SlefTests
{
    /// <summary>The export files the corpus holds, each a real application's own output.</summary>
    public static TheoryData<string> Exports() =>
    [
        "fixtures/ships/slef-the-deep-black.jsonc",
        "fixtures/ships/slef-edsy-anaconda-funny-hull.jsonc",
        "fixtures/ships/slef-inara-cutter-antixeno.jsonc",
        "fixtures/ships/slef-inara-lynx-highliner.jsonc",
        "fixtures/ships/slef-inara-panther-mkii.jsonc",
        "fixtures/ships/slef-inara-type-11.jsonc",
    ];

    /// <summary>The bare journal captures the corpus holds, which carry no envelope.</summary>
    public static TheoryData<string> Journals()
    {
        TheoryData<string> paths = [];
        foreach (string path in SharedFixtures.Paths())
        {
            if (path.StartsWith("fixtures/ships/journal-", StringComparison.Ordinal)) paths.Add(path);
        }

        return paths;
    }

    private static readonly SlefHeader TestHeader = new("Almanac", "1.0.0");

    private static SlefInspection InspectText(string json)
    {
        using JsonDocument document = JsonDocument.Parse(json);
        return Slef.Inspect(document.RootElement);
    }

    private static IReadOnlyList<SlefEntry> ParseText(string json)
    {
        using JsonDocument document = JsonDocument.Parse(json);
        return Slef.Parse(document.RootElement);
    }

    private static IReadOnlyList<SlefEntry> ParseFixture(string path)
    {
        using JsonDocument document = SharedFixtures.LoadDocument(path);
        return Slef.Parse(document.RootElement);
    }

    [Theory]
    [MemberData(nameof(Exports))]
    public void ARealExportReadsBackEveryBuildItCarries(string path)
    {
        IReadOnlyList<SlefEntry> entries = ParseFixture(path);

        Assert.NotEmpty(entries);
        foreach (SlefEntry entry in entries)
        {
            Assert.NotEmpty(entry.Header.AppName);
            Assert.NotEmpty(entry.Data.Ship);
            Assert.NotEmpty(entry.Data.Modules);
        }
    }

    [Theory]
    [MemberData(nameof(Journals))]
    public void ABareJournalCaptureReadsAndTakesASyntheticHeader(string path)
    {
        SlefEntry entry = Assert.Single(ParseFixture(path));

        Assert.Equal(string.Empty, entry.Header.AppName);
        Assert.Equal(string.Empty, entry.Header.AppVersion);
        Assert.Equal("Loadout", entry.Data.Event);
        Assert.NotEmpty(entry.Data.Modules);
    }

    [Fact]
    public void OnlyABareLoadoutTakesASyntheticHeader()
    {
        SlefEntry entry = Assert.Single(ParseFixture("fixtures/ships/slef-the-deep-black.jsonc"));

        Assert.Equal("EDSY", entry.Header.AppName);

        // The application wrote its version as a number, which reads back as its own digits
        // rather than as a floating-point rendering of them.
        Assert.Equal("423039902", entry.Header.AppVersion);
        Assert.StartsWith("https://edsy.org/", entry.Header.AppUrl, StringComparison.Ordinal);
    }

    [Fact]
    public void TheTextReaderTakesTheSameExportAsTheParsedOne()
    {
        const string Json = """
            [{"header":{"appName":"EDSY","appVersion":"1"},
              "data":{"Ship":"sidewinder","Modules":[{"Slot":"PowerPlant","Item":"a"}]}}]
            """;

        SlefEntry entry = Assert.Single(Slef.Parse(Json));

        Assert.Equal("EDSY", entry.Header.AppName);
        Assert.Equal("sidewinder", entry.Data.Ship);
        Assert.Empty(Slef.Inspect(Json).Diagnostics);
    }

    [Fact]
    public void ASingleEnvelopeNeedsNoSurroundingArray()
    {
        const string Json = """
            {"header":{"appName":"EDSY","appVersion":"1"},
             "data":{"Ship":"sidewinder","Modules":[]}}
            """;

        Assert.Equal("sidewinder", Assert.Single(ParseText(Json)).Data.Ship);
    }

    [Fact]
    public void MalformedJsonTextIsRefusedAsText()
    {
        Assert.ThrowsAny<JsonException>(() => Slef.Parse("{"));
        Assert.ThrowsAny<JsonException>(() => Slef.Inspect("{"));
    }

    [Fact]
    public void AnAbsentPayloadIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => Slef.Parse((string)null!));
        Assert.Throws<ArgumentNullException>(() => Slef.Inspect((string)null!));
    }

    [Fact]
    public void APayloadThatHoldsNoLoadoutIsRefused()
    {
        // Every entry is rejected, so the strict reader reports the first rejection.
        Assert.Throws<FormatException>(() => ParseText("[]"));
        Assert.Throws<FormatException>(() => ParseText("[{}]"));
    }

    [Fact]
    public void AMixedPayloadKeepsItsValidEntriesAndReportsTheRest()
    {
        const string Json = """
            [{"Ship":"sidewinder","Modules":[]},
             {"Ship":7,"Modules":[]},
             {"Ship":"eagle","Modules":[]}]
            """;

        SlefInspection inspected = InspectText(Json);

        Assert.Equal(["sidewinder", "eagle"], Map(inspected.Entries, entry => entry.Data.Ship));
        SlefDiagnostic diagnostic = Assert.Single(inspected.Diagnostics);
        Assert.Equal(1, diagnostic.Index);
        Assert.Equal(SlefDiagnosticCode.InvalidLoadout, diagnostic.Code);
        Assert.Equal("entries[1].Ship", diagnostic.Path);
        Assert.Equal(SlefConstraint.StringRequired, diagnostic.Constraint);
        Assert.Equal("entries[1].Ship must be a string", diagnostic.Message);
        Assert.Null(diagnostic.Slot);
        Assert.Throws<FormatException>(() => ParseText(Json));
    }

    [Fact]
    public void AnInvalidEnvelopeFieldIsNamedInTheEnvelopeAndABareOneIsNot()
    {
        const string Json = """
            [{"header":{"appName":3,"appVersion":"1"},
              "data":{"Ship":"sidewinder","Modules":[]}},
             {"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x",
              "Engineering":{"BlueprintName":"Engine_Dirty","Level":6,"Quality":1}}]}]
            """;

        SlefInspection inspected = InspectText(Json);

        Assert.Equal(
            [
                (SlefDiagnosticCode.InvalidHeader, "entries[0].header.appName"),
                (SlefDiagnosticCode.InvalidEngineering, "entries[1].Modules[0].Engineering.Level"),
            ],
            Map(inspected.Diagnostics, diagnostic => (diagnostic.Code, diagnostic.Path)));
    }

    public static TheoryData<string, string> InvalidModifierFields() =>
        new()
        {
            { "Value", "\"x\"" },
            { "OriginalValue", "\"x\"" },
            { "ValueStr", "4" },
            { "LessIsGood", "2" },
        };

    [Theory]
    [MemberData(nameof(InvalidModifierFields))]
    public void EveryInvalidModifierFieldIsNamed(string field, string value)
    {
        string json = "{\"Ship\":\"sidewinder\",\"Modules\":[{\"Slot\":\"MainEngines\","
            + "\"Item\":\"x\",\"Engineering\":{\"BlueprintName\":\"Engine_Dirty\",\"Level\":5,"
            + "\"Quality\":1,\"Modifiers\":[{\"Label\":\"Mass\",\"" + field + "\":" + value
            + "}]}}]}";

        SlefDiagnostic diagnostic = Assert.Single(InspectText(json).Diagnostics);

        Assert.Equal(SlefDiagnosticCode.InvalidEngineering, diagnostic.Code);
        Assert.Equal($"entries[0].Modules[0].Engineering.Modifiers[0].{field}", diagnostic.Path);
    }

    public static TheoryData<string, string> IncompleteEngineering() =>
        new()
        {
            { """{"BlueprintName":"FSD_LongRange","Level":1,"Modifiers":[]}""", "Quality" },
            { """{"BlueprintName":"FSD_LongRange","Quality":1,"Modifiers":[]}""", "Level" },
            { """{"BlueprintName":"Decorative_Red","Modifiers":[]}""", "Level" },
            { """{"BlueprintName":"Future_Fixed_Identity","Modifiers":[]}""", "Level" },
        };

    [Theory]
    [MemberData(nameof(IncompleteEngineering))]
    public void EveryModificationBlockStatesBothGradeFields(string engineering, string missing)
    {
        string json = "{\"Ship\":\"sidewinder\",\"Modules\":[{\"Slot\":\"MainEngines\","
            + "\"Item\":\"x\",\"Engineering\":" + engineering + "}]}";

        SlefDiagnostic diagnostic = Assert.Single(InspectText(json).Diagnostics);

        Assert.Equal($"entries[0].Modules[0].Engineering.{missing}", diagnostic.Path);
    }

    [Fact]
    public void AFixedEngineeringIdentityNeedsNoModifiers()
    {
        // The specification's own example states an identity and no modifiers at all, so a
        // reader that demands them cannot read the format it implements.
        const string Json = """
            {"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x",
             "Engineering":{"BlueprintName":"Decorative_Red","Level":5,"Quality":1,
             "ExperimentalEffect":"special_blast"}}]}
            """;

        SlefEntry entry = Assert.Single(ParseText(Json));
        ModuleEngineering engineering = entry.Data.Modules[0].Engineering!;

        Assert.Equal("Decorative_Red", engineering.BlueprintName);
        Assert.Equal(5, engineering.Level);
        Assert.Equal(1, engineering.Quality);
        Assert.Equal("special_blast", engineering.ExperimentalEffect);

        // Absent means "not stated" rather than "changed nothing", so no empty list is invented.
        Assert.Null(engineering.Modifiers);
        Assert.Null(Slef.FindModifier(entry.Data.Modules[0], "Mass"));

        string written = Slef.Stringify(Slef.Wrap(entry.Data, TestHeader));
        Assert.DoesNotContain("Modifiers", written, StringComparison.Ordinal);
        Assert.Null(Slef.Parse(written)[0].Data.Modules[0].Engineering!.Modifiers);
    }

    public static TheoryData<string> OutOfRangeLoadouts() =>
    [
        """{"Ship":"sidewinder","FuelCapacity":{"Main":-1,"Reserve":0},"Modules":[]}""",
        """{"Ship":"sidewinder","FuelCapacity":{"Main":8},"Modules":[]}""",
        """{"Ship":"sidewinder","FuelCapacity":8,"Modules":[]}""",
        """{"Ship":"sidewinder","Rebuy":-1,"Modules":[]}""",
        """{"Ship":"sidewinder","ShipName":4,"Modules":[]}""",
        """{"Ship":"sidewinder","Modules":{}}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Priority":5}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Priority":1.5}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Health":-0.1}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Value":-1}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","On":1}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines"}]}""",
        """{"Ship":"sidewinder","Modules":["x"]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":"Engine_Dirty","Level":6,"Quality":1,"Modifiers":[]}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":"Engine_Dirty","Level":5,"Quality":-0.1,"Modifiers":[]}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":4,"Level":5,"Quality":1}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":"Engine_Dirty","Level":5,"Quality":1,"ExperimentalEffect":4}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":"Engine_Dirty","Level":5,"Quality":1,"ExperimentalEffect_Localised":4}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":"Engine_Dirty","Level":5,"Quality":1,"Modifiers":{}}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":"Engine_Dirty","Level":5,"Quality":1,"Modifiers":["x"]}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":{"BlueprintName":"Engine_Dirty","Level":5,"Quality":1,"Modifiers":[{"Label":4}]}}]}""",
        """{"Ship":"sidewinder","Modules":[{"Slot":"MainEngines","Item":"x","Engineering":4}]}""",
        """{"event":"FSDJump","Ship":"sidewinder","Modules":[]}""",
    ];

    [Theory]
    [MemberData(nameof(OutOfRangeLoadouts))]
    public void AFieldOutsideItsDocumentedRangeIsRefused(string json)
    {
        Assert.Throws<FormatException>(() => ParseText(json));
        Assert.Single(InspectText(json).Diagnostics);
    }

    public static TheoryData<string, string> OutOfRangeHeaders() =>
        new()
        {
            { """{"appName":3,"appVersion":"1"}""", "appName" },
            { """{"appName":"EDSY"}""", "appVersion" },
            { """{"appName":"EDSY","appVersion":true}""", "appVersion" },
            { """{"appName":"EDSY","appVersion":"1","appURL":4}""", "appURL" },
            { """{"appName":"EDSY","appVersion":"1","appCustomProperties":4}""", "appCustomProperties" },
        };

    [Theory]
    [MemberData(nameof(OutOfRangeHeaders))]
    public void AnInvalidHeaderFieldIsNamed(string header, string field)
    {
        string json = "[{\"header\":" + header
            + ",\"data\":{\"Ship\":\"sidewinder\",\"Modules\":[]}}]";

        SlefDiagnostic diagnostic = Assert.Single(InspectText(json).Diagnostics);

        Assert.Equal(SlefDiagnosticCode.InvalidHeader, diagnostic.Code);
        Assert.Equal($"entries[0].header.{field}", diagnostic.Path);
    }

    [Fact]
    public void AnEnvelopeWithAnUnreadableDataHalfIsNamedInTheEnvelope()
    {
        const string Json = """
            [{"header":{"appName":"EDSY","appVersion":"1"},"data":{"Modules":[]}}]
            """;

        SlefDiagnostic diagnostic = Assert.Single(InspectText(Json).Diagnostics);

        Assert.Equal(SlefDiagnosticCode.InvalidLoadout, diagnostic.Code);
        Assert.Equal("entries[0].data.Ship", diagnostic.Path);
    }

    [Fact]
    public void AnEntryThatIsNoKindOfLoadoutIsRefusedAsAWhole()
    {
        SlefDiagnostic diagnostic = Assert.Single(InspectText("[4]").Diagnostics);

        Assert.Equal(SlefDiagnosticCode.InvalidLoadout, diagnostic.Code);
        Assert.Equal("entries[0]", diagnostic.Path);
        Assert.Equal(SlefConstraint.ObjectRequired, diagnostic.Constraint);
    }

    [Fact]
    public void ARepeatedMountIsRefusedWhateverCaseItIsWrittenIn()
    {
        const string Json = """
            {"Ship":"sidewinder","Modules":[{"Slot":"PowerPlant","Item":"a"},
             {"Slot":"powerplant","Item":"b"}]}
            """;

        SlefDiagnostic diagnostic = Assert.Single(InspectText(Json).Diagnostics);

        Assert.Equal(0, diagnostic.Index);
        Assert.Equal(SlefDiagnosticCode.DuplicateSlot, diagnostic.Code);
        Assert.Equal("entries[0].Modules[1].Slot", diagnostic.Path);
        Assert.Equal(SlefConstraint.UniqueSlot, diagnostic.Constraint);
        Assert.Equal("Entry 0 contains duplicate slot \"powerplant\"", diagnostic.Message);
        Assert.Equal("powerplant", diagnostic.Slot);

        FormatException failure = Assert.Throws<FormatException>(() => ParseText(Json));
        Assert.Contains("duplicate slot \"powerplant\"", failure.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void ARepeatedMountInsideAnEnvelopeNamesTheDataHalf()
    {
        const string Json = """
            [{"header":{"appName":"EDSY","appVersion":"1"},
              "data":{"Ship":"sidewinder","Modules":[{"Slot":"PowerPlant","Item":"a"},
              {"Slot":"PowerPlant","Item":"b"}]}}]
            """;

        Assert.Equal(
            "entries[0].data.Modules[1].Slot",
            Assert.Single(InspectText(Json).Diagnostics).Path);
    }

    [Fact]
    public void ARepeatedMountCopiedFromACaptureIsShortenedInTheMessage()
    {
        string slot = new('s', 20_000);
        LoadoutEvent loadout = new("sidewinder", [new LoadoutModule(slot, "a"), new LoadoutModule(slot, "b")]);
        string json = Slef.Stringify([new SlefEntry(TestHeader, loadout)]);

        SlefDiagnostic diagnostic = Assert.Single(InspectText(json).Diagnostics);

        Assert.True(diagnostic.Message.Length < 200);
        Assert.EndsWith("…\"", diagnostic.Message, StringComparison.Ordinal);

        // The structured field still names the mount at its full length.
        Assert.Equal(slot, diagnostic.Slot);

        FormatException written = Assert.Throws<FormatException>(() => Slef.Wrap(loadout, TestHeader));
        Assert.True(written.Message.Length < 200);
        Assert.EndsWith("…\"", written.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AWriteWrapsALoadoutInTheCallersOwnHeader()
    {
        LoadoutEvent loadout = new("sidewinder", []);

        SlefEntry entry = Assert.Single(Slef.Wrap(loadout, TestHeader));

        Assert.Same(TestHeader, entry.Header);
        Assert.Same(loadout, entry.Data);
    }

    [Fact]
    public void AWriteCarriesSeveralBuildsInOneExportInOrder()
    {
        IReadOnlyList<SlefEntry> slef = Slef.Wrap(
            [new LoadoutEvent("sidewinder", []), new LoadoutEvent("eagle", [])],
            TestHeader);

        Assert.Equal(["sidewinder", "eagle"], Map(slef, entry => entry.Data.Ship));
    }

    [Fact]
    public void EverythingAWriteProducesReadsBack()
    {
        LoadoutEvent loadout = new(
            "explorer_nx",
            [
                new LoadoutModule("FrameShiftDrive", "int_hyperdrive_size5_class5")
                {
                    On = true,
                    Priority = 2,
                    Health = 1,
                    Value = 5103950,
                    Engineering = new ModuleEngineering("FSD_LongRange", 5, 1)
                    {
                        ExperimentalEffect = "special_fsd_heavy",
                        ExperimentalEffectLocalised = "Mass Manager",
                        Modifiers = [new EngineeringModifier("FSDOptimalMass", 1692.6, 1050, "Active")],
                    },
                },
            ])
        {
            Event = "Loadout",
            ShipName = "The Deep Black",
            ShipIdent = "ISAR",
            HullValue = 5103950,
            ModulesValue = 21,
            UnladenMass = 350.2,
            CargoCapacity = 64,
            MaxJumpRange = 89.414678,
            FuelCapacity = new LoadoutFuelCapacity(32, 0.63),
            Rebuy = 255197,
        };

        string written = Slef.Stringify(Slef.Wrap(loadout, TestHeader));
        SlefEntry read = Assert.Single(Slef.Parse(written));

        Assert.Equal(TestHeader, read.Header);
        Assert.Equal(written, Slef.Stringify(Slef.Wrap(read.Data, TestHeader)));
        Assert.Equal(loadout.MaxJumpRange, read.Data.MaxJumpRange);
        Assert.Equal(loadout.FuelCapacity, read.Data.FuelCapacity);

        LoadoutModule drive = Assert.Single(read.Data.Modules);
        Assert.Equal(loadout.Modules[0] with { Engineering = null }, drive with { Engineering = null });
        Assert.Equal("special_fsd_heavy", drive.Engineering!.ExperimentalEffect);
        Assert.Equal("Mass Manager", drive.Engineering.ExperimentalEffectLocalised);
        Assert.Equal(
            loadout.Modules[0].Engineering!.Modifiers![0],
            Assert.Single(drive.Engineering.Modifiers!));
    }

    [Fact]
    public void AnApplicationsExtraHeaderFieldsSurviveARoundTrip()
    {
        const string Json = """
            [{"header":{"appName":"EDSY","appVersion":"1","appCustomProperties":{"seed":7}},
              "data":{"Ship":"sidewinder","Modules":[]}}]
            """;

        IReadOnlyList<SlefEntry> entries = ParseText(Json);
        SlefHeader header = entries[0].Header;

        Assert.Equal(7, header.AppCustomProperties!["seed"].GetInt32());
        Assert.Contains("\"seed\":7", Slef.Stringify(entries), StringComparison.Ordinal);
    }

    [Fact]
    public void AWriteIsCompactByDefaultAndIndentsOnRequest()
    {
        IReadOnlyList<SlefEntry> slef = Slef.Wrap(new LoadoutEvent("sidewinder", []), TestHeader);

        string compact = Slef.Stringify(slef);
        string indented = Slef.Stringify(slef, 2);

        Assert.DoesNotContain('\n', compact);
        Assert.Contains('\n', indented);
        Assert.Contains("\n  {", indented, StringComparison.Ordinal);
        Assert.Equal(compact, Slef.Stringify(Slef.Parse(indented)));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(128)]
    public void AnIndentOutsideWhatJsonAllowsIsRefused(int indent)
    {
        IReadOnlyList<SlefEntry> slef = Slef.Wrap(new LoadoutEvent("sidewinder", []), TestHeader);

        Assert.Throws<ArgumentOutOfRangeException>(() => Slef.Stringify(slef, indent));
    }

    [Fact]
    public void AWriteRefusesWhatAReadWouldNotAccept()
    {
        Assert.Throws<FormatException>(
            () => Slef.Wrap(new LoadoutEvent(null!, []), TestHeader));
        Assert.Throws<FormatException>(
            () => Slef.Wrap(new LoadoutEvent("sidewinder", null!), TestHeader));
        Assert.Throws<FormatException>(
            () => Slef.Wrap(new LoadoutEvent("sidewinder", [null!]), TestHeader));
        Assert.Throws<FormatException>(() => Slef.Wrap(
            new LoadoutEvent("sidewinder", [new LoadoutModule("PowerPlant", "a") { Priority = 5 }]),
            TestHeader));
        Assert.Throws<FormatException>(() => Slef.Wrap(
            new LoadoutEvent("sidewinder", []) { Rebuy = double.NaN },
            TestHeader));
        Assert.Throws<FormatException>(() => Slef.Wrap(
            new LoadoutEvent("sidewinder", []) { Event = "FSDJump" },
            TestHeader));
        Assert.Throws<FormatException>(() => Slef.Wrap([null!], TestHeader));
    }

    [Fact]
    public void AWriteRefusesAMalformedHeader()
    {
        LoadoutEvent loadout = new("sidewinder", []);

        Assert.Throws<FormatException>(() => Slef.Wrap(loadout, new SlefHeader(null!, "1.0.0")));
        Assert.Throws<FormatException>(() => Slef.Wrap(loadout, new SlefHeader("Almanac", null!)));
    }

    [Fact]
    public void AWriteRefusesAnEmptyExportBecauseAReadWould()
    {
        Assert.Throws<ArgumentException>(() => Slef.Wrap([], TestHeader));
    }

    [Fact]
    public void AWriteRefusesAnAbsentArgument()
    {
        LoadoutEvent loadout = new("sidewinder", []);

        Assert.Throws<ArgumentNullException>(() => Slef.Wrap((LoadoutEvent)null!, TestHeader));
        Assert.Throws<ArgumentNullException>(() => Slef.Wrap((IReadOnlyList<LoadoutEvent>)null!, TestHeader));
        Assert.Throws<ArgumentNullException>(() => Slef.Wrap(loadout, null!));
        Assert.Throws<ArgumentNullException>(() => Slef.Stringify(null!));
        Assert.Throws<ArgumentNullException>(() => Slef.Stringify(null!, 2));
    }

    [Fact]
    public void AModifierIsReadByItsJournalLabelWhateverCaseItIsAskedIn()
    {
        LoadoutModule module = new("FrameShiftDrive", "int_hyperdrive_size5_class5")
        {
            Engineering = new ModuleEngineering("FSD_LongRange", 5, 1)
            {
                Modifiers =
                [
                    new EngineeringModifier("FSDOptimalMass", 1692.6, 1050),
                    new EngineeringModifier("Instrument", null, null, "Active"),
                ],
            },
        };

        Assert.Equal(1692.6, Slef.FindModifier(module, "  fsdoptimalmass  "));

        // A modifier that carries no number, an unstated one, and an absent label are all
        // misses rather than failures.
        Assert.Null(Slef.FindModifier(module, "Instrument"));
        Assert.Null(Slef.FindModifier(module, "Mass"));
        Assert.Null(Slef.FindModifier(module, null));
        Assert.Null(Slef.FindModifier(new LoadoutModule("PowerPlant", "a"), "Mass"));
        Assert.Throws<ArgumentNullException>(() => Slef.FindModifier(null!, "Mass"));
    }

    [Fact]
    public void AKnownCaptureReadsItsEngineeringRecipeAndItsModifiers()
    {
        SlefEntry entry = Assert.Single(ParseFixture("fixtures/ships/journal-krait-phantom.jsonc"));

        LoadoutModule drive = Assert.Single(
            entry.Data.Modules, module => module.Slot == "FrameShiftDrive");
        ModuleEngineering engineering = drive.Engineering!;

        Assert.Equal("FSD_LongRange", engineering.BlueprintName);
        Assert.InRange(engineering.Level, 1, 5);
        Assert.InRange(engineering.Quality, 0, 1);
        Assert.NotNull(Slef.FindModifier(drive, "FSDOptimalMass"));

        // The engineer, the engineer's identifier and the numeric blueprint identifier name who
        // applied the recipe rather than what it did, so the durable shape drops them.
        string written = Slef.Stringify(Slef.Wrap(entry.Data, TestHeader));
        foreach (string dropped in new[] { "Engineer", "EngineerID", "BlueprintID", "timestamp" })
        {
            Assert.DoesNotContain('"' + dropped + '"', written, StringComparison.Ordinal);
        }
    }

    private static List<TResult> Map<TSource, TResult>(
        IReadOnlyList<TSource> source,
        Func<TSource, TResult> select)
    {
        List<TResult> mapped = new(source.Count);
        foreach (TSource item in source) mapped.Add(select(item));
        return mapped;
    }
}
