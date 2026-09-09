using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The aggregate sums a build reports, and the evidence a metric carries.</summary>
public class LoadoutCalculationsTests
{
    private static readonly IReadOnlyList<LoadoutCalculationModule> Fitted =
    [
        new LoadoutCalculationModule(2) { CargoCapacity = 32 },
        new LoadoutCalculationModule(4) { CargoCapacity = 64 },
        new LoadoutCalculationModule(1.5) { CabinCapacity = 8 },
        new LoadoutCalculationModule(0.5) { CabinCapacity = 2 },
        new LoadoutCalculationModule(5) { FuelCapacity = 32 },
        new LoadoutCalculationModule(0),
    ];

    [Fact]
    public void TheUnladenMassIsTheHullPlusEveryFittedModule()
    {
        Assert.Equal(38, LoadoutCalculations.UnladenMass(25, Fitted));

        // A hull with nothing fitted weighs what the hull weighs.
        Assert.Equal(25, LoadoutCalculations.UnladenMass(25, []));
    }

    [Fact]
    public void OnlyARackCarriesCargoAndOnlyACabinCarriesPassengers()
    {
        Assert.Equal(96, LoadoutCalculations.CargoCapacity(Fitted));
        Assert.Equal(10, LoadoutCalculations.PassengerCapacity(Fitted));

        // A build with neither carries nothing rather than reporting no answer.
        Assert.Equal(0, LoadoutCalculations.CargoCapacity([]));
        Assert.Equal(0, LoadoutCalculations.PassengerCapacity([]));
    }

    [Fact]
    public void TheFuelIsTheFittedTanksAndTheHullsOwnReserve()
    {
        LoadoutFuelCapacity fuel = LoadoutCalculations.FuelCapacity(0.52, Fitted);

        Assert.Equal(32, fuel.Main);
        Assert.Equal(0.52, fuel.Reserve);

        // The reserve is the hull's, so it stands whether a tank is fitted or not.
        Assert.Equal(new LoadoutFuelCapacity(0, 0.52), LoadoutCalculations.FuelCapacity(0.52, []));
    }

    [Fact]
    public void AnAbsentContributionListIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => LoadoutCalculations.UnladenMass(25, null!));
        Assert.Throws<ArgumentNullException>(() => LoadoutCalculations.CargoCapacity(null!));
        Assert.Throws<ArgumentNullException>(() => LoadoutCalculations.PassengerCapacity(null!));
        Assert.Throws<ArgumentNullException>(() => LoadoutCalculations.FuelCapacity(0.52, null!));
    }

    [Fact]
    public void ACompleteMetricCarriesItsValueAndNoIssue()
    {
        CalculationResult<double> result = CalculationResult.Of(37.5);

        Assert.True(result.Complete);
        Assert.Empty(result.Issues);
        Assert.Equal(37.5, result.Value);
        Assert.True(result.TryGetValue(out double value));
        Assert.Equal(37.5, value);
    }

    [Fact]
    public void AnIncompleteMetricNamesItsIssuesAndNoValue()
    {
        CalculationIssue issue = new(
            CalculationField.FrameShiftDrive,
            CalculationIssueReason.Missing,
            "The build fits no frame shift drive.")
        {
            Slot = "FrameShiftDrive",
            Symbol = "int_hyperdrive_size5_class5",
        };

        CalculationResult<double> result = CalculationResult.Unavailable<double>(issue);

        Assert.False(result.Complete);
        Assert.Same(issue, Assert.Single(result.Issues));
        Assert.False(result.TryGetValue(out double value));
        Assert.Equal(default, value);

        // An unavailable metric never exposes a misleading partial value.
        Assert.Throws<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void AnIncompleteMetricKeepsItsIssuesInTheOrderTheyWereRaised()
    {
        CalculationIssue mass = new(CalculationField.Mass, CalculationIssueReason.Unresolved, "a");
        CalculationIssue power = new(CalculationField.PowerDraw, CalculationIssueReason.Shed, "b");
        List<CalculationIssue> raised = [mass, power];

        CalculationResult<double> result = CalculationResult.Unavailable<double>(raised);
        raised.Clear();

        Assert.Equal([mass, power], result.Issues);
    }

    [Fact]
    public void AMetricRefusesToBeBuiltFromNothing()
    {
        Assert.Throws<ArgumentNullException>(() => CalculationResult.Of<string>(null!));
        Assert.Throws<ArgumentNullException>(
            () => CalculationResult.Unavailable<double>((CalculationIssue)null!));
        Assert.Throws<ArgumentNullException>(
            () => CalculationResult.Unavailable<double>((IReadOnlyList<CalculationIssue>)null!));

        // An incomplete metric that named no issue would say nothing at all.
        Assert.Throws<ArgumentException>(() => CalculationResult.Unavailable<double>([]));
    }

    [Theory]
    [InlineData(SlotKind.Core, true)]
    [InlineData(SlotKind.Armour, true)]
    [InlineData(SlotKind.CargoHatch, false)]
    [InlineData(SlotKind.Optional, false)]
    [InlineData(SlotKind.Hardpoint, false)]
    [InlineData(SlotKind.Utility, false)]
    public void AnOperationalBuildKeepsItsArmourAndCoreMountsFilled(SlotKind kind, bool required)
    {
        Assert.Equal(required, LoadoutSlotRules.IsRequired(kind));
    }

    [Theory]
    [InlineData(SlotKind.CargoHatch, ImmovableReason.CargoHatch)]
    [InlineData(SlotKind.Core, ImmovableReason.RequiredSlot)]
    [InlineData(SlotKind.Armour, ImmovableReason.RequiredSlot)]
    [InlineData(SlotKind.Optional, null)]
    [InlineData(SlotKind.Hardpoint, null)]
    public void AMountSaysWhyItCannotBeEmptied(SlotKind kind, ImmovableReason? reason)
    {
        Assert.Equal(reason, LoadoutSlotRules.FixedReason(kind));
    }

    [Theory]
    [InlineData(SlotKind.Core, null, StockedMountKind.Core)]
    [InlineData(SlotKind.Armour, null, StockedMountKind.Armour)]
    [InlineData(SlotKind.CargoHatch, null, StockedMountKind.CargoHatch)]
    [InlineData(SlotKind.Optional, SlotRestriction.PlanetaryApproachSuite, StockedMountKind.ApproachSuite)]
    [InlineData(SlotKind.Optional, SlotRestriction.Military, null)]
    [InlineData(SlotKind.Optional, null, null)]
    [InlineData(SlotKind.Hardpoint, null, null)]
    [InlineData(SlotKind.Utility, null, null)]
    internal void AnImportStocksOnlyTheMountsNoBuildGainsByShedding(
        SlotKind kind,
        SlotRestriction? restriction,
        StockedMountKind? stocked)
    {
        Assert.Equal(stocked, LoadoutSlotRules.StockedMount(kind, restriction));
    }
}
