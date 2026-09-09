using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The structural rules a fitted build answers to.</summary>
public class LoadoutValidationTests
{
    private static readonly IReadOnlyList<BuildSlot> Sidewinder =
        BuildSlots.Enumerate(ShipCatalogue.FindSlots("SideWinder")!);

    private static LoadoutValidation Validate(
        IReadOnlyList<ValidationModule> modules,
        LoadoutMass? mass = null) =>
        LoadoutValidator.Validate(
            new LoadoutValidationInput("SideWinder", Sidewinder, modules) { Mass = mass });

    /// <summary>Validates against a layout with no mounts, to isolate a mass rule.</summary>
    private static LoadoutValidation ValidateBare(
        IReadOnlyList<ValidationModule> modules,
        LoadoutMass? mass = null) =>
        LoadoutValidator.Validate(
            new LoadoutValidationInput("CustomHull", [], modules)
            {
                Mass = mass,
            });

    private static ValidationModule Fitted(string slot, string symbol) =>
        new(slot, symbol) { RequiresKnownSlot = false };

    private static readonly ThrusterMassFixture ThrusterMass =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc").ThrusterMass;

    /// <summary>The thrusters every mass case is weighed against.</summary>
    private static ValidationModule Thrusters() =>
        Fitted(ThrusterMass.Input.Slot, ThrusterMass.Input.Symbol) with
        {
            ThrusterMaxMass = ThrusterMass.Input.ThrusterMaxMass,
        };

    /// <summary>One stated load, where a load that carries nothing states nothing.</summary>
    private static LoadoutMass Mass(ThrusterMassLoadFixture load) =>
        new(load.Dry)
        {
            Fuel = load.Fuel == 0 ? null : load.Fuel,
            Cargo = load.Cargo == 0 ? null : load.Cargo,
        };

    /// <summary>Names one enumeration member the way the shared fixtures spell it.</summary>
    private static string Spelled<T>(T value)
        where T : struct, Enum
    {
        string name = value.ToString()!;
        return char.ToLowerInvariant(name[0]) + name.Substring(1);
    }

    [Fact]
    public void ABuildThatClaimsNoImpossibleFitIsValid()
    {
        LoadoutValidation result = LoadoutValidator.Validate(
            new LoadoutValidationInput("CustomHull", [], []));

        Assert.True(result.Valid);

        // A layout with no required mounts is complete as soon as it is valid.
        Assert.True(result.Complete);
        Assert.Empty(result.Issues);
    }

    [Fact]
    public void ARepeatedMountIsReportedWhateverCaseItIsWrittenIn()
    {
        LoadoutValidation result = Validate(
            [Fitted("PowerPlant", "a"), Fitted("powerplant", "b")]);

        LoadoutIssue issue = Assert.Single(
            result.Issues, entry => entry.Code == LoadoutIssueCode.DuplicateSlot);

        Assert.Equal(LoadoutIssueSeverity.Error, issue.Severity);
        Assert.Equal("powerplant", issue.Slot);
        Assert.Equal("b", issue.Symbol);
        Assert.Equal("PowerPlant", issue.PreviousSlot);
        Assert.Equal(
            "Slot powerplant occurs more than once (also PowerPlant)", issue.Message);
        Assert.False(result.Valid);
    }

    [Fact]
    public void AMountTheHullDoesNotHaveIsReported()
    {
        LoadoutIssue issue = Assert.Single(
            Validate([new ValidationModule("Slot99_Size8", "a")]).Issues,
            entry => entry.Code == LoadoutIssueCode.UnknownSlot);

        Assert.Equal("Slot99_Size8 is not a slot on SideWinder", issue.Message);
        Assert.Equal("SideWinder", issue.ShipSymbol);
    }

    [Fact]
    public void AnEntryMayDeclareThatItNamesNoHullMount()
    {
        // A cosmetic entry a capture carries names no outfitting mount and is not a defect.
        LoadoutValidation result = Validate(
            [Fitted("PaintJob", "paintjob_sidewinder_blue")]);

        Assert.DoesNotContain(result.Issues, issue => issue.Code == LoadoutIssueCode.UnknownSlot);
    }

