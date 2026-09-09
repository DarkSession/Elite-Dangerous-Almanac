using System;
using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>How long a collapsed shield takes to come back, and what the cell banks hold.</summary>
public class ShieldRecoveryTests
{
    private static readonly OperationsFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc");

    /// <summary>The precision the fixture states a recovery time to.</summary>
    private const double Tolerance = 1e-9;

    [Fact]
    public void TheSharedFixturePinsTheRecoveryTimesAtFullSystems()
    {
        ShieldRecoveryFixture stated = Fixture.ShieldRecovery;

        ShieldRecoveryMetrics metrics = ShieldRecovery.Metrics(stated.Input.ToInput());

        AssertRecovery(stated.Expected, metrics);
    }

    [Fact]
    public void TheSharedFixturePinsTheRecoveryTimesAtAPartAllocation()
    {
        ShieldRecoveryCaseFixture stated = Fixture.ShieldRecovery.PipAllocation;

        ShieldRecoveryMetrics metrics = ShieldRecovery.Metrics(
            stated.Input.ToInput(), stated.Input.SystemsPips ?? 4);

        AssertRecovery(stated.Expected, metrics);
    }

    [Fact]
    public void TheSharedFixturePinsAStrengthTheCalculationRefuses()
    {
        ShieldRecoveryCaseFixture stated = Fixture.ShieldRecovery.InvalidStrength;

        Assert.Equal("RangeError", stated.ExpectedError);
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ShieldRecovery.Metrics(stated.Input.ToInput()));
    }

    [Fact]
    public void FewerPipsToSystemsMakeTheShieldSlowerToReturn()
    {
        ShieldRecoveryInput input = Fixture.ShieldRecovery.PipAllocation.Input.ToInput();

        ShieldRecoveryMetrics full = ShieldRecovery.Metrics(input, 4);
        ShieldRecoveryMetrics half = ShieldRecovery.Metrics(input, 2);

        Assert.True(half.RecoveryTime > full.RecoveryTime);
        Assert.True(half.RegenTime > full.RegenTime);
    }

    [Fact]
    public void AGeneratorThatDoesNotRegenerateNeverReturns()
    {
        ShieldRecoveryMetrics metrics = ShieldRecovery.Metrics(
            new ShieldRecoveryInput(200, 0, 0, 0.6, 20, 2));

        Assert.Equal(double.PositiveInfinity, metrics.RecoveryTime);
        Assert.Equal(double.PositiveInfinity, metrics.RegenTime);
    }

    [Fact]
    public void ADrawlessGeneratorIsPacedByItsOwnRateAlone()
    {
        ShieldRecoveryMetrics metrics = ShieldRecovery.Metrics(
            new ShieldRecoveryInput(200, 2, 4, 0, 0, 0));

        // Half the strength at the broken rate, and the sixteen second delay before it.
        Assert.Equal(16 + (100 / 4d), metrics.RecoveryTime);
        Assert.Equal(100 / 2d, metrics.RegenTime);
    }

    [Fact]
    public void ADrainedCapacitorThatNeverRechargesStrandsThePhase()
    {
        ShieldRecoveryMetrics metrics = ShieldRecovery.Metrics(
            new ShieldRecoveryInput(200, 2, 4, 0.6, 1, 0));

        Assert.Equal(double.PositiveInfinity, metrics.RecoveryTime);
    }

    [Fact]
    public void ARaisedShieldAtNoStrengthTakesOnlyTheDelay()
    {
        ShieldRecoveryMetrics metrics = ShieldRecovery.Metrics(
            new ShieldRecoveryInput(0, 2, 4, 0.6, 20, 2));

        Assert.Equal(16, metrics.RecoveryTime);
        Assert.Equal(0, metrics.RegenTime);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    public void AnAllocationOutsideTheRangeIsRefused(double systemsPips) =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ShieldRecovery.Metrics(new ShieldRecoveryInput(200, 2, 4, 0.6, 20, 2), systemsPips));

    public static TheoryData<ShieldRecoveryInput> NonPhysicalShields() =>
    [
        new ShieldRecoveryInput(200, -1, 4, 0.6, 20, 2),
        new ShieldRecoveryInput(200, 2, double.NaN, 0.6, 20, 2),
        new ShieldRecoveryInput(200, 2, 4, double.PositiveInfinity, 20, 2),
        new ShieldRecoveryInput(200, 2, 4, 0.6, -1, 2),
        new ShieldRecoveryInput(200, 2, 4, 0.6, 20, -1),
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalShields))]
    public void AFigureThatIsNotPhysicalIsRefused(ShieldRecoveryInput input) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => ShieldRecovery.Metrics(input));

    [Fact]
    public void AMissingInputIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => ShieldRecovery.Metrics(null!));
        Assert.Throws<ArgumentNullException>(() => ShieldRecovery.SummariseCellBanks(null!));
    }

    [Fact]
    public void TheSharedFixturePinsTheCellBankPool()
    {
        CellBanksFixture stated = Fixture.CellBanks;
        List<CellBankInput> banks = stated.Input.Select(bank => bank.ToInput()).ToList();

        CellBankSummary summary = ShieldRecovery.SummariseCellBanks(banks);

        Assert.Equal(stated.Expected.TotalRestorable, summary.TotalRestorable);
        Assert.Equal(stated.Expected.TotalCells, summary.TotalCells);
        Assert.Equal(stated.Expected.Powered, summary.Banks.Select(bank => bank.Powered));
        Assert.Equal(stated.Input.Count, summary.Banks.Count);
        for (int position = 0; position < stated.Input.Count; position++)
        {
            CellBankInputFixture expected = stated.Input[position];
            CellBankMetrics bank = summary.Banks[position];

            Assert.Equal(expected.Slot, bank.Slot);
            Assert.Equal(expected.Symbol, bank.Symbol);
            // One complete activation restores the rate for as long as the cell runs.
            Assert.Equal(expected.ReinforcementRate * expected.Duration, bank.Reinforcement);
            Assert.Equal(expected.Cells, bank.Cells);
            Assert.Equal(expected.SpinUp, bank.SpinUp);
            Assert.Equal(expected.Heat, bank.Heat);
        }
    }

    [Fact]
    public void ASwitchedOffBankIsStillReportedAndAddsNothingToThePool()
    {
        CellBankSummary summary = ShieldRecovery.SummariseCellBanks([
            new CellBankInput("Slot01_Size6", "bank", 12, 4, 5, 1, 170, Powered: false),
        ]);

        Assert.Equal(48, Assert.Single(summary.Banks).Reinforcement * 4);
        Assert.Equal(0, summary.TotalRestorable);
        Assert.Equal(0, summary.TotalCells);
    }

    [Fact]
    public void NoBanksAtAllIsAnEmptyPool()
    {
        CellBankSummary summary = ShieldRecovery.SummariseCellBanks([]);

        Assert.Empty(summary.Banks);
        Assert.Equal(0, summary.TotalRestorable);
        Assert.Equal(0, summary.TotalCells);
    }

    [Fact]
    public void TheBankListRefusesMutation()
    {
        CellBankSummary summary = ShieldRecovery.SummariseCellBanks([
            new CellBankInput("Slot01_Size6", "bank", 12, 4, 5, 1, 170, Powered: true),
        ]);

        Assert.Throws<NotSupportedException>(() => ((IList<CellBankMetrics>)summary.Banks).Clear());
    }

    private static void AssertRecovery(
        ShieldRecoveryExpectedFixture expected, ShieldRecoveryMetrics actual)
    {
        Assert.Equal(expected.RegenRate, actual.RegenRate);
        Assert.Equal(expected.BrokenRegenRate, actual.BrokenRegenRate);
        Assert.Equal(expected.RecoveryTime, actual.RecoveryTime, Tolerance);
        Assert.Equal(expected.RegenTime, actual.RegenTime, Tolerance);
    }
}
