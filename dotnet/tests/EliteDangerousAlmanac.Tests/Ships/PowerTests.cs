using System;
using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What the plant makes, what the build draws, and which groups stay lit.</summary>
public class PowerTests
{
    private static readonly PowerBudgetFixture Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc").Functions.PowerBudget;

    [Fact]
    public void TheSharedFixturePinsThePriorityBandModel()
    {
        List<PowerConsumer> consumers = Fixture.Consumers
            .Select(consumer => new PowerConsumer(consumer.Draw)
            {
                Priority = consumer.Priority,
                DeployedOnly = consumer.DeployedOnly,
            })
            .ToList();

        PowerBudget budget = Power.Budget(Fixture.Available, consumers);

        Assert.Equal(Fixture.Retracted, budget.Retracted);
        Assert.Equal(Fixture.Deployed, budget.Deployed);
        Assert.Equal(Fixture.Bands.Count, budget.Bands.Count);
        for (int position = 0; position < Fixture.Bands.Count; position++)
        {
            PowerBandFixture expected = Fixture.Bands[position];
            PowerBand band = budget.Bands[position];

            Assert.Equal(expected.Priority, band.Priority);
            Assert.Equal(expected.Retracted, band.Retracted);
            Assert.Equal(expected.Deployed, band.Deployed);
            Assert.Equal(expected.RetractedTotal, band.RetractedTotal);
            Assert.Equal(expected.DeployedTotal, band.DeployedTotal);
            Assert.Equal(expected.PoweredRetracted, band.PoweredRetracted);
            Assert.Equal(expected.PoweredDeployed, band.PoweredDeployed);
        }
    }

    [Fact]
    public void ABuildInsideItsBudgetPowersEveryGroup()
    {
        PowerBudget budget = Power.Budget(20, [
            new PowerConsumer(5) { Priority = 1 },
            new PowerConsumer(4) { Priority = 2 },
            new PowerConsumer(3) { Priority = 5 },
        ]);

        Assert.Equal(20, budget.Available);
        Assert.Equal(12, budget.Retracted);
        Assert.Equal(12, budget.Deployed);
        Assert.Equal(8, budget.Headroom);
        Assert.Equal(0.6, budget.Utilisation);
        Assert.True(budget.WithinBudget);
        Assert.All(budget.Bands, band => Assert.True(band.PoweredRetracted && band.PoweredDeployed));
    }

    [Fact]
    public void WeaponsOnlyDrawWithTheHardpointsDeployed()
    {
        PowerBudget budget = Power.Budget(10, [
            new PowerConsumer(2) { Priority = 1 },
            new PowerConsumer(3) { Priority = 1, DeployedOnly = true },
        ]);

        Assert.Equal(2, budget.Retracted);
        Assert.Equal(5, budget.Deployed);
        // A group's own figures follow the same rule: deployed includes what it drew stowed.
        Assert.Equal(2, budget.Bands[0].Retracted);
        Assert.Equal(5, budget.Bands[0].Deployed);
        Assert.Equal(5, budget.Bands[0].DeployedTotal);
    }

    [Fact]
    public void EachGroupsOwnDrawSumsBackToTheBuildsTotals()
    {
        PowerBudget budget = Power.Budget(30, [
            new PowerConsumer(1.5) { Priority = 1 },
            new PowerConsumer(2) { Priority = 3, DeployedOnly = true },
            new PowerConsumer(0.5) { Priority = 5 },
        ]);

        Assert.Equal(budget.Retracted, budget.Bands.Sum(band => band.Retracted));
        Assert.Equal(budget.Deployed, budget.Bands.Sum(band => band.Deployed));
        Assert.All(budget.Bands, band => Assert.True(band.Deployed >= band.Retracted));
    }

    [Fact]
    public void ASwitchedOffModuleDrawsNothing()
    {
        PowerBudget budget = Power.Budget(10, [
            new PowerConsumer(2) { Priority = 1 },
            new PowerConsumer(8) { Priority = 1, Enabled = false },
        ]);

        Assert.Equal(2, budget.Deployed);
    }

