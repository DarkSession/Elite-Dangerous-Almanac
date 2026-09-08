using System;
using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Materials;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Materials;

/// <summary>
/// The engineering-material catalogues, measured against the shared fixture that every
/// language implementation reads.
/// </summary>
public class MaterialCatalogueTests
{
    private static readonly MaterialsFixture Fixture =
        SharedFixtures.Load<MaterialsFixture>("fixtures/materials/materials.jsonc");

    public static TheoryData<string, int> Counts()
    {
        TheoryData<string, int> data = [];
        foreach (KeyValuePair<string, int> entry in Fixture.Counts) data.Add(entry.Key, entry.Value);
        return data;
    }

    public static TheoryData<string> FixtureSymbols()
    {
        TheoryData<string> data = [];
        foreach (MaterialFixtureRecord record in Fixture.Records) data.Add(record.Symbol);
        return data;
    }

    [Theory]
    [MemberData(nameof(Counts))]
    public void CatalogueHoldsTheFixturesCount(string catalogue, int expected) =>
        Assert.Equal(expected, CatalogueNamed(catalogue).Count);

    [Fact]
    public void AllIsTheThreeCataloguesConcatenated() =>
        Assert.Equal(
            MaterialCatalogue.Raw.Concat(MaterialCatalogue.Manufactured).Concat(MaterialCatalogue.Encoded),
            MaterialCatalogue.All);

    [Theory]
    [MemberData(nameof(FixtureSymbols))]
    public void FixtureRecordsResolveBySymbolAndName(string symbol)
    {
        MaterialFixtureRecord expected = Fixture.Records.Single(record => record.Symbol == symbol);
        Material? bySymbol = MaterialCatalogue.FindBySymbol(symbol);
        Assert.NotNull(bySymbol);
        Assert.Equal(expected.Category, bySymbol!.Category.ToString(), ignoreCase: true);
        Assert.Equal(expected.Name, bySymbol.Name);
        Assert.Equal(expected.ElementSymbol, bySymbol.ElementSymbol);
        Assert.Equal(expected.Grade, (int)bySymbol.Grade);
        Assert.Equal(expected.Line, bySymbol.Line.DisplayName());

        // The same record is reachable by its display name.
        Assert.Same(bySymbol, MaterialCatalogue.FindByName(expected.Name));
    }

    [Fact]
    public void EveryLineHoldsExactlyTheFixturesGrades()
    {
        foreach (LineGradesFixture expected in Fixture.LineGrades)
        {
            Assert.True(MaterialLines.TryParse(expected.Line, out MaterialLine line));
            IEnumerable<int> grades = CatalogueNamed(expected.Catalogue)
                .Where(material => material.Line == line)
                .Select(material => (int)material.Grade)
                .Distinct()
                .OrderBy(grade => grade);
            Assert.Equal(expected.Grades, grades);
        }
    }

    [Fact]
    public void TheMaterialsMissingFromFdevIdsAreStillPresent()
    {
        foreach (string name in Fixture.NotInFdevIds) Assert.NotNull(MaterialCatalogue.FindByName(name));
    }

    [Fact]
    public void SymbolLookupIgnoresCaseAndSurroundingWhitespace()
    {
        // The player journal reports the lower-cased symbol; it must still resolve.
        Assert.Equal("Grid Resistors", MaterialCatalogue.FindBySymbol("gridresistors")?.Name);
        Assert.Equal("Grid Resistors", MaterialCatalogue.FindBySymbol("  GRIDRESISTORS  ")?.Name);
    }

    [Fact]
    public void AnAbsentOrEmptyKeyIsAMissRatherThanAFailure()
    {
        Assert.Null(MaterialCatalogue.FindBySymbol(null));
        Assert.Null(MaterialCatalogue.FindBySymbol(string.Empty));
        Assert.Null(MaterialCatalogue.FindByName("   "));

        // Manufactured and encoded materials carry no element symbol; an empty query must
        // not coincidentally match one of them.
        Assert.Null(MaterialCatalogue.FindByElementSymbol(string.Empty));
        Assert.Null(MaterialCatalogue.FindByElementSymbol(null));
    }

    [Fact]
    public void ElementSymbolsResolveOnlyRawMaterials()
    {
        Assert.Equal("Iron", MaterialCatalogue.FindByElementSymbol("fe")?.Name);
        Assert.Null(MaterialCatalogue.FindByElementSymbol("Fe", MaterialCatalogue.Manufactured));
    }

    [Fact]
    public void ASubsetNarrowsTheSearchWithoutChangingTheAnswerShape()
    {
        Assert.NotNull(MaterialCatalogue.FindByName("Imperial Shielding"));
        Assert.Null(MaterialCatalogue.FindByName("Imperial Shielding", MaterialCatalogue.Raw));
        Assert.Equal(
            MaterialCatalogue.FindBySymbol("Iron"),
            MaterialCatalogue.FindBySymbol("Iron", MaterialCatalogue.Raw));
    }

    [Fact]
    public void GradeIsTheRarityAndRawNeverExceedsGradeFour()
    {
        foreach (Material material in MaterialCatalogue.All)
        {
            Assert.InRange((int)material.Grade, 1, 5);
            Assert.True(Enum.IsDefined(material.Grade));
        }

        Assert.All(MaterialCatalogue.Raw, material => Assert.True(material.Grade <= MaterialGrade.Rare));
    }

    [Fact]
    public void ByGradeAndInCategoryAgreeWithTheCatalogues()
    {
        Assert.Equal(
            MaterialCatalogue.All.Where(material => material.Grade == MaterialGrade.VeryRare),
            MaterialCatalogue.ByGrade(MaterialGrade.VeryRare));
        Assert.Empty(MaterialCatalogue.ByGrade((MaterialGrade)9));

        Assert.Same(MaterialCatalogue.Raw, MaterialCatalogue.InCategory(MaterialCategory.Raw));
        Assert.Same(MaterialCatalogue.Encoded, MaterialCatalogue.InCategory("Encoded"));
        Assert.Empty(MaterialCatalogue.InCategory("guardian"));
        Assert.Empty(MaterialCatalogue.InCategory((string?)null));
        Assert.Empty(MaterialCatalogue.InCategory((MaterialCategory)7));
    }

    [Fact]
    public void InLineReadsTheInGameSpellingAsWellAsTheMember()
    {
        IReadOnlyList<Material> byMember = MaterialCatalogue.InLine(MaterialLine.MechanicalComponents);
        Assert.NotEmpty(byMember);
        Assert.Equal(byMember, MaterialCatalogue.InLine("Mechanical Components"));
        Assert.Equal(byMember, MaterialCatalogue.InLine("  mechanicalcomponents  "));
        Assert.Empty(MaterialCatalogue.InLine("Nothing Named This"));
        Assert.Empty(MaterialCatalogue.InLine((string?)null));
    }

    [Fact]
    public void LineNamesRoundTripAndAnUnknownMemberIsRefused()
    {
        foreach (MaterialLine line in Enum.GetValues<MaterialLine>())
        {
            Assert.True(MaterialLines.TryParse(line.DisplayName(), out MaterialLine parsed));
            Assert.Equal(line, parsed);
        }

        Assert.Throws<ArgumentOutOfRangeException>(() => ((MaterialLine)99).DisplayName());
    }

    private static IReadOnlyList<Material> CatalogueNamed(string name) => name switch
    {
        "raw" => MaterialCatalogue.Raw,
        "manufactured" => MaterialCatalogue.Manufactured,
        "encoded" => MaterialCatalogue.Encoded,
        "all" => MaterialCatalogue.All,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, "Not a material catalogue."),
    };
}
