using System;
using System.Collections.Generic;
using System.Text;
using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests;

/// <summary>The examples the package README shows a caller.</summary>
/// <remarks>
/// Each test is one example, and <see cref="EveryExampleTheReadmeShowsIsRunHere"/> reads
/// the README itself to prove it. A statement the README states and this file does not
/// fails that test, which is how the TypeScript package holds its own examples honest.
/// </remarks>
public sealed class ReadmeExampleTests
{
    [Fact]
    public void TheSystemExampleReadsASystemFromItsNameAndItsAddress()
    {
        ProceduralSystem? system = ProceduralSystem.FromName("Synuefe EN-H d11-96");
        ulong address = system!.SystemAddress;

        // A journal event reports the address, and the position beside it names the region the
        // game shows for a system inside a nebula.
        ProceduralSystem again = ProceduralSystem.FromSystemAddress(
            address, new GalacticPosition(751, -179, -91));

        Assert.Equal("Synuefe EN-H d11-96", again.Name);
    }

    [Fact]
    public void TheShipExampleFitsACargoRackAndReadsTheJumpRange()
    {
        ShipLoadout build = ShipLoadout.Default("Anaconda");
        build.SetModule(
            "Slot01_Size7", ModuleCatalogue.FindBySymbol("Int_CargoRack_Size7_Class1")!);

        BuildMetrics metrics = BuildMetrics.Of(build);
        JumpRangeSummary jump = metrics.JumpRangeSummary();
        double laden = jump.Laden;

        Assert.True(laden > 0);
    }

    [Fact]
    public void TheSuitExampleReadsASuitAtItsBestGrade()
    {
        Suit maverick = SuitCatalogue.FindByName("Maverick Suit")!;
        SuitGrade? best = SuitCatalogue.Grade(maverick, 5);

        Assert.NotNull(best);
    }

    /// <summary>Reads the README and finds every C# example it shows in this file.</summary>
    /// <remarks>
    /// The comparison drops the <c>using</c> directives, which a test file states once at
    /// the top rather than per example, and folds each run of whitespace into one space, so
    /// a line the two files wrap differently still matches. Everything else has to agree
    /// word for word.
    /// </remarks>
    [Fact]
    public void EveryExampleTheReadmeShowsIsRunHere()
    {
        string source = Normalize(EmbeddedText.Read("docs/readme-example-tests.cs"));
        IReadOnlyList<string> examples = CSharpExamples(
            EmbeddedText.Read("docs/package-readme.md"));

        Assert.NotEmpty(examples);
        foreach (string example in examples)
        {
            Assert.Contains(Normalize(example), source, StringComparison.Ordinal);
        }
    }

    /// <summary>Reads the body of every fenced C# block of one Markdown file.</summary>
    private static IReadOnlyList<string> CSharpExamples(string markdown)
    {
        List<string> examples = [];
        StringBuilder current = new();
        bool inside = false;

        foreach (string line in markdown.Replace("\r\n", "\n").Split('\n'))
        {
            if (!inside)
            {
                inside = line.Trim() == "```csharp";
                continue;
            }

            if (line.Trim() == "```")
            {
                examples.Add(current.ToString());
                current.Clear();
                inside = false;
                continue;
            }

            // A test file states its usings once at the top, so an example's own are dropped.
            if (line.StartsWith("using ", StringComparison.Ordinal)) continue;
            current.Append(line).Append('\n');
        }

        return examples;
    }

    /// <summary>Folds every run of whitespace into one space.</summary>
    private static string Normalize(string text)
    {
        StringBuilder folded = new(text.Length);
        bool pending = false;

        foreach (char character in text)
        {
            if (char.IsWhiteSpace(character))
            {
                pending = folded.Length > 0;
                continue;
            }

            if (pending) folded.Append(' ');
            pending = false;
            folded.Append(character);
        }

        return folded.ToString();
    }
}