    [Fact]
    public void AnEmptyArmourOrCoreMountLeavesTheBuildIncomplete()
    {
        LoadoutValidation result = Validate([]);

        Assert.True(result.Valid);
        Assert.False(result.Complete);

        List<string> empty = [];
        foreach (LoadoutIssue issue in result.Issues)
        {
            Assert.Equal(LoadoutIssueCode.MissingRequiredSlot, issue.Code);
            Assert.Equal(LoadoutIssueSeverity.Incomplete, issue.Severity);
            empty.Add(issue.Slot!);
        }

        // The armour mount and the seven core internals, and nothing else.
        Assert.Equal(
            ["Armour", "PowerPlant", "MainEngines", "FrameShiftDrive", "LifeSupport",
             "PowerDistributor", "Radar", "FuelTank"],
            empty);
    }

    [Fact]
    public void TwoModulesOfAOnePerShipFamilyConflict()
    {
        LoadoutValidation result = Validate(
        [
            Fitted("Slot01_Size2", "a") with { ExclusionGroup = ModuleExclusionGroup.ShieldGenerator },
            Fitted("Slot02_Size2", "b") with { ExclusionGroup = ModuleExclusionGroup.ShieldGenerator },
        ]);

        LoadoutIssue issue = Assert.Single(
            result.Issues, entry => entry.Code == LoadoutIssueCode.DuplicateExclusiveModule);

        Assert.Equal(ModuleExclusionGroup.ShieldGenerator, issue.ExclusionGroup);
        Assert.Equal("Slot02_Size2", issue.Slot);
        Assert.Equal("Slot01_Size2", issue.PreviousSlot);
        Assert.Equal("a", issue.PreviousSymbol);
        Assert.False(result.Valid);
    }

    [Fact]
    public void MoreLimitedModulesThanTheShipAllowsIsReportedOnce()
    {
        List<ValidationModule> fitted = [];
        for (int index = 0; index < 5; index++)
        {
            fitted.Add(Fitted("SmallHardpoint" + index, "weapon") with
            {
                LimitGroup = ModuleLimitGroup.ExperimentalWeapon,
            });
        }

        LoadoutIssue issue = Assert.Single(
            Validate(fitted).Issues, entry => entry.Code == LoadoutIssueCode.ModuleLimitExceeded);

        Assert.Equal(ModuleLimitGroup.ExperimentalWeapon, issue.LimitGroup);
        Assert.Equal(5, issue.Count);
        Assert.Equal(4, issue.Limit);
        Assert.Null(issue.Slot);
    }

    [Fact]
    public void AFittedAllowanceIncreaseRaisesTheLimitItNames()
    {
        List<ValidationModule> fitted = [];
        for (int index = 0; index < 5; index++)
        {
            fitted.Add(Fitted("SmallHardpoint" + index, "weapon") with
            {
                LimitGroup = ModuleLimitGroup.ExperimentalWeapon,
            });
        }

        fitted.Add(Fitted("Slot01_Size2", "riggingKit") with
        {
            LimitIncrease = new ModuleLimitIncrease(ModuleLimitGroup.ExperimentalWeapon, 1),
        });

        Assert.DoesNotContain(
            Validate(fitted).Issues, issue => issue.Code == LoadoutIssueCode.ModuleLimitExceeded);
    }

    [Fact]
    public void AModuleThatDoesNotFitIsReportedWithTheRuleItBreaks()
    {
        ModuleFitProblem fit = new(ModuleFitConstraint.Oversized, "module size 3 exceeds slot size 2")
        {
            ModuleClass = 3,
            SlotSize = 2,
        };

        LoadoutIssue issue = Assert.Single(
            Validate([Fitted("Slot01_Size2", "Int_CargoRack_Size3_Class1") with { Fit = fit }]).Issues,
            entry => entry.Code == LoadoutIssueCode.IncompatibleModule);

        Assert.Same(fit, issue.Fit);
        Assert.Equal(
            "Slot01_Size2: Int_CargoRack_Size3_Class1 module size 3 exceeds slot size 2",
            issue.Message);
    }

