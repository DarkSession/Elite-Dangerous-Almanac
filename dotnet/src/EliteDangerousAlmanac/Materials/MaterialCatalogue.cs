using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Materials.Internal;

namespace EliteDangerousAlmanac.Materials;

/// <summary>
/// The engineering-material catalogues and the lookups that search them.
/// </summary>
/// <remarks>
/// <para>
/// Elite Dangerous groups its engineering materials into three categories — raw,
/// manufactured and encoded — and every material carries a <see cref="MaterialGrade"/>
/// and sits in a <see cref="MaterialLine"/>.
/// </para>
/// <para>
/// Every lookup searches <see cref="All"/> by default. The by-key lookups take an
/// optional second argument that narrows the search to a subset — one category's
/// catalogue, or a list you filtered yourself. Passing <see cref="All"/>, or omitting the
/// argument, answers from an index; every other list is scanned.
/// </para>
/// <para>
/// A catalogue loads from its shared data file on first use. The lists and the records in
/// them are immutable, so one caller cannot change another caller's answers.
/// </para>
/// <para>
/// The data originates from EDCD FDevIDs, with Thargoid materials absent from that pinned
/// source supplied by INARA. See <c>data/materials/SOURCES.md</c> for provenance and
/// <c>ATTRIBUTIONS.md</c> for credit.
/// </para>
/// </remarks>
public static class MaterialCatalogue
{
    private static readonly Lazy<IReadOnlyList<Material>> RawMaterials = new(
        () => MaterialCatalogueBuilder.Build("data/materials/materials-raw.jsonc", MaterialCategory.Raw));

    private static readonly Lazy<IReadOnlyList<Material>> ManufacturedMaterials = new(
        () => MaterialCatalogueBuilder.Build("data/materials/materials-manufactured.jsonc", MaterialCategory.Manufactured));

    private static readonly Lazy<IReadOnlyList<Material>> EncodedMaterials = new(
        () => MaterialCatalogueBuilder.Build("data/materials/materials-encoded.jsonc", MaterialCategory.Encoded));

    private static readonly Lazy<IReadOnlyList<Material>> AllMaterials = new(Concatenate);

    private static readonly Lazy<IReadOnlyDictionary<string, Material>> BySymbol = new(
        () => RegistryIndex.CreateKeyIndex(All, material => material.Symbol));

    private static readonly Lazy<IReadOnlyDictionary<string, Material>> ByName = new(
        () => RegistryIndex.CreateKeyIndex(All, material => material.Name));

    private static readonly Lazy<IReadOnlyDictionary<string, Material>> ByElement = new(
        () => RegistryIndex.CreateKeyIndex(All, material => material.ElementSymbol));

    /// <summary>
    /// Every raw material — the chemical elements, in seven lines of four grades.
    /// </summary>
    /// <remarks>Every record has <see cref="MaterialCategory.Raw"/>.</remarks>
    public static IReadOnlyList<Material> Raw => RawMaterials.Value;

    /// <summary>Every manufactured material, in ten lines of five grades.</summary>
    /// <remarks>Every record has <see cref="MaterialCategory.Manufactured"/>.</remarks>
    public static IReadOnlyList<Material> Manufactured => ManufacturedMaterials.Value;

    /// <summary>Every encoded material, in six lines of five grades.</summary>
    /// <remarks>Every record has <see cref="MaterialCategory.Encoded"/>.</remarks>
    public static IReadOnlyList<Material> Encoded => EncodedMaterials.Value;

    /// <summary>
    /// Every material across every category: raw, then manufactured, then encoded.
    /// </summary>
    public static IReadOnlyList<Material> All => AllMaterials.Value;

    /// <summary>
    /// Finds a material by its Frontier symbol, the id the player journal reports.
    /// </summary>
    /// <param name="symbol">
    /// The internal symbol, such as <c>GridResistors</c>, or the lower-cased form the
    /// player journal reports. Leading and trailing whitespace and case are ignored.
    /// </param>
    /// <param name="materials">
    /// The subset to search. Omit it to search every material, which is also the only
    /// indexed path.
    /// </param>
    /// <returns>The material, or <see langword="null"/> when no material has that symbol.</returns>
    /// <example>
    /// <code>
    /// MaterialCatalogue.FindBySymbol("temperedalloys")?.Name; // "Tempered Alloys"
    /// </code>
    /// </example>
    public static Material? FindBySymbol(string? symbol, IReadOnlyList<Material>? materials = null) =>
        IsWholeCatalogue(materials)
            ? RegistryIndex.FindInKeyIndex(BySymbol.Value, symbol)
            : RegistryIndex.FindByKey(materials!, material => material.Symbol, symbol);

