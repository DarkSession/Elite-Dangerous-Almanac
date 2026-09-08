using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
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

    [Fact]
    public void AShipTooHeavyForItsOwnThrustersCannotLeaveThePad()
    {
        LoadoutValidation result = ValidateBare(
            [Fitted("MainEngines", "Int_Engine_Size2_Class1") with { ThrusterMaxMass = 72 }],
            new LoadoutMass(60.6) { Fuel = 25 });

        LoadoutIssue issue = Assert.Single(result.Issues);

        Assert.Equal(LoadoutIssueCode.ThrusterMassExceeded, issue.Code);
        Assert.Equal(LoadoutIssueSeverity.Error, issue.Severity);

        // The full tank is what sinks it: the fit alone is inside the rating.
        Assert.Equal(ThrusterLoad.Unladen, issue.Load);
        Assert.Equal(85.6, issue.Mass);
        Assert.Equal(72, issue.MaxMass);
        Assert.Equal(
            "MainEngines: Int_Engine_Size2_Class1 is rated to 72 t but the ship weighs 85.6 t with a full tank",
            issue.Message);
        Assert.False(result.Valid);
    }

    [Fact]
    public void AShipTooHeavyOnlyWhenLadenStillFlies()
    {
        LoadoutValidation result = ValidateBare(
            [Fitted("MainEngines", "Int_Engine_Size2_Class1") with { ThrusterMaxMass = 72 }],
            new LoadoutMass(40) { Fuel = 25, Cargo = 16 });

        LoadoutIssue issue = Assert.Single(result.Issues);

        Assert.Equal(ThrusterLoad.Laden, issue.Load);
        Assert.Equal(LoadoutIssueSeverity.Warning, issue.Severity);
        Assert.EndsWith("fully laden", issue.Message, StringComparison.Ordinal);

        // A warning is a note against a build that is both legal and fully mounted.
        Assert.True(result.Valid);
        Assert.True(result.Complete);
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