    [Fact]
    public void PriorityGroupsAreCumulativeAndTheOnesThatOverflowGoDark()
    {
        PowerBudget budget = Power.Budget(6, [
            new PowerConsumer(4) { Priority = 1 },
            new PowerConsumer(1) { Priority = 2 },
            new PowerConsumer(3) { Priority = 3 },
            new PowerConsumer(1) { Priority = 4 },
        ]);

        Assert.Equal(9, budget.Deployed);
        Assert.False(budget.WithinBudget);
        Assert.Equal(-3, budget.Headroom);
        Assert.Equal([4, 5, 8, 9, 9], budget.Bands.Select(band => band.DeployedTotal));
        Assert.Equal([4, 1, 3, 1, 0], budget.Bands.Select(band => band.Deployed));
        Assert.Equal(
            [true, true, false, false, false],
            budget.Bands.Select(band => band.PoweredDeployed));
        // Nothing here is weapons-only, so stowing the hardpoints changes nothing.
        Assert.Equal(
            [true, true, false, false, false],
            budget.Bands.Select(band => band.PoweredRetracted));
    }

    [Fact]
    public void AGroupCanBeLitRetractedAndDarkDeployed()
    {
        PowerBudget budget = Power.Budget(5, [
            new PowerConsumer(4) { Priority = 1 },
            new PowerConsumer(3) { Priority = 2, DeployedOnly = true },
            new PowerConsumer(0.5) { Priority = 3 },
        ]);

        Assert.True(budget.Bands[2].PoweredRetracted);
        Assert.False(budget.Bands[2].PoweredDeployed);
    }

    [Fact]
    public void AGroupDrawingExactlyThePowerAvailableStaysOnline()
    {
        PowerBudget budget = Power.Budget(4.8, [new PowerConsumer(4.8) { Priority = 3 }]);

        Assert.True(budget.WithinBudget);
        Assert.True(budget.Bands[2].PoweredDeployed);
        Assert.Equal(0, budget.Headroom);
    }

    [Fact]
    public void PrioritiesOutsideTheFiveGroupsAreClampedAndAnAbsentOneMeansGroupOne()
    {
        PowerBudget budget = Power.Budget(10, [
            new PowerConsumer(1),
            new PowerConsumer(2) { Priority = 0 },
            new PowerConsumer(4) { Priority = 99 },
        ]);

        Assert.Equal(3, budget.Bands[0].Retracted);
        Assert.Equal(4, budget.Bands[4].Retracted);
    }

    [Fact]
    public void ABuildWithNoPowerPlantPowersNothing()
    {
        PowerBudget budget = Power.Budget(0, [new PowerConsumer(1) { Priority = 1 }]);

        Assert.Equal(0, budget.Available);
        Assert.Equal(double.PositiveInfinity, budget.Utilisation);
        Assert.False(budget.WithinBudget);
        Assert.All(budget.Bands, band => Assert.False(band.PoweredDeployed));
    }

    [Fact]
    public void AnEmptyBuildIsWithinBudgetAndStillReportsTheFiveGroupsInOrder()
    {
        PowerBudget budget = Power.Budget(0, []);

        Assert.Equal(0, budget.Deployed);
        Assert.Equal(0, budget.Utilisation);
        Assert.True(budget.WithinBudget);
        Assert.Equal([1, 2, 3, 4, 5], budget.Bands.Select(band => band.Priority));
    }

    [Fact]
    public void ConsumerResultsKeepSourceOrderAndNormaliseTheirPresentationFields()
    {
        PowerBudget budget = Power.Budget(10, [
            new PowerConsumer(2) { Label = "A", Symbol = "Known", Priority = 99, DeployedOnly = true },
            new PowerConsumer(3) { Label = "B", Symbol = "Disabled", Enabled = false },
        ]);

        Assert.Equal(
            [
                new PowerConsumerResult(2, true, 5, true, "A", "Known"),
                new PowerConsumerResult(3, false, 1, false, "B", "Disabled"),
            ],
            budget.Consumers);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void AnAvailablePowerThatIsNotPhysicalIsRefused(double available) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Power.Budget(available, []));

    [Theory]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void ADrawThatIsNotPhysicalIsRefusedEvenSwitchedOff(double draw)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Power.Budget(10, [new PowerConsumer(draw)]));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Power.Budget(10, [new PowerConsumer(draw) { Enabled = false }]));
    }

    [Fact]
    public void AMissingConsumerListIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => Power.Budget(10, null!));

    [Fact]
    public void TheBandsAndConsumersRefuseMutation()
    {
        PowerBudget budget = Power.Budget(20, [new PowerConsumer(5) { Priority = 1 }]);

        Assert.Throws<NotSupportedException>(() => ((IList<PowerBand>)budget.Bands).Clear());
        Assert.Throws<NotSupportedException>(
            () => ((IList<PowerConsumerResult>)budget.Consumers).Clear());
    }
}
