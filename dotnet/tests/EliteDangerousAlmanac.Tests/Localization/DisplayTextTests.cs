using System;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Localization;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Localization;

/// <summary>The display names and the prose every catalogue publishes.</summary>
public sealed class DisplayTextTests
{
    private static readonly NamesFixture Names =
        SharedFixtures.Load<NamesFixture>("fixtures/i18n/names.jsonc");

    private static readonly DisplayTextFixture Text =
        SharedFixtures.Load<DisplayTextFixture>("fixtures/i18n/display-text.jsonc");

    public static TheoryData<int> NameCases => Indices(Names.Lookups.Count);

    public static TheoryData<int> VariantCases => Indices(Text.PreEngineered.Count);

    public static TheoryData<int> SlotCases => Indices(Text.Slots.Count);

    public static TheoryData<int> MountCases => Indices(Text.Mounts.Count);

    public static TheoryData<int> RestrictionCases => Indices(Text.Restrictions.Count);

    public static TheoryData<int> DiagnosticCases => Indices(Text.Diagnostics.Count);

    [Theory]
    [MemberData(nameof(NameCases))]
    public void EveryCatalogueAnswersTheSpellingItsSourcePublishes(int index)
    {
        NameLookupFixture expected = Names.Lookups[index];

        string? actual = Lookup(expected.Kind, expected.Identifier, expected.Locale);

        Assert.Equal(expected.Expected, actual);
    }

    [Theory]
    [MemberData(nameof(VariantCases))]
    public void APurchasedArticleIsNamedByItsWholeIdentity(int index)
    {
        VariantNameFixture expected = Text.PreEngineered[index];

        string? actual = DisplayText.PreEngineeredVariantName(
            Variant(expected.Variant), expected.Locale);

        Assert.Equal(expected.Expected, actual);
    }

    [Theory]
    [MemberData(nameof(SlotCases))]
    public void AShipMountIsLabelledInEnglishAlone(int index)
    {
        SlotNameFixture expected = Text.Slots[index];

        string? actual = DisplayText.LoadoutSlotName(Slot(expected.Slot), expected.Locale);

        Assert.Equal(expected.Expected, actual);
    }

    [Theory]
    [MemberData(nameof(MountCases))]
    public void ASuitMountIsLabelledInEnglishAlone(int index)
    {
        MountNameFixture expected = Text.Mounts[index];
        PersonalMount mount = new(
            expected.Mount.Key,
            Enum.Parse<PersonalWeaponSlot>(expected.Mount.Kind, ignoreCase: true));

        Assert.Equal(expected.Expected, DisplayText.PersonalMountName(mount, expected.Locale));
    }

    [Theory]
    [MemberData(nameof(RestrictionCases))]
    public void ARestrictedMountSaysWhatItTakesInEnglishAlone(int index)
    {
        RestrictionLabelFixture expected = Text.Restrictions[index];
        SlotRestriction restriction =
            Enum.Parse<SlotRestriction>(expected.Restriction, ignoreCase: true);

        Assert.Equal(
            expected.Expected, DisplayText.SlotRestrictionLabel(restriction, expected.Locale));
    }

    [Theory]
    [MemberData(nameof(DiagnosticCases))]
    public void AFindingCarriesItsMessageInEnglishAlone(int index)
    {
        DiagnosticMessageFixture expected = Text.Diagnostics[index];
        string message = expected.Diagnostic.Message;

        string? actual = expected.Kind switch
        {
            "loadout" => DisplayText.LoadoutIssueMessage(
                new LoadoutIssue(
                    LoadoutIssueCode.MissingRequiredSlot,
                    LoadoutIssueSeverity.Incomplete,
                    message),
                expected.Locale),
            "calculation" => DisplayText.CalculationIssueMessage(
                new CalculationIssue(
                    CalculationField.Mass, CalculationIssueReason.Unresolved, message),
                expected.Locale),
            "slef" => DisplayText.SlefDiagnosticMessage(
                new SlefDiagnostic(
                    0,
                    SlefDiagnosticCode.InvalidLoadout,
                    "[0].Ship",
                    SlefConstraint.StringRequired,
                    message),
                expected.Locale),
            _ => DisplayText.LoadoutEditErrorMessage(
                new LoadoutEditException(message, LoadoutEditErrorCode.RequiredSlot),
                expected.Locale),
        };

        Assert.Equal(expected.Expected, actual);
    }

    [Fact]
    public void ATagIsMatchedWithoutRegardToItsCaseOrItsSeparator()
    {
        Assert.Equal(
            DisplayText.ModuleName("Int_Hyperdrive_Size6_Class5", "de"),
            DisplayText.ModuleName("Int_Hyperdrive_Size6_Class5", " DE_de "));
        Assert.Equal(
            DisplayText.ModuleName("Int_Hyperdrive_Size6_Class5", "de"),
            DisplayText.ModuleName("  int_hyperdrive_size6_class5  ", "De-Latn-DE"));
    }