    /// <summary>Finds a material by its display name.</summary>
    /// <param name="name">
    /// The display name as the catalogue spells it, such as <c>Grid Resistors</c>.
    /// Leading and trailing whitespace and case are ignored.
    /// </param>
    /// <param name="materials">The subset to search. Omit it to search every material.</param>
    /// <returns>The material, or <see langword="null"/> when no material has that name.</returns>
    public static Material? FindByName(string? name, IReadOnlyList<Material>? materials = null) =>
        IsWholeCatalogue(materials)
            ? RegistryIndex.FindInKeyIndex(ByName.Value, name)
            : RegistryIndex.FindByKey(materials!, material => material.Name, name);

    /// <summary>Finds a raw material by its chemical element symbol.</summary>
    /// <param name="elementSymbol">
    /// The element symbol, such as <c>Fe</c>. Leading and trailing whitespace and case are
    /// ignored.
    /// </param>
    /// <param name="materials">The subset to search. Omit it to search every material.</param>
    /// <returns>
    /// The material, or <see langword="null"/>. Only raw materials carry an element
    /// symbol, so a manufactured or encoded subset never matches.
    /// </returns>
    public static Material? FindByElementSymbol(string? elementSymbol, IReadOnlyList<Material>? materials = null) =>
        IsWholeCatalogue(materials)
            ? RegistryIndex.FindInKeyIndex(ByElement.Value, elementSymbol)
            : RegistryIndex.FindByKey(materials!, material => material.ElementSymbol, elementSymbol);

    /// <summary>Every material of one grade, across all three categories.</summary>
    /// <param name="grade">The grade to match. A grade no material carries matches nothing.</param>
    /// <returns>The matches, in catalogue order.</returns>
    public static IReadOnlyList<Material> ByGrade(MaterialGrade grade)
    {
        List<Material> matches = [];
        foreach (Material material in All)
        {
            if (material.Grade == grade) matches.Add(material);
        }

        return new ReadOnlyCollection<Material>(matches);
    }

    /// <summary>Every material in one line, in catalogue order.</summary>
    /// <param name="line">The line to match.</param>
    /// <returns>The matches, in catalogue order.</returns>
    public static IReadOnlyList<Material> InLine(MaterialLine line)
    {
        List<Material> matches = [];
        foreach (Material material in All)
        {
            if (material.Line == line) matches.Add(material);
        }

        return new ReadOnlyCollection<Material>(matches);
    }

    /// <summary>Every material in one line, named as the game spells it.</summary>
    /// <remarks>
    /// The same answer as the <see cref="MaterialLine"/> overload, reached from a string —
    /// which is what you have when the line came from a dropdown or a saved filter.
    /// Leading and trailing whitespace and case are ignored.
    /// </remarks>
    /// <param name="line">The line name, such as <c>Mechanical Components</c>.</param>
    /// <returns>The matches, or an empty list when no line has that name.</returns>
    public static IReadOnlyList<Material> InLine(string? line) =>
        MaterialLines.TryParse(line, out MaterialLine parsed) ? InLine(parsed) : [];

    /// <summary>Every material in one category, in catalogue order.</summary>
    /// <param name="category">The category to match.</param>
    /// <returns>The category's own catalogue.</returns>
    public static IReadOnlyList<Material> InCategory(MaterialCategory category) => category switch
    {
        MaterialCategory.Raw => Raw,
        MaterialCategory.Manufactured => Manufactured,
        MaterialCategory.Encoded => Encoded,
        _ => [],
    };

    /// <summary>Every material in one category, named as the data files spell it.</summary>
    /// <remarks>
    /// The same answer as the <see cref="MaterialCategory"/> overload, reached from a
    /// string. Leading and trailing whitespace and case are ignored.
    /// </remarks>
    /// <param name="category">The category name: <c>raw</c>, <c>manufactured</c> or <c>encoded</c>.</param>
    /// <returns>The matches, or an empty list when no category has that name.</returns>
    public static IReadOnlyList<Material> InCategory(string? category) =>
        MaterialCategories.TryParse(category, out MaterialCategory parsed) ? InCategory(parsed) : [];

    private static bool IsWholeCatalogue(IReadOnlyList<Material>? materials) =>
        materials is null || ReferenceEquals(materials, All);

    private static ReadOnlyCollection<Material> Concatenate()
    {
        List<Material> all = new(Raw.Count + Manufactured.Count + Encoded.Count);
        all.AddRange(Raw);
        all.AddRange(Manufactured);
        all.AddRange(Encoded);
        return new ReadOnlyCollection<Material>(all);
    }
}
