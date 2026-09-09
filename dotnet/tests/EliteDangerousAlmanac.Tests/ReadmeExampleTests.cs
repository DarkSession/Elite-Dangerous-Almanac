using EliteDangerousAlmanac.Astronomy;
using EliteDangerousAlmanac.Equipment;
using EliteDangerousAlmanac.Ships;
using Xunit;

namespace EliteDangerousAlmanac.Tests;

/// <summary>The examples the package README shows a caller.</summary>
/// <remarks>
/// Each test is the example itself. A rename that the README does not follow therefore
/// fails to build here, which is how the TypeScript package holds its own examples
/// honest.
/// </remarks>
public sealed class ReadmeExampleTests
{
    [Fact]
    public void TheSystemExampleReadsASystemFromItsNameAndItsAddress()
    {
        ProceduralSystem? system = ProceduralSystem.FromName("Synuefe EN-H d11-96");
        ulong address = system!.SystemAddress;

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
}