    [Fact]
    public void ALookupAnswersNothingForAnIdentifierOrATagNoCatalogueCarries()
    {
        Assert.Null(DisplayText.ModuleName("Int_NotAModule", "en"));
        Assert.Null(DisplayText.ModuleName(null, "en"));
        Assert.Null(DisplayText.ModuleName("Int_Hyperdrive_Size6_Class5", null));
        Assert.Null(DisplayText.ModuleName("Int_Hyperdrive_Size6_Class5", "it"));
        Assert.Null(DisplayText.CommodityName("  ", "en"));
    }

    [Fact]
    public void NoDisplayTextIsReadFromAnAbsentRecord()
    {
        Assert.Throws<ArgumentNullException>(
            () => DisplayText.PreEngineeredVariantName(null!, "en"));
        Assert.Throws<ArgumentNullException>(() => DisplayText.LoadoutSlotName(null!, "en"));
        Assert.Throws<ArgumentNullException>(() => DisplayText.PersonalMountName(null!, "en"));
        Assert.Throws<ArgumentNullException>(() => DisplayText.LoadoutIssueMessage(null!, "en"));
        Assert.Throws<ArgumentNullException>(
            () => DisplayText.CalculationIssueMessage(null!, "en"));
        Assert.Throws<ArgumentNullException>(
            () => DisplayText.SlefDiagnosticMessage(null!, "en"));
        Assert.Throws<ArgumentNullException>(
            () => DisplayText.LoadoutEditErrorMessage(null!, "en"));
    }

    [Fact]
    public void ASuitIsNamedOnceForItsFamilySoEveryGradeAnswersAlike()
    {
        Assert.Equal(
            DisplayText.SuitName("utilitysuit", "de"),
            DisplayText.SuitName("utilitysuit_class3", "de"));
        Assert.Equal(
            DisplayText.SuitDescription("utilitysuit", "en"),
            DisplayText.SuitDescription("utilitysuit_class5", "en"));
    }

    [Fact]
    public void AMountNoSuitCarriesIsLabelledByNoLocaleAtAll()
    {
        PersonalMount mount = new("TertiaryWeapon", PersonalWeaponSlot.Primary);

        Assert.Null(DisplayText.PersonalMountName(mount, "en"));
        Assert.Null(DisplayText.PersonalMountName(mount, "de"));
    }

    private static string? Lookup(string kind, string identifier, string locale) => kind switch
    {
        "module" => DisplayText.ModuleName(identifier, locale),
        "outfittingFamily" => DisplayText.OutfittingFamilyName(identifier, locale),
        "blueprint" => DisplayText.BlueprintName(identifier, locale),
        "experimentalEffect" => DisplayText.ExperimentalEffectName(identifier, locale),
        "experimentalEffectDescription" =>
            DisplayText.ExperimentalEffectDescription(identifier, locale),
        "commodity" => DisplayText.CommodityName(identifier, locale),
        "material" => DisplayText.MaterialName(identifier, locale),
        "microResource" => DisplayText.MicroResourceName(identifier, locale),
        "suit" => DisplayText.SuitName(identifier, locale),
        "suitDescription" => DisplayText.SuitDescription(identifier, locale),
        "personalTool" => DisplayText.PersonalToolName(identifier, locale),
        "personalWeaponDescription" =>
            DisplayText.PersonalWeaponDescription(identifier, locale),
        "personalModification" => DisplayText.PersonalModificationName(identifier, locale),
        "personalModificationDescription" =>
            DisplayText.PersonalModificationDescription(identifier, locale),
        _ => throw new InvalidOperationException($"The fixture names no lookup '{kind}'."),
    };

    private static PreEngineeredVariant Variant(VariantIdentityFixture stated) => new(
        stated.Symbol,
        stated.Symbol,
        stated.BlueprintSymbol,
        1,
        Enum.Parse<PreEngineeredAcquisition>(stated.Acquisition, ignoreCase: true),
        stated.ExperimentalEffectSymbol);

    private static BuildSlot Slot(SlotFixture stated) => new(
        stated.Key,
        Enum.Parse<SlotKind>(stated.Kind, ignoreCase: true),
        stated.Size,
        stated.Core is null ? null : Enum.Parse<CoreSlotType>(stated.Core, ignoreCase: true),
        stated.Restriction is null
            ? null
            : Enum.Parse<SlotRestriction>(stated.Restriction, ignoreCase: true));

    private static TheoryData<int> Indices(int count)
    {
        TheoryData<int> cases = [];
        for (int index = 0; index < count; index++) cases.Add(index);
        return cases;
    }
}