    public static TheoryData<int> ThrusterMassCases()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < ThrusterMass.Cases.Count; index++) positions.Add(index);
        return positions;
    }

    public static TheoryData<int> QuietThrusterLoads()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < ThrusterMass.Quiet.Count; index++) positions.Add(index);
        return positions;
    }

    /// <summary>Thrusters rated below what the ship weighs, at each load in turn.</summary>
    /// <remarks>
    /// Only the lightest overloaded load is reported, and how badly it reads follows that
    /// load: a ship too heavy dry or with a full tank cannot leave the pad at all, while one
    /// that only a full hold sinks still flies.
    /// </remarks>
    [Theory]
    [MemberData(nameof(ThrusterMassCases))]
    public void ThrustersRatedBelowTheShipReportTheLightestLoadTheyCannotMove(int position)
    {
        ThrusterMassCaseFixture stated = ThrusterMass.Cases[position];
        ThrusterMassIssueFixture expected = stated.ExpectedIssue!;

        LoadoutValidation result = ValidateBare(
            [Thrusters()],
            new LoadoutMass(stated.Mass.Dry)
            {
                Fuel = stated.Mass.Fuel,
                Cargo = stated.Mass.Cargo,
            });

        LoadoutIssue issue = Assert.Single(result.Issues);
        Assert.Equal(expected.Code, Spelled(issue.Code));
        Assert.Equal(expected.Severity, Spelled(issue.Severity));
        Assert.Equal(expected.Message, issue.Message);
        Assert.Equal(expected.Params.Slot, issue.Slot);
        Assert.Equal(expected.Params.Symbol, issue.Symbol);
        Assert.Equal(expected.Params.Load, Spelled(issue.Load!.Value));
        Assert.Equal(expected.Params.Mass, issue.Mass);
        Assert.Equal(expected.Params.MaxMass, issue.MaxMass);

        // Only a load the ship never has to fly at leaves the build legal.
        Assert.Equal(issue.Severity == LoadoutIssueSeverity.Warning, result.Valid);
    }

    /// <summary>A ship the same thrusters carry at every load it states.</summary>
    /// <remarks>
    /// An unstated tank is a tank of unknown size rather than an empty one, so the loads
    /// above the fit itself go unchecked.
    /// </remarks>
    [Theory]
    [MemberData(nameof(QuietThrusterLoads))]
    public void ThrustersRatedAboveTheShipReportNothing(int position)
    {
        ThrusterMassLoadFixture load = ThrusterMass.Quiet[position];

        Assert.Empty(ValidateBare([Thrusters()], Mass(load)).Issues);
    }

    [Fact]
    public void AThrusterRatingIsWeighedOnlyAgainstTheLoadsTheBuildStates()
    {
        // An unstated tank is a tank of unknown size, not an empty one, so the loads above the
        // fit itself go unchecked.
        Assert.Empty(ValidateBare(
            [Fitted("MainEngines", "engine") with { ThrusterMaxMass = 72 }],
            new LoadoutMass(60.6)).Issues);

        // With no mass at all the rule does not run.
        Assert.Empty(ValidateBare([Fitted("MainEngines", "engine") with { ThrusterMaxMass = 1 }]).Issues);
    }

    [Fact]
    public void OnlyTheLightestOverloadedLoadIsReported()
    {
        LoadoutValidation result = ValidateBare(
            [Fitted("MainEngines", "engine") with { ThrusterMaxMass = 10 }],
            new LoadoutMass(60.6) { Fuel = 25, Cargo = 16 });

        Assert.Equal(ThrusterLoad.Dry, Assert.Single(result.Issues).Load);
    }

    [Theory]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    [InlineData(-1)]
    public void AMassThatCannotBeWeighedIsRefused(double tonnes)
    {
        // A value that is not a number compares false against every rating, so an unguarded
        // one would report an overload on any build it reached.
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ValidateBare([], new LoadoutMass(tonnes)));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ValidateBare([], new LoadoutMass(0) { Fuel = tonnes }));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ValidateBare([], new LoadoutMass(0) { Fuel = 0, Cargo = tonnes }));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ValidateBare([Fitted("MainEngines", "engine") with { ThrusterMaxMass = tonnes }]));
    }

    [Fact]
    public void AnAbsentInputIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => LoadoutValidator.Validate(null!));
    }
}
