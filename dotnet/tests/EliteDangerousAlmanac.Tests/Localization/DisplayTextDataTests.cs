using System.Collections.Generic;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Commodities;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Localization;
using EliteDangerousAlmanac.Localization.Internal;
using EliteDangerousAlmanac.Materials;
using EliteDangerousAlmanac.Ships;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Localization;

/// <summary>
/// The localized-name catalogues against the catalogues they name, key by key.
/// </summary>
/// <remarks>
/// English is the owning record's own name, so a display-text file that drifts from its
/// catalogue is a defect rather than a translation gap. These tests hold the two together.
/// </remarks>
public sealed class DisplayTextDataTests
{
    private static readonly GameLocale[] EveryLocale =
    [
        GameLocale.En,
        GameLocale.De,
        GameLocale.Es,
        GameLocale.Fr,
        GameLocale.Pt,
        GameLocale.Ru,
    ];

    [Fact]
    public void EveryOutfittingModuleIsNamedAsItsCatalogueNamesIt()
    {
        foreach (OutfittingModule module in ModuleCatalogue.All)
        {
            Assert.Equal(module.Name, DisplayText.ModuleName(module.Symbol, "en"));
        }
    }

    [Fact]
    public void EveryOutfittingFamilyIsNamedAsItsCatalogueNamesIt()
    {
        foreach (KeyValuePair<OutfittingFamilyId, string> family in OutfittingFamilies.All)
        {
            Assert.Equal(
                family.Value,
                DisplayText.OutfittingFamilyName(Identifier(family.Key.ToString()), "en"));
        }
    }

    [Fact]
    public void EveryBlueprintAndEffectIsNamedAsItsCatalogueNamesIt()
    {
        foreach (KeyValuePair<string, Blueprint> blueprint in BlueprintCatalogue.All)
        {
            Assert.NotNull(DisplayText.BlueprintName(blueprint.Key, "en"));
        }

        foreach (KeyValuePair<string, ExperimentalEffect> effect
            in ExperimentalEffectCatalogue.All)
        {
            Assert.Equal(effect.Value.Name, DisplayText.ExperimentalEffectName(effect.Key, "en"));
            Assert.NotNull(DisplayText.ExperimentalEffectDescription(effect.Key, "en"));
        }
    }

    [Fact]
    public void EveryCommodityAndMaterialIsNamedAsItsCatalogueNamesIt()
    {
        foreach (Commodity commodity in CommodityCatalogue.All)
        {
            Assert.Equal(commodity.Name, DisplayText.CommodityName(commodity.Symbol, "en"));
        }

        foreach (Material material in MaterialCatalogue.All)
        {
            Assert.Equal(material.Name, DisplayText.MaterialName(material.Symbol, "en"));
        }

        foreach (MicroResource resource in MicroResourceCatalogue.All)
        {
            Assert.Equal(resource.Name, DisplayText.MicroResourceName(resource.Symbol, "en"));
        }
    }

    [Fact]
    public void EveryPieceOfPersonalEquipmentIsNamedAsItsCatalogueNamesIt()
    {
        foreach (Suit suit in SuitCatalogue.All)
        {
            Assert.Equal(suit.Name, DisplayText.SuitName(suit.Family, "en"));
            Assert.NotNull(DisplayText.SuitDescription(suit.Family, "en"));

            foreach (KeyValuePair<int, SuitGrade> grade in suit.Grades)
            {
                Assert.Equal(suit.Name, DisplayText.SuitName(grade.Value.Symbol, "en"));
            }
        }

        foreach (PersonalTool tool in PersonalToolCatalogue.All)
        {
            Assert.Equal(tool.Name, DisplayText.PersonalToolName(tool.Id, "en"));
        }

        foreach (PersonalWeapon weapon in PersonalWeaponCatalogue.All)
        {
            Assert.NotNull(DisplayText.PersonalWeaponDescription(weapon.Symbol, "en"));
        }

        foreach (KeyValuePair<string, PersonalModification> recipe
            in PersonalModificationCatalogue.All)
        {
            Assert.Equal(
                recipe.Value.Name, DisplayText.PersonalModificationName(recipe.Key, "en"));
            Assert.NotNull(DisplayText.PersonalModificationDescription(recipe.Key, "en"));
        }
    }

    [Fact]
    public void EveryPurchasedArticleIsNamedByItsWholeIdentity()
    {
        foreach (PreEngineeredVariant variant in PreEngineeredCatalogue.All)
        {
            Assert.NotNull(DisplayText.PreEngineeredVariantName(variant, "en"));
        }
    }

    [Fact]
    public void EveryCodexRegionIsNamedAsItsCatalogueNamesIt()
    {
        // The catalogue is keyed by the region identifier, so this is what stops an astro
        // rename from orphaning the English column it is supposed to track.
        foreach (CodexRegion region in CodexRegions.All)
        {
            Assert.Equal(region.Name, DisplayText.CodexRegionName(region.Id, "en"));
        }
    }

    [Theory]
    [InlineData("data/i18n/blueprint-names.jsonc")]
    [InlineData("data/i18n/codex-region-names.jsonc")]
    [InlineData("data/i18n/commodity-names.jsonc")]
    [InlineData("data/i18n/experimental-effect-names.jsonc")]
    [InlineData("data/i18n/experimental-effect-descriptions.jsonc")]
    [InlineData("data/i18n/material-names.jsonc")]
    [InlineData("data/i18n/micro-resource-names.jsonc")]
    [InlineData("data/i18n/personal-tool-names.jsonc")]
    [InlineData("data/i18n/personal-weapon-descriptions.jsonc")]
    public void ACompleteDirectCatalogueCarriesEveryLanguage(string path)
    {
        AssertComplete(LocalizedNames.Direct(path), path);
    }

    [Theory]
    [InlineData("data/i18n/module-names.jsonc")]
    [InlineData("data/i18n/personal-modification-names.jsonc")]
    [InlineData("data/i18n/personal-modification-descriptions.jsonc")]
    [InlineData("data/i18n/suit-names.jsonc")]
    [InlineData("data/i18n/suit-descriptions.jsonc")]
    public void ACompleteSharedCatalogueCarriesEveryLanguage(string path)
    {
        AssertComplete(LocalizedNames.Shared(path), path);
    }

    [Fact]
    public void ASparseCatalogueCarriesEnglishForEveryKeyItHolds()
    {
        foreach (string path in
            new[] { "data/i18n/module-family-names.jsonc", "data/i18n/pre-engineered-variant-names.jsonc" })
        {
            IReadOnlyDictionary<string, LocalizedName> catalogue =
                path.Contains("family") ? LocalizedNames.Direct(path) : LocalizedNames.Shared(path);
            foreach (KeyValuePair<string, LocalizedName> record in catalogue)
            {
                Assert.False(
                    string.IsNullOrEmpty(record.Value.En),
                    $"{path}: {record.Key} states no English name.");
            }
        }
    }

    private static void AssertComplete(
        IReadOnlyDictionary<string, LocalizedName> catalogue,
        string path)
    {
        Assert.NotEmpty(catalogue);
        foreach (KeyValuePair<string, LocalizedName> record in catalogue)
        {
            foreach (GameLocale locale in EveryLocale)
            {
                Assert.False(
                    string.IsNullOrEmpty(record.Value.For(locale)),
                    $"{path}: {record.Key} states nothing in {locale}.");
            }
        }
    }

    private static string Identifier(string member) =>
        char.ToLowerInvariant(member[0]) + member.Substring(1);
}
