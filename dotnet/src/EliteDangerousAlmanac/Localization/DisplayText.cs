using System;
using System.Collections.Generic;
using System.Globalization;
using EliteDangerousAlmanac.Localization.Internal;

namespace EliteDangerousAlmanac.Localization;

/// <summary>
/// Source-backed display names and descriptions for the outfitting, personal-equipment,
/// engineering, material and market catalogues.
/// </summary>
/// <remarks>
/// <para>
/// Every lookup takes the identifier its owning catalogue is keyed by — a Frontier symbol,
/// or the library identifier where the game publishes none, as for a suit tool — and a
/// BCP 47 tag. Case and surrounding whitespace are ignored on both.
/// </para>
/// <para>
/// English is complete. For a name it is the owning record's own name, and for a
/// description it is the game's display prose, which no other catalogue publishes. Every
/// other language is sparse: a lookup answers <see langword="null"/> where the pinned
/// source carries no translation, which leaves the application in charge of its own
/// fallback policy. Read <see cref="GameLocale"/> for how a tag is matched.
/// </para>
/// <para>
/// A catalogue loads from its shared data file on first use. Every record is immutable, so
/// one caller cannot change another caller's answers.
/// </para>
/// </remarks>
public static partial class DisplayText
{
    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> ModuleNames =
        new(() => LocalizedNames.Shared("data/i18n/module-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> FamilyNames =
        new(() => LocalizedNames.Direct("data/i18n/module-family-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> BlueprintNames =
        new(() => LocalizedNames.Direct("data/i18n/blueprint-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> EffectNames =
        new(() => LocalizedNames.Direct("data/i18n/experimental-effect-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> EffectDescriptions =
        new(() => LocalizedNames.Direct("data/i18n/experimental-effect-descriptions.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> CommodityNames =
        new(() => LocalizedNames.Direct("data/i18n/commodity-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> CodexRegionNames =
        new(() => LocalizedNames.Direct("data/i18n/codex-region-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> MaterialNames =
        new(() => LocalizedNames.Direct("data/i18n/material-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> MicroResourceNames =
        new(() => LocalizedNames.Direct("data/i18n/micro-resource-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> SuitNames =
        new(() => LocalizedNames.Shared("data/i18n/suit-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> SuitDescriptions =
        new(() => LocalizedNames.Shared("data/i18n/suit-descriptions.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> ToolNames =
        new(() => LocalizedNames.Direct("data/i18n/personal-tool-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> WeaponDescriptions =
        new(() => LocalizedNames.Direct("data/i18n/personal-weapon-descriptions.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> ModificationNames =
        new(() => LocalizedNames.Shared("data/i18n/personal-modification-names.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>>
        ModificationDescriptions =
            new(() => LocalizedNames.Shared("data/i18n/personal-modification-descriptions.jsonc"));

    private static readonly Lazy<IReadOnlyDictionary<string, LocalizedName>> VariantNames =
        new(() => LocalizedNames.Shared("data/i18n/pre-engineered-variant-names.jsonc"));

    /// <summary>Reads an outfitting module's display name.</summary>
    /// <param name="symbol">Frontier's module symbol, such as <c>Int_Hyperdrive_Size6_Class5</c>.</param>
    /// <param name="locale">A BCP 47 tag, such as <c>de</c> or <c>de-DE</c>.</param>
    /// <returns>
    /// The name, or <see langword="null"/> where no module carries the symbol or the
    /// catalogue carries no such language.
    /// </returns>
    /// <remarks>
    /// Every stored language is complete for this catalogue, so a language it carries
    /// always answers. This lookup reads the name table alone, and never the module stats.
    /// </remarks>
    public static string? ModuleName(string? symbol, string? locale) =>
        LocalizedNames.Find(ModuleNames.Value, symbol, locale);

    /// <summary>Reads an outfitting family's display name.</summary>
    /// <param name="familyId">The family identifier, such as <c>shieldGenerators</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>
    /// The name, or <see langword="null"/> where no family carries the identifier or the
    /// source publishes no label for it.
    /// </returns>
    /// <remarks>
    /// This catalogue is the sparsest one: a family the game does not name separately in
    /// its outfitting menu has English alone.
    /// </remarks>
    public static string? OutfittingFamilyName(string? familyId, string? locale) =>
        LocalizedNames.Find(FamilyNames.Value, familyId, locale);

    /// <summary>Reads an engineering blueprint's display name.</summary>
    /// <param name="blueprintSymbol">The blueprint symbol, such as <c>FSD_LongRange</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    public static string? BlueprintName(string? blueprintSymbol, string? locale) =>
        LocalizedNames.Find(BlueprintNames.Value, blueprintSymbol, locale);

    /// <summary>Reads an experimental effect's display name.</summary>
    /// <param name="effectSymbol">The effect symbol, such as <c>Weapon_Overload</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    public static string? ExperimentalEffectName(string? effectSymbol, string? locale) =>
        LocalizedNames.Find(EffectNames.Value, effectSymbol, locale);

    /// <summary>Reads an experimental effect's description.</summary>
    /// <param name="effectSymbol">The effect symbol.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>
    /// The game's own display prose, or <see langword="null"/> for a miss. No other
    /// catalogue publishes it, English included.
    /// </returns>
    public static string? ExperimentalEffectDescription(string? effectSymbol, string? locale) =>
        LocalizedNames.Find(EffectDescriptions.Value, effectSymbol, locale);

    /// <summary>Reads a market commodity's display name.</summary>
    /// <param name="symbol">The commodity symbol, such as <c>Gold</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    public static string? CommodityName(string? symbol, string? locale) =>
        LocalizedNames.Find(CommodityNames.Value, symbol, locale);

    /// <summary>Reads a galactic codex region's display name.</summary>
    /// <param name="regionId">
    /// The region identifier, 1 to 42, as <see cref="Astronomy.CodexRegion.Id"/> carries it. Region
    /// 0 means "outside the mapped region grid" and has no name.
    /// </param>
    /// <param name="locale">A BCP 47 tag, such as <c>de</c> or <c>de-DE</c>.</param>
    /// <returns>
    /// The name, or <see langword="null"/> where the identifier is outside 1 to 42 or the
    /// catalogue carries no such language.
    /// </returns>
    /// <remarks>
    /// <para>
    /// The catalogue is keyed by the region identifier, not by the English name, because
    /// the identifier is the region's stable identity and the name is the value being
    /// translated.
    /// </para>
    /// <para>
    /// Every stored language is complete, so a language it carries always answers. The
    /// game leaves many regions untranslated in some languages, and spells Izanami,
    /// Temple, Mare Somnia, Xibalba and Tenebrae alike in all six. Those source values are
    /// stored verbatim rather than read as a missing translation.
    /// </para>
    /// </remarks>
    public static string? CodexRegionName(int regionId, string? locale) =>
        LocalizedNames.Find(
            CodexRegionNames.Value,
            regionId.ToString(CultureInfo.InvariantCulture),
            locale);

    /// <summary>Reads an engineering material's display name.</summary>
    /// <param name="symbol">The material symbol, such as <c>GridResistors</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    public static string? MaterialName(string? symbol, string? locale) =>
        LocalizedNames.Find(MaterialNames.Value, symbol, locale);

    /// <summary>Reads an Odyssey micro-resource's display name.</summary>
    /// <param name="symbol">The micro-resource symbol, such as <c>graphene</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    public static string? MicroResourceName(string? symbol, string? locale) =>
        LocalizedNames.Find(MicroResourceNames.Value, symbol, locale);

    /// <summary>Reads a personal suit's display name.</summary>
    /// <param name="suit">
    /// The suit family, such as <c>utilitysuit</c>, or a grade-specific item symbol.
    /// </param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    /// <remarks>A suit is named once for its family, so every grade answers alike.</remarks>
    public static string? SuitName(string? suit, string? locale) =>
        LocalizedNames.Find(SuitNames.Value, suit, locale);

    /// <summary>Reads a personal suit's description.</summary>
    /// <param name="suit">The suit family or a grade-specific item symbol.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The game's own display prose, or <see langword="null"/> for a miss.</returns>
    public static string? SuitDescription(string? suit, string? locale) =>
        LocalizedNames.Find(SuitDescriptions.Value, suit, locale);

    /// <summary>Reads a suit tool's display name.</summary>
    /// <param name="id">The tool identifier, such as <c>energylink</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    public static string? PersonalToolName(string? id, string? locale) =>
        LocalizedNames.Find(ToolNames.Value, id, locale);

    /// <summary>Reads a personal weapon's description.</summary>
    /// <param name="symbol">The weapon's item symbol.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The game's own display prose, or <see langword="null"/> for a miss.</returns>
    public static string? PersonalWeaponDescription(string? symbol, string? locale) =>
        LocalizedNames.Find(WeaponDescriptions.Value, symbol, locale);

    /// <summary>Reads a personal modification's display name.</summary>
    /// <param name="modificationSymbol">The recipe symbol, such as <c>weapon_scope</c>.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The name, or <see langword="null"/> for a miss.</returns>
    public static string? PersonalModificationName(string? modificationSymbol, string? locale) =>
        LocalizedNames.Find(ModificationNames.Value, modificationSymbol, locale);

    /// <summary>Reads a personal modification's description.</summary>
    /// <param name="modificationSymbol">The recipe symbol.</param>
    /// <param name="locale">A BCP 47 tag.</param>
    /// <returns>The game's own display prose, or <see langword="null"/> for a miss.</returns>
    public static string? PersonalModificationDescription(
        string? modificationSymbol,
        string? locale) =>
        LocalizedNames.Find(ModificationDescriptions.Value, modificationSymbol, locale);
}
